import { X, Zap, History, MessageCircle, Download, Target, TrendingUp } from 'lucide-react'

interface Props {
  motivo: 'historico' | 'whatsapp' | 'exportar' | 'meta'
  onFechar: () => void
  totalRegistros?: number
}

const BENEFICIOS = [
  { icon: History, texto: 'Histórico completo sem limite de tempo' },
  { icon: MessageCircle, texto: 'Registre tudo pelo WhatsApp' },
  { icon: Download, texto: 'Exporte seus dados quando quiser' },
  { icon: Target, texto: 'Metas mensais de gastos' },
  { icon: TrendingUp, texto: 'Relatórios de todos os meses' },
]

const TEXTOS = {
  historico: {
    titulo: 'Veja todo o seu histórico',
    subtitulo: 'No plano gratuito você só acessa os últimos 30 dias.',
  },
  whatsapp: {
    titulo: 'Registre pelo WhatsApp',
    subtitulo: 'Envie uma mensagem e seu gasto é registrado automaticamente.',
  },
  exportar: {
    titulo: 'Exporte seus dados',
    subtitulo: 'Baixe um resumo completo de todas as suas finanças.',
  },
  meta: {
    titulo: 'Defina sua meta mensal',
    subtitulo: 'Controle quanto quer gastar por mês e receba alertas.',
  },
}

export default function PaywallModal({ motivo, onFechar, totalRegistros }: Props) {
  const texto = TEXTOS[motivo]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div
        className="w-full max-w-lg rounded-t-3xl overflow-hidden"
        style={{ background: 'oklch(0.14 0.03 240)', border: '1px solid oklch(1 0 0 / 8%)' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'oklch(1 0 0 / 15%)' }} />
        </div>

        {/* Header */}
        <div className="px-5 pt-3 pb-5">
          <div className="flex items-start justify-between mb-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, oklch(0.55 0.18 162), oklch(0.48 0.16 162))' }}
            >
              <Zap size={22} className="text-white" />
            </div>
            <button onClick={onFechar} className="p-1 text-muted-foreground hover:text-foreground transition-colors mt-1">
              <X size={20} />
            </button>
          </div>

          <h2 className="text-xl font-black text-foreground mb-1">{texto.titulo}</h2>
          <p className="text-muted-foreground text-[14px] leading-relaxed mb-1">{texto.subtitulo}</p>

          {totalRegistros && motivo === 'historico' && (
            <p className="text-[13px] mt-2" style={{ color: 'oklch(0.55 0.18 162)' }}>
              Você tem {totalRegistros} registros além dos 30 dias gratuitos.
            </p>
          )}
        </div>

        {/* Benefícios */}
        <div className="px-5 pb-4">
          <p className="text-[11px] font-bold tracking-widest text-muted-foreground/50 mb-3">TUDO INCLUÍDO NO PRO</p>
          <div className="space-y-2.5">
            {BENEFICIOS.map(({ icon: Icon, texto: t }) => (
              <div key={t} className="flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'oklch(0.48 0.16 162 / 15%)' }}
                >
                  <Icon size={13} className="text-primary" />
                </div>
                <p className="text-foreground text-[13px]">{t}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="px-5 pb-8 pt-2">
          <button
            className="w-full py-4 rounded-2xl font-black text-[16px] text-white active:scale-[0.98] transition-transform"
            style={{ background: 'linear-gradient(135deg, oklch(0.55 0.18 162), oklch(0.48 0.14 162))' }}
            onClick={() => {
              // TODO: integrar com Stripe/Mercado Pago
              onFechar()
            }}
          >
            Assinar Pro — R$ 19,90/mês
          </button>
          <p className="text-center text-[12px] text-muted-foreground mt-2">
            Cancele quando quiser · Sem fidelidade
          </p>
        </div>
      </div>
    </div>
  )
}
