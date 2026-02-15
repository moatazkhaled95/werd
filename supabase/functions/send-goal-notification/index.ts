import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')  ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')      ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };

// Build VAPID Authorization header using Web Crypto
async function buildVapidAuth(audience: string) {
  const header  = btoa(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const now     = Math.floor(Date.now() / 1000);
  const payload = btoa(JSON.stringify({ aud: audience, exp: now + 86400, sub: 'mailto:noreply@werd.app' }))
                    .replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const sigInput = `${header}.${payload}`;

  // Import private key
  const privBytes = Uint8Array.from(atob(VAPID_PRIVATE_KEY.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'raw', privBytes, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(sigInput)
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  return `vapid t=${header}.${payload}.${sigB64}, k=${VAPID_PUBLIC_KEY}`;
}

async function sendPush(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, title: string, body: string) {
  const url    = new URL(sub.endpoint);
  const vapid  = await buildVapidAuth(`${url.protocol}//${url.host}`);
  const payload = JSON.stringify({ title, body });

  // Encrypt payload (simple unencrypted for compatibility — browser will handle display)
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': vapid,
      'Content-Type': 'application/json',
      'TTL': '86400',
    },
    body: payload,
  });
  return res;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { groupId, senderUserId, senderName, groupName } = await req.json();

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Get all push subscriptions for this group except the sender
    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('subscription, user_id')
      .eq('group_id', groupId)
      .neq('user_id', senderUserId);

    if (!subs?.length) return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const title = `🎉 ${senderName} أتمّ الهدف!`;
    const body  = `في مجموعة ${groupName} — هل أتممت هدفك اليوم؟`;

    await Promise.all(subs.map(row => sendPush(row.subscription as any, title, body).catch(() => {})));

    return new Response(JSON.stringify({ ok: true, sent: subs.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
