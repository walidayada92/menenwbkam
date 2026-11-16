import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, UserProfileDto } from './auth.dto';
import { RolesGuard, AuthRequest } from './roles.guard';
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Post('register') register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }
  @Post('login') login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }
  @Get('health') health() {
    return { status: 'ok' };
  }
  @Get('me')
  @UseGuards(RolesGuard)
  me(@Req() request: AuthRequest) {
    return this.authService.profile(request.user.sub);
  }
  @Put('profile')
  @UseGuards(RolesGuard)
  profile(@Req() request: AuthRequest, @Body() body: UserProfileDto) {
    return this.authService.profile(request.user.sub, body);
  }
}
