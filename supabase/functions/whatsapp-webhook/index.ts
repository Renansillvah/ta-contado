import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN') ?? 'tacontado_verify'
const WA_TOKEN = Deno.env.get('WHATSAPP_TOKEN') ?? ''
const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── Interpretar mensagem com IA ────────────────────────────────────────────
async function interpretarMensagem(texto: string, historico: string[]) {
  const systemPrompt = `Você é o Tá Contado, assistente financeiro pessoal via WhatsApp.
Sua tarefa é interpretar mensagens em português e retornar um JSON com a ação identificada.

FORMATO DE RESPOSTA (sempre JSON válido):
{
  "tipo": "gasto" | "receita" | "divida" | "consulta" | "conversa",
  "valor": number | null,
  "descricao": string | null,
  "categoria": string | null,
  "resposta": string  // mensagem amigável para enviar ao usuário
}

CATEGORIAS DISPONÍVEIS: Alimentação, Transporte, Saúde, Lazer, Compras, Moradia, Educação, Combustível, Outros

EXEMPLOS:
- "gastei 50 no mercado" → tipo:gasto, valor:50, categoria:Alimentação
- "recebi 3000 de salário" → tipo:receita, valor:3000
- "devo 800 no cartão" → tipo:divida, valor:800
- "quanto gastei esse mês?" → tipo:consulta
- "oi tudo bem" → tipo:conversa

Responda APENAS com o JSON, sem markdown.`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...historico.slice(-4).map((h, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: h
        })),
        { role: 'user', content: texto }
      ],
      temperature: 0.3,
      max_tokens: 300
    })
  })
  const data = await res.json()
  const raw = data.choices?.[0]?.message?.content ?? '{}'
  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim())
  } catch {
    return { tipo: 'conversa', resposta: raw }
  }
}

// ─── Transcrever áudio ───────────────────────────────────────────────────────
async function transcreverAudio(mediaId: string): Promise<string> {
  // 1. Obter URL do áudio
  const urlRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
    headers: { 'Authorization': `Bearer ${WA_TOKEN}` }
  })
  const { url } = await urlRes.json()

  // 2. Baixar o áudio
  const audioRes = await fetch(url, {
    headers: { 'Authorization': `Bearer ${WA_TOKEN}` }
  })
  const audioBlob = await audioRes.blob()

  // 3. Transcrever com Whisper
  const form = new FormData()
  form.append('file', audioBlob, 'audio.ogg')
  form.append('model', 'whisper-1')
  form.append('language', 'pt')

  const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_KEY}` },
    body: form
  })
  const { text } = await whisperRes.json()
  return text ?? ''
}

// ─── Buscar resumo do mês ────────────────────────────────────────────────────
async function buscarResumo(phone: string) {
  const inicio = new Date()
  inicio.setDate(1)
  const dataInicio = inicio.toISOString().split('T')[0]

  const [gastos, receitas, dividas] = await Promise.all([
    supabase.from('gastos').select('valor,descricao,categoria').gte('data', dataInicio),
    supabase.from('receitas').select('valor,descricao').gte('data', dataInicio).eq('tipo', 'recebido'),
    supabase.from('dividas').select('nome,valor_total,valor_pago')
  ])

  const totalGastos = (gastos.data ?? []).reduce((s, g) => s + Number(g.valor), 0)
  const totalReceitas = (receitas.data ?? []).reduce((s, r) => s + Number(r.valor), 0)
  const totalDividas = (dividas.data ?? []).reduce((s, d) => s + (Number(d.valor_total) - Number(d.valor_pago)), 0)

  return { totalGastos, totalReceitas, totalDividas, gastos: gastos.data ?? [] }
}

// ─── Enviar mensagem WhatsApp ────────────────────────────────────────────────
async function enviarMensagem(phone: string, texto: string, waBusinessId: string) {
  await fetch(`https://graph.facebook.com/v19.0/${waBusinessId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WA_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { body: texto }
    })
  })
}

