import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useApp } from '@/context/AppContext'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'

const CATEGORIAS = [
  { label: 'Salário', emoji: '💼' },
  { label: 'Freela / Serviço', emoji: '🔧' },
  { label: 'Aluguel', emoji: '🏠' },
  { label: 'Venda', emoji: '🛒' },
  { label: 'Investimento', emoji: '📈' },
  { label: 'Outros', emoji: '💵' },
]

interface FormReceita {
  descricao: string
  categoria: string
  valor: string
  tipo: 'recebido' | 'a_receber'
  data: string
}

export default function ReceitasPage() {
  const { receitas, adicionarReceita, removerReceita, loading } = useApp()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormReceita>({
    descricao: '', categoria: 'Salário', valor: '', tipo: 'recebido',
    data: new Date().toISOString().split('T')[0],
  })
  const [salvando, setSalvando] = useState(false)

  const salvar = async () => {
    if (!form.descricao || !form.valor) return
    setSalvando(true)
    try {
      await adicionarReceita({
        descricao: form.descricao,
        categoria: form.categoria,
        valor: parseFloat(form.valor.replace(',', '.')),
        tipo: form.tipo,
        data: form.data,
      })
      setForm({ descricao: '', categoria: 'Salário', valor: '', tipo: 'recebido', data: new Date().toISOString().split('T')[0] })
      setShowForm(false)
    } finally {
      setSalvando(false)
    }
  }

  const catEmoji = (cat: string) => CATEGORIAS.find(c => c.label === cat)?.emoji || '💵'

  return (
    <div className="flex flex-col h-full">
      <div className="p-3">
        <button
          onClick={() => setShowForm(true)}
          className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
        >
          <Plus size={18} />
          Adicionar nova receita
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : receitas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <span className="text-5xl mb-3">💰</span>
            <p className="text-sm">Nenhuma receita ainda. Adicione aqui ou pelo Chat!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {receitas.map(r => (
              <div key={r.id} className="bg-card rounded-xl px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{catEmoji(r.categoria)}</span>
                  <div>
                    <p className="font-medium text-sm">{r.descricao}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        {r.categoria} • {format(new Date(r.data + 'T12:00:00'), "d 'de' MMM", { locale: ptBR })}
                      </p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        r.tipo === 'recebido' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                      }`}>
                        {r.tipo === 'recebido' ? '✅ Recebido' : '🌐 A receber'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-primary text-sm">
                    R$ {Number(r.valor).toFixed(2).replace('.', ',')}
                  </span>
                  <button
                    onClick={() => removerReceita(r.id)}
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

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50" onClick={() => setShowForm(false)}>
          <div
            className="bg-card rounded-t-2xl w-full max-w-lg p-5 pb-8 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-bold flex items-center gap-2">
              💰 Registrar Receita
            </h2>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Descrição / Fonte *</label>
              <input
                type="text"
                placeholder="Ex: Salário empresa X, Freela..."
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
              <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setForm(p => ({ ...p, tipo: 'recebido' }))}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    form.tipo === 'recebido' ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-foreground border-border'
                  }`}
                >
                  ✅ Já recebi
                </button>
                <button
                  onClick={() => setForm(p => ({ ...p, tipo: 'a_receber' }))}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    form.tipo === 'a_receber' ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-foreground border-border'
                  }`}
                >
                  🌐 Vou receber
                </button>
              </div>
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
