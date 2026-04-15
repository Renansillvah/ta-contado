import { useState, useRef, useEffect } from 'react'
import { Mic, Send, WifiOff, TrendingDown, TrendingUp, BarChart2, CreditCard } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const BOTOES_RAPIDOS = [
  { label: 'Gasto', Icon: TrendingDown, exemplo: 'Almoço 25 reais', color: 'text-destructive' },
  { label: 'Recebi', Icon: TrendingUp, exemplo: 'Recebi 3000 de salário', color: 'text-primary' },
  { label: 'Resumo', Icon: BarChart2, exemplo: 'Resumo do mês', color: 'text-blue-400' },
  { label: 'Dívida', Icon: CreditCard, exemplo: 'Devo 800 no Nubank', color: 'text-orange-400' },
]

interface Mensagem {
  id: string
  tipo: 'usuario' | 'assistente'
  conteudo: string
  timestamp: Date
}

const MSG_INICIAL: Mensagem = {
  id: '0',
  tipo: 'assistente',
  conteudo: `Olá! Bem-vindo ao Tá Contato!\n\nMe conta teus gastos, receitas e dívidas:\n\n"Almoço 25 reais"\n"Recebi 3 mil de freela"\n"Devo 800 no Nubank"\n"Como foi abril?"\n\nUse os botões abaixo ou o microfone!`,
  timestamp: new Date(),
}

