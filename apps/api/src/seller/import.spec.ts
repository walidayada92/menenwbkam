import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { parseImport } from './import';
import { xlsx } from '../../test/xlsx';
const file = (buffer: Buffer, originalname: string) =>
  ({ buffer, originalname }) as Express.Multer.File;
describe('Spreadsheet imports', () => {
  it('parses XLSX with leading-zero barcode strings', async () => {
    const rows = await parseImport(
      file(
        xlsx([
          [
            'title',
            'brandId',
            'categoryId',
            'images',
            'price',
            'stock',
            'barcode',
          ],
          [
            'Phone X',
            'apple',
            'phones',
            'https://example.com/a.jpg',
            50.25,
            3,
            '0123456789012',
          ],
        ]),
        'products.xlsx',
      ),
    );
    expect(rows[0]).toMatchObject({
      title: 'Phone X',
      price: 50.25,
      stock: 3,
      barcode: '0123456789012',
    });
  });
  it('supports quoted UTF-8 CSV and rejects malformed numeric fields', async () => {
    const csv =
      'title,brandId,categoryId,images,price,stock\n"هاتف, جديد",apple,phones,,50,2';
    expect(
      (await parseImport(file(Buffer.from(csv), 'products.csv')))[0].title,
    ).toBe('هاتف, جديد');
    await expect(
      parseImport(
        file(Buffer.from(csv.replace('50,2', 'oops,2')), 'products.csv'),
      ),
    ).rejects.toThrow('Invalid row 2');
  });
  it('rejects missing/duplicate headers and oversized row counts', async () => {
    await expect(
      parseImport(file(Buffer.from('title,title\nA,B'), 'products.csv')),
    ).rejects.toThrow();
    await expect(
      parseImport(
        file(
          Buffer.from('title\n' + Array(501).fill('Phone').join('\n')),
          'products.csv',
        ),
      ),
    ).rejects.toThrow('1–500');
  });
});
