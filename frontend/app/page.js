"use client";

export default function Home() {
  return (
    <main className="relative min-h-screen flex items-center justify-center bg-black text-white overflow-hidden">
      
      {/* Background Glow */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-[-200px] left-[-200px] w-[500px] h-[500px] bg-purple-600 opacity-20 blur-[150px] rounded-full"></div>
        <div className="absolute bottom-[-200px] right-[-200px] w-[500px] h-[500px] bg-blue-600 opacity-20 blur-[150px] rounded-full"></div>
      </div>

      <div className="text-center px-6">
        <h1 className="text-6xl sm:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-300 to-gray-500 bg-clip-text text-transparent">
          Menenwbkam
        </h1>

        <p className="mt-6 text-gray-400 text-lg sm:text-xl max-w-xl mx-auto leading-relaxed">
          A new digital experience is in the making.
          <br />
          We’re crafting something exceptional.
        </p>

        <div className="mt-10">
          <div className="h-px w-24 mx-auto bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
        </div>

        <p className="mt-8 text-sm text-gray-600 tracking-widest uppercase">
          Coming Soon
        </p>

        <footer className="mt-16 text-gray-700 text-sm">
          © {new Date().getFullYear()} Menenwbkam
        </footer>
      </div>
    </main>
  );
}
