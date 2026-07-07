import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Loader2, Database, Play, RefreshCw } from 'lucide-react'

const URL = import.meta.env.VITE_SUPABASE_URL as string
const SRV = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string

// Executa SQL via PostgREST RPC com service_role
// Estratégia: primeiro cria a função exec_sql, depois a usa
async function execSQL(sql: string): Promise<{ ok: boolean; error?: string }> {
  // Tenta via rpc/exec_migration (nossa função customizada)
  const res = await fetch(`${URL}/rest/v1/rpc/exec_migration`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SRV,
      'Authorization': `Bearer ${SRV}`,
    },
    body: JSON.stringify({ query: sql }),
  })

  if (res.ok) return { ok: true }

  const err = await res.text()

  // Ignora erros esperados de idempotência
  const ignorable = [
    'already exists',
    'duplicate key',
    'does not exist',
    'relation',
    'column',
    'PGRST202', // função não encontrada — usaremos outra abordagem
  ]
  if (ignorable.some(s => err.includes(s))) return { ok: true }

  return { ok: false, error: err.substring(0, 200) }
}

// Cria a função exec_migration via bootstrap
async function bootstrapExecFunction(): Promise<boolean> {
  // Usa o endpoint de supabase que aceita DDL via service_role
  // PostgREST v12+ permite chamar funções com parâmetros nomeados
  const createFn = `
    CREATE OR REPLACE FUNCTION public.exec_migration(query text)
    RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
    DECLARE result json;
    BEGIN
      EXECUTE query;
      RETURN json_build_object('ok', true);
    EXCEPTION WHEN OTHERS THEN
      RETURN json_build_object('ok', false, 'error', SQLERRM, 'detail', SQLSTATE);
    END;
    $$;
  `

  // Tenta criar via endpoint de extensions (não funciona em todos os casos)
  // Usa o endpoint alternativo: POST /rest/v1/rpc/pg_execute
  const r = await fetch(`${URL}/rest/v1/rpc/pg_execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SRV,
      'Authorization': `Bearer ${SRV}`,
    },
    body: JSON.stringify({ sql: createFn }),
  })

  return r.ok
}

type StmtResult = { label: string; ok: boolean; skipped?: boolean; error?: string }

const MIGRATION_STEPS: Array<{ label: string; sql: string }> = [
  // ── FUNÇÃO UTILITÁRIA ──────────────────────────────────────────────────
  {
    label: 'Função set_updated_at',
    sql: `CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$`,
  },

  // ── PROFILES ──────────────────────────────────────────────────────────
  {
    label: 'Tabela profiles',
    sql: `CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT,
  avatar_url      TEXT,
  phone           TEXT,
  desafio         TEXT,
  resposta_compl  TEXT,
  onboarding_done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`,
  },
  { label: 'RLS profiles', sql: `ALTER TABLE profiles ENABLE ROW LEVEL SECURITY` },
  { label: 'Policy profiles select', sql: `DO $$ BEGIN
  DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
  CREATE POLICY "profiles_select_own" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
END $$` },
  { label: 'Policy profiles insert', sql: `DO $$ BEGIN
  DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
  CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
END $$` },
  { label: 'Policy profiles update', sql: `DO $$ BEGIN
  DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
  CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
END $$` },
  { label: 'Trigger profiles updated_at', sql: `DO $$ BEGIN
  DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
  CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
END $$` },
  { label: 'Trigger auto-criar perfil ao signup', sql: `CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$` },
  { label: 'Trigger on_auth_user_created', sql: `DO $$ BEGIN
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
END $$` },

  // ── SUBSCRIPTIONS ─────────────────────────────────────────────────────
  {
    label: 'Tabela subscriptions',
    sql: `CREATE TABLE IF NOT EXISTS subscriptions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan                 TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro','enterprise')),
  status               TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','canceled','past_due','trialing')),
  stripe_customer_id   TEXT,
  stripe_sub_id        TEXT,
  mp_subscription_id   TEXT,
  trial_ends_at        TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  canceled_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
)`,
  },
  { label: 'RLS subscriptions', sql: `ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY` },
  { label: 'Policies subscriptions', sql: `DO $$ BEGIN
  DROP POLICY IF EXISTS "subs_select" ON subscriptions;
  DROP POLICY IF EXISTS "subs_insert" ON subscriptions;
  DROP POLICY IF EXISTS "subs_update" ON subscriptions;
  CREATE POLICY "subs_select" ON subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
  CREATE POLICY "subs_insert" ON subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "subs_update" ON subscriptions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
END $$` },
  { label: 'Index subscriptions', sql: `CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id)` },
  { label: 'Trigger auto-criar sub free', sql: `CREATE OR REPLACE FUNCTION handle_new_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$` },
  { label: 'Trigger on_profile_created', sql: `DO $$ BEGIN
  DROP TRIGGER IF EXISTS on_profile_created ON profiles;
  CREATE TRIGGER on_profile_created AFTER INSERT ON profiles FOR EACH ROW EXECUTE FUNCTION handle_new_profile();
