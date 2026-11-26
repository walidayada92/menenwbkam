import { BadRequestException } from '@nestjs/common';
import { readSheet } from 'read-excel-file/node';
import { parse } from 'csv-parse/sync';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OfferDto } from './seller.dto';
const columns = [
  'title',
  'brandId',
  'categoryId',
  'barcode',
  'descriptionAr',
  'descriptionEn',
  'images',
  'price',
  'stock',
  'productUrl',
  'sku',
];
export async function parseImport(file: Express.Multer.File) {
  let cells: unknown[][];
  if (/\.xlsx$/i.test(file.originalname))
    cells = await readSheet(file.buffer, 1);
  else if (/\.csv$/i.test(file.originalname))
    cells = parse(file.buffer, {
      bom: true,
      skip_empty_lines: true,
      max_record_size: 20000,
      relax_column_count: true,
    }) as unknown[][];
  else throw new BadRequestException('Upload a CSV or XLSX file');
  if (
    cells.length < 2 ||
    cells.length > 501 ||
    cells.some((row) => row.length > 20)
  )
    throw new BadRequestException(
      'Import must contain 1–500 rows and at most 20 columns',
    );
  const names = cells[0].map((h) => String(h).trim());
  if (
    new Set(names).size !== names.length ||
    names.some((h) => !columns.includes(h))
  )
    throw new BadRequestException('Invalid or duplicate CSV headers');
  for (const required of [
    'title',
    'brandId',
    'categoryId',
    'images',
    'price',
    'stock',
  ])
    if (!names.includes(required))
      throw new BadRequestException('Missing column: ' + required);
  const rows: OfferDto[] = [];
  for (let i = 1; i < cells.length; i++) {
    const raw: Record<string, unknown> = {};
    if (cells[i].length > names.length)
      throw new BadRequestException('Too many cells in row ' + (i + 1));
    for (let j = 0; j < names.length; j++) {
      const value = cells[i][j];
      if (value !== null && value !== undefined && typeof value === 'object')
        throw new BadRequestException('Invalid cell (row ' + (i + 1) + ')');
      if (
        (typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean') &&
        value !== ''
      )
        raw[names[j]] = String(value);
    }
    raw.images = (typeof raw.images === 'string' ? raw.images : '')
      .split('|')
      .map((v) => v.trim())
      .filter(Boolean);
    const dto = plainToInstance(OfferDto, raw);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length)
      throw new BadRequestException(
        'Invalid row ' +
          (i + 1) +
          ': ' +
          errors.map((e) => e.property).join(', '),
      );
    rows.push(dto);
  }
  return rows;
}
