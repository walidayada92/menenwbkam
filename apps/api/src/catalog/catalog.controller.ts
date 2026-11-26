import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { SearchDto } from '../seller/seller.dto';
import { searchIntent } from './search-intent';
import { externalSuggestions } from '../external-sync/search-index';
@Controller('catalog')
export class CatalogController {
  constructor(private service: CatalogService) {}
  @Get('search-intent') intent(@Query() query: SearchDto) {
    return searchIntent(query.q || '');
  }
  @Get('taxonomy') taxonomy() {
    return this.service.taxonomy();
  }
  @Get('products') search(@Query() query: SearchDto) {
    return this.service.search(query);
  }
  @Get('autocomplete') async autocomplete(@Query() query: SearchDto) {
    if (!query.q?.trim()) return [];
    query.page = 1;
    const [catalog, external] = await Promise.all([
      this.service.search(query),
      externalSuggestions(query.q),
    ]);
    const products = catalog.items
      .slice(0, 8)
      .map((p) => ({ id: p.id, title: p.modelName }));
    return [...products, ...external].slice(0, 8);
  }
  @Get('products/:id') detail(@Param('id') id: string) {
    return this.service.detail(id);
  }
  @Get('products/:id/price-history') history(
    @Param('id') id: string,
    @Query('days') days?: string,
  ) {
    return this.service.priceHistory(id, Number(days) || 90);
  }
}
