import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { prisma } from '@menenwbkam/database';
import { AuthRequest, RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WorkspaceService } from './workspace.service';
import { AnalyticsService } from './analytics.service';
import {
  BrandingDto,
  EngagementDto,
  InviteDto,
  RangeDto,
  TeamRoleDto,
  WorkspaceDto,
} from './workspace.dto';
import { visitorHash, riyadhDay } from './metrics';
import { createWorkbook } from './xlsx';
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('SELLER')
@Controller('seller/workspaces')
export class WorkspaceController {
  constructor(private service: WorkspaceService) {}
  @Get() list(@Req() req: AuthRequest) {
    return this.service.list(req.user.sub, req.user.workspaceId);
  }
  @Post('select') select(@Req() req: AuthRequest, @Body() body: WorkspaceDto) {
    return this.service.select(req.user.sub, body.sellerId);
  }
  @Get('team') team(@Req() req: AuthRequest) {
    return this.service.team(req.user.sub, req.user.workspaceId);
  }
  @Post('team') invite(@Req() req: AuthRequest, @Body() body: InviteDto) {
    return this.service.invite(req.user.sub, req.user.workspaceId, body);
  }
  @Post('invitations/:id/accept') accept(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.service.accept(req.user.sub, id);
  }
  @Put('team/:id') change(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: TeamRoleDto,
  ) {
    return this.service.change(
      req.user.sub,
      req.user.workspaceId,
      id,
      body.role,
    );
  }
  @Delete('team/:id') remove(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.change(req.user.sub, req.user.workspaceId, id);
  }
  @Put('branding') branding(
    @Req() req: AuthRequest,
    @Body() body: BrandingDto,
  ) {
    return this.service.branding(req.user.sub, req.user.workspaceId, body);
  }
}
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('SELLER')
@Controller('seller/insights')
export class AnalyticsController {
  constructor(private service: AnalyticsService) {}
  @Get() overview(@Req() req: AuthRequest, @Query() query: RangeDto) {
    return this.service.overview(
      req.user.sub,
      req.user.workspaceId,
      query.days,
    );
  }
  @Get('analytics') analytics(
    @Req() req: AuthRequest,
    @Query() query: RangeDto,
  ) {
    return this.service.analytics(
      req.user.sub,
      req.user.workspaceId,
      query.days,
    );
  }
  @Get('prices') prices(@Req() req: AuthRequest, @Query() query: RangeDto) {
    return this.service.insights(
      req.user.sub,
      req.user.workspaceId,
      query.page,
    );
  }
  @Get('alerts') alerts(@Req() req: AuthRequest, @Query() query: RangeDto) {
    return this.service.alerts(req.user.sub, req.user.workspaceId, query.page);
  }
  @Get('history/:id') history(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Query() query: RangeDto,
  ) {
    return this.service.history(
      req.user.sub,
      req.user.workspaceId,
      id,
      query.days,
    );
  }
  @Get('export.xlsx') async export(
    @Req() req: AuthRequest,
    @Query() query: RangeDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const data = await this.service.analytics(
      req.user.sub,
      req.user.workspaceId,
      query.days,
    );
    const rows: (string | number)[][] = [
      ['Menenwbkam seller report', 'SAR', 'Asia/Riyadh'],
      ['Period start', data.start],
      ['Period end', data.end],
      ['Comparison impressions', data.views],
      ['Offer clicks', data.clicks],
      ['Browsing sessions', data.sessions],
      ['Attributed conversion %', data.conversionRate],
      ['Orders', data.orders],
      ['Delivered order value (not collected payments)', data.deliveredValue],
      [],
      ['Day', 'Views', 'Clicks', 'Orders', 'Delivered order value'],
      ...data.daily.map((d) => [
        d.day,
        d.views,
        d.clicks,
        d.orders,
        d.deliveredValue,
      ]),
      [],
      ['Product', 'Delivered quantity', 'Delivered value'],
      ...data.topProducts.map((p) => [p.title, p.quantity, p.value]),
    ];
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="seller-report.xlsx"',
    );
    response.setHeader('Cache-Control', 'no-store');
    return new StreamableFile(createWorkbook(rows));
  }
}
@Controller('catalog')
export class WorkspacePublicController {
  @Post('engagement') async track(@Body() body: EngagementDto) {
    const offers = await prisma.offer.findMany({
      where: {
        id: { in: body.offerIds },
        stock: { gt: 0 },
        seller: { status: 'APPROVED' },
      },
      select: { id: true, sellerId: true },
    });
    await prisma.offerMetric.createMany({
      data: offers.map((o) => ({
        offerId: o.id,
        kind: body.kind,
        visitorHash: visitorHash(body.visitorId, o.sellerId),
        day: new Date(riyadhDay(new Date()) + 'T00:00:00Z'),
      })),
      skipDuplicates: true,
    });
    return { recorded: offers.length };
  }
  @Get('stores/:slug') async store(
    @Param('slug') slug: string,
    @Query() query: RangeDto,
  ) {
    const seller = await prisma.seller.findFirst({
      where: { slug, status: 'APPROVED' },
      select: {
        id: true,
        businessName: true,
        description: true,
        logo: true,
        bannerUrl: true,
        brandColor: true,
        slug: true,
        rating: true,
      },
    });
    if (!seller) return null;
    const where = { sellerId: seller.id, stock: { gt: 0 } };
    const [offers, total] = await Promise.all([
      prisma.offer.findMany({
        where,
        select: {
          id: true,
          title: true,
          price: true,
          images: true,
          productId: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 24,
        skip: (query.page - 1) * 24,
      }),
      prisma.offer.count({ where }),
    ]);
    return { ...seller, offers, total, page: query.page, pageSize: 24 };
  }
}
