import { useState, useMemo } from 'react'
import { Plus, Trash2, Pencil, Briefcase, Wrench, Home, ShoppingCart, TrendingUp, Mic2, Bike, Video, Package, CheckCircle, Clock, SlidersHorizontal, X, Zap, RefreshCw, AlertTriangle } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'

const CATEGORIAS = [
  { label: 'Salário', Icon: Briefcase, color: 'text-primary', natureza: 'ganho' },
  { label: 'Freela / Serviço', Icon: Wrench, color: 'text-blue-400', natureza: 'ganho' },
  { label: 'Show / Música', Icon: Mic2, color: 'text-pink-400', natureza: 'ganho' },
  { label: 'Drone / Vídeo', Icon: Video, color: 'text-cyan-400', natureza: 'ganho' },
  { label: 'Motoboy / Entrega', Icon: Bike, color: 'text-orange-400', natureza: 'ganho' },
  { label: 'Aluguel', Icon: Home, color: 'text-purple-400', natureza: 'ganho' },
  { label: 'Venda', Icon: ShoppingCart, color: 'text-yellow-400', natureza: 'ganho' },
  { label: 'Investimento', Icon: TrendingUp, color: 'text-emerald-400', natureza: 'ganho' },
  { label: 'Recebimento', Icon: RefreshCw, color: 'text-sky-400', natureza: 'recebimento' },
  { label: 'Outros', Icon: Package, color: 'text-muted-foreground', natureza: 'ganho' },
] as const

function categoriaNatureza(cat: string): 'ganho' | 'recebimento' {
  return cat === 'Recebimento' ? 'recebimento' : 'ganho'
}

interface FormReceita {
  descricao: string
  categoria: string
  valor: string
  tipo: 'recebido' | 'a_receber'
  data: string
}

