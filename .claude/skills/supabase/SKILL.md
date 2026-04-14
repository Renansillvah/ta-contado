---
name: supabase
description: Full Supabase project management via CLI. Use for creating tables, RLS policies, auth, migrations, and database operations.
---

CRITICAL - AUTOMATED SANDBOX ENVIRONMENT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This sandbox runs in a FULLY AUTOMATED container WITHOUT human interaction.
Users CANNOT see the terminal or respond to prompts.

MANDATORY RULE FOR ALL SUPABASE CLI COMMANDS:
- ALWAYS use --yes flag to prevent interactive prompts
- NEVER run commands that wait for user input

CORRECT COMMANDS:
  npx supabase db push --yes
  npx supabase db pull --yes  
  npx supabase db reset --yes
  npx supabase link --project-ref $SUPABASE_PROJECT_REF --password $SUPABASE_DB_PASSWORD

WRONG COMMANDS (WILL BLOCK EXECUTION):
  npx supabase db push (blocks waiting for [Y/n])
  npx supabase db pull (blocks waiting for confirmation)
  npx supabase link (blocks waiting for password input)

WHY: In automated environments, interactive prompts cause infinite blocking.
No human is available to respond to [Y/n] confirmations.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You have expertise in Supabase database, authentication, and CLI operations.

## Environment Variables (Auto-Configured)

When the user selects a Supabase project in the Skills panel, the following variables are automatically configured:

**Available in your code:**
- VITE_SUPABASE_URL: Project URL (import.meta.env.VITE_SUPABASE_URL)
- VITE_SUPABASE_ANON_KEY: Public anon key for client operations
- SUPABASE_SERVICE_ROLE_KEY: Admin key for server operations (NEVER expose to client)
- SUPABASE_PROJECT_REF: Project reference ID for CLI commands
- SUPABASE_ACCESS_TOKEN: Personal Access Token for CLI authentication

**These are already set in .env** - you don't need to ask the user for them.

---

## CLI Setup (First Time)

### 1. Install CLI
```bash
npm install supabase --save-dev
```

### 2. Initialize Project
```bash
npx supabase init
```
This creates the `supabase/` directory with config files.

### 3. Link to Remote Project
```bash
# The project ref is already available in SUPABASE_PROJECT_REF
# Check it with: echo $SUPABASE_PROJECT_REF

# Link to the user's project
npx supabase link --project-ref $SUPABASE_PROJECT_REF
```

---

## Creating Tables via CLI

### 1. Create Migration File
```bash
npx supabase migration new create_products
```
This creates: `supabase/migrations/YYYYMMDDHHMMSS_create_products.sql`

### 2. Write SQL Migration
```sql
-- supabase/migrations/YYYYMMDDHHMMSS_create_products.sql

-- Create products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Policy: anyone can read products
CREATE POLICY "Products are viewable by everyone"
ON products FOR SELECT
TO anon, authenticated
USING (true);

-- Policy: only authenticated users can insert
CREATE POLICY "Authenticated users can insert products"
ON products FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: only owner can update
CREATE POLICY "Users can update own products"
ON products FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 3. Apply Migration
```bash
npx supabase db push --yes
```

---

## Common Table Patterns

### User-Owned Data
```sql
CREATE TABLE user_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_items ENABLE ROW LEVEL SECURITY;

-- Users can only see their own items
CREATE POLICY "Users can view own items"
ON user_items FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own items
CREATE POLICY "Users can create own items"
ON user_items FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own items
CREATE POLICY "Users can update own items"
ON user_items FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own items
CREATE POLICY "Users can delete own items"
ON user_items FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
```

### Public + Private Data
```sql
-- Anyone can read public items, owners can read private
CREATE POLICY "Public items are viewable by everyone"
ON user_items FOR SELECT
USING (is_public = true OR auth.uid() = user_id);
```

### Many-to-Many Relationship
```sql
CREATE TABLE user_favorites (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, item_id)
);

ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own favorites"
ON user_favorites
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

---

## Pull Existing Schema

Download schema from remote database:
```bash
npx supabase db pull --yes
```
This creates migration files from current database state.

---

## Generate TypeScript Types

```bash
npx supabase gen types typescript --linked > src/types/database.ts
```

