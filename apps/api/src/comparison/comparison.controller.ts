import {
  Controller,
  Get,
  Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { prisma } from '@menenwbkam/database';
import { searchIntent } from '../catalog/search-intent';
import { externalSuggestions } from '../external-sync/search-index';

export class ComparisonSearchQuery {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
}

@Controller()
export class ComparisonController {
  @Get('health/live') live() {
    return { status: 'ok', service: 'price-comparison' };
  }
  @Get('health/ready') async ready() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException('Database unavailable');
    }
  }
  @Get('catalog/search-intent') intent(@Query() query: ComparisonSearchQuery) {
    return searchIntent(query.q || '');
  }
  @Get('catalog/autocomplete') autocomplete(
    @Query() query: ComparisonSearchQuery,
  ) {
    return externalSuggestions(query.q || '');
  }
}
