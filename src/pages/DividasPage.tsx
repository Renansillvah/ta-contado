import { useState, useMemo } from 'react'
import { Plus, Trash2, Pencil, Package, AlertTriangle, Clock, AlertCircle, CreditCard, Building2, MoreHorizontal, CheckCircle2, SlidersHorizontal, X } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { Skeleton } from '@/components/ui/skeleton'
import { differenceInDays, parseISO } from 'date-fns'

interface FormDivida {
  nome: string
  tipo: 'cartao' | 'emprestimo' | 'outros'
  valor_total: string
  credor: string
  vencimento: string
  parcelado: boolean
  parcelas: string
}

const TIPOS = [
  { value: 'cartao', label: 'Cartão', Icon: CreditCard },
  { value: 'emprestimo', label: 'Empréstimo', Icon: Building2 },
  { value: 'outros', label: 'Outros', Icon: MoreHorizontal },
]

function TipoIcon({ tipo, size = 16 }: { tipo: string; size?: number }) {
  const t = TIPOS.find(x => x.value === tipo) || TIPOS[2]
  return <t.Icon size={size} className="text-muted-foreground" />
}

const FORM_VAZIO: FormDivida = {
  nome: '', tipo: 'cartao', valor_total: '', credor: '', vencimento: '', parcelado: false, parcelas: '',
}

