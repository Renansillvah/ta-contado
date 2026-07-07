// ── Configuração de planos ────────────────────────────────────────────────────
// Para ativar o paywall: mude PAYWALL_ATIVO para true
export const PAYWALL_ATIVO = false

export type Plano = 'free' | 'pro'

export const LIMITES = {
  free: {
    diasHistorico: 30,       // só vê últimos 30 dias de gastos/receitas
    exportar: false,          // não pode exportar dados
    whatsapp: false,          // não pode usar WhatsApp
    metaMensal: false,        // não pode definir meta mensal
  },
  pro: {
    diasHistorico: 9999,
    exportar: true,
    whatsapp: true,
    metaMensal: true,
  },
}

export function dentroDoLimite(dataStr: string, plano: Plano): boolean {
  if (!PAYWALL_ATIVO) return true
  if (plano === 'pro') return true
  const limite = new Date()
  limite.setDate(limite.getDate() - LIMITES.free.diasHistorico)
  return new Date(dataStr) >= limite
}

export function podeUsar(recurso: keyof typeof LIMITES.free, plano: Plano): boolean {
  if (!PAYWALL_ATIVO) return true
  if (plano === 'pro') return true
  return !!LIMITES.free[recurso]
}
