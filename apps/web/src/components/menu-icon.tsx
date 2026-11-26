export type IconName =
  | "account"
  | "admin"
  | "billing"
  | "cart"
  | "dashboard"
  | "globe"
  | "home"
  | "insights"
  | "notifications"
  | "orders"
  | "products"
  | "reports"
  | "saved"
  | "seller"
  | "settings"
  | "signup"
  | "team"
  | "trash";

const paths: Record<IconName, React.ReactNode> = {
  account: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c.8-3.3 3.4-5 7.5-5s6.7 1.7 7.5 5" />
    </>
  ),
  admin: (
    <>
      <path d="m12 3 7 3v5c0 4.5-2.8 8-7 10-4.2-2-7-5.5-7-10V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  billing: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h3" />
    </>
  ),
  cart: (
    <>
      <path d="M3 4h2l2 11h10l2-8H6" />
      <circle cx="9" cy="20" r="1" />
      <circle cx="17" cy="20" r="1" />
    </>
  ),
  dashboard: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.4 2.4 3.5 5.4 3.5 9S14.4 18.6 12 21c-2.4-2.4-3.5-5.4-3.5-9S9.6 5.4 12 3Z" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8v9H3z" />
      <path d="M9 20v-6h6v6" />
    </>
  ),
  insights: (
    <>
      <path d="M4 19V5M4 19h17" />
      <path d="m7 15 4-4 3 2 5-6" />
    </>
  ),
  notifications: (
    <>
      <path d="M18 10a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 22h4" />
    </>
  ),
  orders: (
    <>
      <path d="M5 4h14v17H5z" />
      <path d="M8 9h8M8 13h8M8 17h5" />
    </>
  ),
  products: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </>
  ),
  reports: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5M9 17v-3M12 17v-6M15 17v-4" />
    </>
  ),
  saved: (
    <path d="M12 20.5s-7.5-4.4-7.5-10.4A4.1 4.1 0 0 1 12 7.8a4.1 4.1 0 0 1 7.5 2.3c0 6-7.5 10.4-7.5 10.4Z" />
  ),
  seller: (
    <>
      <path d="M4 9h16v11H4z" />
      <path d="m3 9 2-5h14l2 5M9 20v-6h6v6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 13.5v-3l-2-.6a6.5 6.5 0 0 0-.7-1.7l1-1.9-2.1-2.1-1.9 1a6.5 6.5 0 0 0-1.7-.7L11 2.5H8l-.6 2a6.5 6.5 0 0 0-1.7.7l-1.9-1-2.1 2.1 1 1.9a6.5 6.5 0 0 0-.7 1.7l-2 .6v3l2 .6a6.5 6.5 0 0 0 .7 1.7l-1 1.9 2.1 2.1 1.9-1a6.5 6.5 0 0 0 1.7.7l.6 2h3l.6-2a6.5 6.5 0 0 0 1.7-.7l1.9 1 2.1-2.1-1-1.9a6.5 6.5 0 0 0 .7-1.7z" />
    </>
  ),
  signup: (
    <>
      <circle cx="10" cy="8" r="3" />
      <path d="M3.5 20c.7-3.2 2.9-5 6.5-5 1.1 0 2.1.2 3 .6M18 12v6M15 15h6" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="10" r="2" />
      <path d="M3 20c.7-3.5 2.8-5.2 6-5.2s5.3 1.7 6 5.2M15 15c3 .1 4.8 1.7 5.3 4.5" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" />
    </>
  ),
};

export function MenuIcon({ name }: { name: IconName }) {
  return (
    <svg
      className="menu-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