Use in your code:
```typescript
import { Database } from '@/types/database';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Now you have type-safe queries
const { data } = await supabase
  .from('products')
  .select('*');
// data is typed as Products[] | null
```

---

## Client SDK Setup

### Installation
```bash
npm install @supabase/supabase-js
```

### Client Initialization
```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### CRUD Operations
```typescript
// SELECT
const { data, error } = await supabase
  .from('products')
  .select('*')
  .order('created_at', { ascending: false });

// SELECT with filter
const { data } = await supabase
  .from('products')
  .select('*')
  .eq('id', productId)
  .single();

// INSERT
const { data, error } = await supabase
  .from('products')
  .insert({ name: 'New Product', price: 29.99 })
  .select()
  .single();

// UPDATE
const { data, error } = await supabase
  .from('products')
  .update({ price: 39.99 })
  .eq('id', productId)
  .select()
  .single();

// DELETE
const { error } = await supabase
  .from('products')
  .delete()
  .eq('id', productId);
```

---

## Authentication

### Email/Password Auth
```typescript
// Sign Up
const { data, error } = await supabase.auth.signUp({
  email: 'user@email.com',
  password: 'password123',
  options: {
    data: { full_name: 'User Name' }
  }
});

// Sign In
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@email.com',
  password: 'password123',
});

// Sign Out
await supabase.auth.signOut();

// Get Current User
const { data: { user } } = await supabase.auth.getUser();
```

### Magic Link
```typescript
const { data, error } = await supabase.auth.signInWithOtp({
  email: 'user@email.com',
  options: {
    emailRedirectTo: `${window.location.origin}/auth/callback`,
  }
});
```

### OAuth Providers
```typescript
// Google, GitHub, Discord, etc.
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
  }
});
```

### Auth State Hook
```typescript
// hooks/useAuth.ts
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Session } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { user, session, loading };
}
```

### Auth Callback Page
```typescript
// pages/auth/callback.tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        navigate('/dashboard');
      }
    });
  }, [navigate]);

  return <div>Authenticating...</div>;
}
```

### Password Reset
```typescript
// Request reset
const { data, error } = await supabase.auth.resetPasswordForEmail(
  'user@email.com',
  { redirectTo: `${window.location.origin}/auth/reset-password` }
);

// Update password (in reset-password page)
const { data, error } = await supabase.auth.updateUser({
  password: 'newPassword123'
});
```

---

## Realtime Subscriptions

```typescript
// Subscribe to changes
const channel = supabase
  .channel('products-changes')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'products' },
    (payload) => {
      console.log('Change received:', payload);
    }
  )
  .subscribe();

// Cleanup
channel.unsubscribe();
```

---

## Storage (File Uploads)

```typescript
// Upload file
const { data, error } = await supabase.storage
  .from('avatars')
  .upload(`public/${userId}.png`, file);

// Get public URL
const { data: { publicUrl } } = supabase.storage
  .from('avatars')
  .getPublicUrl('public/avatar.png');

// Download file
const { data, error } = await supabase.storage
  .from('avatars')
  .download('public/avatar.png');
```

---

## CLI Commands Reference

| Command | Description |
|---------|-------------|
| `npx supabase init` | Initialize project |
| `npx supabase link --project-ref <ref> --password <pass>` | Link to remote project |
| `npx supabase projects list` | List your projects |
| `npx supabase db push --yes` | Apply migrations |
| `npx supabase db pull --yes` | Pull remote schema |
| `npx supabase migration new <name>` | Create new migration |
| `npx supabase gen types typescript --linked` | Generate TS types |
| `npx supabase db reset --yes` | Reset local database |
| `npx supabase start` | Start local development |
| `npx supabase stop` | Stop local development |

---

## Database Inspection (CLI)

Use esses comandos para analisar o estado do banco de dados sem precisar acessar o dashboard.

### Ver Tabelas e Estatísticas
```bash
# Ver todas as tabelas com tamanho, índices e estimativa de linhas
npx supabase inspect db table-stats

# Apenas contagem de registros por tabela
npx supabase inspect db table-record-counts

