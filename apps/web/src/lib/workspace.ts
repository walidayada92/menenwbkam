export type WorkspaceRole =
  "OWNER" | "MANAGER" | "CATALOG" | "ORDERS" | "ANALYST";
export interface StoreChoice {
  id: string;
  businessName: string;
  logo: string | null;
  slug: string | null;
  role: WorkspaceRole;
}
export interface Workspaces {
  stores: StoreChoice[];
  selectedId: string | null;
  invitations: {
    id: string;
    sellerId: string;
    role: WorkspaceRole;
    seller: { businessName: string };
  }[];
}
export interface Analytics {
  days: number;
  start: string;
  end: string;
  views: number;
  clicks: number;
  sessions: number;
  conversionRate: number;
  orders: number;
  deliveredOrders: number;
  deliveredValue: string;
  cancelledOrders: number;
  returnedOrders: number;
  daily: {
    day: string;
    views: number;
    clicks: number;
    orders: number;
    deliveredValue: string;
  }[];
  topProducts: {
    productId: string;
    title: string;
    quantity: number;
    value: string;
  }[];
}
export interface Alert {
  id: string;
  kind: "LOW_STOCK" | "PRICE_DROP";
  data: {
    stock?: number;
    threshold?: number;
    competitorPrice?: string;
    suggestedPrice?: string;
  };
  offer: { title: string; price: string; stock: number };
  updatedAt: string;
}
export interface Overview {
  store: {
    id: string;
    businessName: string;
    status: string;
    logo: string | null;
    slug: string | null;
    description: string | null;
    bannerUrl: string | null;
    brandColor: string;
    lowStockThreshold: number;
    lowStockAlerts: boolean;
    priceDropAlerts: boolean;
  };
  role: WorkspaceRole;
  permissions: string[];
  plan: string;
  products: number;
  lowStock: number;
  pendingOrders: number | null;
  alerts: Alert[];
  recent: {
    id: string;
    number: string;
    status: string;
    totalAmount: string;
    createdAt: string;
  }[];
  analyticsEnabled: boolean;
  analytics: Analytics | null;
}
export interface Insight {
  id: string;
  title: string;
  price: string;
  stock: number;
  productId: string;
  competitorCount: number;
  position: number;
  bestCompetitor: { price: string; seller: string } | null;
  suggestedPrice: string | null;
}
export function workspaceWords(locale: string) {
  return locale === "ar"
    ? {
        workspace: "مساحة التاجر",
        overview: "نظرة عامة",
        products: "المنتجات",
        orders: "الطلبات",
        insights: "الأسعار والتنبيهات",
        team: "الفريق",
        settings: "المتجر والإعدادات",
        reports: "التقارير",
        billing: "الاشتراك",
        notifications: "الإشعارات",
        home: "تصفح السوق",
        account: "الحساب",
        welcome: "أهلًا،",
        intro: "كل ما تحتاجه لإدارة متجرك في مكان واحد.",
        days: "آخر أيام",
        views: "مشاهدات العروض",
        clicks: "نقرات الشراء",
        sales: "قيمة الطلبات المسلّمة",
        conversion: "تحويل الجلسات إلى طلبات",
        sessions: "جلسات التصفح",
        newOrders: "طلبات جديدة",
        lowStock: "مخزون منخفض",
        activity: "نشاط المتجر",
        recent: "أحدث الطلبات",
        top: "المنتجات الأكثر مبيعًا",
        alerts: "تنبيهات تحتاج انتباهك",
        none: "لا يوجد نشاط في هذه الفترة.",
        noAlerts: "لا توجد تنبيهات مفتوحة.",
        viewAll: "عرض الكل",
        add: "إضافة منتج",
        excel: "تصدير Excel",
        pdf: "طباعة / حفظ PDF",
        reportTitle: "تقرير أداء المتجر",
        reportNote:
          "الأوقات بتوقيت الرياض. قيمة الطلبات المسلّمة ليست تأكيدًا على مبالغ محصلة. التحويل يحسب جلسات المشاهدة المنسوبة إلى طلب غير ملغى أو مرتجع.",
        metricsNote:
          "المشاهدات والنقرات تُحتسب مرة لكل عرض وجلسة متصفح في اليوم. لا تتضمن البيانات السابقة لتفعيل التتبع.",
        locked: "هذه التحليلات تتطلب خطة تتضمن التحليلات الأساسية.",
        plans: "عرض الخطط",
        loading: "جارٍ التحميل…",
        login: "تسجيل الدخول",
        save: "حفظ التغييرات",
        saved: "تم الحفظ",
        cancel: "إلغاء",
        price: "سعرك",
        best: "أقل سعر منافس",
        position: "ترتيبك",
        suggestion: "سعر أقل بقرش",
        competitors: "المنافسون",
        history: "سجل السعر",
        noHistory: "لا توجد تغييرات سعر مسجلة في هذه الفترة.",
        historyLocked: "سجل الأسعار يتطلب ميزة سجل الأسعار.",
        noCompetitor: "لا توجد عروض منافسة متاحة.",
        stock: "المخزون",
        drop: "انخفاض سعر منافس",
        priceNote:
          "المقارنة بين عروض المنتج نفسه من التجار المعتمدين المتوفرة بالمخزون، ولا تشمل التوصيل. اقتراح القرش مرجع حسابي؛ قرار التسعير لك.",
        branding: "هوية المتجر",
        slug: "عنوان المتجر (حروف إنجليزية وأرقام وشرطات)",
        logo: "رابط الشعار HTTPS (اختياري)",
        banner: "رابط الغلاف HTTPS (اختياري)",
        color: "لون الهوية",
        description: "نبذة عن المتجر",
        threshold: "حد تنبيه المخزون",
        stockAlerts: "تنبيهات نقص المخزون",
        priceAlerts: "تنبيهات انخفاض أسعار المنافسين",
        storefront: "عرض المتجر",
        preview: "معاينة الهوية",
        legal: "البيانات القانونية والتحقق",
        invite: "دعوة عضو",
        email: "بريد حساب تاجر مسجل",
        role: "الصلاحية",
        members: "أعضاء الفريق",
        remove: "إزالة",
        accept: "قبول الدعوة",
        invitations: "دعواتك",
        teamNote:
          "الدعوات لحسابات التجار المسجلة، وتتطلب موافقة صاحب الحساب. إدارة الفريق للمالك فقط، ووصول الأعضاء يتطلب ميزة الفريق الفعالة.",
        teamLocked: "إضافة أعضاء تتطلب خطة تدعم الفريق.",
        pending: "بانتظار القبول",
        active: "نشط",
        setup: "أكمل بيانات المتجر",
        noStore: "أنشئ متجرك أو اقبل دعوة للانضمام إلى فريق.",
        roles: {
          OWNER: "المالك",
          MANAGER: "مدير",
          CATALOG: "مسؤول المنتجات",
          ORDERS: "مسؤول الطلبات",
          ANALYST: "محلل",
        },
        logout: "تسجيل الخروج",
      }
    : {
        workspace: "Seller workspace",
        overview: "Overview",
        products: "Products",
        orders: "Orders",
        insights: "Pricing & alerts",
        team: "Team",
        settings: "Store & settings",
        reports: "Reports",
        billing: "Subscription",
        notifications: "Notifications",
        home: "Visit marketplace",
        account: "Account",
        welcome: "Welcome back,",
        intro: "Your store, performance and daily operations in one place.",
        days: "Last days",
        views: "Offer views",
        clicks: "Purchase clicks",
        sales: "Delivered order value",
        conversion: "Session-to-order conversion",
        sessions: "Browsing sessions",
        newOrders: "New orders",
        lowStock: "Low stock",
        activity: "Store activity",
        recent: "Recent orders",
        top: "Best-selling products",
        alerts: "Needs your attention",
        none: "No activity in this period.",
        noAlerts: "No open alerts.",
        viewAll: "View all",
        add: "Add product",
        excel: "Export Excel",
        pdf: "Print / Save PDF",
        reportTitle: "Store performance report",
        reportNote:
          "All reporting days use Riyadh time. Delivered order value is not confirmation of collected payment. Conversion counts viewed sessions attributed to a non-cancelled/non-returned order.",
        metricsNote:
          "Views and clicks are deduplicated per offer and browser session each day. Data before tracking was enabled is not included.",
        locked: "These analytics require a plan with basic analytics.",
        plans: "View plans",
        loading: "Loading…",
        login: "Sign in",
        save: "Save changes",
        saved: "Saved",
        cancel: "Cancel",
        price: "Your price",
        best: "Best competitor",
        position: "Your position",
        suggestion: "One halala lower",
        competitors: "Competitors",
        history: "Price history",
        noHistory: "No recorded price changes in this period.",
        historyLocked: "Price history requires the price-history entitlement.",
        noCompetitor: "No available competitor offers.",
        stock: "Stock",
        drop: "Competitor price drop",
        priceNote:
          "Compares the same product across approved sellers with stock, excluding delivery. The one-halala suggestion is a calculation; you decide your price.",
        branding: "Store identity",
        slug: "Store address (letters, digits and hyphens)",
        logo: "HTTPS logo URL (optional)",
        banner: "HTTPS cover URL (optional)",
        color: "Brand color",
        description: "About the store",
        threshold: "Low-stock threshold",
        stockAlerts: "Low-stock alerts",
        priceAlerts: "Competitor price-drop alerts",
        storefront: "View storefront",
        preview: "Brand preview",
        legal: "Legal details & verification",
        invite: "Invite member",
        email: "Existing seller account email",
        role: "Role",
        members: "Team members",
        remove: "Remove",
        accept: "Accept invitation",
        invitations: "Your invitations",
        teamNote:
          "Invite registered seller accounts; the recipient must accept. Only the owner manages the team. Member access requires an active team entitlement.",
        teamLocked: "Adding members requires a plan with team access.",
        pending: "Awaiting acceptance",
        active: "Active",
        setup: "Set up your store",
        noStore: "Create a store profile or accept a team invitation.",
        roles: {
          OWNER: "Owner",
          MANAGER: "Manager",
          CATALOG: "Catalog editor",
          ORDERS: "Order operator",
          ANALYST: "Analyst",
        },
        logout: "Sign out",
      };
}
