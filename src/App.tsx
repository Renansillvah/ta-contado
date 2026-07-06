import { useState } from 'react'
import { MessageSquare, Receipt, CreditCard, TrendingUp, BarChart2, X, Target, Share2, Download, Trash2, ChevronRight, CheckCircle, MessageCircle, Pencil, Check } from 'lucide-react'
import { AppProvider, useApp } from '@/context/AppContext'
import ChatPage from '@/pages/ChatPage'
import GastosPage from '@/pages/GastosPage'
import DividasPage from '@/pages/DividasPage'
import ReceitasPage from '@/pages/ReceitasPage'
import ResumoPage from '@/pages/ResumoPage'
import Onboarding from '@/components/Onboarding'
import { WhatsAppConnect } from '@/components/WhatsAppConnect'
import { Toaster } from 'sonner'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

type Tab = 'chat' | 'gastos' | 'dividas' | 'receitas' | 'resumo'

const TABS = [
  { id: 'chat', label: 'Chat', Icon: MessageSquare },
  { id: 'gastos', label: 'Gastos', Icon: Receipt },
  { id: 'dividas', label: 'Dívidas', Icon: CreditCard },
  { id: 'receitas', label: 'Receitas', Icon: TrendingUp },
  { id: 'resumo', label: 'Resumo', Icon: BarChart2 },
] as const

