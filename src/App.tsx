import { useState } from 'react'
import { MessageSquare, Receipt, CreditCard, DollarSign, BarChart2 } from 'lucide-react'
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
  { id: 'receitas', label: 'Receitas', Icon: DollarSign },
  { id: 'resumo', label: 'Resumo', Icon: BarChart2 },
] as const

function Header({ nomeUsuario }: { nomeUsuario: string }) {
  const { totalGastos, totalReceitas } = useApp()

  return (
    <div style={{ backgroundColor: 'oklch(0.50 0.17 155)' }} className="px-4 py-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-white/20 flex items-center justify-center">
            <img
              src="https://pub-c0bfb119504542e0b2e6ebc8f6b3b1df.r2.dev/user-uploads/user_37oySykXrlZ5YXKyzjL0vXOVtjM/122d7158-c2f6-4431-8680-59809e067303.jpg"
              alt="Tá Contato"
              className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-tight">Tá Contato 🤝</p>
            <p className="text-xs text-white/70 leading-tight">
              {nomeUsuario ? `Olá, ${nomeUsuario}!` : 'Assessor Financeiro Pessoal'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-white/20 rounded-xl p-2 flex items-center justify-center">
            <Database size={16} className="text-white" />
          </div>
          <div className="text-right">
            <p className="text-xs text-white/70">Gastos · Receitas</p>
            <p className="text-sm font-bold text-white">
              <span className="text-red-300">R$ {Number(totalGastos).toFixed(2).replace('.', ',')}</span>
              {' · '}
              <span className="text-white">R$ {Number(totalReceitas).toFixed(2).replace('.', ',')}</span>
            </p>
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

      {/* Tabs */}
      <div className="flex border-b border-border bg-background">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as Tab)}
            className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs transition-colors ${
              tab === id
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground'
            }`}
          >
            <Icon size={18} />
            <span>{label}</span>
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
