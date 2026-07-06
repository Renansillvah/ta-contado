import { useState, useMemo, useRef } from 'react'
import { Plus, Pencil, Package, AlertTriangle, Clock, AlertCircle, CreditCard, CheckCircle2, SlidersHorizontal, X, TrendingDown, ChevronRight } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { Skeleton } from '@/components/ui/skeleton'
import { differenceInDays, parseISO, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface FormDivida {
  nome: string
  tipo: 'cartao' | 'emprestimo' | 'outros'
  valor_total: string
  valor_pago_atual: string
  credor: string
  vencimento: string
  parcelado: boolean
  parcelas: string
}

const TIPOS = [
  { value: 'cartao', label: 'Cartão', emoji: '💳' },
  { value: 'emprestimo', label: 'Empréstimo', emoji: '🏦' },
  { value: 'outros', label: 'Outros', emoji: '📌' },
]

const TIPO_EMOJI: Record<string, string> = {
  cartao: '💳',
  emprestimo: '🏦',
  cheque: '📝',
  outros: '📌',
}

function TipoEmoji({ tipo }: { tipo: string }) {
  return <span className="text-base leading-none">{TIPO_EMOJI[tipo] ?? '📌'}</span>
}

const FORM_VAZIO: FormDivida = {
  nome: '', tipo: 'cartao', valor_total: '', valor_pago_atual: '0',
  credor: '', vencimento: '', parcelado: false, parcelas: '',
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function DividasPage() {
  const { dividas, adicionarDivida, removerDivida, pagarDivida, atualizarDivida, loading } = useApp()
  const [showForm, setShowForm] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [showFiltros, setShowFiltros] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('Todos')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [pagandoId, setPagandoId] = useState<string | null>(null)
  const [valorPagamento, setValorPagamento] = useState('')
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)
  const [form, setForm] = useState<FormDivida>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const inputPagamentoRef = useRef<HTMLInputElement>(null)

  const hoje = new Date()

  const totalDivido = useMemo(() => dividas.reduce((s, d) => s + Number(d.valor_total), 0), [dividas])
  const totalPago = useMemo(() => dividas.reduce((s, d) => s + Number(d.valor_pago), 0), [dividas])
  const totalRestante = totalDivido - totalPago
  const pctGeral = totalDivido > 0 ? Math.min((totalPago / totalDivido) * 100, 100) : 0
  const dividasAbertas = dividas.filter(d => Number(d.valor_total) - Number(d.valor_pago) > 0).length

  const temVencidas = useMemo(() =>
    dividas.some(d => d.vencimento && Number(d.valor_total) > Number(d.valor_pago) && differenceInDays(parseISO(d.vencimento), hoje) < 0),
    [dividas]
  )

  const alertas = useMemo(() => {
    return dividas
      .filter(d => d.vencimento && Number(d.valor_total) > Number(d.valor_pago))
      .map(d => ({ ...d, diff: differenceInDays(parseISO(d.vencimento!), hoje) }))
      .filter(d => d.diff <= 7)
      .sort((a, b) => a.diff - b.diff)
  }, [dividas])

  // Ordenação: vencidas → urgentes (≤3d) → abertas por vencimento → quitadas
  const dividasFiltradas = useMemo(() => {
    const lista = dividas.filter(d => {
      const tipoOk = filtroTipo === 'Todos' || d.tipo === filtroTipo
      const restante = Number(d.valor_total) - Number(d.valor_pago)
      const statusOk =
        filtroStatus === 'todos' ||
        (filtroStatus === 'ativa' && restante > 0) ||
        (filtroStatus === 'quitada' && restante <= 0)
      return tipoOk && statusOk
    })

    return lista.sort((a, b) => {
      const restA = Number(a.valor_total) - Number(a.valor_pago)
      const restB = Number(b.valor_total) - Number(b.valor_pago)
      const qA = restA <= 0
      const qB = restB <= 0

      // Quitadas sempre por último
      if (qA && !qB) return 1
      if (!qA && qB) return -1

      // Ambas em aberto: ordena por urgência de vencimento
      const diffA = a.vencimento ? differenceInDays(parseISO(a.vencimento), hoje) : 999
      const diffB = b.vencimento ? differenceInDays(parseISO(b.vencimento), hoje) : 999
      return diffA - diffB
    })
  }, [dividas, filtroTipo, filtroStatus])

  const filtrosAtivos = filtroTipo !== 'Todos' || filtroStatus !== 'todos'

  const abrirEditar = (d: any) => {
    setForm({
      nome: d.nome,
      tipo: d.tipo,
      valor_total: String(d.valor_total),
      valor_pago_atual: String(d.valor_pago ?? 0),
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
      const valorTotal = parseFloat(form.valor_total.replace(',', '.'))
      const valorPagoAtual = parseFloat(form.valor_pago_atual.replace(',', '.') || '0') || 0

      if (editandoId) {
        await atualizarDivida(editandoId, {
          nome: form.nome,
          tipo: form.tipo,
          valor_total: valorTotal,
          valor_pago: Math.min(valorPagoAtual, valorTotal),
          credor: form.credor || undefined,
          vencimento: form.vencimento || undefined,
          parcelado: form.parcelado,
          parcelas: form.parcelado && form.parcelas ? parseInt(form.parcelas) : undefined,
        })
      } else {
        await adicionarDivida({
          nome: form.nome,
          tipo: form.tipo,
          valor_total: valorTotal,
          valor_pago: 0,
          credor: form.credor || undefined,
          vencimento: form.vencimento || undefined,
          parcelado: form.parcelado,
          parcelas: form.parcelado && form.parcelas ? parseInt(form.parcelas) : undefined,
          parcela_atual: 0,
        })
      }
      fecharForm()
    } finally {
      setSalvando(false)
    }
  }

  const abrirPagamento = (d: any) => {
    setPagandoId(d.id)
    setValorPagamento('')
    setTimeout(() => inputPagamentoRef.current?.focus(), 100)
  }

  const registrarPagamento = async (quitarTudo?: boolean) => {
    if (!pagandoId) return
    const divida = dividas.find(d => d.id === pagandoId)
    if (!divida) return

    const restante = Number(divida.valor_total) - Number(divida.valor_pago)
    const valor = quitarTudo ? restante : parseFloat(valorPagamento.replace(',', '.'))
    if (!valor || valor <= 0) return

    await pagarDivida(pagandoId, valor)
    setPagandoId(null)
    setValorPagamento('')
  }

  const dividaPagando = dividas.find(d => d.id === pagandoId)
  const restantePagando = dividaPagando
    ? Number(dividaPagando.valor_total) - Number(dividaPagando.valor_pago)
    : 0

  return (
    <div className="flex flex-col h-full">

      {/* Card progresso geral */}
      {dividas.length > 0 && (
        <div className="px-4 pt-4 pb-0">
          <div
            className="rounded-2xl p-4 mb-3 transition-colors duration-300"
            style={{
              boxShadow: '0 1px 12px oklch(0 0 0 / 20%)',
              background: temVencidas
                ? 'oklch(0.22 0.07 15)'
                : 'var(--card)',
              border: temVencidas ? '1px solid oklch(0.55 0.22 15 / 35%)' : 'none',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${temVencidas ? 'bg-destructive/20' : 'bg-destructive/15'}`}>
                  <TrendingDown size={14} className="text-destructive" />
                </div>
                <span className="text-xs font-semibold text-foreground">
                  {temVencidas ? 'Atenção: há dívidas vencidas' : 'Progresso das dívidas'}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground">{dividasAbertas} em aberto</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-secondary rounded-xl p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground mb-0.5">Total</p>
                <p className="text-sm font-bold text-foreground">R$ {totalDivido.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</p>
              </div>
              <div className="bg-primary/10 rounded-xl p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground mb-0.5">Pago</p>
                <p className="text-sm font-bold text-primary">R$ {totalPago.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</p>
              </div>
              <div className="bg-destructive/10 rounded-xl p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground mb-0.5">Restante</p>
                <p className="text-sm font-bold text-destructive">R$ {totalRestante.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</p>
              </div>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 bg-primary"
                style={{ width: `${pctGeral}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {pctGeral.toFixed(0)}% quitado {pctGeral >= 100 ? '🎉' : ''}
            </p>
          </div>
        </div>
      )}

      {/* Alertas de vencimento */}
      {alertas.length > 0 && (
        <div className="px-4 pt-2 space-y-2">
          {alertas.map(d => {
            const vencido = d.diff < 0
            const urgente = d.diff >= 0 && d.diff <= 3
            const bgStyle = vencido
              ? 'bg-destructive/12 border-destructive/30'
              : urgente ? 'bg-orange-500/12 border-orange-500/30'
              : 'bg-secondary border-border'
            const icon = vencido
              ? <AlertCircle size={14} className="text-destructive shrink-0" />
              : urgente ? <AlertTriangle size={14} className="text-orange-400 shrink-0" />
              : <Clock size={14} className="text-muted-foreground shrink-0" />
            const msg = vencido
              ? `Venceu há ${Math.abs(d.diff)}d`
              : d.diff === 0 ? 'Vence hoje!'
              : `Vence em ${d.diff}d`
            return (
              <div key={d.id} className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 border text-sm ${bgStyle}`}>
                {icon}
                <span className="font-medium flex-1 text-sm truncate">{d.nome}</span>
                <span className="text-[11px] text-muted-foreground shrink-0">{msg}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Botões topo */}
      <div className="px-4 pt-3 pb-2 flex gap-2">
        <button
          onClick={() => { setShowForm(true); setEditandoId(null); setForm(FORM_VAZIO) }}
          className="flex-1 bg-primary text-primary-foreground rounded-2xl py-3.5 font-semibold flex items-center justify-center gap-2 text-sm active:scale-[0.98] transition-transform"
        >
          <Plus size={18} strokeWidth={2.5} /> Adicionar dívida
        </button>
        <button
          onClick={() => setShowFiltros(v => !v)}
          className="relative w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors"
          style={{ backgroundColor: showFiltros ? 'oklch(0.62 0.18 162)' : 'oklch(0.25 0.04 240)' }}
        >
          <SlidersHorizontal size={17} className={showFiltros ? 'text-white' : 'text-muted-foreground'} />
          {filtrosAtivos && !showFiltros && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-orange-400" />}
        </button>
      </div>

      {/* Filtros */}
      {showFiltros && (
        <div className="px-4 pb-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="bg-card rounded-2xl p-3 space-y-3" style={{ boxShadow: '0 1px 8px oklch(0 0 0 / 15%)' }}>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium mb-2">Tipo</p>
              <div className="flex flex-wrap gap-1.5">
                {['Todos', 'cartao', 'emprestimo', 'outros'].map(t => {
                  const label = t === 'Todos' ? 'Todos' : t === 'cartao' ? 'Cartão' : t === 'emprestimo' ? 'Empréstimo' : 'Outros'
                  return (
                    <button key={t} onClick={() => setFiltroTipo(t)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filtroTipo === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-foreground border-border'}`}>
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-medium mb-2">Status</p>
              <div className="flex gap-1.5">
                {[{ value: 'todos', label: 'Todos' }, { value: 'ativa', label: 'Em aberto' }, { value: 'quitada', label: 'Quitada' }].map(s => (
                  <button key={s.value} onClick={() => setFiltroStatus(s.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filtroStatus === s.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-foreground border-border'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            {filtrosAtivos && (
              <button onClick={() => { setFiltroTipo('Todos'); setFiltroStatus('todos') }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <X size={12} /> Limpar filtros
              </button>
            )}
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading ? (
          <div className="space-y-2.5">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>
        ) : dividasFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-4">
              <CreditCard size={24} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground/60">{filtrosAtivos ? 'Nenhuma dívida encontrada' : 'Nenhuma dívida'}</p>
            <p className="text-xs text-muted-foreground mt-1">{filtrosAtivos ? 'Tente outros filtros' : 'Adicione aqui ou pelo Chat'}</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {dividasFiltradas.map(d => {
              const restante = Number(d.valor_total) - Number(d.valor_pago)
              const pct = Math.min((Number(d.valor_pago) / Number(d.valor_total)) * 100, 100)
              const quitada = restante <= 0
              const diff = d.vencimento ? differenceInDays(parseISO(d.vencimento), hoje) : null
              const vencida = diff !== null && diff < 0 && !quitada
              const urgente = diff !== null && diff >= 0 && diff <= 3 && !quitada

              // Confirmação de apagar inline
              if (confirmandoId === d.id) {
                return (
                  <div
                    key={d.id}
                    className="rounded-2xl p-4 border border-destructive/40 animate-in fade-in duration-150"
                    style={{ background: 'oklch(0.20 0.06 15)' }}
                  >
                    <p className="text-sm font-semibold text-foreground mb-0.5">Apagar "{d.nome}"?</p>
                    <p className="text-xs text-muted-foreground mb-3">Esta ação não pode ser desfeita.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmandoId(null)}
                        className="flex-1 bg-secondary text-foreground rounded-xl py-2.5 text-xs font-medium"
                      >
                        Não
                      </button>
                      <button
                        onClick={() => { removerDivida(d.id); setConfirmandoId(null) }}
                        className="flex-1 bg-destructive text-white rounded-xl py-2.5 text-xs font-semibold"
                      >
                        Apagar
                      </button>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={d.id}
                  className="rounded-2xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-300"
                  style={{
                    boxShadow: '0 1px 10px oklch(0 0 0 / 18%)',
                    background: quitada
                      ? 'oklch(0.22 0.06 162)'
                      : vencida ? 'oklch(0.21 0.06 15)'
                      : 'var(--card)',
                    border: quitada
                      ? '1px solid oklch(0.62 0.18 162 / 30%)'
                      : vencida ? '1px solid oklch(0.55 0.22 15 / 30%)'
                      : 'none',
                  }}
                >
                  {/* Linha 1: ícone + nome + ações */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${quitada ? 'bg-primary/20' : vencida ? 'bg-destructive/20' : 'bg-secondary'}`}>
                        {quitada
                          ? <CheckCircle2 size={15} className="text-primary" />
                          : <TipoEmoji tipo={d.tipo} />
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`font-semibold text-sm leading-tight truncate ${quitada ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {d.nome}
                        </p>
                        {/* Meta-info: credor, vencimento, parcelas */}
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {d.credor && (
                            <span className="text-[11px] text-muted-foreground">{d.credor}</span>
                          )}
                          {d.vencimento && !quitada && (
                            <span className={`text-[11px] font-medium ${vencida ? 'text-destructive' : urgente ? 'text-orange-400' : 'text-muted-foreground'}`}>
                              {vencida
                                ? `Venceu ${format(parseISO(d.vencimento), 'dd/MM', { locale: ptBR })}`
                                : diff === 0 ? 'Vence hoje'
                                : `Vence ${format(parseISO(d.vencimento), 'dd/MM', { locale: ptBR })}`
                              }
                            </span>
                          )}
                          {d.parcelado && d.parcelas && (
                            <span className="text-[11px] text-muted-foreground">
                              {d.parcela_atual ?? 0}/{d.parcelas}x
                            </span>
                          )}
                          {quitada && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium">Quitada ✓</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Valor + ações */}
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      <div className="text-right mr-1">
                        <p className="text-[10px] text-muted-foreground">{quitada ? 'Quitada' : 'Restante'}</p>
                        <p className={`font-bold text-sm ${quitada ? 'text-primary' : vencida ? 'text-destructive' : 'text-destructive'}`}>
                          {quitada ? '✓' : `R$ ${fmtBRL(restante)}`}
                        </p>
                      </div>
                      <button onClick={() => abrirEditar(d)} className="text-muted-foreground hover:text-primary transition-colors p-1">
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setConfirmandoId(d.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Barra de progresso — só quando há pagamento parcial */}
                  {pct > 0 && (
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full transition-all duration-700 bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}

                  {/* Linha 2: pago / total + botão Pagar */}
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">
                      Pago: R$ {fmtBRL(Number(d.valor_pago))}
                      <span className="text-muted-foreground/50"> / R$ {fmtBRL(Number(d.valor_total))}</span>
                    </p>
                    {!quitada && (
                      <button
                        onClick={() => abrirPagamento(d)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white transition-colors active:scale-95"
                        style={{ backgroundColor: 'oklch(0.62 0.18 162)' }}
                      >
                        <CheckCircle2 size={12} /> Pagar
                      </button>
                    )}
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
              <input type="text" placeholder="Ex: Nubank fatura" value={form.nome}
                onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-primary transition-colors" />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Tipo *</label>
              <div className="flex gap-2">
                {TIPOS.map(t => (
                  <button key={t.value} onClick={() => setForm(p => ({ ...p, tipo: t.value as any }))}
                    className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-medium border transition-colors flex items-center justify-center gap-1.5 ${form.tipo === t.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-foreground border-border'}`}>
                    <span>{t.emoji}</span> {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Valor total (R$) *</label>
                <input type="number" placeholder="0,00" value={form.valor_total}
                  onChange={e => setForm(p => ({ ...p, valor_total: e.target.value }))}
                  className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-primary transition-colors" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Vencimento</label>
                <input type="date" value={form.vencimento}
                  onChange={e => setForm(p => ({ ...p, vencimento: e.target.value }))}
                  className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-primary transition-colors" />
              </div>
            </div>

            {editandoId && (
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Valor já pago (R$)</label>
                <input type="number" placeholder="0,00" value={form.valor_pago_atual}
                  onChange={e => setForm(p => ({ ...p, valor_pago_atual: e.target.value }))}
                  className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-primary transition-colors" />
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Credor (opcional)</label>
              <input type="text" placeholder="Banco, pessoa..." value={form.credor}
                onChange={e => setForm(p => ({ ...p, credor: e.target.value }))}
                className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-primary transition-colors" />
            </div>

            <div className="flex items-center gap-3">
              <input type="checkbox" id="parcelado" checked={form.parcelado}
                onChange={e => setForm(p => ({ ...p, parcelado: e.target.checked }))}
                className="w-4 h-4 accent-primary" />
              <label htmlFor="parcelado" className="text-sm flex items-center gap-1.5 font-medium">
                <Package size={14} className="text-muted-foreground" /> Parcelado
              </label>
            </div>

            {form.parcelado && (
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Número de parcelas</label>
                <input type="number" placeholder="Ex: 12" value={form.parcelas}
                  onChange={e => setForm(p => ({ ...p, parcelas: e.target.value }))}
                  className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-primary transition-colors" />
              </div>
            )}

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

      {/* Modal Pagamento — com contexto e "Quitar tudo" */}
      {pagandoId && dividaPagando && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4" onClick={() => setPagandoId(null)}>
          <div className="bg-card rounded-2xl w-full max-w-sm p-5 space-y-4"
            style={{ boxShadow: '0 8px 40px oklch(0 0 0 / 50%)' }}
            onClick={e => e.stopPropagation()}>

            {/* Contexto da dívida */}
            <div>
              <h2 className="text-base font-bold">Registrar Pagamento</h2>
              <div className="flex items-center justify-between mt-2 bg-secondary rounded-xl px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <TipoEmoji tipo={dividaPagando.tipo} />
                  <span className="text-sm font-medium text-foreground truncate max-w-[130px]">{dividaPagando.nome}</span>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">Restante</p>
                  <p className="text-sm font-bold text-destructive">R$ {fmtBRL(restantePagando)}</p>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Valor pago (R$)</label>
              <input
                ref={inputPagamentoRef}
                type="number"
                placeholder="0,00"
                value={valorPagamento}
                onChange={e => setValorPagamento(e.target.value)}
                className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-primary transition-colors"
              />
            </div>

            {/* Quitar tudo */}
            <button
              onClick={() => registrarPagamento(true)}
              className="w-full flex items-center justify-between rounded-xl px-4 py-3 border border-primary/30 bg-primary/8 text-sm font-medium text-primary active:scale-[0.98] transition-transform"
            >
              <span>Quitar tudo (R$ {fmtBRL(restantePagando)})</span>
              <ChevronRight size={16} />
            </button>

            <div className="flex gap-3">
              <button onClick={() => setPagandoId(null)}
                className="flex-1 bg-secondary text-foreground rounded-xl py-3 text-sm font-medium">Cancelar</button>
              <button
                onClick={() => registrarPagamento(false)}
                disabled={!valorPagamento}
                className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold disabled:opacity-40"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
