"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { api } from "@/lib/api";
import { Workspaces, workspaceWords } from "@/lib/workspace";
import { MenuIcon, type IconName } from "./menu-icon";
export function WorkspaceShell({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const t = workspaceWords(locale),
    pathname = usePathname(),
    [data, setData] = useState<Workspaces | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const url = new URL(window.location.href),
        desired = url.searchParams.get("store");
      if (desired) {
        await api("seller/workspaces/select", {
          method: "POST",
          body: JSON.stringify({ sellerId: desired }),
        });
        url.searchParams.delete("store");
        window.history.replaceState(null, "", url.toString());
      }
      setData(await api<Workspaces>("seller/workspaces"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
    window.addEventListener("workspace-updated", load);
    return () => window.removeEventListener("workspace-updated", load);
  }, [load]);
  const current = data?.stores.find((s) => s.id === data.selectedId),
    role = current?.role || "OWNER";
  const links: {
    path: string;
    label: string;
    icon: IconName;
    show: boolean;
  }[] = [
    { path: "", label: t.overview, icon: "dashboard", show: true },
    {
      path: "/products",
      label: t.products,
      icon: "products",
      show: ["OWNER", "MANAGER", "CATALOG", "ANALYST"].includes(role),
    },
    {
      path: "/orders",
      label: t.orders,
      icon: "orders",
      show: ["OWNER", "MANAGER", "ORDERS"].includes(role),
    },
    { path: "/insights", label: t.insights, icon: "insights", show: true },
    {
      path: "/reports",
      label: t.reports,
      icon: "reports",
      show: ["OWNER", "MANAGER", "ANALYST"].includes(role),
    },
    { path: "/team", label: t.team, icon: "team", show: true },
    {
      path: "/settings",
      label: t.settings,
      icon: "settings",
      show: ["OWNER", "MANAGER"].includes(role),
    },
    {
      path: "/billing",
      label: t.billing,
      icon: "billing",
      show: role === "OWNER",
    },
  ];
  if (error)
    return (
      <section className="narrow">
        <p className="notice">{error}</p>
        <Link className="button" href={`/${locale}/account`}>
          {t.login}
        </Link>
      </section>
    );
  if (!data) return <p className="content">{t.loading}</p>;
  return (
    <div className="seller-shell">
      <aside className="workspace-sidebar no-print">
        <p className="workspace-section-title">{t.workspace}</p>
        <label className="workspace-selector">
          {t.account}
          <select
            aria-label={t.workspace}
            value={data.selectedId || ""}
            disabled={busy}
            onChange={async (e) => {
              setBusy(true);
              try {
                await api("seller/workspaces/select", {
                  method: "POST",
                  body: JSON.stringify({ sellerId: e.target.value }),
                });
                window.location.assign("/" + locale + "/seller");
              } catch (err) {
                setError((err as Error).message);
                setBusy(false);
              }
            }}
          >
            {!data.stores.length && <option value="">{t.noStore}</option>}
            {data.stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.businessName}
              </option>
            ))}
          </select>
        </label>
        <nav aria-label={t.workspace}>
          {links
            .filter((l) => l.show)
            .map((l) => {
              const href = "/" + locale + "/seller" + l.path,
                active = l.path ? pathname.startsWith(href) : pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={active ? "active" : ""}
                  aria-current={active ? "page" : undefined}
                >
                  <span aria-hidden="true">
                    <MenuIcon name={l.icon} />
                  </span>
                  {l.label}
                  {l.path === "/team" && data.invitations.length > 0 && (
                    <b className="sidebar-count">{data.invitations.length}</b>
                  )}
                </Link>
              );
            })}
        </nav>
        <div className="sidebar-bottom">
          <Link href={`/${locale}`}>
            <MenuIcon name="home" />
            {t.home}
          </Link>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-topbar no-print">
          <div>
            <span className="workspace-breadcrumb">{t.workspace} / </span>
            <strong>
              {links.find(
                (l) =>
                  l.path &&
                  pathname.startsWith("/" + locale + "/seller" + l.path),
              )?.label || t.overview}
            </strong>
          </div>
          <div className="workspace-person">
            <Link className="workspace-marketplace-link" href={`/${locale}`}>
              <MenuIcon name="home" />
              {locale === "ar" ? "العودة للتسوق" : "Back to shopping"}
            </Link>
            <span className="role-pill">{t.roles[role]}</span>
            {current?.logo ? (
              <Image
                unoptimized
                src={current.logo}
                alt=""
                width={36}
                height={36}
              />
            ) : (
              <span className="workspace-avatar">
                {(current?.businessName || "M").slice(0, 1)}
              </span>
            )}
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
