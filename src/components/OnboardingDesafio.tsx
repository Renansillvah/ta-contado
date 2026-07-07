import { useState, useEffect } from 'react'
import { ChevronRight, ArrowLeft } from 'lucide-react'

export type Desafio =
  | 'dividas'
  | 'nao_sei_gastos'
  | 'renda_variavel'
  | 'guardar_dinheiro'
  | 'comprar_algo'

const OPCOES: { value: Desafio; label: string; desc: string }[] = [
  {
    value: 'dividas',
    label: 'Tenho dívidas que não consigo controlar',
    desc: 'Quero organizar e quitar o que devo',
  },
  {
    value: 'nao_sei_gastos',
    label: 'Não sei quanto gasto por mês',
    desc: 'Perco o controle dos meus gastos',
  },
  {
    value: 'renda_variavel',
    label: 'Minha renda varia e me perco',
    desc: 'Mês bom, mês ruim — preciso equilibrar',
  },
  {
    value: 'guardar_dinheiro',
    label: 'Quero guardar dinheiro',
    desc: 'Criar reserva ou juntar para um objetivo',
  },
  {
    value: 'comprar_algo',
    label: 'Quero comprar algo específico',
    desc: 'Tenho uma meta e quero chegar lá',
  },
]

interface Props {
  nome: string
  onContinuar: (desafio: Desafio) => void
  onVoltar: () => void
}

export default function OnboardingDesafio({ nome, onContinuar, onVoltar }: Props) {
  const [selecionado, setSelecionado] = useState<Desafio | null>(null)
  const [visivel, setVisivel] = useState(false)
  const [saindo, setSaindo] = useState(false)

  const primeiro = nome.split(' ')[0]

  useEffect(() => {
    const t = setTimeout(() => setVisivel(true), 60)
    return () => clearTimeout(t)
  }, [])

  const handleContinuar = () => {
    if (!selecionado) return
    setSaindo(true)
    setTimeout(() => onContinuar(selecionado), 360)
  }

  const handleVoltar = () => {
    setSaindo(true)
    setTimeout(onVoltar, 360)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col max-w-lg mx-auto"
      style={{ background: 'var(--background)' }}
    >
      {/* Conteúdo com scroll */}
      <div
        className="flex-1 overflow-y-auto flex flex-col px-7 pt-8 pb-4"
        style={{
          opacity: saindo ? 0 : visivel ? 1 : 0,
          transform: saindo
            ? 'translateX(-28px)'
            : visivel
            ? 'translateX(0)'
            : 'translateX(28px)',
          transition: saindo
            ? 'opacity 0.32s ease-in, transform 0.32s ease-in'
            : 'opacity 0.42s cubic-bezier(0.22,1,0.36,1), transform 0.42s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        {/* Barra de progresso + voltar */}
        <div className="flex items-center gap-3 mb-10">
          <button
            onClick={handleVoltar}
            className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-opacity hover:opacity-80 active:opacity-50"
            style={{ background: 'oklch(0.22 0.04 240)' }}
            aria-label="Voltar"
          >
            <ArrowLeft size={16} style={{ color: 'oklch(0.58 0.01 240)' }} />
          </button>
          <div className="flex gap-1.5 flex-1">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className="h-1 rounded-full flex-1"
                style={{
                  background:
                    i < 2
                      ? 'oklch(0.55 0.18 162)'
                      : 'oklch(0.25 0.04 240)',
                  transition: 'background 0.3s ease',
                }}
              />
            ))}
          </div>
        </div>

        {/* Saudação personalizada */}
        <p
          className="font-black leading-tight mb-1"
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 27,
            color: 'var(--foreground)',
          }}
        >
          Olá, {primeiro}!
        </p>
        <p
          className="font-semibold mb-7 leading-snug"
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 20,
            color: 'var(--foreground)',
          }}
        >
          Qual é seu maior desafio financeiro agora?
        </p>

        {/* Opções */}
        <div className="flex flex-col gap-3">
          {OPCOES.map(op => {
            const ativo = selecionado === op.value
            return (
              <button
                key={op.value}
                onClick={() => setSelecionado(op.value)}
                className="w-full text-left rounded-2xl p-4 transition-all active:scale-[0.97]"
                style={{
                  background: ativo
                    ? 'oklch(0.48 0.16 162 / 14%)'
                    : 'oklch(0.19 0.04 240)',
                  border: ativo
                    ? '2px solid oklch(0.55 0.18 162 / 65%)'
                    : '2px solid oklch(1 0 0 / 7%)',
                  transition: 'background 0.18s ease, border-color 0.18s ease, transform 0.1s ease',
                }}
              >
                <div className="flex items-center gap-3">
                  {/* Indicador de seleção */}
                  <div
                    className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{
                      border: ativo
                        ? 'none'
                        : '2px solid oklch(1 0 0 / 18%)',
                      background: ativo ? 'oklch(0.55 0.18 162)' : 'transparent',
                      transition: 'background 0.18s ease, border 0.18s ease',
                    }}
                  >
                    {ativo && (
                      <svg
                        width="10"
                        height="8"
                        viewBox="0 0 10 8"
                        fill="none"
                        style={{ animation: 'checkIn 0.2s cubic-bezier(0.34,1.56,0.64,1)' }}
                      >
                        <path
                          d="M1 4l2.5 2.5L9 1"
                          stroke="white"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[14px] font-semibold leading-snug"
                      style={{ color: ativo ? 'var(--foreground)' : 'var(--foreground)' }}
                    >
                      {op.label}
                    </p>
                    <p
                      className="text-[12px] mt-0.5 leading-relaxed"
                      style={{ color: 'oklch(0.58 0.01 240)' }}
                    >
                      {op.desc}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
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
          disabled={!selecionado}
          className="w-full py-4 rounded-2xl font-bold text-[16px] flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
          style={{
            background: selecionado ? 'oklch(0.55 0.18 162)' : 'oklch(0.25 0.04 240)',
            color: selecionado ? 'white' : 'oklch(0.40 0.01 240)',
            transition: 'background 0.25s ease, color 0.25s ease',
            cursor: selecionado ? 'pointer' : 'not-allowed',
          }}
        >
          Continuar
          <ChevronRight size={18} strokeWidth={2.5} />
        </button>
      </div>

      <style>{`
        @keyframes checkIn {
          0%   { transform: scale(0) rotate(-10deg); opacity: 0; }
          100% { transform: scale(1) rotate(0deg);   opacity: 1; }
        }
      `}</style>
    </div>
  )
}
