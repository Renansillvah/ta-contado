import { useState, useMemo } from 'react'
import { Plus, Trash2, Pencil, Briefcase, Wrench, Home, ShoppingCart, TrendingUp, DollarSign, CheckCircle, Clock, SlidersHorizontal, X } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'

const CATEGORIAS = [
  { label: 'Salário', Icon: Briefcase, color: 'text-primary' },
  { label: 'Freela / Serviço', Icon: Wrench, color: 'text-blue-400' },
  { label: 'Aluguel', Icon: Home, color: 'text-purple-400' },
  { label: 'Venda', Icon: ShoppingCart, color: 'text-orange-400' },
  { label: 'Investimento', Icon: TrendingUp, color: 'text-yellow-400' },
  { label: 'Outros', Icon: DollarSign, color: 'text-muted-foreground' },
]

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

export default function ReceitasPage() {
  const { receitas, adicionarReceita, removerReceita, loading } = useApp()
  const [showForm, setShowForm] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [showFiltros, setShowFiltros] = useState(false)
  const [filtroCategoria, setFiltroCategoria] = useState('Todas')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroMes, setFiltroMes] = useState('todos')
  const [form, setForm] = useState<FormReceita>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)

  // Meses disponíveis
  const mesesDisponiveis = useMemo(() => {
    const set = new Set(receitas.map(r => r.data.slice(0, 7)))
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [receitas])

  // Receitas filtradas
  const receitasFiltradas = useMemo(() => {
    return receitas.filter(r => {
      const catOk = filtroCategoria === 'Todas' || r.categoria === filtroCategoria
      const tipoOk = filtroTipo === 'todos' || r.tipo === filtroTipo
      const mesOk = filtroMes === 'todos' || r.data.startsWith(filtroMes)
      return catOk && tipoOk && mesOk
    })
  }, [receitas, filtroCategoria, filtroTipo, filtroMes])

  const filtrosAtivos = filtroCategoria !== 'Todas' || filtroTipo !== 'todos' || filtroMes !== 'todos'

  const abrirEditar = (r: any) => {
    setForm({
      descricao: r.descricao,
      categoria: r.categoria,
      valor: String(r.valor),
      tipo: r.tipo,
      data: r.data,
    })
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
      if (editandoId) {
        await removerReceita(editandoId)
      }
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

  const formatarMes = (ym: string) => {
    const [y, m] = ym.split('-')
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    return `${meses[parseInt(m) - 1]} ${y}`
  }

  return (
    <div className="flex flex-col h-full">

      {/* Botões topo */}
      <div className="px-4 pt-4 pb-2 flex gap-2">
        <button
          onClick={() => { setShowForm(true); setEditandoId(null); setForm({ ...FORM_VAZIO, data: new Date().toISOString().split('T')[0] }) }}
          className="flex-1 bg-primary text-primary-foreground rounded-2xl py-3.5 font-semibold flex items-center justify-center gap-2 text-sm active:scale-[0.98] transition-transform"
        >
          <Plus size={18} strokeWidth={2.5} />
          Adicionar receita
        </button>
        <button
          onClick={() => setShowFiltros(v => !v)}
          className="relative w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors"
          style={{ backgroundColor: showFiltros ? 'oklch(0.62 0.18 162)' : 'oklch(0.25 0.04 240)' }}
        >
          <SlidersHorizontal size={17} className={showFiltros ? 'text-white' : 'text-muted-foreground'} />
          {filtrosAtivos && !showFiltros && (
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-orange-400" />
          )}
        </button>
      </div>

      {/* Painel de filtros */}
      {showFiltros && (
        <div className="px-4 pb-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="bg-card rounded-2xl p-3 space-y-3" style={{ boxShadow: '0 1px 8px oklch(0 0 0 / 15%)' }}>

            {/* Categoria */}
            <div>
              <p className="text-[11px] text-muted-foreground font-medium mb-2">Categoria</p>
              <div className="flex flex-wrap gap-1.5">
                {['Todas', ...CATEGORIAS.map(c => c.label)].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setFiltroCategoria(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      filtroCategoria === cat
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-secondary text-foreground border-border'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <p className="text-[11px] text-muted-foreground font-medium mb-2">Status</p>
              <div className="flex gap-1.5">
                {[{ value: 'todos', label: 'Todos' }, { value: 'recebido', label: 'Recebido' }, { value: 'a_receber', label: 'A receber' }].map(t => (
                  <button
                    key={t.value}
                    onClick={() => setFiltroTipo(t.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      filtroTipo === t.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-secondary text-foreground border-border'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mês */}
            {mesesDisponiveis.length > 0 && (
              <div>
                <p className="text-[11px] text-muted-foreground font-medium mb-2">Mês</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setFiltroMes('todos')}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      filtroMes === 'todos'
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-secondary text-foreground border-border'
                    }`}
                  >
                    Todos
                  </button>
                  {mesesDisponiveis.map(mes => (
                    <button
                      key={mes}
                      onClick={() => setFiltroMes(mes)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        filtroMes === mes
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-secondary text-foreground border-border'
                      }`}
                    >
                      {formatarMes(mes)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filtrosAtivos && (
              <button
                onClick={() => { setFiltroCategoria('Todas'); setFiltroTipo('todos'); setFiltroMes('todos') }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={12} /> Limpar filtros
              </button>
            )}
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="space-y-2.5">
            {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
          </div>
        ) : receitasFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-4">
              <TrendingUp size={24} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground/60">
              {filtrosAtivos ? 'Nenhuma receita encontrada' : 'Nenhuma receita ainda'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {filtrosAtivos ? 'Tente outros filtros' : 'Adicione aqui ou pelo Chat'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {receitasFiltradas.map(r => (
              <div
                key={r.id}
                className="bg-card rounded-2xl px-4 py-3.5 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-300"
                style={{ boxShadow: '0 1px 8px oklch(0 0 0 / 15%)' }}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                    <CatIcon categoria={r.categoria} size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-foreground leading-tight truncate">{r.descricao}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[11px] text-muted-foreground">
                        {r.categoria} · {format(new Date(r.data + 'T12:00:00'), "d 'de' MMM", { locale: ptBR })}
                      </p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 font-medium shrink-0 ${
                        r.tipo === 'recebido'
                          ? 'bg-primary/15 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {r.tipo === 'recebido'
                          ? <><CheckCircle size={9} /> Recebido</>
                          : <><Clock size={9} /> A receber</>
                        }
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <span className="font-bold text-primary text-sm">
                    +R$ {Number(r.valor).toFixed(2).replace('.', ',')}
                  </span>
                  <button
                    onClick={() => abrirEditar(r)}
                    className="text-muted-foreground hover:text-primary transition-colors p-1"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Tem certeza que quer apagar esta receita?')) removerReceita(r.id)
                    }}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/75 flex items-end justify-center z-50" onClick={fecharForm}>
          <div
            className="bg-card rounded-t-3xl w-full max-w-lg p-5 pb-8 space-y-4 max-h-[90vh] overflow-y-auto"
            style={{ boxShadow: '0 -4px 30px oklch(0 0 0 / 40%)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-1" />
            <h2 className="text-base font-bold flex items-center gap-2">
              {editandoId
                ? <><Pencil size={16} className="text-primary" /> Editar Receita</>
                : <><TrendingUp size={18} className="text-primary" /> Registrar Receita</>
              }
            </h2>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Descrição / Fonte *</label>
              <input
                type="text"
                placeholder="Ex: Salário empresa X, Freela..."
                value={form.descricao}
                onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Categoria</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIAS.map(cat => (
                  <button
                    key={cat.label}
                    onClick={() => setForm(p => ({ ...p, categoria: cat.label }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                      form.categoria === cat.label
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-secondary text-foreground border-border'
                    }`}
                  >
                    <cat.Icon size={12} />
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Valor (R$) *</label>
                <input
                  type="number"
                  placeholder="0,00"
                  value={form.valor}
                  onChange={e => setForm(p => ({ ...p, valor: e.target.value }))}
                  className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Data</label>
                <input
                  type="date"
                  value={form.data}
                  onChange={e => setForm(p => ({ ...p, data: e.target.value }))}
                  className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-primary transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Status</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setForm(p => ({ ...p, tipo: 'recebido' }))}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors flex items-center justify-center gap-2 ${
                    form.tipo === 'recebido' ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-foreground border-border'
                  }`}
                >
                  <CheckCircle size={14} /> Já recebi
                </button>
                <button
                  onClick={() => setForm(p => ({ ...p, tipo: 'a_receber' }))}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors flex items-center justify-center gap-2 ${
                    form.tipo === 'a_receber' ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-foreground border-border'
                  }`}
                >
                  <Clock size={14} /> Vou receber
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={fecharForm}
                className="flex-1 bg-secondary text-foreground rounded-xl py-3.5 text-sm font-medium active:scale-[0.98] transition-transform"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                className="flex-1 bg-primary text-primary-foreground rounded-xl py-3.5 text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
              >
                {salvando ? 'Salvando...' : editandoId ? 'Atualizar' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