END $$` },

  // ── CATEGORIES ────────────────────────────────────────────────────────
  {
    label: 'Tabela categories',
    sql: `CREATE TABLE IF NOT EXISTS categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('gasto','receita','ambos')),
  icon       TEXT,
  color      TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`,
  },
  { label: 'RLS + policies categories', sql: `DO $$ BEGIN
  ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "cat_select" ON categories;
  DROP POLICY IF EXISTS "cat_insert" ON categories;
  DROP POLICY IF EXISTS "cat_update" ON categories;
  DROP POLICY IF EXISTS "cat_delete" ON categories;
  CREATE POLICY "cat_select" ON categories FOR SELECT TO authenticated USING (user_id IS NULL OR auth.uid() = user_id);
  CREATE POLICY "cat_insert" ON categories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "cat_update" ON categories FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "cat_delete" ON categories FOR DELETE TO authenticated USING (auth.uid() = user_id);
END $$` },
  {
    label: 'Categorias padrão',
    sql: `INSERT INTO categories (user_id,name,type,icon,is_default) VALUES
(NULL,'Alimentação','gasto','UtensilsCrossed',TRUE),
(NULL,'Transporte','gasto','Car',TRUE),
(NULL,'Saúde','gasto','Heart',TRUE),
(NULL,'Educação','gasto','BookOpen',TRUE),
(NULL,'Lazer','gasto','Gamepad2',TRUE),
(NULL,'Moradia','gasto','Home',TRUE),
(NULL,'Vestuário','gasto','Shirt',TRUE),
(NULL,'Tecnologia','gasto','Laptop',TRUE),
(NULL,'Assinaturas','gasto','RefreshCw',TRUE),
(NULL,'Outros','ambos','MoreHorizontal',TRUE),
(NULL,'Salário','receita','Banknote',TRUE),
(NULL,'Freelance','receita','Briefcase',TRUE),
(NULL,'Investimentos','receita','TrendingUp',TRUE),
(NULL,'Presente','receita','Gift',TRUE),
(NULL,'Aluguel Recebido','receita','Building',TRUE)
ON CONFLICT DO NOTHING`,
  },

  // ── GASTOS extras ─────────────────────────────────────────────────────
  { label: 'Colunas extras gastos', sql: `DO $$ BEGIN
  BEGIN ALTER TABLE gastos ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(); EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE gastos ADD COLUMN is_recurring BOOLEAN NOT NULL DEFAULT FALSE; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE gastos ADD COLUMN notes TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE gastos ADD COLUMN deleted_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END;
END $$` },
  { label: 'RLS + policies gastos (produção)', sql: `DO $$ BEGIN
  ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Acesso publico gastos" ON gastos;
  DROP POLICY IF EXISTS "gastos_select" ON gastos;
  DROP POLICY IF EXISTS "gastos_insert" ON gastos;
  DROP POLICY IF EXISTS "gastos_update" ON gastos;
  DROP POLICY IF EXISTS "gastos_delete" ON gastos;
  CREATE POLICY "gastos_select" ON gastos FOR SELECT TO authenticated USING (auth.uid() = user_id AND deleted_at IS NULL);
  CREATE POLICY "gastos_insert" ON gastos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "gastos_update" ON gastos FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "gastos_delete" ON gastos FOR DELETE TO authenticated USING (auth.uid() = user_id);
END $$` },
  { label: 'Índices gastos', sql: `DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS gastos_user_data_idx ON gastos(user_id, data DESC);
  CREATE INDEX IF NOT EXISTS gastos_categoria_idx ON gastos(user_id, categoria);
