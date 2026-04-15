import { useMemo, useState } from 'react'
import { useApp } from '@/context/AppContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { format, subMonths, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'
import { Copy, FileText, Loader2, TrendingUp, TrendingDown, CreditCard, ArrowUpCircle } from 'lucide-react'
import { toast } from 'sonner'

function formatBRL(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`
}

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

  const MES_ATUAL = format(new Date(), 'yyyy-MM')
  const MES_LABEL = format(new Date(), 'MMMM yyyy', { locale: ptBR })

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

      const texto = `RELATORIO DE ${mesNome.toUpperCase()}
${'─'.repeat(36)}

GASTOS POR CATEGORIA:
${catLinhas || '  (sem gastos registrados)'}

Total gasto: R$ ${gastosMesAtual.toFixed(2).replace('.', ',')}
${gastosMesAnterior > 0 ? `Comparado ao mes anterior: ${varGastos > 0 ? '+' : ''}${varGastos.toFixed(1)}%` : ''}

RECEITAS RECEBIDAS: R$ ${receitasMesAtual.toFixed(2).replace('.', ',')}

DIVIDAS PAGAS NO MES: R$ ${dividasPagas.toFixed(2).replace('.', ',')}
Divida total restante: R$ ${totalDividas.toFixed(2).replace('.', ',')}

SALDO FINAL: R$ ${saldo.toFixed(2).replace('.', ',')} ${saldo >= 0 ? ':)' : ':(' }

CONSELHO:
${conselho}

-- Gerado pelo Ta Contato --`

      setRelatorio(texto)
      setGerandoRelatorio(false)
    }, 800)
  }

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
    <div className="overflow-y-auto h-full p-4 space-y-3">
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          {/* Card Saldo Principal */}
          <div
            className="rounded-2xl p-5"
            style={{ backgroundColor: 'oklch(0.48 0.16 162)', boxShadow: '0 4px 24px oklch(0.48 0.16 162 / 35%)' }}
          >
            <p className="text-[11px] text-white/60 uppercase tracking-widest mb-1 font-medium">
              {MES_LABEL} · Saldo previsto
            </p>
            <p className={`text-3xl font-bold text-white leading-tight mb-4 font-display`}>
              {formatBRL(saldoPrevisto)}
            </p>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white/12 rounded-xl p-2.5">
                <div className="flex items-center gap-1 mb-1">
                  <TrendingUp size={11} className="text-white/70" />
                  <p className="text-[10px] text-white/60">Receitas</p>
                </div>
                <p className="font-bold text-white text-xs">{formatBRL(receitasMes + aReceberMes)}</p>
              </div>
              <div className="bg-white/12 rounded-xl p-2.5">
                <div className="flex items-center gap-1 mb-1">
                  <TrendingDown size={11} className="text-white/70" />
                  <p className="text-[10px] text-white/60">Gastos</p>
                </div>
                <p className="font-bold text-red-300 text-xs">{formatBRL(gastosMes)}</p>
              </div>
              <div className="bg-white/12 rounded-xl p-2.5">
                <div className="flex items-center gap-1 mb-1">
                  <CreditCard size={11} className="text-white/70" />
                  <p className="text-[10px] text-white/60">Dívida</p>
                </div>
                <p className="font-bold text-orange-300 text-xs">{formatBRL(totalDividas)}</p>
              </div>
            </div>
          </div>

          {/* Cards resumo totais */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-card rounded-2xl p-4" style={{ boxShadow: '0 1px 8px oklch(0 0 0 / 18%)' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-destructive/15 flex items-center justify-center">
                  <TrendingDown size={13} className="text-destructive" />
                </div>
                <p className="text-[11px] text-muted-foreground font-medium">Total Gastos</p>
              </div>
              <p className="font-bold text-destructive text-lg leading-tight">{formatBRL(totalGastos)}</p>
            </div>
            <div className="bg-card rounded-2xl p-4" style={{ boxShadow: '0 1px 8px oklch(0 0 0 / 18%)' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                  <TrendingUp size={13} className="text-primary" />
                </div>
                <p className="text-[11px] text-muted-foreground font-medium">Total Receitas</p>
              </div>
              <p className="font-bold text-primary text-lg leading-tight">{formatBRL(totalReceitas)}</p>
            </div>
            <div className="bg-card rounded-2xl p-4" style={{ boxShadow: '0 1px 8px oklch(0 0 0 / 18%)' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                  <ArrowUpCircle size={13} className="text-primary" />
                </div>
                <p className="text-[11px] text-muted-foreground font-medium">Pgtos Dívida</p>
              </div>
              <p className="font-bold text-primary text-lg leading-tight">{formatBRL(pagamentosDivida)}</p>
            </div>
            <div className="bg-card rounded-2xl p-4" style={{ boxShadow: '0 1px 8px oklch(0 0 0 / 18%)' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-destructive/15 flex items-center justify-center">
                  <CreditCard size={13} className="text-destructive" />
                </div>
                <p className="text-[11px] text-muted-foreground font-medium">Dívida Rest.</p>
              </div>
              <p className="font-bold text-destructive text-lg leading-tight">{formatBRL(totalDividas)}</p>
            </div>
          </div>

          {/* Relatório Mensal */}
          <div className="bg-card rounded-2xl p-4" style={{ boxShadow: '0 1px 8px oklch(0 0 0 / 18%)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
                  <FileText size={13} className="text-muted-foreground" />
                </div>
                <span className="text-xs font-semibold text-foreground">Relatório do Mês</span>
              </div>
              <button
                onClick={gerarRelatorio}
                disabled={gerandoRelatorio}
                className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground rounded-xl px-3.5 py-1.5 font-semibold disabled:opacity-50 active:scale-[0.97] transition-transform"
              >
                {gerandoRelatorio ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                {gerandoRelatorio ? 'Gerando...' : 'Gerar'}
              </button>
            </div>
            {relatorio ? (
              <>
                <pre className="text-xs text-foreground whitespace-pre-wrap font-mono bg-secondary rounded-xl p-3.5 leading-relaxed max-h-64 overflow-y-auto">
                  {relatorio}
                </pre>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(relatorio)
                    toast.success('Copiado!', { description: 'Relatório copiado para a área de transferência.' })
                  }}
                  className="mt-2 w-full flex items-center justify-center gap-2 text-xs text-primary border border-primary/25 rounded-xl py-2.5 font-medium active:scale-[0.98] transition-transform"
                >
                  <Copy size={12} /> Copiar relatório
                </button>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Toque em "Gerar" para ver um resumo completo do mês com análise financeira.</p>
            )}
          </div>

          {/* Gráfico Gastos por Mês */}
          <div className="bg-card rounded-2xl p-4" style={{ boxShadow: '0 1px 8px oklch(0 0 0 / 18%)' }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-destructive/15 flex items-center justify-center">
                <TrendingDown size={13} className="text-destructive" />
              </div>
              <span className="text-xs font-semibold text-foreground">Gastos por Mês</span>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={dadosGastosMes} barSize={28} barGap={4}>
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'oklch(0.55 0.005 240)' }} axisLine={false} tickLine={false} interval={0} />
                <YAxis hide domain={[0, 'auto']} />
                <Tooltip
                  formatter={(v: number, _: string, props: any) =>
                    props.payload?.semDados ? ['Sem dados', ''] : [`R$ ${v.toFixed(2).replace('.', ',')}`, 'Gastos']
                  }
                  contentStyle={{ background: 'oklch(0.16 0.012 250)', border: '1px solid oklch(1 0 0 / 8%)', borderRadius: 10, fontSize: 12 }}
                  cursor={{ fill: 'oklch(1 0 0 / 4%)' }}
                />
                <Bar dataKey={(d) => d.semDados ? 0.5 : d.valor} radius={[5, 5, 0, 0]}>
                  {dadosGastosMes.map((entry) => (
                    <Cell
                      key={entry.mesKey}
                      fill={entry.semDados ? 'oklch(0.28 0.008 250)' : entry.mesKey === MES_KEY ? 'oklch(0.60 0.20 20)' : 'oklch(0.45 0.16 20)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico Dívida por Mês */}
          <div className="bg-card rounded-2xl p-4" style={{ boxShadow: '0 1px 8px oklch(0 0 0 / 18%)' }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                <CreditCard size={13} className="text-primary" />
              </div>
              <span className="text-xs font-semibold text-foreground">Dívida por Mês</span>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={dadosDividaMes} barSize={28} barGap={4}>
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'oklch(0.55 0.005 240)' }} axisLine={false} tickLine={false} interval={0} />
                <YAxis hide domain={[0, 'auto']} />
                <Tooltip
                  formatter={(v: number, _: string, props: any) =>
                    props.payload?.semDados ? ['Sem dados', ''] : [`R$ ${v.toFixed(2).replace('.', ',')}`, 'Dívida']
                  }
                  contentStyle={{ background: 'oklch(0.16 0.012 250)', border: '1px solid oklch(1 0 0 / 8%)', borderRadius: 10, fontSize: 12 }}
                  cursor={{ fill: 'oklch(1 0 0 / 4%)' }}
                />
                <Bar dataKey={(d) => d.semDados ? 0.5 : d.valor} radius={[5, 5, 0, 0]}>
                  {dadosDividaMes.map((entry) => (
                    <Cell
                      key={entry.mesKey}
                      fill={entry.semDados ? 'oklch(0.28 0.008 250)' : entry.mesKey === MES_KEY ? 'oklch(0.62 0.18 162)' : 'oklch(0.46 0.14 162)'}
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
