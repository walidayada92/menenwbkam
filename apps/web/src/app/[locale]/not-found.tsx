import Link from "next/link";
export default function NotFound() {
  return (
    <section className="content">
      <h1>404</h1>
      <p>هذه الصفحة غير متاحة. / This page is not available.</p>
      <Link className="button" href="/ar">
        العودة للبحث / Back to search
      </Link>
    </section>
  );
}
