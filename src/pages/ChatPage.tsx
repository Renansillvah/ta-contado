import { useState, useRef, useEffect } from 'react'
import { Mic, Send } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Mensagem {
  id: string
  tipo: 'usuario' | 'assistente'
  conteudo: string
  timestamp: Date
}

const MSG_INICIAL: Mensagem = {
  id: '0',
  tipo: 'assistente',
  conteudo: `Olá! 👋 Agora você pode falar comigo sobre tudo:\n\n💸 "Almoço 25 reais"\n💰 "Recebi 3 mil de freela"\n💳 "Devo 800 no cartão Nubank"\n📊 "Como foi abril?"\n💡 "Qual meu saldo de março?"\n\nDigite ou use o 🎤 microfone!`,
  timestamp: new Date(),
}

// Regex para detectar receitas (verificado antes dos gastos)
const REGEX_RECEITA = /(?:recebi|ganhei|entrou|freela|salário|pagamento|venda)\s*(?:de\s+)?(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i

// Regex para detectar dívidas
const REGEX_DIVIDA = /(?:devo|tenho\s+(?:uma\s+)?dívida|cartão|financiamento|empréstimo)\s*(?:de\s+)?(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i

// Regex para detectar gastos com palavras-chave explícitas
const REGEX_GASTO_KEYWORDS = /(?:gastei|paguei|comprei|almoço|jantar|café|gasolina|uber|ifood|mercado|farmácia|luz|água|internet)\s*[a-zA-Zçã]*\s*(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i

// Regex genérico "descricao + valor" como fallback de gasto
const REGEX_GASTO_GENERICO = /^(.+?)\s+(\d+(?:[.,]\d{1,2})?)(?:\s+reais?)?$/i

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

  // 1. Resumo/Consulta — prioridade máxima
  if (t.includes('resumo') || t.includes('como foi') || t.includes('saldo') || t.includes('total') || t.includes('quanto')) {
    const saldo = totalReceitas - totalGastos
    return `📊 **Seu resumo atual:**\n\n💸 Total de gastos: R$ ${totalGastos.toFixed(2).replace('.', ',')}\n💰 Total de receitas: R$ ${totalReceitas.toFixed(2).replace('.', ',')}\n💳 Dívidas restantes: R$ ${totalDividas.toFixed(2).replace('.', ',')}\n\n💡 Saldo: R$ ${saldo.toFixed(2).replace('.', ',')}`
  }

  // 2. Receita — checar antes dos gastos (evita "aluguel recebido" virar gasto)
  const matchReceita = t.match(REGEX_RECEITA)
  if (matchReceita) {
    const valor = parseFloat(matchReceita[1].replace(',', '.'))
    if (valor > 0) {
      adicionarReceita({ descricao: texto.trim(), categoria: 'Outros', valor, tipo: 'recebido', data: hoje })
      return `✅ Receita de R$ ${valor.toFixed(2).replace('.', ',')} registrada! 💰`
    }
  }

  // 3. Dívida
  const matchDivida = t.match(REGEX_DIVIDA)
  if (matchDivida) {
    const valor = parseFloat(matchDivida[1].replace(',', '.'))
    if (valor > 0) {
      adicionarDivida({ nome: texto.trim(), tipo: 'outros', valor_total: valor, valor_pago: 0, parcelado: false })
      return `✅ Dívida de R$ ${valor.toFixed(2).replace('.', ',')} registrada! 💳`
    }
  }

  // 4. Gasto com palavra-chave explícita (almoço, gasolina, etc)
  const matchGastoKw = t.match(REGEX_GASTO_KEYWORDS)
  if (matchGastoKw) {
    const valor = parseFloat(matchGastoKw[1].replace(',', '.'))
    if (valor > 0) {
      adicionarGasto({ descricao: texto.trim(), valor, categoria: 'Outros', data: hoje })
      return `✅ Gasto de R$ ${valor.toFixed(2).replace('.', ',')} registrado! 💸`
    }
  }

  // 5. Fallback genérico: "descricao valor"
  const matchGenerico = t.match(REGEX_GASTO_GENERICO)
  if (matchGenerico) {
    const valor = parseFloat(matchGenerico[2].replace(',', '.'))
    if (valor > 0 && valor < 100000) {
      adicionarGasto({ descricao: texto.trim(), valor, categoria: 'Outros', data: hoje })
      return `✅ Gasto de R$ ${valor.toFixed(2).replace('.', ',')} registrado! 💸`
    }
  }

  return `🤔 Não entendi muito bem. Tente:\n• "Almoço 25 reais"\n• "Recebi 3000 de freela"\n• "Devo 500 no cartão"\n• "Resumo do mês"`
}

export default function ChatPage() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([MSG_INICIAL])
  const [input, setInput] = useState('')
  const [gravando, setGravando] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
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

    // Captura os valores atuais sincronamente antes do setTimeout
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
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {mensagens.map(msg => (
          <div key={msg.id} className={`flex ${msg.tipo === 'usuario' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.tipo === 'usuario'
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-card text-foreground rounded-bl-sm'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.conteudo}</p>
              <p className="text-xs mt-1 opacity-50 text-right">
                {format(msg.timestamp, "d 'de' MMM., HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleGravacao}
            className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-colors ${
              gravando ? 'bg-destructive text-white' : 'bg-secondary text-foreground'
            }`}
          >
            <Mic size={18} />
          </button>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Gasto, receita, dívida ou resumo..."
            className="flex-1 bg-secondary text-foreground placeholder:text-muted-foreground rounded-full px-4 py-2.5 text-sm outline-none border border-border focus:border-primary transition-colors"
          />
          <button
            onClick={enviar}
            className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
