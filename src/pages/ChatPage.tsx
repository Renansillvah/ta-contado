import { useState, useRef, useEffect } from 'react'
import { Mic, Send, WifiOff } from 'lucide-react'

function AudioBars({ volumes }: { volumes: [number, number, number] }) {
  return (
    <div className="flex items-end gap-[3px] h-[17px]">
      {volumes.map((v, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full transition-none"
          style={{
            height: `${Math.max(4, Math.round(v * 17))}px`,
            backgroundColor: 'oklch(0.62 0.18 162)',
          }}
        />
      ))}
    </div>
  )
}
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
  | { acao: 'gasto'; descricao: string; valor: number; categoria: string; comentario: string }
  | { acao: 'receita'; descricao: string; valor: number; categoria: string; comentario: string }
  | { acao: 'divida'; descricao: string; valor: number; comentario: string }
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

  const systemPrompt = `Você é um assistente financeiro pessoal brasileiro, acolhedor e direto como um amigo que entende de dinheiro. Analise a mensagem do usuário e retorne um JSON com a intenção detectada.

Contexto financeiro atual do usuário:
- Gastos totais: R$ ${totalGastos.toFixed(2)}
- Receitas totais: R$ ${totalReceitas.toFixed(2)}
- Dívidas totais: R$ ${totalDividas.toFixed(2)}
- Saldo: R$ ${saldo.toFixed(2)}
- Data de hoje: ${hoje}

Retorne APENAS um JSON válido com uma das seguintes estruturas:

1. Para registrar um GASTO (compra, pagamento, despesa):
{"acao":"gasto","descricao":"nome curto do item","valor":número,"categoria":"Alimentação|Transporte|Saúde|Lazer|Compras|Moradia|Educação|Outros","comentario":"frase curta e acolhedora, máx 8 palavras"}

2. Para registrar uma RECEITA (recebeu dinheiro, salário, freela):
{"acao":"receita","descricao":"fonte da receita","valor":número,"categoria":"Salário|Freela / Serviço|Venda|Investimento|Aluguel|Outros","comentario":"frase celebrando a receita, máx 8 palavras"}

3. Para registrar uma DÍVIDA (deve, empréstimo, cartão, financiamento):
{"acao":"divida","descricao":"nome da dívida","valor":número,"comentario":"frase encorajadora, sem julgamento, máx 8 palavras"}

4. Para ver resumo/saldo:
{"acao":"resumo"}

5. Se menciona algo sem valor:
{"acao":"pedir_valor","item":"nome do item mencionado"}

6. Para perguntas gerais sobre finanças ou conversa:
{"acao":"conversa","resposta":"sua resposta em português, máximo 2 frases, tom amigável"}

Regras para o campo "comentario":
- Máximo 8 palavras, tom caloroso e humano
- VARIE sempre — nunca repita a mesma frase
- Gastos necessários (mercado, luz, água, saúde): reconheça que faz parte
- Gastos de lazer (bar, cinema, viagem): celebre sem culpa
- Gastos altos: normalize sem julgamento
- Receitas: comemore genuinamente
- Dívidas: encoraje, nunca julgue
- NÃO use "Ótimo!", "Perfeito!", "Show!" genéricos
- Use linguagem brasileira natural: "Anotado!", "Tá registrado", "Aqui entre nós..."

Exemplos de comentarios:
gasto mercado 200 → "Alimentação em dia, isso é essencial!"
gasto bar 80 → "Merece um momento de lazer sim!"
gasto aluguel 1500 → "Teto garantido, isso é prioridade."
gasto farmácia 45 → "Saúde não tem preço, cuidado certo."
receita salário 4500 → "Chegou o salário! Bora cuidar bem dele."
receita freela 800 → "Freela no bolso, esforço valeu!"
divida cartão 2000 → "Anotei. Um passo de cada vez, vai passar."
divida empréstimo 5000 → "Registrado. Juntos vamos resolver isso."

Exemplos completos:
"almoço 25" → {"acao":"gasto","descricao":"Almoço","valor":25,"categoria":"Alimentação","comentario":"Almoço anotado, energia garantida!"}
"paguei conta de luz 150" → {"acao":"gasto","descricao":"Conta de luz","valor":150,"categoria":"Moradia","comentario":"Conta básica em dia, ótimo!"}
"recebi 800 de freela" → {"acao":"receita","descricao":"Freela","valor":800,"categoria":"Freela / Serviço","comentario":"Freela no bolso, esforço valeu!"}
"devo 2000 no cartão" → {"acao":"divida","descricao":"Cartão de crédito","valor":2000,"categoria":"outros","comentario":"Anotei. Um passo de cada vez."}

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
      max_tokens: 200,
      temperature: 0.7,
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

async function gerarCumprimentoDiario(
  nome: string,
  totalGastos: number,
  totalReceitas: number,
  totalDividas: number
): Promise<string> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) return ''

  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const primeiro = nome.split(' ')[0] || ''
  const saldo = totalReceitas - totalGastos

  const prompt = `Você é um assistente financeiro pessoal brasileiro, acolhedor como um amigo próximo.

