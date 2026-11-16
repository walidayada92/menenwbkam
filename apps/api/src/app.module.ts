import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SellerModule } from './seller/seller.module';
import { MarketplaceModule } from './marketplace.module';
import { BillingModule } from './billing/billing.module';
import { OrdersModule } from './orders/orders.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { ShoppingModule } from './shopping/shopping.module';
import { ExternalSyncModule } from './external-sync/external-sync.module';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    SellerModule,
    MarketplaceModule,
    BillingModule,
    OrdersModule,
    WorkspaceModule,
    ShoppingModule,
    ExternalSyncModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
