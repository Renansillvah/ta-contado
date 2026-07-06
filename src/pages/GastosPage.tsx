import { useState, useMemo, useEffect } from 'react'
import { Plus, Trash2, UtensilsCrossed, Car, Home, Heart, Smile, ShoppingBag, BookOpen, Target, Pencil, Filter, X, Check, MapPin } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

const CATEGORIAS = [
  { label: 'Alimentação', Icon: UtensilsCrossed, color: 'text-orange-400' },
  { label: 'Transporte', Icon: Car, color: 'text-blue-400' },
  { label: 'Moradia', Icon: Home, color: 'text-purple-400' },
  { label: 'Saúde', Icon: Heart, color: 'text-red-400' },
  { label: 'Lazer', Icon: Smile, color: 'text-yellow-400' },
  { label: 'Compras', Icon: ShoppingBag, color: 'text-pink-400' },
  { label: 'Educação', Icon: BookOpen, color: 'text-cyan-400' },
  { label: 'Outros', Icon: MapPin, color: 'text-muted-foreground' },
]

interface FormGasto {
  descricao: string
  valor: string
  categoria: string
  data: string
}

function CatIcon({ categoria, size = 16 }: { categoria: string; size?: number }) {
  const cat = CATEGORIAS.find(c => c.label === categoria) || CATEGORIAS[CATEGORIAS.length - 1]
  const { Icon, color } = cat
  return <Icon size={size} className={color} />
}

