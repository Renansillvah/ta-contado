import { useMemo } from 'react'
import { useApp } from '@/context/AppContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { format, subMonths, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown, CreditCard, AlertTriangle, CheckCircle2, AlertCircle, Wallet, ArrowDownCircle } from 'lucide-react'

function formatBRL(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`
}

function formatBRLShort(v: number) {
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1).replace('.', ',')}k`
  return `R$ ${v.toFixed(0)}`
}

function ultimos6Meses(): string[] {
  const meses: string[] = []
  for (let i = 5; i >= 0; i--) {
    meses.push(format(subMonths(startOfMonth(new Date()), i), 'yyyy-MM'))
  }
  return meses
}

function calcularSaude(saldo: number, ganhos: number, totalDividas: number, gastosMes: number): {
  nivel: 'otima' | 'boa' | 'atencao' | 'critica'
  label: string
  cor: string
  corBg: string
  pct: number
  frase: string
} {
  if (ganhos === 0) return {
    nivel: 'atencao', label: 'Sem dados', cor: '#f97316', corBg: '#f9731615',
    pct: 0, frase: 'Registre seus ganhos para ver sua saúde financeira.'
  }

  const pctGasto = (gastosMes / ganhos) * 100
  const pctDivida = ganhos > 0 ? (totalDividas / ganhos) * 100 : 0

  let score = 100
  if (saldo < 0) score -= 40
  else if (pctGasto > 90) score -= 25
  else if (pctGasto > 70) score -= 10

  if (pctDivida > 200) score -= 30
  else if (pctDivida > 100) score -= 15
  else if (pctDivida > 50) score -= 5

  if (score >= 80) return {
    nivel: 'otima', label: 'Ótima', cor: '#22c55e', corBg: '#22c55e18',
    pct: score, frase: 'Suas finanças estão sob controle. Continue assim!'
  }
  if (score >= 55) return {
    nivel: 'boa', label: 'Boa', cor: 'oklch(0.62 0.18 162)', corBg: 'oklch(0.62 0.18 162 / 15%)',
    pct: score, frase: 'Você está bem, mas há espaço para melhorar.'
  }
  if (score >= 30) return {
    nivel: 'atencao', label: 'Atenção', cor: '#f97316', corBg: '#f9731618',
    pct: score, frase: 'Seus gastos estão altos em relação à renda.'
  }
  return {
    nivel: 'critica', label: 'Crítica', cor: '#ef4444', corBg: '#ef444418',
    pct: Math.max(score, 5), frase: 'Gastos superaram a renda. Reduza despesas urgente.'
  }
}

