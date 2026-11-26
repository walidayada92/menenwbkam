const key = "mw_recent_searches";
export function recentSearches(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value)
      ? value
          .filter((x): x is string => typeof x === "string" && x.length <= 100)
          .slice(0, 8)
      : [];
  } catch {
    return [];
  }
}
export function rememberSearch(query: string) {
  const value = query
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 100);
  if (!value) return;
  try {
    localStorage.setItem(
      key,
      JSON.stringify(
        [
          value,
          ...recentSearches().filter(
            (x) => x.toLowerCase() !== value.toLowerCase(),
          ),
        ].slice(0, 8),
      ),
    );
  } catch {
    /* Search remains usable when browser storage is unavailable. */
  }
}
export function clearSearches() {
  try {
    localStorage.removeItem(key);
  } catch {
    /* Storage may be blocked. */
  }
}
