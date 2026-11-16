"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { words } from "@/lib/words";
import {
  recentSearches,
  rememberSearch,
  clearSearches,
} from "@/lib/search-history";
export function SearchForm({
  locale,
  query,
}: {
  locale: string;
  query: Record<string, string | undefined>;
}) {
  const t = words(locale);
  const [q, setQ] = useState(query.q || "");
  const [suggestions, setSuggestions] = useState<
    { id: string; title: string; query?: string }[]
  >([]);
  const [focused, setFocused] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  useEffect(() => {
    setQ(query.q || "");
    if (query.q) rememberSearch(query.q);
    setHistory(recentSearches());
  }, [query.q]);
  useEffect(() => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const abort = new AbortController();
    const timer = setTimeout(() => {
      api<{ id: string; title: string; query?: string }[]>(
        "catalog/autocomplete?q=" + encodeURIComponent(q),
        { signal: abort.signal },
      )
        .then((value) => {
          if (!abort.signal.aborted) setSuggestions(value);
        })
        .catch(() => {
          if (!abort.signal.aborted) setSuggestions([]);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [q]);
  return (
    <form
      action={`/${locale}`}
      className="search-form"
      onSubmit={() => rememberSearch(q)}
    >
      <div className="search-bar">
        <div
          className="search-input"
          onBlur={(event) => {
            if (
              !event.currentTarget.contains(event.relatedTarget as Node | null)
            )
              setFocused(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setFocused(false);
            if (
              event.key === "ArrowDown" &&
              event.target instanceof HTMLInputElement
            ) {
              const link =
                event.currentTarget.querySelector<HTMLAnchorElement>(
                  ".suggestions a",
                );
              if (link) {
                event.preventDefault();
                link.focus();
              }
            }
          }}
        >
          <input
            aria-label={t.search}
            placeholder={
              locale === "ar"
                ? "مثلاً: أرخص آيفون 17"
                : "Try: the lowest iPhone 17 price"
            }
            name="q"
            type="search"
            minLength={2}
            maxLength={100}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSuggestions([]);
            }}
            onFocus={() => setFocused(true)}
            autoComplete="off"
          />
          {focused && suggestions.length > 0 && (
            <ul className="suggestions">
              {suggestions.map((s) => (
                <li key={s.id}>
                  <Link
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      rememberSearch(s.query || q);
                      setFocused(false);
                    }}
                    href={
                      s.query
                        ? `/${locale}?q=${encodeURIComponent(s.query.slice(0, 100))}`
                        : `/${locale}/products/${s.id}`
                    }
                  >
                    {s.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {focused && !q.trim() && history.length > 0 && (
            <div className="suggestions recent-searches">
              <div className="recent-search-heading">
                <strong>
                  {locale === "ar" ? "عمليات البحث الأخيرة" : "Recent searches"}
                </strong>
                <button
                  type="button"
                  className="secondary"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    clearSearches();
                    setHistory([]);
                  }}
                >
                  {locale === "ar" ? "مسح" : "Clear"}
                </button>
              </div>
              <ul>
                {history.map((term) => (
                  <li key={term}>
                    <Link
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        rememberSearch(term);
                        setFocused(false);
                      }}
                      href={`/${locale}?q=${encodeURIComponent(term)}`}
                    >
                      {term}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <button>{t.go} ↗</button>
      </div>
    </form>
  );
}
