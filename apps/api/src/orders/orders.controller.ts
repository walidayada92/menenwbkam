import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { prisma } from '@menenwbkam/database';
import { AuthRequest, RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  CreateOrderDto,
  DisputeStatusDto,
  MessageDto,
  ModerateReviewDto,
  OrderStatusDto,
  PageDto,
  ReasonDto,
  ReviewDto,
} from './orders.dto';
import { OrdersService } from './orders.service';
import { ReviewsService } from './reviews.service';
import { DisputesService } from './disputes.service';
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(
    private orders: OrdersService,
    private reviews: ReviewsService,
    private disputes: DisputesService,
  ) {}
  @Get() list(@Req() req: AuthRequest, @Query() query: PageDto) {
    return this.orders.list(req.user, query);
  }
  @Post() @Roles('SHOPPER') place(
    @Req() req: AuthRequest,
    @Body() body: CreateOrderDto,
  ) {
    return this.orders.place(req.user, body);
  }
  @Get(':id') detail(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.orders.detail(req.user, id);
  }
  @Put(':id/status') @Roles('SELLER', 'SHOPPER') update(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: OrderStatusDto,
  ) {
    return this.orders.update(req.user, id, body);
  }
  @Post(':id/reviews') @Roles('SHOPPER') review(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: ReviewDto,
  ) {
    return this.reviews.create(req.user, id, body);
  }
  @Post(':id/dispute') @Roles('SHOPPER', 'SELLER') dispute(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: ReasonDto,
  ) {
    return this.disputes.create(req.user, id, body.reason);
  }
}
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('operations')
export class OperationsController {
  constructor(
    private reviews: ReviewsService,
    private disputes: DisputesService,
  ) {}
  @Get('notifications') async inbox(
    @Req() req: AuthRequest,
    @Query() query: PageDto,
  ) {
    const [items, total, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user.sub },
        include: { deliveries: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 20,
        skip: (query.page - 1) * 20,
      }),
      prisma.notification.count({ where: { userId: req.user.sub } }),
      prisma.notification.count({
        where: { userId: req.user.sub, readAt: null },
      }),
    ]);
    return { items, total, unread, page: query.page, pageSize: 20 };
  }
  @Put('notifications/read') async read(@Req() req: AuthRequest) {
    await prisma.notification.updateMany({
      where: { userId: req.user.sub, readAt: null },
      data: { readAt: new Date() },
    });
    return { read: true };
  }
  @Post('reviews/:id/report') report(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: ReasonDto,
  ) {
    return this.reviews.report(req.user.sub, id, body.reason);
  }
  @Post('disputes/:id/messages') message(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: MessageDto,
  ) {
    return this.disputes.message(req.user, id, body.body);
  }
}
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('ADMIN')
@Controller('admin/operations')
export class AdminOperationsController {
  constructor(
    private reviews: ReviewsService,
    private disputes: DisputesService,
  ) {}
  @Get('disputes') disputesList(@Query() query: PageDto) {
    return this.disputes.list(query);
  }
  @Put('disputes/:id') reviewDispute(
    @Param('id') id: string,
    @Body() body: DisputeStatusDto,
  ) {
    return this.disputes.update(id, body);
  }
  @Get('reports') reports(@Query() query: PageDto) {
    return this.reviews.reports(query);
  }
  @Put('reviews/:id') moderate(
    @Param('id') id: string,
    @Body() body: ModerateReviewDto,
  ) {
    return this.reviews.moderate(id, body);
  }
}
@Controller('catalog')
export class PublicReviewsController {
  constructor(private reviews: ReviewsService) {}
  @Get('offers/:id') async offer(@Param('id') id: string) {
    const offer = await prisma.offer.findFirst({
      where: { id, stock: { gt: 0 }, seller: { status: 'APPROVED' } },
      select: {
        id: true,
        title: true,
        price: true,
        stock: true,
        images: true,
        productId: true,
        seller: { select: { id: true, businessName: true } },
      },
    });
    if (!offer) throw new NotFoundException('Offer unavailable');
    return offer;
  }
  @Get('products/:id/reviews') product(
    @Param('id') id: string,
    @Query() query: PageDto,
  ) {
    return this.reviews.list('PRODUCT', id, query);
  }
  @Get('sellers/:id/reviews') seller(
    @Param('id') id: string,
    @Query() query: PageDto,
  ) {
    return this.reviews.list('SELLER', id, query);
  }
}
