import { useState } from 'react'
import { ChevronRight, HandshakeIcon } from 'lucide-react'

interface OnboardingProps {
  onConcluir: (nome: string) => void
}

export default function Onboarding({ onConcluir }: OnboardingProps) {
  const [passo, setPasso] = useState(1)
  const [nome, setNome] = useState('')

  const avancar = () => {
    if (passo === 2 && !nome.trim()) return
    if (passo < 3) setPasso(p => p + 1)
    else onConcluir(nome.trim())
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center p-6 z-[100]">
      {/* Indicadores de passo */}
      <div className="flex gap-2 mb-10">
        {[1, 2, 3].map(p => (
          <div
            key={p}
            className={`h-1.5 rounded-full transition-all ${p === passo ? 'w-8 bg-primary' : p < passo ? 'w-4 bg-primary/50' : 'w-4 bg-secondary'}`}
          />
        ))}
      </div>

      {/* Passo 1 — Apresentação */}
      {passo === 1 && (
        <div className="flex flex-col items-center text-center space-y-6 max-w-xs">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'oklch(0.50 0.17 155)' }}
          >
            <HandshakeIcon size={44} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Tá Contato</h1>
            <p className="text-muted-foreground mt-2 text-base">Seu dinheiro organizado com IA</p>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Registre gastos, receitas e dívidas conversando. Sem complicação.
          </p>
        </div>
      )}

      {/* Passo 2 — Nome */}
      {passo === 2 && (
        <div className="flex flex-col items-center text-center space-y-6 max-w-xs w-full">
          <div className="text-5xl">👋</div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Como posso te chamar?</h2>
            <p className="text-muted-foreground mt-2 text-sm">Para deixar tudo mais pessoal!</p>
          </div>
          <input
            type="text"
            placeholder="Seu nome aqui..."
            value={nome}
            onChange={e => setNome(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && avancar()}
            autoFocus
            className="w-full bg-secondary text-foreground placeholder:text-muted-foreground rounded-xl px-4 py-3 text-base outline-none border border-border focus:border-primary transition-colors text-center"
          />
        </div>
      )}

      {/* Passo 3 — Pronto */}
      {passo === 3 && (
        <div className="flex flex-col items-center text-center space-y-6 max-w-xs">
          <div className="text-6xl">🎉</div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              Tudo pronto{nome ? `, ${nome}` : ''}!
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              Agora é só começar a registrar seus gastos e receitas pelo chat.
            </p>
          </div>
        </div>
      )}

      {/* Botão de avançar */}
      <button
        onClick={avancar}
        disabled={passo === 2 && !nome.trim()}
        className="mt-10 flex items-center gap-2 px-8 py-3.5 rounded-2xl font-semibold text-white transition-opacity disabled:opacity-40"
        style={{ backgroundColor: 'oklch(0.50 0.17 155)' }}
      >
        {passo === 3 ? 'Começar' : 'Próximo'}
        <ChevronRight size={18} />
      </button>
    </div>
  )
}
