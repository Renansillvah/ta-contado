import { useMemo, useState } from 'react'
import { useApp } from '@/context/AppContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { format, subMonths, startOfMonth, startOfWeek, endOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown, CreditCard, AlertTriangle, CheckCircle2, AlertCircle, Wallet, ArrowDownCircle, Target, Lightbulb, MessageSquare, Calendar, Star, Zap } from 'lucide-react'

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

function PlanoInicial() {
  const objetivo = localStorage.getItem('onboarding_objetivo') || ''
  const renda = parseFloat(localStorage.getItem('onboarding_renda') || '0')

  const PLANOS: Record<string, { titulo: string; descricao: string; dicas: string[] }> = {
    organizar: {
      titulo: 'Organizar suas finanças',
      descricao: 'Para começar, registre seus gastos por 7 dias seguidos. Você vai se surpreender com o que descobre.',
      dicas: ['Registre todo gasto, mesmo os pequenos', 'Use o Chat para lançar rapidinho', 'Veja o Resumo após a primeira semana'],
    },
    dividas: {
      titulo: 'Plano para sair das dívidas',
      descricao: 'Comece mapeando tudo que você deve. Depois corte os gastos supérfluos e direcione para as dívidas com os maiores juros.',
      dicas: ['Cadastre suas dívidas na aba Dívidas', 'Identifique as de maior juros', 'Defina um valor fixo para quitar todo mês'],
    },
    economizar: {
      titulo: 'Meta de poupança mensal',
      descricao: 'Para economizar, você precisa saber para onde vai o dinheiro. Controle os gastos por 2 semanas e encontre onde cortar.',
      dicas: ['Registre todos os gastos diariamente', 'Identifique os gastos que podem ser cortados', 'Transfira o que sobrar logo no começo do mês'],
    },
    investir: {
      titulo: 'Preparar para investir',
      descricao: 'Antes de investir, organize sua vida financeira. Quem não conhece seus gastos, não consegue sobrar dinheiro para investir.',
      dicas: ['Registre receitas e gastos por 30 dias', 'Monte uma reserva de emergência primeiro', 'Com o saldo positivo, comece a investir'],
    },
  }

  const plano = PLANOS[objetivo] || PLANOS['organizar']
  const metaPoupanca = renda > 0 ? Math.round(renda * 0.3 / 100) * 100 : null

  return (
    <div className="space-y-3">
      {/* Card boas-vindas ao resumo */}
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: 'oklch(0.48 0.16 162)', boxShadow: '0 4px 24px oklch(0.48 0.16 162 / 35%)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Target size={16} className="text-white/80" />
          <p className="text-[11px] text-white/70 uppercase tracking-widest font-medium">Seu plano</p>
        </div>
        <p className="text-white font-black text-lg leading-tight mb-1">{plano.titulo}</p>
        <p className="text-white/70 text-[13px] leading-relaxed">{plano.descricao}</p>
        {metaPoupanca && (
          <div className="mt-3 bg-white/15 rounded-xl px-3 py-2.5">
            <p className="text-white/60 text-[11px] uppercase tracking-wider font-medium mb-0.5">Meta sugerida de poupança</p>
            <p className="text-white font-bold text-xl">R$ {metaPoupanca.toLocaleString('pt-BR')}<span className="text-sm font-normal text-white/60">/mês</span></p>
          </div>
        )}
      </div>

      {/* Próximos passos */}
      <div className="bg-card rounded-2xl p-4" style={{ boxShadow: '0 1px 8px oklch(0 0 0 / 18%)' }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
            <Lightbulb size={13} className="text-primary" />
          </div>
          <span className="text-xs font-semibold text-foreground">Próximos passos</span>
        </div>
        <div className="space-y-2.5">
          {plano.dicas.map((dica, i) => (
            <div key={i} className="flex items-start gap-3">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold text-white"
                style={{ backgroundColor: 'oklch(0.48 0.16 162)' }}
              >
                {i + 1}
              </div>
              <p className="text-xs text-foreground leading-relaxed">{dica}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA para ir ao chat */}
      <div
        className="rounded-2xl p-4 flex items-center gap-3"
        style={{ background: 'oklch(0.19 0.04 240)', border: '1px solid oklch(1 0 0 / 8%)' }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'oklch(0.48 0.16 162 / 20%)' }}>
          <MessageSquare size={18} className="text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-foreground font-semibold text-[13px] leading-tight">Registre seu primeiro gasto</p>
          <p className="text-muted-foreground text-[11px] mt-0.5">Vá no Chat e diga: "Almoço 25 reais"</p>
        </div>
      </div>
    </div>
  )
}

function ResumoSemanal() {
  const { gastos, receitas, dividas, loading } = useApp()

  // ── Intervalo da semana atual (segunda a domingo) ────────────────────────────
  const hoje = new Date()
  const inicioSemana = startOfWeek(hoje, { weekStartsOn: 1 }) // segunda
  const fimSemana    = endOfWeek(hoje, { weekStartsOn: 1 })   // domingo
  const inicioStr    = inicioSemana.toISOString().split('T')[0]
  const fimStr       = fimSemana.toISOString().split('T')[0]

  const labelPeriodo = `${format(inicioSemana, "d 'de' MMM", { locale: ptBR })} – ${format(fimSemana, "d 'de' MMM", { locale: ptBR })}`

  // ── Dados da semana ──────────────────────────────────────────────────────────
  const gastosSemana        = useMemo(() => gastos.filter(g => g.data >= inicioStr && g.data <= fimStr), [gastos, inicioStr, fimStr])
  // Apenas receitas já recebidas (não inclui "a_receber" para não inflar o saldo)
  const receitasSemana      = useMemo(() => receitas.filter(r => r.data >= inicioStr && r.data <= fimStr && r.tipo === 'recebido'), [receitas, inicioStr, fimStr])
  const receitasAReceberSem = useMemo(() => receitas.filter(r => r.data >= inicioStr && r.data <= fimStr && r.tipo === 'a_receber'), [receitas, inicioStr, fimStr])
  const dividasSemana       = useMemo(() => dividas.filter(d => {
    const dt = d.created_at?.split('T')[0] ?? ''
    return dt >= inicioStr && dt <= fimStr
  }), [dividas, inicioStr, fimStr])

  const totalGastosSem      = useMemo(() => gastosSemana.reduce((s, g) => s + Number(g.valor), 0), [gastosSemana])
  const totalReceitasSem    = useMemo(() => receitasSemana.reduce((s, r) => s + Number(r.valor), 0), [receitasSemana])
  const totalAReceberSem    = useMemo(() => receitasAReceberSem.reduce((s, r) => s + Number(r.valor), 0), [receitasAReceberSem])
  const saldoSemana         = totalReceitasSem - totalGastosSem
  const totalLancamentos    = gastosSemana.length + receitasSemana.length + receitasAReceberSem.length + dividasSemana.length

  // ── Categorias ───────────────────────────────────────────────────────────────
  const porCategoria = useMemo(() => {
    const contagem: Record<string, { total: number; qtd: number }> = {}
    gastosSemana.forEach(g => {
      if (!contagem[g.categoria]) contagem[g.categoria] = { total: 0, qtd: 0 }
      contagem[g.categoria].total += Number(g.valor)
      contagem[g.categoria].qtd  += 1
    })
    return Object.entries(contagem).sort((a, b) => b[1].total - a[1].total)
  }, [gastosSemana])

  const catMaiorGasto = porCategoria[0] ?? null
  const catMaisUsada  = useMemo(() => {
    if (!porCategoria.length) return null
    return porCategoria.reduce((a, b) => b[1].qtd > a[1].qtd ? b : a)
  }, [porCategoria])

  // ── Análise automática — só exibe com dados suficientes ─────────────────────
  const analises = useMemo(() => {
    const itens: string[] = []
    // Com menos de 3 lançamentos, não faz análise — dados insuficientes
    if (totalLancamentos < 3) return itens

    if (catMaiorGasto && gastosSemana.length >= 3) {
      const pct = totalGastosSem > 0 ? (catMaiorGasto[1].total / totalGastosSem * 100).toFixed(0) : '0'
      itens.push(`Você gastou mais com ${catMaiorGasto[0]} nesta semana (${pct}% do total de gastos).`)
    }

    // Só comenta saldo negativo se há receitas registradas — sem receitas, saldo negativo é esperado
    if (saldoSemana >= 0 && totalReceitasSem > 0) {
      itens.push('Seu saldo permaneceu positivo neste período — ótimo sinal de controle financeiro.')
    } else if (saldoSemana < 0 && totalReceitasSem > 0) {
      itens.push('Seus gastos superaram as receitas esta semana. Continue registrando para visualizar melhor.')
    }

    if (porCategoria.length <= 2 && gastosSemana.length >= 4) {
      itens.push('Seus gastos ficaram concentrados em poucas categorias, o que facilita a organização.')
    } else if (porCategoria.length >= 5 && gastosSemana.length >= 5) {
      itens.push('Você registrou gastos em várias categorias — uma visão bem diversificada das suas despesas.')
    }

    if (totalLancamentos >= 7) {
      itens.push(`Você fez ${totalLancamentos} lançamentos esta semana. Ótimo ritmo de acompanhamento!`)
    }

    return itens.slice(0, 3)
  }, [totalLancamentos, catMaiorGasto, totalGastosSem, saldoSemana, totalReceitasSem, porCategoria, gastosSemana.length])

  // ── Oportunidades de melhoria — só com dados minimamente representativos ────
  const oportunidades = useMemo(() => {
    const ops: Array<{ icon: string; texto: string }> = []

    // Precisa de ao menos 3 lançamentos para sugerir cortes
    if (totalLancamentos < 3) {
      ops.push({ icon: '📝', texto: 'Registre mais alguns gastos e receitas para que eu possa mostrar sugestões personalizadas.' })
      return ops
    }

    if (catMaiorGasto && totalGastosSem > 0) {
      const pct = catMaiorGasto[1].total / totalGastosSem * 100
      // Só sugere corte se representar mais de 50% dos gastos E houver ao menos 4 registros
      if (pct > 50 && gastosSemana.length >= 4) {
        ops.push({ icon: '✂️', texto: `${catMaiorGasto[0]} representa ${pct.toFixed(0)}% dos seus gastos nesta semana. Vale acompanhar essa categoria.` })
      }
    }

    if (dividas.length > 0 && saldoSemana > 0 && totalReceitasSem > 0) {
      ops.push({ icon: '💳', texto: 'Aproveitar o saldo positivo para priorizar o pagamento de dívidas.' })
    }

    if (totalReceitasSem === 0 && totalGastosSem > 0) {
      ops.push({ icon: '💰', texto: 'Registre suas receitas desta semana para eu calcular seu saldo real.' })
    }

    if (totalGastosSem > 0 && totalReceitasSem > 0 && totalReceitasSem > totalGastosSem * 1.2) {
      ops.push({ icon: '🎯', texto: 'Você está com saldo positivo. Um ótimo momento para criar uma meta de poupança.' })
    }

    return ops.slice(0, 3)
  }, [catMaiorGasto, totalGastosSem, gastosSemana.length, dividas.length, saldoSemana, totalLancamentos, totalReceitasSem])

  // ── Dados do gráfico de gastos por dia da semana ─────────────────────────────
  const diasSemana = useMemo(() => {
    const dias = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(inicioSemana)
      d.setDate(d.getDate() + i)
      const ds = d.toISOString().split('T')[0]
      const total = gastosSemana.filter(g => g.data === ds).reduce((s, g) => s + Number(g.valor), 0)
      dias.push({
        dia: format(d, 'EEE', { locale: ptBR }).replace('.', ''),
        total,
        isHoje: ds === hoje.toISOString().split('T')[0],
      })
    }
    return dias
  }, [gastosSemana, inicioSemana, hoje])

  const semDados = totalLancamentos === 0

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-36 w-full rounded-2xl" />
      </div>
    )
  }

  if (semDados) {
    return (
      <div className="space-y-3">
        {/* Estado vazio */}
        <div
          className="rounded-2xl p-5 text-center"
          style={{ backgroundColor: 'oklch(0.48 0.16 162)', boxShadow: '0 4px 24px oklch(0.48 0.16 162 / 35%)' }}
        >
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mx-auto mb-3">
            <Calendar size={28} className="text-white" />
          </div>
          <p className="text-white font-black text-lg mb-1">Resumo desta semana</p>
          <p className="text-white/70 text-[13px] leading-relaxed">{labelPeriodo}</p>
        </div>
        <div className="bg-card rounded-2xl p-5" style={{ boxShadow: '0 1px 8px oklch(0 0 0 / 18%)' }}>
          <p className="text-foreground font-semibold text-sm mb-1">Nenhum registro esta semana</p>
          <p className="text-muted-foreground text-[13px] leading-relaxed">
            Vá no Chat e registre um gasto, receita ou dívida para ver sua análise semanal.
          </p>
          <p className="text-[12px] mt-3 text-muted-foreground">Exemplo: <span className="text-primary font-medium">"Almoço 25 reais"</span></p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* ── Card principal da semana ── */}
      <div
        className="rounded-2xl p-5"
        style={{
          backgroundColor: saldoSemana < 0 ? 'oklch(0.38 0.16 20)' : 'oklch(0.48 0.16 162)',
          boxShadow: saldoSemana < 0 ? '0 4px 24px oklch(0.38 0.16 20 / 40%)' : '0 4px 24px oklch(0.48 0.16 162 / 35%)',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={13} className="text-white/70" />
          <p className="text-[11px] text-white/60 uppercase tracking-widest font-medium">Semana atual</p>
          <p className="text-[11px] text-white/50 ml-auto">{labelPeriodo}</p>
        </div>

        <p className="text-[11px] text-white/60 mb-0.5">Saldo da semana</p>
        <p className="text-3xl font-black text-white leading-tight mb-0.5" style={{ fontFamily: 'Poppins,sans-serif' }}>
          {saldoSemana >= 0 ? '+' : ''}R$ {Math.abs(saldoSemana).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
        <p className="text-[11px] text-white/60 mb-4">
          {saldoSemana >= 0 ? 'sobrando nesta semana' : '⚠️ no vermelho nesta semana'}
          {totalAReceberSem > 0 && ` · +R$ ${totalAReceberSem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} a receber`}
        </p>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/12 rounded-xl p-2.5">
            <div className="flex items-center gap-1 mb-1">
              <TrendingUp size={11} className="text-white/70" />
              <p className="text-[10px] text-white/60">Receitas</p>
            </div>
            <p className="font-bold text-white text-xs">R$ {totalReceitasSem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-white/12 rounded-xl p-2.5">
            <div className="flex items-center gap-1 mb-1">
              <TrendingDown size={11} className="text-white/70" />
              <p className="text-[10px] text-white/60">Gastos</p>
            </div>
            <p className="font-bold text-red-300 text-xs">R$ {totalGastosSem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-white/12 rounded-xl p-2.5">
            <div className="flex items-center gap-1 mb-1">
              <Zap size={11} className="text-white/70" />
              <p className="text-[10px] text-white/60">Lançamentos</p>
            </div>
            <p className="font-bold text-white text-xs">{totalLancamentos}</p>
          </div>
        </div>
      </div>

      {/* ── Stats de categoria ── */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-card rounded-2xl p-4" style={{ boxShadow: '0 1px 8px oklch(0 0 0 / 18%)' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-destructive/15 flex items-center justify-center">
              <ArrowDownCircle size={13} className="text-destructive" />
            </div>
            <p className="text-[11px] text-muted-foreground font-medium">Maior gasto</p>
          </div>
          {catMaiorGasto ? (
            <>
              <p className="font-bold text-foreground text-sm leading-tight">{catMaiorGasto[0]}</p>
              <p className="text-destructive font-bold text-base mt-0.5">
                R$ {catMaiorGasto[1].total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">Sem gastos</p>
          )}
        </div>

        <div className="bg-card rounded-2xl p-4" style={{ boxShadow: '0 1px 8px oklch(0 0 0 / 18%)' }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'oklch(0.48 0.16 162 / 15%)' }}>
              <Target size={13} style={{ color: 'oklch(0.62 0.18 162)' }} />
            </div>
            <p className="text-[11px] text-muted-foreground font-medium">Mais usada</p>
          </div>
          {catMaisUsada ? (
            <>
              <p className="font-bold text-foreground text-sm leading-tight">{catMaisUsada[0]}</p>
              <p className="text-[12px] mt-0.5" style={{ color: 'oklch(0.62 0.18 162)' }}>
                {catMaisUsada[1].qtd} {catMaisUsada[1].qtd === 1 ? 'registro' : 'registros'}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">Sem dados</p>
          )}
        </div>
      </div>

      {/* ── Gráfico de gastos por dia ── */}
      {gastosSemana.length > 0 && (
        <div className="bg-card rounded-2xl p-4" style={{ boxShadow: '0 1px 8px oklch(0 0 0 / 18%)' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-destructive/15 flex items-center justify-center">
              <TrendingDown size={13} className="text-destructive" />
            </div>
            <span className="text-xs font-semibold text-foreground">Gastos por dia</span>
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={diasSemana} barSize={22}>
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: 'oklch(0.55 0.005 240)' }} axisLine={false} tickLine={false} />
              <YAxis hide domain={[0, 'auto']} />
              <Tooltip
                formatter={(v: number) => [`R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Gastos']}
                contentStyle={{ background: 'oklch(0.16 0.012 250)', border: '1px solid oklch(1 0 0 / 8%)', borderRadius: 10, fontSize: 12 }}
                cursor={{ fill: 'oklch(1 0 0 / 4%)' }}
              />
              <Bar dataKey="total" radius={[5, 5, 0, 0]}>
                {diasSemana.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={entry.isHoje ? 'oklch(0.60 0.20 20)' : entry.total > 0 ? 'oklch(0.45 0.16 162)' : 'oklch(0.28 0.008 250)'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Análise automática ── */}
      {analises.length > 0 && (
        <div className="bg-card rounded-2xl p-4" style={{ boxShadow: '0 1px 8px oklch(0 0 0 / 18%)' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'oklch(0.48 0.16 162 / 15%)' }}>
              <Lightbulb size={13} style={{ color: 'oklch(0.62 0.18 162)' }} />
            </div>
            <span className="text-xs font-semibold text-foreground">Análise da semana</span>
          </div>
          <div className="space-y-2.5">
            {analises.map((analise, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div
                  className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                  style={{ backgroundColor: 'oklch(0.62 0.18 162)' }}
                />
                <p className="text-[13px] text-foreground leading-relaxed">{analise}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Oportunidades de melhoria ── */}
      {oportunidades.length > 0 && (
        <div className="bg-card rounded-2xl p-4" style={{ boxShadow: '0 1px 8px oklch(0 0 0 / 18%)' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'oklch(0.55 0.18 162 / 15%)' }}>
              <Star size={13} style={{ color: 'oklch(0.68 0.16 162)' }} />
            </div>
            <span className="text-xs font-semibold text-foreground">Oportunidades de melhoria</span>
          </div>
          <div className="space-y-2.5">
            {oportunidades.map((op, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-xl p-2.5"
                style={{ background: 'oklch(0.48 0.16 162 / 6%)', border: '1px solid oklch(0.55 0.18 162 / 15%)' }}>
                <span className="text-base shrink-0 leading-none mt-0.5">{op.icon}</span>
                <p className="text-[13px] text-foreground leading-relaxed">{op.texto}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Categorias detalhadas ── */}
      {porCategoria.length > 0 && (
        <div className="bg-card rounded-2xl p-4" style={{ boxShadow: '0 1px 8px oklch(0 0 0 / 18%)' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-destructive/15 flex items-center justify-center">
              <CreditCard size={13} className="text-destructive" />
            </div>
            <span className="text-xs font-semibold text-foreground">Gastos por categoria</span>
          </div>
          <div className="space-y-2.5">
            {porCategoria.map(([cat, dados]) => {
              const pct = totalGastosSem > 0 ? (dados.total / totalGastosSem) * 100 : 0
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[13px] text-foreground font-medium">{cat}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] text-muted-foreground">{pct.toFixed(0)}%</p>
                      <p className="text-[13px] font-semibold text-foreground">
                        R$ {dados.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: 'oklch(0.52 0.18 162)' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Mensagem final ── */}
      <div
        className="rounded-2xl p-4 flex items-start gap-3"
        style={{ background: 'oklch(0.48 0.16 162 / 10%)', border: '1px solid oklch(0.55 0.18 162 / 25%)' }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'oklch(0.48 0.16 162 / 20%)' }}>
          <MessageSquare size={16} style={{ color: 'oklch(0.62 0.18 162)' }} />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-foreground leading-snug mb-1">
            Parabéns por acompanhar suas finanças esta semana.
          </p>
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            Quanto mais informações você registrar, mais precisas serão minhas análises.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function ResumoPage() {
  const [abaSelecionada, setAbaSelecionada] = useState<'mes' | 'semana'>('semana')
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

  const semDados = gastos.length === 0 && receitas.length === 0

  return (
    <div className="overflow-y-auto h-full p-4 space-y-3">
      {/* ── Seletor de abas ── */}
      <div
        className="flex rounded-2xl p-1 gap-1"
        style={{ background: 'oklch(0.22 0.04 240)' }}
      >
        {([
          { id: 'semana', label: 'Semana' },
          { id: 'mes',    label: 'Mês'    },
        ] as const).map(aba => (
          <button
            key={aba.id}
            onClick={() => setAbaSelecionada(aba.id)}
            className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
            style={abaSelecionada === aba.id
              ? { backgroundColor: 'oklch(0.48 0.16 162)', color: 'white', boxShadow: '0 2px 8px oklch(0.48 0.16 162 / 35%)' }
              : { color: 'oklch(0.55 0.01 240)' }
            }
          >
            {aba.label}
          </button>
        ))}
      </div>

      {/* ── Conteúdo da aba Semana ── */}
      {abaSelecionada === 'semana' && <ResumoSemanal />}

      {/* ── Conteúdo da aba Mês ── */}
      {abaSelecionada === 'mes' && (loading ? (
        <div className="space-y-3">
          <Skeleton className="h-52 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
      ) : semDados ? (
        <PlanoInicial />
      ) : (
        <>
          {/* ── Card principal: saldo + saúde ── */}
          <div
            className="rounded-2xl p-5"
            style={{
              backgroundColor: saldoReal < 0 ? 'oklch(0.38 0.16 20)' : 'oklch(0.48 0.16 162)',
              boxShadow: saldoReal < 0 ? '0 4px 24px oklch(0.38 0.16 20 / 40%)' : '0 4px 24px oklch(0.48 0.16 162 / 35%)',
            }}
          >
            <p className="text-[11px] text-white/60 uppercase tracking-widest mb-1 font-medium">{MES_LABEL}</p>

            {/* Saldo com frase de contexto */}
            <div className="flex items-end justify-between mb-1">
              <div>
                <p className="text-3xl font-bold text-white leading-tight">{formatBRL(saldoReal)}</p>
                <p className="text-[11px] text-white/60 mt-0.5">
                  {saldoReal >= 0 ? 'sobrando este mês' : '⚠️ no vermelho este mês'}
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
      ))}
    </div>
  )
}
