import { useState, useEffect } from 'react'
import { CheckCircle2, Sparkles } from 'lucide-react'
import type { Desafio } from '@/components/OnboardingDesafio'

// ── Gerador de mensagem dinâmica ───────────────────────────────────────────────
function gerarMensagem(desafio: Desafio, resposta: string): string {
  if (desafio === 'dividas') {
    const qtd: Record<string, string> = {
      '1_2': 'organizar suas 2 dívidas',
      '3_5': 'organizar suas dívidas',
      'mais_5': 'organizar todas as suas dívidas',
    }
    return `Agora vou te ajudar a ${qtd[resposta] ?? 'organizar suas dívidas'}.`
  }

  if (desafio === 'guardar_dinheiro') {
    const meta: Record<string, string> = {
      reserva_emergencia: 'criar sua reserva de emergência',
      moto:    'guardar dinheiro para sua moto',
      carro:   'guardar dinheiro para seu carro',
      casa:    'guardar dinheiro para sua casa',
      viagem:  'guardar dinheiro para sua viagem',
      outro:   'conquistar seu objetivo',
    }
    return `Agora vou te ajudar a ${meta[resposta] ?? 'guardar dinheiro'}.`
  }

  if (desafio === 'nao_sei_gastos') {
    return 'Agora vou te ajudar a saber exatamente para onde vai o seu dinheiro.'
  }

  if (desafio === 'renda_variavel') {
    return 'Agora vou te ajudar a equilibrar suas finanças mesmo com renda variável.'
  }

  if (desafio === 'comprar_algo') {
    const foco: Record<string, string> = {
      ja_sei:     'chegar no que você quer comprar',
      decidindo:  'definir e conquistar seu objetivo',
      so_juntar:  'juntar o dinheiro que você precisa',
    }
    return `Agora vou te ajudar a ${foco[resposta] ?? 'chegar no seu objetivo'}.`
  }

  return 'Agora vou te ajudar a organizar melhor suas finanças.'
}

// ── Componente ─────────────────────────────────────────────────────────────────
interface Props {
  nome: string
  desafio: Desafio
  resposta: string
  onEntrar: () => void
}

export default function OnboardingConclusao({ nome, desafio, resposta, onEntrar }: Props) {
  const [visivel, setVisivel] = useState(false)
  const [saindo, setSaindo] = useState(false)

  const primeiro = nome.split(' ')[0]
  const mensagem = gerarMensagem(desafio, resposta)

  useEffect(() => {
    const t = setTimeout(() => setVisivel(true), 60)
    return () => clearTimeout(t)
  }, [])

  const handleEntrar = () => {
    setSaindo(true)
    setTimeout(onEntrar, 420)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col max-w-lg mx-auto"
      style={{ background: 'var(--background)' }}
    >
      <div className="flex-1 flex flex-col justify-center px-7">

        {/* Barra de progresso — completa */}
        <div
          className="flex gap-1.5 mb-12"
          style={{
            opacity: visivel ? 1 : 0,
            transition: 'opacity 0.4s ease',
          }}
        >
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className="h-1 rounded-full flex-1"
              style={{ background: 'oklch(0.55 0.18 162)' }}
            />
          ))}
        </div>

        {/* Ícone de conquista */}
        <div
          className="mb-8"
          style={{
            opacity: visivel ? 1 : 0,
            transform: visivel ? 'scale(1)' : 'scale(0.6)',
            transition: 'opacity 0.5s cubic-bezier(0.34,1.56,0.64,1), transform 0.5s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          <div className="relative w-20 h-20">
            {/* Anel externo pulsante */}
            <div
              className="absolute inset-0 rounded-3xl"
              style={{
                background: 'oklch(0.48 0.16 162 / 15%)',
                animation: visivel ? 'ringGlow 2.5s ease-in-out 0.4s infinite' : 'none',
              }}
            />
            {/* Badge principal */}
            <div
              className="relative w-20 h-20 rounded-3xl flex items-center justify-center"
              style={{
                background: 'oklch(0.48 0.16 162)',
                boxShadow: '0 16px 48px oklch(0.48 0.16 162 / 40%)',
              }}
            >
              <CheckCircle2 size={36} className="text-white" />
            </div>
            {/* Estrela decorativa */}
            <div
              className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full flex items-center justify-center"
              style={{
                background: 'oklch(0.78 0.15 88)',
                boxShadow: '0 4px 12px oklch(0.78 0.15 88 / 50%)',
                opacity: visivel ? 1 : 0,
                transform: visivel ? 'scale(1)' : 'scale(0)',
                transition: 'opacity 0.3s 0.35s ease, transform 0.35s 0.35s cubic-bezier(0.34,1.56,0.64,1)',
              }}
            >
              <Sparkles size={14} className="text-white" />
            </div>
          </div>
        </div>

        {/* Texto principal */}
        <div
          style={{
            opacity: visivel ? 1 : 0,
            transform: visivel ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.5s 0.15s ease, transform 0.5s 0.15s cubic-bezier(0.22,1,0.36,1)',
          }}
        >
          <p
            className="font-black leading-tight mb-1"
            style={{ fontFamily: 'Poppins, sans-serif', fontSize: 27, color: 'var(--foreground)' }}
          >
            Perfeito, {primeiro}!
          </p>
          <p
            className="font-semibold mb-1"
            style={{ fontFamily: 'Poppins, sans-serif', fontSize: 16, color: 'oklch(0.62 0.18 162)' }}
          >
            Criei seu perfil financeiro.
          </p>
          <p
            className="font-semibold leading-snug"
            style={{ fontFamily: 'Poppins, sans-serif', fontSize: 16, color: 'var(--foreground)' }}
          >
            {mensagem}
          </p>
        </div>

        {/* Divisor */}
        <div
          className="my-8 h-px w-full"
          style={{
            background: 'oklch(1 0 0 / 8%)',
            opacity: visivel ? 1 : 0,
            transition: 'opacity 0.4s 0.3s ease',
          }}
        />

        {/* Convite */}
        <div
          style={{
            opacity: visivel ? 1 : 0,
            transform: visivel ? 'translateY(0)' : 'translateY(16px)',
            transition: 'opacity 0.5s 0.35s ease, transform 0.5s 0.35s cubic-bezier(0.22,1,0.36,1)',
          }}
        >
          <div
            className="rounded-2xl p-4"
            style={{
              background: 'oklch(0.19 0.04 240)',
              border: '1px solid oklch(1 0 0 / 8%)',
            }}
          >
            <p
              className="font-bold text-[14px] mb-1"
              style={{ color: 'var(--foreground)' }}
            >
              Vamos começar com o mais simples.
            </p>
            <p
              className="text-[14px] leading-relaxed"
              style={{ color: 'oklch(0.58 0.01 240)' }}
            >
              Me conta um gasto de hoje.
            </p>
          </div>
        </div>
      </div>

      {/* Botão rodapé */}
      <div
        className="px-7 pb-10 pt-3 shrink-0"
        style={{
          opacity: saindo ? 0 : visivel ? 1 : 0,
          transition: saindo ? 'opacity 0.3s ease' : 'opacity 0.4s 0.45s ease',
        }}
      >
        <button
          onClick={handleEntrar}
          className="w-full py-4 rounded-2xl font-bold text-[16px] text-white flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
          style={{ background: 'oklch(0.55 0.18 162)' }}
        >
          Entrar no app
        </button>
      </div>

      <style>{`
        @keyframes ringGlow {
          0%, 100% { transform: scale(1);    opacity: 0.15; }
          50%       { transform: scale(1.12); opacity: 0.08; }
        }
      `}</style>
    </div>
  )
}
