import { useState, useRef, useEffect } from 'react'
import { Mic, Send, WifiOff, Utensils, Car, HeartPulse, Gamepad2, ShoppingBag, Home, BookOpen, Wallet, CreditCard, TrendingUp } from 'lucide-react'
import { lerPerfil } from '@/lib/onboardingPerfil'

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

interface DadosUau {
  categoria: 'gasto' | 'receita' | 'divida'
  emoji: string
  label: string
  valor: number
  insight: string
  followUp: string
}

interface DadosRetorno {
  nome: string
  qtdLancamentos: number
  totalMovimentado: number
}

interface DadosEngajamento {
  dia: 2 | 3 | 5 | 7
  nome: string
  // dia 3
  totalOntem?: number
  // dia 7
  totalLancamentos?: number
  totalReceitas?: number
  totalGastos?: number
  categorias?: string[]
  insightIA?: string
}

interface Mensagem {
  id: string
  tipo: 'usuario' | 'assistente' | 'uau' | 'retorno' | 'engajamento'
  conteudo: string
  timestamp: Date
  uau?: DadosUau
  retorno?: DadosRetorno
  engajamento?: DadosEngajamento
}

type IntencaoIA =
  | { acao: 'gasto'; descricao: string; valor: number; categoria: string; comentario: string }
  | { acao: 'receita'; descricao: string; valor: number; categoria: string; comentario: string }
  | { acao: 'recebimento_parcelado'; descricao: string; valor_total: number; parcelas: number; comentario: string }
  | { acao: 'divida'; descricao: string; valor: number; parcelado?: boolean; parcelas?: number; comentario: string }
  | { acao: 'pagar_divida'; descricao: string; valor: number; comentario: string }
  | { acao: 'resumo' }
  | { acao: 'conversa'; resposta: string }
  | { acao: 'pedir_valor'; item: string }

async function chamarIAPontSegura(system: string, user: string, opts?: { max_tokens?: number; temperature?: number }): Promise<string> {
  const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-ai`
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!fnUrl || !anonKey) throw new Error('Supabase não configurado')

  const res = await fetch(fnUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
    body: JSON.stringify({ tipo: 'intencao', system, user, ...(opts || {}) }),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.erro || 'Erro na IA')
  return data.conteudo
}

async function processarComIA(
  texto: string,
  totalGastos: number,
  totalReceitas: number,
  totalDividas: number
): Promise<IntencaoIA> {
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

1. Para registrar um GASTO (compra, pagamento, despesa do dia a dia):
{"acao":"gasto","descricao":"nome curto do item","valor":número,"categoria":"Alimentação|Transporte|Saúde|Lazer|Compras|Moradia|Educação|Outros","comentario":"frase curta e acolhedora, máx 8 palavras"}

2. Para registrar uma RECEITA (recebeu dinheiro, salário, freela — valor à vista ou já recebido):
{"acao":"receita","descricao":"fonte da receita","valor":número,"categoria":"Salário|Freela / Serviço|Venda|Investimento|Aluguel|Outros","comentario":"frase celebrando a receita, máx 8 palavras"}

3. Para registrar um RECEBIMENTO PARCELADO (tem dinheiro para receber em parcelas futuras — é uma entrada, não uma dívida):
{"acao":"recebimento_parcelado","descricao":"descrição do recebimento","valor_total":número,"parcelas":número,"comentario":"frase animada, máx 8 palavras"}
Exemplos que ativam esta opção: "tenho 10 mil para receber em 10x", "vou receber 5000 em 5 vezes", "tenho uma parcela de 1000 para receber", "recebi 300 de 12 parcelas"
O "valor_total" deve ser o valor TOTAL (se disser R$10k em 10x → valor_total: 10000, parcelas: 10)

4. Para registrar uma DÍVIDA nova (deve, tomou empréstimo, financiamento, cartão):
{"acao":"divida","descricao":"nome da dívida","valor":número,"parcelado":false,"comentario":"frase encorajadora, sem julgamento, máx 8 palavras"}

5. Para registrar uma DÍVIDA PARCELADA (compra parcelada, financiamento em X vezes):
{"acao":"divida","descricao":"nome da dívida","valor":número,"parcelado":true,"parcelas":número_de_parcelas,"comentario":"frase encorajadora, máx 8 palavras"}
Exemplos que ativam esta opção: "comprei celular em 12x de 200", "financiei TV em 6 vezes", "parcelei a geladeira em 10x"
O "valor" deve ser o valor TOTAL da dívida (parcelas × valor da parcela se informado).

6. Para registrar PAGAMENTO de uma dívida existente (pagou parcela, abateu dívida):
{"acao":"pagar_divida","descricao":"nome da dívida paga","valor":número,"comentario":"frase encorajadora, máx 8 palavras"}
Exemplos que ativam esta opção: "paguei 500 do Nubank", "abati 200 da minha dívida", "paguei a parcela do financiamento", "quitei o cartão"

7. Para ver resumo/saldo:
{"acao":"resumo"}

8. Se menciona algo sem valor:
{"acao":"pedir_valor","item":"nome do item mencionado"}

9. Para perguntas gerais sobre finanças ou conversa:
{"acao":"conversa","resposta":"sua resposta em português, máximo 2 frases, tom amigável"}

REGRA CRÍTICA para diferenciar RECEBIMENTO PARCELADO de DÍVIDA PARCELADA:
- "tenho 10k para RECEBER em 10x" → recebimento_parcelado (dinheiro VAI ENTRAR no bolso)
- "vou receber 5000 em 5 vezes" → recebimento_parcelado
- "comprei celular em 12x" → divida (dinheiro VAI SAIR)
- A diferença fundamental: recebimento = dinheiro ENTRANDO, dívida = dinheiro SAINDO

REGRA CRÍTICA para diferenciar GASTO de PAGAMENTO DE DÍVIDA:
- "paguei a fatura do cartão" → pagar_divida (está quitando uma dívida)
- "paguei a parcela do empréstimo" → pagar_divida
- "abati minha dívida" → pagar_divida
- "comprei no cartão" → gasto (é uma nova compra/despesa)
- "paguei o almoço" → gasto (despesa do dia a dia)
- "paguei o aluguel" → gasto (despesa mensal)

Regras para o campo "comentario":
- Máximo 8 palavras, tom caloroso e humano
- VARIE sempre — nunca repita a mesma frase
- Gastos necessários (mercado, luz, água, saúde): reconheça que faz parte
- Gastos de lazer (bar, cinema, viagem): celebre sem culpa
- Receitas: comemore genuinamente
- Dívidas: encoraje, nunca julgue
- Pagamento de dívida: elogie o esforço
- NÃO use "Ótimo!", "Perfeito!", "Show!" genéricos
- Use linguagem brasileira natural: "Anotado!", "Tá registrado", "Aqui entre nós..."

Exemplos completos:
"almoço 25" → {"acao":"gasto","descricao":"Almoço","valor":25,"categoria":"Alimentação","comentario":"Almoço anotado, energia garantida!"}
"recebi 800 de freela" → {"acao":"receita","descricao":"Freela","valor":800,"categoria":"Freela / Serviço","comentario":"Freela no bolso, esforço valeu!"}
"tenho 10 mil para receber em 10x" → {"acao":"recebimento_parcelado","descricao":"Recebimento","valor_total":10000,"parcelas":10,"comentario":"Anotado! Vamos acompanhar cada parcela."}
"devo 2000 no cartão" → {"acao":"divida","descricao":"Cartão de crédito","valor":2000,"parcelado":false,"comentario":"Anotei. Um passo de cada vez."}
"comprei celular em 12x de 300" → {"acao":"divida","descricao":"Celular","valor":3600,"parcelado":true,"parcelas":12,"comentario":"Registrado! Vamos acompanhar juntos."}
"paguei 500 do Nubank" → {"acao":"pagar_divida","descricao":"Nubank","valor":500,"comentario":"Cada pagamento conta, ótimo!"}
"quitei a parcela do empréstimo" → {"acao":"pagar_divida","descricao":"Empréstimo","valor":0,"comentario":"Mais um passo para a liberdade!"}

IMPORTANTE: Retorne SOMENTE o JSON, sem texto adicional, sem markdown.`

  const raw = await chamarIAPontSegura(systemPrompt, texto, { max_tokens: 200, temperature: 0.7 })
  return JSON.parse(raw || '{}') as IntencaoIA
}

