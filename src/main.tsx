import { StrictMode, lazy, Suspense } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { ThemeProvider } from "next-themes"

import "./index.css"
import { ErrorBoundary } from "./components/error-boundary"
import { Spinner } from "@/components/ui/spinner"

// --- Encaminha todos os logs do console para o painel de Debug do pai ---
;(function () {
  const levels = ['log', 'info', 'warn', 'error'] as const
  levels.forEach((level) => {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      original(...args)
      try {
        const message = args.map((a) => {
          if (a === null) return 'null'
          if (a === undefined) return 'undefined'
          if (a instanceof Error) return `${a.name}: ${a.message}`
          if (typeof a === 'object') { try { return JSON.stringify(a, null, 2) } catch { return String(a) } }
          return String(a)
        }).join(' ')
        const err = args.find((a) => a instanceof Error) as Error | undefined
        window.parent.postMessage({ type: 'console-log', level, message, stack: err?.stack }, '*')
      } catch (_) {}
    }
  })

  window.addEventListener('error', (e) => {
    try {
      window.parent.postMessage({ type: 'console-log', level: 'error', message: e.message || String(e), stack: e.error?.stack }, '*')
    } catch (_) {}
  })

  window.addEventListener('unhandledrejection', (e) => {
    try {
      const msg = e.reason instanceof Error ? `${e.reason.name}: ${e.reason.message}` : String(e.reason)
      window.parent.postMessage({ type: 'console-log', level: 'error', message: `Unhandled Promise: ${msg}`, stack: e.reason?.stack }, '*')
    } catch (_) {}
  })
})()

// --- Captura de Erros do Vite (HMR) ---
// Ouve erros de compilação vindos do servidor Vite via WebSocket
if (import.meta.hot) {
  import.meta.hot.on('vite:error', (data: any) => {
    try {
      const err = data.err
      window.parent.postMessage({ type: 'console-log', level: 'error', message: `[Vite] ${err?.message || 'Build error'}${err?.frame ? '\n' + err.frame : ''}`, stack: err?.stack }, '*')
    } catch (_) {}
    // Dispara um evento customizado que o ErrorBoundary pode ouvir
    window.dispatchEvent(new CustomEvent('vite:error', { detail: data.err }))
  })
}

// Importação Lazy (Preguiçosa) - Isso isola o App
// Se o App.tsx tiver erro de sintaxe, o erro acontece aqui na importação
// e o ErrorBoundary consegue capturar!
const App = lazy(() => import("./App.tsx"))

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <Suspense fallback={
            <div className="flex h-screen w-full items-center justify-center">
              <Spinner className="size-10 text-primary" />
            </div>
          }>
            <App />
          </Suspense>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
)