// ── Meta mensal ──────────────────────────────────────────────────────────────
function MetaMensal({ onClose }: { onClose: () => void }) {
  const metaSalva = localStorage.getItem('meta_mensal') || ''
  const [valor, setValor] = useState(metaSalva)
  const [editando, setEditando] = useState(!metaSalva)

  const salvar = () => {
    const v = parseFloat(valor.replace(',', '.'))
    if (!v || v <= 0) { toast.error('Digite um valor válido'); return }
    localStorage.setItem('meta_mensal', String(v))
    toast.success('Meta mensal salva!')
    setEditando(false)
    onClose()
  }

  return (
    <div
      className="mx-3 rounded-2xl p-4 mt-1 mb-1"
      style={{ background: 'oklch(0.20 0.04 240)', border: '1px solid oklch(1 0 0 / 10%)' }}
    >
      <p className="text-xs font-bold text-foreground mb-1">Meta de gastos mensais</p>
      {editando ? (
        <div className="flex gap-2 mt-2">
          <input
            type="number"
            placeholder="Ex: 2000"
            value={valor}
            onChange={e => setValor(e.target.value)}
            autoFocus
            className="flex-1 bg-secondary text-foreground rounded-xl px-3 py-2 text-sm outline-none border border-border focus:border-primary transition-colors"
          />
          <button
            onClick={salvar}
            className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0"
          >
            <Check size={15} className="text-primary-foreground" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between mt-1">
          <p className="text-sm font-semibold text-foreground">
            R$ {parseFloat(metaSalva).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <button
            onClick={() => setEditando(true)}
            className="flex items-center gap-1 text-xs text-primary"
          >
            <Pencil size={12} /> Alterar
          </button>
        </div>
      )}
    </div>
  )
}

// ── Menu sanduíche ───────────────────────────────────────────────────────────
function SideMenu({
  open,
  onClose,
  nomeUsuario,
  onRenomear,
}: {
  open: boolean
  onClose: () => void
  nomeUsuario: string
  onRenomear: (nome: string) => void
}) {
  const { gastos, receitas, dividas } = useApp()
  const [showWhatsApp, setShowWhatsApp] = useState(false)
  const [showMeta, setShowMeta] = useState(false)
  const [confirmLimpar, setConfirmLimpar] = useState(false)
  const [editandoNome, setEditandoNome] = useState(false)
  const [novoNome, setNovoNome] = useState(nomeUsuario)

  const waConnected = !!localStorage.getItem('wa_phone')
  const waPhone = localStorage.getItem('wa_phone') ?? ''
  const inicial = nomeUsuario ? nomeUsuario.charAt(0).toUpperCase() : 'U'

  const salvarNome = () => {
    const nome = novoNome.trim()
    if (!nome) return
    localStorage.setItem('user_name', nome)
    onRenomear(nome)
    setEditandoNome(false)
    toast.success('Nome atualizado!')
  }

  const handleCompartilhar = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Tá Contado',
        text: 'Controle suas finanças de forma simples! Conheça o Tá Contado',
        url: window.location.href,
      })
    } else {
      navigator.clipboard.writeText(window.location.href)
      toast.success('Link copiado!')
    }
    onClose()
  }

  const handleExportar = async () => {
    // Usa os dados do Supabase (já carregados no contexto)
    const linhas = [
      '=== RESUMO TÁ CONTADO ===',
      `Exportado em: ${new Date().toLocaleDateString('pt-BR')}`,
      '',
      '--- GASTOS ---',
      ...gastos.map(g => `${g.descricao || 'Sem descrição'} | R$ ${Number(g.valor).toFixed(2)} | ${g.data || ''}`),
      '',
      '--- RECEITAS ---',
      ...receitas.map(r => `${r.descricao || 'Sem descrição'} | R$ ${Number(r.valor).toFixed(2)} | ${r.data || ''}`),
      '',
      '--- DÍVIDAS ---',
      ...dividas.map(d => `${d.nome} | Total: R$ ${Number(d.valor_total).toFixed(2)} | Pago: R$ ${Number(d.valor_pago).toFixed(2)}`),
    ]
    const blob = new Blob([linhas.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ta-contado-${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Resumo exportado!')
    onClose()
  }

  const handleLimpar = async () => {
    try {
      await Promise.all([
        supabase.from('gastos').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('receitas').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('dividas').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      ])
      toast.success('Todos os dados foram apagados.')
      window.location.reload()
    } catch {
      toast.error('Erro ao apagar dados. Tente novamente.')
    }
    setConfirmLimpar(false)
    onClose()
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.60)' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 h-full z-50 flex flex-col transition-transform duration-300 ease-out overflow-y-auto`}
        style={{
          width: '82%',
          maxWidth: '360px',
          background: 'oklch(0.14 0.03 240)',
          borderRight: '1px solid oklch(1 0 0 / 8%)',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        {/* Header do menu — única área azul, mantém identidade da marca */}
        <div
          className="px-4 pt-5 pb-4 flex items-center justify-between shrink-0"
          style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2452 60%, #0f2d6b 100%)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(37,99,235,0.35)', border: '1px solid rgba(37,99,235,0.5)' }}
            >
              <span className="text-white font-bold text-sm">TC</span>
            </div>
            <div>
              <p className="text-white font-bold text-[15px] leading-tight">Tá Contado</p>
              <p className="text-white/50 text-[11px]">Assessor Financeiro</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        {/* Card perfil — compacto e editável */}
        <div className="px-3 pt-3 pb-0">
          <div
            className="flex items-center gap-3 px-3.5 py-3 rounded-2xl"
            style={{ background: 'oklch(0.19 0.04 240)', border: '1px solid oklch(1 0 0 / 8%)' }}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-white text-sm"
              style={{ background: 'oklch(0.48 0.16 162)' }}
            >
              {inicial}
            </div>
            {editandoNome ? (
              <div className="flex gap-2 flex-1">
                <input
                  type="text"
                  value={novoNome}
                  onChange={e => setNovoNome(e.target.value)}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && salvarNome()}
                  className="flex-1 bg-secondary text-foreground rounded-xl px-3 py-1.5 text-sm outline-none border border-border focus:border-primary transition-colors"
                />
                <button onClick={salvarNome} className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shrink-0">
                  <Check size={14} className="text-primary-foreground" />
                </button>
              </div>
            ) : (
              <div className="flex-1 min-w-0">
                <p className="text-foreground font-semibold text-[13px] leading-tight truncate">{nomeUsuario || 'Usuário'}</p>
              </div>
            )}
            {!editandoNome && (
              <button onClick={() => { setNovoNome(nomeUsuario); setEditandoNome(true) }} className="text-muted-foreground hover:text-foreground transition-colors p-1 shrink-0">
                <Pencil size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Seção FERRAMENTAS */}
        <div className="px-3 mt-4">
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground/50 mb-1.5 px-1">FERRAMENTAS</p>

          <MenuItem
            icon={<Target size={17} />}
            label="Meta mensal de gastos"
            desc={localStorage.getItem('meta_mensal')
              ? `R$ ${parseFloat(localStorage.getItem('meta_mensal')!).toLocaleString('pt-BR', { minimumFractionDigits: 0 })} / mês`
              : 'Definir limite de gastos'
            }
            onClick={() => setShowMeta(v => !v)}
            active={showMeta}
          />

          {showMeta && <MetaMensal onClose={() => setShowMeta(false)} />}

          <MenuItem
            icon={<Download size={17} />}
            label="Exportar dados"
            desc="Baixa resumo em .txt"
            onClick={handleExportar}
          />
        </div>

        {/* Seção WHATSAPP */}
        <div className="px-3 mt-4">
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground/50 mb-1.5 px-1">WHATSAPP</p>
          <div
            className="rounded-2xl p-3.5"
            style={{
              background: waConnected ? 'oklch(0.19 0.07 162)' : 'oklch(0.19 0.04 240)',
              border: waConnected ? '1px solid oklch(0.55 0.16 162 / 40%)' : '1px solid oklch(1 0 0 / 8%)',
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: waConnected ? 'oklch(0.55 0.18 162 / 20%)' : 'oklch(0.25 0.04 240)' }}
              >
                {waConnected
                  ? <CheckCircle size={20} className="text-primary" />
                  : <MessageCircle size={20} className="text-muted-foreground" />
                }
              </div>
              <div className="flex-1">
                <p className="text-foreground font-bold text-[13px]">
                  {waConnected ? 'WhatsApp conectado' : 'Usar pelo WhatsApp'}
                </p>
                <p className="text-muted-foreground text-[11px]">
                  {waConnected ? `+55 ${waPhone}` : 'Registre tudo sem abrir o app'}
                </p>
              </div>
            </div>
            {!waConnected && (
              <div className="space-y-1 mb-3">
                {['"Gastei 50 no mercado"', '"Recebi 3000 de freela"', '"Quanto gastei esse mês?"'].map(ex => (
                  <p key={ex} className="text-muted-foreground text-[11px]">{ex} ✓</p>
                ))}
              </div>
            )}
            <button
              className="w-full py-2.5 rounded-xl font-semibold text-[13px] transition-colors text-primary-foreground active:scale-[0.98]"
              style={{ backgroundColor: waConnected ? 'oklch(0.30 0.06 240)' : 'oklch(0.55 0.18 162)' }}
              onClick={() => setShowWhatsApp(true)}
            >
              {waConnected ? 'Gerenciar conexão' : 'Vincular meu WhatsApp'}
            </button>
          </div>
        </div>

        {showWhatsApp && (
          <WhatsAppConnect nomeUsuario={nomeUsuario} onClose={() => setShowWhatsApp(false)} />
        )}

        {/* Seção COMPARTILHAR */}
        <div className="px-3 mt-4">
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground/50 mb-1.5 px-1">COMPARTILHAR</p>
          <MenuItem
            icon={<Share2 size={17} />}
            label="Compartilhar app"
            desc="Indique o Tá Contado"
            onClick={handleCompartilhar}
          />
        </div>

        {/* Seção PERIGO */}
        <div className="px-3 mt-4 mb-6">
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground/50 mb-1.5 px-1">DADOS</p>

          {confirmLimpar ? (
            <div
              className="rounded-2xl p-4"
              style={{ background: 'oklch(0.20 0.06 15)', border: '1px solid oklch(0.55 0.22 15 / 35%)' }}
            >
              <p className="text-sm font-bold text-foreground mb-0.5">Apagar todos os dados?</p>
              <p className="text-xs text-muted-foreground mb-3">Gastos, receitas e dívidas serão removidos permanentemente. Esta ação não pode ser desfeita.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmLimpar(false)}
                  className="flex-1 bg-secondary text-foreground rounded-xl py-2.5 text-xs font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleLimpar}
                  className="flex-1 bg-destructive text-white rounded-xl py-2.5 text-xs font-semibold"
                >
                  Apagar tudo
                </button>
              </div>
            </div>
          ) : (
            <button
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors hover:bg-destructive/8"
              onClick={() => setConfirmLimpar(true)}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-destructive/15">
                <Trash2 size={16} className="text-destructive" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-destructive font-semibold text-[13px] leading-tight">Limpar todos os dados</p>
                <p className="text-muted-foreground text-[11px] mt-0.5">Apaga gastos, dívidas e receitas</p>
              </div>
              <ChevronRight size={14} className="text-muted-foreground/40 shrink-0" />
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="mt-auto pb-6 text-center">
          <p className="text-muted-foreground/30 text-[11px]">Tá Contado v1.0</p>
        </div>
      </div>
    </>
  )
}

function MenuItem({
  icon,
  label,
  desc,
  onClick,
  active = false,
}: {
  icon: React.ReactNode
  label: string
  desc: string
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors hover:bg-white/4 text-left"
      style={active ? { background: 'oklch(0.48 0.16 162 / 12%)' } : {}}
      onClick={onClick}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-foreground"
        style={{ background: active ? 'oklch(0.48 0.16 162 / 20%)' : 'oklch(0.20 0.04 240)' }}
      >
        <span className={active ? 'text-primary' : 'text-muted-foreground'}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-foreground font-semibold text-[13px] leading-tight">{label}</p>
        <p className="text-muted-foreground text-[11px] mt-0.5 truncate">{desc}</p>
      </div>
      <ChevronRight size={14} className="text-muted-foreground/30 shrink-0" />
    </button>
  )
}

// ── Header ───────────────────────────────────────────────────────────────────
function Header({
  nomeUsuario,
  onMenuOpen,
}: {
  nomeUsuario: string
  onMenuOpen: () => void
}) {
  const { totalGastos, totalReceitas } = useApp()

  return (
    <div
      className="px-4 pt-3.5 pb-3"
      style={{
        background: 'linear-gradient(135deg, #0a1628 0%, #0d2452 50%, #0f2d6b 100%)',
        borderRadius: '0 0 32px 32px',
      }}
    >
      <div className="flex items-center justify-between">
        {/* Botão sanduíche */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuOpen}
            className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:opacity-80 active:scale-95"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
            aria-label="Abrir menu"
          >
            <div className="flex flex-col gap-[4.5px]">
              <span className="block h-[2px] w-[18px] rounded-full bg-white" />
              <span className="block h-[2px] w-[18px] rounded-full bg-white" />
              <span className="block h-[2px] w-[11px] rounded-full bg-white/60" />
            </div>
          </button>
          <div>
            <p className="font-bold text-white text-[15px] leading-tight tracking-tight">Tá Contado</p>
            <p className="text-[11px] text-white/65 leading-tight mt-0.5">
              {nomeUsuario ? `Olá, ${nomeUsuario}!` : 'Assessor Financeiro Pessoal'}
            </p>
          </div>
        </div>

        {/* Gastos e Receitas */}
        <div className="text-right">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[10px] text-white/50 mb-0.5">Gastos</p>
              <p className="text-sm font-bold text-red-300">R$ {Number(totalGastos).toFixed(2).replace('.', ',')}</p>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div>
              <p className="text-[10px] text-white/50 mb-0.5">Receitas</p>
              <p className="text-sm font-bold text-emerald-300">R$ {Number(totalReceitas).toFixed(2).replace('.', ',')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
function AppContent() {
  const [tab, setTab] = useState<Tab>('chat')
  const [onboardingFeito] = useState(() => !!localStorage.getItem('onboarding_done'))
  const [showOnboarding, setShowOnboarding] = useState(!onboardingFeito)
  const [nomeUsuario, setNomeUsuario] = useState(() => localStorage.getItem('user_name') || '')
  const [menuOpen, setMenuOpen] = useState(false)

  const concluirOnboarding = (nome: string) => {
    localStorage.setItem('onboarding_done', '1')
    localStorage.setItem('user_name', nome)
    setNomeUsuario(nome)
    setShowOnboarding(false)
  }

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto bg-background">
      {showOnboarding && <Onboarding onConcluir={concluirOnboarding} />}

      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        nomeUsuario={nomeUsuario}
        onRenomear={setNomeUsuario}
      />

      <Header nomeUsuario={nomeUsuario} onMenuOpen={() => setMenuOpen(true)} />

      {/* Tab bar */}
      <div
        className="flex border-b bg-background"
        style={{ borderColor: 'oklch(1 0 0 / 8%)' }}
      >
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as Tab)}
            className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 text-[10px] font-medium transition-all relative ${
              tab === id ? 'text-primary' : 'text-muted-foreground hover:text-foreground/70'
            }`}
          >
            <Icon size={17} strokeWidth={tab === id ? 2.2 : 1.8} />
            <span className="tracking-wide">{label}</span>
            {tab === id && (
              <span
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full"
                style={{ backgroundColor: 'oklch(0.62 0.18 162)' }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-hidden">
        {tab === 'chat' && <ChatPage />}
        {tab === 'gastos' && <GastosPage />}
        {tab === 'dividas' && <DividasPage />}
        {tab === 'receitas' && <ReceitasPage />}
        {tab === 'resumo' && <ResumoPage />}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
      <Toaster position="top-center" richColors />
    </AppProvider>
  )
}
