"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { money } from "@/lib/words";
import { Invoice, billingWords, statusLabel } from "@/lib/billing";
export function BillingInvoice({ locale, id }: { locale: string; id: string }) {
  const t = billingWords(locale);
  const [invoice, setInvoice] = useState<Invoice | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    api<Invoice>("seller/billing/invoices/" + encodeURIComponent(id))
      .then(setInvoice)
      .catch((e) => setError(e.message));
  }, [id]);
  if (error)
    return (
      <p className="content" role="alert">
        {error}
      </p>
    );
  if (!invoice) return <p className="content">{t.loading}</p>;
  return (
    <section className="content invoice-page">
      <div className="actions no-print">
        <Link href={`/${locale}/seller/billing`}>← {t.title}</Link>
        <button onClick={() => window.print()}>{t.print}</button>
      </div>
      <article className="panel">
        <h1>{t.invoice}</h1>
        <p className="notice">{t.invoiceNote}</p>
        <p>
          {t.number}: {invoice.number}
        </p>
        <p>
          {t.date}:{" "}
          {new Date(invoice.createdAt).toLocaleString(
            locale === "ar" ? "ar-SA" : "en-GB",
            { timeZone: "Asia/Riyadh" },
          )}
        </p>
        <div className="dashboard-columns">
          <div>
            <h2>{t.supplier}</h2>
            <p>{invoice.sellerName}</p>
            {invoice.sellerVatNumber && (
              <p>
                {t.vatNumber}: {invoice.sellerVatNumber}
              </p>
            )}
          </div>
          <div>
            <h2>{t.buyer}</h2>
            <p>
              {invoice.buyerName}
              <br />
              {invoice.buyerEmail}
            </p>
          </div>
        </div>
        <p>
          {t.plan}: {locale === "ar" ? invoice.planNameAr : invoice.planName} ·{" "}
          {invoice.interval === "YEARLY" ? t.yearly : t.monthly}
        </p>
        <p>
          {t.status}: {statusLabel(invoice.status, locale)}
        </p>
        <table>
          <tbody>
            <tr>
              <th>{t.subtotal}</th>
              <td>{money(invoice.subtotalHalalas / 100, locale)}</td>
            </tr>
            <tr>
              <th>{t.discount}</th>
              <td>{money(invoice.discountHalalas / 100, locale)}</td>
            </tr>
            <tr>
              <th>
                {t.vat} ({invoice.vatBasisPoints / 100}%)
              </th>
              <td>{money(invoice.vatHalalas / 100, locale)}</td>
            </tr>
            <tr>
              <th>{t.total}</th>
              <td className="price">
                {money(invoice.totalHalalas / 100, locale)}
              </td>
            </tr>
          </tbody>
        </table>
      </article>
    </section>
  );
}