const FORM_VAZIO: FormReceita = {
  descricao: '', categoria: 'Salário', valor: '', tipo: 'recebido',
  data: new Date().toISOString().split('T')[0],
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

function agruparPorData(lista: any[]) {
  const grupos: { rotulo: string; data: string; itens: any[] }[] = []
  const map = new Map<string, any[]>()
  for (const r of lista) {
    if (!map.has(r.data)) map.set(r.data, [])
    map.get(r.data)!.push(r)
  }
  for (const [data, itens] of map.entries()) {
    grupos.push({ rotulo: rotuloData(data), data, itens })
  }
  return grupos
}

const MES_ATUAL = new Date().toISOString().slice(0, 7)

export default function ReceitasPage() {
  const { receitas, adicionarReceita, removerReceita, marcarRecebido, loading } = useApp()
  const [subAba, setSubAba] = useState<'ganho' | 'recebimento'>('ganho')
  const [showForm, setShowForm] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [showFiltros, setShowFiltros] = useState(false)
  const [filtroCategoria, setFiltroCategoria] = useState('Todas')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroMes, setFiltroMes] = useState('todos')
  const [form, setForm] = useState<FormReceita>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [marcandoId, setMarcandoId] = useState<string | null>(null)
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)

  const receitasGanhos = useMemo(() =>
    receitas.filter(r => categoriaNatureza(r.categoria) === 'ganho'),
  [receitas])

  const receitasRecebimentos = useMemo(() =>
    receitas.filter(r => categoriaNatureza(r.categoria) === 'recebimento'),
  [receitas])

  const receitasSubAba = subAba === 'ganho' ? receitasGanhos : receitasRecebimentos

  // Totais do mês
  const totalRecebidoMes = useMemo(() =>
    receitasGanhos.filter(r => r.data.startsWith(MES_ATUAL) && r.tipo === 'recebido').reduce((s, r) => s + Number(r.valor), 0),
  [receitasGanhos])

  const totalAReceberMes = useMemo(() =>
    receitasGanhos.filter(r => r.data.startsWith(MES_ATUAL) && r.tipo === 'a_receber').reduce((s, r) => s + Number(r.valor), 0),
  [receitasGanhos])

  const totalRecebimentosMes = useMemo(() =>
    receitasRecebimentos.filter(r => r.data.startsWith(MES_ATUAL) && r.tipo === 'recebido').reduce((s, r) => s + Number(r.valor), 0),
  [receitasRecebimentos])

  const totalEsperadoMes = totalRecebidoMes + totalAReceberMes
  const pctRecebido = totalEsperadoMes > 0 ? (totalRecebidoMes / totalEsperadoMes) * 100 : 0

  const mesesDisponiveis = useMemo(() => {
    const set = new Set(receitasSubAba.map(r => r.data.slice(0, 7)))
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [receitasSubAba])

  const categoriasDaSubAba = CATEGORIAS.filter(c => c.natureza === subAba)

  const receitasFiltradas = useMemo(() => {
    return receitasSubAba.filter(r => {
      const catOk = filtroCategoria === 'Todas' || r.categoria === filtroCategoria
      const tipoOk = filtroTipo === 'todos' || r.tipo === filtroTipo
      const mesOk = filtroMes === 'todos' || r.data.startsWith(filtroMes)
      return catOk && tipoOk && mesOk
    })
  }, [receitasSubAba, filtroCategoria, filtroTipo, filtroMes])

  // Pendentes sempre no topo, recebidos agrupados por data
  const pendentes = useMemo(() =>
    receitasFiltradas.filter(r => r.tipo === 'a_receber'),
  [receitasFiltradas])

  const recebidos = useMemo(() =>
    receitasFiltradas.filter(r => r.tipo === 'recebido'),
  [receitasFiltradas])

  const gruposRecebidos = useMemo(() => agruparPorData(recebidos), [recebidos])

  const filtrosAtivos = filtroCategoria !== 'Todas' || filtroTipo !== 'todos' || filtroMes !== 'todos'

  const totalFiltrado = useMemo(() =>
    receitasFiltradas.filter(r => r.tipo === 'recebido').reduce((s, r) => s + Number(r.valor), 0),
  [receitasFiltradas])

  const trocarSubAba = (aba: 'ganho' | 'recebimento') => {
    setSubAba(aba)
    setFiltroCategoria('Todas')
    setFiltroTipo('todos')
    setFiltroMes('todos')
    setShowFiltros(false)
    setConfirmandoId(null)
  }

  const abrirEditar = (r: any) => {
    setForm({ descricao: r.descricao, categoria: r.categoria, valor: String(r.valor), tipo: r.tipo, data: r.data })
    setEditandoId(r.id)
    setShowForm(true)
  }

  const fecharForm = () => {
    setShowForm(false)
    setEditandoId(null)
    setForm({ ...FORM_VAZIO, data: new Date().toISOString().split('T')[0] })
  }

  const salvar = async () => {
    if (!form.descricao || !form.valor) return
    setSalvando(true)
    try {
      if (editandoId) await removerReceita(editandoId)
      await adicionarReceita({
        descricao: form.descricao,
        categoria: form.categoria,
        valor: parseFloat(form.valor.replace(',', '.')),
        tipo: form.tipo,
        data: form.data,
      })
      fecharForm()
    } finally {
      setSalvando(false)
    }
  }

  const handleMarcarRecebido = async (id: string) => {
    setMarcandoId(id)
    await marcarRecebido(id)
    setMarcandoId(null)
  }

  const formatarMes = (ym: string) => {
    const [y, m] = ym.split('-')
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    return `${meses[parseInt(m) - 1]} ${y}`
  }

  // Frase de contexto
  const fraseContexto = useMemo(() => {
    if (totalAReceberMes > 0 && totalRecebidoMes > 0) {
      return { txt: `${pctRecebido.toFixed(0)}% recebido — faltam R$ ${totalAReceberMes.toFixed(2).replace('.', ',')} entrar`, cor: '#f97316' }
    }
    if (totalAReceberMes > 0 && totalRecebidoMes === 0) {
      return { txt: `R$ ${totalAReceberMes.toFixed(2).replace('.', ',')} ainda não recebidos este mês`, cor: '#f97316' }
    }
    if (totalRecebidoMes > 0 && totalAReceberMes === 0) {
      return { txt: 'Tudo recebido este mês!', cor: 'oklch(0.62 0.18 162)' }
    }
    return null
  }, [totalRecebidoMes, totalAReceberMes, pctRecebido])

  const renderItem = (r: any) => (
    <div key={r.id}>
      {confirmandoId === r.id ? (
        <div
          className="rounded-2xl px-4 py-3 flex items-center justify-between animate-in fade-in duration-150"
          style={{ background: '#ef444415', border: '1px solid #ef444430' }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-destructive shrink-0" />
            <p className="text-sm font-medium text-destructive">Apagar "{r.descricao}"?</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmandoId(null)}
              className="text-xs px-3 py-1.5 rounded-xl bg-secondary text-foreground font-medium"
            >
              Não
            </button>
            <button
              onClick={async () => { await removerReceita(r.id); setConfirmandoId(null) }}
              className="text-xs px-3 py-1.5 rounded-xl bg-destructive text-white font-semibold"
            >
              Apagar
            </button>
          </div>
        </div>
      ) : (
        <div
          className="bg-card rounded-2xl px-4 py-3 animate-in fade-in slide-in-from-bottom-1 duration-300"
          style={{
            boxShadow: '0 1px 8px oklch(0 0 0 / 13%)',
            ...(r.tipo === 'a_receber' ? { border: '1px solid oklch(0.62 0.18 162 / 25%)' } : {}),
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                <CatIcon categoria={r.categoria} size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm text-foreground leading-tight truncate">{r.descricao}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {r.categoria} · {format(new Date(r.data + 'T12:00:00'), "d 'de' MMM", { locale: ptBR })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <span className="font-bold text-primary text-sm">+R$ {Number(r.valor).toFixed(2).replace('.', ',')}</span>
              {r.tipo === 'a_receber' && (
                <button
                  onClick={() => handleMarcarRecebido(r.id)}
                  disabled={marcandoId === r.id}
                  title="Marcar como recebido"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold ml-1 disabled:opacity-50 transition-all active:scale-95"
                  style={{ background: 'oklch(0.62 0.18 162 / 15%)', color: 'oklch(0.62 0.18 162)' }}
                >
                  {marcandoId === r.id
                    ? <Clock size={12} className="animate-spin" />
                    : <><Zap size={11} /> Recebi!</>
                  }
                </button>
              )}
              <button onClick={() => abrirEditar(r)} className="text-muted-foreground hover:text-primary transition-colors p-1">
                <Pencil size={13} />
              </button>
              <button onClick={() => setConfirmandoId(r.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="flex flex-col h-full">

      {/* ── Card topo com contexto ── */}
      <div className="px-4 pt-4 pb-2">
        <div className="bg-card rounded-2xl p-4" style={{ boxShadow: '0 1px 12px oklch(0 0 0 / 20%)' }}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[11px] text-muted-foreground font-medium mb-0.5">
                {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())}
              </p>
              <p className="text-2xl font-bold text-foreground leading-tight">
                R$ {totalRecebidoMes.toFixed(2).replace('.', ',')}
              </p>
              {fraseContexto && (
                <p className="text-[11px] mt-1 font-medium" style={{ color: fraseContexto.cor }}>
                  {fraseContexto.txt}
                </p>
              )}
              {!fraseContexto && (
                <p className="text-[11px] text-muted-foreground mt-1">ganhos recebidos este mês</p>
              )}
            </div>
            {totalRecebimentosMes > 0 && (
              <div className="bg-sky-500/10 rounded-xl px-3 py-2 text-right">
                <p className="text-[10px] text-muted-foreground">Recebimentos</p>
                <p className="text-sm font-bold text-sky-400">R$ {totalRecebimentosMes.toFixed(2).replace('.', ',')}</p>
              </div>
            )}
          </div>

          {/* Barra de progresso do recebimento */}
          {totalEsperadoMes > 0 && (
            <div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pctRecebido}%`,
                    backgroundColor: pctRecebido >= 100 ? 'oklch(0.62 0.18 162)' : '#f97316',
                  }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">{pctRecebido.toFixed(0)}% recebido</span>
                {totalAReceberMes > 0 && (
                  <span className="text-[10px] text-muted-foreground">+R$ {totalAReceberMes.toFixed(2).replace('.', ',')} a entrar</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Sub-abas Ganhos / Recebimentos ── */}
      <div className="px-4 pb-2">
        <div className="flex gap-1 p-1 bg-secondary rounded-2xl">
          <button
            onClick={() => trocarSubAba('ganho')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${subAba === 'ganho' ? 'bg-card text-foreground' : 'text-muted-foreground'}`}
            style={subAba === 'ganho' ? { boxShadow: '0 1px 6px oklch(0 0 0 / 20%)' } : {}}
          >
            <TrendingUp size={14} className={subAba === 'ganho' ? 'text-primary' : 'text-muted-foreground'} />
            Ganhos
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${subAba === 'ganho' ? 'bg-primary/15 text-primary' : 'bg-muted/50 text-muted-foreground'}`}>
              {receitasGanhos.length}
            </span>
          </button>
          <button
            onClick={() => trocarSubAba('recebimento')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${subAba === 'recebimento' ? 'bg-card text-foreground' : 'text-muted-foreground'}`}
            style={subAba === 'recebimento' ? { boxShadow: '0 1px 6px oklch(0 0 0 / 20%)' } : {}}
          >
            <RefreshCw size={14} className={subAba === 'recebimento' ? 'text-sky-400' : 'text-muted-foreground'} />
            Recebimentos
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${subAba === 'recebimento' ? 'bg-sky-500/15 text-sky-400' : 'bg-muted/50 text-muted-foreground'}`}>
              {receitasRecebimentos.length}
            </span>
          </button>
        </div>
      </div>

      {/* ── Botões ação + filtro ── */}
      <div className="px-4 pb-2 flex gap-2">
        <button
          onClick={() => {
            setShowForm(true)
            setEditandoId(null)
            setForm({ ...FORM_VAZIO, categoria: subAba === 'ganho' ? 'Salário' : 'Recebimento', data: new Date().toISOString().split('T')[0] })
          }}
          className="flex-1 bg-primary text-primary-foreground rounded-2xl py-3.5 font-semibold flex items-center justify-center gap-2 text-sm active:scale-[0.98] transition-transform"
        >
          <Plus size={18} strokeWidth={2.5} />
          {subAba === 'ganho' ? 'Adicionar ganho' : 'Adicionar recebimento'}
        </button>
        <button
          onClick={() => setShowFiltros(v => !v)}
          className="relative w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors"
          style={{ backgroundColor: showFiltros || filtrosAtivos ? 'oklch(0.62 0.18 162)' : 'oklch(0.25 0.04 240)' }}
        >
          <SlidersHorizontal size={17} className={showFiltros || filtrosAtivos ? 'text-white' : 'text-muted-foreground'} />
          {filtrosAtivos && !showFiltros && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-orange-400" />}
        </button>
      </div>

      {/* ── Filtros ── */}
      {showFiltros && (
        <div className="mx-4 mb-2 bg-card rounded-2xl p-3.5 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200" style={{ boxShadow: '0 1px 8px oklch(0 0 0 / 15%)' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Filtros</span>
            {filtrosAtivos && (
              <button onClick={() => { setFiltroCategoria('Todas'); setFiltroTipo('todos'); setFiltroMes('todos') }}
                className="text-[11px] text-destructive flex items-center gap-1 font-medium">
                <X size={11} /> Limpar
              </button>
            )}
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium mb-1.5">Categoria</p>
            <div className="flex flex-wrap gap-1.5">
              {['Todas', ...categoriasDaSubAba.map(c => c.label)].map(cat => (
                <button key={cat} onClick={() => setFiltroCategoria(cat)}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-colors ${filtroCategoria === cat ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-foreground border-border'}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground font-medium mb-1.5">Status</p>
            <div className="flex gap-1.5">
              {[{ value: 'todos', label: 'Todos' }, { value: 'recebido', label: 'Recebido' }, { value: 'a_receber', label: 'A receber' }].map(t => (
                <button key={t.value} onClick={() => setFiltroTipo(t.value)}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-colors ${filtroTipo === t.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-foreground border-border'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {mesesDisponiveis.length > 0 && (
            <div>
              <p className="text-[11px] text-muted-foreground font-medium mb-1.5">Mês</p>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setFiltroMes('todos')}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-colors ${filtroMes === 'todos' ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-foreground border-border'}`}>
                  Todos
                </button>
                {mesesDisponiveis.map(mes => (
                  <button key={mes} onClick={() => setFiltroMes(mes)}
                    className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-colors ${filtroMes === mes ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-foreground border-border'}`}>
                    {formatarMes(mes)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Total filtrado visível fora do painel ── */}
      {filtrosAtivos && receitasFiltradas.length > 0 && (
        <div className="px-5 pb-2 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {receitasFiltradas.length} resultado{receitasFiltradas.length !== 1 ? 's' : ''}
          </span>
          <span className="text-[11px] font-semibold text-primary">
            Total: R$ {totalFiltrado.toFixed(2).replace('.', ',')}
          </span>
        </div>
      )}

      {/* ── Lista ── */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="space-y-2.5">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}</div>
        ) : receitasFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-4">
              {subAba === 'ganho' ? <TrendingUp size={24} className="text-muted-foreground" /> : <RefreshCw size={24} className="text-muted-foreground" />}
            </div>
            <p className="text-sm font-medium text-foreground/60">
              {filtrosAtivos ? 'Nenhuma receita encontrada' : subAba === 'ganho' ? 'Nenhum ganho ainda' : 'Nenhum recebimento ainda'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {filtrosAtivos ? 'Tente outros filtros' : 'Adicione aqui ou pelo Chat'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">

            {/* Pendentes sempre no topo */}
            {pendentes.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#f97316' }}>
                    A receber · {pendentes.length}
                  </span>
                  <span className="text-[11px] font-semibold" style={{ color: '#f97316' }}>
                    R$ {pendentes.reduce((s, r) => s + Number(r.valor), 0).toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <div className="space-y-2">
                  {pendentes.map(r => renderItem(r))}
                </div>
              </div>
            )}

            {/* Recebidos agrupados por data */}
            {gruposRecebidos.map(grupo => (
              <div key={grupo.data}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {grupo.rotulo}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    R$ {grupo.itens.reduce((s, r) => s + Number(r.valor), 0).toFixed(2).replace('.', ',')}
                  </span>
                </div>
                <div className="space-y-2">
                  {grupo.itens.map(r => renderItem(r))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/75 flex items-end justify-center z-50" onClick={fecharForm}>
          <div className="bg-card rounded-t-3xl w-full max-w-lg p-5 pb-8 space-y-4 max-h-[90vh] overflow-y-auto"
            style={{ boxShadow: '0 -4px 30px oklch(0 0 0 / 40%)' }}
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-1" />
            <h2 className="text-base font-bold flex items-center gap-2">
              {editandoId
                ? <><Pencil size={16} className="text-primary" /> Editar Receita</>
                : subAba === 'ganho'
                  ? <><TrendingUp size={18} className="text-primary" /> Registrar Ganho</>
                  : <><RefreshCw size={18} className="text-sky-400" /> Registrar Recebimento</>
              }
            </h2>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Descrição / Fonte *</label>
              <input type="text" placeholder="Ex: Salário, Freela, Show..." value={form.descricao}
                onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-primary transition-colors"
                autoFocus />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Categoria</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIAS.filter(c => c.natureza === subAba).map(cat => (
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
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Status</label>
              <div className="flex gap-3">
                <button onClick={() => setForm(p => ({ ...p, tipo: 'recebido' }))}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors flex items-center justify-center gap-2 ${form.tipo === 'recebido' ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-foreground border-border'}`}>
                  <CheckCircle size={14} /> Já recebi
                </button>
                <button onClick={() => setForm(p => ({ ...p, tipo: 'a_receber' }))}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors flex items-center justify-center gap-2 ${form.tipo === 'a_receber' ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-foreground border-border'}`}>
                  <Clock size={14} /> Vou receber
                </button>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={fecharForm}
                className="flex-1 bg-secondary text-foreground rounded-xl py-3.5 text-sm font-medium active:scale-[0.98] transition-transform">Cancelar</button>
              <button onClick={salvar} disabled={salvando}
                className="flex-1 bg-primary text-primary-foreground rounded-xl py-3.5 text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform">
                {salvando ? 'Salvando...' : editandoId ? 'Atualizar' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
