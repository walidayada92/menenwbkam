import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { prisma } from '@menenwbkam/database';
import { RolesGuard, AuthRequest } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { BillingService } from './billing.service';
import { OwnerWorkspaceGuard } from '../workspace/access';
import {
  CheckoutDto,
  CouponDto,
  PaymentTestDto,
  PlanDto,
  TrialDto,
  TimeTestDto,
} from './billing.dto';
@ApiBearerAuth()
@UseGuards(RolesGuard, OwnerWorkspaceGuard)
@Roles('SELLER')
@Controller('seller/billing')
export class SellerBillingController {
  constructor(private service: BillingService) {}
  @Post('simulate-time') simulateTime(
    @Req() req: AuthRequest,
    @Body() body: TimeTestDto,
  ) {
    return this.service.simulateTime(req.user.sub, body.stage);
  }
  @Get('plans') plans() {
    return this.service.plans();
  }
  @Get() state(@Req() req: AuthRequest) {
    return this.service.state(req.user.sub);
  }
  @Post('trial') trial(@Req() req: AuthRequest, @Body() body: TrialDto) {
    return this.service.trial(req.user.sub, body.planId);
  }
  @Post('checkout') checkout(
    @Req() req: AuthRequest,
    @Body() body: CheckoutDto,
  ) {
    return this.service.checkout(req.user.sub, body);
  }
  @Post('renew') renew(@Req() req: AuthRequest) {
    return this.service.checkout(
      req.user.sub,
      { planId: '', interval: 'MONTHLY' },
      true,
    );
  }
  @Post('schedule') schedule(
    @Req() req: AuthRequest,
    @Body() body: CheckoutDto,
  ) {
    return this.service.schedule(req.user.sub, body);
  }
  @Post('cancel') cancel(@Req() req: AuthRequest) {
    return this.service.cancel(req.user.sub);
  }
  @Post('invoices/:id/simulate') simulate(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: PaymentTestDto,
  ) {
    return this.service.settle(req.user.sub, id, body.outcome);
  }
  @Get('invoices/:id') invoice(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.service.invoice(req.user.sub, id);
  }
}
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('ADMIN')
@Controller('admin/billing')
export class AdminBillingController {
  constructor(private service: BillingService) {}
  @Get('plans') plans() {
    return this.service.plans(true);
  }
  @Put('plans/:id') plan(@Param('id') id: string, @Body() body: PlanDto) {
    return this.service.savePlan(id, body);
  }
  @Get('coupons') coupons() {
    return prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
  @Post('coupons') coupon(@Body() body: CouponDto) {
    return this.service.saveCoupon(undefined, body);
  }
  @Put('coupons/:id') updateCoupon(
    @Param('id') id: string,
    @Body() body: CouponDto,
  ) {
    return this.service.saveCoupon(id, body);
  }
  @Get('revenue') revenue() {
    return this.service.revenue();
  }
}
