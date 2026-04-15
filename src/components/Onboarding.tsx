import { useState } from 'react'
import { ChevronRight } from 'lucide-react'

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
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-between p-8 z-[100]">
      {/* Progress dots */}
      <div className="flex gap-2 mt-4">
        {[1, 2, 3].map(p => (
          <div
            key={p}
            className={`h-1 rounded-full transition-all duration-300 ${
              p === passo ? 'w-8 bg-primary' : p < passo ? 'w-4 bg-primary/40' : 'w-4 bg-secondary'
            }`}
          />
        ))}
      </div>

      {/* Conteúdo central */}
      <div className="flex flex-col items-center text-center space-y-6 max-w-xs w-full flex-1 justify-center">

        {/* Passo 1 — Apresentação */}
        {passo === 1 && (
          <>
            <div
              className="w-24 h-24 rounded-3xl overflow-hidden"
              style={{ boxShadow: '0 8px 32px oklch(0.62 0.18 162 / 40%)' }}
            >
              <img
                src="https://pub-c0bfb119504542e0b2e6ebc8f6b3b1df.r2.dev/user-uploads/user_37oySykXrlZ5YXKyzjL0vXOVtjM/8ef35207-ea13-4c6a-8dfe-458e04223f9f.png"
                alt="Tá Contado"
                className="w-full h-full object-cover"
                onError={e => {
                  const el = e.target as HTMLImageElement
                  el.style.display = 'none'
                  const p = el.parentElement!
                  p.style.background = 'oklch(0.48 0.16 162)'
                  p.innerHTML = '<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-weight:800;font-size:32px;color:white;font-family:Poppins,Inter,sans-serif;letter-spacing:1px">TC</span>'
                }}
              />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground leading-tight">Tá Contado</h1>
              <p className="text-base text-muted-foreground mt-2">Seu dinheiro organizado com IA</p>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[240px]">
              Registre gastos, receitas e dívidas conversando — sem complicação.
            </p>
          </>
        )}

        {/* Passo 2 — Nome */}
        {passo === 2 && (
          <>
            <div className="text-5xl leading-none">👋</div>
            <div>
              <h2 className="text-2xl font-display font-bold text-foreground">Como posso te chamar?</h2>
              <p className="text-sm text-muted-foreground mt-2">Para deixar a experiência mais pessoal!</p>
            </div>
            <input
              type="text"
              placeholder="Seu nome aqui..."
              value={nome}
              onChange={e => setNome(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && avancar()}
              autoFocus
              className="w-full bg-secondary text-foreground placeholder:text-muted-foreground rounded-2xl px-5 py-4 text-base outline-none border border-border focus:border-primary transition-colors text-center font-medium"
            />
          </>
        )}

        {/* Passo 3 — Pronto */}
        {passo === 3 && (
          <>
            <div className="text-6xl leading-none">🎉</div>
            <div>
              <h2 className="text-2xl font-display font-bold text-foreground">
                Tudo pronto{nome ? `, ${nome}` : ''}!
              </h2>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-[240px]">
                Agora é só começar. Use o chat para registrar gastos e receitas com facilidade.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Botão de avançar */}
      <button
        onClick={avancar}
        disabled={passo === 2 && !nome.trim()}
        className="w-full max-w-xs flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-white text-base transition-all disabled:opacity-40 active:scale-[0.98] mb-4"
        style={{ backgroundColor: 'oklch(0.62 0.18 162)', boxShadow: '0 4px 20px oklch(0.62 0.18 162 / 40%)' }}
      >
        {passo === 3 ? 'Começar' : 'Próximo'}
        <ChevronRight size={20} strokeWidth={2.5} />
      </button>
    </div>
  )
}