Dados do usuário:
- Nome: ${primeiro || 'amigo'}
- Saudação do horário: ${saudacao}
- Gastos acumulados: R$ ${totalGastos.toFixed(2)}
- Receitas acumuladas: R$ ${totalReceitas.toFixed(2)}
- Dívidas: R$ ${totalDividas.toFixed(2)}
- Saldo atual: R$ ${saldo.toFixed(2)}

Gere uma mensagem de boas-vindas para o primeiro acesso do dia. Regras:
- Comece com "${saudacao}${primeiro ? `, ${primeiro}` : ''}!"
- Máximo 3 linhas curtas
- Mencione algo concreto do contexto financeiro (saldo, gastos, etc.) de forma natural
- Tom: caloroso, motivador, como amigo — não como app
- NÃO use markdown, asteriscos ou listas
- Termine com algo que convide o usuário a registrar algo ou checar o resumo
- Varie sempre, nunca use frases genéricas`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 120,
      temperature: 0.9,
    }),
  })

  if (!response.ok) return ''
  const data = await response.json()
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

const CHIPS_INICIAIS = [
  { label: 'Almoço hoje', input: 'Almoço ' },
  { label: 'Recebi dinheiro', input: 'Recebi ' },
  { label: 'Tenho uma dívida', input: 'Devo ' },
  { label: 'Ver meu resumo', input: 'Resumo do mês' },
]

interface ChatPageProps {
  inputInicial?: string
  onInputInicialUsado?: () => void
}

export default function ChatPage({ inputInicial, onInputInicialUsado }: ChatPageProps) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([MSG_INICIAL])
  const [input, setInput] = useState('')
  const [gravando, setGravando] = useState(false)
  const [volumes, setVolumes] = useState<[number, number, number]>([0.3, 0.6, 0.3])
  const [offline, setOffline] = useState(!navigator.onLine)
  const [processando, setProcessando] = useState(false)
  const [chipsVisiveis, setChipsVisiveis] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number | null>(null)

  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const { adicionarGasto, adicionarReceita, adicionarDivida, totalGastos, totalReceitas, totalDividas, user } = useApp()

  // Preenche input vindo do onboarding
  useEffect(() => {
    if (!inputInicial) return
    setInput(inputInicial)
    setChipsVisiveis(false)
    onInputInicialUsado?.()
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [inputInicial]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cumprimento diário — dispara uma vez por dia, aguarda o user carregar
  useEffect(() => {
    if (!user) return // aguarda autenticação

    const hoje = new Date().toISOString().split('T')[0]
    const ultimoCumprimento = localStorage.getItem('ultimo_cumprimento')
    if (ultimoCumprimento === hoje) return

    const nome = (user.user_metadata?.full_name as string | undefined)
      || localStorage.getItem('user_name')
      || ''

    gerarCumprimentoDiario(nome, totalGastos, totalReceitas, totalDividas).then(texto => {
      if (!texto) return
      localStorage.setItem('ultimo_cumprimento', hoje)
      setMensagens(prev => [...prev, {
        id: `cumprimento-${hoje}`,
        tipo: 'assistente',
        conteudo: texto,
        timestamp: new Date(),
      }])
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]) // dispara quando o user fica disponível

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  const enviarTexto = async (texto: string) => {
    if (!texto.trim() || processando) return

    const msgUsuario: Mensagem = {
      id: Date.now().toString(),
      tipo: 'usuario',
      conteudo: texto.trim(),
      timestamp: new Date(),
    }
    setMensagens(prev => [...prev, msgUsuario])
    setChipsVisiveis(false)
    setProcessando(true)

    try {
      const intencao = await processarComIA(texto.trim(), totalGastos, totalReceitas, totalDividas)
      const hoje = new Date().toISOString().split('T')[0]
      let resposta = ''

      if (intencao.acao === 'gasto') {
        await adicionarGasto({ descricao: intencao.descricao, valor: intencao.valor, categoria: intencao.categoria, data: hoje })
        resposta = `R$ ${fmtValor(intencao.valor)} em ${intencao.categoria} anotado.\n${intencao.comentario}`
      } else if (intencao.acao === 'receita') {
        await adicionarReceita({ descricao: intencao.descricao, categoria: intencao.categoria, valor: intencao.valor, tipo: 'recebido', data: hoje })
        resposta = `R$ ${fmtValor(intencao.valor)} de ${intencao.descricao} registrado.\n${intencao.comentario}`
      } else if (intencao.acao === 'divida') {
        await adicionarDivida({ nome: intencao.descricao, tipo: 'outros', valor_total: intencao.valor, valor_pago: 0, parcelado: false })
        resposta = `R$ ${fmtValor(intencao.valor)} de ${intencao.descricao} anotado.\n${intencao.comentario}`
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

  const enviar = async () => {
    const texto = input.trim()
    if (!texto) return
    setInput('')
    await enviarTexto(texto)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviar() }
  }

  const stopAudioAnalyser = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    if (audioCtxRef.current) audioCtxRef.current.close()
    audioCtxRef.current = null
    analyserRef.current = null
    streamRef.current = null
    animFrameRef.current = null
    setVolumes([0.3, 0.6, 0.3])
  }

  const startAudioAnalyser = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser
      ctx.createMediaStreamSource(stream).connect(analyser)

      const buf = new Uint8Array(analyser.frequencyBinCount)
      // Offsets para simular 3 bandas de frequência distintas
      const offsets: [number, number, number] = [2, 8, 18]

      const tick = () => {
        analyser.getByteFrequencyData(buf)
        setVolumes(offsets.map(o => {
          const slice = buf.slice(o, o + 4)
          const avg = Array.from(slice).reduce((s, v) => s + v, 0) / slice.length
          return Math.min(1, avg / 180)
        }) as [number, number, number])
        animFrameRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch {
      // sem permissão de microfone — ignora, barrinhas ficam estáticas
    }
  }

  const toggleGravacao = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Seu navegador não suporta reconhecimento de voz')
      return
    }
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    const rec = new SpeechRecognition()
    rec.lang = 'pt-BR'
    rec.onstart = () => {
      setGravando(true)
      void startAudioAnalyser()
    }
    rec.onend = () => {
      setGravando(false)
      stopAudioAnalyser()
    }
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

      {/* Chips de sugestão — visíveis só no início */}
      {chipsVisiveis && mensagens.length <= 2 && (
        <div className="px-4 pb-2 flex gap-2 flex-wrap animate-in fade-in duration-500">
          {CHIPS_INICIAIS.map(chip => (
            <button
              key={chip.label}
              onClick={() => {
                setChipsVisiveis(false)
                if (chip.input === 'Resumo do mês') {
                  void enviarTexto('Resumo do mês')
                } else {
                  setInput(chip.input)
                  inputRef.current?.focus()
                }
              }}
              className="text-xs px-3 py-1.5 rounded-full font-medium transition-all active:scale-95"
              style={{
                background: 'oklch(0.22 0.04 240)',
                border: '1px solid oklch(0.55 0.18 162 / 40%)',
                color: 'oklch(0.75 0.10 162)',
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="px-4 py-3 border-t" style={{ borderColor: 'oklch(1 0 0 / 8%)' }}>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleGravacao}
            disabled={processando}
            className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-colors ${
              gravando ? 'bg-secondary' : 'bg-secondary text-muted-foreground hover:text-foreground'
            } disabled:opacity-50`}
          >
            {gravando ? <AudioBars volumes={volumes} /> : <Mic size={17} />}
          </button>
          <input
            ref={inputRef}
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
