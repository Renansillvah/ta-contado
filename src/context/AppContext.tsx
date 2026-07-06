import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { supabase, type Gasto, type Divida, type Receita } from '@/lib/supabase'
import { toast } from 'sonner'

interface AppContextType {
  gastos: Gasto[]
  dividas: Divida[]
  receitas: Receita[]
  loading: boolean
  supabaseOk: boolean
  totalGastos: number
  totalReceitas: number
  totalDividas: number
  adicionarGasto: (g: Omit<Gasto, 'id' | 'created_at'>) => Promise<void>
  removerGasto: (id: string) => Promise<void>
  adicionarDivida: (d: Omit<Divida, 'id' | 'created_at'>) => Promise<void>
  removerDivida: (id: string) => Promise<void>
  pagarDivida: (id: string, valor: number) => Promise<void>
  adicionarReceita: (r: Omit<Receita, 'id' | 'created_at'>) => Promise<void>
  removerReceita: (id: string) => Promise<void>
  recarregar: () => Promise<void>
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [dividas, setDividas] = useState<Divida[]>([])
  const [receitas, setReceitas] = useState<Receita[]>([])
  const [loading, setLoading] = useState(true)
  const [supabaseOk, setSupabaseOk] = useState(false)

  const totalGastos = gastos.reduce((s, g) => s + Number(g.valor), 0)
  const totalReceitas = receitas.filter(r => r.tipo === 'recebido').reduce((s, r) => s + Number(r.valor), 0)
  const totalDividas = dividas.reduce((s, d) => s + (Number(d.valor_total) - Number(d.valor_pago)), 0)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [rGastos, rDividas, rReceitas] = await Promise.all([
        supabase.from('gastos').select('*').order('data', { ascending: false }),
        supabase.from('dividas').select('*').order('created_at', { ascending: false }),
        supabase.from('receitas').select('*').order('data', { ascending: false }),
      ])
      if (rGastos.error || rDividas.error || rReceitas.error) {
        setSupabaseOk(false)
      } else {
        setGastos(rGastos.data || [])
        setDividas(rDividas.data || [])
        setReceitas(rReceitas.data || [])
        setSupabaseOk(true)
      }
    } catch {
      setSupabaseOk(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // Realtime: atualiza automaticamente quando Edge Function salva dados via WhatsApp
  useEffect(() => {
    const channel = supabase
      .channel('whatsapp-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gastos' }, (payload) => {
        setGastos(prev => {
          if (prev.find(g => g.id === payload.new.id)) return prev
          toast('📱 Gasto registrado pelo WhatsApp!', { icon: '💸' })
          return [payload.new as Gasto, ...prev]
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'receitas' }, (payload) => {
        setReceitas(prev => {
          if (prev.find(r => r.id === payload.new.id)) return prev
          toast('📱 Receita registrada pelo WhatsApp!', { icon: '💰' })
          return [payload.new as Receita, ...prev]
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dividas' }, (payload) => {
        setDividas(prev => {
          if (prev.find(d => d.id === payload.new.id)) return prev
          toast('📱 Dívida registrada pelo WhatsApp!', { icon: '📋' })
          return [payload.new as Divida, ...prev]
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const adicionarGasto = async (g: Omit<Gasto, 'id' | 'created_at'>) => {
    const { data, error } = await supabase.from('gastos').insert([g]).select().single()
    if (error) { toast.error('Erro ao salvar gasto'); return }
    setGastos(prev => [data, ...prev])
    toast.success('Gasto registrado!')
  }

  const removerGasto = async (id: string) => {
    const { error } = await supabase.from('gastos').delete().eq('id', id)
    if (error) { toast.error('Erro ao remover'); return }
    setGastos(prev => prev.filter(g => g.id !== id))
    toast.success('Gasto removido')
  }

  const adicionarDivida = async (d: Omit<Divida, 'id' | 'created_at'>) => {
    const { data, error } = await supabase.from('dividas').insert([d]).select().single()
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

  const adicionarReceita = async (r: Omit<Receita, 'id' | 'created_at'>) => {
    const { data, error } = await supabase.from('receitas').insert([r]).select().single()
    if (error) { toast.error('Erro ao salvar receita'); return }
    setReceitas(prev => [data, ...prev])
    toast.success('Receita registrada!')
  }

  const removerReceita = async (id: string) => {
    const { error } = await supabase.from('receitas').delete().eq('id', id)
    if (error) { toast.error('Erro ao remover'); return }
    setReceitas(prev => prev.filter(r => r.id !== id))
    toast.success('Receita removida')
  }

  return (
    <AppContext.Provider value={{
      gastos, dividas, receitas, loading, supabaseOk,
      totalGastos, totalReceitas, totalDividas,
      adicionarGasto, removerGasto,
      adicionarDivida, removerDivida, pagarDivida,
      adicionarReceita, removerReceita,
      recarregar: carregar,
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
