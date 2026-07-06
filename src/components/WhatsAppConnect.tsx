import { useState, useEffect } from 'react'
import { MessageCircle, CheckCircle, Smartphone, ArrowRight, Loader2, X, RefreshCw } from 'lucide-react'

const REGISTER_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-register`

interface Props {
  nomeUsuario: string
  onClose: () => void
}

type Etapa = 'inicio' | 'digitar_numero' | 'aguardar_codigo' | 'conectado'

export function WhatsAppConnect({ nomeUsuario, onClose }: Props) {
  const [etapa, setEtapa] = useState<Etapa>('inicio')
  const [phone, setPhone] = useState('')
  const [codigo, setCodigo] = useState('')
  const [codigoTela, setCodigoTela] = useState<string | null>(null) // fallback sem WA token
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  // Verificar se já tem número conectado
  useEffect(() => {
    const phoneLocal = localStorage.getItem('wa_phone')
    if (phoneLocal) {
      setPhone(phoneLocal)
      setEtapa('conectado')
    }
  }, [])

  const formatarPhone = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 13)
    return digits
  }

  const solicitarCodigo = async () => {
    setErro('')
    const phoneClean = phone.replace(/\D/g, '')
    if (phoneClean.length < 10) {
      setErro('Digite um número válido com DDD (ex: 11999999999)')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(REGISTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          action: 'request_code',
          phone: `55${phoneClean}`,
          user_name: nomeUsuario
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao enviar código')

      if (data.method === 'screen') {
        setCodigoTela(data.code)
      }
      setEtapa('aguardar_codigo')
    } catch (e) {
      setErro(String(e))
    } finally {
      setLoading(false)
    }
  }

  const verificarCodigo = async () => {
    setErro('')
    if (codigo.length !== 6) {
      setErro('O código tem 6 dígitos')
      return
    }
    setLoading(true)
    try {
      const phoneClean = `55${phone.replace(/\D/g, '')}`
      const res = await fetch(REGISTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ action: 'verify_code', phone: phoneClean, codigo })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Código inválido')

      localStorage.setItem('wa_phone', phone)
      setEtapa('conectado')
    } catch (e) {
      setErro(String(e))
    } finally {
      setLoading(false)
    }
  }

  const desconectar = async () => {
    setLoading(true)
    const phoneClean = `55${phone.replace(/\D/g, '')}`
    await fetch(REGISTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ action: 'disconnect', phone: phoneClean })
    })
    localStorage.removeItem('wa_phone')
    setPhone('')
    setCodigo('')
    setEtapa('inicio')
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div
        className="w-full max-w-lg rounded-t-3xl p-6 pb-8"
        style={{ background: '#0f1f3d' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-green-500 flex items-center justify-center">
              <MessageCircle size={16} className="text-white" />
            </div>
            <span className="text-white font-bold text-[15px]">WhatsApp</span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* ── Etapa: início ── */}
        {etapa === 'inicio' && (
          <div>
            <p className="text-white font-bold text-[17px] mb-1">Conecte seu WhatsApp</p>
            <p className="text-white/50 text-[13px] mb-5">Registre gastos, receitas e dívidas direto pelo WhatsApp — sem abrir o app.</p>
            <div className="space-y-3 mb-6">
              {[
                '"Gastei 50 no mercado" → gasto salvo ✅',
                '"Recebi 3000 de salário" → receita salva ✅',
                '"Quanto gastei este mês?" → resumo no ZAP ✅',
                'Mande um áudio e transcrevo automaticamente 🎤',
              ].map(ex => (
                <div key={ex} className="flex items-start gap-2">
                  <span className="text-green-400 text-[12px] mt-0.5">•</span>
                  <span className="text-white/70 text-[12px]">{ex}</span>
                </div>
              ))}
            </div>
            <button
              className="w-full py-3 rounded-2xl bg-green-500 hover:bg-green-400 transition-colors text-white font-bold text-[14px] flex items-center justify-center gap-2"
              onClick={() => setEtapa('digitar_numero')}
            >
              <Smartphone size={16} />
              Vincular meu número
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* ── Etapa: digitar número ── */}
        {etapa === 'digitar_numero' && (
          <div>
            <p className="text-white font-bold text-[17px] mb-1">Seu número de WhatsApp</p>
            <p className="text-white/50 text-[13px] mb-5">Digite sem o +55. Vamos enviar um código de verificação.</p>
            <div className="flex items-center gap-2 mb-4">
              <div
                className="px-3 py-3 rounded-xl text-white/60 text-[14px] font-medium shrink-0"
                style={{ background: 'rgba(255,255,255,0.08)' }}
              >
                🇧🇷 +55
              </div>
              <input
                type="tel"
                placeholder="11999999999"
                value={phone}
                onChange={e => setPhone(formatarPhone(e.target.value))}
                className="flex-1 px-4 py-3 rounded-xl text-white text-[15px] outline-none"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                maxLength={11}
              />
            </div>
            {erro && <p className="text-red-400 text-[12px] mb-3">{erro}</p>}
            <button
              className="w-full py-3 rounded-2xl bg-green-500 hover:bg-green-400 transition-colors text-white font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-50"
              onClick={solicitarCodigo}
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              {loading ? 'Enviando...' : 'Enviar código'}
            </button>
          </div>
        )}

        {/* ── Etapa: aguardar código ── */}
        {etapa === 'aguardar_codigo' && (
          <div>
            <p className="text-white font-bold text-[17px] mb-1">Digite o código</p>
            {codigoTela ? (
              <div className="mb-4 p-4 rounded-2xl" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}>
                <p className="text-green-400 text-[12px] mb-1">Seu código de verificação:</p>
                <p className="text-white font-bold text-3xl tracking-widest text-center">{codigoTela}</p>
                <p className="text-white/40 text-[11px] text-center mt-1">Válido por 10 minutos</p>
              </div>
            ) : (
              <p className="text-white/50 text-[13px] mb-4">Enviamos um código de 6 dígitos para o WhatsApp <strong className="text-white">+55 {phone}</strong></p>
            )}
            <input
              type="number"
              placeholder="000000"
              value={codigo}
              onChange={e => setCodigo(e.target.value.slice(0, 6))}
              className="w-full px-4 py-3 rounded-xl text-white text-[20px] font-bold tracking-widest text-center outline-none mb-4"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
            />
            {erro && <p className="text-red-400 text-[12px] mb-3">{erro}</p>}
            <button
              className="w-full py-3 rounded-2xl bg-green-500 hover:bg-green-400 transition-colors text-white font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-50"
              onClick={verificarCodigo}
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              {loading ? 'Verificando...' : 'Confirmar'}
            </button>
            <button
              className="w-full mt-2 py-2 text-white/40 text-[12px] hover:text-white/70 flex items-center justify-center gap-1"
              onClick={() => { setCodigo(''); setErro(''); setEtapa('digitar_numero') }}
            >
              <RefreshCw size={12} /> Reenviar código
            </button>
          </div>
        )}

        {/* ── Etapa: conectado ── */}
        {etapa === 'conectado' && (
          <div>
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-3">
                <CheckCircle size={32} className="text-green-400" />
              </div>
              <p className="text-white font-bold text-[17px]">WhatsApp conectado!</p>
              <p className="text-white/50 text-[13px] mt-1">+55 {phone}</p>
            </div>
            <div className="space-y-2 mb-6">
              {[
                'Mande "gastei X em Y" para registrar um gasto',
                'Mande "recebi X de Y" para registrar receita',
                'Mande "quanto gastei esse mês?" para ver resumo',
                'Mande um áudio — transcrevo automaticamente!',
              ].map(dica => (
                <div key={dica} className="flex items-start gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <span className="text-green-400 text-[11px] mt-0.5 shrink-0">✓</span>
                  <span className="text-white/60 text-[12px]">{dica}</span>
                </div>
              ))}
            </div>
            <button
              className="w-full py-3 rounded-2xl text-red-400 text-[13px] font-medium flex items-center justify-center gap-2 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              style={{ border: '1px solid rgba(239,68,68,0.3)' }}
              onClick={desconectar}
              disabled={loading}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
              Desconectar número
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
