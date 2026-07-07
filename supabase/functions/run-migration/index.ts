import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  // ── Schema de Produção SaaS ────────────────────────────────────────────────
  const statements = [
    // Função utilitária updated_at
    `CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$`,

    // ── 1. PERFIS ──────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS profiles (
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
    `ALTER TABLE profiles ENABLE ROW LEVEL SECURITY`,
    `DROP POLICY IF EXISTS "profiles_select_own" ON profiles`,
    `CREATE POLICY "profiles_select_own" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id)`,
    `DROP POLICY IF EXISTS "profiles_insert_own" ON profiles`,
    `CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id)`,
    `DROP POLICY IF EXISTS "profiles_update_own" ON profiles`,
    `CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id)`,
    `DROP TRIGGER IF EXISTS profiles_updated_at ON profiles`,
    `CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at()`,

    // Trigger: cria perfil ao cadastrar
    `CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN INSERT INTO public.profiles (id, full_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)) ON CONFLICT (id) DO NOTHING; RETURN NEW; END; $$`,
    `DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users`,
    `CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user()`,

    // ── 2. ASSINATURAS ─────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS subscriptions (
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
    `ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY`,
    `DROP POLICY IF EXISTS "subscriptions_select_own" ON subscriptions`,
    `CREATE POLICY "subscriptions_select_own" ON subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id)`,
    `DROP POLICY IF EXISTS "subscriptions_insert_own" ON subscriptions`,
    `CREATE POLICY "subscriptions_insert_own" ON subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)`,
    `DROP POLICY IF EXISTS "subscriptions_update_own" ON subscriptions`,
    `CREATE POLICY "subscriptions_update_own" ON subscriptions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`,
    `DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions`,
    `CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at()`,
    `CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id)`,
    `CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status)`,

    // Trigger: cria sub free ao criar perfil
    `CREATE OR REPLACE FUNCTION handle_new_profile() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN INSERT INTO public.subscriptions (user_id, plan, status) VALUES (NEW.id, 'free', 'active') ON CONFLICT (user_id) DO NOTHING; RETURN NEW; END; $$`,
    `DROP TRIGGER IF EXISTS on_profile_created ON profiles`,
    `CREATE TRIGGER on_profile_created AFTER INSERT ON profiles FOR EACH ROW EXECUTE FUNCTION handle_new_profile()`,

    // ── 3. CATEGORIAS ──────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS categories (
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
    `ALTER TABLE categories ENABLE ROW LEVEL SECURITY`,
    `DROP POLICY IF EXISTS "categories_select" ON categories`,
    `CREATE POLICY "categories_select" ON categories FOR SELECT TO authenticated USING (user_id IS NULL OR auth.uid() = user_id)`,
    `DROP POLICY IF EXISTS "categories_insert_own" ON categories`,
    `CREATE POLICY "categories_insert_own" ON categories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)`,
    `DROP POLICY IF EXISTS "categories_update_own" ON categories`,
    `CREATE POLICY "categories_update_own" ON categories FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`,
    `DROP POLICY IF EXISTS "categories_delete_own" ON categories`,
    `CREATE POLICY "categories_delete_own" ON categories FOR DELETE TO authenticated USING (auth.uid() = user_id)`,
    `DROP TRIGGER IF EXISTS categories_updated_at ON categories`,
    `CREATE TRIGGER categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION set_updated_at()`,
    `CREATE INDEX IF NOT EXISTS categories_user_id_idx ON categories(user_id)`,
    `CREATE INDEX IF NOT EXISTS categories_type_idx ON categories(type)`,

    // Categorias padrão
    `INSERT INTO categories (user_id,name,type,icon,is_default) VALUES (NULL,'Alimentação','gasto','UtensilsCrossed',TRUE),(NULL,'Transporte','gasto','Car',TRUE),(NULL,'Saúde','gasto','Heart',TRUE),(NULL,'Educação','gasto','BookOpen',TRUE),(NULL,'Lazer','gasto','Gamepad2',TRUE),(NULL,'Moradia','gasto','Home',TRUE),(NULL,'Vestuário','gasto','Shirt',TRUE),(NULL,'Tecnologia','gasto','Laptop',TRUE),(NULL,'Assinaturas','gasto','RefreshCw',TRUE),(NULL,'Outros','ambos','MoreHorizontal',TRUE),(NULL,'Salário','receita','Banknote',TRUE),(NULL,'Freelance','receita','Briefcase',TRUE),(NULL,'Investimentos','receita','TrendingUp',TRUE),(NULL,'Presente','receita','Gift',TRUE),(NULL,'Aluguel Recebido','receita','Building',TRUE) ON CONFLICT DO NOTHING`,

    // ── 4. GASTOS — colunas extras ─────────────────────────────────────────
    `ALTER TABLE gastos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
    `ALTER TABLE gastos ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE gastos ADD COLUMN IF NOT EXISTS notes TEXT`,
    `ALTER TABLE gastos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
    `ALTER TABLE gastos ENABLE ROW LEVEL SECURITY`,
    `DROP POLICY IF EXISTS "Acesso publico gastos" ON gastos`,
    `DROP POLICY IF EXISTS "gastos_select" ON gastos`,
    `DROP POLICY IF EXISTS "gastos_insert" ON gastos`,
    `DROP POLICY IF EXISTS "gastos_update" ON gastos`,
    `DROP POLICY IF EXISTS "gastos_delete" ON gastos`,
    `CREATE POLICY "gastos_select" ON gastos FOR SELECT TO authenticated USING (auth.uid() = user_id AND deleted_at IS NULL)`,
    `CREATE POLICY "gastos_insert" ON gastos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)`,
    `CREATE POLICY "gastos_update" ON gastos FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`,
    `CREATE POLICY "gastos_delete" ON gastos FOR DELETE TO authenticated USING (auth.uid() = user_id)`,
    `DROP TRIGGER IF EXISTS gastos_updated_at ON gastos`,
    `CREATE TRIGGER gastos_updated_at BEFORE UPDATE ON gastos FOR EACH ROW EXECUTE FUNCTION set_updated_at()`,
    `CREATE INDEX IF NOT EXISTS gastos_user_id_idx ON gastos(user_id)`,
    `CREATE INDEX IF NOT EXISTS gastos_user_data_idx ON gastos(user_id, data DESC)`,
    `CREATE INDEX IF NOT EXISTS gastos_categoria_idx ON gastos(user_id, categoria)`,

    // ── 5. RECEITAS — colunas extras ───────────────────────────────────────
    `ALTER TABLE receitas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
    `ALTER TABLE receitas ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE receitas ADD COLUMN IF NOT EXISTS notes TEXT`,
    `ALTER TABLE receitas ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
    `ALTER TABLE receitas ENABLE ROW LEVEL SECURITY`,
    `DROP POLICY IF EXISTS "Acesso publico receitas" ON receitas`,
    `DROP POLICY IF EXISTS "receitas_select" ON receitas`,
    `DROP POLICY IF EXISTS "receitas_insert" ON receitas`,
    `DROP POLICY IF EXISTS "receitas_update" ON receitas`,
    `DROP POLICY IF EXISTS "receitas_delete" ON receitas`,
    `CREATE POLICY "receitas_select" ON receitas FOR SELECT TO authenticated USING (auth.uid() = user_id AND deleted_at IS NULL)`,
    `CREATE POLICY "receitas_insert" ON receitas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)`,
    `CREATE POLICY "receitas_update" ON receitas FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`,
    `CREATE POLICY "receitas_delete" ON receitas FOR DELETE TO authenticated USING (auth.uid() = user_id)`,
    `DROP TRIGGER IF EXISTS receitas_updated_at ON receitas`,
    `CREATE TRIGGER receitas_updated_at BEFORE UPDATE ON receitas FOR EACH ROW EXECUTE FUNCTION set_updated_at()`,
    `CREATE INDEX IF NOT EXISTS receitas_user_id_idx ON receitas(user_id)`,
    `CREATE INDEX IF NOT EXISTS receitas_user_data_idx ON receitas(user_id, data DESC)`,
    `CREATE INDEX IF NOT EXISTS receitas_categoria_idx ON receitas(user_id, categoria)`,

    // ── 6. DÍVIDAS — colunas extras ────────────────────────────────────────
    `ALTER TABLE dividas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
    `ALTER TABLE dividas ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','quitada','negociada'))`,
    `ALTER TABLE dividas ADD COLUMN IF NOT EXISTS juros_pct NUMERIC(5,2)`,
    `ALTER TABLE dividas ADD COLUMN IF NOT EXISTS notes TEXT`,
    `ALTER TABLE dividas ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
    `ALTER TABLE dividas ENABLE ROW LEVEL SECURITY`,
    `DROP POLICY IF EXISTS "Acesso publico dividas" ON dividas`,
    `DROP POLICY IF EXISTS "dividas_select" ON dividas`,
    `DROP POLICY IF EXISTS "dividas_insert" ON dividas`,
    `DROP POLICY IF EXISTS "dividas_update" ON dividas`,
    `DROP POLICY IF EXISTS "dividas_delete" ON dividas`,
    `CREATE POLICY "dividas_select" ON dividas FOR SELECT TO authenticated USING (auth.uid() = user_id AND deleted_at IS NULL)`,
    `CREATE POLICY "dividas_insert" ON dividas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)`,
    `CREATE POLICY "dividas_update" ON dividas FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`,
    `CREATE POLICY "dividas_delete" ON dividas FOR DELETE TO authenticated USING (auth.uid() = user_id)`,
    `DROP TRIGGER IF EXISTS dividas_updated_at ON dividas`,
    `CREATE TRIGGER dividas_updated_at BEFORE UPDATE ON dividas FOR EACH ROW EXECUTE FUNCTION set_updated_at()`,
    `CREATE INDEX IF NOT EXISTS dividas_user_id_idx ON dividas(user_id)`,
    `CREATE INDEX IF NOT EXISTS dividas_status_idx ON dividas(user_id, status)`,

    // ── 7. USO DE IA ───────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS ai_usage (
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
    `ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY`,
    `DROP POLICY IF EXISTS "ai_usage_select_own" ON ai_usage`,
    `CREATE POLICY "ai_usage_select_own" ON ai_usage FOR SELECT TO authenticated USING (auth.uid() = user_id)`,
    `DROP POLICY IF EXISTS "ai_usage_insert_own" ON ai_usage`,
    `CREATE POLICY "ai_usage_insert_own" ON ai_usage FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)`,
    `CREATE INDEX IF NOT EXISTS ai_usage_user_month_idx ON ai_usage(user_id, date_trunc('month', created_at))`,
    `CREATE INDEX IF NOT EXISTS ai_usage_created_idx ON ai_usage(created_at DESC)`,

    // ── 8. EVENTOS / MÉTRICAS ──────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS app_events (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      event      TEXT NOT NULL,
      properties JSONB NOT NULL DEFAULT '{}'::jsonb,
      session_id TEXT,
      platform   TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `ALTER TABLE app_events ENABLE ROW LEVEL SECURITY`,
    `DROP POLICY IF EXISTS "app_events_insert_own" ON app_events`,
    `CREATE POLICY "app_events_insert_own" ON app_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL)`,
    `DROP POLICY IF EXISTS "app_events_select_own" ON app_events`,
    `CREATE POLICY "app_events_select_own" ON app_events FOR SELECT TO authenticated USING (auth.uid() = user_id)`,
    `CREATE INDEX IF NOT EXISTS app_events_user_idx ON app_events(user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS app_events_event_idx ON app_events(event, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS app_events_created_idx ON app_events(created_at DESC)`,

    // ── 9. CONFIGURAÇÕES DO USUÁRIO ────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS user_settings (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      key        TEXT NOT NULL,
      value      JSONB NOT NULL DEFAULT 'null'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, key)
    )`,
    `ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY`,
    `DROP POLICY IF EXISTS "user_settings_all_own" ON user_settings`,
    `CREATE POLICY "user_settings_all_own" ON user_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`,
    `DROP TRIGGER IF EXISTS user_settings_updated_at ON user_settings`,
    `CREATE TRIGGER user_settings_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at()`,
    `CREATE INDEX IF NOT EXISTS user_settings_user_key_idx ON user_settings(user_id, key)`,

    // ── 10. META MENSAL ────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS monthly_goals (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      year_month  TEXT NOT NULL,
      goal_amount NUMERIC(12,2) NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, year_month)
    )`,
    `ALTER TABLE monthly_goals ENABLE ROW LEVEL SECURITY`,
    `DROP POLICY IF EXISTS "monthly_goals_all_own" ON monthly_goals`,
    `CREATE POLICY "monthly_goals_all_own" ON monthly_goals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`,
    `DROP TRIGGER IF EXISTS monthly_goals_updated_at ON monthly_goals`,
    `CREATE TRIGGER monthly_goals_updated_at BEFORE UPDATE ON monthly_goals FOR EACH ROW EXECUTE FUNCTION set_updated_at()`,
    `CREATE INDEX IF NOT EXISTS monthly_goals_user_month_idx ON monthly_goals(user_id, year_month)`,
  ];

  const results: { sql: string; ok: boolean; error?: string }[] = [];

  for (const sql of statements) {
    // Usa o endpoint interno do Supabase que Edge Functions têm acesso exclusivo
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ sql }),
    });

    if (!res.ok) {
      const err = await res.text();
      results.push({ sql: sql.substring(0, 60), ok: false, error: err.substring(0, 150) });
    } else {
      results.push({ sql: sql.substring(0, 60), ok: true });
    }
  }

  const allOk = results.every(r => r.ok);

  return new Response(JSON.stringify({ done: allOk, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
