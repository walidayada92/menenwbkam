import { api, ApiError } from "./api";

export type Cart = {
  total: string;
  sellers: {
    seller: { id: string; businessName: string };
    total: number;
    items: {
      id: string;
      quantity: number;
      available: boolean;
      offer: {
        id: string;
        title: string;
        price: string;
        product: { id: string; modelName: string };
      };
    }[];
  }[];
};

const storageKey = "mw_guest_cart";
type GuestItem = { offerId: string; quantity: number };
function read(): GuestItem[] {
  const value: unknown = JSON.parse(localStorage.getItem(storageKey) || "[]");
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is GuestItem =>
      typeof item?.offerId === "string" &&
      Number.isInteger(item.quantity) &&
      item.quantity > 0 &&
      item.quantity <= 1000,
  );
}
function save(items: GuestItem[]) {
  localStorage.setItem(storageKey, JSON.stringify(items));
}

async function guestCart(items: GuestItem[]): Promise<Cart> {
  const groups = new Map<string, Cart["sellers"][number]>();
  for (const item of items) {
    let offer: {
      id: string;
      title: string;
      price: string;
      stock: number;
      productId: string;
      seller: { id: string; businessName: string };
    };
    try {
      offer = await api(`catalog/offers/${encodeURIComponent(item.offerId)}`);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) throw error;
      const group = groups.get("unavailable") || {
        seller: { id: "unavailable", businessName: "Unavailable" },
        total: 0,
        items: [],
      };
      group.items.push({
        id: item.offerId,
        quantity: item.quantity,
        available: false,
        offer: {
          id: item.offerId,
          title: "Unavailable",
          price: "0",
          product: { id: "", modelName: "Unavailable" },
        },
      });
      groups.set("unavailable", group);
      continue;
    }
    const group = groups.get(offer.seller.id) || {
      seller: offer.seller,
      total: 0,
      items: [],
    };
    const available = offer.stock >= item.quantity;
    group.items.push({
      id: item.offerId,
      quantity: item.quantity,
      available,
      offer: {
        ...offer,
        product: { id: offer.productId, modelName: offer.title },
      },
    });
    if (available) group.total += Number(offer.price) * item.quantity;
    groups.set(offer.seller.id, group);
  }
  const sellers = [...groups.values()];
  return {
    sellers,
    total: String(sellers.reduce((sum, group) => sum + group.total, 0)),
  };
}

// Serialize changes and migration so concurrent buttons cannot import items twice.
let pending: Promise<unknown> = Promise.resolve();
let latestCart: Cart | null = null;
export function cartSnapshot() {
  return latestCart;
}
export function cartApi<T = Cart>(
  path = "shopper/cart",
  init: RequestInit = {},
): Promise<T> {
  const operation = pending.then(async () => {
    const items = read();
    let accountCart: Cart;
    try {
      accountCart = await api<Cart>("shopper/cart");
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      const body = init.body ? JSON.parse(String(init.body)) : {};
      const id = decodeURIComponent(path.split("/")[3] || body.offerId || "");
      const index = items.findIndex((item) => item.offerId === id);
      if (init.method === "DELETE") {
        if (index >= 0) items.splice(index, 1);
      } else if (init.method === "POST" || init.method === "PUT") {
        const quantity =
          init.method === "POST"
            ? (items[index]?.quantity || 0) + body.quantity
            : body.quantity;
        const offer = await api<{ stock: number }>(
          `catalog/offers/${encodeURIComponent(id)}`,
        );
        if (
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          quantity > Math.min(1000, offer.stock)
        )
          throw new Error("Quantity exceeds available stock");
        if (index >= 0) items[index].quantity = quantity;
        else items.push({ offerId: id, quantity });
      }
      const cart = await guestCart(items);
      if (["POST", "PUT", "DELETE"].includes(init.method || "")) save(items);
      return cart as T;
    }
    for (const item of [...items]) {
      try {
        const offer = await api<{ stock: number }>(
          `catalog/offers/${encodeURIComponent(item.offerId)}`,
        );
        const existing =
          accountCart.sellers
            .flatMap((group) => group.items)
            .find((entry) => entry.offer.id === item.offerId)?.quantity || 0;
        const quantity = Math.min(
          item.quantity,
          Math.max(0, Math.min(1000, offer.stock) - existing),
        );
        if (quantity > 0)
          accountCart = await api<Cart>("shopper/cart/items", {
            method: "POST",
            body: JSON.stringify({ offerId: item.offerId, quantity }),
          });
        items.splice(items.indexOf(item), 1);
        save(items);
      } catch (error) {
        // An unavailable guest item must not block actions on other products.
        // Retain failed items locally for a later retry.
        if (!(error instanceof ApiError) || ![400, 404].includes(error.status))
          throw error;
      }
    }
    return api<T>(path, init);
  });
  const updated = operation.then((result) => {
    latestCart = result as Cart;
    window.dispatchEvent(
      new CustomEvent("mw:cart-changed", { detail: result }),
    );
    return result;
  });
  pending = updated.catch(() => {});
  return updated;
}

export function checkoutReturn(locale: string): string | null {
  if (typeof window === "undefined") return null;
  const next = new URLSearchParams(window.location.search).get("next");
  return next &&
    (next === `/${locale}/checkout/cart` ||
      new RegExp(`^/${locale}/checkout/[^/?#]+$`).test(next))
    ? next
    : null;
}
