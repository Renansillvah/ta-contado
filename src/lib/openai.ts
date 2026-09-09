// Ponte segura para a IA — o navegador nunca tem a chave da OpenAI.
async function chamarIAPontSegura(user: string, opts?: { max_tokens?: number; temperature?: number }): Promise<string> {
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
    body: JSON.stringify({ tipo: 'boas_vindas', user, ...(opts || {}) }),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(data.erro || 'Erro na IA')
  return data.conteudo
}

interface PerfilUsuario {
  nome: string
  objetivo: string
  renda: number
  controle: string
}

const LABELS_OBJETIVO: Record<string, string> = {
  organizar: 'organizar os gastos e entender para onde vai o dinheiro',
  dividas: 'sair das dívidas',
  economizar: 'economizar e juntar dinheiro todo mês',
  investir: 'começar a investir',
}

const LABELS_CONTROLE: Record<string, string> = {
  tudo: 'gastos e receitas',
  gastos: 'somente os gastos',
  receitas: 'somente as receitas',
}

export async function gerarBoasVindasIA(perfil: PerfilUsuario): Promise<string> {
  const objetivo = LABELS_OBJETIVO[perfil.objetivo] || perfil.objetivo
  const controle = LABELS_CONTROLE[perfil.controle] || perfil.controle
  const rendaFmt = perfil.renda > 0
    ? `R$ ${perfil.renda.toLocaleString('pt-BR')}`
    : 'não informada'

  const metaSugerida = perfil.renda > 0
    ? Math.round(perfil.renda * 0.3 / 100) * 100
    : null

  const prompt = `Você é um assessor financeiro pessoal brasileiro, simpático, direto e motivador. Fale como um amigo que entende de finanças, não como um robô.

O usuário acabou de configurar o app com este perfil:
- Nome: ${perfil.nome}
- Objetivo principal: ${objetivo}
- Renda mensal: ${rendaFmt}
- Quer controlar: ${controle}
${metaSugerida ? `- Meta de poupança sugerida: R$ ${metaSugerida.toLocaleString('pt-BR')}/mês (30% da renda)` : ''}

Gere uma mensagem de boas-vindas personalizada com:
1. Saudação pelo primeiro nome
2. Um diagnóstico rápido e honesto baseado no perfil (1-2 frases)
3. Uma meta concreta para o mês (com número se tiver renda)
4. 2-3 sugestões de primeiros registros personalizadas para o perfil (ex: se objetivo é dívidas, sugerir registrar uma dívida)

Regras:
- Máximo 120 palavras
- Tom: amigável, motivador, direto — sem ser genérico
- Use quebras de linha para separar as partes
- NÃO use markdown (sem **, sem #, sem listas com -)
- Termine com uma pergunta ou chamada para ação concreta`

  return await chamarIAPontSegura(prompt, { max_tokens: 300, temperature: 0.8 })
}