export default function ResumoPage() {
  const { gastos, receitas, totalDividas, loading } = useApp()

  const MES_ATUAL = format(new Date(), 'yyyy-MM')
  const MES_LABEL = format(new Date(), "MMMM 'de' yyyy", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())
  const MES_KEY = MES_ATUAL

  // ── Ganhos do mês ────────────────────────────────────────────────────────────
  const ganhosMes = useMemo(() =>
    receitas.filter(r => r.data.startsWith(MES_ATUAL) && r.tipo === 'recebido' && r.categoria !== 'Recebimento')
      .reduce((s, r) => s + Number(r.valor), 0), [receitas, MES_ATUAL])

  const aReceberMes = useMemo(() =>
    receitas.filter(r => r.data.startsWith(MES_ATUAL) && r.tipo === 'a_receber' && r.categoria !== 'Recebimento')
      .reduce((s, r) => s + Number(r.valor), 0), [receitas, MES_ATUAL])

  const gastosMes = useMemo(() =>
    gastos.filter(g => g.data.startsWith(MES_ATUAL))
      .reduce((s, g) => s + Number(g.valor), 0), [gastos, MES_ATUAL])

  const saldoReal = ganhosMes - gastosMes
  const pctGasto = ganhosMes > 0 ? Math.min((gastosMes / ganhosMes) * 100, 100) : 0

  // ── Saúde financeira ─────────────────────────────────────────────────────────
  const saude = useMemo(() =>
    calcularSaude(saldoReal, ganhosMes, totalDividas, gastosMes),
  [saldoReal, ganhosMes, totalDividas, gastosMes])

  // ── Maior categoria de gasto ─────────────────────────────────────────────────
  const maiorCategoria = useMemo(() => {
    const por: Record<string, number> = {}
    gastos.filter(g => g.data.startsWith(MES_ATUAL)).forEach(g => {
      por[g.categoria] = (por[g.categoria] || 0) + Number(g.valor)
    })
    const entries = Object.entries(por).sort((a, b) => b[1] - a[1])
    if (!entries.length) return null
    return { nome: entries[0][0], valor: entries[0][1], pct: ganhosMes > 0 ? (entries[0][1] / ganhosMes) * 100 : 0 }
  }, [gastos, ganhosMes, MES_ATUAL])

  // ── Insight de comparação com mês anterior ───────────────────────────────────
  const mesAnteriorKey = format(subMonths(new Date(), 1), 'yyyy-MM')
  const gastosMesAnterior = useMemo(() =>
    gastos.filter(g => g.data.startsWith(mesAnteriorKey)).reduce((s, g) => s + Number(g.valor), 0),
  [gastos, mesAnteriorKey])

  const variacaoGastos = gastosMesAnterior > 0
    ? ((gastosMes - gastosMesAnterior) / gastosMesAnterior) * 100
    : null

  // ── Dados dos gráficos ───────────────────────────────────────────────────────
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

  const mediaGastos = useMemo(() => {
    const comDados = dadosGastosMes.filter(d => !d.semDados && d.mesKey !== MES_ATUAL)
    if (!comDados.length) return 0
    return comDados.reduce((s, d) => s + d.valor, 0) / comDados.length
  }, [dadosGastosMes, MES_ATUAL])

  const dadosGanhosVsGastos = useMemo(() => {
    const porMesGanhos: Record<string, number> = {}
    const porMesGastos: Record<string, number> = {}
    receitas.filter(r => r.tipo === 'recebido' && r.categoria !== 'Recebimento').forEach(r => {
      const m = r.data.substring(0, 7)
      if (m) porMesGanhos[m] = (porMesGanhos[m] || 0) + Number(r.valor)
    })
    gastos.forEach(g => {
      const m = g.data.substring(0, 7)
      if (m) porMesGastos[m] = (porMesGastos[m] || 0) + Number(g.valor)
    })
    return ultimos6Meses().map(mes => ({
      mesKey: mes,
      mes: format(new Date(mes + '-15'), 'MMM', { locale: ptBR }),
      ganhos: porMesGanhos[mes] ?? 0,
      gastos: porMesGastos[mes] ?? 0,
    }))
  }, [receitas, gastos])

  const melhorMes = useMemo(() => {
    const mesesComDados = dadosGastosMes.filter(d => !d.semDados)
    if (!mesesComDados.length) return null
    const max = mesesComDados.reduce((a, b) => a.valor > b.valor ? a : b)
    return max.mesKey === MES_ATUAL ? null : max
  }, [dadosGastosMes, MES_ATUAL])

  return (
    <div className="overflow-y-auto h-full p-4 space-y-3">
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-52 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          {/* ── Card principal: saldo + saúde ── */}
          <div
            className="rounded-2xl p-5"
            style={{ backgroundColor: 'oklch(0.48 0.16 162)', boxShadow: '0 4px 24px oklch(0.48 0.16 162 / 35%)' }}
          >
            <p className="text-[11px] text-white/60 uppercase tracking-widest mb-1 font-medium">{MES_LABEL}</p>

            {/* Saldo com frase de contexto */}
            <div className="flex items-end justify-between mb-1">
              <div>
                <p className="text-3xl font-bold text-white leading-tight">{formatBRL(saldoReal)}</p>
                <p className="text-[11px] text-white/60 mt-0.5">
                  {saldoReal >= 0 ? 'sobrando este mês' : 'no vermelho este mês'}
                  {aReceberMes > 0 && ` · +${formatBRL(aReceberMes)} a receber`}
                </p>
              </div>
              {/* Badge saúde */}
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-xs"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white' }}
              >
                {saude.nivel === 'otima' && <CheckCircle2 size={13} />}
                {saude.nivel === 'boa' && <CheckCircle2 size={13} />}
                {saude.nivel === 'atencao' && <AlertTriangle size={13} />}
                {saude.nivel === 'critica' && <AlertCircle size={13} />}
                {saude.label}
              </div>
            </div>

            {/* Barra de comprometimento da renda */}
            {ganhosMes > 0 && (
              <div className="mb-4">
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${pctGasto}%`,
                      backgroundColor: pctGasto >= 90 ? '#ef4444' : pctGasto >= 70 ? '#f97316' : 'rgba(255,255,255,0.7)'
                    }}
                  />
                </div>
                <p className="text-[10px] text-white/50 mt-1">{pctGasto.toFixed(0)}% da renda comprometida com gastos</p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white/12 rounded-xl p-2.5">
                <div className="flex items-center gap-1 mb-1">
                  <TrendingUp size={11} className="text-white/70" />
                  <p className="text-[10px] text-white/60">Ganhos</p>
                </div>
                <p className="font-bold text-white text-xs">{formatBRL(ganhosMes)}</p>
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
                  <p className="text-[10px] text-white/60">Dívidas</p>
                </div>
                <p className="font-bold text-orange-300 text-xs">{formatBRL(totalDividas)}</p>
              </div>
            </div>
          </div>

          {/* ── Insights do mês ── */}
          <div className="grid grid-cols-2 gap-2.5">

            {/* Saúde financeira detalhada */}
            <div className="bg-card rounded-2xl p-4 col-span-2" style={{ boxShadow: '0 1px 8px oklch(0 0 0 / 18%)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: saude.corBg }}>
                  {saude.nivel === 'otima' || saude.nivel === 'boa'
                    ? <CheckCircle2 size={13} style={{ color: saude.cor }} />
                    : <AlertTriangle size={13} style={{ color: saude.cor }} />
                  }
                </div>
                <span className="text-xs font-semibold text-foreground">Saúde financeira</span>
                <span className="ml-auto text-xs font-bold" style={{ color: saude.cor }}>{saude.label}</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden mb-2">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${saude.pct}%`, backgroundColor: saude.cor }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{saude.frase}</p>
            </div>

            {/* Maior gasto do mês */}
            <div className="bg-card rounded-2xl p-4" style={{ boxShadow: '0 1px 8px oklch(0 0 0 / 18%)' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-destructive/15 flex items-center justify-center">
                  <ArrowDownCircle size={13} className="text-destructive" />
                </div>
                <p className="text-[11px] text-muted-foreground font-medium">Maior gasto</p>
              </div>
              {maiorCategoria ? (
                <>
                  <p className="font-bold text-foreground text-sm leading-tight">{maiorCategoria.nome}</p>
                  <p className="text-destructive font-bold text-base mt-0.5">{formatBRL(maiorCategoria.valor)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{maiorCategoria.pct.toFixed(0)}% da renda</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">Sem gastos este mês</p>
              )}
            </div>

            {/* Quanto sobrou / falta */}
            <div className="bg-card rounded-2xl p-4" style={{ boxShadow: '0 1px 8px oklch(0 0 0 / 18%)' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: saldoReal >= 0 ? 'oklch(0.62 0.18 162 / 15%)' : '#ef444418' }}>
                  <Wallet size={13} style={{ color: saldoReal >= 0 ? 'oklch(0.62 0.18 162)' : '#ef4444' }} />
                </div>
                <p className="text-[11px] text-muted-foreground font-medium">
                  {saldoReal >= 0 ? 'Para guardar' : 'No negativo'}
                </p>
              </div>
              <p className="font-bold text-base leading-tight"
                style={{ color: saldoReal >= 0 ? 'oklch(0.62 0.18 162)' : '#ef4444' }}>
                {formatBRL(Math.abs(saldoReal))}
              </p>
              {saldoReal >= 0 && ganhosMes > 0 && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {((saldoReal / ganhosMes) * 100).toFixed(0)}% da renda livre
                </p>
              )}
              {saldoReal < 0 && (
                <p className="text-[10px] text-muted-foreground mt-0.5">Reduza gastos</p>
              )}
            </div>

            {/* Comparação com mês anterior */}
            {variacaoGastos !== null && (
              <div className="bg-card rounded-2xl p-4 col-span-2" style={{ boxShadow: '0 1px 8px oklch(0 0 0 / 18%)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${variacaoGastos <= 0 ? 'bg-primary/15' : 'bg-destructive/15'}`}>
                      {variacaoGastos <= 0
                        ? <TrendingDown size={13} className="text-primary" />
                        : <TrendingUp size={13} className="text-destructive" />
                      }
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground font-medium">Vs. mês anterior</p>
                      <p className="text-xs font-medium text-foreground mt-0.5">
                        {variacaoGastos <= 0
                          ? `Você gastou ${Math.abs(variacaoGastos).toFixed(0)}% a menos que no mês passado`
                          : `Você gastou ${variacaoGastos.toFixed(0)}% a mais que no mês passado`
                        }
                      </p>
                    </div>
                  </div>
                  <span
                    className="text-sm font-bold shrink-0"
                    style={{ color: variacaoGastos <= 0 ? 'oklch(0.62 0.18 162)' : '#ef4444' }}
                  >
                    {variacaoGastos > 0 ? '+' : ''}{variacaoGastos.toFixed(0)}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── Gráfico Ganhos vs Gastos ── */}
          <div className="bg-card rounded-2xl p-4" style={{ boxShadow: '0 1px 8px oklch(0 0 0 / 18%)' }}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                  <TrendingUp size={13} className="text-primary" />
                </div>
                <span className="text-xs font-semibold text-foreground">Ganhos vs Gastos</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: 'oklch(0.62 0.18 162)' }} />Ganhos</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block bg-red-500" />Gastos</span>
              </div>
            </div>
            {melhorMes && (
              <p className="text-[11px] text-muted-foreground mb-3">
                Mês mais caro: <span className="text-foreground font-medium">{format(new Date(melhorMes.mesKey + '-15'), 'MMMM', { locale: ptBR })}</span> ({formatBRLShort(melhorMes.valor)})
              </p>
            )}
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={dadosGanhosVsGastos} barSize={14} barGap={2} barCategoryGap={8}>
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'oklch(0.55 0.005 240)' }} axisLine={false} tickLine={false} interval={0} />
                <YAxis hide domain={[0, 'auto']} />
                <Tooltip
                  formatter={(v: number, name: string) => [formatBRL(v), name === 'ganhos' ? 'Ganhos' : 'Gastos']}
                  contentStyle={{ background: 'oklch(0.16 0.012 250)', border: '1px solid oklch(1 0 0 / 8%)', borderRadius: 10, fontSize: 12 }}
                  cursor={{ fill: 'oklch(1 0 0 / 4%)' }}
                />
                <Bar dataKey="ganhos" radius={[4, 4, 0, 0]} fill="oklch(0.62 0.18 162)" opacity={0.85} />
                <Bar dataKey="gastos" radius={[4, 4, 0, 0]} fill="#ef4444" opacity={0.75} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── Gráfico Gastos por Mês com média ── */}
          <div className="bg-card rounded-2xl p-4" style={{ boxShadow: '0 1px 8px oklch(0 0 0 / 18%)' }}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-destructive/15 flex items-center justify-center">
                  <TrendingDown size={13} className="text-destructive" />
                </div>
                <span className="text-xs font-semibold text-foreground">Histórico de gastos</span>
              </div>
              {mediaGastos > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  Média: {formatBRLShort(mediaGastos)}
                </span>
              )}
            </div>
            {variacaoGastos !== null && (
              <p className="text-[11px] mb-3" style={{ color: variacaoGastos <= 0 ? 'oklch(0.62 0.18 162)' : '#f97316' }}>
                {variacaoGastos <= 0
                  ? `↓ ${Math.abs(variacaoGastos).toFixed(0)}% menos que no mês passado`
                  : `↑ ${variacaoGastos.toFixed(0)}% mais que no mês passado`
                }
              </p>
            )}
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={dadosGastosMes} barSize={28} barGap={4}>
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'oklch(0.55 0.005 240)' }} axisLine={false} tickLine={false} interval={0} />
                <YAxis hide domain={[0, 'auto']} />
                <Tooltip
                  formatter={(v: number, _: string, props: any) =>
                    props.payload?.semDados ? ['Sem dados', ''] : [formatBRL(v), 'Gastos']
                  }
                  contentStyle={{ background: 'oklch(0.16 0.012 250)', border: '1px solid oklch(1 0 0 / 8%)', borderRadius: 10, fontSize: 12 }}
                  cursor={{ fill: 'oklch(1 0 0 / 4%)' }}
                />
                {mediaGastos > 0 && (
                  <ReferenceLine
                    y={mediaGastos}
                    stroke="oklch(0.55 0.005 240)"
                    strokeDasharray="4 3"
                    strokeWidth={1.5}
                  />
                )}
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
        </>
      )}
    </div>
  )
}
