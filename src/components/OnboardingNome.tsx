import { useState, useEffect, useRef } from 'react'
import { ChevronRight } from 'lucide-react'

interface Props {
  onContinuar: (nome: string) => void
}

export default function OnboardingNome({ onContinuar }: Props) {
  const [nome, setNome] = useState('')
  const [visivel, setVisivel] = useState(false)
  const [saindo, setSaindo] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setVisivel(true)
      setTimeout(() => inputRef.current?.focus(), 400)
    }, 60)
    return () => clearTimeout(t)
  }, [])

  const nomeTrimado = nome.trim()
  const podeAvancar = nomeTrimado.length >= 2

  const handleContinuar = () => {
    if (!podeAvancar) return
    setSaindo(true)
    setTimeout(() => onContinuar(nomeTrimado), 380)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col max-w-lg mx-auto"
      style={{ background: 'var(--background)' }}
    >
      {/* Conteúdo principal centralizado verticalmente */}
      <div
        className="flex-1 flex flex-col justify-center px-7"
        style={{
          opacity: saindo ? 0 : visivel ? 1 : 0,
          transform: saindo
            ? 'translateX(-28px)'
            : visivel
            ? 'translateX(0)'
            : 'translateX(28px)',
          transition: saindo
            ? 'opacity 0.35s ease-in, transform 0.35s ease-in'
            : 'opacity 0.45s cubic-bezier(0.22,1,0.36,1), transform 0.45s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        {/* Indicador de etapa */}
        <div className="flex gap-1.5 mb-10">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className="h-1 rounded-full"
              style={{
                width: i === 0 ? 24 : 8,
                background: i === 0 ? 'oklch(0.55 0.18 162)' : 'oklch(0.25 0.04 240)',
              }}
            />
          ))}
        </div>

        {/* Título */}
        <h1
          className="text-foreground font-black leading-tight mb-3"
          style={{ fontFamily: 'Poppins, sans-serif', fontSize: 28 }}
        >
          Oi! Como posso<br />te chamar? 👋
        </h1>

        {/* Subtítulo */}
        <p
          className="text-[15px] leading-relaxed mb-10"
          style={{ color: 'oklch(0.58 0.01 240)' }}
        >
          Quero me dirigir a você pelo nome para tornar tudo mais pessoal.
        </p>

        {/* Campo de nome */}
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            inputMode="text"
            autoComplete="given-name"
            placeholder="Seu nome..."
            value={nome}
            onChange={e => setNome(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleContinuar()}
            maxLength={40}
            className="w-full rounded-2xl px-5 py-4 text-[17px] font-medium outline-none border-2 transition-all"
            style={{
              background: 'oklch(0.19 0.04 240)',
              borderColor: podeAvancar
                ? 'oklch(0.55 0.18 162 / 65%)'
                : 'oklch(1 0 0 / 8%)',
              color: 'var(--foreground)',
              caretColor: 'oklch(0.62 0.18 162)',
              transition: 'border-color 0.25s ease',
            }}
          />

          {/* Ícone de check quando válido */}
          {podeAvancar && (
            <div
              className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center"
              style={{
                background: 'oklch(0.55 0.18 162)',
                animation: 'checkPop 0.25s cubic-bezier(0.34,1.56,0.64,1)',
              }}
            >
              <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                <path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Botão fixo no rodapé */}
      <div
        className="px-7 pb-10 pt-3 shrink-0"
        style={{
          opacity: saindo ? 0 : visivel ? 1 : 0,
          transition: 'opacity 0.4s 0.15s ease',
        }}
      >
        <button
          onClick={handleContinuar}
          disabled={!podeAvancar}
          className="w-full py-4 rounded-2xl font-bold text-[16px] text-white flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
          style={{
            background: podeAvancar
              ? 'oklch(0.55 0.18 162)'
              : 'oklch(0.25 0.04 240)',
            color: podeAvancar ? 'white' : 'oklch(0.40 0.01 240)',
            transition: 'background 0.25s ease, color 0.25s ease',
            cursor: podeAvancar ? 'pointer' : 'not-allowed',
          }}
        >
          Continuar
          <ChevronRight size={18} strokeWidth={2.5} />
        </button>
      </div>

      <style>{`
        @keyframes checkPop {
          0%   { transform: translateY(-50%) scale(0.3); opacity: 0; }
          100% { transform: translateY(-50%) scale(1);   opacity: 1; }
        }
      `}</style>
    </div>
  )
}