function fmtValor(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Chave que marca se a mensagem de boas-vindas pós-onboarding já foi exibida
const KEY_BOAS_VINDAS_EXIBIDA = 'chat_boas_vindas_exibida'

function gerarMsgBoasVindas(): string | null {
  // Só exibe uma vez
  if (localStorage.getItem(KEY_BOAS_VINDAS_EXIBIDA)) return null

  const perfil = lerPerfil()
  if (!perfil) return null

  const primeiro = perfil.nome.split(' ')[0] || 'você'

  const msgs: Record<string, string> = {
    dividas_1_2:
      `TC 🤝\n\nOlá, ${primeiro}!\n\nVocê me disse que tem dívidas para organizar.\n\nVamos começar por elas.\n\nMe diga qual é sua maior dívida atualmente.\n\nExemplo:\n"Devo R$ 3.000 no Nubank"\n\nPode escrever como se estivesse conversando com um amigo.`,

    dividas_3_5:
      `TC 🤝\n\nOlá, ${primeiro}!\n\nVocê me disse que tem algumas dívidas para organizar.\n\nVamos listar elas juntos.\n\nMe conta a primeira que vier na sua cabeça.\n\nExemplo:\n"Devo R$ 1.500 no cartão do Itaú"\n\nPode ir à vontade — sem julgamento aqui.`,

    dividas_mais_5:
      `TC 🤝\n\nOlá, ${primeiro}!\n\nEntendo que são várias dívidas — e tudo bem, vamos resolver uma de cada vez.\n\nComece me dizendo qual é a que mais te pesa agora.\n\nExemplo:\n"Devo R$ 5.000 no banco"\n\nDe uma em uma, a gente chega lá.`,

    guardar_reserva_emergencia:
      `TC 🤝\n\nOlá, ${primeiro}!\n\nVocê quer criar uma reserva de emergência — ótima escolha.\n\nPra montar um plano, preciso entender sua situação atual.\n\nQuanto você ganha por mês, aproximadamente?`,

    guardar_moto:
      `TC 🤝\n\nOlá, ${primeiro}!\n\nVocê quer guardar dinheiro para sua moto.\n\nVou te ajudar a chegar lá.\n\nPrimeiro preciso entender sua situação atual.\n\nQuanto você ganha por mês, aproximadamente?`,

    guardar_carro:
      `TC 🤝\n\nOlá, ${primeiro}!\n\nVocê quer guardar dinheiro para seu carro.\n\nVou te ajudar a chegar lá.\n\nPrimeiro preciso entender sua situação atual.\n\nQuanto você ganha por mês, aproximadamente?`,

    guardar_casa:
      `TC 🤝\n\nOlá, ${primeiro}!\n\nVocê quer guardar dinheiro para sua casa.\n\nGrande objetivo — vamos trabalhar nisso.\n\nPrimeiro preciso entender sua situação atual.\n\nQuanto você ganha por mês, aproximadamente?`,

    guardar_viagem:
      `TC 🤝\n\nOlá, ${primeiro}!\n\nVocê quer guardar dinheiro para uma viagem.\n\nVou te ajudar a chegar lá.\n\nPrimeiro preciso entender sua situação atual.\n\nQuanto você ganha por mês, aproximadamente?`,

    guardar_outro:
      `TC 🤝\n\nOlá, ${primeiro}!\n\nVocê tem um objetivo em mente — vamos juntos conquistá-lo.\n\nPara montar um plano, preciso entender sua situação atual.\n\nQuanto você ganha por mês, aproximadamente?`,

    nao_sei_gastos:
      `TC 🤝\n\nOlá, ${primeiro}!\n\nVocê quer entender para onde vai seu dinheiro.\n\nO primeiro passo é simples: registrar os gastos do dia a dia.\n\nMe conta um gasto de hoje — pode ser qualquer coisa.\n\nExemplo:\n"Almoço 18 reais"\n\nA partir daí, a gente vai enxergando o quadro completo.`,

    renda_variavel:
      `TC 🤝\n\nOlá, ${primeiro}!\n\nVocê tem renda variável — isso exige um controle um pouco diferente.\n\nO segredo é registrar tudo que entra e sai, mesmo nos meses difíceis.\n\nMe conta: esse mês você já recebeu alguma coisa?\n\nExemplo:\n"Recebi R$ 2.000 de freela"\n\nVamos começar pelo que entrou.`,

    comprar_algo:
      `TC 🤝\n\nOlá, ${primeiro}!\n\nVocê quer comprar algo específico — e eu vou te ajudar a chegar lá.\n\nPra isso, precisamos primeiro entender como está seu dinheiro agora.\n\nMe conta um gasto recente para começarmos.\n\nExemplo:\n"Mercado 150 reais"\n\nDevagar a gente constrói o caminho até seu objetivo.`,
  }

  // Monta a chave de lookup: desafio + resposta complementar
  const chave = `${perfil.desafio}_${perfil.respostaCompl}`
  const msg = msgs[chave] ?? msgs[perfil.desafio] ?? msgs['nao_sei_gastos']

  // Marca como exibida para não repetir
  localStorage.setItem(KEY_BOAS_VINDAS_EXIBIDA, '1')

  return msg
}

function gerarMsgInicial(): string {
  // 1. Tenta mensagem de boas-vindas pós-onboarding (primeira vez)
  const boasVindas = gerarMsgBoasVindas()
  if (boasVindas) return boasVindas

  // 2. Fallback: mensagem genérica para acessos posteriores
  const nome = localStorage.getItem('user_name') || ''
  const primeiro = nome.split(' ')[0]
  const saudacao = primeiro ? `Oi, ${primeiro}! 👋` : 'Olá! 👋'
  return `${saudacao}\n\nEstou aqui para te ajudar a controlar suas finanças.\n\nMe conta um gasto, receita ou dívida — pode escrever do jeito que quiser.\n\n"Almoço 25 reais"\n"Recebi 3000 de freela"\n"Devo 500 no Nubank"`
}

// MSG_INICIAL é criada uma vez por montagem do componente (dentro do useState)
// — não pode ser uma constante de módulo pois executaria antes da hidratação do localStorage

async function gerarCumprimentoDiario(
  nome: string,
  totalGastos: number,
  totalReceitas: number,
  totalDividas: number
): Promise<string> {
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

  try {
    return await chamarIAPontSegura('', prompt, { max_tokens: 120, temperature: 0.9 })
  } catch {
    return ''
  }
}

const CHIPS_INICIAIS = [
  { label: 'Almoço hoje', input: 'Almoço ' },
  { label: 'Recebi dinheiro', input: 'Recebi ' },
  { label: 'Tenho uma dívida', input: 'Devo ' },
  { label: 'Ver meu resumo', input: 'Resumo do mês' },
]

const KEY_UAU              = 'chat_momento_uau_exibido'
const KEY_ANCORAGEM        = 'chat_ancoragem_retorno_exibida'
const KEY_RETORNO_DIA      = 'chat_retorno_ultimo_dia'    // armazena "YYYY-MM-DD" do último retorno exibido
const KEY_ENGAJAMENTO_DIA  = 'chat_engajamento_dia_'      // sufixo: "2", "3", "5", "7"

function gerarUau(
  acao: 'gasto' | 'receita' | 'divida',
  descricao: string,
  valor: number,
  categoria: string,
): DadosUau | null {
  // Só dispara uma vez — no primeiro registro de qualquer tipo
  if (localStorage.getItem(KEY_UAU)) return null
  localStorage.setItem(KEY_UAU, '1')

  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  if (acao === 'divida') {
    const meses = Math.ceil(valor / 500)
    return {
      categoria: 'divida',
      emoji: 'divida',
      label: descricao,
      valor,
      insight: `Se você separar aproximadamente R$ 500 por mês, poderá quitar essa dívida em cerca de ${meses} ${meses === 1 ? 'mês' : 'meses'}.`,
      followUp: 'Quer adicionar mais dívidas para eu calcular sua situação completa?',
    }
  }

  if (acao === 'receita') {
    const reserva = Math.round(valor * 0.1 / 10) * 10
    return {
      categoria: 'receita',
      emoji: 'receita',
      label: descricao,
      valor,
      insight: `Você acabou de registrar sua primeira receita.\n\nGuardar pelo menos 10% — cerca de R$ ${fmt(reserva)} — é um ótimo começo para uma reserva de emergência.`,
      followUp: 'Quer registrar seus gastos para eu calcular quanto sobra no final do mês?',
    }
  }

  // gasto
  return {
    categoria: 'gasto',
    emoji: categoria,
    label: descricao,
    valor,
    insight: `Você acabou de registrar seu primeiro gasto.\n\nSe continuar registrando seus gastos diariamente, conseguirei mostrar exatamente para onde seu dinheiro está indo.`,
    followUp: 'Quer definir uma meta de gastos para este mês?',
  }
}

interface ChatPageProps {
  inputInicial?: string
  onInputInicialUsado?: () => void
}

export default function ChatPage({ inputInicial, onInputInicialUsado }: ChatPageProps) {
  const [mensagens, setMensagens] = useState<Mensagem[]>(() => [{
    id: '0',
    tipo: 'assistente',
    conteudo: gerarMsgInicial(),
    timestamp: new Date(),
  }])
  const [input, setInput] = useState('')
  const [gravando, setGravando] = useState(false)
  const [volumes, setVolumes] = useState<[number, number, number]>([0.3, 0.6, 0.3])
  const [offline, setOffline] = useState(!navigator.onLine)
  const [processando, setProcessando] = useState(false)
  const [chipsVisiveis, setChipsVisiveis] = useState(true)
  const [aguardandoNomeRecebimento, setAguardandoNomeRecebimento] = useState<{
    valor_total: number
    parcelas: number
    comentario: string
  } | null>(null)
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

  const { adicionarGasto, adicionarReceita, adicionarDivida, pagarDivida, totalGastos, totalReceitas, totalDividas, user, gastos, receitas, dividas, loading } = useApp()

  const dispararAncoragem = (nome: string) => {
    if (localStorage.getItem(KEY_ANCORAGEM)) return
    localStorage.setItem(KEY_ANCORAGEM, '1')
    const primeiro = nome.split(' ')[0] || 'você'
    const texto = `TC 🤝\n\n${primeiro}, você deu o primeiro passo! 🎯\n\nContinue registrando seus gastos e receitas do dia — quanto mais você lançar, mais insights vou conseguir te mostrar.\n\nPode continuar à vontade. Estou aqui! 💪`
    setTimeout(() => {
      setMensagens(prev => [...prev, {
        id: `ancoragem-${Date.now()}`,
        tipo: 'assistente',
        conteudo: texto,
        timestamp: new Date(),
      }])
    }, 4000)
  }

  // Preenche input vindo do onboarding
  useEffect(() => {
    if (!inputInicial) return
    setInput(inputInicial)
    setChipsVisiveis(false)
    onInputInicialUsado?.()
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [inputInicial]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cumprimento diário — dispara uma vez por dia, mas NÃO no dia do onboarding
  useEffect(() => {
    if (!user) return // aguarda autenticação

    const hoje = new Date().toISOString().split('T')[0]
    const ultimoCumprimento = localStorage.getItem('ultimo_cumprimento')
    if (ultimoCumprimento === hoje) return

    // Não exibe no mesmo dia em que o onboarding foi concluído
    const dataCriacao = localStorage.getItem('onboarding_data_criacao')
    if (dataCriacao && dataCriacao.split('T')[0] === hoje) return

    // Só exibe se o usuário já fez onboarding em algum dia anterior
    const onboardingFeito = !!localStorage.getItem('onboarding_concluido')
    if (!onboardingFeito) return

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

  // Retorno do segundo dia — dispara uma vez por dia quando há dados de dias anteriores
  useEffect(() => {
    if (!user || loading) return

    const onboardingConcluido = !!localStorage.getItem('onboarding_concluido')
    if (!onboardingConcluido) return

    const hoje = new Date().toISOString().split('T')[0]
    const ultimoRetorno = localStorage.getItem(KEY_RETORNO_DIA)
    if (ultimoRetorno === hoje) return // já exibiu hoje

    // Ontem
    const ontem = new Date()
    ontem.setDate(ontem.getDate() - 1)
    const ontemStr = ontem.toISOString().split('T')[0]

    // Coleta lançamentos de ontem (gastos + receitas + dívidas)
    const gastosOntem   = gastos.filter(g => g.data === ontemStr)
    const receitasOntem = receitas.filter(r => r.data === ontemStr)
    const dividasOntem  = dividas.filter(d => {
      if (!d.created_at) return false
      return d.created_at.split('T')[0] === ontemStr
    })

    const totalLancamentos = gastosOntem.length + receitasOntem.length + dividasOntem.length
    if (totalLancamentos === 0) return // sem dados de ontem, não exibe

    const totalMovimentado =
      gastosOntem.reduce((s, g) => s + Number(g.valor), 0) +
      receitasOntem.reduce((s, r) => s + Number(r.valor), 0) +
      dividasOntem.reduce((s, d) => s + Number(d.valor_total), 0)

    const nome = (user.user_metadata?.full_name as string | undefined)
      || localStorage.getItem('user_name')
      || ''

    localStorage.setItem(KEY_RETORNO_DIA, hoje)

    setTimeout(() => {
      setMensagens(prev => [...prev, {
        id: `retorno-${hoje}`,
        tipo: 'retorno',
        conteudo: '',
        timestamp: new Date(),
        retorno: { nome, qtdLancamentos: totalLancamentos, totalMovimentado },
      }])
    }, 800)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]) // dispara quando autenticação e dados estiverem prontos

  // Engajamento da primeira semana — dias 2, 3, 5, 7
  useEffect(() => {
    if (!user || loading) return

    const dataCriacaoStr = localStorage.getItem('onboarding_data_criacao')
    if (!dataCriacaoStr) return

    const dataCriacao = new Date(dataCriacaoStr)
    const agora = new Date()
    const diffMs = agora.getTime() - dataCriacao.getTime()
    const diaNro = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1 // dia 1 = dia do cadastro

    const diasEngajamento: Array<2 | 3 | 5 | 7> = [2, 3, 5, 7]
    const diaAtivo = diasEngajamento.find(d => d === diaNro)
    if (!diaAtivo) return

    const keyDia = KEY_ENGAJAMENTO_DIA + diaAtivo
    if (localStorage.getItem(keyDia)) return // já exibiu esse dia
    localStorage.setItem(keyDia, '1')

    const nome = (user.user_metadata?.full_name as string | undefined)
      || localStorage.getItem('user_name')
      || ''
    const primeiro = nome.split(' ')[0] || 'você'

    // Calcula dados para os cards mais ricos (dia 3, 5, 7)
    const ontem = new Date()
    ontem.setDate(ontem.getDate() - 1)
    const ontemStr = ontem.toISOString().split('T')[0]
    const totalOntem =
      gastos.filter(g => g.data === ontemStr).reduce((s, g) => s + Number(g.valor), 0) +
      receitas.filter(r => r.data === ontemStr).reduce((s, r) => s + Number(r.valor), 0)

    // Dados da semana toda para dia 7
    const inicioSemana = new Date(dataCriacao)
    const totalReceitasSemana  = receitas.reduce((s, r) => s + Number(r.valor), 0)
    const totalGastosSemana    = gastos.reduce((s, g) => s + Number(g.valor), 0)
    const totalLancamentosSemana = gastos.length + receitas.length + dividas.length

    // Top categorias da semana
    const catCount: Record<string, number> = {}
    gastos.forEach(g => { catCount[g.categoria] = (catCount[g.categoria] || 0) + 1 })
    const categorias = Object.entries(catCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat)

    // Insight simples baseado em saldo
    const saldo = totalReceitasSemana - totalGastosSemana
    const insightIA = saldo >= 0
      ? `Você terminou a semana com saldo positivo de R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Continue assim!`
      : `Seus gastos superaram as receitas em R$ ${Math.abs(saldo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} essa semana. Vamos ajustar na próxima semana.`

    void inicioSemana // usado implicitamente para contexto — evita lint warning

    setTimeout(() => {
      setMensagens(prev => [...prev, {
        id: `engajamento-dia${diaAtivo}-${Date.now()}`,
        tipo: 'engajamento',
        conteudo: '',
        timestamp: new Date(),
        engajamento: {
          dia: diaAtivo,
          nome,
          totalOntem,
          totalLancamentos: totalLancamentosSemana,
          totalReceitas: totalReceitasSemana,
          totalGastos: totalGastosSemana,
          categorias,
          insightIA,
        },
      }])
    }, 1200)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  // Lista de descrições genéricas que a IA costuma retornar quando o usuário não especifica o nome
  const DESCRICOES_GENERICAS = ['recebimento', 'recebimentos', 'parcela', 'parcelas', 'valor', 'pagamento', 'entrada']

  const registrarParcelado = async (descricao: string, valor_total: number, parcelas: number, comentario: string) => {
    const valorParcela = valor_total / parcelas
    const hoje2 = new Date()
    for (let i = 0; i < parcelas; i++) {
      const dataVenc = new Date(hoje2.getFullYear(), hoje2.getMonth() + i, hoje2.getDate())
      const dataStr = dataVenc.toISOString().split('T')[0]
      await adicionarReceita({
        descricao: parcelas > 1 ? `${descricao} (${i + 1}/${parcelas}x)` : descricao,
        categoria: 'Recebimento',
        valor: valorParcela,
        tipo: 'a_receber',
        data: dataStr,
      })
    }
    return valorParcela
  }

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

    // Se estamos aguardando o nome do recebimento, usa o texto como nome
    if (aguardandoNomeRecebimento) {
      const { valor_total, parcelas, comentario } = aguardandoNomeRecebimento
      const nomeInformado = texto.trim()
      setAguardandoNomeRecebimento(null)
      setProcessando(true)
      try {
        const valorParcela = await registrarParcelado(nomeInformado, valor_total, parcelas, comentario)
        setMensagens(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          tipo: 'assistente',
          conteudo: `"${nomeInformado}" registrado! ${parcelas}x de R$ ${fmtValor(valorParcela)}. ${comentario}\n\nVeja e marque cada parcela como recebida em **Receitas > Recebimentos**.`,
          timestamp: new Date(),
        }])
      } catch {
        setMensagens(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          tipo: 'assistente',
          conteudo: 'Não consegui salvar. Tente novamente.',
          timestamp: new Date(),
        }])
      } finally {
        setProcessando(false)
      }
      return
    }

    setProcessando(true)

    try {
      const intencao = await processarComIA(texto.trim(), totalGastos, totalReceitas, totalDividas)
      const hoje = new Date().toISOString().split('T')[0]
      let resposta = ''

      if (intencao.acao === 'gasto') {
        await adicionarGasto({ descricao: intencao.descricao, valor: intencao.valor, categoria: intencao.categoria, data: hoje })
        const uau = gerarUau('gasto', intencao.descricao, intencao.valor, intencao.categoria)
        if (uau) {
          setMensagens(prev => [...prev, { id: (Date.now() + 1).toString(), tipo: 'uau', conteudo: '', timestamp: new Date(), uau }])
          dispararAncoragem(localStorage.getItem('user_name') || '')
          setProcessando(false)
          return
        }
        resposta = `R$ ${fmtValor(intencao.valor)} em ${intencao.categoria} anotado.\n${intencao.comentario}`
      } else if (intencao.acao === 'receita') {
        await adicionarReceita({ descricao: intencao.descricao, categoria: intencao.categoria, valor: intencao.valor, tipo: 'recebido', data: hoje })
        const uau = gerarUau('receita', intencao.descricao, intencao.valor, intencao.categoria)
        if (uau) {
          setMensagens(prev => [...prev, { id: (Date.now() + 1).toString(), tipo: 'uau', conteudo: '', timestamp: new Date(), uau }])
          dispararAncoragem(localStorage.getItem('user_name') || '')
          setProcessando(false)
          return
        }
        resposta = `R$ ${fmtValor(intencao.valor)} de ${intencao.descricao} registrado.\n${intencao.comentario}`
      } else if (intencao.acao === 'recebimento_parcelado') {
        const parcelas = intencao.parcelas || 1
        const descricaoLower = intencao.descricao.trim().toLowerCase()
        const isGenerica = DESCRICOES_GENERICAS.some(g => descricaoLower === g || descricaoLower === g + 's')

        if (isGenerica) {
          // Guarda os dados e pede o nome
          setAguardandoNomeRecebimento({ valor_total: intencao.valor_total, parcelas, comentario: intencao.comentario })
          resposta = `Anotei! ${parcelas}x de R$ ${fmtValor(intencao.valor_total / parcelas)}.\n\nMas preciso saber: **de quem ou o quê** você vai receber? Pode me dizer o nome? (ex: "Cheque da obra", "João Silva", "Venda do carro")`
        } else {
          const valorParcela = await registrarParcelado(intencao.descricao, intencao.valor_total, parcelas, intencao.comentario)
          resposta = `Registrei ${parcelas}x de R$ ${fmtValor(valorParcela)} para receber. ${intencao.comentario}\n\nVeja e marque cada parcela como recebida em **Receitas > Recebimentos**.`
        }
      } else if (intencao.acao === 'divida') {
        const isParcelado = !!intencao.parcelado
        await adicionarDivida({
          nome: intencao.descricao,
          tipo: 'outros',
          valor_total: intencao.valor,
          valor_pago: 0,
          parcelado: isParcelado,
          parcelas: isParcelado ? (intencao.parcelas ?? undefined) : undefined,
          parcela_atual: isParcelado ? 0 : undefined,
        })
        const uau = gerarUau('divida', intencao.descricao, intencao.valor, 'outros')
        if (uau) {
          setMensagens(prev => [...prev, { id: (Date.now() + 1).toString(), tipo: 'uau', conteudo: '', timestamp: new Date(), uau }])
          dispararAncoragem(localStorage.getItem('user_name') || '')
          setProcessando(false)
          return
        }
        if (isParcelado && intencao.parcelas) {
          const parcela = intencao.valor / intencao.parcelas
          resposta = `${intencao.descricao} parcelado em ${intencao.parcelas}x de R$ ${fmtValor(parcela)} registrado.\n${intencao.comentario}`
        } else {
          resposta = `R$ ${fmtValor(intencao.valor)} de ${intencao.descricao} anotado.\n${intencao.comentario}`
        }
      } else if (intencao.acao === 'pagar_divida') {
        // Tenta encontrar a dívida pelo nome para abater o valor
        const dividaEncontrada = dividas.find(d => {
          const nomeLower = d.nome.toLowerCase()
          const descLower = intencao.descricao.toLowerCase()
          return nomeLower.includes(descLower) || descLower.includes(nomeLower)
        })

        if (dividaEncontrada && intencao.valor > 0) {
          await pagarDivida(dividaEncontrada.id, intencao.valor)
          const restante = Math.max(0, Number(dividaEncontrada.valor_total) - Number(dividaEncontrada.valor_pago) - intencao.valor)
          resposta = `Pagamento de R$ ${fmtValor(intencao.valor)} na dívida "${dividaEncontrada.nome}" registrado! ✅\n${intencao.comentario}${restante > 0 ? `\n\nRestam R$ ${fmtValor(restante)} para quitar.` : '\n\nDívida quitada! 🎉'}`
        } else if (intencao.valor === 0) {
          // IA não identificou o valor — pede confirmação
          resposta = `Entendi que você pagou parte da dívida "${intencao.descricao}".\n\nQual foi o valor pago? Por exemplo:\n"Paguei R$ 300 do ${intencao.descricao}"`
        } else {
          // Dívida não encontrada pelo nome — orienta o usuário
          resposta = `Registrei o pagamento de R$ ${fmtValor(intencao.valor)} como gasto.\n\nPara abater de uma dívida específica, acesse a aba **Dívidas** e clique em **Pagar** na dívida desejada.\n\n${intencao.comentario}`
          // Registra como gasto avulso para não perder o dado
          await adicionarGasto({ descricao: `Pagamento: ${intencao.descricao}`, valor: intencao.valor, categoria: 'Outros', data: hoje })
        }
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
      <style>{`
        @keyframes uauEntrada {
          0%   { opacity: 0; transform: translateY(12px) scale(0.97); }
          100% { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
      {/* Banner offline */}
      {offline && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-destructive/12 border-b border-destructive/20 text-destructive text-xs font-medium">
          <WifiOff size={13} /> Sem conexão — tente novamente
        </div>
      )}

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {mensagens.map(msg => {
          // ── Engajamento da primeira semana ──────────────────────
          if (msg.tipo === 'engajamento' && msg.engajamento) {
            const e = msg.engajamento
            const primeiro = e.nome.split(' ')[0] || 'você'
            const fmt2 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })

            // Dia 2 — hábito simples
            if (e.dia === 2) {
              return (
                <div key={msg.id} className="flex justify-start" style={{ animation: 'uauEntrada 0.45s cubic-bezier(0.22,1,0.36,1)' }}>
                  <div className="w-7 h-7 rounded-xl overflow-hidden shrink-0 mr-2 mt-0.5" style={{ background: 'oklch(0.48 0.16 162)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: '10px', fontWeight: 800, color: 'white', fontFamily: 'Poppins,sans-serif' }}>TC</span>
                  </div>
                  <div className="flex-1 max-w-[84%]">
                    <div className="rounded-2xl rounded-bl-md px-4 py-3.5 space-y-2" style={{ backgroundColor: 'oklch(0.22 0.04 240)', boxShadow: '0 1px 6px oklch(0 0 0 / 20%)' }}>
                      <p className="text-sm font-semibold text-foreground">TC 🤝</p>
                      <p className="text-sm text-foreground leading-relaxed">
                        Você sabia que acompanhar seus gastos regularmente ajuda a tomar decisões financeiras melhores?
                      </p>
                      <div className="rounded-xl px-3 py-2.5 my-1" style={{ background: 'oklch(0.48 0.16 162 / 10%)', border: '1px solid oklch(0.55 0.18 162 / 25%)' }}>
                        <p className="text-[13px] font-semibold" style={{ color: 'oklch(0.72 0.15 162)' }}>
                          💪 Você está no dia 2 da sua jornada.
                        </p>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">
                        Continue registrando seus gastos hoje e vou começar a mostrar padrões interessantes sobre seus hábitos financeiros.
                      </p>
                      <p className="text-[10px] mt-1 opacity-40 text-right">
                        {format(msg.timestamp, 'HH:mm', { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                </div>
              )
            }

            // Dia 3 — progresso de ontem + pergunta
            if (e.dia === 3) {
              return (
                <div key={msg.id} className="flex justify-start" style={{ animation: 'uauEntrada 0.45s cubic-bezier(0.22,1,0.36,1)' }}>
                  <div className="w-7 h-7 rounded-xl overflow-hidden shrink-0 mr-2 mt-0.5" style={{ background: 'oklch(0.48 0.16 162)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: '10px', fontWeight: 800, color: 'white', fontFamily: 'Poppins,sans-serif' }}>TC</span>
                  </div>
                  <div className="flex-1 max-w-[84%] space-y-2">
                    <div className="rounded-2xl rounded-bl-md px-4 py-3.5" style={{ backgroundColor: 'oklch(0.22 0.04 240)', boxShadow: '0 1px 6px oklch(0 0 0 / 20%)' }}>
                      <p className="text-sm font-semibold text-foreground mb-1.5">TC 🤝</p>
                      <p className="text-sm text-foreground">{primeiro}, vamos conferir seu progresso?</p>
                    </div>
                    {e.totalOntem! > 0 && (
                      <div className="rounded-2xl px-4 py-3.5" style={{ background: 'oklch(0.48 0.16 162 / 10%)', border: '1.5px solid oklch(0.55 0.18 162 / 30%)' }}>
                        <p className="text-[11px] mb-1" style={{ color: 'oklch(0.58 0.01 240)' }}>Ontem você movimentou</p>
                        <p className="text-[20px] font-black" style={{ color: 'oklch(0.62 0.18 162)', fontFamily: 'Poppins,sans-serif' }}>
                          R$ {fmt2(e.totalOntem!)}
                        </p>
                      </div>
                    )}
                    <div className="rounded-2xl rounded-bl-md px-4 py-3" style={{ backgroundColor: 'oklch(0.22 0.04 240)', boxShadow: '0 1px 6px oklch(0 0 0 / 20%)' }}>
                      <p className="text-sm text-foreground">Está satisfeito com esse resultado ou gostaria de melhorar algo?</p>
                      <p className="text-[10px] mt-2 opacity-40 text-right">
                        {format(msg.timestamp, 'HH:mm', { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                </div>
              )
            }

            // Dia 5 — marco dos 5 dias + botão Ver evolução
            if (e.dia === 5) {
              return (
                <div key={msg.id} className="flex justify-start" style={{ animation: 'uauEntrada 0.45s cubic-bezier(0.22,1,0.36,1)' }}>
                  <div className="w-7 h-7 rounded-xl overflow-hidden shrink-0 mr-2 mt-0.5" style={{ background: 'oklch(0.48 0.16 162)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: '10px', fontWeight: 800, color: 'white', fontFamily: 'Poppins,sans-serif' }}>TC</span>
                  </div>
                  <div className="flex-1 max-w-[84%] space-y-2">
                    <div className="rounded-2xl px-4 py-3.5" style={{ background: 'oklch(0.48 0.16 162 / 12%)', border: '1.5px solid oklch(0.55 0.18 162 / 35%)' }}>
                      <p className="text-[22px] font-black" style={{ color: 'oklch(0.62 0.18 162)', fontFamily: 'Poppins,sans-serif' }}>5 dias 🎯</p>
                      <p className="text-[13px] mt-0.5" style={{ color: 'oklch(0.72 0.12 162)' }}>
                        Você já está usando o Tá Contado há 5 dias!
                      </p>
                    </div>
                    <div className="rounded-2xl rounded-bl-md px-4 py-3.5" style={{ backgroundColor: 'oklch(0.22 0.04 240)', boxShadow: '0 1px 6px oklch(0 0 0 / 20%)' }}>
                      <p className="text-sm text-foreground leading-relaxed mb-3">
                        Isso já é o suficiente para começar a enxergar padrões nos seus gastos. Quer ver como você evoluiu nesses 5 dias?
                      </p>
                      <button
                        onClick={() => void enviarTexto('Resumo do mês')}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all active:scale-[0.97]"
                        style={{
                          background: 'oklch(0.48 0.16 162 / 15%)',
                          border: '1.5px solid oklch(0.55 0.18 162 / 40%)',
                          color: 'oklch(0.72 0.15 162)',
                        }}
                      >
                        📊 Ver evolução
                      </button>
                      <p className="text-[10px] mt-2.5 opacity-40 text-right">
                        {format(msg.timestamp, 'HH:mm', { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                </div>
              )
            }

            // Dia 7 — resumo completo da semana
            if (e.dia === 7) {
              const saldo = (e.totalReceitas ?? 0) - (e.totalGastos ?? 0)
              const saldoPositivo = saldo >= 0
              return (
                <div key={msg.id} className="flex justify-start" style={{ animation: 'uauEntrada 0.45s cubic-bezier(0.22,1,0.36,1)' }}>
                  <div className="w-7 h-7 rounded-xl overflow-hidden shrink-0 mr-2 mt-0.5" style={{ background: 'oklch(0.48 0.16 162)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: '10px', fontWeight: 800, color: 'white', fontFamily: 'Poppins,sans-serif' }}>TC</span>
                  </div>
                  <div className="flex-1 max-w-[84%] space-y-2">
                    {/* Cabeçalho */}
                    <div className="rounded-2xl rounded-bl-md px-4 py-3" style={{ backgroundColor: 'oklch(0.22 0.04 240)', boxShadow: '0 1px 6px oklch(0 0 0 / 20%)' }}>
                      <p className="text-sm font-semibold text-foreground">TC 🤝</p>
                      <p className="text-sm text-foreground mt-0.5">{primeiro}, você completou sua primeira semana! 🏆</p>
                    </div>

                    {/* Card de stats */}
                    <div className="rounded-2xl px-4 py-4 space-y-3" style={{ background: 'oklch(0.20 0.04 240)', border: '1.5px solid oklch(0.55 0.18 162 / 25%)' }}>
                      <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'oklch(0.58 0.01 240)' }}>Resumo da semana</p>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl px-3 py-2.5" style={{ background: 'oklch(0.48 0.16 162 / 10%)' }}>
                          <p className="text-[10px]" style={{ color: 'oklch(0.58 0.01 240)' }}>Lançamentos</p>
                          <p className="text-[17px] font-black text-foreground" style={{ fontFamily: 'Poppins,sans-serif' }}>{e.totalLancamentos ?? 0}</p>
                        </div>
                        <div className="rounded-xl px-3 py-2.5" style={{ background: saldoPositivo ? 'oklch(0.48 0.16 162 / 10%)' : 'oklch(0.55 0.16 20 / 10%)' }}>
                          <p className="text-[10px]" style={{ color: 'oklch(0.58 0.01 240)' }}>Saldo</p>
                          <p className="text-[17px] font-black" style={{ color: saldoPositivo ? 'oklch(0.62 0.18 162)' : 'oklch(0.65 0.20 25)', fontFamily: 'Poppins,sans-serif' }}>
                            {saldoPositivo ? '+' : '-'}R$ {fmt2(Math.abs(saldo))}
                          </p>
                        </div>
                        <div className="rounded-xl px-3 py-2.5" style={{ background: 'oklch(0.25 0.04 240 / 60%)' }}>
                          <p className="text-[10px]" style={{ color: 'oklch(0.58 0.01 240)' }}>Receitas</p>
                          <p className="text-[15px] font-bold text-foreground" style={{ fontFamily: 'Poppins,sans-serif' }}>R$ {fmt2(e.totalReceitas ?? 0)}</p>
                        </div>
                        <div className="rounded-xl px-3 py-2.5" style={{ background: 'oklch(0.25 0.04 240 / 60%)' }}>
                          <p className="text-[10px]" style={{ color: 'oklch(0.58 0.01 240)' }}>Gastos</p>
                          <p className="text-[15px] font-bold text-foreground" style={{ fontFamily: 'Poppins,sans-serif' }}>R$ {fmt2(e.totalGastos ?? 0)}</p>
                        </div>
                      </div>

                      {e.categorias && e.categorias.length > 0 && (
                        <div>
                          <p className="text-[10px] mb-1.5" style={{ color: 'oklch(0.58 0.01 240)' }}>Top categorias</p>
                          <div className="flex flex-wrap gap-1.5">
                            {e.categorias.map(cat => (
                              <span key={cat} className="text-[11px] px-2.5 py-1 rounded-full font-medium"
                                style={{ background: 'oklch(0.48 0.16 162 / 15%)', color: 'oklch(0.72 0.15 162)', border: '1px solid oklch(0.55 0.18 162 / 25%)' }}>
                                {cat}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Insight */}
                    <div className="rounded-2xl rounded-bl-md px-4 py-3" style={{ backgroundColor: 'oklch(0.22 0.04 240)', boxShadow: '0 1px 6px oklch(0 0 0 / 20%)' }}>
                      <p className="text-sm text-foreground leading-relaxed">{e.insightIA}</p>
                      <p className="text-sm mt-2 font-medium" style={{ color: 'oklch(0.62 0.18 162)' }}>
                        Continue registrando na segunda semana para eu te mostrar sua evolução!
                      </p>
                      <p className="text-[10px] mt-2 opacity-40 text-right">
                        {format(msg.timestamp, 'HH:mm', { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                </div>
              )
            }

            return null
          }

          // ── Retorno do segundo dia ───────────────────────────────
          if (msg.tipo === 'retorno' && msg.retorno) {
            const r = msg.retorno
            const primeiro = r.nome.split(' ')[0] || 'você'
            const hora = new Date().getHours()
            const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
            const saudacaoEmoji = hora < 12 ? '☀️' : hora < 18 ? '🌤️' : '🌙'
            const lancTxt = r.qtdLancamentos === 1
              ? '1 lançamento'
              : `${r.qtdLancamentos} lançamentos`

            return (
              <div key={msg.id} className="flex justify-start" style={{ animation: 'uauEntrada 0.45s cubic-bezier(0.22,1,0.36,1)' }}>
                {/* Avatar */}
                <div className="w-7 h-7 rounded-xl overflow-hidden shrink-0 mr-2 mt-0.5" style={{ background: 'oklch(0.48 0.16 162)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: '10px', fontWeight: 800, color: 'white', fontFamily: 'Poppins,sans-serif' }}>TC</span>
                </div>

                <div className="flex-1 max-w-[84%] space-y-2">
                  {/* Saudação */}
                  <div
                    className="rounded-2xl rounded-bl-md px-4 py-3"
                    style={{ backgroundColor: 'oklch(0.22 0.04 240)', boxShadow: '0 1px 6px oklch(0 0 0 / 20%)' }}
                  >
                    <p className="text-sm font-semibold text-foreground mb-0.5">TC 🤝</p>
                    <p className="text-sm text-foreground">{saudacao}, {primeiro}! {saudacaoEmoji}</p>
                    <p className="text-[11px] mt-1.5" style={{ color: 'oklch(0.58 0.01 240)' }}>Ontem você registrou:</p>
                  </div>

                  {/* Card de resumo de ontem */}
                  <div
                    className="rounded-2xl px-4 py-3.5 space-y-2"
                    style={{
                      background: 'oklch(0.48 0.16 162 / 10%)',
                      border: '1.5px solid oklch(0.55 0.18 162 / 30%)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">💸</span>
                        <p className="text-[13px] font-semibold text-foreground">{lancTxt}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">💰</span>
                        <p className="text-[13px]" style={{ color: 'oklch(0.58 0.01 240)' }}>Total movimentado</p>
                      </div>
                      <p
                        className="text-[14px] font-black"
                        style={{ color: 'oklch(0.62 0.18 162)', fontFamily: 'Poppins,sans-serif' }}
                      >
                        R$ {r.totalMovimentado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  {/* Convite */}
                  <div
                    className="rounded-2xl rounded-bl-md px-4 py-3"
                    style={{ backgroundColor: 'oklch(0.22 0.04 240)', boxShadow: '0 1px 6px oklch(0 0 0 / 20%)' }}
                  >
                    <p className="text-sm text-foreground mb-3">Hoje é um novo dia.<br />Já teve algum gasto ou recebimento?</p>

                    {/* Botões rápidos */}
                    <div className="flex flex-col gap-1.5">
                      {[
                        { emoji: '💸', label: 'Registrar gasto',  input: 'Gastei ' },
                        { emoji: '💰', label: 'Recebi algo',       input: 'Recebi ' },
                        { emoji: '📊', label: 'Ver meu resumo',    input: 'Resumo do mês' },
                      ].map(btn => (
                        <button
                          key={btn.label}
                          onClick={() => {
                            if (btn.input === 'Resumo do mês') {
                              void enviarTexto('Resumo do mês')
                            } else {
                              setInput(btn.input)
                              setChipsVisiveis(false)
                              setTimeout(() => inputRef.current?.focus(), 50)
                            }
                          }}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] font-medium transition-all active:scale-[0.97] text-left"
                          style={{
                            background: 'oklch(0.48 0.16 162 / 12%)',
                            border: '1px solid oklch(0.55 0.18 162 / 30%)',
                            color: 'oklch(0.75 0.12 162)',
                          }}
                        >
                          <span>{btn.emoji}</span>
                          {btn.label}
                        </button>
                      ))}
                    </div>

                    <p className="text-[10px] mt-2.5 opacity-40 text-right">
                      {format(msg.timestamp, 'HH:mm', { locale: ptBR })}
                    </p>
                  </div>
                </div>
              </div>
            )
          }

          // ── Mensagem UAU ────────────────────────────────────────
          if (msg.tipo === 'uau' && msg.uau) {
            const u = msg.uau
            const corBg = u.categoria === 'divida'
              ? 'oklch(0.58 0.14 205 / 12%)'
              : u.categoria === 'receita'
              ? 'oklch(0.48 0.16 162 / 12%)'
              : 'oklch(0.48 0.16 162 / 10%)'
            const corBorda = u.categoria === 'divida'
              ? 'oklch(0.58 0.14 205 / 35%)'
              : 'oklch(0.55 0.18 162 / 35%)'
            const corValor = u.categoria === 'divida'
              ? 'oklch(0.58 0.14 205)'
              : u.categoria === 'receita'
              ? 'oklch(0.62 0.18 162)'
              : 'oklch(0.60 0.20 20)'

            return (
              <div key={msg.id} className="flex justify-start" style={{ animation: 'uauEntrada 0.45s cubic-bezier(0.22,1,0.36,1)' }}>
                {/* Avatar TC */}
                <div className="w-7 h-7 rounded-xl overflow-hidden shrink-0 mr-2 mt-0.5" style={{ background: 'oklch(0.48 0.16 162)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: '10px', fontWeight: 800, color: 'white', fontFamily: 'Poppins,sans-serif' }}>TC</span>
                </div>

                <div className="flex-1 max-w-[82%] space-y-2">
                  {/* Linha "Registrado!" */}
                  <div
                    className="rounded-2xl rounded-bl-md px-4 py-3"
                    style={{ backgroundColor: 'oklch(0.22 0.04 240)', boxShadow: '0 1px 6px oklch(0 0 0 / 20%)' }}
                  >
                    <p className="text-sm font-semibold text-foreground">Registrado! ✅</p>
                  </div>

                  {/* Card visual do item */}
                  <div
                    className="rounded-2xl px-4 py-3.5"
                    style={{ background: corBg, border: `1.5px solid ${corBorda}` }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: corBg }}
                        >
                          {u.categoria === 'divida' && <CreditCard size={16} style={{ color: corValor }} />}
                          {u.categoria === 'receita' && <TrendingUp size={16} style={{ color: corValor }} />}
                          {u.categoria === 'gasto' && (() => {
                            const catIconMap: Record<string, React.ReactNode> = {
                              'Alimentação': <Utensils size={16} style={{ color: corValor }} />,
                              'Transporte':  <Car size={16} style={{ color: corValor }} />,
                              'Saúde':       <HeartPulse size={16} style={{ color: corValor }} />,
                              'Lazer':       <Gamepad2 size={16} style={{ color: corValor }} />,
                              'Compras':     <ShoppingBag size={16} style={{ color: corValor }} />,
                              'Moradia':     <Home size={16} style={{ color: corValor }} />,
                              'Educação':    <BookOpen size={16} style={{ color: corValor }} />,
                            }
                            return catIconMap[u.emoji] ?? <Wallet size={16} style={{ color: corValor }} />
                          })()}
                        </div>
                        <p className="text-[13px] font-semibold text-foreground leading-tight">{u.label}</p>
                      </div>
                      <p className="text-[15px] font-black" style={{ color: corValor, fontFamily: 'Poppins,sans-serif' }}>
                        R$ {u.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  {/* Insight */}
                  <div
                    className="rounded-2xl rounded-bl-md px-4 py-3"
                    style={{ backgroundColor: 'oklch(0.22 0.04 240)', boxShadow: '0 1px 6px oklch(0 0 0 / 20%)' }}
                  >
                    <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground">{u.insight}</p>
                    <p className="text-sm mt-2 font-medium" style={{ color: 'oklch(0.62 0.18 162)' }}>{u.followUp}</p>
                    <p className="text-[10px] mt-2 opacity-40 text-right">
                      {format(msg.timestamp, 'HH:mm', { locale: ptBR })}
                    </p>
                  </div>
                </div>
              </div>
            )
          }

          // ── Mensagens normais ───────────────────────────────────
          return (
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
          )
        })}
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