export default function GastosPage() {
  const { gastos, adicionarGasto, removerGasto, loading } = useApp()
  const [showForm, setShowForm] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [form, setForm] = useState<FormGasto>({
    descricao: '', valor: '', categoria: 'Alimentação',
    data: new Date().toISOString().split('T')[0],
  })
  const [salvando, setSalvando] = useState(false)

  // Meta mensal
  const [meta, setMeta] = useState(() => {
    const v = localStorage.getItem('meta_mensal')
    return v ? parseFloat(v) : 0
  })
  const [editandoMeta, setEditandoMeta] = useState(false)
  const [metaInput, setMetaInput] = useState('')
  const alertado80Ref = useState(false)

  // Filtros
  const [filtroCategoria, setFiltroCategoria] = useState<string>('Todas')
  const [filtroMes, setFiltroMes] = useState<string>('todos')
  const [showFiltros, setShowFiltros] = useState(false)

  const MES_ATUAL = format(new Date(), 'yyyy-MM')

  // Meses disponíveis nos gastos
  const mesesDisponiveis = useMemo(() => {
    const set = new Set(gastos.map(g => g.data.substring(0, 7)))
    return Array.from(set).sort().reverse()
  }, [gastos])

  const gastosFiltrados = useMemo(() => {
    return gastos.filter(g => {
      const catOk = filtroCategoria === 'Todas' || g.categoria === filtroCategoria
      const mesOk = filtroMes === 'todos' || g.data.startsWith(filtroMes)
      return catOk && mesOk
    })
  }, [gastos, filtroCategoria, filtroMes])

  const gastosMes = useMemo(() =>
    gastos.filter(g => g.data.startsWith(MES_ATUAL)).reduce((s, g) => s + Number(g.valor), 0),
  [gastos])

  const pctMeta = meta > 0 ? Math.min((gastosMes / meta) * 100, 110) : 0
  const barColor = pctMeta >= 90 ? 'bg-destructive' : pctMeta >= 60 ? 'bg-yellow-500' : 'bg-primary'

  useEffect(() => {
    if (meta <= 0) return
    const pct = (gastosMes / meta) * 100
    if (pct >= 100 && !alertado80Ref[0]) {
      alertado80Ref[0] = true
      toast.error('Você passou do limite!', { description: `Meta de R$ ${meta.toFixed(2).replace('.', ',')} ultrapassada.` })
    } else if (pct >= 80 && pct < 100 && !alertado80Ref[0]) {
      alertado80Ref[0] = true
      toast.warning('80% do orçamento usado!', { description: `Faltam R$ ${(meta - gastosMes).toFixed(2).replace('.', ',')} para o limite.` })
    }
  }, [gastosMes, meta])

  const salvarMeta = () => {
    const v = parseFloat(metaInput.replace(',', '.'))
    if (v > 0) {
      localStorage.setItem('meta_mensal', String(v))
      setMeta(v)
      alertado80Ref[0] = false
    }
    setEditandoMeta(false)
  }

  const abrirEditar = (g: any) => {
    setForm({ descricao: g.descricao, valor: String(g.valor), categoria: g.categoria, data: g.data })
    setEditandoId(g.id)
    setShowForm(true)
  }

  const salvar = async () => {
    if (!form.descricao || !form.valor) return
    setSalvando(true)
    try {
      if (editandoId) {
        // Remove o antigo e adiciona o novo com dados atualizados
        await removerGasto(editandoId)
        await adicionarGasto({
          descricao: form.descricao,
          valor: parseFloat(form.valor.replace(',', '.')),
          categoria: form.categoria,
          data: form.data,
        })
        toast.success('Gasto atualizado!')
      } else {
        await adicionarGasto({
          descricao: form.descricao,
          valor: parseFloat(form.valor.replace(',', '.')),
          categoria: form.categoria,
          data: form.data,
        })
      }
      setForm({ descricao: '', valor: '', categoria: 'Alimentação', data: new Date().toISOString().split('T')[0] })
      setEditandoId(null)
      setShowForm(false)
    } finally {
      setSalvando(false)
    }
  }

  const filtrosAtivos = filtroCategoria !== 'Todas' || filtroMes !== 'todos'

  return (
    <div className="flex flex-col h-full">

      {/* Card Meta Mensal */}
      <div className="px-4 pt-4">
        <div className="bg-card rounded-2xl p-4 mb-3" style={{ boxShadow: '0 1px 12px oklch(0 0 0 / 20%)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                <Target size={14} className="text-primary" />
              </div>
              <span className="text-xs font-semibold text-foreground">Meta do mês</span>
            </div>
            <button
              onClick={() => { setMetaInput(meta > 0 ? String(meta) : ''); setEditandoMeta(true) }}
              className="flex items-center gap-1 text-xs text-primary font-medium"
            >
              <Pencil size={11} />
              {meta > 0 ? 'Editar' : 'Definir meta'}
            </button>
          </div>
          {editandoMeta ? (
            <div className="flex gap-2">
              <input type="number" placeholder="Limite do mês (R$)" value={metaInput}
                onChange={e => setMetaInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && salvarMeta()} autoFocus
                className="flex-1 bg-secondary rounded-xl px-3 py-2.5 text-sm outline-none border border-border focus:border-primary transition-colors"
              />
              <button onClick={salvarMeta} className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-semibold">OK</button>
            </div>
          ) : meta > 0 ? (
            <>
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-lg font-bold">R$ {gastosMes.toFixed(2).replace('.', ',')}</span>
                <span className="text-xs text-muted-foreground">de R$ {meta.toFixed(2).replace('.', ',')}</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(pctMeta, 100)}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                {pctMeta >= 100 ? 'Você passou do limite!' : pctMeta >= 80
                  ? `${pctMeta.toFixed(0)}% usado — faltam R$ ${(meta - gastosMes).toFixed(2).replace('.', ',')}`
                  : `${pctMeta.toFixed(0)}% do limite usado`}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Defina uma meta para acompanhar seus gastos do mês.</p>
          )}
        </div>
      </div>

      {/* Botões ação + filtro */}
      <div className="px-4 pb-3 flex gap-2">
        <button
          onClick={() => { setForm({ descricao: '', valor: '', categoria: 'Alimentação', data: new Date().toISOString().split('T')[0] }); setEditandoId(null); setShowForm(true) }}
          className="flex-1 bg-primary text-primary-foreground rounded-2xl py-3 font-semibold flex items-center justify-center gap-2 text-sm active:scale-[0.98] transition-transform"
        >
          <Plus size={17} strokeWidth={2.5} /> Adicionar gasto
        </button>
        <button
          onClick={() => setShowFiltros(!showFiltros)}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors relative ${filtrosAtivos ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground border border-border'}`}
        >
          <Filter size={16} />
          {filtrosAtivos && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full border-2 border-background" />}
        </button>
      </div>

      {/* Painel de Filtros */}
      {showFiltros && (
        <div className="mx-4 mb-3 bg-card rounded-2xl p-4 space-y-3" style={{ boxShadow: '0 1px 8px oklch(0 0 0 / 18%)' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Filtros</span>
            {filtrosAtivos && (
              <button onClick={() => { setFiltroCategoria('Todas'); setFiltroMes('todos') }}
                className="text-[11px] text-destructive flex items-center gap-1 font-medium">
                <X size={11} /> Limpar
              </button>
            )}
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground mb-1.5 font-medium">Categoria</p>
            <div className="flex flex-wrap gap-1.5">
              {['Todas', ...CATEGORIAS.map(c => c.label)].map(cat => (
                <button key={cat} onClick={() => setFiltroCategoria(cat)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${filtroCategoria === cat ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-foreground border-border'}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
          {mesesDisponiveis.length > 0 && (
            <div>
              <p className="text-[11px] text-muted-foreground mb-1.5 font-medium">Mês</p>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setFiltroMes('todos')}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${filtroMes === 'todos' ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-foreground border-border'}`}>
                  Todos
                </button>
                {mesesDisponiveis.map(mes => (
                  <button key={mes} onClick={() => setFiltroMes(mes)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors capitalize ${filtroMes === mes ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-foreground border-border'}`}>
                    {format(new Date(mes + '-15'), 'MMM/yy', { locale: ptBR })}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="space-y-2.5">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}</div>
        ) : gastosFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-4">
              <HelpCircle size={24} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground/60">{filtrosAtivos ? 'Nenhum resultado' : 'Nenhum gasto ainda'}</p>
            <p className="text-xs text-muted-foreground mt-1">{filtrosAtivos ? 'Tente outros filtros' : 'Adicione aqui ou pelo Chat'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {gastosFiltrados.map(g => (
              <div key={g.id} className="bg-card rounded-2xl px-4 py-3.5 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-300"
                style={{ boxShadow: '0 1px 8px oklch(0 0 0 / 15%)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                    <CatIcon categoria={g.categoria} size={16} />
                  </div>
                  <div>
                    <p className="font-medium text-sm leading-tight">{g.descricao}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {g.categoria} · {format(new Date(g.data + 'T12:00:00'), "d 'de' MMM", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-destructive text-sm">−R$ {Number(g.valor).toFixed(2).replace('.', ',')}</span>
                  <button onClick={() => abrirEditar(g)} className="text-muted-foreground hover:text-primary transition-colors p-1">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => { if (window.confirm('Apagar este gasto?')) removerGasto(g.id) }}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/75 flex items-end justify-center z-50" onClick={() => { setShowForm(false); setEditandoId(null) }}>
          <div className="bg-card rounded-t-3xl w-full max-w-lg p-5 pb-8 space-y-4"
            style={{ boxShadow: '0 -4px 30px oklch(0 0 0 / 40%)' }}
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-1" />
            <h2 className="text-base font-bold flex items-center gap-2">
              {editandoId ? <><Pencil size={16} className="text-primary" /> Editar Gasto</> : <><Plus size={18} className="text-primary" /> Novo Gasto</>}
            </h2>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Descrição *</label>
              <input type="text" placeholder="Ex: Almoço, Uber, Academia..." value={form.descricao}
                onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-primary transition-colors" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Categoria</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIAS.map(cat => (
                  <button key={cat.label} onClick={() => setForm(p => ({ ...p, categoria: cat.label }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5 ${form.categoria === cat.label ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-foreground border-border'}`}>
                    <cat.Icon size={12} /> {cat.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Valor (R$) *</label>
                <input type="number" placeholder="0,00" value={form.valor}
                  onChange={e => setForm(p => ({ ...p, valor: e.target.value }))}
                  className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-primary transition-colors" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Data</label>
                <input type="date" value={form.data}
                  onChange={e => setForm(p => ({ ...p, data: e.target.value }))}
                  className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-primary transition-colors" />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => { setShowForm(false); setEditandoId(null) }}
                className="flex-1 bg-secondary text-foreground rounded-xl py-3.5 text-sm font-medium active:scale-[0.98] transition-transform">Cancelar</button>
              <button onClick={salvar} disabled={salvando}
                className="flex-1 bg-primary text-primary-foreground rounded-xl py-3.5 text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2">
                {salvando ? 'Salvando...' : <><Check size={15} /> {editandoId ? 'Atualizar' : 'Salvar'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
