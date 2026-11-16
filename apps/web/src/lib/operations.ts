export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface OrderItem {
  id: string;
  offerId: string;
  productId: string;
  title: string;
  quantity: number;
  priceAtPurchase: string;
  imageUrl: string | null;
}
export interface Review {
  id: string;
  target: "SELLER" | "PRODUCT";
  productId: string | null;
  rating: number;
  comment: string;
  createdAt: string;
  isHidden?: boolean;
}
export interface Dispute {
  id: string;
  orderId: string;
  reason: string;
  status: string;
  resolution: string | null;
  messages: {
    id: string;
    body: string;
    createdAt: string;
    author: { role: string };
  }[];
}
export interface Order {
  id: string;
  number: string;
  status: string;
  recipientName: string;
  contactPhone: string;
  shippingAddress: string;
  notes: string | null;
  totalAmount: string;
  createdAt: string;
  deliveryMethod: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  items: OrderItem[];
  events: {
    id: string;
    status: string;
    actorRole: string;
    message: string | null;
    createdAt: string;
  }[];
  seller: { businessName: string };
  shopper?: { email: string };
  reviews: Review[];
  dispute: Dispute | null;
}
export interface Quote {
  id: string;
  title: string;
  price: string;
  stock: number;
  productId: string;
  seller: { businessName: string };
}
export interface Notice {
  id: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  href: string;
  readAt: string | null;
  createdAt: string;
  deliveries: { channel: string; status: string }[];
}
export const orderTransitions: Record<string, string[]> = {
  PENDING: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
};
export function operationWords(locale: string) {
  return locale === "ar"
    ? {
        orders: "الطلبات",
        sellerOrders: "طلبات المتجر",
        place: "اطلب من هذا التاجر",
        checkout: "تأكيد طلب لدى التاجر",
        name: "اسم المستلم",
        phone: "رقم التواصل",
        address: "عنوان التسليم",
        notes: "ملاحظات (اختياري)",
        quantity: "الكمية",
        total: "قيمة المنتجات",
        delivery:
          "التاجر مسؤول عن تأكيد تكلفة التوصيل والدفع وتنفيذ الطلب. المنصة لا تشحن ولا تخصم أموالًا لهذا الطلب.",
        ack: "أفهم أن التاجر يتولى الدفع والتوصيل وأن تكلفة الشحن يؤكدها التاجر.",
        submit: "إرسال الطلب",
        login: "تسجيل الدخول",
        shopperOnly: "سجّل الدخول بحساب متسوق لإرسال طلب.",
        loading: "جارٍ التحميل…",
        back: "العودة",
        empty: "لا توجد طلبات.",
        number: "رقم الطلب",
        status: "الحالة",
        date: "التاريخ",
        open: "عرض الطلب",
        save: "حفظ",
        saved: "تم الحفظ",
        all: "الكل",
        next: "التالي",
        previous: "السابق",
        details: "تفاصيل الطلب",
        items: "المنتجات",
        deliveryMethod: "طريقة التوصيل",
        trackingNumber: "رقم التتبع",
        trackingUrl: "رابط التتبع HTTPS (اختياري)",
        track: "تتبع الشحنة",
        update: "تحديث حالة الطلب",
        message: "رسالة",
        timeline: "سجل الطلب",
        cancel: "إلغاء الطلب",
        reviews: "التقييمات",
        review: "إضافة تقييم",
        target: "نوع التقييم",
        seller: "التاجر",
        product: "المنتج",
        rating: "التقييم",
        comment: "نص التقييم",
        verified: "متسوق اشترى المنتج",
        noReviews: "لا توجد تقييمات بعد.",
        report: "الإبلاغ عن إساءة",
        reason: "السبب (10 أحرف على الأقل)",
        dispute: "نزاع الطلب",
        openDispute: "فتح نزاع",
        disputeNote:
          "الإدارة تتوسط بين الطرفين؛ تنفيذ التسوية أو الاسترداد مسؤولية التاجر.",
        reply: "إرسال رد",
        resolution: "قرار الوساطة",
        underReview: "بدء المراجعة",
        resolve: "حل النزاع",
        notifications: "الإشعارات",
        markRead: "تحديد الكل كمقروء",
        previews:
          "إشعار داخل المنصة. البريد وواتساب وPush معاينات محلية فقط؛ لم تُرسل خارجيًا.",
        admin: "عمليات المنصة",
        disputes: "النزاعات",
        reports: "بلاغات التقييمات",
        hide: "إخفاء التقييم",
        keep: "الإبقاء على التقييم",
        moderationReason: "سبب قرار المراجعة",
        noReports: "لا توجد بلاغات.",
        noDisputes: "لا توجد نزاعات.",
        confirmCancel: "هل تريد إلغاء الطلب؟",
        noNotifications: "لا توجد إشعارات.",
        refresh: "تحديث السعر والتوفر",
        stock: "المتوفر",
        labels: {
          PENDING: "جديد",
          ACCEPTED: "مقبول",
          SHIPPED: "تم الشحن",
          DELIVERED: "تم التسليم",
          CANCELLED: "ملغى",
          RETURNED: "مرتجع",
          OPEN: "مفتوح",
          UNDER_REVIEW: "قيد المراجعة",
          RESOLVED: "تم الحل",
          SHOPPER: "المتسوق",
          SELLER: "التاجر",
          ADMIN: "الإدارة",
        },
      }
    : {
        orders: "Orders",
        sellerOrders: "Store orders",
        place: "Order from this seller",
        checkout: "Place an order with the seller",
        name: "Recipient name",
        phone: "Contact phone",
        address: "Delivery address",
        notes: "Notes (optional)",
        quantity: "Quantity",
        total: "Product subtotal",
        delivery:
          "The seller confirms delivery charges and payment and handles fulfillment. The platform does not ship or charge for this order.",
        ack: "I understand the seller handles payment and delivery and confirms shipping charges.",
        submit: "Place order",
        login: "Sign in",
        shopperOnly: "Sign in as a shopper to place an order.",
        loading: "Loading…",
        back: "Back",
        empty: "No orders yet.",
        number: "Order number",
        status: "Status",
        date: "Date",
        open: "View order",
        save: "Save",
        saved: "Saved",
        all: "All",
        next: "Next",
        previous: "Previous",
        details: "Order details",
        items: "Items",
        deliveryMethod: "Delivery method",
        trackingNumber: "Tracking number",
        trackingUrl: "HTTPS tracking URL (optional)",
        track: "Track shipment",
        update: "Update order status",
        message: "Message",
        timeline: "Order timeline",
        cancel: "Cancel order",
        reviews: "Reviews",
        review: "Add review",
        target: "Review target",
        seller: "Seller",
        product: "Product",
        rating: "Rating",
        comment: "Review text",
        verified: "Verified purchaser",
        noReviews: "No reviews yet.",
        report: "Report abuse",
        reason: "Reason (at least 10 characters)",
        dispute: "Order dispute",
        openDispute: "Open dispute",
        disputeNote:
          "Admin mediates between both parties. The seller handles any agreed settlement or refund.",
        reply: "Send reply",
        resolution: "Mediation decision",
        underReview: "Start review",
        resolve: "Resolve dispute",
        notifications: "Notifications",
        markRead: "Mark all as read",
        previews:
          "In-app notification. Email, WhatsApp and push are local delivery previews only; nothing was sent externally.",
        admin: "Platform operations",
        disputes: "Disputes",
        reports: "Review reports",
        hide: "Hide review",
        keep: "Keep review",
        moderationReason: "Moderation reason",
        noReports: "No reports.",
        noDisputes: "No disputes.",
        confirmCancel: "Cancel this order?",
        noNotifications: "No notifications yet.",
        refresh: "Refresh price and availability",
        stock: "Available",
        labels: {
          PENDING: "New",
          ACCEPTED: "Accepted",
          SHIPPED: "Shipped",
          DELIVERED: "Delivered",
          CANCELLED: "Cancelled",
          RETURNED: "Returned",
          OPEN: "Open",
          UNDER_REVIEW: "Under review",
          RESOLVED: "Resolved",
          SHOPPER: "Shopper",
          SELLER: "Seller",
          ADMIN: "Admin",
        },
      };
}
export function operationLabel(value: string, locale: string) {
  const labels = operationWords(locale).labels;
  return labels[value as keyof typeof labels] || value;
}
export function operationDate(date: string, locale: string) {
  return new Date(date).toLocaleString(locale === "ar" ? "ar-SA" : "en-GB", {
    timeZone: "Asia/Riyadh",
  });
}
