import { useState } from 'react'
import { ChevronRight, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Props {
  nomeUsuario: string
  onConcluir: () => void
}

type Objetivo = 'organizar' | 'dividas' | 'economizar' | 'investir'
type Controle = 'gastos' | 'receitas' | 'tudo'

const OBJETIVOS: { value: Objetivo; emoji: string; label: string; desc: string }[] = [
  { value: 'organizar', emoji: '📋', label: 'Organizar gastos', desc: 'Saber para onde vai meu dinheiro' },
  { value: 'dividas', emoji: '💳', label: 'Sair das dívidas', desc: 'Quitar o que devo e respirar aliviado' },
  { value: 'economizar', emoji: '🎯', label: 'Economizar', desc: 'Juntar dinheiro todo mês' },
  { value: 'investir', emoji: '📈', label: 'Começar a investir', desc: 'Fazer o dinheiro trabalhar por mim' },
]

const CONTROLES: { value: Controle; emoji: string; label: string }[] = [
  { value: 'tudo', emoji: '🔄', label: 'Gastos e receitas' },
  { value: 'gastos', emoji: '💸', label: 'Só os gastos' },
  { value: 'receitas', emoji: '💰', label: 'Só as receitas' },
]

export default function OnboardingApp({ nomeUsuario, onConcluir }: Props) {
  const [passo, setPasso] = useState(1)
  const [objetivo, setObjetivo] = useState<Objetivo | null>(null)
  const [controle, setControle] = useState<Controle | null>(null)

  const primeiro = nomeUsuario.split(' ')[0]

  const avancar = async () => {
    if (passo < 3) {
      setPasso(p => p + 1)
      return
    }
    // Passo 3 — salvar preferências e concluir
    try {
      await supabase.auth.updateUser({
        data: {
          onboarding_done: true,
          objetivo,
          controle,
        },
      })
    } catch {
      // silencia erro de metadata — não bloqueia o fluxo
    }
    onConcluir()
  }

  const podeAvancar =
    (passo === 1 && objetivo !== null) ||
    (passo === 2 && controle !== null) ||
    passo === 3

  const totalPassos = 3

  return (
    <div className="fixed inset-0 z-50 flex flex-col max-w-lg mx-auto bg-background">
      {/* Barra de progresso */}
      <div className="px-6 pt-6 pb-0">
        <div className="flex items-center gap-1.5 mb-6">
          {Array.from({ length: totalPassos }).map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full transition-all duration-400"
              style={{
                background: i < passo ? 'oklch(0.55 0.18 162)' : 'oklch(0.25 0.04 240)',
              }}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground font-medium">Passo {passo} de {totalPassos}</p>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto px-6 py-6">

        {/* PASSO 1 — Objetivo */}
        {passo === 1 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-2xl font-black text-foreground mb-1">
              Olá, {primeiro}! 👋
            </h2>
            <p className="text-muted-foreground text-[15px] mb-6 leading-relaxed">
              Qual é o seu principal objetivo financeiro agora?
            </p>
            <div className="space-y-2.5">
              {OBJETIVOS.map(o => (
                <button
                  key={o.value}
                  onClick={() => setObjetivo(o.value)}
                  className="w-full flex items-center gap-4 rounded-2xl p-4 text-left transition-all active:scale-[0.98]"
                  style={{
                    background: objetivo === o.value ? 'oklch(0.48 0.16 162 / 15%)' : 'oklch(0.19 0.04 240)',
                    border: objetivo === o.value
                      ? '2px solid oklch(0.55 0.18 162 / 60%)'
                      : '2px solid oklch(1 0 0 / 6%)',
                  }}
                >
                  <span className="text-2xl shrink-0">{o.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[14px] text-foreground">{o.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{o.desc}</p>
                  </div>
                  {objetivo === o.value && (
                    <CheckCircle2 size={18} className="text-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PASSO 2 — O que controlar */}
        {passo === 2 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-2xl font-black text-foreground mb-1">Como vai usar?</h2>
            <p className="text-muted-foreground text-[15px] mb-6 leading-relaxed">
              O que você quer controlar primeiro?
            </p>
            <div className="space-y-2.5">
              {CONTROLES.map(c => (
                <button
                  key={c.value}
                  onClick={() => setControle(c.value)}
                  className="w-full flex items-center gap-4 rounded-2xl p-4 text-left transition-all active:scale-[0.98]"
                  style={{
                    background: controle === c.value ? 'oklch(0.48 0.16 162 / 15%)' : 'oklch(0.19 0.04 240)',
                    border: controle === c.value
                      ? '2px solid oklch(0.55 0.18 162 / 60%)'
                      : '2px solid oklch(1 0 0 / 6%)',
                  }}
                >
                  <span className="text-2xl shrink-0">{c.emoji}</span>
                  <p className="flex-1 font-semibold text-[14px] text-foreground">{c.label}</p>
                  {controle === c.value && (
                    <CheckCircle2 size={18} className="text-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PASSO 3 — Pronto */}
        {passo === 3 && (
          <div className="animate-in fade-in zoom-in-95 duration-400 flex flex-col items-center text-center py-8">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-xl"
              style={{
                background: 'oklch(0.48 0.16 162)',
                boxShadow: '0 8px 32px oklch(0.48 0.16 162 / 40%)',
              }}
            >
              <CheckCircle2 size={36} className="text-white" />
            </div>
            <h2 className="text-2xl font-black text-foreground mb-2">
              Tudo pronto, {primeiro}!
            </h2>
            <p className="text-muted-foreground text-[15px] leading-relaxed max-w-xs">
              Seu Tá Contado está configurado. Vamos começar registrando seu primeiro lançamento?
            </p>

            {/* Dica de uso */}
            <div
              className="mt-8 w-full rounded-2xl p-4 text-left"
              style={{ background: 'oklch(0.19 0.04 240)', border: '1px solid oklch(1 0 0 / 8%)' }}
            >
              <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">Dica rápida</p>
              <p className="text-[13px] text-foreground leading-relaxed">
                Use o <strong className="text-primary">Chat</strong> para registrar qualquer coisa com texto livre:
              </p>
              <div className="mt-2 space-y-1">
                {['"Almoço 25 reais"', '"Recebi 3000 de freela"', '"Devo 500 no Nubank"'].map(ex => (
                  <p key={ex} className="text-xs text-muted-foreground font-mono">{ex}</p>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Botão avançar */}
      <div className="px-6 pb-10 pt-4 shrink-0">
        <button
          onClick={avancar}
          disabled={!podeAvancar}
          className="w-full py-4 rounded-2xl font-bold text-[15px] text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-40"
          style={{ backgroundColor: 'oklch(0.55 0.18 162)' }}
        >
          {passo === totalPassos ? 'Entrar no app' : 'Continuar'}
          {passo < totalPassos && <ChevronRight size={18} />}
        </button>
      </div>
    </div>
  )
}
