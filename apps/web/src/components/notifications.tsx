"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Page, Notice, operationWords, operationDate } from "@/lib/operations";
export function Notifications({ locale }: { locale: string }) {
  const t = operationWords(locale),
    [page, setPage] = useState(1),
    [data, setData] = useState<(Page<Notice> & { unread: number }) | null>(
      null,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setError("");
    try {
      setData(
        await api<Page<Notice> & { unread: number }>(
          "operations/notifications?page=" + page,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }, [page]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <section className="content">
      <div className="section-heading">
        <h1>
          {t.notifications}{" "}
          {data && <span className="badge">{data.unread}</span>}
        </h1>
        <button
          disabled={busy || !data?.unread}
          onClick={async () => {
            setBusy(true);
            try {
              await api("operations/notifications/read", {
                method: "PUT",
                body: "{}",
              });
              await load();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {t.markRead}
        </button>
      </div>
      <p className="notice">{t.previews}</p>
      {error && (
        <p role="alert">
          {error} <Link href={`/${locale}/account`}>{t.login}</Link>
        </p>
      )}
      {!data ? (
        <p>{t.loading}</p>
      ) : !data.items.length ? (
        <p>{t.noNotifications}</p>
      ) : (
        data.items.map((n) => (
          <article
            className={"panel notification " + (!n.readAt ? "unread" : "")}
            key={n.id}
          >
            <Link href={"/" + locale + n.href}>
              <h2>{locale === "ar" ? n.titleAr : n.titleEn}</h2>
              <p>{locale === "ar" ? n.bodyAr : n.bodyEn}</p>
            </Link>
            <small>{operationDate(n.createdAt, locale)}</small>
            <p className="muted">
              Email · WhatsApp · Push — {locale === "ar" ? "معاينة" : "Preview"}
            </p>
          </article>
        ))
      )}
      <div className="pagination">
        <button disabled={page === 1} onClick={() => setPage(page - 1)}>
          {t.previous}
        </button>
        <span>{page}</span>
        <button
          disabled={!data || page * data.pageSize >= data.total}
          onClick={() => setPage(page + 1)}
        >
          {t.next}
        </button>
      </div>
    </section>
  );
}