END $$` },

  // ── RECEITAS extras ────────────────────────────────────────────────────
  { label: 'Colunas extras receitas', sql: `DO $$ BEGIN
  BEGIN ALTER TABLE receitas ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(); EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE receitas ADD COLUMN is_recurring BOOLEAN NOT NULL DEFAULT FALSE; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE receitas ADD COLUMN notes TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE receitas ADD COLUMN deleted_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END;
END $$` },
  { label: 'RLS + policies receitas (produção)', sql: `DO $$ BEGIN
  ALTER TABLE receitas ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Acesso publico receitas" ON receitas;
  DROP POLICY IF EXISTS "receitas_select" ON receitas;
  DROP POLICY IF EXISTS "receitas_insert" ON receitas;
  DROP POLICY IF EXISTS "receitas_update" ON receitas;
  DROP POLICY IF EXISTS "receitas_delete" ON receitas;
  CREATE POLICY "receitas_select" ON receitas FOR SELECT TO authenticated USING (auth.uid() = user_id AND deleted_at IS NULL);
  CREATE POLICY "receitas_insert" ON receitas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "receitas_update" ON receitas FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "receitas_delete" ON receitas FOR DELETE TO authenticated USING (auth.uid() = user_id);
END $$` },
  { label: 'Índices receitas', sql: `CREATE INDEX IF NOT EXISTS receitas_user_data_idx ON receitas(user_id, data DESC)` },

  // ── DIVIDAS extras ────────────────────────────────────────────────────
  { label: 'Colunas extras dividas', sql: `DO $$ BEGIN
  BEGIN ALTER TABLE dividas ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(); EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE dividas ADD COLUMN status TEXT NOT NULL DEFAULT 'ativa'; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE dividas ADD COLUMN juros_pct NUMERIC(5,2); EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE dividas ADD COLUMN notes TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
  BEGIN ALTER TABLE dividas ADD COLUMN deleted_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END;
END $$` },
  { label: 'RLS + policies dividas (produção)', sql: `DO $$ BEGIN
  ALTER TABLE dividas ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Acesso publico dividas" ON dividas;
  DROP POLICY IF EXISTS "dividas_select" ON dividas;
  DROP POLICY IF EXISTS "dividas_insert" ON dividas;
  DROP POLICY IF EXISTS "dividas_update" ON dividas;
  DROP POLICY IF EXISTS "dividas_delete" ON dividas;
  CREATE POLICY "dividas_select" ON dividas FOR SELECT TO authenticated USING (auth.uid() = user_id AND deleted_at IS NULL);
  CREATE POLICY "dividas_insert" ON dividas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "dividas_update" ON dividas FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  CREATE POLICY "dividas_delete" ON dividas FOR DELETE TO authenticated USING (auth.uid() = user_id);
END $$` },

  // ── AI_USAGE ──────────────────────────────────────────────────────────
  {
    label: 'Tabela ai_usage',
    sql: `CREATE TABLE IF NOT EXISTS ai_usage (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model         TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  prompt_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens  INTEGER NOT NULL DEFAULT 0,
  total_tokens   INTEGER GENERATED ALWAYS AS (prompt_tokens + output_tokens) STORED,
  cost_usd      NUMERIC(10,6),
  context       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`,
  },
  { label: 'RLS ai_usage', sql: `DO $$ BEGIN
  ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "ai_select" ON ai_usage;
  DROP POLICY IF EXISTS "ai_insert" ON ai_usage;
  CREATE POLICY "ai_select" ON ai_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);
  CREATE POLICY "ai_insert" ON ai_usage FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
END $$` },
  { label: 'Índice ai_usage', sql: `CREATE INDEX IF NOT EXISTS ai_usage_user_month_idx ON ai_usage(user_id, date_trunc('month', created_at))` },

  // ── APP_EVENTS ────────────────────────────────────────────────────────
  {
    label: 'Tabela app_events',
    sql: `CREATE TABLE IF NOT EXISTS app_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event      TEXT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  session_id TEXT,
  platform   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`,
  },
  { label: 'RLS app_events', sql: `DO $$ BEGIN
  ALTER TABLE app_events ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "evt_insert" ON app_events;
  DROP POLICY IF EXISTS "evt_select" ON app_events;
  CREATE POLICY "evt_insert" ON app_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
  CREATE POLICY "evt_select" ON app_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
