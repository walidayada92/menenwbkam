"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useShoppingAccess } from "./shopping-access";
export function browsingVisitor() {
  try {
    let id = sessionStorage.getItem("mw_visitor");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("mw_visitor", id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
export function recordEngagement(
  offerIds: string[],
  kind: "IMPRESSION" | "CLICK",
) {
  const body = JSON.stringify({ offerIds, kind, visitorId: browsingVisitor() });
  void fetch("/api/catalog/engagement", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}
export function Engagement({ offerIds }: { offerIds: string[] }) {
  const signature = offerIds.join(",");
  useEffect(() => {
    const ids = signature.split(",").filter(Boolean);
    for (let i = 0; i < ids.length; i += 100)
      recordEngagement(ids.slice(i, i + 100), "IMPRESSION");
  }, [signature]);
  return null;
}
export function OfferLink({
  offerId,
  href,
  external = false,
  children,
  className = "button",
}: {
  offerId: string;
  href: string;
  external?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const canShop = useShoppingAccess();
  if (!external && href.includes("/checkout/") && !canShop) return null;
  return external ? (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={() => recordEngagement([offerId], "CLICK")}
    >
      {children}
    </a>
  ) : (
    <Link
      className={className}
      href={href}
      onClick={() => recordEngagement([offerId], "CLICK")}
    >
      {children}
    </Link>
  );
}
