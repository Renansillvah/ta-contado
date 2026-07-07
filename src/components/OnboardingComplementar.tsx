import { useState, useEffect } from 'react'
import { ChevronRight, ArrowLeft } from 'lucide-react'
import type { Desafio } from '@/components/OnboardingDesafio'

// ── Config por desafio ─────────────────────────────────────────────────────────
interface ConfigTela {
  titulo: (nome: string) => string
  subtitulo?: string
  opcoes: { value: string; label: string }[]
}

const CONFIG: Record<Desafio, ConfigTela> = {
  dividas: {
    titulo: nome => `Entendi, ${nome}.\n\nQuantas dívidas você tem aproximadamente?`,
    subtitulo: 'Não precisa ser exato. Vamos organizar isso juntos.',
    opcoes: [
      { value: '1_2', label: '1 a 2 dívidas' },
      { value: '3_5', label: '3 a 5 dívidas' },
      { value: 'mais_5', label: 'Mais de 5 dívidas' },
    ],
  },
  guardar_dinheiro: {
    titulo: () => 'Legal!\n\nO que você quer conquistar?',
    opcoes: [
      { value: 'reserva_emergencia', label: 'Reserva de emergência' },
      { value: 'moto', label: 'Comprar uma moto' },
      { value: 'carro', label: 'Comprar um carro' },
      { value: 'casa', label: 'Comprar uma casa' },
      { value: 'viagem', label: 'Fazer uma viagem' },
      { value: 'outro', label: 'Outro objetivo' },
    ],
  },
  nao_sei_gastos: {
    titulo: nome => `Entendo, ${nome}.\n\nComo você costuma lidar com seus gastos hoje?`,
    subtitulo: 'Sem julgamentos — só queremos entender seu ponto de partida.',
    opcoes: [
      { value: 'nao_anoto', label: 'Não anoto nada' },
      { value: 'as_vezes', label: 'Às vezes anoto, mas esqueço' },
      { value: 'planilha', label: 'Uso planilha, mas me perco' },
      { value: 'app', label: 'Já uso algum app, mas não funciona' },
    ],
  },
  renda_variavel: {
    titulo: nome => `Faz sentido, ${nome}.\n\nComo é sua fonte de renda hoje?`,
    subtitulo: 'Isso nos ajuda a criar um plano que se adapta ao seu ritmo.',
    opcoes: [
      { value: 'freela', label: 'Freelancer ou autônomo' },
      { value: 'comissao', label: 'Trabalho com comissão' },
      { value: 'varios', label: 'Tenho vários trabalhos' },
      { value: 'bicos', label: 'Faço bicos ou trabalho temporário' },
    ],
  },
  comprar_algo: {
    titulo: nome => `Ótimo objetivo, ${nome}!\n\nVocê já sabe o que quer comprar?`,
    subtitulo: 'Quanto mais específico, mais fácil de chegar lá.',
    opcoes: [
      { value: 'ja_sei', label: 'Sim, já tenho algo em mente' },
      { value: 'decidindo', label: 'Ainda estou decidindo' },
      { value: 'so_juntar', label: 'Quero juntar dinheiro primeiro' },
    ],
  },
}

// ── Componente ─────────────────────────────────────────────────────────────────
interface Props {
  nome: string
  desafio: Desafio
  onContinuar: (resposta: string) => void
  onVoltar: () => void
}

export default function OnboardingComplementar({ nome, desafio, onContinuar, onVoltar }: Props) {
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [visivel, setVisivel] = useState(false)
  const [saindo, setSaindo] = useState(false)

  const primeiro = nome.split(' ')[0]
  const config = CONFIG[desafio]

  // Divide o título em duas partes pelo \n\n
  const [parte1, parte2] = config.titulo(primeiro).split('\n\n')

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
      {/* Área com scroll */}
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
        {/* Progresso + voltar */}
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
                  background: i < 3 ? 'oklch(0.55 0.18 162)' : 'oklch(0.25 0.04 240)',
                  transition: 'background 0.3s ease',
                }}
              />
            ))}
          </div>
        </div>

        {/* Título em duas partes */}
        <p
          className="font-semibold mb-1 leading-snug"
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 16,
            color: 'oklch(0.58 0.01 240)',
          }}
        >
          {parte1}
        </p>
        <p
          className="font-black leading-tight mb-2"
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 24,
            color: 'var(--foreground)',
          }}
        >
          {parte2}
        </p>

        {/* Subtítulo auxiliar */}
        {config.subtitulo && (
          <p
            className="text-[13px] leading-relaxed mb-7"
            style={{ color: 'oklch(0.52 0.01 240)' }}
          >
            {config.subtitulo}
          </p>
        )}
        {!config.subtitulo && <div className="mb-7" />}

        {/* Opções */}
        <div className="flex flex-col gap-3">
          {config.opcoes.map(op => {
            const ativo = selecionado === op.value
            return (
              <button
                key={op.value}
                onClick={() => setSelecionado(op.value)}
                className="w-full text-left rounded-2xl px-4 py-3.5 transition-all active:scale-[0.97]"
                style={{
                  background: ativo ? 'oklch(0.48 0.16 162 / 14%)' : 'oklch(0.19 0.04 240)',
                  border: ativo
                    ? '2px solid oklch(0.55 0.18 162 / 65%)'
                    : '2px solid oklch(1 0 0 / 7%)',
                  transition: 'background 0.18s ease, border-color 0.18s ease, transform 0.1s ease',
                }}
              >
                <div className="flex items-center gap-3">
                  {/* Indicador circular */}
                  <div
                    className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{
                      border: ativo ? 'none' : '2px solid oklch(1 0 0 / 18%)',
                      background: ativo ? 'oklch(0.55 0.18 162)' : 'transparent',
                      transition: 'background 0.18s ease, border 0.18s ease',
                    }}
                  >
                    {ativo && (
                      <svg
                        width="10" height="8" viewBox="0 0 10 8" fill="none"
                        style={{ animation: 'checkIn 0.2s cubic-bezier(0.34,1.56,0.64,1)' }}
                      >
                        <path
                          d="M1 4l2.5 2.5L9 1"
                          stroke="white" strokeWidth="1.8"
                          strokeLinecap="round" strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                  <p
                    className="text-[14px] font-semibold leading-snug"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {op.label}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Botão rodapé */}
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
