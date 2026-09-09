// chat-ai — Ponte segura entre o app e a OpenAI
//
// O navegador NUNCA tem acesso à chave da OpenAI. O app envia apenas o prompt,
// e esta função (que roda no servidor, no Supabase) é quem fala com a OpenAI
// usando a chave guardada como segredo do projeto.
//
// Segredos necessários (configurados no projeto):
//   OPENAI_API_KEY  -> chave da OpenAI (server-only, nunca exposta ao cliente)
//
// Body esperado (POST, JSON):
//   {
//     "tipo": "intencao" | "cumprimento" | "boas_vindas",
//     "system": "prompt de sistema (opcional)",
//     "user":  "prompt do usuário/conteúdo",
//     "model": "gpt-4o-mini" (opcional, padrão gpt-4o-mini),
//     "max_tokens": 200 (opcional),
//     "temperature": 0.7 (opcional)
//   }
//
// Resposta (JSON):
//   { "ok": true, "conteudo": "texto gerado" }
//   { "ok": false, "erro": "mensagem" }

const DEFAULT_MODEL = 'gpt-4o-mini'

interface CorpoRequisicao {
  tipo?: 'intencao' | 'cumprimento' | 'boas_vindas' | 'livre'
  system?: string
  user?: string
  model?: string
  max_tokens?: number
  temperature?: number
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, erro: 'Método não permitido' }), {
      status: 405,
      headers: corsHeaders,
    })
  }

  // Chave da OpenAI — só existe no servidor (segredo do projeto)
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    return new Response(
      JSON.stringify({ ok: false, erro: 'OPENAI_API_KEY não configurada no servidor' }),
      { status: 500, headers: corsHeaders },
    )
  }

  let corpo: CorpoRequisicao
  try {
    corpo = await req.json()
  } catch {
    return new Response(JSON.stringify({ ok: false, erro: 'JSON inválido' }), {
      status: 400,
      headers: corsHeaders,
    })
  }

  const userPrompt = (corpo.user ?? '').trim()
  if (!userPrompt && corpo.tipo !== 'boas_vindas') {
    return new Response(JSON.stringify({ ok: false, erro: 'Conteúdo vazio' }), {
      status: 400,
      headers: corsHeaders,
    })
  }

  const messages: { role: 'system' | 'user'; content: string }[] = []
  if (corpo.system) messages.push({ role: 'system', content: corpo.system })
  messages.push({ role: 'user', content: userPrompt })

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: corpo.model || DEFAULT_MODEL,
        messages,
        max_tokens: corpo.max_tokens ?? 300,
        temperature: corpo.temperature ?? 0.7,
      }),
    })

    if (!openaiRes.ok) {
      const errText = await openaiRes.text()
      return new Response(
        JSON.stringify({ ok: false, erro: `OpenAI error: ${openaiRes.status}`, detalhe: errText.slice(0, 300) }),
        { status: 502, headers: corsHeaders },
      )
    }

    const data = await openaiRes.json()
    const conteudo = data.choices?.[0]?.message?.content?.trim() ?? ''
    return new Response(JSON.stringify({ ok: true, conteudo }), { headers: corsHeaders })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido'
    return new Response(JSON.stringify({ ok: false, erro: msg }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})
