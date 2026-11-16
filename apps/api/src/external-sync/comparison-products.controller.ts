import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { prisma } from '@menenwbkam/database';
@Controller('catalog/comparison-products')
export class ComparisonProductsController {
  @Get(':id') async product(@Param('id') id: string) {
    const product = await prisma.comparisonProduct.findUnique({
      where: { id },
      include: { _count: { select: { listings: true } } },
    });
    if (!product) throw new NotFoundException('Comparison product not found');
    return product;
  }
}
