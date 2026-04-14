import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase não configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')

export type Gasto = {
  id: string
  descricao: string
  valor: number
  categoria: string
  data: string
  created_at?: string
}

export type Divida = {
  id: string
  nome: string
  tipo: 'cartao' | 'emprestimo' | 'outros'
  valor_total: number
  valor_pago: number
  credor?: string
  vencimento?: string
  parcelado: boolean
  parcelas?: number
  parcela_atual?: number
  created_at?: string
}

export type Receita = {
  id: string
  descricao: string
  categoria: string
  valor: number
  tipo: 'recebido' | 'a_receber'
  data: string
  created_at?: string
}

export type MensagemChat = {
  id: string
  tipo: 'usuario' | 'assistente'
  conteudo: string
  created_at: string
}
