import { useState, useRef, useEffect } from 'react'
import { ChevronRight, CheckCircle2, DollarSign, Sparkles, Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { gerarBoasVindasIA } from '@/lib/openai'

interface Props {
  nomeUsuario: string
  onConcluir: (inputInicial?: string) => void
}

type Objetivo = 'organizar' | 'dividas' | 'economizar' | 'investir'

const OBJETIVOS: { value: Objetivo; emoji: string; label: string; desc: string }[] = [
  { value: 'organizar', emoji: '📋', label: 'Organizar gastos', desc: 'Saber para onde vai meu dinheiro' },
  { value: 'dividas', emoji: '💳', label: 'Sair das dívidas', desc: 'Quitar o que devo e respirar aliviado' },
  { value: 'economizar', emoji: '🎯', label: 'Economizar', desc: 'Juntar dinheiro todo mês' },
  { value: 'investir', emoji: '📈', label: 'Começar a investir', desc: 'Fazer o dinheiro trabalhar por mim' },
]

const FAIXAS_RENDA = [
  { label: 'Até R$ 1.500', value: 1500 },
  { label: 'R$ 1.500 – R$ 3.000', value: 3000 },
  { label: 'R$ 3.000 – R$ 6.000', value: 6000 },
  { label: 'Acima de R$ 6.000', value: 8000 },
]

const FRASES_LOADING = [
  'Analisando seu perfil financeiro...',
  'Preparando seu plano personalizado...',
  'Calculando suas metas...',
  'Quase pronto...',
]

const ACOES_RAPIDAS = [
  { label: 'Registrar um gasto', input: 'Almoço ' },
  { label: 'Tenho uma dívida', input: 'Devo ' },
  { label: 'Recebi dinheiro', input: 'Recebi ' },
]

export default function OnboardingApp({ nomeUsuario, onConcluir }: Props) {
  const [passo, setPasso] = useState(1)
  const [objetivo, setObjetivo] = useState<Objetivo | null>(null)
  const [renda, setRenda] = useState<number | null>(null)
  const inputRendaRef = useRef<HTMLInputElement>(null)
  const [rendaCustom, setRendaCustom] = useState('')
  const [usandoCustom, setUsandoCustom] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [fraseIdx, setFraseIdx] = useState(0)
  const [iaGerada, setIaGerada] = useState(false)
  const [saindo, setSaindo] = useState(false)

  const primeiro = nomeUsuario.split(' ')[0]
  const totalPassos = 3

  useEffect(() => {
    if (!gerando) return
    const id = setInterval(() => {
      setFraseIdx(i => (i + 1) % FRASES_LOADING.length)
    }, 1200)
    return () => clearInterval(id)
  }, [gerando])

  // Quando chega ao passo 3, dispara a geração de IA em background
  useEffect(() => {
    if (passo !== 3 || iaGerada) return

    const rendaFinal = usandoCustom ? (parseFloat(rendaCustom.replace(',', '.')) || 0) : (renda ?? 0)

    setGerando(true)
    gerarBoasVindasIA({
      nome: primeiro,
      objetivo: objetivo ?? '',
      renda: rendaFinal,
      controle: 'tudo',
    })
      .then(msg => {
        if (msg) localStorage.setItem('onboarding_msg_ia', msg)
      })
      .catch(() => {})
      .finally(() => {
        setGerando(false)
        setIaGerada(true)
      })
  }, [passo]) // eslint-disable-line react-hooks/exhaustive-deps

  const concluir = async (inputInicial?: string) => {
    setSaindo(true)
    const rendaFinal = usandoCustom ? (parseFloat(rendaCustom.replace(',', '.')) || 0) : (renda ?? 0)
    try {
      await supabase.auth.updateUser({
        data: { onboarding_done: true, objetivo, controle: 'tudo', renda_mensal: rendaFinal },
      })
    } catch {}
    localStorage.setItem('onboarding_renda', String(rendaFinal))
    localStorage.setItem('onboarding_objetivo', objetivo ?? '')
    localStorage.setItem('onboarding_controle', 'tudo')
    setTimeout(() => onConcluir(inputInicial), 300)
  }

  const avancar = async () => {
    if (passo < totalPassos) {
      setPasso(p => p + 1)
      return
    }
    await concluir()
  }

  const podeAvancar =
    (passo === 1 && objetivo !== null) ||
    (passo === 2 && (renda !== null || (usandoCustom && rendaCustom.trim() !== ''))) ||
    passo === 3

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col max-w-lg mx-auto bg-background transition-opacity duration-300"
      style={{ opacity: saindo ? 0 : 1 }}
    >
      {/* Barra de progresso */}
      <div className="px-6 pt-6 pb-0">
        <div className="flex items-center gap-1.5 mb-6">
          {Array.from({ length: totalPassos }).map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full transition-all duration-400"
              style={{ background: i < passo ? 'oklch(0.55 0.18 162)' : 'oklch(0.25 0.04 240)' }}
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

        {/* PASSO 2 — Renda mensal */}
        {passo === 2 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'oklch(0.48 0.16 162 / 20%)' }}
            >
              <DollarSign size={22} className="text-primary" />
            </div>
            <h2 className="text-2xl font-black text-foreground mb-1">Sua renda mensal</h2>
            <p className="text-muted-foreground text-[15px] mb-6 leading-relaxed">
              Isso nos ajuda a criar um plano financeiro personalizado pra você.
            </p>
            <div className="space-y-2.5">
              {FAIXAS_RENDA.map(f => (
                <button
                  key={f.value}
                  onClick={() => { setRenda(f.value); setUsandoCustom(false) }}
                  className="w-full flex items-center gap-4 rounded-2xl p-4 text-left transition-all active:scale-[0.98]"
                  style={{
                    background: renda === f.value && !usandoCustom ? 'oklch(0.48 0.16 162 / 15%)' : 'oklch(0.19 0.04 240)',
                    border: renda === f.value && !usandoCustom
                      ? '2px solid oklch(0.55 0.18 162 / 60%)'
                      : '2px solid oklch(1 0 0 / 6%)',
                  }}
                >
                  <p className="flex-1 font-semibold text-[14px] text-foreground">{f.label}</p>
                  {renda === f.value && !usandoCustom && (
                    <CheckCircle2 size={18} className="text-primary shrink-0" />
                  )}
                </button>
              ))}
              <button
                onClick={() => { setUsandoCustom(true); setRenda(null); setTimeout(() => inputRendaRef.current?.focus(), 50) }}
                className="w-full flex items-center gap-4 rounded-2xl p-4 text-left transition-all active:scale-[0.98]"
                style={{
                  background: usandoCustom ? 'oklch(0.48 0.16 162 / 15%)' : 'oklch(0.19 0.04 240)',
                  border: usandoCustom
                    ? '2px solid oklch(0.55 0.18 162 / 60%)'
                    : '2px solid oklch(1 0 0 / 6%)',
                }}
              >
                <p className="flex-1 font-semibold text-[14px] text-foreground">Outro valor</p>
                {usandoCustom && <CheckCircle2 size={18} className="text-primary shrink-0" />}
              </button>
              {usandoCustom && (
                <div className="mt-1">
                  <input
                    ref={inputRendaRef}
                    type="number"
                    placeholder="Ex: 2500"
                    value={rendaCustom}
                    onChange={e => setRendaCustom(e.target.value)}
                    className="w-full bg-secondary text-foreground placeholder:text-muted-foreground rounded-2xl px-4 py-3.5 text-sm outline-none border border-border focus:border-primary transition-colors"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* PASSO 3 — Pronto + IA gerando + ações rápidas */}
        {passo === 3 && (
          <div className="animate-in fade-in zoom-in-95 duration-400 flex flex-col items-center text-center py-8">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-xl relative"
              style={{
                background: 'oklch(0.48 0.16 162)',
                boxShadow: '0 8px 32px oklch(0.48 0.16 162 / 40%)',
              }}
            >
              <CheckCircle2 size={36} className="text-white" />
              {gerando && (
                <div
                  className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center animate-pulse"
                  style={{ background: 'oklch(0.65 0.20 60)' }}
                >
                  <Sparkles size={12} className="text-white" />
                </div>
              )}
            </div>

            <h2 className="text-2xl font-black text-foreground mb-2">
              Tudo pronto, {primeiro}!
            </h2>

            {gerando ? (
              <div className="flex flex-col items-center gap-3 mt-2">
                <p className="text-muted-foreground text-[15px] leading-relaxed max-w-xs">
                  {FRASES_LOADING[fraseIdx]}
                </p>
                <div className="flex gap-1.5 mt-1">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor: 'oklch(0.55 0.18 162)',
                        animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-[15px] leading-relaxed max-w-xs">
                Seu plano financeiro personalizado está pronto. Por onde quer começar?
              </p>
            )}

            {/* Ações rápidas — aparecem após IA gerar */}
            {!gerando && (
              <div className="mt-8 w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 text-left">
                  Primeiro passo rápido
                </p>
                <div className="flex flex-col gap-2">
                  {ACOES_RAPIDAS.map(acao => (
                    <button
                      key={acao.label}
                      onClick={() => concluir(acao.input)}
                      className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-all active:scale-[0.98]"
                      style={{
                        background: 'oklch(0.48 0.16 162 / 10%)',
                        border: '1.5px solid oklch(0.55 0.18 162 / 30%)',
                      }}
                    >
                      <Zap size={15} className="text-primary shrink-0" />
                      <span className="text-[14px] font-semibold text-foreground">{acao.label}</span>
                      <ChevronRight size={15} className="text-muted-foreground ml-auto shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Card assessor */}
            {!gerando && (
              <div
                className="mt-4 w-full rounded-2xl p-4 text-left animate-in fade-in duration-700"
                style={{ background: 'oklch(0.19 0.04 240)', border: '1px solid oklch(1 0 0 / 8%)' }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={13} className="text-primary" />
                  <p className="text-xs font-bold text-primary uppercase tracking-wider">Seu assessor financeiro está pronto</p>
                </div>
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  Abra o <strong className="text-foreground">Chat</strong> para ver sua análise e começar a registrar no seu ritmo.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Botão avançar — só aparece nos passos 1 e 2, e no passo 3 se ainda carregando */}
      {(passo < totalPassos || gerando) && (
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
      )}

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
