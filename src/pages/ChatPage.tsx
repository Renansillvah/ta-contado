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

const MSG_INICIAL: Mensagem = {
  id: '0',
  tipo: 'assistente',
  conteudo: `Olá! Bem-vindo ao Tá Contado!\n\nMe conta teus gastos, receitas e dívidas:\n\n"Almoço 25 reais"\n"Recebi 3 mil de freela"\n"Devo 800 no Nubank"\n"Como foi abril?"\n\nUse os botões abaixo ou o microfone!`,
  timestamp: new Date(),
}

const REGEX_RECEITA = /(?:recebi|ganhei|entrou|salário|pagamento)\s*(?:de\s+)?(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i
const REGEX_DIVIDA = /(?:devo|tenho\s+(?:uma\s+)?dívida|cartão|financiamento|empréstimo)\s*(?:de\s+)?(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i
const REGEX_GASTO_KEYWORDS = /(?:gastei|paguei|comprei|almoço|lanche|café|jantar|gasolina|uber|ônibus|metrô|ifood|mercado|supermercado|farmácia|remédio|médico|cinema|bar|show|netflix|spotify|roupa|sapato|celular|eletrônico|aluguel|luz|água|internet|gás|curso|livro|escola|tráfego|anúncio|equipamento)\s*[a-zA-Zçãõéíóúàèìòùâêîôûäëïöü\s]*\s*(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i
const REGEX_GASTO_GENERICO = /^(.+?)\s+(\d+(?:[.,]\d{1,2})?)(?:\s+reais?)?$/i

// ── Extrai descrição limpa removendo prefixos e o valor ─────────────────────
function extrairDescricao(texto: string): string {
  let desc = texto.trim()
  // Remove prefixos verbais
  desc = desc.replace(/^(?:gastei|paguei|comprei)\s+/i, '')
  // Remove o valor numérico e sufixo "reais" do final
  desc = desc.replace(/\s+r?\$?\s*\d+(?:[.,]\d{1,2})?\s*(?:reais?)?$/i, '')
  // Remove "de " solto no início
  desc = desc.replace(/^de\s+/i, '')
  // Capitaliza primeira letra
  desc = desc.charAt(0).toUpperCase() + desc.slice(1)
  return desc.trim() || texto.trim()
}

// ── Extrai descrição de receita removendo prefixos verbais ──────────────────
function extrairDescricaoReceita(texto: string): string {
  let desc = texto.trim()
  // Remove verbos de receita no início
  desc = desc.replace(/^(?:recebi|ganhei|entrou|vendi|salário de|pagamento de|ganho de)\s+/i, '')
  // Remove valor numérico no início (ex: "750 Show Barretos" → "Show Barretos")
  desc = desc.replace(/^(?:r\$\s*)?\d+(?:[.,]\d{1,2})?\s*(?:reais?)?\s*(?:de\s+)?/i, '')
  // Remove valor numérico no final
  desc = desc.replace(/\s+(?:r\$\s*)?\d+(?:[.,]\d{1,2})?\s*(?:reais?)?$/i, '')
  // Remove "de " solto no início
  desc = desc.replace(/^de\s+/i, '')
  desc = desc.trim()
  // Normaliza nomes conhecidos
  const lower = desc.toLowerCase()
  if (!desc || lower === 'motoboy' || lower === 'entrega') desc = 'Motoboy'
  else if (lower === 'drone') desc = 'Gravação drone'
  // Capitaliza e limita a 20 chars para não truncar na UI
  desc = desc.charAt(0).toUpperCase() + desc.slice(1)
  if (desc.length > 20) desc = desc.substring(0, 20).trim()
  return desc || texto.trim().substring(0, 20)
}

// ── Categoriza gastos ────────────────────────────────────────────────────────
function detectarCategoria(texto: string): string {
  const t = texto.toLowerCase()
  if (/almoço|lanche|café|jantar|restaurante|ifood|delivery|mercado|supermercado|padaria|açougue|feira|doce|sorvete|pizza|hamburguer|sushi|comida|refeição/.test(t)) return 'Alimentação'
  if (/uber|99|taxi|táxi|ônibus|metrô|estacionamento|pedágio|transporte|gasolina|combustível|etanol|moto|bicicleta|passagem/.test(t)) return 'Transporte'
  if (/farmácia|remédio|médico|dentista|hospital|consulta|exame|plano de saúde|saúde|academia|psicólogo/.test(t)) return 'Saúde'
  if (/cinema|bar|teatro|jogos|game|streaming|lazer|viagem|hotel|passeio|ingresso|evento|festa|show/.test(t)) return 'Lazer'
  if (/roupa|sapato|celular|eletrônico|computador|notebook|tênis|bolsa|acessório|compras|shopping/.test(t)) return 'Compras'
  if (/aluguel|luz|água|internet|gás|condomínio|iptu|financiamento|moradia|casa|apartamento/.test(t)) return 'Moradia'
  if (/curso|livro|escola|faculdade|universidade|material|diploma|treinamento/.test(t)) return 'Educação'
  if (/netflix|spotify|amazon|prime|disney|streaming/.test(t)) return 'Lazer'
  return 'Outros'
}

// ── Categoriza receitas ──────────────────────────────────────────────────────
function detectarCategoriaReceita(texto: string): string {
  const t = texto.toLowerCase()
  if (/show|apresentação|performance|música|cantor|cantora|banda|palco|evento musical/.test(t)) return 'Show / Música'
  if (/drone|gravação|filmagem|vídeo|foto|fotografia|edição|captação/.test(t)) return 'Drone / Vídeo'
  if (/motoboy|entrega|frete|delivery|courier|moto/.test(t)) return 'Motoboy / Entrega'
  if (/freela|freelance|serviço|trabalho|projeto|cliente|job|consultoria/.test(t)) return 'Freela / Serviço'
  if (/salário|salario|pagamento fixo|contracheque|mensal/.test(t)) return 'Salário'
  if (/aluguel|aluguei|locação/.test(t)) return 'Aluguel'
  if (/vendi|venda|vendeu|produto|mercadoria/.test(t)) return 'Venda'
  if (/investimento|dividendo|rendimento|juros|fundo|ação|cripto/.test(t)) return 'Investimento'
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
      const descricao = extrairDescricaoReceita(texto)
      const categoria = detectarCategoriaReceita(texto)
      adicionarReceita({ descricao, categoria, valor, tipo: 'recebido', data: hoje })
      return `Receita de R$ ${valor.toFixed(2).replace('.', ',')} registrada em ${categoria}!`
    }
  }

  const matchDivida = t.match(REGEX_DIVIDA)
  if (matchDivida) {
    const valor = parseFloat(matchDivida[1].replace(',', '.'))
    if (valor > 0) {
      const descricao = extrairDescricao(texto)
      adicionarDivida({ nome: descricao, tipo: 'outros', valor_total: valor, valor_pago: 0, parcelado: false })
      return `Dívida de R$ ${valor.toFixed(2).replace('.', ',')} registrada!`
    }
  }

  const matchGastoKw = t.match(REGEX_GASTO_KEYWORDS)
  if (matchGastoKw) {
    const valor = parseFloat(matchGastoKw[1].replace(',', '.'))
    if (valor > 0) {
      const descricao = extrairDescricao(texto)
      const categoria = detectarCategoria(texto)
      adicionarGasto({ descricao, valor, categoria, data: hoje })
      return `Gasto de R$ ${valor.toFixed(2).replace('.', ',')} registrado em ${categoria}!`
    }
  }

  const matchGenerico = t.match(REGEX_GASTO_GENERICO)
  if (matchGenerico) {
    const valor = parseFloat(matchGenerico[2].replace(',', '.'))
    if (valor > 0 && valor < 100000) {
      const descricao = extrairDescricao(texto)
      const categoria = detectarCategoria(texto)
      adicionarGasto({ descricao, valor, categoria, data: hoje })
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
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t" style={{ borderColor: 'oklch(1 0 0 / 8%)' }}>
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
