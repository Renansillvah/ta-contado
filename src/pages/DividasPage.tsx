import { useState, useMemo } from 'react'
import { Plus, Trash2, Package, AlertTriangle, Clock, AlertCircle } from 'lucide-react'
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
  { value: 'cartao', label: 'Cartão', emoji: '💳' },
  { value: 'emprestimo', label: 'Empréstimo', emoji: '🏦' },
  { value: 'outros', label: 'Outros', emoji: '📌' },
]

export default function DividasPage() {
  const { dividas, adicionarDivida, removerDivida, pagarDivida, loading } = useApp()
  const [showForm, setShowForm] = useState(false)

  // Alertas de vencimento
  const hoje = new Date()
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
  const [showPagamento, setShowPagamento] = useState<string | null>(null)
  const [valorPagamento, setValorPagamento] = useState('')
  const [form, setForm] = useState<FormDivida>({
    nome: '', tipo: 'cartao', valor_total: '', credor: '', vencimento: '', parcelado: false, parcelas: '',
  })
  const [salvando, setSalvando] = useState(false)

  const salvar = async () => {
    if (!form.nome || !form.valor_total) return
    setSalvando(true)
    try {
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
      setForm({ nome: '', tipo: 'cartao', valor_total: '', credor: '', vencimento: '', parcelado: false, parcelas: '' })
      setShowForm(false)
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

  const tipoEmoji = (tipo: string) => TIPOS.find(t => t.value === tipo)?.emoji || '📌'

  return (
    <div className="flex flex-col h-full">
      {/* Alertas de vencimento */}
      {alertas.length > 0 && (
        <div className="px-3 pt-3 space-y-2">
          {alertas.map(d => {
            const vencido = d.diff < 0
            const urgente = d.diff >= 0 && d.diff <= 3
            const bg = vencido ? 'bg-destructive/15 border-destructive/40' : urgente ? 'bg-orange-500/15 border-orange-500/40' : 'bg-secondary border-border'
            const icon = vencido ? <AlertCircle size={15} className="text-destructive shrink-0" /> : urgente ? <AlertTriangle size={15} className="text-orange-500 shrink-0" /> : <Clock size={15} className="text-muted-foreground shrink-0" />
            const msg = vencido
              ? `Venceu há ${Math.abs(d.diff)} dia${Math.abs(d.diff) !== 1 ? 's' : ''}`
              : d.diff === 0
                ? 'Vence hoje!'
                : `Vence em ${d.diff} dia${d.diff !== 1 ? 's' : ''}`
            return (
              <div key={d.id} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border text-sm ${bg}`}>
                {icon}
                <span className="font-medium flex-1">{d.nome}</span>
                <span className="text-xs text-muted-foreground">{msg}</span>
              </div>
            )
          })}
        </div>
      )}

      <div className="p-3">
        <button
          onClick={() => setShowForm(true)}
          className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
        >
          <Plus size={18} />
          Adicionar nova dívida
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : dividas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <span className="text-5xl mb-3">💳</span>
            <p className="text-sm">Nenhuma dívida. Adicione aqui ou pelo Chat!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dividas.map(d => {
              const restante = Number(d.valor_total) - Number(d.valor_pago)
              const pct = Math.min((Number(d.valor_pago) / Number(d.valor_total)) * 100, 100)
              return (
                <div key={d.id} className="bg-card rounded-xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{tipoEmoji(d.tipo)}</span>
                      <div>
                        <p className="font-medium text-sm">{d.nome}</p>
                        {d.credor && <p className="text-xs text-muted-foreground">{d.credor}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Restante</p>
                        <p className="font-bold text-destructive text-sm">R$ {restante.toFixed(2).replace('.', ',')}</p>
                      </div>
                      <button
                        onClick={() => {
                          if (window.confirm('Tem certeza que quer apagar esta dívida?')) removerDivida(d.id)
                        }}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Barra de progresso */}
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Pago: R$ {Number(d.valor_pago).toFixed(2).replace('.', ',')} de R$ {Number(d.valor_total).toFixed(2).replace('.', ',')}
                    </p>
                    <button
                      onClick={() => setShowPagamento(d.id)}
                      className="text-xs text-primary font-medium"
                    >
                      + Pagar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal Nova Dívida */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50" onClick={() => setShowForm(false)}>
          <div
            className="bg-card rounded-t-2xl w-full max-w-lg p-5 pb-8 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-bold flex items-center gap-2">
              <Plus size={18} className="text-primary" /> Nova Dívida
            </h2>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nome *</label>
              <input
                type="text"
                placeholder="Ex: Nubank fatura"
                value={form.nome}
                onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tipo *</label>
              <div className="flex gap-2">
                {TIPOS.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setForm(p => ({ ...p, tipo: t.value as any }))}
                    className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                      form.tipo === t.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-secondary text-foreground border-border'
                    }`}
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Valor total (R$) *</label>
              <input
                type="number"
                placeholder="0,00"
                value={form.valor_total}
                onChange={e => setForm(p => ({ ...p, valor_total: e.target.value }))}
                className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Credor (opcional)</label>
              <input
                type="text"
                placeholder="Banco, pessoa..."
                value={form.credor}
                onChange={e => setForm(p => ({ ...p, credor: e.target.value }))}
                className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Vencimento (opcional)</label>
              <input
                type="date"
                value={form.vencimento}
                onChange={e => setForm(p => ({ ...p, vencimento: e.target.value }))}
                className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-primary"
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="parcelado"
                checked={form.parcelado}
                onChange={e => setForm(p => ({ ...p, parcelado: e.target.checked }))}
                className="w-4 h-4"
              />
              <label htmlFor="parcelado" className="text-sm flex items-center gap-1">
                <Package size={14} /> Parcelado
              </label>
            </div>

            {form.parcelado && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Número de parcelas</label>
                <input
                  type="number"
                  placeholder="Ex: 12"
                  value={form.parcelas}
                  onChange={e => setForm(p => ({ ...p, parcelas: e.target.value }))}
                  className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-primary"
                />
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 bg-secondary text-foreground rounded-xl py-3 text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pagamento */}
      {showPagamento && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowPagamento(null)}>
          <div
            className="bg-card rounded-2xl w-80 p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-bold">Registrar Pagamento</h2>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Valor pago (R$)</label>
              <input
                type="number"
                placeholder="0,00"
                value={valorPagamento}
                onChange={e => setValorPagamento(e.target.value)}
                className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-primary"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowPagamento(null)} className="flex-1 bg-secondary text-foreground rounded-xl py-2.5 text-sm">Cancelar</button>
              <button onClick={registrarPagamento} className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
