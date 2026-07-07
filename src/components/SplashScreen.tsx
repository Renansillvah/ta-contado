import { useState, useEffect } from 'react'

interface Props {
  onFinalizar: () => void
}

export default function SplashScreen({ onFinalizar }: Props) {
  const [saindo, setSaindo] = useState(false)
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    // Entrada suave
    const t1 = setTimeout(() => setVisivel(true), 50)
    // Saída automática após 3s
    const t2 = setTimeout(() => handleSair(), 3200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSair = () => {
    if (saindo) return
    setSaindo(true)
    setTimeout(onFinalizar, 500)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center max-w-lg mx-auto overflow-hidden select-none"
      style={{
        background: 'linear-gradient(160deg, #090f1f 0%, #0b1d40 45%, #0d2452 75%, #0a1f4a 100%)',
        opacity: saindo ? 0 : visivel ? 1 : 0,
        transition: saindo ? 'opacity 0.5s ease-out' : 'opacity 0.4s ease-in',
      }}
    >
      {/* ── Fundo: partículas de números flutuando ────────────────── */}
      <FloatingNumbers />

      {/* ── Anéis concêntricos pulsantes ────────────────────────── */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="absolute rounded-full" style={ringStyle(220, 1)} />
        <div className="absolute rounded-full" style={ringStyle(170, 2)} />
        <div className="absolute rounded-full" style={ringStyle(130, 3)} />
      </div>

      {/* ── Logo TC ──────────────────────────────────────────────── */}
      <div
        className="relative z-10 flex flex-col items-center"
        style={{
          opacity: visivel ? 1 : 0,
          transform: visivel ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.85)',
          transition: 'opacity 0.6s cubic-bezier(0.34,1.56,0.64,1), transform 0.6s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Badge TC */}
        <div
          className="w-28 h-28 rounded-[32px] flex items-center justify-center mb-7"
          style={{
            background: 'linear-gradient(140deg, #1e40af 0%, #2563eb 55%, #3b82f6 100%)',
            boxShadow: '0 24px 64px rgba(37,99,235,0.45), 0 0 0 1px rgba(59,130,246,0.25)',
          }}
        >
          <span
            className="text-white font-black text-4xl"
            style={{ fontFamily: 'Poppins, sans-serif', letterSpacing: '-0.02em' }}
          >
            TC
          </span>
        </div>

        {/* Nome */}
        <h1
          className="text-white font-black text-[32px] tracking-tight leading-none mb-2"
          style={{ fontFamily: 'Poppins, sans-serif' }}
        >
          Tá Contado
        </h1>

        {/* Subtítulo */}
        <p
          className="text-[15px] font-medium"
          style={{ color: 'oklch(0.62 0.18 162)', letterSpacing: '0.01em' }}
        >
          Seu assessor financeiro pessoal.
        </p>
      </div>

      {/* ── Indicador de progresso (barra) ──────────────────────── */}
      <div
        className="absolute bottom-20 z-10 w-16 overflow-hidden rounded-full"
        style={{
          height: 3,
          background: 'oklch(1 0 0 / 8%)',
          opacity: visivel ? 1 : 0,
          transition: 'opacity 0.4s 0.8s ease',
        }}
      >
        <div
          className="h-full rounded-full"
          style={{
            background: 'oklch(0.62 0.18 162)',
            width: saindo ? '100%' : '0%',
            transition: saindo ? 'width 0.4s ease' : 'width 3.1s linear 0.3s',
          }}
        />
      </div>

      {/* ── Botão Pular ──────────────────────────────────────────── */}
      <button
        onClick={handleSair}
        className="absolute bottom-8 z-10 text-sm font-medium transition-opacity hover:opacity-100 active:opacity-60"
        style={{ color: 'oklch(0.58 0.01 240)', opacity: visivel ? 0.65 : 0, transition: 'opacity 0.4s 1s ease' }}
      >
        Pular
      </button>

      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0) rotate(-4deg); opacity: var(--op-start); }
          50%  { opacity: var(--op-peak); }
          100% { transform: translateY(-22px) rotate(4deg); opacity: var(--op-start); }
        }
        @keyframes ringPulse {
          0%, 100% { transform: scale(1);    opacity: 0.18; }
          50%       { transform: scale(1.07); opacity: 0.07; }
        }
      `}</style>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function ringStyle(size: number, delay: number): React.CSSProperties {
  return {
    width: size,
    height: size,
    border: '1.5px solid oklch(0.62 0.18 162)',
    animation: `ringPulse 3s ease-in-out ${delay * 0.5}s infinite`,
  }
}

const ITEMS = [
  { v: 'R$', x: 8, y: 14, s: 1.1, d: 0 },
  { v: '+12%', x: 75, y: 9, s: 0.85, d: 0.8 },
  { v: '↑', x: 88, y: 28, s: 1.3, d: 1.4 },
  { v: '200', x: 6, y: 42, s: 0.9, d: 0.5 },
  { v: '$', x: 92, y: 55, s: 1.0, d: 2.1 },
  { v: '✓', x: 15, y: 68, s: 0.95, d: 1.0 },
  { v: '%', x: 82, y: 74, s: 1.15, d: 0.3 },
  { v: 'R$', x: 3, y: 84, s: 0.8, d: 1.7 },
  { v: '↑', x: 60, y: 88, s: 1.0, d: 2.5 },
  { v: '50', x: 45, y: 5, s: 0.85, d: 1.2 },
  { v: '3x', x: 30, y: 80, s: 0.9, d: 0.6 },
  { v: '$', x: 70, y: 20, s: 1.2, d: 1.9 },
]

function FloatingNumbers() {
  return (
    <>
      {ITEMS.map((item, i) => (
        <span
          key={i}
          className="absolute font-bold pointer-events-none"
          style={{
            left: `${item.x}%`,
            top: `${item.y}%`,
            fontSize: `${13 + item.s * 8}px`,
            color: 'oklch(0.62 0.18 162)',
            fontFamily: 'Poppins, sans-serif',
            '--op-start': '0.07',
            '--op-peak': String(0.07 + item.s * 0.06),
            animation: `floatUp ${2.8 + item.s}s ease-in-out ${item.d}s infinite alternate`,
          } as React.CSSProperties}
        >
          {item.v}
        </span>
      ))}
    </>
  )
}