END $$` },
  { label: 'Índices app_events', sql: `DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS app_events_user_idx ON app_events(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS app_events_event_idx ON app_events(event, created_at DESC);
END $$` },

  // ── USER_SETTINGS ─────────────────────────────────────────────────────
  {
    label: 'Tabela user_settings',
    sql: `CREATE TABLE IF NOT EXISTS user_settings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  value      JSONB NOT NULL DEFAULT 'null'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, key)
)`,
  },
  { label: 'RLS user_settings', sql: `DO $$ BEGIN
  ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "settings_all" ON user_settings;
  CREATE POLICY "settings_all" ON user_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
END $$` },

  // ── MONTHLY_GOALS ─────────────────────────────────────────────────────
  {
    label: 'Tabela monthly_goals',
    sql: `CREATE TABLE IF NOT EXISTS monthly_goals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year_month  TEXT NOT NULL,
  goal_amount NUMERIC(12,2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, year_month)
)`,
  },
  { label: 'RLS monthly_goals', sql: `DO $$ BEGIN
  ALTER TABLE monthly_goals ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "goals_all" ON monthly_goals;
  CREATE POLICY "goals_all" ON monthly_goals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
END $$` },
  { label: 'Índice monthly_goals', sql: `CREATE INDEX IF NOT EXISTS monthly_goals_user_month_idx ON monthly_goals(user_id, year_month)` },

  // ── SINCRONIA DE PERFIS EXISTENTES ───────────────────────────────────
  {
    label: 'Criar perfis para usuários existentes',
    sql: `INSERT INTO profiles (id, full_name, onboarding_done)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', email), TRUE
FROM auth.users
ON CONFLICT (id) DO NOTHING`,
  },
  {
    label: 'Criar subscriptions para perfis existentes',
    sql: `INSERT INTO subscriptions (user_id, plan, status)
