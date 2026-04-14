import { useState } from 'react'
import { MessageSquare, Receipt, CreditCard, DollarSign, BarChart2, Database, AlertTriangle } from 'lucide-react'
import { AppProvider, useApp } from '@/context/AppContext'
import ChatPage from '@/pages/ChatPage'
import GastosPage from '@/pages/GastosPage'
import DividasPage from '@/pages/DividasPage'
import ReceitasPage from '@/pages/ReceitasPage'
import ResumoPage from '@/pages/ResumoPage'
import { Toaster } from 'sonner'

type Tab = 'chat' | 'gastos' | 'dividas' | 'receitas' | 'resumo'

const TABS = [
  { id: 'chat', label: 'Chat', Icon: MessageSquare },
  { id: 'gastos', label: 'Gastos', Icon: Receipt },
  { id: 'dividas', label: 'Dívidas', Icon: CreditCard },
  { id: 'receitas', label: 'Receitas', Icon: DollarSign },
  { id: 'resumo', label: 'Resumo', Icon: BarChart2 },
] as const

function Header() {
  const { totalGastos, totalReceitas, supabaseOk } = useApp()

  return (
    <div style={{ backgroundColor: 'oklch(0.50 0.17 155)' }} className="px-4 py-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-white/20 flex items-center justify-center">
            <img
              src="https://pub-c0bfb119504542e0b2e6ebc8f6b3b1df.r2.dev/user-uploads/user_37oySykXrlZ5YXKyzjL0vXOVtjM/122d7158-c2f6-4431-8680-59809e067303.jpg"
              alt="Meu Assessor"
              className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-tight">Meu Assessor</p>
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${supabaseOk ? 'bg-white' : 'bg-yellow-400'}`} />
              {!supabaseOk && <AlertTriangle size={12} className="text-yellow-400" />}
              <span className="text-xs text-white/80">
                {supabaseOk ? 'Conectado' : 'Storage indisponível'}
              </span>
            </div>
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

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto bg-background">
      <Header />

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
