import { useState } from 'react'
import { MessageSquare, Receipt, CreditCard, TrendingUp, BarChart2 } from 'lucide-react'
import { AppProvider, useApp } from '@/context/AppContext'
import ChatPage from '@/pages/ChatPage'
import GastosPage from '@/pages/GastosPage'
import DividasPage from '@/pages/DividasPage'
import ReceitasPage from '@/pages/ReceitasPage'
import ResumoPage from '@/pages/ResumoPage'
import Onboarding from '@/components/Onboarding'
import { Toaster } from 'sonner'

type Tab = 'chat' | 'gastos' | 'dividas' | 'receitas' | 'resumo'

const TABS = [
  { id: 'chat', label: 'Chat', Icon: MessageSquare },
  { id: 'gastos', label: 'Gastos', Icon: Receipt },
  { id: 'dividas', label: 'Dívidas', Icon: CreditCard },
  { id: 'receitas', label: 'Receitas', Icon: TrendingUp },
  { id: 'resumo', label: 'Resumo', Icon: BarChart2 },
] as const

function Header({ nomeUsuario }: { nomeUsuario: string }) {
  const { totalGastos, totalReceitas } = useApp()
  const saldo = totalReceitas - totalGastos

  return (
    <div
      className="px-4 pt-3.5 pb-3"
      style={{ backgroundColor: 'oklch(0.48 0.16 162)' }}
    >
      <div className="flex items-center justify-between">
        {/* Logo + identidade */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl overflow-hidden shrink-0" style={{ boxShadow: '0 2px 12px oklch(0 0 0 / 30%)' }}>
            <img
              src="https://pub-c0bfb119504542e0b2e6ebc8f6b3b1df.r2.dev/user-uploads/user_37oySykXrlZ5YXKyzjL0vXOVtjM/9e3294a7-c91c-4fdf-98f5-fc3099336a6e.png"
              alt="Tá Contato"
              className="w-full h-full object-cover"
              onError={e => {
                const el = e.target as HTMLImageElement
                el.style.display = 'none'
                const parent = el.parentElement!
                parent.style.background = 'oklch(0.38 0.14 162)'
                parent.innerHTML = '<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-weight:800;font-size:14px;color:white;font-family:Poppins,Inter,sans-serif;letter-spacing:0.5px">TC</span>'
              }}
            />
          </div>
          <div>
            <p className="font-display font-700 text-white text-[15px] leading-tight tracking-tight">Tá Contato</p>
            <p className="text-[11px] text-white/65 leading-tight mt-0.5">
              {nomeUsuario ? `Olá, ${nomeUsuario}! 👋` : 'Assessor Financeiro Pessoal'}
            </p>
          </div>
        </div>

        {/* Saldo resumido */}
        <div className="text-right">
          <p className="text-[10px] text-white/55 uppercase tracking-wider mb-0.5">Saldo geral</p>
          <p className={`text-base font-bold leading-tight ${saldo >= 0 ? 'text-white' : 'text-red-300'}`}>
            R$ {saldo.toFixed(2).replace('.', ',')}
          </p>
          <p className="text-[10px] text-white/50">
            <span className="text-red-300">−{Number(totalGastos).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</span>
            {' / '}
            <span className="text-emerald-300">+{Number(totalReceitas).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</span>
          </p>
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

  const concluirOnboarding = (nome: string) => {
    localStorage.setItem('onboarding_done', '1')
    localStorage.setItem('user_name', nome)
    setNomeUsuario(nome)
    setShowOnboarding(false)
  }

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto bg-background">
      {showOnboarding && <Onboarding onConcluir={concluirOnboarding} />}
      <Header nomeUsuario={nomeUsuario} />

      {/* Tab bar premium */}
      <div
        className="flex border-b bg-background"
        style={{ borderColor: 'oklch(1 0 0 / 7%)' }}
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
