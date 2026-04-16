import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50 dark:from-slate-950 dark:via-slate-900 dark:to-violet-950">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500" />
          <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            zenfs-browser
          </span>
        </div>
        <nav className="hidden items-center gap-6 text-sm text-slate-600 sm:flex dark:text-slate-300">
          <a href="#features" className="hover:text-violet-600 dark:hover:text-violet-400">
            Features
          </a>
          <a href="#docs" className="hover:text-violet-600 dark:hover:text-violet-400">
            Docs
          </a>
          <a
            href="https://github.com/bodhiapps/zenfs-browser"
            target="_blank"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            GitHub
          </a>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-16 text-center">
        <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-100/60 px-3 py-1 text-xs font-medium text-violet-700 dark:border-violet-800 dark:bg-violet-900/40 dark:text-violet-300">
          ⚡ Powered by Vite + React + Tailwind
        </span>

        <h1 className="mt-6 text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl dark:text-white">
          A filesystem for the browser,{' '}
          <span className="bg-gradient-to-r from-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
            zen-simple.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          Read, write, and stream files directly in the browser with a familiar
          POSIX-style API. No server required.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={() => setCount((c) => c + 1)}
            className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            Clicked {count} times
          </button>
          <a
            href="#docs"
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
          >
            Read the docs →
          </a>
        </div>

        <section
          id="features"
          className="mt-24 grid gap-6 text-left sm:grid-cols-3"
        >
          {[
            {
              title: 'Zero config',
              body: 'Drop in the package and get a working virtual filesystem in seconds.',
              icon: '📦',
            },
            {
              title: 'POSIX-ish API',
              body: 'Familiar read/write/stat semantics that work on the web.',
              icon: '🧭',
            },
            {
              title: 'Persistent',
              body: 'Back your files with IndexedDB, OPFS, or in-memory storage.',
              icon: '💾',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-slate-200 bg-white/60 p-6 shadow-sm backdrop-blur transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
            >
              <div className="text-2xl">{f.icon}</div>
              <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
                {f.title}
              </h3>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                {f.body}
              </p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        Built with Tailwind CSS v4 · zenfs-browser
      </footer>
    </div>
  )
}

export default App
