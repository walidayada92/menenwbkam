export default function Home() {
  return (
    <main>
      <header className="hero">
        <h1>Menenwbkam</h1>
        <p>
          Know <strong>where</strong> to buy and <strong>for how much</strong>.
          <br />
          Menenwbkam (منين وبكام) helps you compare prices and find the best deals.
        </p>
        <a className="cta" href="#">Get Early Access</a>
      </header>

      <section>
        <h2>Why Menenwbkam?</h2>
        <div className="features">
          <div className="card">📍 Find Nearby Stores</div>
          <div className="card">💰 Compare Prices</div>
          <div className="card">🛒 Smart Shopping</div>
        </div>
      </section>

      <footer>© 2026 Menenwbkam.com</footer>

      <style jsx>{`
        .hero {
          background: linear-gradient(135deg, #0ea5e9, #2563eb);
          color: white;
          padding: 64px 20px;
          text-align: center;
        }
        .cta {
          background: white;
          color: #2563eb;
          padding: 12px 24px;
          border-radius: 999px;
          font-weight: 600;
          text-decoration: none;
        }
        section {
          padding: 60px 20px;
          text-align: center;
        }
        .features {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
        }
        .card {
          background: #f8fafc;
          padding: 24px;
          border-radius: 12px;
        }
        footer {
          padding: 30px;
          text-align: center;
          background: #020617;
          color: #cbd5f5;
        }
      `}</style>
    </main>
  );
}

