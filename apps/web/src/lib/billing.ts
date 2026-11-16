export const featureKeys = [
  "bulkUpload",
  "basicAnalytics",
  "priceHistory",
  "featuredBadge",
  "apiAccess",
  "priorityPlacement",
  "teamMembers",
] as const;
export interface Plan {
  id: string;
  name: string;
  nameAr: string;
  monthlyPrice: string;
  yearlyPrice: string;
  productLimit: number;
  features: Record<string, boolean>;
  isActive: boolean;
  isCustom: boolean;
  trialDays: number;
  graceDays: number;
  sortOrder: number;
}
export interface Invoice {
  id: string;
  number: string;
  planName: string;
  planNameAr: string;
  interval: string;
  status: string;
  subtotalHalalas: number;
  discountHalalas: number;
  vatBasisPoints: number;
  vatHalalas: number;
  totalHalalas: number;
  buyerName: string;
  buyerEmail: string;
  sellerName: string;
  sellerVatNumber: string | null;
  createdAt: string;
  paidAt: string | null;
  isTest: boolean;
  subscription?: { seller: { businessName: string } };
}
export interface BillingState {
  plan: Plan | null;
  status: string;
  subscription: {
    id: string;
    endDate: string;
    interval: string;
    cancelAtPeriodEnd: boolean;
    pendingPlanId: string | null;
    pendingInterval: string | null;
  } | null;
  trialAvailable: boolean;
  offerCount: number;
  productLimit: number;
  testEnabled: boolean;
  invoices: Invoice[];
}
export interface Coupon {
  id: string;
  code: string;
  percentOff: number;
  maxRedemptions: number;
  redemptionCount: number;
  isActive: boolean;
  expiresAt: string | null;
}
export function billingWords(locale: string) {
  return locale === "ar"
    ? {
        title: "الخطط والفوترة",
        admin: "إدارة الاشتراكات",
        test: "وضع تجريبي فقط — لا تُخصم أموال حقيقية.",
        disabled: "محاكاة الدفع معطلة في هذه البيئة.",
        monthly: "شهري",
        yearly: "سنوي",
        yearlyNote: "السعر السنوي الإجمالي؛ الخصم مقارنة بـ 12 شهرًا.",
        current: "الخطة الحالية",
        status: "الحالة",
        until: "نهاية الفترة",
        count: "عدد المنتجات",
        limit: "حد المنتجات",
        unlimited: "غير محدود",
        trial: "بدء تجربة مجانية",
        days: "أيام",
        buy: "إنشاء فاتورة تجريبية",
        schedule: "تغيير عند التجديد القادم",
        cancel: "إلغاء عند نهاية الفترة",
        renew: "إنشاء فاتورة التجديد",
        coupon: "كود الخصم (اختياري)",
        invoices: "الفواتير",
        number: "رقم الفاتورة",
        plan: "الخطة",
        total: "الإجمالي",
        view: "عرض / طباعة",
        paid: "محاكاة نجاح الدفع",
        failed: "محاكاة فشل الدفع",
        loading: "جارٍ التحميل…",
        save: "حفظ",
        saved: "تم الحفظ",
        pricing:
          "الأسعار قبل الضريبة. شراء خطة يبدأ فترة كاملة فور نجاح الدفع، دون خصم نسبي للفترة السابقة. التغيير المجدول يبدأ عند سداد التجديد.",
        custom: "تواصل مع الإدارة لخطة مخصصة",
        queued: "تغيير مجدول",
        cancelled: "تم إيقاف التجديد. تظل المزايا حتى نهاية الفترة.",
        features: "المزايا",
        future:
          "ميزات التحليلات وسجل الأسعار وAPI والأولوية والفريق مخصصة للمراحل اللاحقة؛ رفع الملفات والشارة وحدود المنتجات متاحة الآن.",
        bulkUpload: "رفع جماعي",
        basicAnalytics: "تحليلات أساسية",
        priceHistory: "سجل الأسعار",
        featuredBadge: "شارة مميزة",
        apiAccess: "وصول API",
        priorityPlacement: "أولوية العرض",
        teamMembers: "أعضاء الفريق",
        back: "العودة للوحة التحكم",
        login: "تسجيل الدخول",
        invoice: "فاتورة تجريبية",
        subtotal: "قبل الخصم والضريبة",
        discount: "الخصم",
        vat: "ضريبة القيمة المضافة",
        buyer: "العميل",
        supplier: "المورد",
        vatNumber: "الرقم الضريبي",
        date: "التاريخ",
        print: "طباعة / حفظ PDF",
        invoiceNote:
          "مستند اختبار، ليس فاتورة ضريبية إلكترونية معتمدة. لم تُخصم أموال حقيقية.",
        plans: "إدارة الخطط",
        newPlan: "خطة جديدة",
        id: "معرّف الخطة",
        name: "الاسم بالإنجليزية",
        nameAr: "الاسم بالعربية",
        active: "مفعلة",
        customPlan: "خطة مخصصة",
        trialDays: "أيام التجربة",
        grace: "أيام السماح",
        sort: "ترتيب العرض",
        coupons: "إدارة الخصومات",
        code: "كود الخصم",
        percent: "نسبة الخصم %",
        maxUses: "الحد الأقصى للاستخدام",
        expires: "انتهاء الصلاحية",
        uses: "عدد الاستخدامات",
        revenue: "إيرادات تجريبية شاملة الضريبة",
        live: "الإيرادات الحقيقية",
        noInvoices: "لا توجد فواتير بعد.",
        noPlan: "اختر خطة",
        free: "مجاني",
        confirmCancel: "هل تريد إيقاف التجديد والعودة للمجاني بنهاية الفترة؟",
        statuses: {
          FREE: "مجاني",
          PENDING: "بانتظار الدفع",
          TRIALING: "تجربة مجانية",
          ACTIVE: "نشط",
          GRACE_PERIOD: "فترة سماح",
          EXPIRED: "منتهي",
          CANCELLED: "ملغى",
          OPEN: "غير مدفوعة",
          PAID: "مدفوعة تجريبيًا",
          FAILED: "فشل الدفع",
          VOID: "ملغاة",
        },
      }
    : {
        title: "Plans & billing",
        admin: "Subscription administration",
        test: "Test mode only — no real money is charged.",
        disabled: "Payment simulation is disabled in this environment.",
        monthly: "Monthly",
        yearly: "Yearly",
        yearlyNote:
          "Annual total; discounted compared with 12 monthly payments.",
        current: "Current plan",
        status: "Status",
        until: "Period ends",
        count: "Products",
        limit: "Product limit",
        unlimited: "Unlimited",
        trial: "Start free trial",
        days: "days",
        buy: "Create test invoice",
        schedule: "Change at next renewal",
        cancel: "Cancel at period end",
        renew: "Create renewal invoice",
        coupon: "Coupon code (optional)",
        invoices: "Invoices",
        number: "Invoice number",
        plan: "Plan",
        total: "Total",
        view: "View / print",
        paid: "Simulate payment success",
        failed: "Simulate payment failure",
        loading: "Loading…",
        save: "Save",
        saved: "Saved",
        pricing:
          "Prices exclude VAT. Purchasing a plan starts a full new period when paid, without proration or credit for the previous period. Scheduled changes apply when the renewal is paid.",
        custom: "Contact admin for a custom plan",
        queued: "Scheduled change",
        cancelled:
          "Renewal is cancelled. Benefits remain until the period ends.",
        features: "Features",
        future:
          "Analytics, price history and team roles are available in the seller workspace. API access and priority placement remain later integrations.",
        bulkUpload: "Bulk upload",
        basicAnalytics: "Basic analytics",
        priceHistory: "Price history",
        featuredBadge: "Featured badge",
        apiAccess: "API access",
        priorityPlacement: "Priority placement",
        teamMembers: "Team members",
        back: "Back to dashboard",
        login: "Sign in",
        invoice: "Test invoice",
        subtotal: "Subtotal",
        discount: "Discount",
        vat: "VAT",
        buyer: "Buyer",
        supplier: "Supplier",
        vatNumber: "VAT number",
        date: "Date",
        print: "Print / Save PDF",
        invoiceNote:
          "Test document, not a certified electronic tax invoice. No real money has been charged.",
        plans: "Manage plans",
        newPlan: "New plan",
        id: "Plan ID",
        name: "English name",
        nameAr: "Arabic name",
        active: "Active",
        customPlan: "Custom plan",
        trialDays: "Trial days",
        grace: "Grace days",
        sort: "Display order",
        coupons: "Manage coupons",
        code: "Coupon code",
        percent: "Discount %",
        maxUses: "Maximum uses",
        expires: "Expires",
        uses: "Redemptions",
        revenue: "Test revenue including VAT",
        live: "Live revenue",
        noInvoices: "No invoices yet.",
        noPlan: "Choose a plan",
        free: "Free",
        confirmCancel:
          "Cancel renewal and return to Free at the end of this period?",
        statuses: {
          FREE: "Free",
          PENDING: "Awaiting payment",
          TRIALING: "Trial",
          ACTIVE: "Active",
          GRACE_PERIOD: "Grace period",
          EXPIRED: "Expired",
          CANCELLED: "Cancelled",
          OPEN: "Open",
          PAID: "Test paid",
          FAILED: "Payment failed",
          VOID: "Void",
        },
      };
}
export function statusLabel(status: string, locale: string) {
  const states = billingWords(locale).statuses;
  return states[status as keyof typeof states] || status;
}