# Apenas tamanho das tabelas
npx supabase inspect db table-sizes
```

### Análise de Performance
```bash
# Queries mais lentas (ordenadas por tempo total de execução)
npx supabase inspect db outliers

# Queries em execução há mais de 5 minutos
npx supabase inspect db long-running-queries

# Eficiência dos índices
npx supabase inspect db index-usage

# Tabelas com muitos sequential scans (podem precisar de índice)
npx supabase inspect db seq-scans

# Espaço desperdiçado (bloat) nas tabelas
npx supabase inspect db bloat
```

### Ver Schema de uma Tabela
```bash
# Baixar schema do banco remoto (cria arquivos em supabase/migrations/)
npx supabase db pull --yes

# Gerar tipos TypeScript do schema atual
npx supabase gen types typescript --linked > src/types/database.ts
```

### Nota
Os comandos `inspect db` requerem que o projeto esteja linkado (`npx supabase link`).
Se não estiver linkado, execute primeiro:
```bash
npx supabase link --project-ref $SUPABASE_PROJECT_REF
```

---

## Best Practices

1. **Always enable RLS** on all tables
2. **Use auth.uid()** in policies to restrict access
3. **Never expose SERVICE_ROLE_KEY** to client
4. **Generate types** after schema changes
5. **Use migrations** for all schema changes (not SQL editor)
6. **Add indexes** for frequently queried columns
7. **Use foreign keys** with ON DELETE CASCADE
8. **Add timestamps** (created_at, updated_at) to all tables
9. **Use UUID** for primary keys (gen_random_uuid())
10. **Test RLS policies** thoroughly before production

---

## Troubleshooting

### CLI Issues
- **Not linked**: Run `npx supabase link --project-ref $SUPABASE_PROJECT_REF --password $SUPABASE_DB_PASSWORD`
- **Auth error**: Set SUPABASE_ACCESS_TOKEN env var
- **Migration failed**: Check SQL syntax, run `npx supabase db reset --yes`

### RLS Issues
- **Query returns empty**: Check RLS policies
- **Permission denied**: Verify auth.uid() matches user_id
- **Insert fails**: Check WITH CHECK clause in policy

### Auth Issues
- **Invalid credentials**: Check email/password
- **Email not confirmed**: Enable in Supabase Dashboard
- **OAuth not working**: Configure provider in Dashboard

---

## Edge Functions

Edge Functions are server-side TypeScript functions that run on Deno. Use them for:
- Proxying requests to external APIs (hiding credentials from the client)
- Webhooks
- Scheduled/cron jobs
- Any server-side logic that cannot run in the browser

### CRITICAL RULES FOR EDGE FUNCTIONS

1. **ALWAYS deploy after creating** - never leave functions in "pending" state
2. **NEVER ask the user to run CLI commands** - you have terminal access, do it yourself
3. **NEVER ask the user to access the Supabase Dashboard** - use CLI for everything (deploy, secrets, logs)
4. **ALWAYS use `npx supabase functions deploy` from the sandbox terminal**
5. **Use `npx supabase secrets set` for API keys** - never hardcode credentials

### Create a Function

```bash
# Create function scaffold
npx supabase functions new my-function
```

This creates: `supabase/functions/my-function/index.ts`

### Function Template (with CORS)

```typescript
// supabase/functions/my-function/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { name } = await req.json();

    const data = { message: `Hello ${name}!` };

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
```

### Deploy Functions

```bash
# Deploy a single function
npx supabase functions deploy my-function --no-verify-jwt

# Deploy ALL functions at once
npx supabase functions deploy --no-verify-jwt
```

Note: `--no-verify-jwt` allows public access. Remove it if the function should only be called by authenticated users.

### Manage Secrets (API Keys for External Services)

```bash
# Set secrets (available as Deno.env.get("KEY") inside functions)
npx supabase secrets set API_KEY=my-secret-key
npx supabase secrets set APP_LOGIN=myapp APP_PASSWORD=mypassword

# List all secrets
npx supabase secrets list

# Remove a secret
npx supabase secrets unset API_KEY
```

### Call from Frontend

```typescript
// Using Supabase client SDK
const { data, error } = await supabase.functions.invoke("my-function", {
  body: { name: "World" },
});

