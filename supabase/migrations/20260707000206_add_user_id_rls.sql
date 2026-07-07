-- ─────────────────────────────────────────────────────────────────────────────
-- Adiciona user_id às tabelas gastos, receitas e dividas
-- Habilita RLS e cria políticas de isolamento por usuário
-- ─────────────────────────────────────────────────────────────────────────────

-- ── GASTOS ───────────────────────────────────────────────────────────────────
ALTER TABLE gastos
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gastos_select" ON gastos;
DROP POLICY IF EXISTS "gastos_insert" ON gastos;
DROP POLICY IF EXISTS "gastos_update" ON gastos;
DROP POLICY IF EXISTS "gastos_delete" ON gastos;

CREATE POLICY "gastos_select" ON gastos FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "gastos_insert" ON gastos FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "gastos_update" ON gastos FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "gastos_delete" ON gastos FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ── RECEITAS ─────────────────────────────────────────────────────────────────
ALTER TABLE receitas
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE receitas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "receitas_select" ON receitas;
DROP POLICY IF EXISTS "receitas_insert" ON receitas;
DROP POLICY IF EXISTS "receitas_update" ON receitas;
DROP POLICY IF EXISTS "receitas_delete" ON receitas;

CREATE POLICY "receitas_select" ON receitas FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "receitas_insert" ON receitas FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "receitas_update" ON receitas FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "receitas_delete" ON receitas FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ── DIVIDAS ──────────────────────────────────────────────────────────────────
ALTER TABLE dividas
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE dividas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dividas_select" ON dividas;
DROP POLICY IF EXISTS "dividas_insert" ON dividas;
DROP POLICY IF EXISTS "dividas_update" ON dividas;
DROP POLICY IF EXISTS "dividas_delete" ON dividas;

CREATE POLICY "dividas_select" ON dividas FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "dividas_insert" ON dividas FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "dividas_update" ON dividas FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "dividas_delete" ON dividas FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ── ÍNDICES de performance ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS gastos_user_id_idx ON gastos(user_id);
CREATE INDEX IF NOT EXISTS receitas_user_id_idx ON receitas(user_id);
CREATE INDEX IF NOT EXISTS dividas_user_id_idx ON dividas(user_id);
