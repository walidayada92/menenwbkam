import {
  Controller,
  Get,
  NotFoundException,
  Param,
  StreamableFile,
} from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const imageName = /^[0-9a-f-]{36}\.(?:png|jpe?g|webp)$/;
@Controller('uploads')
export class UploadsController {
  @Get(':name')
  async image(@Param('name') name: string) {
    if (!imageName.test(name) || basename(name) !== name)
      throw new NotFoundException();
    const extension = name.slice(name.lastIndexOf('.') + 1);
    const type =
      extension === 'png'
        ? 'image/png'
        : extension === 'webp'
          ? 'image/webp'
          : 'image/jpeg';
    try {
      return new StreamableFile(
        await readFile(
          resolve(process.env.UPLOAD_IMAGE_DIR || './uploads/images', name),
        ),
        { type, disposition: 'inline' },
      );
    } catch {
      throw new NotFoundException();
    }
  }
}
