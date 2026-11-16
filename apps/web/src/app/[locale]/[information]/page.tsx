import { notFound } from "next/navigation";
import type { Metadata } from "next";

const pages = {
  about: {
    en: "About Menenwbkam",
    ar: "عن منين وبكام",
    enText: [
      "Menenwbkam helps you compare product prices across Saudi stores without creating an account. Search, compare the same model and variant, then visit the store to buy.",
      "We are a comparison service, not a marketplace or a seller. We do not take orders, collect payments, or provide delivery. The linked store handles the purchase, warranty, returns and customer support.",
      "Coverage is limited to the stores and products we can monitor. An unavailable source may have no results. We do not claim to include every offer in the market.",
    ],
    arText: [
      "منين وبكام يساعدك على مقارنة أسعار المنتجات في المتاجر السعودية بدون إنشاء حساب. ابحث وقارن نفس الموديل والنسخة، ثم انتقل للمتجر للشراء.",
      "نحن خدمة مقارنة ولسنا متجرًا أو سوقًا إلكترونيًا. لا نستقبل طلبات أو مدفوعات ولا نقدم التوصيل. المتجر هو المسؤول عن الشراء والضمان والاسترجاع وخدمة العملاء.",
      "تغطيتنا تقتصر على المتاجر والمنتجات التي يمكننا متابعة أسعارها. قد لا تظهر نتائج لمصدر غير متاح، ولا ندعي تغطية جميع عروض السوق.",
    ],
  },
  privacy: {
    en: "Privacy & browser storage",
    ar: "الخصوصية وتخزين المتصفح",
    enText: [
      "This release has no user accounts or social login. Your last eight submitted searches are stored in this browser’s local storage. They are not synced to an account. Focus an empty search box and choose Clear to remove them.",
      "Search text is sent to our search API to retrieve prices and suggestions. When collection is enabled, a search may be retained as a collection schedule and sent to store search pages. Avoid entering personal information into the search box.",
      "Our hosting and infrastructure providers process requests and may retain operational logs such as IP addresses, request URLs and error information. Production access-log retention is controlled by those providers.",
      "We do not add advertising or third-party analytics trackers in this release. Clicking a store link opens an external website whose own privacy policy applies.",
    ],
    arText: [
      "هذا الإصدار بدون حسابات أو تسجيل دخول اجتماعي. آخر ثماني عمليات بحث تُحفظ في التخزين المحلي لهذا المتصفح ولا تتزامن مع حساب. لمسحها، افتح مربع البحث فارغًا واضغط «مسح».",
      "نرسل نص البحث إلى واجهة البحث لإظهار الأسعار والاقتراحات. عند تفعيل جمع البيانات قد يُحفظ البحث كجدول متابعة ويُرسل إلى صفحات بحث المتاجر. لا تكتب معلومات شخصية في البحث.",
      "يعالج مزودو الاستضافة والبنية التحتية الطلبات وقد يحتفظون بسجلات تشغيل تشمل عناوين الإنترنت وروابط الطلبات والأخطاء. يتحكم هؤلاء المزودون في مدة الاحتفاظ بسجلات الاستضافة.",
      "لا نضيف أدوات تتبع إعلانية أو تحليلات خارجية في هذا الإصدار. عند فتح رابط متجر تنطبق سياسة الخصوصية الخاصة بذلك المتجر.",
    ],
  },
  terms: {
    en: "How we compare & terms of use",
    ar: "طريقة المقارنة وشروط الاستخدام",
    enText: [
      "Prices are in SAR and reflect a successful observation at the displayed time, not a guaranteed live quote. Confirm the final price, tax treatment, delivery charges, stock, warranty and return policy at the store before purchasing.",
      "“Lowest listed price” means the lowest saved price within the current search and store filter. Results can include different storage capacities, regions, conditions and models. It does not mean the lowest final price in the entire market.",
      "The exact-product comparison page groups offers only when our matching rules or a reviewed match link them to the same product identity. Check the specifications yourself before buying.",
      "Store review scores have not been collected. We do not invent ratings, discounts, savings or recommendations. The default order is price, and “Available first” uses the last recorded availability.",
      "Store names and logos identify sources and do not imply a partnership or endorsement. We do not add affiliate tracking parameters; source URLs may retain store offer identifiers.",
    ],
    arText: [
      "الأسعار بالريال السعودي وتعكس رصدًا ناجحًا في الوقت المعروض، وليست سعرًا لحظيًا مضمونًا. تأكد من السعر النهائي والضرائب ورسوم التوصيل والتوفر والضمان والاسترجاع في المتجر قبل الشراء.",
      "«أقل سعر في النتائج» هو أقل سعر محفوظ ضمن البحث وفلتر المتجر الحالي. قد تختلف السعة والمنطقة والحالة والموديل بين النتائج، ولا يعني ذلك أقل سعر نهائي في السوق كله.",
      "صفحة مقارنة المنتج المطابق تجمع العروض التي تربطها قواعد المطابقة أو مراجعة بشرية بنفس هوية المنتج. راجع المواصفات بنفسك قبل الشراء.",
      "لم تُجمع تقييمات المتاجر بعد. لا نختلق تقييمات أو خصومات أو مبالغ توفير. الترتيب الافتراضي حسب السعر، وخيار «المتاح أولاً» يعتمد على آخر توفر مسجل.",
      "أسماء المتاجر وشعاراتها للتعريف بالمصادر ولا تعني شراكة أو اعتمادًا. لا نضيف معاملات تتبع بالعمولة؛ قد تحتفظ الروابط بمعرفات عروض المتجر.",
    ],
  },
};
type Props = { params: Promise<{ locale: string; information: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, information } = await params;
  if (!(information in pages)) return {};
  const page = pages[information as keyof typeof pages];
  return {
    title: locale === "ar" ? page.ar : page.en,
    alternates: {
      canonical: "/" + locale + "/" + information,
      languages: { ar: "/ar/" + information, en: "/en/" + information },
    },
  };
}
export default async function Information({ params }: Props) {
  const { locale, information } = await params;
  if (!(information in pages)) notFound();
  const page = pages[information as keyof typeof pages];
  return (
    <article className="content information-page">
      <h1>{locale === "ar" ? page.ar : page.en}</h1>
      {(locale === "ar" ? page.arText : page.enText).map((text) => (
        <p key={text}>{text}</p>
      ))}
    </article>
  );
}