if (error) {
  console.error("Edge Function error:", error.message);
} else {
  console.log("Response:", data);
}
```

### View Logs (Debugging)

```bash
# View recent logs for a function
npx supabase functions logs my-function

# Follow logs in real-time (tail)
npx supabase functions logs my-function --tail
```

---

## Edge Functions: Proxy Pattern for External APIs

This is the most common use case: the user wants to call an external API that requires server-side credentials (API keys, Basic Auth, etc).

### Step-by-Step

1. **Create the proxy function**:
```bash
npx supabase functions new api-proxy
```

2. **Set secrets for the external API credentials**:
```bash
npx supabase secrets set EXTERNAL_API_KEY=secret123
npx supabase secrets set EXTERNAL_API_URL=https://api.example.com
```

3. **Write the proxy function**:
```typescript
// supabase/functions/api-proxy/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Read secrets (set via npx supabase secrets set)
    const apiKey = Deno.env.get("EXTERNAL_API_KEY");
    const apiUrl = Deno.env.get("EXTERNAL_API_URL");

    // Forward request to external API
    const response = await fetch(`${apiUrl}/endpoint`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.text();

    // Check if external API blocked the request (WAF/Cloudflare)
    if (data.includes("blocked") || data.includes("<!DOCTYPE html>")) {
      return new Response(
        JSON.stringify({
          error: "BLOCKED_BY_WAF",
          message: "The external API blocked this request (datacenter IP). "
            + "Ask the API provider to whitelist Supabase Edge Function IPs, "
            + "or call the API directly from the browser if it supports CORS.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 },
      );
    }

    return new Response(data, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: response.status,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
```

4. **Deploy**:
```bash
npx supabase functions deploy api-proxy --no-verify-jwt
```

5. **Call from frontend**:
```typescript
const { data, error } = await supabase.functions.invoke("api-proxy", {
  body: { endpoint: "/login", username: "user", password: "pass" },
});
```

### Basic Auth Proxy (like HomeBroker API)

For APIs that use HTTP Basic Auth for app-level authentication:

```bash
# Set the app credentials as secrets
npx supabase secrets set APP_LOGIN=myapp APP_PASSWORD=secret123
```

```typescript
// Inside the Edge Function:
const appLogin = Deno.env.get("APP_LOGIN");
const appPassword = Deno.env.get("APP_PASSWORD");
const basicAuth = btoa(`${appLogin}:${appPassword}`);

const response = await fetch("https://api.example.com/v3/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Basic ${basicAuth}`,
  },
  body: JSON.stringify({ username, password, role: "user" }),
});
```

---

## Edge Functions: Limitations and Warnings

### WAF / IP Blocking
External APIs protected by Cloudflare or similar WAFs may BLOCK requests from Edge Functions because they come from datacenter IPs (not residential IPs). Symptoms:
- HTTP 403 with HTML response saying "blocked" or "access denied"
- Cloudflare challenge page in response body

**Solutions (in order of preference):**
1. Ask the API provider to whitelist Supabase Edge Function IPs
2. If the API supports CORS, call it directly from the browser (no proxy needed)
3. Use a residential proxy service (advanced)

### Timeouts
- Free plan: 60 second execution limit
- Pro plan: 150 second execution limit
- Design functions to be fast; use streaming for long operations

### Region
Edge Functions run in the same region as the Supabase project. Latency to external APIs depends on geographic distance.

### No npm packages by default
Edge Functions use Deno, not Node.js. Use:
- `jsr:` imports for Supabase packages
- `npm:` prefix for npm packages (e.g., `import axios from "npm:axios"`)
- Deno standard library for utilities

---

## Updated Best Practices (including Edge Functions)

11. **NEVER ask the user to run terminal commands** - execute them yourself in the sandbox
12. **NEVER ask the user to access the Supabase Dashboard** - use CLI for deploy, secrets, logs
13. **NEVER create Edge Functions without deploying them** - if you create it, deploy it in the same session
14. **If deploy fails, diagnose and fix** - do not leave functions in "pending" state
15. **Use secrets for all external API credentials** - never hardcode keys in function code
16. **Always include CORS headers** in Edge Functions that are called from the browser
17. **Detect WAF blocks** and provide clear guidance to the user about alternatives
