import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const WA_TOKEN = Deno.env.get('WHATSAPP_TOKEN') ?? ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function enviarCodigoWhatsApp(phone: string, codigo: string, waBusinessId: string) {
  await fetch(`https://graph.facebook.com/v19.0/${waBusinessId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WA_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: {
        body: `🔐 *Tá Contado* - Código de verificação:\n\n*${codigo}*\n\nDigite este código no app para vincular seu WhatsApp. Válido por 10 minutos.`
      }
    })
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, phone, codigo, user_name, wa_business_id } = await req.json()

    // ── Ação: solicitar código de verificação ──────────────────────────────
    if (action === 'request_code') {
      if (!phone) return new Response(JSON.stringify({ error: 'Número obrigatório' }), { status: 400, headers: corsHeaders })

      const phoneClean = phone.replace(/\D/g, '')
      const code = Math.floor(100000 + Math.random() * 900000).toString()
      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString()

      // Upsert do usuário
      const { error } = await supabase.from('whatsapp_users').upsert({
        phone: phoneClean,
        user_name: user_name ?? '',
        verification_code: code,
        verification_expires_at: expires,
        verified: false,
        updated_at: new Date().toISOString()
      }, { onConflict: 'phone' })

      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })

      // Tentar enviar via WhatsApp (se token disponível)
      if (WA_TOKEN && wa_business_id) {
        await enviarCodigoWhatsApp(phoneClean, code, wa_business_id)
        return new Response(JSON.stringify({ ok: true, method: 'whatsapp' }), { headers: corsHeaders })
      }

      // Retornar código para exibir na tela (fallback sem WA token)
      return new Response(JSON.stringify({ ok: true, method: 'screen', code }), { headers: corsHeaders })
    }

    // ── Ação: verificar código ─────────────────────────────────────────────
    if (action === 'verify_code') {
      const phoneClean = phone.replace(/\D/g, '')

      const { data: waUser, error } = await supabase
        .from('whatsapp_users')
        .select('*')
        .eq('phone', phoneClean)
        .single()

      if (error || !waUser) return new Response(JSON.stringify({ error: 'Número não encontrado' }), { status: 404, headers: corsHeaders })

      if (waUser.verification_code !== codigo) {
        return new Response(JSON.stringify({ error: 'Código incorreto' }), { status: 400, headers: corsHeaders })
      }

      if (new Date(waUser.verification_expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: 'Código expirado. Solicite um novo.' }), { status: 400, headers: corsHeaders })
      }

      await supabase.from('whatsapp_users').update({
        verified: true,
        verification_code: null,
        updated_at: new Date().toISOString()
      }).eq('phone', phoneClean)

      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
    }

    // ── Ação: checar status ────────────────────────────────────────────────
    if (action === 'check_status') {
      const phoneClean = phone.replace(/\D/g, '')
      const { data } = await supabase
        .from('whatsapp_users')
        .select('verified, phone')
        .eq('phone', phoneClean)
        .single()

      return new Response(JSON.stringify({ verified: data?.verified ?? false }), { headers: corsHeaders })
    }

    // ── Ação: desconectar ──────────────────────────────────────────────────
    if (action === 'disconnect') {
      const phoneClean = phone.replace(/\D/g, '')
      await supabase.from('whatsapp_users').delete().eq('phone', phoneClean)
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
    }

    return new Response(JSON.stringify({ error: 'Ação inválida' }), { status: 400, headers: corsHeaders })

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders })
  }
})
