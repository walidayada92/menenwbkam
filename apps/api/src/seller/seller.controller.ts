import {
  BadRequestException,
  NotFoundException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, join } from 'node:path';
import { RolesGuard, AuthRequest } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SellerService, publicSeller } from './seller.service';
import { SellerProfileDto, OfferDto } from './seller.dto';
import { prisma } from '@menenwbkam/database';
import { parseImport } from './import';
import { ApiBearerAuth } from '@nestjs/swagger';
import { workspaceFor, Permission } from '../workspace/access';
@ApiBearerAuth()
@Controller('seller')
@UseGuards(RolesGuard)
@Roles('SELLER')
export class SellerController {
  constructor(private service: SellerService) {}
  private async actor(req: AuthRequest, permission: Permission) {
    return (await workspaceFor(req.user.sub, req.user.workspaceId, permission))
      .seller.userId;
  }
  @Get('profile') async profile(@Req() req: AuthRequest) {
    try {
      const scope = await workspaceFor(req.user.sub, req.user.workspaceId);
      return {
        ...(await this.service.profile(scope.seller.userId)),
        ...(scope.role === 'OWNER'
          ? {}
          : { commercialRegNo: null, verificationName: null }),
        workspaceRole: scope.role,
      };
    } catch (error) {
      if (error instanceof NotFoundException && !req.user.workspaceId)
        return this.service.profile(req.user.sub);
      throw error;
    }
  }
  @Put('profile') async register(
    @Req() req: AuthRequest,
    @Body() data: SellerProfileDto,
  ) {
    const own = await prisma.seller.findUnique({
      where: { userId: req.user.sub },
    });
    const actor =
      !own && !req.user.workspaceId
        ? req.user.sub
        : await this.actor(req, 'owner');
    return this.service.register(actor, data);
  }
  @Post('verification')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  async verification(
    @Req() req: AuthRequest,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('A verification file is required');
    const pdf = file.buffer.subarray(0, 5).toString() === '%PDF-';
    const png = file.buffer
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpg =
      file.buffer[0] === 255 &&
      file.buffer[1] === 216 &&
      file.buffer[2] === 255;
    if (!pdf && !png && !jpg)
      throw new BadRequestException(
        'Only PDF, PNG and JPEG documents are accepted',
      );
    const seller = await this.service.seller(await this.actor(req, 'owner'));
    const root = resolve(process.env.UPLOAD_DIR || './uploads');
    await mkdir(root, { recursive: true });
    const name = randomUUID() + (pdf ? '.pdf' : png ? '.png' : '.jpg');
    const path = join(root, name);
    await writeFile(path, file.buffer, { flag: 'wx' });
    try {
      const result = await prisma.seller.update({
        where: { id: seller.id },
        data: {
          verificationPath: name,
          verificationName: file.originalname.slice(0, 200),
          status: 'PENDING',
        },
        select: publicSeller,
      });
      if (seller.verificationPath)
        await unlink(join(root, seller.verificationPath)).catch(
          () => undefined,
        );
      return result;
    } catch (error) {
      await unlink(path).catch(() => undefined);
      throw error;
    }
  }
  private async saveImage(file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('An image file is required');
    const png = file.buffer
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpg =
      file.buffer[0] === 255 &&
      file.buffer[1] === 216 &&
      file.buffer[2] === 255;
    const webp =
      file.buffer.subarray(0, 4).toString() === 'RIFF' &&
      file.buffer.subarray(8, 12).toString() === 'WEBP';
    if (!png && !jpg && !webp)
      throw new BadRequestException(
        'Only PNG, JPEG and WebP images are accepted',
      );
    const root = resolve(process.env.UPLOAD_IMAGE_DIR || './uploads/images');
    await mkdir(root, { recursive: true });
    const name = randomUUID() + (png ? '.png' : webp ? '.webp' : '.jpg');
    await writeFile(join(root, name), file.buffer, { flag: 'wx' });
    return { url: '/api/uploads/' + name };
  }
  @Post('product-images')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  async productImage(
    @Req() req: AuthRequest,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    await this.actor(req, 'writeCatalog');
    return this.saveImage(file);
  }
  @Post('branding-images')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  async brandingImage(
    @Req() req: AuthRequest,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    await this.actor(req, 'branding');
    return this.saveImage(file);
  }
  @Get('offers') async offers(@Req() req: AuthRequest) {
    return this.service.offers(await this.actor(req, 'catalog'));
  }
  @Post('offers') async create(
    @Req() req: AuthRequest,
    @Body() data: OfferDto,
  ) {
    return this.service.save(await this.actor(req, 'writeCatalog'), data);
  }
  @Put('offers/:id') async update(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() data: OfferDto,
  ) {
    return this.service.save(await this.actor(req, 'writeCatalog'), data, id);
  }
  @Delete('offers/:id') async remove(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.service.remove(await this.actor(req, 'writeCatalog'), id);
  }
  @Post('import')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024, files: 1 },
    }),
  )
  async import(
    @Req() req: AuthRequest,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('A CSV or XLSX file is required');
    let rows: OfferDto[];
    try {
      rows = await parseImport(file);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Unable to parse file');
    }
    return this.service.import(await this.actor(req, 'writeCatalog'), rows);
  }
}
