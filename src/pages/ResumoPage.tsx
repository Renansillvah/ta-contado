import { useMemo, useState } from 'react'
import { useApp } from '@/context/AppContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { format, subMonths, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'
import { Copy, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

function formatBRL(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`
}

// Gera array com os últimos 6 meses no formato 'yyyy-MM'
function ultimos6Meses(): string[] {
  const meses: string[] = []
  for (let i = 5; i >= 0; i--) {
    meses.push(format(subMonths(startOfMonth(new Date()), i), 'yyyy-MM'))
  }
  return meses
}

export default function ResumoPage() {
  const { gastos, receitas, dividas, totalGastos, totalReceitas, totalDividas, loading } = useApp()
  const [relatorio, setRelatorio] = useState<string | null>(null)
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false)
  // Calculado dentro do componente para refletir o mês correto sempre
  const MES_ATUAL = format(new Date(), 'yyyy-MM')
  const MES_LABEL = format(new Date(), 'MMM. yy', { locale: ptBR }).toUpperCase()

  const receitasMes = useMemo(() =>
    receitas.filter(r => r.data.startsWith(MES_ATUAL) && r.tipo === 'recebido')
      .reduce((s, r) => s + Number(r.valor), 0), [receitas])

  const gastosMes = useMemo(() =>
    gastos.filter(g => g.data.startsWith(MES_ATUAL))
      .reduce((s, g) => s + Number(g.valor), 0), [gastos])

  const aReceberMes = useMemo(() =>
    receitas.filter(r => r.data.startsWith(MES_ATUAL) && r.tipo === 'a_receber')
      .reduce((s, r) => s + Number(r.valor), 0), [receitas])

  const saldoPrevisto = receitasMes + aReceberMes - gastosMes
  const pagamentosDivida = useMemo(() =>
    dividas.reduce((s, d) => s + Number(d.valor_pago), 0), [dividas])

  const MES_KEY = format(new Date(), 'yyyy-MM')

  const gerarRelatorio = () => {
    setGerandoRelatorio(true)
    setTimeout(() => {
      const mesNome = format(new Date(), 'MMMM yyyy', { locale: ptBR })
      const mesAnteriorKey = format(subMonths(new Date(), 1), 'yyyy-MM')

      // Por categoria
      const porCategoria: Record<string, number> = {}
      gastos.filter(g => g.data.startsWith(MES_ATUAL)).forEach(g => {
        porCategoria[g.categoria] = (porCategoria[g.categoria] || 0) + Number(g.valor)
      })

      const gastosMesAtual = Object.values(porCategoria).reduce((s, v) => s + v, 0)
      const receitasMesAtual = receitas.filter(r => r.data.startsWith(MES_ATUAL) && r.tipo === 'recebido').reduce((s, r) => s + Number(r.valor), 0)
      const gastosMesAnterior = gastos.filter(g => g.data.startsWith(mesAnteriorKey)).reduce((s, g) => s + Number(g.valor), 0)
      const dividasPagas = dividas.filter(d => Number(d.valor_pago) > 0).reduce((s, d) => s + Number(d.valor_pago), 0)
      const saldo = receitasMesAtual - gastosMesAtual
      const varGastos = gastosMesAnterior > 0 ? ((gastosMesAtual - gastosMesAnterior) / gastosMesAnterior) * 100 : 0

      const catLinhas = Object.entries(porCategoria)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, val]) => `  • ${cat}: R$ ${val.toFixed(2).replace('.', ',')}`)
        .join('\n')

      const conselho = saldo < 0
        ? 'Atenção: seus gastos superaram as receitas este mês. Tente reduzir gastos com lazer e compras nos próximos meses.'
        : saldo < receitasMesAtual * 0.2
          ? 'Você está gastando muito perto do limite. Procure guardar pelo menos 20% da renda.'
          : 'Ótimo trabalho! Você manteve um saldo positivo. Considere investir parte do que sobrou.'

      const texto = `📊 RELATÓRIO DE ${mesNome.toUpperCase()}
${'─'.repeat(36)}

💸 GASTOS POR CATEGORIA:
${catLinhas || '  (sem gastos registrados)'}

Total gasto: R$ ${gastosMesAtual.toFixed(2).replace('.', ',')}
${gastosMesAnterior > 0 ? `Comparado ao mês anterior: ${varGastos > 0 ? '+' : ''}${varGastos.toFixed(1)}%` : ''}

💰 RECEITAS RECEBIDAS: R$ ${receitasMesAtual.toFixed(2).replace('.', ',')}

💳 DÍVIDAS PAGAS NO MÊS: R$ ${dividasPagas.toFixed(2).replace('.', ',')}
Dívida total restante: R$ ${totalDividas.toFixed(2).replace('.', ',')}

📌 SALDO FINAL: R$ ${saldo.toFixed(2).replace('.', ',')} ${saldo >= 0 ? '😊' : '😟'}

💡 CONSELHO:
${conselho}

—— Gerado pelo Tá Contato ——`

      setRelatorio(texto)
      setGerandoRelatorio(false)
    }, 800)
  }

  // Dados por mês para gráficos — sempre 6 meses, meses sem dados mostram valor mínimo
  const dadosDividaMes = useMemo(() => {
    const porMes: Record<string, number> = {}
    dividas.forEach(d => {
      const m = (d.created_at || '').substring(0, 7)
      if (m) porMes[m] = (porMes[m] || 0) + (Number(d.valor_total) - Number(d.valor_pago))
    })
    return ultimos6Meses().map(mes => ({
      mesKey: mes,
      mes: format(new Date(mes + '-15'), 'MMM', { locale: ptBR }),
      valor: porMes[mes] ?? 0,
      semDados: !porMes[mes],
    }))
  }, [dividas])

  const dadosGastosMes = useMemo(() => {
    const porMes: Record<string, number> = {}
    gastos.forEach(g => {
      const m = g.data.substring(0, 7)
      if (m) porMes[m] = (porMes[m] || 0) + Number(g.valor)
    })
    return ultimos6Meses().map(mes => ({
      mesKey: mes,
      mes: format(new Date(mes + '-15'), 'MMM', { locale: ptBR }),
      valor: porMes[mes] ?? 0,
      semDados: !porMes[mes],
    }))
  }, [gastos])

  return (
    <div className="overflow-y-auto h-full p-3 space-y-3">
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : (
        <>
          {/* Card Previsão */}
          <div className="bg-card rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span>🌐</span>
              <span className="text-xs font-bold text-muted-foreground tracking-wider">
                PREVISÃO — {MES_LABEL}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <span className="text-xl">💰</span>
                <p className="text-xs text-muted-foreground mt-1">Receitas previstas</p>
                <p className="font-bold text-primary text-sm">{formatBRL(receitasMes + aReceberMes)}</p>
              </div>
              <div className="text-center">
                <span className="text-xl">💸</span>
                <p className="text-xs text-muted-foreground mt-1">Gastos estimados</p>
                <p className="font-bold text-destructive text-sm">{formatBRL(gastosMes)}</p>
              </div>
              <div className="text-center">
                <span className="text-xl">💳</span>
                <p className="text-xs text-muted-foreground mt-1">Dívida restante</p>
                <p className="font-bold text-destructive text-sm">{formatBRL(totalDividas)}</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-xs text-muted-foreground">Saldo previsto (receitas - gastos)</p>
                <p className={`text-xl font-bold ${saldoPrevisto >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {formatBRL(saldoPrevisto)}
                </p>
              </div>
              <span className="text-3xl">{saldoPrevisto >= 0 ? '😊' : '😟'}</span>
            </div>

            <div className="bg-secondary rounded-xl px-3 py-2">
              <p className="text-xs text-muted-foreground">
                💡 Diga no Chat: "Vou receber X reais em {format(new Date(), 'MMM. yy', { locale: ptBR })}"
              </p>
            </div>
          </div>

          {/* Cards resumo */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-card rounded-xl p-2.5 text-center">
              <span className="text-lg">💸</span>
              <p className="text-xs text-muted-foreground mt-0.5">Gastos</p>
              <p className="font-bold text-destructive text-xs">{formatBRL(totalGastos)}</p>
            </div>
            <div className="bg-card rounded-xl p-2.5 text-center">
              <span className="text-lg">💳</span>
              <p className="text-xs text-muted-foreground mt-0.5">Pgtos dívida</p>
              <p className="font-bold text-primary text-xs">{formatBRL(pagamentosDivida)}</p>
            </div>
            <div className="bg-card rounded-xl p-2.5 text-center">
              <span className="text-lg">💰</span>
              <p className="text-xs text-muted-foreground mt-0.5">Receitas</p>
              <p className="font-bold text-primary text-xs">{formatBRL(totalReceitas)}</p>
            </div>
            <div className="bg-card rounded-xl p-2.5 text-center">
              <span className="text-lg">❗</span>
              <p className="text-xs text-muted-foreground mt-0.5">Dívida rest.</p>
              <p className="font-bold text-destructive text-xs">{formatBRL(totalDividas)}</p>
            </div>
          </div>

          {/* Relatório Mensal */}
          <div className="bg-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span>📋</span>
                <span className="text-xs font-bold text-muted-foreground tracking-wider">RELATÓRIO DO MÊS</span>
              </div>
              <button
                onClick={gerarRelatorio}
                disabled={gerandoRelatorio}
                className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground rounded-xl px-3 py-1.5 font-semibold disabled:opacity-50"
              >
                {gerandoRelatorio ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                {gerandoRelatorio ? 'Gerando...' : 'Gerar Relatório'}
              </button>
            </div>
            {relatorio ? (
              <>
                <pre className="text-xs text-foreground whitespace-pre-wrap font-mono bg-secondary rounded-xl p-3 leading-relaxed max-h-64 overflow-y-auto">
                  {relatorio}
                </pre>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(relatorio)
                    toast.success('Copiado!', { description: 'Relatório copiado para a área de transferência.' })
                  }}
                  className="mt-2 w-full flex items-center justify-center gap-2 text-xs text-primary border border-primary/30 rounded-xl py-2 font-medium"
                >
                  <Copy size={13} /> Copiar
                </button>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Toque em "Gerar Relatório" para ver um resumo completo do mês.</p>
            )}
          </div>

          {/* Gráfico Dívida por Mês */}
          <div className="bg-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span>💳</span>
              <span className="text-xs font-bold text-muted-foreground tracking-wider">DÍVIDA RESTANTE POR MÊS</span>
            </div>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={dadosDividaMes} barSize={28}>
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} interval={0} />
                <YAxis hide domain={[0, 'auto']} />
                <Tooltip
                  formatter={(v: number, _: string, props: any) =>
                    props.payload?.semDados ? ['Sem dados', ''] : [`R$ ${v.toFixed(2).replace('.', ',')}`, 'Dívida']
                  }
                  contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey={(d) => d.semDados ? 0.5 : d.valor} radius={[4, 4, 0, 0]}>
                  {dadosDividaMes.map((entry) => (
                    <Cell
                      key={entry.mesKey}
                      fill={entry.semDados ? '#555' : entry.mesKey === MES_KEY ? 'oklch(0.65 0.22 25)' : 'oklch(0.55 0.18 25)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico Gastos por Mês */}
          <div className="bg-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span>💸</span>
              <span className="text-xs font-bold text-muted-foreground tracking-wider">GASTOS POR MÊS</span>
            </div>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={dadosGastosMes} barSize={28}>
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} interval={0} />
                <YAxis hide domain={[0, 'auto']} />
                <Tooltip
                  formatter={(v: number, _: string, props: any) =>
                    props.payload?.semDados ? ['Sem dados', ''] : [`R$ ${v.toFixed(2).replace('.', ',')}`, 'Gastos']
                  }
                  contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey={(d) => d.semDados ? 0.5 : d.valor} radius={[4, 4, 0, 0]}>
                  {dadosGastosMes.map((entry) => (
                    <Cell
                      key={entry.mesKey}
                      fill={entry.semDados ? '#555' : entry.mesKey === MES_KEY ? 'oklch(0.65 0.19 155)' : 'oklch(0.50 0.15 155)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
