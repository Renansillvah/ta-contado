import { useState, useEffect, useRef } from 'react'
import { ChevronRight, CheckCircle2, ArrowLeft, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Props {
  nomeUsuario: string
  onConcluir: (inputInicial?: string) => void
}

// ── Tipos ──────────────────────────────────────────────────────────────────────
type Desafio =
  | 'dividas'
  | 'nao_sei_gastos'
  | 'renda_variavel'
  | 'guardar_dinheiro'
  | 'comprar_algo'

type RespostaComplementar = string

// ── Constantes ─────────────────────────────────────────────────────────────────
const DESAFIOS: { value: Desafio; label: string; desc: string }[] = [
  { value: 'dividas', label: 'Tenho dívidas que não consigo controlar', desc: 'Quero organizar e quitar o que devo' },
  { value: 'nao_sei_gastos', label: 'Não sei quanto gasto por mês', desc: 'Perco o controle dos meus gastos' },
  { value: 'renda_variavel', label: 'Minha renda varia e me perco', desc: 'Mês bom, mês ruim — preciso equilibrar' },
  { value: 'guardar_dinheiro', label: 'Quero guardar dinheiro', desc: 'Criar reserva ou juntar para um objetivo' },
  { value: 'comprar_algo', label: 'Quero comprar algo específico', desc: 'Tenho uma meta e quero chegar lá' },
]

const OPCOES_DIVIDAS = [
  { value: '1_2', label: '1 a 2 dívidas' },
  { value: '3_5', label: '3 a 5 dívidas' },
  { value: 'mais_5', label: 'Mais de 5 dívidas' },
]

const OPCOES_GUARDAR = [
  { value: 'reserva_emergencia', label: 'Reserva de emergência' },
  { value: 'moto', label: 'Comprar uma moto' },
  { value: 'carro', label: 'Comprar um carro' },
  { value: 'casa', label: 'Comprar uma casa' },
  { value: 'viagem', label: 'Fazer uma viagem' },
  { value: 'outro', label: 'Outro objetivo' },
]

const OPCOES_GASTOS = [
  { value: 'nao_anoto', label: 'Não anoto nada' },
  { value: 'as_vezes', label: 'Às vezes anoto' },
  { value: 'planilha', label: 'Uso planilha mas me perco' },
]

const OPCOES_RENDA = [
  { value: 'freela', label: 'Sou freelancer / autônomo' },
  { value: 'comissao', label: 'Trabalho com comissão' },
  { value: 'varios_trabalhos', label: 'Tenho vários trabalhos' },
  { value: 'temporario', label: 'Trabalho temporário / bicos' },
]

const OPCOES_COMPRAR = [
  { value: 'ja_sei_oque', label: 'Já sei o que quero' },
  { value: 'ainda_pensando', label: 'Ainda estou decidindo' },
  { value: 'sem_prioridade', label: 'Quero ver opções' },
]

// ── Helpers ────────────────────────────────────────────────────────────────────
function getPergunta3(desafio: Desafio | null, nome: string): { titulo: string; subtitulo?: string; opcoes: { value: string; label: string }[] } {
  switch (desafio) {
    case 'dividas':
      return {
        titulo: `Entendi, ${nome}.\n\nQuantas dívidas você tem aproximadamente?`,
        subtitulo: 'Não precisa ser exato. Vamos organizar isso juntos.',
        opcoes: OPCOES_DIVIDAS,
      }
    case 'guardar_dinheiro':
      return {
        titulo: `Legal!\n\nO que você quer conquistar?`,
        opcoes: OPCOES_GUARDAR,
      }
    case 'nao_sei_gastos':
      return {
        titulo: `Entendo, ${nome}.\n\nComo você costuma controlar seus gastos hoje?`,
        opcoes: OPCOES_GASTOS,
      }
    case 'renda_variavel':
      return {
        titulo: `Faz sentido!\n\nComo é sua renda atualmente?`,
        opcoes: OPCOES_RENDA,
      }
    case 'comprar_algo':
      return {
        titulo: `Ótimo objetivo!\n\nVocê já tem algo em mente?`,
        opcoes: OPCOES_COMPRAR,
      }
    default:
      return {
        titulo: `Conta mais para mim, ${nome}.`,
        opcoes: [],
      }
  }
}

function getMensagemFinal(nome: string, desafio: Desafio | null, resposta: RespostaComplementar): string {
  if (desafio === 'dividas') {
    return `Agora vou te ajudar a organizar suas dívidas.`
  }
  if (desafio === 'guardar_dinheiro') {
    const metas: Record<string, string> = {
      reserva_emergencia: 'criar sua reserva de emergência',
      moto: 'guardar dinheiro para sua moto',
      carro: 'guardar dinheiro para seu carro',
      casa: 'guardar dinheiro para sua casa',
      viagem: 'guardar dinheiro para sua viagem',
      outro: 'conquistar seu objetivo',
    }
    return `Agora vou te ajudar a ${metas[resposta] || 'guardar dinheiro'}.`
  }
  if (desafio === 'nao_sei_gastos') {
    return `Agora vou te ajudar a saber exatamente para onde vai seu dinheiro.`
  }
  if (desafio === 'renda_variavel') {
    return `Agora vou te ajudar a equilibrar suas finanças mesmo com renda variável.`
  }
  if (desafio === 'comprar_algo') {
    return `Agora vou te ajudar a chegar no seu objetivo.`
  }
  return `Agora vou te ajudar a organizar melhor suas finanças.`
}

// ── Splash Screen ──────────────────────────────────────────────────────────────
function SplashScreen({ onFinalizar }: { onFinalizar: () => void }) {
  const [saindo, setSaindo] = useState(false)
  const [numeros, setNumeros] = useState<{ id: number; valor: string; x: number; y: number; opacity: number; scale: number }[]>([])

  useEffect(() => {
    // Gera partículas de números flutuantes
    const vals = ['R$', '12%', '100', '↑', '↓', 'R$', '50', '3x', '$', '%', '200', '✓']
    const items = Array.from({ length: 14 }, (_, i) => ({
      id: i,
      valor: vals[i % vals.length],
      x: Math.random() * 85 + 5,
      y: Math.random() * 80 + 5,
      opacity: 0.06 + Math.random() * 0.10,
      scale: 0.7 + Math.random() * 0.8,
    }))
    setNumeros(items)

    // Timer 3s → transição de saída
    const timer = setTimeout(() => handleSair(), 3000)
    return () => clearTimeout(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSair = () => {
    setSaindo(true)
    setTimeout(onFinalizar, 400)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center max-w-lg mx-auto overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #0a1628 0%, #0d2452 55%, #0f2d6b 100%)',
        opacity: saindo ? 0 : 1,
        transition: 'opacity 0.4s ease-out',
      }}
    >
      {/* Partículas de números flutuando */}
      {numeros.map(n => (
        <span
          key={n.id}
          className="absolute font-bold select-none pointer-events-none font-display"
          style={{
            left: `${n.x}%`,
            top: `${n.y}%`,
            opacity: n.opacity,
            scale: String(n.scale),
            color: 'oklch(0.62 0.18 162)',
            fontSize: `${14 + n.scale * 10}px`,
            animation: `floatNum ${3 + n.scale * 2}s ease-in-out ${n.id * 0.3}s infinite alternate`,
          }}
        >
          {n.valor}
        </span>
      ))}

      {/* Anel externo pulsante */}
      <div
        className="absolute rounded-full"
        style={{
          width: 180,
          height: 180,
          border: '1.5px solid oklch(0.62 0.18 162 / 18%)',
          animation: 'pulsRing 2.5s ease-in-out infinite',
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 140,
          height: 140,
          border: '1px solid oklch(0.62 0.18 162 / 12%)',
          animation: 'pulsRing 2.5s ease-in-out 0.4s infinite',
        }}
      />

      {/* Logo TC */}
      <div
        className="relative z-10 w-24 h-24 rounded-3xl flex items-center justify-center mb-6 shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, #1a3a8f 0%, #2563eb 100%)',
          boxShadow: '0 20px 60px rgba(37,99,235,0.4)',
          animation: 'logoEntrada 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards',
        }}
      >
        <span className="text-white font-black text-3xl font-display">TC</span>
      </div>

      {/* Textos */}
      <div
        className="z-10 text-center"
        style={{ animation: 'fadeSlide 0.7s 0.2s ease-out both' }}
      >
        <h1 className="text-3xl font-black text-white font-display tracking-tight mb-1">
          Tá Contado
        </h1>
        <p className="text-base font-medium" style={{ color: 'oklch(0.62 0.18 162)' }}>
          Seu assessor financeiro pessoal.
        </p>
      </div>

      {/* Botão pular */}
      <button
        onClick={handleSair}
        className="absolute bottom-10 z-10 text-sm font-medium transition-opacity hover:opacity-100"
        style={{ color: 'oklch(0.58 0.01 240)', opacity: 0.7 }}
      >
        Pular
      </button>

      {/* Indicador de carregamento */}
      <div
        className="absolute bottom-[72px] z-10 flex gap-1.5"
        style={{ animation: 'fadeSlide 0.5s 0.8s ease-out both', opacity: 0 }}
      >
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: 'oklch(0.62 0.18 162 / 60%)',
              animation: `dotPulse 1.4s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes floatNum {
          0% { transform: translateY(0px) rotate(-3deg); }
          100% { transform: translateY(-14px) rotate(3deg); }
        }
        @keyframes pulsRing {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.06); opacity: 0.5; }
        }
        @keyframes logoEntrada {
          0% { transform: scale(0.5) rotate(-8deg); opacity: 0; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes fadeSlide {
          0% { transform: translateY(16px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes dotPulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.4); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function OnboardingApp({ nomeUsuario: nomeInicial, onConcluir }: Props) {
  const [fase, setFase] = useState<'splash' | 'onboarding'>('splash')

  // Passo dentro do onboarding (1–4)
  const [passo, setPasso] = useState(1)
  const [saindo, setSaindo] = useState(false)
  const [entrando, setEntrando] = useState(false)

  // Respostas
  const [nome, setNome] = useState(nomeInicial && nomeInicial !== 'você' ? nomeInicial : '')
  const [desafio, setDesafio] = useState<Desafio | null>(null)
  const [respostaCompl, setRespostaCompl] = useState<RespostaComplementar>('')

  const nomeInputRef = useRef<HTMLInputElement>(null)

  const primeiro = nome ? nome.trim().split(' ')[0] : 'você'

  // Foca o input de nome ao entrar no passo 1
  useEffect(() => {
    if (fase === 'onboarding' && passo === 1) {
      setTimeout(() => nomeInputRef.current?.focus(), 300)
    }
  }, [fase, passo])

  const irParaPasso = (p: number) => {
    setEntrando(true)
    setTimeout(() => {
      setPasso(p)
      setEntrando(false)
    }, 200)
  }

  const avancar = () => {
    if (passo < 4) irParaPasso(passo + 1)
  }

  const voltar = () => {
    if (passo > 1) irParaPasso(passo - 1)
  }

  const concluir = async () => {
    setSaindo(true)
    try {
      await supabase.auth.updateUser({
        data: {
          onboarding_done: true,
          onboarding_nome: nome.trim(),
          onboarding_desafio: desafio,
          onboarding_resposta_compl: respostaCompl,
          onboarding_data: new Date().toISOString(),
          full_name: nome.trim() || undefined,
        },
      })
    } catch {}
    localStorage.setItem('onboarding_done', '1')
    localStorage.setItem('onboarding_nome', nome.trim())
    localStorage.setItem('onboarding_objetivo', desafio ?? '')
    localStorage.setItem('onboarding_controle', respostaCompl)
    localStorage.setItem('onboarding_data', new Date().toISOString())
    if (nome.trim()) localStorage.setItem('user_name', nome.trim())
    setTimeout(() => onConcluir(), 350)
  }

  const podeAvancar = () => {
    if (passo === 1) return nome.trim().length >= 2
    if (passo === 2) return desafio !== null
    if (passo === 3) return respostaCompl !== ''
    return true
  }

  // ── Splash ──────────────────────────────────────────────────────────────────
  if (fase === 'splash') {
    return <SplashScreen onFinalizar={() => setFase('onboarding')} />
  }

  // ── Pergunta complementar (passo 3) ─────────────────────────────────────────
  const pergunta3 = getPergunta3(desafio, primeiro)

  // ── Mensagem de fechamento (passo 4) ─────────────────────────────────────────
  const msgFinal = getMensagemFinal(primeiro, desafio, respostaCompl)

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col max-w-lg mx-auto bg-background"
      style={{
        opacity: saindo ? 0 : 1,
        transition: 'opacity 0.35s ease-out',
      }}
    >
      {/* Barra de progresso */}
      <div className="px-6 pt-8 pb-0 shrink-0">
        <div className="flex items-center gap-1.5 mb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full"
              style={{
                background: i < passo ? 'oklch(0.55 0.18 162)' : 'oklch(0.25 0.04 240)',
                transition: 'background 0.4s ease',
              }}
            />
          ))}
        </div>
      </div>

      {/* Botão voltar */}
      {passo > 1 && (
        <div className="px-5 pt-3 shrink-0">
          <button
            onClick={voltar}
            className="flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80 active:opacity-60"
            style={{ color: 'oklch(0.58 0.01 240)' }}
          >
            <ArrowLeft size={16} />
            Voltar
          </button>
        </div>
      )}

      {/* Conteúdo */}
      <div
        className="flex-1 overflow-y-auto px-6 py-6"
        style={{
          opacity: entrando ? 0 : 1,
          transform: entrando ? 'translateX(20px)' : 'translateX(0)',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
        }}
      >
        {/* ── PASSO 1 — Nome ── */}
        {passo === 1 && (
          <div>
            <div className="mb-8">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: 'linear-gradient(135deg, #1a3a8f 0%, #2563eb 100%)' }}
              >
                <span className="text-white font-black text-xl font-display">TC</span>
              </div>
              <h2 className="text-[26px] font-black text-foreground font-display leading-tight mb-2">
                Oi! Como posso te chamar? 👋
              </h2>
              <p className="text-[15px] leading-relaxed" style={{ color: 'oklch(0.58 0.01 240)' }}>
                Quero te conhecer melhor para tornar sua experiência mais pessoal.
              </p>
            </div>

            <div className="space-y-3">
              <input
                ref={nomeInputRef}
                type="text"
                placeholder="Digite seu nome..."
                value={nome}
                onChange={e => setNome(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && podeAvancar() && avancar()}
                className="w-full rounded-2xl px-4 py-4 text-[16px] font-medium outline-none border transition-all"
                style={{
                  background: 'oklch(0.19 0.04 240)',
                  borderColor: nome.trim().length >= 2 ? 'oklch(0.55 0.18 162 / 60%)' : 'oklch(1 0 0 / 8%)',
                  color: 'var(--foreground)',
                  caretColor: 'oklch(0.62 0.18 162)',
                }}
              />
            </div>
          </div>
        )}

        {/* ── PASSO 2 — Desafio principal ── */}
        {passo === 2 && (
          <div>
            <div className="mb-6">
              <h2 className="text-[22px] font-black text-foreground font-display leading-snug mb-2">
                Olá, {primeiro}!
              </h2>
              <p className="text-[16px] font-semibold text-foreground leading-snug mb-1">
                Qual é seu maior desafio financeiro agora?
              </p>
              <p className="text-[14px]" style={{ color: 'oklch(0.58 0.01 240)' }}>
                Escolha o que mais se encaixa com você.
              </p>
            </div>

            <div className="space-y-2.5">
              {DESAFIOS.map(d => (
                <button
                  key={d.value}
                  onClick={() => setDesafio(d.value)}
                  className="w-full flex items-center gap-4 rounded-2xl p-4 text-left transition-all active:scale-[0.98]"
                  style={{
                    background: desafio === d.value ? 'oklch(0.48 0.16 162 / 15%)' : 'oklch(0.19 0.04 240)',
                    border: desafio === d.value
                      ? '2px solid oklch(0.55 0.18 162 / 60%)'
                      : '2px solid oklch(1 0 0 / 6%)',
                    transition: 'all 0.18s ease',
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[14px] text-foreground leading-snug">{d.label}</p>
                    <p className="text-[12px] mt-0.5" style={{ color: 'oklch(0.58 0.01 240)' }}>{d.desc}</p>
                  </div>
                  {desafio === d.value && (
                    <CheckCircle2 size={18} className="text-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── PASSO 3 — Pergunta personalizada ── */}
        {passo === 3 && (
          <div>
            <div className="mb-6">
              {pergunta3.titulo.split('\n\n').map((parte, i) => (
                <p
                  key={i}
                  className={i === 0
                    ? 'text-[15px] mb-1 font-medium'
                    : 'text-[22px] font-black font-display leading-snug text-foreground mt-1 mb-2'
                  }
                  style={i === 0 ? { color: 'oklch(0.58 0.01 240)' } : {}}
                >
                  {parte}
                </p>
              ))}
              {pergunta3.subtitulo && (
                <p className="text-[13px] mt-2 leading-relaxed" style={{ color: 'oklch(0.55 0.01 240)' }}>
                  {pergunta3.subtitulo}
                </p>
              )}
            </div>

            <div className="space-y-2.5">
              {pergunta3.opcoes.map(op => (
                <button
                  key={op.value}
                  onClick={() => setRespostaCompl(op.value)}
                  className="w-full flex items-center gap-4 rounded-2xl p-4 text-left transition-all active:scale-[0.98]"
                  style={{
                    background: respostaCompl === op.value ? 'oklch(0.48 0.16 162 / 15%)' : 'oklch(0.19 0.04 240)',
                    border: respostaCompl === op.value
                      ? '2px solid oklch(0.55 0.18 162 / 60%)'
                      : '2px solid oklch(1 0 0 / 6%)',
                    transition: 'all 0.18s ease',
                  }}
                >
                  <p className="flex-1 font-semibold text-[14px] text-foreground">{op.label}</p>
                  {respostaCompl === op.value && (
                    <CheckCircle2 size={18} className="text-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── PASSO 4 — Fechamento ── */}
        {passo === 4 && (
          <div className="flex flex-col items-center text-center pt-6">
            {/* Ícone de sucesso */}
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center mb-7 relative"
              style={{
                background: 'oklch(0.48 0.16 162)',
                boxShadow: '0 16px 48px oklch(0.48 0.16 162 / 40%)',
                animation: 'scalePop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards',
              }}
            >
              <CheckCircle2 size={40} className="text-white" />
              <div
                className="absolute -top-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
                style={{
                  background: 'oklch(0.78 0.15 88)',
                  animation: 'scalePop 0.5s 0.2s cubic-bezier(0.34,1.56,0.64,1) both',
                }}
              >
                <Sparkles size={14} className="text-white" />
              </div>
            </div>

            <div style={{ animation: 'fadeSlideUp 0.5s 0.15s ease-out both' }}>
              <h2 className="text-[24px] font-black text-foreground font-display leading-tight mb-2">
                Perfeito, {primeiro}!
              </h2>
              <p className="text-[15px] leading-relaxed mb-1" style={{ color: 'oklch(0.62 0.18 162)' }}>
                Criei seu perfil financeiro.
              </p>
              <p className="text-[15px] leading-relaxed font-semibold text-foreground">
                {msgFinal}
              </p>
            </div>

            {/* Separador */}
            <div
              className="w-full my-7 h-px"
              style={{ background: 'oklch(1 0 0 / 8%)', animation: 'fadeSlideUp 0.5s 0.3s ease-out both' }}
            />

            {/* Convite para primeira ação */}
            <div
              className="w-full text-left"
              style={{ animation: 'fadeSlideUp 0.5s 0.4s ease-out both' }}
            >
              <div
                className="rounded-2xl p-4"
                style={{ background: 'oklch(0.19 0.04 240)', border: '1px solid oklch(1 0 0 / 8%)' }}
              >
                <p className="text-[13px] font-bold text-foreground mb-1">Vamos começar com o mais simples.</p>
                <p className="text-[13px] leading-relaxed" style={{ color: 'oklch(0.58 0.01 240)' }}>
                  Me conta um gasto de hoje.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Botão de ação */}
      <div className="px-6 pb-10 pt-3 shrink-0">
        <button
          onClick={passo === 4 ? concluir : avancar}
          disabled={!podeAvancar()}
          className="w-full py-4 rounded-2xl font-bold text-[16px] text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-35"
          style={{
            backgroundColor: 'oklch(0.55 0.18 162)',
            transition: 'opacity 0.2s ease, transform 0.1s ease',
          }}
        >
          {passo === 4 ? 'Entrar no app' : 'Continuar'}
          {passo < 4 && <ChevronRight size={18} />}
        </button>
      </div>

      <style>{`
        @keyframes scalePop {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fadeSlideUp {
          0% { transform: translateY(16px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
