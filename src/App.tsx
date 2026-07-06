import { useState } from 'react'
import { MessageSquare, Receipt, CreditCard, TrendingUp, BarChart2, Menu, X, User, Target, Calendar, MessageCircle, Share2, FileText, Download, Trash2, ChevronRight } from 'lucide-react'
import { AppProvider, useApp } from '@/context/AppContext'
import ChatPage from '@/pages/ChatPage'
import GastosPage from '@/pages/GastosPage'
import DividasPage from '@/pages/DividasPage'
import ReceitasPage from '@/pages/ReceitasPage'
import ResumoPage from '@/pages/ResumoPage'
import Onboarding from '@/components/Onboarding'
import { Toaster } from 'sonner'
import { toast } from 'sonner'

type Tab = 'chat' | 'gastos' | 'dividas' | 'receitas' | 'resumo'

const TABS = [
  { id: 'chat', label: 'Chat', Icon: MessageSquare },
  { id: 'gastos', label: 'Gastos', Icon: Receipt },
  { id: 'dividas', label: 'Dívidas', Icon: CreditCard },
  { id: 'receitas', label: 'Receitas', Icon: TrendingUp },
  { id: 'resumo', label: 'Resumo', Icon: BarChart2 },
] as const

function SideMenu({
  open,
  onClose,
  nomeUsuario,
}: {
  open: boolean
  onClose: () => void
  nomeUsuario: string
}) {
  const { resetDados } = useApp() as { resetDados?: () => void }

  const inicial = nomeUsuario ? nomeUsuario.charAt(0).toUpperCase() : 'U'

  const handleLimpar = () => {
    if (resetDados) {
      resetDados()
      toast.success('Dados apagados com sucesso!')
    } else {
      localStorage.removeItem('gastos')
      localStorage.removeItem('receitas')
      localStorage.removeItem('dividas')
      toast.success('Dados apagados! Recarregue para ver as mudanças.')
    }
    onClose()
  }

  const handleCompartilhar = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Tá Contado',
        text: 'Controle suas finanças de forma simples! Conheça o Tá Contado 🚀',
        url: window.location.href,
      })
    } else {
      navigator.clipboard.writeText(window.location.href)
      toast.success('Link copiado! Compartilhe com seus amigos.')
    }
    onClose()
  }

  const handleExportar = () => {
    const gastos = JSON.parse(localStorage.getItem('gastos') || '[]')
    const receitas = JSON.parse(localStorage.getItem('receitas') || '[]')
    const dividas = JSON.parse(localStorage.getItem('dividas') || '[]')

    const linhas = [
      '=== RESUMO TÁ CONTADO ===',
      `Exportado em: ${new Date().toLocaleDateString('pt-BR')}`,
      '',
      '--- GASTOS ---',
      ...gastos.map((g: { descricao?: string; valor?: number; data?: string }) =>
        `${g.descricao || 'Sem descrição'} | R$ ${Number(g.valor || 0).toFixed(2)} | ${g.data || ''}`
      ),
      '',
      '--- RECEITAS ---',
      ...receitas.map((r: { descricao?: string; valor?: number; data?: string }) =>
        `${r.descricao || 'Sem descrição'} | R$ ${Number(r.valor || 0).toFixed(2)} | ${r.data || ''}`
      ),
      '',
      '--- DÍVIDAS ---',
      ...dividas.map((d: { descricao?: string; valor?: number }) =>
        `${d.descricao || 'Sem descrição'} | R$ ${Number(d.valor || 0).toFixed(2)}`
      ),
    ]

    const blob = new Blob([linhas.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ta-contado-resumo-${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Resumo exportado!')
    onClose()
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.55)' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 h-full z-50 flex flex-col transition-transform duration-300 ease-out overflow-y-auto`}
        style={{
          width: '82%',
          maxWidth: '360px',
          background: '#0f1f3d',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        {/* Header do menu */}
        <div
          className="px-4 pt-5 pb-4 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2452 60%, #0f2d6b 100%)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #1a3a8f, #2563eb)' }}
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

        {/* Card do usuário */}
        <div className="px-4 py-3">
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{ background: 'rgba(37,99,235,0.18)', border: '1px solid rgba(37,99,235,0.3)' }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-white text-base"
              style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
            >
              {inicial}
            </div>
            <div>
              <p className="text-white font-semibold text-[14px] leading-tight">{nomeUsuario || 'Usuário'}</p>
              <p className="text-white/45 text-[11px] mt-0.5">Conta pessoal · Plano Free</p>
            </div>
          </div>
        </div>

        {/* Seção CONTA */}
        <div className="px-4 mt-3">
          <p className="text-[10px] font-bold tracking-widest text-white/30 mb-2 px-1">CONTA</p>

          <MenuItem
            icon={<User size={18} />}
            iconBg="#1e3a5f"
            label="Meu perfil"
            desc="Nome e preferências"
            onClick={() => {
              toast.info('Em breve você poderá editar seu perfil aqui!')
              onClose()
            }}
          />
          <MenuItem
            icon={<Target size={18} />}
            iconBg="#1e3a2f"
            iconColor="#22c55e"
            label="Meta mensal"
            desc="Definir limite de gastos"
            onClick={() => {
              toast.info('Funcionalidade de metas chegando em breve!')
              onClose()
            }}
          />
        </div>

        {/* Seção AGENDA */}
        <div className="px-4 mt-4">
          <p className="text-[10px] font-bold tracking-widest text-white/30 mb-2 px-1">AGENDA & LEMBRETES</p>
          <MenuItem
            icon={<Calendar size={18} />}
            iconBg="#2a1a3e"
            iconColor="#a78bfa"
            label="Agenda"
            desc="Calendário, reuniões e lembretes"
            onClick={() => {
              toast.info('Agenda em desenvolvimento — chegando em breve!')
              onClose()
            }}
          />
        </div>

        {/* Seção WHATSAPP */}
        <div className="px-4 mt-4">
          <p className="text-[10px] font-bold tracking-widest text-white/30 mb-2 px-1">TÁ CONTADO NO WHATSAPP</p>
          <div
            className="rounded-2xl p-4"
            style={{ background: 'linear-gradient(135deg, #064e3b, #065f46)', border: '1px solid rgba(34,197,94,0.3)' }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-xl bg-green-500 flex items-center justify-center shrink-0">
                <MessageCircle size={22} className="text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-[14px]">Usar pelo WhatsApp</p>
                <p className="text-green-300/80 text-[11px]">Registre tudo sem abrir o app</p>
              </div>
            </div>
            <p className="text-white/70 text-[12px] leading-relaxed mb-3">
              Imagine mandar uma mensagem no WhatsApp e o app atualizar automaticamente:
            </p>
            <div className="space-y-1.5 text-[12px]">
              <p className="text-white/80">"Almoço 25" → gasto registrado ✅</p>
              <p className="text-white/80">"Como foi esse mês?" → resumo no ZAP ✅</p>
              <p className="text-white/80">"Devo 500 no Nubank" → dívida salva ✅</p>
            </div>
            <div
              className="mt-3 rounded-xl p-3"
              style={{ background: 'rgba(0,0,0,0.25)' }}
            >
              <p className="text-green-400 font-bold text-[12px] mb-1">🚀 Em breve na versão completa</p>
              <p className="text-white/60 text-[11px] leading-relaxed">
                Esta é a funcionalidade estrela do Tá Contado. O app vai chamar você no WhatsApp, e você conversa como se fosse um amigo — qualquer gasto, receita ou dúvida financeira, tudo sincronizado em tempo real aqui no app.
              </p>
            </div>
            <button
              className="mt-3 w-full py-2.5 rounded-xl bg-green-500 hover:bg-green-400 transition-colors text-white font-bold text-[13px]"
              onClick={() => {
                toast.success('Você será avisado quando esta funcionalidade estiver disponível!')
                onClose()
              }}
            >
              Quero ser avisado no WhatsApp!
            </button>
          </div>
        </div>

        {/* Seção COMPARTILHAR */}
        <div className="px-4 mt-4">
          <p className="text-[10px] font-bold tracking-widest text-white/30 mb-2 px-1">COMPARTILHAR</p>
          <MenuItem
            icon={<Share2 size={18} />}
            iconBg="#1e2a3e"
            iconColor="#60a5fa"
            label="Compartilhar app"
            desc="Indique o Tá Contado"
            onClick={handleCompartilhar}
          />
          <MenuItem
            icon={<FileText size={18} />}
            iconBg="#2a1a1e"
            iconColor="#f87171"
            label="Relatório personalizado"
            desc="Escolha o mês e gere um PDF completo"
            onClick={() => {
              toast.info('Relatório em PDF chegando em breve!')
              onClose()
            }}
          />
          <MenuItem
            icon={<Download size={18} />}
            iconBg="#1e2a1e"
            iconColor="#86efac"
            label="Exportar resumo"
            desc="Resumo mensal em texto"
            onClick={handleExportar}
          />
        </div>

        {/* Seção APP */}
        <div className="px-4 mt-4 mb-6">
          <p className="text-[10px] font-bold tracking-widest text-white/30 mb-2 px-1">APP</p>
          <button
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors hover:bg-white/5"
            onClick={handleLimpar}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#2a1010' }}>
              <Trash2 size={18} className="text-red-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-red-400 font-semibold text-[13px] leading-tight">Limpar todos os dados</p>
              <p className="text-white/35 text-[11px] mt-0.5">Apaga gastos, dívidas e receitas</p>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="mt-auto pb-6 text-center">
          <p className="text-white/25 text-[11px]">Tá Contado v1.0 · feito com ❤️</p>
        </div>
      </div>
    </>
  )
}

function MenuItem({
  icon,
  iconBg,
  iconColor = '#60a5fa',
  label,
  desc,
  onClick,
}: {
  icon: React.ReactNode
  iconBg: string
  iconColor?: string
  label: string
  desc: string
  onClick: () => void
}) {
  return (
    <button
      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors hover:bg-white/5 text-left"
      onClick={onClick}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-white font-semibold text-[13px] leading-tight">{label}</p>
        <p className="text-white/40 text-[11px] mt-0.5">{desc}</p>
      </div>
      <ChevronRight size={15} className="text-white/25 shrink-0" />
    </button>
  )
}

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
        background: 'linear-gradient(135deg, #1a3a8f 0%, #1e50c8 50%, #2563eb 100%)',
        borderRadius: '0 0 32px 32px',
      }}
    >
      <div className="flex items-center justify-between">
        {/* Botão sanduíche */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuOpen}
            className="shrink-0 flex flex-col justify-center gap-[5px] px-2.5 py-2.5 rounded-2xl transition-all hover:opacity-80 active:scale-95"
            style={{ background: 'rgba(255,255,255,0.12)', boxShadow: '0 2px 10px rgba(0,0,0,0.25)', width: 42, height: 42 }}
            aria-label="Abrir menu"
          >
            <span className="block h-[2px] w-5 rounded-full bg-white" />
            <span className="block h-[2px] w-3.5 rounded-full bg-white/70" />
            <span className="block h-[2px] w-5 rounded-full bg-white" />
          </button>
          <div>
            <p className="font-bold text-white text-[15px] leading-tight tracking-tight">Tá Contado</p>
            <p className="text-[11px] text-white/65 leading-tight mt-0.5">
              {nomeUsuario ? `Olá, ${nomeUsuario}! 👋` : 'Assessor Financeiro Pessoal'}
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

      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} nomeUsuario={nomeUsuario} />

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
              tab === id
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground/70'
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
