import { useState, useMemo, useEffect, useRef } from 'react'
import { Plus, Trash2, UtensilsCrossed, Car, Home, Heart, Smile, ShoppingBag, BookOpen, Target, Pencil, Filter, X, Check, MapPin, AlertTriangle, TrendingDown, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
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

function rotuloData(dataStr: string): string {
  const d = parseISO(dataStr + 'T12:00:00')
  if (isToday(d)) return 'Hoje'
  if (isYesterday(d)) return 'Ontem'
  return format(d, "EEEE, d 'de' MMM", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())
}

// Agrupa gastos por data mantendo a ordem
function agruparPorData(lista: any[]) {
  const grupos: { rotulo: string; data: string; itens: any[] }[] = []
  const map = new Map<string, any[]>()
  for (const g of lista) {
    if (!map.has(g.data)) map.set(g.data, [])
    map.get(g.data)!.push(g)
  }
  for (const [data, itens] of map.entries()) {
    grupos.push({ rotulo: rotuloData(data), data, itens })
  }
  return grupos
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
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)

  // Meta mensal
  const [meta, setMeta] = useState(() => {
    const v = localStorage.getItem('meta_mensal')
    return v ? parseFloat(v) : 0
  })
  const [editandoMeta, setEditandoMeta] = useState(false)
  const [metaInput, setMetaInput] = useState('')
  const alertadoRef = useRef(false)

  // Filtros
  const [filtroCategoria, setFiltroCategoria] = useState<string>('Todas')
  const [filtroMes, setFiltroMes] = useState<string>('todos')
  const [showFiltros, setShowFiltros] = useState(false)
  const [showBreakdown, setShowBreakdown] = useState(true)

  const MES_ATUAL = format(new Date(), 'yyyy-MM')

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
  [gastos, MES_ATUAL])

  // Comparação com mês anterior
  const mesAnteriorKey = format(new Date(new Date().setMonth(new Date().getMonth() - 1)), 'yyyy-MM')
  const gastosMesAnterior = useMemo(() =>
    gastos.filter(g => g.data.startsWith(mesAnteriorKey)).reduce((s, g) => s + Number(g.valor), 0),
  [gastos, mesAnteriorKey])
  const variacaoMes = gastosMesAnterior > 0
    ? ((gastosMes - gastosMesAnterior) / gastosMesAnterior) * 100
    : null

  const pctMeta = meta > 0 ? Math.min((gastosMes / meta) * 100, 110) : 0
  const barColor = pctMeta >= 100 ? '#ef4444' : pctMeta >= 80 ? '#f97316' : pctMeta >= 60 ? '#eab308' : 'oklch(0.62 0.18 162)'

  useEffect(() => {
    if (meta <= 0) return
    const pct = (gastosMes / meta) * 100
    if (pct >= 100 && !alertadoRef.current) {
      alertadoRef.current = true
      toast.error('Você passou do limite!', { description: `Meta de R$ ${meta.toFixed(2).replace('.', ',')} ultrapassada.` })
    } else if (pct >= 80 && pct < 100 && !alertadoRef.current) {
      alertadoRef.current = true
      toast.warning('80% do orçamento usado!', { description: `Faltam R$ ${(meta - gastosMes).toFixed(2).replace('.', ',')} para o limite.` })
    }
  }, [gastosMes, meta])

  const salvarMeta = () => {
    const v = parseFloat(metaInput.replace(',', '.'))
    if (v > 0) {
      localStorage.setItem('meta_mensal', String(v))
      setMeta(v)
      alertadoRef.current = false
      toast.success('Meta definida!')
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

  const confirmarRemover = async (id: string) => {
    setConfirmandoId(id)
  }

  const removerConfirmado = async (id: string) => {
    await removerGasto(id)
    setConfirmandoId(null)
  }

  const filtrosAtivos = filtroCategoria !== 'Todas' || filtroMes !== 'todos'

  const totalFiltrado = useMemo(() =>
    gastosFiltrados.reduce((s, g) => s + Number(g.valor), 0),
  [gastosFiltrados])

  const mesFiltroAtivo = filtroMes !== 'todos' ? filtroMes : MES_ATUAL
  const gastosMesFiltro = useMemo(() =>
    gastos.filter(g => g.data.startsWith(mesFiltroAtivo)).reduce((s, g) => s + Number(g.valor), 0),
  [gastos, mesFiltroAtivo])

  const breakdownMes = useMemo(() => {
    const gastosDoPeriodo = gastos.filter(g => g.data.startsWith(mesFiltroAtivo))
    const totalDoPeriodo = gastosDoPeriodo.reduce((s, g) => s + Number(g.valor), 0)
    return CATEGORIAS
      .map(cat => ({
        ...cat,
        total: gastosDoPeriodo.filter(g => g.categoria === cat.label).reduce((s, g) => s + Number(g.valor), 0),
        pct: totalDoPeriodo > 0 ? (gastosDoPeriodo.filter(g => g.categoria === cat.label).reduce((s, g) => s + Number(g.valor), 0) / totalDoPeriodo) * 100 : 0,
      }))
      .filter(c => c.total > 0)
      .sort((a, b) => b.total - a.total)
  }, [gastos, mesFiltroAtivo])

  const formatarMes = (ym: string) => {
    const [y, m] = ym.split('-')
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    return `${meses[parseInt(m) - 1]} ${y}`
  }

  // Frase de contexto da meta
  const fraseContexto = useMemo(() => {
    if (meta > 0) {
      if (pctMeta >= 100) return { txt: 'Você passou do limite este mês!', cor: '#ef4444' }
      if (pctMeta >= 80) return { txt: `${pctMeta.toFixed(0)}% da meta — faltam R$ ${(meta - gastosMes).toFixed(2).replace('.', ',')}`, cor: '#f97316' }
      if (pctMeta >= 50) return { txt: `${pctMeta.toFixed(0)}% da meta usados — ainda bem!`, cor: '#eab308' }
      return { txt: `${pctMeta.toFixed(0)}% da meta — você está ótimo!`, cor: 'oklch(0.62 0.18 162)' }
    }
    if (variacaoMes !== null) {
      if (variacaoMes <= -10) return { txt: `↓ ${Math.abs(variacaoMes).toFixed(0)}% menos que o mês passado — parabéns!`, cor: 'oklch(0.62 0.18 162)' }
      if (variacaoMes >= 20) return { txt: `↑ ${variacaoMes.toFixed(0)}% mais que o mês passado`, cor: '#f97316' }
    }
    return null
  }, [meta, pctMeta, gastosMes, variacaoMes])

  const gruposVisiveis = useMemo(() => agruparPorData(gastosFiltrados), [gastosFiltrados])

  return (
    <div className="flex flex-col h-full">

      {/* ── Card topo: total do mês + meta ── */}
      <div className="px-4 pt-4 pb-2">
        <div className="bg-card rounded-2xl p-4" style={{ boxShadow: '0 1px 12px oklch(0 0 0 / 20%)' }}>

          {/* Linha principal: total + botão meta */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[11px] text-muted-foreground font-medium mb-0.5">
                {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())}
              </p>
              <p className="text-2xl font-bold text-foreground leading-tight">
                R$ {gastosMes.toFixed(2).replace('.', ',')}
              </p>
              {fraseContexto && (
                <p className="text-[11px] mt-1 font-medium" style={{ color: fraseContexto.cor }}>
                  {fraseContexto.txt}
                </p>
              )}
              {!fraseContexto && !meta && (
                <p className="text-[11px] text-muted-foreground mt-1">gastos este mês</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <button
                onClick={() => { setMetaInput(meta > 0 ? String(meta) : ''); setEditandoMeta(true) }}
                className="flex items-center gap-1 text-[11px] text-primary font-medium px-2.5 py-1.5 rounded-xl bg-primary/10"
              >
                <Target size={11} />
                {meta > 0 ? `Meta: R$ ${meta.toFixed(0)}` : 'Definir meta'}
              </button>
              {variacaoMes !== null && (
                <span className="text-[10px] flex items-center gap-0.5" style={{ color: variacaoMes <= 0 ? 'oklch(0.62 0.18 162)' : '#f97316' }}>
                  {variacaoMes <= 0 ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
                  {variacaoMes > 0 ? '+' : ''}{variacaoMes.toFixed(0)}% vs mês ant.
                </span>
              )}
            </div>
          </div>

          {/* Barra de meta */}
          {meta > 0 && !editandoMeta && (
            <div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(pctMeta, 100)}%`, backgroundColor: barColor }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">{pctMeta.toFixed(0)}% usado</span>
                <span className="text-[10px] text-muted-foreground">limite R$ {meta.toFixed(0)}</span>
              </div>
            </div>
          )}

          {/* Input inline de meta */}
          {editandoMeta && (
            <div className="flex gap-2 mt-1">
              <input type="number" placeholder="Limite do mês (R$)" value={metaInput}
                onChange={e => setMetaInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && salvarMeta()} autoFocus
                className="flex-1 bg-secondary rounded-xl px-3 py-2 text-sm outline-none border border-border focus:border-primary transition-colors"
              />
              <button onClick={salvarMeta} className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-semibold">OK</button>
              <button onClick={() => setEditandoMeta(false)} className="text-muted-foreground px-2 text-sm">✕</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Breakdown por categoria (aberto por padrão) ── */}
      {breakdownMes.length > 0 && (
        <div className="px-4 pb-2">
          <div className="bg-card rounded-2xl overflow-hidden" style={{ boxShadow: '0 1px 8px oklch(0 0 0 / 15%)' }}>
            <button
              onClick={() => setShowBreakdown(v => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5"
            >
              <span className="text-xs font-semibold text-foreground">Por categoria</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {filtroMes !== 'todos' ? formatarMes(filtroMes) : 'Este mês'}
                </span>
                {showBreakdown ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
              </div>
            </button>
            {showBreakdown && (
              <div className="px-4 pb-3 space-y-2.5 border-t border-border/30 pt-2">
                {breakdownMes.map(cat => (
                  <div key={cat.label} className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <cat.Icon size={12} className={cat.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <span className="text-[11px] font-medium truncate">{cat.label}</span>
                        <span className="text-[11px] font-bold ml-2 shrink-0">R$ {cat.total.toFixed(2).replace('.', ',')}</span>
                      </div>
                      <div className="h-1 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${cat.pct}%`, backgroundColor: 'oklch(0.62 0.18 162)' }}
                        />
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground w-7 text-right shrink-0">{cat.pct.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Botões ação + filtro ── */}
      <div className="px-4 pb-2 flex gap-2">
        <button
          onClick={() => { setForm({ descricao: '', valor: '', categoria: 'Alimentação', data: new Date().toISOString().split('T')[0] }); setEditandoId(null); setShowForm(true) }}
          className="flex-1 bg-primary text-primary-foreground rounded-2xl py-3.5 font-semibold flex items-center justify-center gap-2 text-sm active:scale-[0.98] transition-transform"
        >
          <Plus size={17} strokeWidth={2.5} /> Adicionar gasto
        </button>
        <button
          onClick={() => setShowFiltros(!showFiltros)}
          className="relative w-12 h-12 rounded-2xl flex items-center justify-center transition-colors shrink-0"
          style={{ backgroundColor: showFiltros || filtrosAtivos ? 'oklch(0.62 0.18 162)' : 'oklch(0.25 0.04 240)' }}
        >
          <Filter size={16} className={showFiltros || filtrosAtivos ? 'text-white' : 'text-muted-foreground'} />
          {filtrosAtivos && !showFiltros && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-orange-400" />}
        </button>
      </div>

      {/* ── Painel de filtros ── */}
      {showFiltros && (
        <div className="mx-4 mb-2 bg-card rounded-2xl p-3.5 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200" style={{ boxShadow: '0 1px 8px oklch(0 0 0 / 18%)' }}>
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
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${filtroMes === mes ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-foreground border-border'}`}>
                    {format(new Date(mes + '-15'), 'MMM/yy', { locale: ptBR })}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Total filtrado (sempre visível quando filtros ativos) ── */}
      {filtrosAtivos && gastosFiltrados.length > 0 && (
        <div className="px-5 pb-2 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {gastosFiltrados.length} resultado{gastosFiltrados.length !== 1 ? 's' : ''}
          </span>
          <span className="text-[11px] font-semibold text-destructive">
            Total: R$ {totalFiltrado.toFixed(2).replace('.', ',')}
          </span>
        </div>
      )}

      {/* ── Lista agrupada por data ── */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="space-y-2.5">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}</div>
        ) : gastosFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-4">
              <MapPin size={24} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground/60">{filtrosAtivos ? 'Nenhum resultado' : 'Nenhum gasto ainda'}</p>
            <p className="text-xs text-muted-foreground mt-1">{filtrosAtivos ? 'Tente outros filtros' : 'Adicione aqui ou pelo Chat'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {gruposVisiveis.map(grupo => (
              <div key={grupo.data}>
                {/* Cabeçalho do grupo */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {grupo.rotulo}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    R$ {grupo.itens.reduce((s, g) => s + Number(g.valor), 0).toFixed(2).replace('.', ',')}
                  </span>
                </div>

                {/* Itens do grupo */}
                <div className="space-y-2">
                  {grupo.itens.map(g => (
                    <div key={g.id}>
                      {confirmandoId === g.id ? (
                        /* Mini confirmação inline */
                        <div
                          className="rounded-2xl px-4 py-3 flex items-center justify-between animate-in fade-in duration-150"
                          style={{ background: '#ef444415', border: '1px solid #ef444430' }}
                        >
                          <div className="flex items-center gap-2">
                            <AlertTriangle size={14} className="text-destructive shrink-0" />
                            <p className="text-sm font-medium text-destructive">Apagar "{g.descricao}"?</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setConfirmandoId(null)}
                              className="text-xs px-3 py-1.5 rounded-xl bg-secondary text-foreground font-medium"
                            >
                              Não
                            </button>
                            <button
                              onClick={() => removerConfirmado(g.id)}
                              className="text-xs px-3 py-1.5 rounded-xl bg-destructive text-white font-semibold"
                            >
                              Apagar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="bg-card rounded-2xl px-4 py-3 flex items-center justify-between animate-in fade-in slide-in-from-bottom-1 duration-300"
                          style={{ boxShadow: '0 1px 8px oklch(0 0 0 / 13%)' }}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                              <CatIcon categoria={g.categoria} size={16} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm leading-tight truncate">{g.descricao}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">{g.categoria}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <span className="font-bold text-destructive text-sm">−R$ {Number(g.valor).toFixed(2).replace('.', ',')}</span>
                            <button onClick={() => abrirEditar(g)} className="text-muted-foreground hover:text-primary transition-colors p-1">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => confirmarRemover(g.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal form ── */}
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
                className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-primary transition-colors"
                autoFocus />
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
