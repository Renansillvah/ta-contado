import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Admin client usa service role — tem permissão para DDL via rpc
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Executa cada statement via pg_catalog trick: INSERT INTO _dummy SELECT * ...
    // Na verdade usamos o endpoint /sql da API interna do Supabase
    const statements = [
      `ALTER TABLE gastos ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE`,
      `ALTER TABLE gastos ENABLE ROW LEVEL SECURITY`,
      `DROP POLICY IF EXISTS "gastos_select" ON gastos`,
      `DROP POLICY IF EXISTS "gastos_insert" ON gastos`,
      `DROP POLICY IF EXISTS "gastos_update" ON gastos`,
      `DROP POLICY IF EXISTS "gastos_delete" ON gastos`,
      `CREATE POLICY "gastos_select" ON gastos FOR SELECT TO authenticated USING (auth.uid() = user_id)`,
      `CREATE POLICY "gastos_insert" ON gastos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)`,
      `CREATE POLICY "gastos_update" ON gastos FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`,
      `CREATE POLICY "gastos_delete" ON gastos FOR DELETE TO authenticated USING (auth.uid() = user_id)`,
      `ALTER TABLE receitas ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE`,
      `ALTER TABLE receitas ENABLE ROW LEVEL SECURITY`,
      `DROP POLICY IF EXISTS "receitas_select" ON receitas`,
      `DROP POLICY IF EXISTS "receitas_insert" ON receitas`,
      `DROP POLICY IF EXISTS "receitas_update" ON receitas`,
      `DROP POLICY IF EXISTS "receitas_delete" ON receitas`,
      `CREATE POLICY "receitas_select" ON receitas FOR SELECT TO authenticated USING (auth.uid() = user_id)`,
      `CREATE POLICY "receitas_insert" ON receitas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)`,
      `CREATE POLICY "receitas_update" ON receitas FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`,
      `CREATE POLICY "receitas_delete" ON receitas FOR DELETE TO authenticated USING (auth.uid() = user_id)`,
      `ALTER TABLE dividas ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE`,
      `ALTER TABLE dividas ENABLE ROW LEVEL SECURITY`,
      `DROP POLICY IF EXISTS "dividas_select" ON dividas`,
      `DROP POLICY IF EXISTS "dividas_insert" ON dividas`,
      `DROP POLICY IF EXISTS "dividas_update" ON dividas`,
      `DROP POLICY IF EXISTS "dividas_delete" ON dividas`,
      `CREATE POLICY "dividas_select" ON dividas FOR SELECT TO authenticated USING (auth.uid() = user_id)`,
      `CREATE POLICY "dividas_insert" ON dividas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)`,
      `CREATE POLICY "dividas_update" ON dividas FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`,
      `CREATE POLICY "dividas_delete" ON dividas FOR DELETE TO authenticated USING (auth.uid() = user_id)`,
      `CREATE INDEX IF NOT EXISTS gastos_user_id_idx ON gastos(user_id)`,
      `CREATE INDEX IF NOT EXISTS receitas_user_id_idx ON receitas(user_id)`,
      `CREATE INDEX IF NOT EXISTS dividas_user_id_idx ON dividas(user_id)`,
    ];

    const results: { sql: string; ok: boolean; msg?: string }[] = [];

    for (const sql of statements) {
      // Usa o endpoint interno /pg/query que está disponível para service role
      const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/pg/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ query: sql }),
      });
      const txt = await res.text();
      results.push({ sql: sql.substring(0, 60), ok: res.ok, msg: txt.substring(0, 100) });
    }

    return new Response(JSON.stringify({ done: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
