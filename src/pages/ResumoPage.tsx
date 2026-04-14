import { useMemo } from 'react'
import { useApp } from '@/context/AppContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'

function formatBRL(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`
}

export default function ResumoPage() {
  const { gastos, receitas, dividas, totalGastos, totalReceitas, totalDividas, loading } = useApp()
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

  // Dados por mês para gráficos
  const dadosDividaMes = useMemo(() => {
    const meses: Record<string, number> = {}
    dividas.forEach(d => {
      const m = (d.created_at || '').substring(0, 7)
      if (m) meses[m] = (meses[m] || 0) + (Number(d.valor_total) - Number(d.valor_pago))
    })
    return Object.entries(meses).slice(-6).map(([mes, valor]) => ({
      mes: format(new Date(mes + '-01'), 'MMM', { locale: ptBR }),
      valor,
    }))
  }, [dividas])

  const dadosGastosMes = useMemo(() => {
    const meses: Record<string, number> = {}
    gastos.forEach(g => {
      const m = g.data.substring(0, 7)
      if (m) meses[m] = (meses[m] || 0) + Number(g.valor)
    })
    return Object.entries(meses).slice(-6).map(([mes, valor]) => ({
      mes: format(new Date(mes + '-01'), 'MMM', { locale: ptBR }),
      valor,
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

          {/* Gráfico Dívida por Mês */}
          <div className="bg-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span>💳</span>
              <span className="text-xs font-bold text-muted-foreground tracking-wider">DÍVIDA RESTANTE POR MÊS</span>
            </div>
            {dadosDividaMes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sem dados de dívida ainda.</p>
            ) : (
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={dadosDividaMes} barSize={24}>
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    formatter={(v: number) => [`R$ ${v.toFixed(2).replace('.', ',')}`, 'Dívida']}
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="valor" fill="oklch(0.65 0.22 25)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Gráfico Gastos por Mês */}
          <div className="bg-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span>💸</span>
              <span className="text-xs font-bold text-muted-foreground tracking-wider">GASTOS POR MÊS</span>
            </div>
            {dadosGastosMes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sem gastos ainda.</p>
            ) : (
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={dadosGastosMes} barSize={24}>
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    formatter={(v: number) => [`R$ ${v.toFixed(2).replace('.', ',')}`, 'Gastos']}
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="valor" fill="oklch(0.65 0.19 155)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </div>
  )
}
