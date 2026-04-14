-- =============================================
-- MEU ASSESSOR - Tabelas principais
-- =============================================

-- Tabela de Gastos
CREATE TABLE IF NOT EXISTS gastos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  descricao TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Outros',
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Dívidas
CREATE TABLE IF NOT EXISTS dividas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'outros' CHECK (tipo IN ('cartao', 'emprestimo', 'outros')),
  valor_total NUMERIC(10,2) NOT NULL,
  valor_pago NUMERIC(10,2) NOT NULL DEFAULT 0,
  credor TEXT,
  vencimento DATE,
  parcelado BOOLEAN DEFAULT FALSE,
  parcelas INTEGER,
  parcela_atual INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Receitas
CREATE TABLE IF NOT EXISTS receitas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Outros',
  valor NUMERIC(10,2) NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'recebido' CHECK (tipo IN ('recebido', 'a_receber')),
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE dividas ENABLE ROW LEVEL SECURITY;
ALTER TABLE receitas ENABLE ROW LEVEL SECURITY;

-- Políticas: acesso público (sem autenticação por enquanto)
CREATE POLICY "Acesso publico gastos" ON gastos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso publico dividas" ON dividas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso publico receitas" ON receitas FOR ALL USING (true) WITH CHECK (true);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_gastos_data ON gastos(data DESC);
CREATE INDEX IF NOT EXISTS idx_receitas_data ON receitas(data DESC);
CREATE INDEX IF NOT EXISTS idx_dividas_created ON dividas(created_at DESC);
