import { useState, useMemo, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

const CATEGORIAS = [
  { label: 'Alimentação', emoji: '🍔' },
  { label: 'Transporte', emoji: '🚗' },
  { label: 'Moradia', emoji: '🏠' },
  { label: 'Saúde', emoji: '❤️' },
  { label: 'Lazer', emoji: '🎮' },
  { label: 'Compras', emoji: '🛒' },
  { label: 'Outros', emoji: '📌' },
]

interface FormGasto {
  descricao: string
  valor: string
  categoria: string
  data: string
}

export default function GastosPage() {
  const { gastos, adicionarGasto, removerGasto, loading } = useApp()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormGasto>({
    descricao: '',
    valor: '',
    categoria: 'Alimentação',
    data: new Date().toISOString().split('T')[0],
  })
  const [salvando, setSalvando] = useState(false)
  const [meta, setMeta] = useState(() => {
    const v = localStorage.getItem('meta_mensal')
    return v ? parseFloat(v) : 0
  })
  const [editandoMeta, setEditandoMeta] = useState(false)
  const [metaInput, setMetaInput] = useState('')
  const alertado80Ref = useState(false)

  const MES_ATUAL = format(new Date(), 'yyyy-MM')
  const gastosMes = useMemo(() =>
    gastos.filter(g => g.data.startsWith(MES_ATUAL)).reduce((s, g) => s + Number(g.valor), 0),
  [gastos])

  const pctMeta = meta > 0 ? Math.min((gastosMes / meta) * 100, 110) : 0

  useEffect(() => {
    if (meta <= 0) return
    const pct = (gastosMes / meta) * 100
    if (pct >= 100 && !alertado80Ref[0]) {
      alertado80Ref[0] = true
      toast.error('🚨 Você passou do limite!', { description: `Meta de R$ ${meta.toFixed(2).replace('.', ',')} ultrapassada.` })
    } else if (pct >= 80 && pct < 100 && !alertado80Ref[0]) {
      alertado80Ref[0] = true
      toast.warning('⚠️ Você usou 80% do seu orçamento!', { description: `Faltam R$ ${(meta - gastosMes).toFixed(2).replace('.', ',')} para o limite.` })
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

  const corBarra = pctMeta >= 90 ? 'bg-destructive' : pctMeta >= 60 ? 'bg-yellow-500' : 'bg-primary'

  const salvar = async () => {
    if (!form.descricao || !form.valor) return
    setSalvando(true)
    try {
      await adicionarGasto({
        descricao: form.descricao,
        valor: parseFloat(form.valor.replace(',', '.')),
        categoria: form.categoria,
        data: form.data,
      })
      setForm({ descricao: '', valor: '', categoria: 'Alimentação', data: new Date().toISOString().split('T')[0] })
      setShowForm(false)
    } finally {
      setSalvando(false)
    }
  }

  const catEmoji = (cat: string) => CATEGORIAS.find(c => c.label === cat)?.emoji || '📌'

  return (
    <div className="flex flex-col h-full">
      {/* Card Meta Mensal */}
      <div className="px-3 pt-3">
        <div className="bg-card rounded-xl p-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-muted-foreground tracking-wider">META MENSAL</span>
            <button
              onClick={() => { setMetaInput(meta > 0 ? String(meta) : ''); setEditandoMeta(true) }}
              className="text-xs text-primary font-medium"
            >
              {meta > 0 ? 'Editar' : 'Definir meta'}
            </button>
          </div>

          {editandoMeta ? (
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Limite do mês (R$)"
                value={metaInput}
                onChange={e => setMetaInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && salvarMeta()}
                autoFocus
                className="flex-1 bg-secondary rounded-xl px-3 py-2 text-sm outline-none border border-border focus:border-primary"
              />
              <button onClick={salvarMeta} className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-semibold">OK</button>
            </div>
          ) : meta > 0 ? (
            <>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="font-medium">R$ {gastosMes.toFixed(2).replace('.', ',')}</span>
                <span className="text-muted-foreground">de R$ {meta.toFixed(2).replace('.', ',')}</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${corBarra}`}
                  style={{ width: `${Math.min(pctMeta, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                {pctMeta >= 100
                  ? '🚨 Você passou do limite!'
                  : pctMeta >= 80
                    ? `⚠️ ${pctMeta.toFixed(0)}% usado — faltam R$ ${(meta - gastosMes).toFixed(2).replace('.', ',')}`
                    : `${pctMeta.toFixed(0)}% usado`}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhuma meta definida para este mês.</p>
          )}
        </div>
      </div>

      <div className="px-3 pb-3">
        <button
          onClick={() => setShowForm(true)}
          className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
        >
          <Plus size={18} />
          Adicionar novo gasto
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : gastos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <span className="text-5xl mb-3">💸</span>
            <p className="text-sm">Nenhum gasto ainda. Adicione aqui ou pelo Chat!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {gastos.map(g => (
              <div key={g.id} className="bg-card rounded-xl px-4 py-3 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{catEmoji(g.categoria)}</span>
                  <div>
                    <p className="font-medium text-sm">{g.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.categoria} • {format(new Date(g.data + 'T12:00:00'), "d 'de' MMM", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-destructive text-sm">
                    R$ {Number(g.valor).toFixed(2).replace('.', ',')}
                  </span>
                  <button
                    onClick={() => {
                      if (window.confirm('Tem certeza que quer apagar este gasto?')) removerGasto(g.id)
                    }}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de formulário */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50" onClick={() => setShowForm(false)}>
          <div
            className="bg-card rounded-t-2xl w-full max-w-lg p-5 pb-8 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-bold flex items-center gap-2">
              <Plus size={18} className="text-primary" /> Novo Gasto
            </h2>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Descrição *</label>
              <input
                type="text"
                placeholder="Ex: Almoço restaurante X"
                value={form.descricao}
                onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Categoria</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIAS.map(cat => (
                  <button
                    key={cat.label}
                    onClick={() => setForm(p => ({ ...p, categoria: cat.label }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      form.categoria === cat.label
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-secondary text-foreground border-border'
                    }`}
                  >
                    {cat.emoji} {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Valor (R$) *</label>
              <input
                type="number"
                placeholder="0,00"
                value={form.valor}
                onChange={e => setForm(p => ({ ...p, valor: e.target.value }))}
                className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-primary"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Data</label>
              <input
                type="date"
                value={form.data}
                onChange={e => setForm(p => ({ ...p, data: e.target.value }))}
                className="w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none border border-border focus:border-primary"
              />
            </div>

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
    </div>
  )
}
