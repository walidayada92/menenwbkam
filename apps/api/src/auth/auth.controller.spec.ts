import { describe, it, expect } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './auth.dto';
describe('Registration validation', () => {
  it('rejects admin roles, invalid email and short passwords', async () => {
    const errors = await validate(
      plainToInstance(RegisterDto, {
        name: 'Test Shopper',
        phone: '+966512345678',
        email: 'bad',
        password: 'short',
        role: 'ADMIN',
      }),
    );
    expect(errors.map((e) => e.property).sort()).toEqual([
      'email',
      'password',
      'role',
    ]);
  });
  it('defaults new accounts to shopper', async () => {
    const dto = plainToInstance(RegisterDto, {
      name: 'Test Shopper',
      phone: '+966512345678',
      email: 'a@example.com',
      password: 'long-password',
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto.role).toBe('SHOPPER');
  });
});
