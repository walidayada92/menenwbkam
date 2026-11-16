import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';

import * as bcrypt from 'bcrypt';
const { create, findUnique } = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
}));
vi.mock('@menenwbkam/database', () => ({
  prisma: { user: { create, findUnique } },
}));
describe('Authentication', () => {
  const jwt = { sign: vi.fn(() => 'token') };
  const service = new AuthService(jwt as unknown as JwtService);
  beforeEach(() => vi.clearAllMocks());
  it('rejects public admin registration', async () => {
    await expect(
      service.register({
        email: 'a@example.com',
        password: 'long-password',
        role: 'ADMIN',
      } as never),
    ).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });
  it('hashes passwords and selects only public fields', async () => {
    vi.mocked(create).mockResolvedValue({
      id: 'u',
      email: 'a@example.com',
      role: 'SELLER',
    } as never);
    const result = await service.register({
      email: 'A@example.com',
      password: 'long-password',
      role: 'SELLER',
    });
    const args = vi.mocked(create).mock.calls[0][0];
    expect(args.select).toEqual({ id: true, email: true, role: true });
    expect(args.data.email).toBe('a@example.com');
    expect(
      await bcrypt.compare('long-password', args.data.passwordHash as string),
    ).toBe(true);
    expect(result).not.toHaveProperty('passwordHash');
  });
  it('rejects incorrect credentials', async () => {
    vi.mocked(findUnique).mockResolvedValue(null);
    await expect(service.login('a@example.com', 'wrong')).rejects.toThrow(
      'Invalid credentials',
    );
  });
  it('signs only the authenticated subject', async () => {
    vi.mocked(findUnique).mockResolvedValue({
      id: 'u',
      email: 'a@example.com',
      role: 'SELLER',
      passwordHash: await bcrypt.hash('long-password', 4),
    } as never);
    await expect(
      service.login('A@example.com', 'long-password'),
    ).resolves.toMatchObject({
      access_token: 'token',
      user: { id: 'u', role: 'SELLER' },
    });
    expect(jwt.sign).toHaveBeenCalledWith({ sub: 'u' });
  });
  it('returns saved account details after signing back in without exposing the password hash', async () => {
    findUnique.mockResolvedValue({
      id: 'u',
      name: 'Shopper Name',
      email: 'a@example.com',
      phone: '+966512345678',
      role: 'SHOPPER',
      isVerified: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      passwordHash: await bcrypt.hash('long-password', 4),
    });
    const result = await service.login('a@example.com', 'long-password');
    expect(result.user).toMatchObject({
      name: 'Shopper Name',
      phone: '+966512345678',
      email: 'a@example.com',
      role: 'SHOPPER',
      isVerified: true,
    });
    expect(result.user).not.toHaveProperty('passwordHash');
  });
});