// ─── Handler principal ───────────────────────────────────────────────────────
Deno.serve(async (req) => {
  // Verificação do webhook (GET)
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }

  // Receber mensagem (POST)
  if (req.method === 'POST') {
    const body = await req.json()

    const entry = body?.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value
    const message = value?.messages?.[0]
    const waBusinessId = value?.metadata?.phone_number_id

    if (!message) return new Response('ok', { status: 200 })

    const phone = message.from
    let textoRecebido = ''

    // Texto ou áudio
    if (message.type === 'text') {
      textoRecebido = message.text?.body ?? ''
    } else if (message.type === 'audio') {
      try {
        textoRecebido = await transcreverAudio(message.audio.id)
        await enviarMensagem(phone, `🎤 Entendi: "${textoRecebido}"`, waBusinessId)
      } catch {
        await enviarMensagem(phone, '❌ Não consegui transcrever o áudio. Tente digitar!', waBusinessId)
        return new Response('ok', { status: 200 })
      }
    } else {
      await enviarMensagem(phone, 'Olá! Mande texto ou áudio para registrar gastos, receitas e dívidas 💰', waBusinessId)
      return new Response('ok', { status: 200 })
    }

    // Salvar mensagem recebida
    await supabase.from('whatsapp_messages').insert({
      phone,
      direction: 'inbound',
      content: textoRecebido,
      wa_message_id: message.id
    })

    // Buscar histórico recente
    const { data: historico } = await supabase
      .from('whatsapp_messages')
      .select('content,direction')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(8)

    const msgs = (historico ?? []).reverse().map(m => m.content)

    // Verificar se usuário está registrado
    const { data: waUser } = await supabase
      .from('whatsapp_users')
      .select('*')
      .eq('phone', phone)
      .single()

    if (!waUser?.verified) {
      const resposta = '👋 Olá! Para usar o *Tá Contado* pelo WhatsApp, abra o app e vincule seu número na opção "Usar pelo WhatsApp" no menu. 📱'
      await enviarMensagem(phone, resposta, waBusinessId)
      return new Response('ok', { status: 200 })
    }

    // Interpretar com IA
    let interpretado: Record<string, unknown>
    if (!OPENAI_KEY) {
      // Fallback sem IA: regex simples
      interpretado = interpretarSemIA(textoRecebido)
    } else {
      interpretado = await interpretarMensagem(textoRecebido, msgs)
    }

    let respostaFinal = (interpretado.resposta as string) ?? 'Não entendi. Tente: "gastei 50 no mercado" ou "recebi 1000 de salário"'

    // Executar ação
    if (interpretado.tipo === 'gasto' && interpretado.valor) {
      await supabase.from('gastos').insert({
        descricao: interpretado.descricao ?? textoRecebido,
        valor: interpretado.valor,
        categoria: interpretado.categoria ?? 'Outros',
        data: new Date().toISOString().split('T')[0]
      })
      respostaFinal = interpretado.resposta as string ?? `✅ Gasto de R$ ${interpretado.valor} registrado!`
    } else if (interpretado.tipo === 'receita' && interpretado.valor) {
      await supabase.from('receitas').insert({
        descricao: interpretado.descricao ?? textoRecebido,
        valor: interpretado.valor,
        categoria: interpretado.categoria ?? 'Outros',
        tipo: 'recebido',
        data: new Date().toISOString().split('T')[0]
      })
      respostaFinal = interpretado.resposta as string ?? `✅ Receita de R$ ${interpretado.valor} registrada!`
    } else if (interpretado.tipo === 'divida' && interpretado.valor) {
      await supabase.from('dividas').insert({
        nome: interpretado.descricao ?? textoRecebido,
        tipo: 'outros',
        valor_total: interpretado.valor,
        valor_pago: 0,
        parcelado: false
      })
      respostaFinal = interpretado.resposta as string ?? `✅ Dívida de R$ ${interpretado.valor} registrada!`
    } else if (interpretado.tipo === 'consulta') {
      const resumo = await buscarResumo(phone)
      respostaFinal = `📊 *Resumo do mês:*\n\n` +
        `💸 Gastos: R$ ${resumo.totalGastos.toFixed(2)}\n` +
        `💰 Receitas: R$ ${resumo.totalReceitas.toFixed(2)}\n` +
        `📋 Dívidas abertas: R$ ${resumo.totalDividas.toFixed(2)}\n\n` +
        `Saldo: R$ ${(resumo.totalReceitas - resumo.totalGastos).toFixed(2)} ${resumo.totalReceitas >= resumo.totalGastos ? '✅' : '⚠️'}`
    }

    // Salvar resposta e enviar
    await Promise.all([
      supabase.from('whatsapp_messages').insert({
        phone,
        direction: 'outbound',
        content: respostaFinal
      }),
      enviarMensagem(phone, respostaFinal, waBusinessId)
    ])

    return new Response('ok', { status: 200 })
  }

  return new Response('Method not allowed', { status: 405 })
})

// Fallback simples sem OpenAI
function interpretarSemIA(texto: string): Record<string, unknown> {
  const t = texto.toLowerCase()
  const valorMatch = t.match(/r?\$?\s?(\d+([.,]\d+)?)/)
  const valor = valorMatch ? parseFloat(valorMatch[1].replace(',', '.')) : null

  if (/gast|pagu|compr|saí/.test(t)) {
    return { tipo: 'gasto', valor, descricao: texto, categoria: detectarCategoria(t), resposta: valor ? `✅ Gasto de R$ ${valor} registrado no app!` : 'Qual foi o valor do gasto?' }
  }
  if (/receb|ganh|salário|entrada/.test(t)) {
    return { tipo: 'receita', valor, descricao: texto, resposta: valor ? `✅ Receita de R$ ${valor} registrada!` : 'Qual foi o valor recebido?' }
  }
  if (/dev|dívid|empréstim|devo/.test(t)) {
    return { tipo: 'divida', valor, descricao: texto, resposta: valor ? `✅ Dívida de R$ ${valor} registrada!` : 'Qual é o valor da dívida?' }
  }
  if (/quanto|resumo|total|mês/.test(t)) {
    return { tipo: 'consulta', resposta: '' }
  }
  return { tipo: 'conversa', resposta: '👋 Olá! Me diga um gasto, receita ou dívida. Ex: "gastei 50 no mercado"' }
}

function detectarCategoria(t: string): string {
  if (/restaur|comida|almoç|jant|mercado|superm|lanche|padaria|ifood/.test(t)) return 'Alimentação'
  if (/uber|99|táxi|ônibus|metro|transp/.test(t)) return 'Transporte'
  if (/gasolina|combustív|posto/.test(t)) return 'Combustível'
  if (/farmácia|médico|saúde|remédio|consulta/.test(t)) return 'Saúde'
  if (/academia|cinema|netflix|lazer|viagem/.test(t)) return 'Lazer'
  if (/aluguel|condomínio|conta|luz|água|moradia/.test(t)) return 'Moradia'
  if (/escola|curso|livro|faculdade/.test(t)) return 'Educação'
  return 'Outros'
}
