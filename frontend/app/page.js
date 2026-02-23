"use client";

import { useState } from "react";

export default function Home() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
    setEmail("");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 text-white px-6">
      <div className="text-center max-w-xl w-full">
        <h1 className="text-5xl font-bold mb-6">Menenwbkam</h1>

        <p className="text-gray-300 mb-8 text-lg">
          We're working hard to launch our new website.
          Stay tuned — something amazing is coming soon.
        </p>

        {!submitted ? (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="px-4 py-3 rounded-md text-black w-full sm:w-auto flex-1 outline-none"
              required
            />
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 transition rounded-md font-semibold"
            >
              Notify Me
            </button>
          </form>
        ) : (
          <p className="text-green-400 font-medium mt-4">
            ✅ Thanks! We’ll notify you soon.
          </p>
        )}

        <footer className="mt-12 text-gray-500 text-sm">
          © {new Date().getFullYear()} Menenwbkam. All rights reserved.
        </footer>
      </div>
    </main>
  );
}