export default function DividasPage() {
  const { dividas, adicionarDivida, removerDivida, pagarDivida, loading } = useApp()
  const [showForm, setShowForm] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [showFiltros, setShowFiltros] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('Todos')
  const [filtroStatus, setFiltroStatus] = useState('todos')

  const hoje = new Date()

  // Alertas de vencimento
  const alertas = useMemo(() => {
    return dividas
      .filter(d => d.vencimento && Number(d.valor_total) > Number(d.valor_pago))
      .map(d => {
        const diff = differenceInDays(parseISO(d.vencimento!), hoje)
        return { ...d, diff }
      })
      .filter(d => d.diff <= 7)
      .sort((a, b) => a.diff - b.diff)
  }, [dividas])

  // Filtros
  const dividasFiltradas = useMemo(() => {
    return dividas.filter(d => {
      const tipoOk = filtroTipo === 'Todos' || d.tipo === filtroTipo
      const restante = Number(d.valor_total) - Number(d.valor_pago)
      const statusOk =
        filtroStatus === 'todos' ||
        (filtroStatus === 'ativa' && restante > 0) ||
        (filtroStatus === 'quitada' && restante <= 0)
      return tipoOk && statusOk
    })
  }, [dividas, filtroTipo, filtroStatus])

  const filtrosAtivos = filtroTipo !== 'Todos' || filtroStatus !== 'todos'

  const [showPagamento, setShowPagamento] = useState<string | null>(null)
  const [valorPagamento, setValorPagamento] = useState('')
  const [form, setForm] = useState<FormDivida>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)

  const abrirEditar = (d: any) => {
    setForm({
      nome: d.nome,
      tipo: d.tipo,
      valor_total: String(d.valor_total),
      credor: d.credor || '',
      vencimento: d.vencimento || '',
      parcelado: d.parcelado || false,
      parcelas: d.parcelas ? String(d.parcelas) : '',
    })
    setEditandoId(d.id)
    setShowForm(true)
  }

  const fecharForm = () => {
    setShowForm(false)
    setEditandoId(null)
    setForm(FORM_VAZIO)
  }

  const salvar = async () => {
    if (!form.nome || !form.valor_total) return
    setSalvando(true)
    try {
      if (editandoId) {
        await removerDivida(editandoId)
      }
      await adicionarDivida({
        nome: form.nome,
        tipo: form.tipo,
        valor_total: parseFloat(form.valor_total.replace(',', '.')),
        valor_pago: 0,
        credor: form.credor || undefined,
        vencimento: form.vencimento || undefined,
        parcelado: form.parcelado,
        parcelas: form.parcelado && form.parcelas ? parseInt(form.parcelas) : undefined,
        parcela_atual: 0,
      })
      fecharForm()
    } finally {
      setSalvando(false)
    }
  }

  const registrarPagamento = async () => {
    if (!showPagamento || !valorPagamento) return
    await pagarDivida(showPagamento, parseFloat(valorPagamento.replace(',', '.')))
    setShowPagamento(null)
    setValorPagamento('')
  }

  return (
    <div className="flex flex-col h-full">

      {/* Alertas de vencimento */}
      {alertas.length > 0 && (
        <div className="px-4 pt-4 space-y-2">
          {alertas.map(d => {
            const vencido = d.diff < 0
            const urgente = d.diff >= 0 && d.diff <= 3
            const bgStyle = vencido
              ? 'bg-destructive/12 border-destructive/30'
              : urgente
                ? 'bg-orange-500/12 border-orange-500/30'
                : 'bg-secondary border-border'
            const icon = vencido
              ? <AlertCircle size={14} className="text-destructive shrink-0" />
              : urgente
                ? <AlertTriangle size={14} className="text-orange-400 shrink-0" />
                : <Clock size={14} className="text-muted-foreground shrink-0" />
            const msg = vencido
              ? `Venceu há ${Math.abs(d.diff)} dia${Math.abs(d.diff) !== 1 ? 's' : ''}`
              : d.diff === 0
                ? 'Vence hoje!'
                : `Vence em ${d.diff} dia${d.diff !== 1 ? 's' : ''}`
            return (
              <div key={d.id} className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 border text-sm ${bgStyle}`}>
                {icon}
                <span className="font-medium flex-1 text-sm">{d.nome}</span>
                <span className="text-[11px] text-muted-foreground">{msg}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Botões topo */}
      <div className="px-4 pt-4 pb-2 flex gap-2">
        <button
          onClick={() => { setShowForm(true); setEditandoId(null); setForm(FORM_VAZIO) }}
          className="flex-1 bg-primary text-primary-foreground rounded-2xl py-3.5 font-semibold flex items-center justify-center gap-2 text-sm active:scale-[0.98] transition-transform"
        >
          <Plus size={18} strokeWidth={2.5} />
          Adicionar dívida
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

            {/* Tipo */}
            <div>
              <p className="text-[11px] text-muted-foreground font-medium mb-2">Tipo</p>
              <div className="flex flex-wrap gap-1.5">
                {['Todos', 'cartao', 'emprestimo', 'outros'].map(t => {
                  const label = t === 'Todos' ? 'Todos' : t === 'cartao' ? 'Cartão' : t === 'emprestimo' ? 'Empréstimo' : 'Outros'
                  return (
                    <button
                      key={t}
                      onClick={() => setFiltroTipo(t)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        filtroTipo === t
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-secondary text-foreground border-border'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Status */}
            <div>
              <p className="text-[11px] text-muted-foreground font-medium mb-2">Status</p>
              <div className="flex gap-1.5">
                {[{ value: 'todos', label: 'Todos' }, { value: 'ativa', label: 'Em aberto' }, { value: 'quitada', label: 'Quitada' }].map(s => (
                  <button
                    key={s.value}
                    onClick={() => setFiltroStatus(s.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      filtroStatus === s.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-secondary text-foreground border-border'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {filtrosAtivos && (
              <button
                onClick={() => { setFiltroTipo('Todos'); setFiltroStatus('todos') }}
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
            {[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
          </div>
        ) : dividasFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-4">
              <CreditCard size={24} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground/60">
              {filtrosAtivos ? 'Nenhuma dívida encontrada' : 'Nenhuma dívida'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {filtrosAtivos ? 'Tente outros filtros' : 'Adicione aqui ou pelo Chat'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {dividasFiltradas.map(d => {
              const restante = Number(d.valor_total) - Number(d.valor_pago)
              const pct = Math.min((Number(d.valor_pago) / Number(d.valor_total)) * 100, 100)
              return (
                <div
                  key={d.id}
                  className="bg-card rounded-2xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-300"
                  style={{ boxShadow: '0 1px 10px oklch(0 0 0 / 18%)' }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                        <TipoIcon tipo={d.tipo} size={15} />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-foreground leading-tight">{d.nome}</p>
                        {d.credor && <p className="text-[11px] text-muted-foreground mt-0.5">{d.credor}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="text-right mr-1">
                        <p className="text-[10px] text-muted-foreground">Restante</p>
                        <p className="font-bold text-destructive text-sm">R$ {restante.toFixed(2).replace('.', ',')}</p>
                      </div>
                      <button
                        onClick={() => abrirEditar(d)}
                        className="text-muted-foreground hover:text-primary transition-colors p-1"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm('Tem certeza que quer apagar esta dívida?')) removerDivida(d.id)
                        }}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Barra de progresso */}
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">
                      Pago: R$ {Number(d.valor_pago).toFixed(2).replace('.', ',')}
                      <span className="text-muted-foreground/60"> / R$ {Number(d.valor_total).toFixed(2).replace('.', ',')}</span>
                    </p>
                    <button
                      onClick={() => setShowPagamento(d.id)}
                      className="flex items-center gap-1 text-xs text-primary font-semibold"
                    >
                      <CheckCircle2 size={12} />
                      Pagar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal Dívida */}
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
                ? <><Pencil size={16} className="text-primary" /> Editar Dívida</>
                : <><Plus size={18} className="text-primary" /> Nova Dívida</>
              }
            </h2>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Nome *</label>
              <input
                type="text"
                placeholder="Ex: Nubank fatura"
                value={form.nome}
                onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Tipo *</label>
              <div className="flex gap-2">
                {TIPOS.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setForm(p => ({ ...p, tipo: t.value as any }))}
                    className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-medium border transition-colors flex items-center justify-center gap-1.5 ${
                      form.tipo === t.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-secondary text-foreground border-border'
                    }`}
                  >
                    <t.Icon size={13} /> {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Valor total (R$) *</label>
                <input
                  type="number"
                  placeholder="0,00"
                  value={form.valor_total}
                  onChange={e => setForm(p => ({ ...p, valor_total: e.target.value }))}
                  className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Vencimento</label>
                <input
                  type="date"
                  value={form.vencimento}
                  onChange={e => setForm(p => ({ ...p, vencimento: e.target.value }))}
                  className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-primary transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Credor (opcional)</label>
              <input
                type="text"
                placeholder="Banco, pessoa..."
                value={form.credor}
                onChange={e => setForm(p => ({ ...p, credor: e.target.value }))}
                className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-primary transition-colors"
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="parcelado"
                checked={form.parcelado}
                onChange={e => setForm(p => ({ ...p, parcelado: e.target.checked }))}
                className="w-4 h-4 accent-primary"
              />
              <label htmlFor="parcelado" className="text-sm flex items-center gap-1.5 font-medium">
                <Package size={14} className="text-muted-foreground" /> Parcelado
              </label>
            </div>

            {form.parcelado && (
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Número de parcelas</label>
                <input
                  type="number"
                  placeholder="Ex: 12"
                  value={form.parcelas}
                  onChange={e => setForm(p => ({ ...p, parcelas: e.target.value }))}
                  className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-primary transition-colors"
                />
              </div>
            )}

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

      {/* Modal Pagamento */}
      {showPagamento && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4" onClick={() => setShowPagamento(null)}>
          <div
            className="bg-card rounded-2xl w-full max-w-sm p-5 space-y-4"
            style={{ boxShadow: '0 8px 40px oklch(0 0 0 / 50%)' }}
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-bold">Registrar Pagamento</h2>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Valor pago (R$)</label>
              <input
                type="number"
                placeholder="0,00"
                value={valorPagamento}
                onChange={e => setValorPagamento(e.target.value)}
                className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-primary transition-colors"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowPagamento(null)} className="flex-1 bg-secondary text-foreground rounded-xl py-3 text-sm font-medium">Cancelar</button>
              <button onClick={registrarPagamento} className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
