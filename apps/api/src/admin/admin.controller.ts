import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { prisma, Prisma } from '@menenwbkam/database';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ReviewDto, MergeDto, TaxonomyDto, AdminPageDto } from './admin.dto';
import { publicSeller } from '../seller/seller.service';
import { resolve, basename } from 'node:path';
import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { Response } from 'express';
import { ApiBearerAuth } from '@nestjs/swagger';
@ApiBearerAuth()
@Controller('admin')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class AdminController {
  @Get('sellers') sellers(@Query() query: AdminPageDto) {
    return prisma.seller.findMany({
      select: { ...publicSeller, user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      skip: (query.page - 1) * 50,
    });
  }
  @Put('sellers/:id/review') async review(
    @Param('id') id: string,
    @Body() body: ReviewDto,
  ) {
    const seller = await prisma.seller.findUnique({ where: { id } });
    if (!seller) throw new NotFoundException();
    if (
      body.status === 'APPROVED' &&
      (!seller.commercialRegNo || !seller.verificationPath)
    )
      throw new BadRequestException(
        'Commercial registration and verification document are required',
      );
    return prisma.seller.update({
      where: { id },
      data: { status: body.status },
      select: publicSeller,
    });
  }
  @Get('sellers/:id/verification') async document(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const seller = await prisma.seller.findUnique({ where: { id } });
    if (
      !seller?.verificationPath ||
      basename(seller.verificationPath) !== seller.verificationPath
    )
      throw new NotFoundException();
    const path = resolve(
      process.env.UPLOAD_DIR || './uploads',
      seller.verificationPath,
    );
    await access(path).catch(() => {
      throw new NotFoundException();
    });
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="verification' +
        seller.verificationPath.slice(
          seller.verificationPath.lastIndexOf('.'),
        ) +
        '"',
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    return new StreamableFile(createReadStream(path));
  }
  @Post('brands') brand(@Body() body: TaxonomyDto) {
    return prisma.brand.create({ data: body });
  }
  @Post('categories') category(@Body() body: TaxonomyDto) {
    return prisma.category.create({ data: body });
  }
  @Get('products') products(@Query() query: AdminPageDto) {
    return prisma.product.findMany({
      include: { brand: true, _count: { select: { offers: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      skip: (query.page - 1) * 50,
    });
  }
  @Post('products/merge') async merge(@Body() body: MergeDto) {
    if (body.sourceId === body.targetId)
      throw new BadRequestException('Choose two different products');
    try {
      return await prisma.$transaction(
        async (tx) => {
          const products = await tx.product.findMany({
            where: { id: { in: [body.sourceId, body.targetId] } },
          });
          if (products.length !== 2) throw new NotFoundException();
          await tx.$queryRaw`SELECT id FROM "Product" WHERE id IN (${body.sourceId},${body.targetId}) ORDER BY id FOR UPDATE`;
          const source = await tx.offer.findMany({
            where: { productId: body.sourceId },
            select: { sellerId: true },
          });
          const overlaps = await tx.offer.count({
            where: {
              productId: body.targetId,
              sellerId: { in: source.map((o) => o.sellerId) },
            },
          });
          if (overlaps)
            throw new ConflictException(
              'A seller lists both products. Remove the duplicate offer before merging',
            );
          const sourceProduct = products.find((p) => p.id === body.sourceId)!;
          const targetProduct = products.find((p) => p.id === body.targetId)!;
          await tx.offer.updateMany({
            where: { productId: body.sourceId },
            data: { productId: body.targetId },
          });
          const reviews = await tx.review.findMany({
            where: { productId: body.sourceId },
            select: { id: true, orderId: true },
          });
          if (
            await tx.review.count({
              where: {
                productId: body.targetId,
                orderId: { in: reviews.map((r) => r.orderId) },
              },
            })
          )
            throw new ConflictException(
              'Both products have reviews in the same order; review these records before merging',
            );
          for (const review of reviews)
            await tx.review.update({
              where: { id: review.id },
              data: {
                productId: body.targetId,
                targetKey: 'PRODUCT:' + body.targetId,
              },
            });
          await tx.orderItem.updateMany({
            where: { productId: body.sourceId },
            data: { productId: body.targetId },
          });
          await tx.product.delete({ where: { id: body.sourceId } });
          if (!targetProduct.barcode && sourceProduct.barcode)
            await tx.product.update({
              where: { id: body.targetId },
              data: { barcode: sourceProduct.barcode },
            });
          return { merged: true, targetId: body.targetId };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (['P2002', 'P2034'].includes((error as { code?: string }).code || ''))
        throw new ConflictException(
          'Products changed during merge; review and retry',
        );
      throw error;
    }
  }
}
