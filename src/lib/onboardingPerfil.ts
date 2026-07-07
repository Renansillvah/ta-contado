import { supabase } from '@/lib/supabase'

// ── Tipos ──────────────────────────────────────────────────────────────────────
export interface OnboardingPerfil {
  nome: string
  desafio: string
  respostaCompl: string
  dataCriacao: string   // ISO 8601
  concluido: boolean
}

// ── Chaves localStorage ────────────────────────────────────────────────────────
const KEYS = {
  nome:         'onboarding_nome_coletado',
  desafio:      'onboarding_desafio',
  respostaCompl:'onboarding_resposta_compl',
  dataCriacao:  'onboarding_data_criacao',
  concluido:    'onboarding_concluido',
  done:         'onboarding_done',
  userName:     'user_name',
} as const

// ── Leitura ────────────────────────────────────────────────────────────────────
export function lerPerfil(): OnboardingPerfil | null {
  const concluido = localStorage.getItem(KEYS.concluido) === '1'
  if (!concluido) return null

  return {
    nome:          localStorage.getItem(KEYS.nome)          ?? '',
    desafio:       localStorage.getItem(KEYS.desafio)       ?? '',
    respostaCompl: localStorage.getItem(KEYS.respostaCompl) ?? '',
    dataCriacao:   localStorage.getItem(KEYS.dataCriacao)   ?? '',
    concluido,
  }
}

// ── Verificação rápida ─────────────────────────────────────────────────────────
export function onboardingConcluido(): boolean {
  return localStorage.getItem(KEYS.concluido) === '1'
}

// ── Salva perfil completo + sincroniza com Supabase ────────────────────────────
export async function salvarPerfil(perfil: Omit<OnboardingPerfil, 'dataCriacao' | 'concluido'>): Promise<void> {
  const dataCriacao = new Date().toISOString()

  // 1. Persiste no localStorage (disponível imediatamente, sem internet)
  localStorage.setItem(KEYS.nome,          perfil.nome)
  localStorage.setItem(KEYS.desafio,       perfil.desafio)
  localStorage.setItem(KEYS.respostaCompl, perfil.respostaCompl)
  localStorage.setItem(KEYS.dataCriacao,   dataCriacao)
  localStorage.setItem(KEYS.concluido,     '1')
  localStorage.setItem(KEYS.done,          '1')
  localStorage.setItem(KEYS.userName,      perfil.nome)

  // 2. Sincroniza com Supabase user_metadata (persiste entre dispositivos/sessões)
  try {
    await supabase.auth.updateUser({
      data: {
        full_name:              perfil.nome,
        onboarding_done:        true,
        onboarding_nome:        perfil.nome,
        onboarding_desafio:     perfil.desafio,
        onboarding_resposta:    perfil.respostaCompl,
        onboarding_data:        dataCriacao,
      },
    })
  } catch {
    // Falha silenciosa — localStorage garante a persistência local
  }
}

// ── Restaura dados do Supabase para localStorage (login em novo dispositivo) ───
export async function restaurarDoSupabase(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.user_metadata?.onboarding_done) return false

    const m = user.user_metadata
    if (m.onboarding_nome)     localStorage.setItem(KEYS.nome,          m.onboarding_nome)
    if (m.onboarding_desafio)  localStorage.setItem(KEYS.desafio,       m.onboarding_desafio)
    if (m.onboarding_resposta) localStorage.setItem(KEYS.respostaCompl, m.onboarding_resposta)
    if (m.onboarding_data)     localStorage.setItem(KEYS.dataCriacao,   m.onboarding_data)
    if (m.full_name)           localStorage.setItem(KEYS.userName,      m.full_name)
    localStorage.setItem(KEYS.concluido, '1')
    localStorage.setItem(KEYS.done, '1')

    return true
  } catch {
    return false
  }
}
