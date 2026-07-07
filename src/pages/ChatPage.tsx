import { useState, useRef, useEffect } from 'react'
import { Mic, Send, WifiOff } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Mensagem {
  id: string
  tipo: 'usuario' | 'assistente'
  conteudo: string
  timestamp: Date
}

type IntencaoIA =
  | { acao: 'gasto'; descricao: string; valor: number; categoria: string }
  | { acao: 'receita'; descricao: string; valor: number; categoria: string }
  | { acao: 'divida'; descricao: string; valor: number }
  | { acao: 'resumo' }
  | { acao: 'conversa'; resposta: string }
  | { acao: 'pedir_valor'; item: string }

async function processarComIA(
  texto: string,
  totalGastos: number,
  totalReceitas: number,
  totalDividas: number
): Promise<IntencaoIA> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) throw new Error('VITE_OPENAI_API_KEY não configurada')

  const hoje = new Date().toLocaleDateString('pt-BR')
  const saldo = totalReceitas - totalGastos

  const systemPrompt = `Você é um assistente financeiro pessoal. Analise a mensagem do usuário e retorne um JSON com a intenção detectada.

Contexto financeiro atual do usuário:
- Gastos totais: R$ ${totalGastos.toFixed(2)}
- Receitas totais: R$ ${totalReceitas.toFixed(2)}
- Dívidas totais: R$ ${totalDividas.toFixed(2)}
- Saldo: R$ ${saldo.toFixed(2)}
- Data de hoje: ${hoje}

Retorne APENAS um JSON válido com uma das seguintes estruturas:

1. Para registrar um GASTO (compra, pagamento, despesa):
{"acao":"gasto","descricao":"nome curto do item","valor":número,"categoria":"Alimentação|Transporte|Saúde|Lazer|Compras|Moradia|Educação|Outros"}

2. Para registrar uma RECEITA (recebeu dinheiro, salário, freela):
{"acao":"receita","descricao":"fonte da receita","valor":número,"categoria":"Salário|Freela / Serviço|Venda|Investimento|Aluguel|Outros"}

3. Para registrar uma DÍVIDA (deve, empréstimo, cartão, financiamento):
{"acao":"divida","descricao":"nome da dívida","valor":número}

4. Para ver resumo/saldo (palavras como: resumo, saldo, como estou, quanto gastei, total):
{"acao":"resumo"}

5. Se menciona algo sem valor:
{"acao":"pedir_valor","item":"nome do item mencionado"}

6. Para perguntas gerais sobre finanças, dicas, ou qualquer outra conversa:
{"acao":"conversa","resposta":"sua resposta em português, máximo 2 frases, tom amigável e direto"}

Exemplos:
"almoço 25" → {"acao":"gasto","descricao":"Almoço","valor":25,"categoria":"Alimentação"}
"paguei conta de luz 150" → {"acao":"gasto","descricao":"Conta de luz","valor":150,"categoria":"Moradia"}
"fui no mercado e gastei 200" → {"acao":"gasto","descricao":"Mercado","valor":200,"categoria":"Alimentação"}
"salário 4500" → {"acao":"receita","descricao":"Salário","valor":4500,"categoria":"Salário"}
"recebi 800 de freela" → {"acao":"receita","descricao":"Freela","valor":800,"categoria":"Freela / Serviço"}
"parcela do carro 600" → {"acao":"divida","descricao":"Parcela do carro","valor":600}
"devo 2000 no cartão" → {"acao":"divida","descricao":"Cartão de crédito","valor":2000}
"25,90 no lanche" → {"acao":"gasto","descricao":"Lanche","valor":25.90,"categoria":"Alimentação"}
"como estou esse mês?" → {"acao":"resumo"}
"comprei roupa" → {"acao":"pedir_valor","item":"roupa"}

IMPORTANTE: Retorne SOMENTE o JSON, sem texto adicional, sem markdown.`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: texto },
      ],
      max_tokens: 150,
      temperature: 0.1,
    }),
  })

  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`)

  const data = await response.json()
  const raw = data.choices?.[0]?.message?.content?.trim() ?? '{}'
  return JSON.parse(raw) as IntencaoIA
}

function fmtValor(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function gerarMsgInicial(): string {
  const msgIA = localStorage.getItem('onboarding_msg_ia')
  if (msgIA) {
    localStorage.removeItem('onboarding_msg_ia')
    return msgIA
  }

  const objetivo = localStorage.getItem('onboarding_objetivo') || ''
  const renda = parseFloat(localStorage.getItem('onboarding_renda') || '0')
  const nome = localStorage.getItem('user_name') || ''
  const primeiro = nome.split(' ')[0]

  const saudacao = primeiro ? `Oi, ${primeiro}! 👋` : 'Olá! 👋'

  const linhaObjetivo: Record<string, string> = {
    organizar: 'Vamos organizar seus gastos juntos e descobrir para onde seu dinheiro está indo.',
    dividas: 'Vamos traçar um plano para você sair das dívidas e respirar aliviado.',
    economizar: 'Vamos te ajudar a juntar dinheiro todo mês com controle real dos seus gastos.',
    investir: 'Vamos organizar suas finanças para você começar a investir em breve.',
  }
  const descObjetivo = linhaObjetivo[objetivo] || 'Estou aqui para te ajudar a controlar suas finanças.'

  let sugestao = '\nComece registrando algo agora:'
  if (renda > 0) {
    const metaSugerida = Math.round(renda * 0.3 / 100) * 100
    sugestao += `\n\n💡 Com renda de ~R$ ${renda.toLocaleString('pt-BR')}, uma boa meta é guardar R$ ${metaSugerida.toLocaleString('pt-BR')} por mês.`
  }
  sugestao += '\n\n"Almoço 25 reais"\n"Recebi 3000 de freela"\n"Devo 500 no Nubank"'

  return `${saudacao}\n\n${descObjetivo}${sugestao}`
}

const MSG_INICIAL: Mensagem = {
  id: '0',
  tipo: 'assistente',
  conteudo: gerarMsgInicial(),
  timestamp: new Date(),
}

export default function ChatPage() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([MSG_INICIAL])
  const [input, setInput] = useState('')
  const [gravando, setGravando] = useState(false)
  const [offline, setOffline] = useState(!navigator.onLine)
  const [processando, setProcessando] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

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

  const enviar = async () => {
    const texto = input.trim()
    if (!texto || processando) return

    const msgUsuario: Mensagem = {
      id: Date.now().toString(),
      tipo: 'usuario',
      conteudo: texto,
      timestamp: new Date(),
    }
    setMensagens(prev => [...prev, msgUsuario])
    setInput('')
    setProcessando(true)

    try {
      const intencao = await processarComIA(texto, totalGastos, totalReceitas, totalDividas)
      const hoje = new Date().toISOString().split('T')[0]
      let resposta = ''

      if (intencao.acao === 'gasto') {
        await adicionarGasto({ descricao: intencao.descricao, valor: intencao.valor, categoria: intencao.categoria, data: hoje })
        resposta = `Gasto de R$ ${fmtValor(intencao.valor)} registrado em ${intencao.categoria}!`
      } else if (intencao.acao === 'receita') {
        await adicionarReceita({ descricao: intencao.descricao, categoria: intencao.categoria, valor: intencao.valor, tipo: 'recebido', data: hoje })
        resposta = `Receita de R$ ${fmtValor(intencao.valor)} registrada em ${intencao.categoria}!`
      } else if (intencao.acao === 'divida') {
        await adicionarDivida({ nome: intencao.descricao, tipo: 'outros', valor_total: intencao.valor, valor_pago: 0, parcelado: false })
        resposta = `Dívida de R$ ${fmtValor(intencao.valor)} registrada!`
      } else if (intencao.acao === 'resumo') {
        const saldo = totalReceitas - totalGastos
        resposta = `Seu resumo atual:\n\nGastos: R$ ${fmtValor(totalGastos)}\nReceitas: R$ ${fmtValor(totalReceitas)}\nDívidas: R$ ${fmtValor(totalDividas)}\n\nSaldo: R$ ${fmtValor(saldo)}`
      } else if (intencao.acao === 'pedir_valor') {
        resposta = `Qual o valor de ${intencao.item}? Por exemplo:\n"${intencao.item} 50 reais"`
      } else if (intencao.acao === 'conversa') {
        resposta = intencao.resposta
      }

      setMensagens(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        tipo: 'assistente',
        conteudo: resposta,
        timestamp: new Date(),
      }])
    } catch {
      setMensagens(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        tipo: 'assistente',
        conteudo: 'Não consegui processar agora. Tente novamente em instantes.',
        timestamp: new Date(),
      }])
    } finally {
      setProcessando(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviar() }
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
                  src="https://pub-c0bfb119504542e0b2e6ebc8f6b3b1df.r2.dev/user-uploads/user_37oySykXrlZ5YXKyzjL0vXOVtjM/8ef35207-ea13-4c6a-8dfe-458e04223f9f.png"
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
                  : { backgroundColor: 'oklch(0.22 0.04 240)', boxShadow: '0 1px 6px oklch(0 0 0 / 20%)' }
              }
            >
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.conteudo}</p>
              <p className="text-[10px] mt-1.5 opacity-40 text-right">
                {format(msg.timestamp, "HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
        ))}
        {processando && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-xl overflow-hidden shrink-0 mr-2 mt-0.5" style={{ background: 'oklch(0.48 0.16 162)' }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: '10px', fontWeight: 800, color: 'white', fontFamily: 'Poppins,sans-serif' }}>TC</span>
            </div>
            <div className="rounded-2xl rounded-bl-md px-4 py-3" style={{ backgroundColor: 'oklch(0.22 0.04 240)', boxShadow: '0 1px 6px oklch(0 0 0 / 20%)' }}>
              <div className="flex gap-1 items-center h-5">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t" style={{ borderColor: 'oklch(1 0 0 / 8%)' }}>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleGravacao}
            disabled={processando}
            className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-colors ${
              gravando ? 'bg-destructive text-white' : 'bg-secondary text-muted-foreground hover:text-foreground'
            } disabled:opacity-50`}
          >
            <Mic size={17} />
          </button>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={processando}
            placeholder={processando ? 'Processando...' : 'Gasto, receita, dívida...'}
            className="flex-1 bg-secondary text-foreground placeholder:text-muted-foreground rounded-full px-4 py-2.5 text-sm outline-none border border-border focus:border-primary transition-colors disabled:opacity-60"
          />
          <button
            onClick={() => void enviar()}
            disabled={processando}
            className="w-11 h-11 rounded-full text-primary-foreground flex items-center justify-center shrink-0 active:scale-95 transition-transform disabled:opacity-50"
            style={{ backgroundColor: 'oklch(0.62 0.18 162)' }}
          >
            <Send size={17} />
          </button>
        </div>
      </div>
    </div>
  )
}
