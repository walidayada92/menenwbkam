import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { prisma, Prisma } from '@menenwbkam/database';

const itemInclude = {
  offer: {
    select: {
      id: true,
      title: true,
      price: true,
      stock: true,
      images: true,
      product: { select: { id: true, modelName: true } },
      seller: { select: { id: true, businessName: true, status: true } },
    },
  },
} as const;

@Injectable()
export class ShoppingService {
  private cartShape(cart: { items: any[] }) {
    const items = cart.items.map((item) => {
      const available =
        item.offer.stock > 0 && item.offer.seller.status === 'APPROVED';
      return {
        id: item.id,
        quantity: item.quantity,
        available,
        offer: item.offer,
        subtotal: available
          ? String(Number(item.offer.price) * item.quantity)
          : '0',
      };
    });
    const sellers = Object.values(
      items.reduce((groups: Record<string, any>, item) => {
        const key = item.offer.seller.id;
        const group =
          groups[key] ||
          (groups[key] = { seller: item.offer.seller, items: [], total: 0 });
        group.items.push(item);
        group.total += Number(item.subtotal);
        return groups;
      }, {}),
    );
    return {
      items,
      sellers,
      total: String(
        sellers.reduce((sum: number, group: any) => sum + group.total, 0),
      ),
    };
  }
  async cart(userId: string) {
    const cart = await prisma.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
      include: { items: { include: itemInclude } },
    });
    return this.cartShape(cart);
  }
  async addCartItem(userId: string, offerId: string, quantity: number) {
    const offer = await prisma.offer.findFirst({
      where: { id: offerId, stock: { gt: 0 }, seller: { status: 'APPROVED' } },
    });
    if (!offer) throw new NotFoundException('Offer unavailable');
    const cart = await prisma.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    const existing = await prisma.cartItem.findUnique({
      where: { cartId_offerId: { cartId: cart.id, offerId } },
    });
    if ((existing?.quantity || 0) + quantity > offer.stock)
      throw new BadRequestException('Quantity exceeds available stock');
    await prisma.cartItem.upsert({
      where: { cartId_offerId: { cartId: cart.id, offerId } },
      update: { quantity: { increment: quantity } },
      create: { cartId: cart.id, offerId, quantity },
    });
    return this.cart(userId);
  }
  async cartQuantity(userId: string, itemId: string, quantity: number) {
    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) throw new NotFoundException('Cart item not found');
    const item = await prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
      include: { offer: { select: { stock: true } } },
    });
    if (!item) throw new NotFoundException('Cart item not found');
    if (quantity > item.offer.stock)
      throw new BadRequestException('Quantity exceeds available stock');
    await prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity },
    });
    return this.cart(userId);
  }
  async removeCartItem(userId: string, itemId: string) {
    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) throw new NotFoundException('Cart item not found');
    await prisma.cartItem.deleteMany({
      where: { id: itemId, cartId: cart.id },
    });
    return this.cart(userId);
  }
  private async shape(list: {
    id: string;
    name: string;
    shareToken: string;
    items: any[];
  }) {
    const items = list.items.map((item) => {
      const available =
        item.offer.stock > 0 && item.offer.seller.status === 'APPROVED';
      return {
        id: item.id,
        quantity: item.quantity,
        available,
        offer: item.offer,
        subtotal: available
          ? String(Number(item.offer.price) * item.quantity)
          : '0',
      };
    });
    const sellers = Object.values(
      items.reduce((groups: Record<string, any>, item) => {
        const key = item.offer.seller.id;
        const group =
          groups[key] ||
          (groups[key] = { seller: item.offer.seller, items: [], total: 0 });
        group.items.push(item);
        group.total += Number(item.subtotal);
        return groups;
      }, {}),
    );
    return {
      id: list.id,
      name: list.name,
      shareToken: list.shareToken,
      items,
      sellers,
      total: String(
        sellers.reduce((sum: number, seller: any) => sum + seller.total, 0),
      ),
    };
  }
  async overview(userId: string) {
    const [wish, lists, alerts] = await Promise.all([
      prisma.wishlistItem.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            select: {
              id: true,
              modelName: true,
              images: true,
              brand: true,
              offers: {
                where: { stock: { gt: 0 }, seller: { status: 'APPROVED' } },
                orderBy: { price: 'asc' },
                take: 1,
                select: {
                  id: true,
                  price: true,
                  seller: { select: { businessName: true } },
                },
              },
            },
          },
        },
      }),
      prisma.shoppingList.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        include: { items: { include: itemInclude } },
      }),
      prisma.priceAlert.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        include: { product: { select: { id: true, modelName: true } } },
      }),
    ]);
    return {
      wishlist: wish,
      lists: await Promise.all(lists.map((list) => this.shape(list))),
      alerts,
    };
  }
  async addWishlist(userId: string, productId: string) {
    await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    return prisma.wishlistItem.upsert({
      where: { userId_productId: { userId, productId } },
      update: {},
      create: { userId, productId },
    });
  }
  async removeWishlist(userId: string, productId: string) {
    await prisma.wishlistItem.deleteMany({ where: { userId, productId } });
    return { ok: true };
  }
  async priceAlert(userId: string, productId: string, targetPrice: string) {
    await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    return prisma.priceAlert.upsert({
      where: { userId_productId: { userId, productId } },
      update: {
        targetPrice: new Prisma.Decimal(targetPrice),
        active: true,
        lastNotifiedBestPrice: null,
      },
      create: {
        userId,
        productId,
        targetPrice: new Prisma.Decimal(targetPrice),
      },
    });
  }
  async removePriceAlert(userId: string, productId: string) {
    await prisma.priceAlert.deleteMany({ where: { userId, productId } });
    return { ok: true };
  }
  async create(userId: string, name: string) {
    const list = await prisma.shoppingList.create({
      data: { userId, name: name.trim() },
      include: { items: { include: itemInclude } },
    });
    return this.shape(list);
  }
  private async owned(userId: string, id: string) {
    const list = await prisma.shoppingList.findFirst({
      where: { id, userId },
      include: { items: { include: itemInclude } },
    });
    if (!list) throw new NotFoundException('Shopping list not found');
    return list;
  }
  async addItem(
    userId: string,
    listId: string,
    offerId: string,
    quantity: number,
  ) {
    await this.owned(userId, listId);
    const offer = await prisma.offer.findFirst({
      where: { id: offerId, stock: { gt: 0 }, seller: { status: 'APPROVED' } },
    });
    if (!offer) throw new NotFoundException('Offer unavailable');
    await prisma.shoppingListItem.upsert({
      where: { listId_offerId: { listId, offerId } },
      update: { quantity },
      create: { listId, offerId, quantity },
    });
    return this.shape(await this.owned(userId, listId));
  }
  async quantity(
    userId: string,
    listId: string,
    itemId: string,
    quantity: number,
  ) {
    await this.owned(userId, listId);
    const changed = await prisma.shoppingListItem.updateMany({
      where: { id: itemId, listId },
      data: { quantity },
    });
    if (!changed.count) throw new NotFoundException('List item not found');
    return this.shape(await this.owned(userId, listId));
  }
  async removeItem(userId: string, listId: string, itemId: string) {
    await this.owned(userId, listId);
    await prisma.shoppingListItem.deleteMany({ where: { id: itemId, listId } });
    return this.shape(await this.owned(userId, listId));
  }
  async removeList(userId: string, listId: string) {
    const result = await prisma.shoppingList.deleteMany({
      where: { id: listId, userId },
    });
    if (!result.count) throw new NotFoundException('Shopping list not found');
    return { ok: true };
  }
  async shared(token: string) {
    const list = await prisma.shoppingList.findUnique({
      where: { shareToken: token },
      include: { items: { include: itemInclude } },
    });
    if (!list) throw new NotFoundException('Shared list not found');
    return this.shape(list);
  }
}