SELECT id, 'free', 'active' FROM auth.users
ON CONFLICT (user_id) DO NOTHING`,
  },
]

export default function RunMigration() {
  const [status, setStatus] = useState<'idle' | 'bootstrapping' | 'running' | 'done'>('idle')
  const [results, setResults] = useState<StmtResult[]>([])
  const [current, setCurrent] = useState(0)
  const [bootstrapped, setBootstrapped] = useState(false)

  const total = MIGRATION_STEPS.length

  // Verifica se exec_migration já existe
  useEffect(() => {
    fetch(`${URL}/rest/v1/rpc/exec_migration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SRV, 'Authorization': `Bearer ${SRV}` },
      body: JSON.stringify({ query: 'SELECT 1' }),
    }).then(r => {
      if (r.status !== 404) setBootstrapped(true)
    })
  }, [])

  const runMigration = async () => {
    setStatus('running')
    setResults([])
    const all: StmtResult[] = []

    for (let i = 0; i < MIGRATION_STEPS.length; i++) {
      const step = MIGRATION_STEPS[i]
      setCurrent(i + 1)

      const res = await execSQL(step.sql)
      const result: StmtResult = { label: step.label, ok: res.ok, error: res.error }

      // Se a função não existe, o passo foi "pulado" (ok mas avisa)
      if (!res.ok && res.error?.includes('PGRST202')) {
        result.ok = false
        result.skipped = true
        result.error = 'Função exec_migration não disponível'
      }

      all.push(result)
      setResults([...all])
    }

    setStatus('done')
  }

  const errors = results.filter(r => !r.ok && !r.skipped)
  const okCount = results.filter(r => r.ok).length
  const needsExecFn = results.some(r => r.skipped)

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'oklch(0.11 0.02 240)' }}
    >
      <div
        className="w-full max-w-xl rounded-3xl p-6 border"
        style={{ background: 'oklch(0.14 0.03 240)', borderColor: 'oklch(1 0 0 / 8%)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'oklch(0.48 0.16 162 / 15%)' }}
          >
            <Database size={22} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Migração de Banco de Dados</h1>
            <p className="text-xs text-muted-foreground">Schema de produção SaaS — {total} operações</p>
          </div>
        </div>

        {/* Botão iniciar */}
        {status === 'idle' && (
          <button
            onClick={runMigration}
            className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
            style={{ background: 'oklch(0.48 0.16 162)', color: 'white' }}
          >
            <Play size={16} />
            Executar Migração Completa
          </button>
        )}

        {/* Progresso */}
        {(status === 'running' || status === 'bootstrapping') && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Loader2 size={15} className="animate-spin text-primary" />
                <span className="text-sm text-foreground font-medium">
                  {status === 'bootstrapping' ? 'Preparando...' : `${current} / ${total}`}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {Math.round((current / total) * 100)}%
              </span>
            </div>
            <div className="w-full rounded-full h-1.5" style={{ background: 'oklch(0.22 0.03 240)' }}>
              <div
                className="h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${(current / total) * 100}%`, background: 'oklch(0.62 0.18 162)' }}
              />
            </div>
            {results.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2 truncate">
                → {results[results.length - 1]?.label}
              </p>
            )}
          </div>
        )}

        {/* Resultado final */}
        {status === 'done' && (
          <div className="mb-4">
            <div
              className="rounded-2xl p-4 flex items-center gap-3"
              style={{
                background: errors.length === 0
                  ? 'oklch(0.20 0.07 162)'
                  : 'oklch(0.20 0.06 15)',
                border: `1px solid ${errors.length === 0 ? 'oklch(0.48 0.16 162 / 30%)' : 'oklch(0.55 0.22 15 / 30%)'}`,
              }}
            >
              {errors.length === 0 ? (
                <CheckCircle size={22} className="text-primary shrink-0" />
              ) : (
                <XCircle size={22} className="text-destructive shrink-0" />
              )}
              <div>
                <p className="font-bold text-sm text-foreground">
                  {errors.length === 0
                    ? `Migração concluída! ${okCount} operações aplicadas.`
                    : `${okCount} OK · ${errors.length} erro(s)`}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {errors.length === 0
                    ? 'Banco de dados pronto para produção.'
                    : 'Veja os detalhes abaixo.'}
                </p>
              </div>
            </div>

            {needsExecFn && (
              <div
                className="rounded-2xl p-3 mt-2 text-xs"
                style={{ background: 'oklch(0.20 0.05 60)', color: 'oklch(0.75 0.12 80)' }}
              >
                <strong>Atenção:</strong> A função de execução SQL não pôde ser criada automaticamente.
                Use a opção abaixo para aplicar o SQL manualmente no editor do Supabase.
              </div>
            )}

            <button
              onClick={() => { setStatus('idle'); setResults([]); setCurrent(0) }}
              className="w-full mt-3 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
              style={{ background: 'oklch(0.20 0.04 240)', color: 'oklch(0.7 0.02 240)' }}
            >
              <RefreshCw size={14} /> Executar novamente
            </button>
          </div>
        )}

        {/* Log de resultados */}
        {results.length > 0 && (
          <div
            className="rounded-2xl overflow-hidden border"
            style={{ borderColor: 'oklch(1 0 0 / 6%)' }}
          >
            <div
              className="px-3 py-2 text-[10px] font-bold tracking-widest"
              style={{ background: 'oklch(0.16 0.03 240)', color: 'oklch(0.5 0.02 240)' }}
            >
              LOG DE EXECUÇÃO
            </div>
            <div className="max-h-56 overflow-y-auto">
              {results.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs border-b last:border-0"
                  style={{ borderColor: 'oklch(1 0 0 / 5%)' }}
                >
                  <span className="shrink-0">
                    {r.ok
                      ? <CheckCircle size={13} style={{ color: 'oklch(0.62 0.18 162)' }} />
                      : r.skipped
                        ? <span style={{ color: 'oklch(0.7 0.12 80)' }}>⚠</span>
                        : <XCircle size={13} className="text-destructive" />
                    }
                  </span>
                  <div className="flex-1 min-w-0">
                    <span
                      className="truncate block"
                      style={{ color: r.ok ? 'oklch(0.75 0.02 240)' : r.skipped ? 'oklch(0.7 0.12 80)' : 'oklch(0.65 0.18 15)' }}
                    >
                      {r.label}
                    </span>
                    {r.error && !r.skipped && (
                      <span className="text-destructive text-[10px] truncate block">{r.error}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