const REGEX_RECEITA = /(?:recebi|ganhei|entrou|freela|salário|pagamento|venda)\s*(?:de\s+)?(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i
const REGEX_DIVIDA = /(?:devo|tenho\s+(?:uma\s+)?dívida|cartão|financiamento|empréstimo)\s*(?:de\s+)?(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i
const REGEX_GASTO_KEYWORDS = /(?:gastei|paguei|comprei|almoço|lanche|café|jantar|gasolina|uber|ônibus|metrô|ifood|mercado|supermercado|farmácia|remédio|médico|cinema|bar|show|netflix|spotify|roupa|sapato|celular|eletrônico|aluguel|luz|água|internet|gás|curso|livro|escola)\s*[a-zA-Zçãõéíóúàèìòùâêîôûäëïöü]*\s*(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i
const REGEX_GASTO_GENERICO = /^(.+?)\s+(\d+(?:[.,]\d{1,2})?)(?:\s+reais?)?$/i

function detectarCategoria(texto: string): string {
  const t = texto.toLowerCase()
  if (/almoço|lanche|café|jantar|restaurante|ifood|delivery|mercado|supermercado|padaria|açougue|feira|doce|sorvete|pizza|hamburguer|sushi/.test(t)) return 'Alimentação'
  if (/uber|gasolina|ônibus|metrô|taxi|combustível|estacionamento|pedágio|transporte|moto|bicicleta/.test(t)) return 'Transporte'
  if (/farmácia|remédio|médico|dentista|hospital|consulta|exame|plano de saúde|saúde|academia/.test(t)) return 'Saúde'
  if (/cinema|bar|show|netflix|spotify|teatro|jogos|game|streaming|lazer|viagem|hotel|passeio/.test(t)) return 'Lazer'
  if (/roupa|sapato|celular|eletrônico|computador|notebook|tênis|bolsa|acessório|compras|shopping/.test(t)) return 'Compras'
  if (/aluguel|luz|água|internet|gás|condomínio|iptu|financiamento|moradia|casa|apartamento/.test(t)) return 'Moradia'
  if (/curso|livro|escola|faculdade|universidade|material|educação|diploma|treinamento/.test(t)) return 'Educação'
  return 'Outros'
}

function parseComando(
  texto: string,
  adicionarGasto: (g: any) => Promise<void>,
  adicionarReceita: (r: any) => Promise<void>,
  adicionarDivida: (d: any) => Promise<void>,
  totalGastos: number,
  totalReceitas: number,
  totalDividas: number
): string {
  const t = texto.toLowerCase().trim()
  const hoje = new Date().toISOString().split('T')[0]

  if (t.includes('resumo') || t.includes('como foi') || t.includes('saldo') || t.includes('total') || t.includes('quanto')) {
    const saldo = totalReceitas - totalGastos
    return `Seu resumo atual:\n\nGastos: R$ ${totalGastos.toFixed(2).replace('.', ',')}\nReceitas: R$ ${totalReceitas.toFixed(2).replace('.', ',')}\nDívidas: R$ ${totalDividas.toFixed(2).replace('.', ',')}\n\nSaldo: R$ ${saldo.toFixed(2).replace('.', ',')}`
  }

  const matchReceita = t.match(REGEX_RECEITA)
  if (matchReceita) {
    const valor = parseFloat(matchReceita[1].replace(',', '.'))
    if (valor > 0) {
      adicionarReceita({ descricao: texto.trim(), categoria: 'Outros', valor, tipo: 'recebido', data: hoje })
      return `Receita de R$ ${valor.toFixed(2).replace('.', ',')} registrada!`
    }
  }

  const matchDivida = t.match(REGEX_DIVIDA)
  if (matchDivida) {
    const valor = parseFloat(matchDivida[1].replace(',', '.'))
    if (valor > 0) {
      adicionarDivida({ nome: texto.trim(), tipo: 'outros', valor_total: valor, valor_pago: 0, parcelado: false })
      return `Dívida de R$ ${valor.toFixed(2).replace('.', ',')} registrada!`
    }
  }

  const matchGastoKw = t.match(REGEX_GASTO_KEYWORDS)
  if (matchGastoKw) {
    const valor = parseFloat(matchGastoKw[1].replace(',', '.'))
    if (valor > 0) {
      const categoria = detectarCategoria(texto)
      adicionarGasto({ descricao: texto.trim(), valor, categoria, data: hoje })
      return `Gasto de R$ ${valor.toFixed(2).replace('.', ',')} registrado em ${categoria}!`
    }
  }

  const matchGenerico = t.match(REGEX_GASTO_GENERICO)
  if (matchGenerico) {
    const valor = parseFloat(matchGenerico[2].replace(',', '.'))
    if (valor > 0 && valor < 100000) {
      const categoria = detectarCategoria(texto)
      adicionarGasto({ descricao: texto.trim(), valor, categoria, data: hoje })
      return `Gasto de R$ ${valor.toFixed(2).replace('.', ',')} registrado em ${categoria}!`
    }
  }

  if (/[a-zA-ZÀ-ú]/.test(t) && !/\d/.test(t)) {
    return `Qual o valor? Por exemplo:\n"${texto.trim()} 50 reais"`
  }

  return `Não entendi. Tente:\n• "Almoço 25 reais"\n• "Recebi 3000 de freela"\n• "Devo 500 no cartão"\n• "Resumo do mês"`
}

export default function ChatPage() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([MSG_INICIAL])
  const [input, setInput] = useState('')
  const [gravando, setGravando] = useState(false)
  const [offline, setOffline] = useState(!navigator.onLine)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const { adicionarGasto, adicionarReceita, adicionarDivida, totalGastos, totalReceitas, totalDividas } = useApp()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  const enviar = () => {
    const texto = input.trim()
    if (!texto) return

    const msgUsuario: Mensagem = {
      id: Date.now().toString(),
      tipo: 'usuario',
      conteudo: texto,
      timestamp: new Date(),
    }
    setMensagens(prev => [...prev, msgUsuario])
    setInput('')

    const resposta = parseComando(
      texto, adicionarGasto, adicionarReceita, adicionarDivida,
      totalGastos, totalReceitas, totalDividas
    )

    setTimeout(() => {
      const msgBot: Mensagem = {
        id: (Date.now() + 1).toString(),
        tipo: 'assistente',
        conteudo: resposta,
        timestamp: new Date(),
      }
      setMensagens(prev => [...prev, msgBot])
    }, 300)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() }
  }

  const toggleGravacao = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Seu navegador não suporta reconhecimento de voz')
      return
    }
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    const rec = new SpeechRecognition()
    rec.lang = 'pt-BR'
    rec.onstart = () => setGravando(true)
    rec.onend = () => setGravando(false)
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      setInput(transcript)
    }
    rec.start()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Banner offline */}
      {offline && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-destructive/12 border-b border-destructive/20 text-destructive text-xs font-medium">
          <WifiOff size={13} /> Sem conexão — tente novamente
        </div>
      )}

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {mensagens.map(msg => (
          <div key={msg.id} className={`flex ${msg.tipo === 'usuario' ? 'justify-end' : 'justify-start'}`}>
            {msg.tipo === 'assistente' && (
              <div className="w-7 h-7 rounded-xl overflow-hidden shrink-0 mr-2 mt-0.5">
                <img
                  src="https://pub-c0bfb119504542e0b2e6ebc8f6b3b1df.r2.dev/user-uploads/user_37oySykXrlZ5YXKyzjL0vXOVtjM/9e3294a7-c91c-4fdf-98f5-fc3099336a6e.png"
                  alt="TC"
                  className="w-full h-full object-cover"
                  onError={e => {
                    const el = e.target as HTMLImageElement
                    el.style.display = 'none'
                    const p = el.parentElement!
                    p.style.background = 'oklch(0.48 0.16 162)'
                    p.innerHTML = '<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:10px;font-weight:800;color:white;font-family:Poppins,sans-serif">TC</span>'
                  }}
                />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.tipo === 'usuario'
                  ? 'rounded-br-md text-primary-foreground'
                  : 'rounded-bl-md text-foreground'
              }`}
              style={
                msg.tipo === 'usuario'
                  ? { backgroundColor: 'oklch(0.48 0.16 162)', boxShadow: '0 2px 10px oklch(0.48 0.16 162 / 30%)' }
                  : { backgroundColor: 'oklch(0.16 0.012 250)', boxShadow: '0 1px 6px oklch(0 0 0 / 20%)' }
              }
            >
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.conteudo}</p>
              <p className="text-[10px] mt-1.5 opacity-40 text-right">
                {format(msg.timestamp, "HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t" style={{ borderColor: 'oklch(1 0 0 / 7%)' }}>
        {/* Botões rápidos */}
        <div className="flex gap-1.5 mb-3 overflow-x-auto">
          {BOTOES_RAPIDOS.map(b => (
            <button
              key={b.label}
              onClick={() => { setInput(b.exemplo); setTimeout(() => inputRef.current?.focus(), 50) }}
              className={`shrink-0 bg-secondary text-foreground text-[11px] rounded-full px-3 py-1.5 border border-border hover:border-primary transition-colors flex items-center gap-1.5 font-medium`}
            >
              <b.Icon size={11} className={b.color} />
              {b.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleGravacao}
            className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-colors ${
              gravando ? 'bg-destructive text-white' : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            <Mic size={17} />
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Gasto, receita, dívida..."
            className="flex-1 bg-secondary text-foreground placeholder:text-muted-foreground rounded-full px-4 py-2.5 text-sm outline-none border border-border focus:border-primary transition-colors"
          />
          <button
            onClick={enviar}
            className="w-11 h-11 rounded-full text-primary-foreground flex items-center justify-center shrink-0 active:scale-95 transition-transform"
            style={{ backgroundColor: 'oklch(0.62 0.18 162)' }}
          >
            <Send size={17} />
          </button>
        </div>
      </div>
    </div>
  )
}
