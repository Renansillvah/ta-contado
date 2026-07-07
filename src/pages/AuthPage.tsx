import { useState } from 'react'
import { Eye, EyeOff, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Tela = 'welcome' | 'login' | 'signup' | 'forgot' | 'check-email'

interface Props {
  onAutenticado: () => void
}

function InputSenha({
  placeholder,
  value,
  onChange,
  autoComplete,
}: {
  placeholder: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
}) {
  const [visivel, setVisivel] = useState(false)
  return (
    <div className="relative">
      <input
        type={visivel ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="w-full rounded-2xl px-4 py-3.5 text-sm outline-none border transition-colors pr-11"
        style={{
          background: 'oklch(0.19 0.04 240)',
          borderColor: 'oklch(1 0 0 / 10%)',
          color: 'var(--foreground)',
        }}
      />
      <button
        type="button"
        onClick={() => setVisivel(v => !v)}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {visivel ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  )
}

function inputStyle() {
  return {
    background: 'oklch(0.19 0.04 240)',
    borderColor: 'oklch(1 0 0 / 10%)',
    color: 'var(--foreground)',
  }
}

export default function AuthPage({ onAutenticado }: Props) {
  const [tela, setTela] = useState<Tela>('welcome')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [nome, setNome] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  const limpar = () => { setErro(''); setSucesso('') }

  const irPara = (t: Tela) => { setTela(t); limpar() }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    limpar()
    if (!email || !senha) { setErro('Preencha e-mail e senha'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (error) {
        if (error.message.includes('Invalid login')) setErro('E-mail ou senha incorretos')
        else if (error.message.includes('Email not confirmed')) setErro('Confirme seu e-mail antes de entrar')
        else setErro('Erro ao entrar. Tente novamente.')
        return
      }
      onAutenticado()
    } finally {
      setLoading(false)
    }
  }

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault()
    limpar()
    if (!nome.trim()) { setErro('Digite seu nome'); return }
    if (!email) { setErro('Digite seu e-mail'); return }
    if (senha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres'); return }
    if (senha !== confirmarSenha) { setErro('As senhas não coincidem'); return }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { data: { full_name: nome.trim() } },
      })
      if (error) {
        if (error.message.includes('already registered') || error.message.includes('User already registered')) {
          setErro('E-mail já cadastrado. Faça login.')
        } else if (error.message.includes('rate limit') || error.message.includes('over_email')) {
          setErro('Muitos cadastros em pouco tempo. Aguarde alguns minutos e tente novamente.')
        } else {
          setErro(`Erro: ${error.message}`)
        }
        return
      }
      // Se tem sessão ativa → confirmação de e-mail desabilitada → entra direto
      if (data.session) {
        onAutenticado()
        return
      }
      // Se criou usuário mas não tem sessão → confirmação de e-mail está habilitada
      if (data.user && !data.session) {
        irPara('check-email')
        return
      }
      // Fallback
      onAutenticado()
    } catch (err) {
      setErro('Erro inesperado. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleRecuperar = async (e: React.FormEvent) => {
    e.preventDefault()
    limpar()
    if (!email) { setErro('Digite seu e-mail'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (error) { setErro('Erro ao enviar e-mail. Verifique o endereço.'); return }
      irPara('check-email')
    } finally {
      setLoading(false)
    }
  }

  // ── Tela de boas-vindas ────────────────────────────────────────────────────
  if (tela === 'welcome') {
    return (
      <div className="flex flex-col h-screen max-w-lg mx-auto bg-background overflow-hidden">
        {/* Área superior — identidade */}
        <div
          className="flex flex-col items-center justify-center flex-1 px-8 pt-16 pb-8"
          style={{ background: 'linear-gradient(175deg, #0a1628 0%, #0d2452 55%, oklch(0.14 0.03 240) 100%)' }}
        >
          {/* Logo */}
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, #1a3a8f, #2563eb)',
              boxShadow: '0 8px 32px rgba(37,99,235,0.4)',
            }}
          >
            <span className="text-white font-black text-2xl tracking-tight">TC</span>
          </div>

          <h1 className="text-3xl font-black text-white tracking-tight text-center mb-2">
            Tá Contado
          </h1>
          <p className="text-white/60 text-center text-[15px] leading-relaxed max-w-xs">
            Seu assistente financeiro pessoal. Simples, rápido e feito para o dia a dia.
          </p>

          {/* Benefícios */}
          <div className="mt-8 space-y-3 w-full max-w-xs">
            {[
              { emoji: '💬', texto: 'Registre tudo pelo chat ou voz' },
              { emoji: '📊', texto: 'Veja resumos do seu mês em segundos' },
              { emoji: '🎯', texto: 'Controle dívidas e metas com clareza' },
            ].map(b => (
              <div key={b.texto} className="flex items-center gap-3">
                <span className="text-xl">{b.emoji}</span>
                <p className="text-white/70 text-[14px]">{b.texto}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Área inferior — ações */}
        <div className="px-6 pb-10 pt-6 space-y-3 bg-background">
          <button
            onClick={() => irPara('signup')}
            className="w-full py-4 rounded-2xl font-bold text-[15px] text-white active:scale-[0.98] transition-transform"
            style={{ backgroundColor: 'oklch(0.55 0.18 162)' }}
          >
            Criar minha conta grátis
          </button>
          <button
            onClick={() => irPara('login')}
            className="w-full py-4 rounded-2xl font-semibold text-[14px] transition-colors"
            style={{
              background: 'oklch(0.19 0.04 240)',
              border: '1px solid oklch(1 0 0 / 10%)',
              color: 'var(--foreground)',
            }}
          >
            Já tenho conta — Entrar
          </button>
        </div>
      </div>
    )
  }

  // ── E-mail enviado (confirmação de cadastro ou recuperação de senha) ──────
  if (tela === 'check-email') {
    const isRecovery = !nome // se não tem nome preenchido, veio do fluxo de recuperação
    return (
      <div className="flex flex-col h-screen max-w-lg mx-auto bg-background overflow-hidden">
        <div
          className="px-5 pt-5 pb-6 shrink-0"
          style={{ background: 'linear-gradient(180deg, #0a1628 0%, oklch(0.14 0.03 240) 100%)' }}
        >
          <button
            onClick={() => irPara(isRecovery ? 'login' : 'welcome')}
            className="flex items-center gap-1.5 text-white/50 hover:text-white/80 transition-colors"
          >
            <ArrowLeft size={17} />
            <span className="text-sm">Voltar</span>
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-8 pb-16">
          {/* Ícone */}
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6"
            style={{ background: 'oklch(0.48 0.16 162 / 15%)', border: '1px solid oklch(0.55 0.18 162 / 30%)' }}
          >
            <CheckCircle2 size={36} className="text-primary" />
          </div>

          <h2 className="text-2xl font-black text-foreground text-center mb-3">
            {isRecovery ? 'Verifique seu e-mail' : 'Conta criada!'}
          </h2>

          <p className="text-muted-foreground text-center text-[15px] leading-relaxed max-w-xs mb-2">
            {isRecovery
              ? 'Enviamos um link para redefinir sua senha para:'
              : 'Enviamos um link de confirmação para:'
            }
          </p>

          <div
            className="px-4 py-2.5 rounded-xl mb-6"
            style={{ background: 'oklch(0.19 0.04 240)', border: '1px solid oklch(1 0 0 / 10%)' }}
          >
            <p className="text-foreground font-semibold text-[14px]">{email}</p>
          </div>

          <div
            className="rounded-2xl p-4 w-full max-w-xs mb-8"
            style={{ background: 'oklch(0.17 0.03 240)', border: '1px solid oklch(1 0 0 / 8%)' }}
          >
            <p className="text-muted-foreground text-[13px] leading-relaxed text-center">
              {isRecovery
                ? 'Clique no link do e-mail para criar uma nova senha. Verifique também sua caixa de spam.'
                : 'Abra o e-mail e clique em "Confirmar conta" para ativar seu acesso. Verifique também a pasta de spam.'
              }
            </p>
          </div>

          <button
            onClick={() => irPara('login')}
            className="w-full max-w-xs py-4 rounded-2xl font-bold text-[15px] text-white active:scale-[0.98] transition-transform"
            style={{ backgroundColor: 'oklch(0.55 0.18 162)' }}
          >
            Já confirmei — Entrar
          </button>

          <button
            onClick={() => irPara(isRecovery ? 'forgot' : 'signup')}
            className="mt-4 text-sm text-muted-foreground"
          >
            Não recebi o e-mail —{' '}
            <span className="text-primary font-semibold">tentar novamente</span>
          </button>
        </div>
      </div>
    )
  }

  // ── Formulários (login / cadastro / forgot) ────────────────────────────────
  const titulos = {
    login: 'Bem-vindo de volta',
    signup: 'Criar sua conta',
    forgot: 'Recuperar senha',
  }
  const subtitulos = {
    login: 'Entre para continuar',
    signup: 'É rápido e gratuito',
    forgot: 'Enviaremos um link para o seu e-mail',
  }

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto bg-background overflow-y-auto">
      {/* Header */}
      <div
        className="px-5 pt-5 pb-6 shrink-0"
        style={{ background: 'linear-gradient(180deg, #0a1628 0%, oklch(0.14 0.03 240) 100%)' }}
      >
        <button
          onClick={() => irPara(tela === 'forgot' ? 'login' : 'welcome')}
          className="flex items-center gap-1.5 text-white/50 hover:text-white/80 transition-colors mb-6"
        >
          <ArrowLeft size={17} />
          <span className="text-sm">Voltar</span>
        </button>

        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(37,99,235,0.3)', border: '1px solid rgba(37,99,235,0.4)' }}
          >
            <span className="text-white font-black text-sm">TC</span>
          </div>
          <div>
            <h1 className="text-xl font-black text-white leading-tight">{titulos[tela as keyof typeof titulos]}</h1>
            <p className="text-white/45 text-[12px]">{subtitulos[tela as keyof typeof subtitulos]}</p>
          </div>
        </div>
      </div>

      {/* Formulário */}
      <div className="flex-1 px-6 py-6">
        {/* Mensagem de erro */}
        {erro && (
          <div className="flex items-center gap-2.5 rounded-2xl px-4 py-3 mb-4 border border-destructive/30 bg-destructive/10">
            <AlertCircle size={16} className="text-destructive shrink-0" />
            <p className="text-sm text-destructive">{erro}</p>
          </div>
        )}

        {/* LOGIN */}
        {tela === 'login' && (
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">E-mail</label>
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full rounded-2xl px-4 py-3.5 text-sm outline-none border transition-colors"
                style={inputStyle()}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Senha</label>
              <InputSenha
                placeholder="••••••••"
                value={senha}
                onChange={setSenha}
                autoComplete="current-password"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => irPara('forgot')}
                className="text-xs text-primary font-medium"
              >
                Esqueci minha senha
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl font-bold text-[15px] text-white mt-2 active:scale-[0.98] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ backgroundColor: 'oklch(0.55 0.18 162)' }}
            >
              {loading ? <><Loader2 size={18} className="animate-spin" /> Entrando...</> : 'Entrar'}
            </button>

            <p className="text-center text-sm text-muted-foreground pt-2">
              Não tem conta?{' '}
              <button type="button" onClick={() => irPara('signup')} className="text-primary font-semibold">
                Criar agora
              </button>
            </p>
          </form>
        )}

        {/* CADASTRO */}
        {tela === 'signup' && (
          <form onSubmit={handleCadastro} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Como você se chama?</label>
              <input
                type="text"
                placeholder="Seu nome"
                value={nome}
                onChange={e => setNome(e.target.value)}
                autoComplete="name"
                className="w-full rounded-2xl px-4 py-3.5 text-sm outline-none border transition-colors"
                style={inputStyle()}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">E-mail</label>
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full rounded-2xl px-4 py-3.5 text-sm outline-none border transition-colors"
                style={inputStyle()}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Senha</label>
              <InputSenha
                placeholder="Mínimo 6 caracteres"
                value={senha}
                onChange={setSenha}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Confirmar senha</label>
              <InputSenha
                placeholder="Repita a senha"
                value={confirmarSenha}
                onChange={setConfirmarSenha}
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl font-bold text-[15px] text-white mt-2 active:scale-[0.98] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ backgroundColor: 'oklch(0.55 0.18 162)' }}
            >
              {loading ? <><Loader2 size={18} className="animate-spin" /> Criando conta...</> : 'Criar conta'}
            </button>

            <p className="text-center text-sm text-muted-foreground pt-2">
              Já tem conta?{' '}
              <button type="button" onClick={() => irPara('login')} className="text-primary font-semibold">
                Entrar
              </button>
            </p>
          </form>
        )}

        {/* RECUPERAR SENHA */}
        {tela === 'forgot' && (
          <form onSubmit={handleRecuperar} className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed mb-2">
              Digite seu e-mail e enviaremos um link para você criar uma nova senha.
            </p>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">E-mail</label>
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full rounded-2xl px-4 py-3.5 text-sm outline-none border transition-colors"
                style={inputStyle()}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl font-bold text-[15px] text-white mt-2 active:scale-[0.98] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ backgroundColor: 'oklch(0.55 0.18 162)' }}
            >
              {loading ? <><Loader2 size={18} className="animate-spin" /> Enviando...</> : 'Enviar link de recuperação'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
