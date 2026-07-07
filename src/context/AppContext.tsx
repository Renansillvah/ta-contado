import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { supabase, type Gasto, type Divida, type Receita } from '@/lib/supabase'
import { toast } from 'sonner'
import type { User } from '@supabase/supabase-js'
import { type Plano, PAYWALL_ATIVO, dentroDoLimite } from '@/lib/planos'

interface AppContextType {
  gastos: Gasto[]
  dividas: Divida[]
  receitas: Receita[]
  loading: boolean
  supabaseOk: boolean
  user: User | null
  plano: Plano
  totalGastos: number
  totalReceitas: number
  totalDividas: number
  adicionarGasto: (g: Omit<Gasto, 'id' | 'created_at'>) => Promise<void>
  removerGasto: (id: string) => Promise<void>
  adicionarDivida: (d: Omit<Divida, 'id' | 'created_at'>) => Promise<void>
  removerDivida: (id: string) => Promise<void>
  pagarDivida: (id: string, valor: number) => Promise<void>
  atualizarDivida: (id: string, dados: Partial<Omit<Divida, 'id' | 'created_at'>>) => Promise<void>
  adicionarReceita: (r: Omit<Receita, 'id' | 'created_at'>) => Promise<void>
  removerReceita: (id: string) => Promise<void>
  marcarRecebido: (id: string) => Promise<void>
  recarregar: () => Promise<void>
  logout: () => Promise<void>
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children, user }: { children: ReactNode; user: User | null }) {
  const [gastosRaw, setGastosRaw] = useState<Gasto[]>([])
  const [dividas, setDividas] = useState<Divida[]>([])
  const [receitasRaw, setReceitasRaw] = useState<Receita[]>([])
  const [loading, setLoading] = useState(true)
  const [supabaseOk, setSupabaseOk] = useState(false)

  // Plano do usuário — lido do user_metadata; padrão free
  const plano: Plano = (user?.user_metadata?.plano as Plano) || 'free'

  // Aplica filtro de histórico conforme plano
  const gastos = PAYWALL_ATIVO
    ? gastosRaw.filter(g => dentroDoLimite(g.data, plano))
    : gastosRaw
  const receitas = PAYWALL_ATIVO
    ? receitasRaw.filter(r => dentroDoLimite(r.data, plano))
    : receitasRaw

  const totalGastos = gastos.reduce((s, g) => s + Number(g.valor), 0)
  const totalReceitas = receitas.filter(r => r.tipo === 'recebido').reduce((s, r) => s + Number(r.valor), 0)
  const totalDividas = dividas.reduce((s, d) => s + (Number(d.valor_total) - Number(d.valor_pago)), 0)

  const carregar = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    try {
      const [rGastos, rDividas, rReceitas] = await Promise.all([
        supabase.from('gastos').select('*').eq('user_id', user.id).order('data', { ascending: false }),
        supabase.from('dividas').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('receitas').select('*').eq('user_id', user.id).order('data', { ascending: false }),
      ])
      if (rGastos.error || rDividas.error || rReceitas.error) {
        setSupabaseOk(false)
      } else {
        setGastosRaw(rGastos.data || [])
        setDividas(rDividas.data || [])
        setReceitasRaw(rReceitas.data || [])
        setSupabaseOk(true)
      }
    } catch {
      setSupabaseOk(false)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('realtime-user-' + user.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gastos', filter: `user_id=eq.${user.id}` }, (payload) => {
        setGastosRaw(prev => {
          if (prev.find(g => g.id === payload.new.id)) return prev
          toast('Gasto registrado pelo WhatsApp!', { icon: '💸' })
          return [payload.new as Gasto, ...prev]
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'receitas', filter: `user_id=eq.${user.id}` }, (payload) => {
        setReceitasRaw(prev => {
          if (prev.find(r => r.id === payload.new.id)) return prev
          toast('Receita registrada pelo WhatsApp!', { icon: '💰' })
          return [payload.new as Receita, ...prev]
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dividas', filter: `user_id=eq.${user.id}` }, (payload) => {
        setDividas(prev => {
          if (prev.find(d => d.id === payload.new.id)) return prev
          toast('Dívida registrada pelo WhatsApp!', { icon: '📋' })
          return [payload.new as Divida, ...prev]
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  const adicionarGasto = async (g: Omit<Gasto, 'id' | 'created_at'>) => {
    if (!user) return
    const { data, error } = await supabase.from('gastos').insert([{ ...g, user_id: user.id }]).select().single()
    if (error) { toast.error('Erro ao salvar gasto'); return }
    setGastosRaw(prev => [data, ...prev])
    toast.success('Gasto registrado!')
  }

  const removerGasto = async (id: string) => {
    const { error } = await supabase.from('gastos').delete().eq('id', id)
    if (error) { toast.error('Erro ao remover'); return }
    setGastosRaw(prev => prev.filter(g => g.id !== id))
    toast.success('Gasto removido')
  }

  const adicionarDivida = async (d: Omit<Divida, 'id' | 'created_at'>) => {
    if (!user) return
    const { data, error } = await supabase.from('dividas').insert([{ ...d, user_id: user.id }]).select().single()
    if (error) { toast.error('Erro ao salvar dívida'); return }
    setDividas(prev => [data, ...prev])
    toast.success('Dívida registrada!')
  }

  const removerDivida = async (id: string) => {
    const { error } = await supabase.from('dividas').delete().eq('id', id)
    if (error) { toast.error('Erro ao remover'); return }
    setDividas(prev => prev.filter(d => d.id !== id))
    toast.success('Dívida removida')
  }

  const pagarDivida = async (id: string, valor: number) => {
    const divida = dividas.find(d => d.id === id)
    if (!divida) return
    const novo_pago = Math.min(Number(divida.valor_pago) + valor, Number(divida.valor_total))
    const { error } = await supabase.from('dividas').update({ valor_pago: novo_pago }).eq('id', id)
    if (error) { toast.error('Erro ao registrar pagamento'); return }
    setDividas(prev => prev.map(d => d.id === id ? { ...d, valor_pago: novo_pago } : d))
    toast.success('Pagamento registrado!')
  }

  const atualizarDivida = async (id: string, dados: Partial<Omit<Divida, 'id' | 'created_at'>>) => {
    const { error } = await supabase.from('dividas').update(dados).eq('id', id)
    if (error) { toast.error('Erro ao atualizar dívida'); return }
    setDividas(prev => prev.map(d => d.id === id ? { ...d, ...dados } : d))
    toast.success('Dívida atualizada!')
  }

  const adicionarReceita = async (r: Omit<Receita, 'id' | 'created_at'>) => {
    if (!user) return
    const { data, error } = await supabase.from('receitas').insert([{ ...r, user_id: user.id }]).select().single()
    if (error) { toast.error('Erro ao salvar receita'); return }
    setReceitasRaw(prev => [data, ...prev])
    toast.success('Receita registrada!')
  }

  const removerReceita = async (id: string) => {
    const { error } = await supabase.from('receitas').delete().eq('id', id)
    if (error) { toast.error('Erro ao remover'); return }
    setReceitasRaw(prev => prev.filter(r => r.id !== id))
    toast.success('Receita removida')
  }

  const marcarRecebido = async (id: string) => {
    const { error } = await supabase.from('receitas').update({ tipo: 'recebido' }).eq('id', id)
    if (error) { toast.error('Erro ao atualizar'); return }
    setReceitasRaw(prev => prev.map(r => r.id === id ? { ...r, tipo: 'recebido' } : r))
    toast.success('Receita marcada como recebida!')
  }

  const logout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AppContext.Provider value={{
      gastos, dividas, receitas, loading, supabaseOk, user, plano,
      totalGastos, totalReceitas, totalDividas,
      adicionarGasto, removerGasto,
      adicionarDivida, removerDivida, pagarDivida, atualizarDivida,
      adicionarReceita, removerReceita, marcarRecebido,
      recarregar: carregar,
      logout,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp deve ser usado dentro do AppProvider')
  return ctx
}
