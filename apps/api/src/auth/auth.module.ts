import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { RolesGuard } from './roles.guard';
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
          throw new Error('JWT_SECRET must contain at least 32 characters');
        return {
          secret: process.env.JWT_SECRET,
          signOptions: { expiresIn: '1d' as const },
        };
      },
    }),
  ],
  providers: [AuthService, RolesGuard],
  controllers: [AuthController],
  exports: [AuthService, RolesGuard, JwtModule],
})
export class AuthModule {}
