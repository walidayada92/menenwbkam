import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OfferDto } from './seller.dto';
describe('Offer validation', () => {
  const valid = {
    title: 'Phone X',
    brandId: 'brand',
    categoryId: 'phones',
    images: ['https://example.com/image.jpg'],
    price: 10.25,
    stock: 2,
  };
  it('accepts valid listings', async () => {
    expect(await validate(plainToInstance(OfferDto, valid))).toEqual([]);
  });
  it('rejects negative prices, fractional stock and unsafe image URLs', async () => {
    const errors = await validate(
      plainToInstance(OfferDto, {
        ...valid,
        price: -1,
        stock: 1.5,
        images: ['javascript:alert(1)'],
      }),
    );
    expect(errors.map((e) => e.property).sort()).toEqual([
      'images',
      'price',
      'stock',
    ]);
  });
});
