import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { prisma } from '@menenwbkam/database';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto, UserProfileDto } from './auth.dto';
@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}
  async register(data: RegisterDto) {
    if (!['SHOPPER', 'SELLER'].includes(data.role))
      throw new UnauthorizedException('Invalid registration role');
    const passwordHash = await bcrypt.hash(data.password, 12);
    try {
      return await prisma.user.create({
        data: {
          name: data.name?.trim() || null,
          email: data.email.trim().toLowerCase(),
          phone: data.phone?.trim() || null,
          passwordHash,
          role: data.role,
        },
        select: { id: true, email: true, role: true },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002')
        throw new ConflictException('Email already registered');
      throw error;
    }
  }
  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash)))
      throw new UnauthorizedException('Invalid credentials');
    return {
      access_token: this.jwtService.sign({ sub: user.id }),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
      },
    };
  }
  async profile(userId: string, data?: UserProfileDto) {
    if (!data)
      return prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isVerified: true,
          createdAt: true,
        },
      });
    try {
      return await prisma.user.update({
        where: { id: userId },
        data: {
          name: data.name?.trim() || null,
          email: data.email.trim().toLowerCase(),
          phone: data.phone?.trim() || null,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isVerified: true,
          createdAt: true,
        },
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002')
        throw new ConflictException('Email or phone is already in use');
      throw error;
    }
  }
}
