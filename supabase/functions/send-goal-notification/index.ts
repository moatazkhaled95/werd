import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
  }

  try {
    const { members, senderName, groupName } = await req.json();

    for (const m of members) {
      if (!m.email) continue;
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'وِرْدٌ <noreply@werd.app>',
          to: m.email,
          subject: `🎉 ${senderName} أتمّ الهدف اليوم في مجموعة ${groupName}`,
          html: `
            <div style="font-family:sans-serif;direction:rtl;text-align:right;max-width:480px;margin:auto;padding:24px">
              <h2 style="color:#059669">🎉 تهانينا!</h2>
              <p style="font-size:16px">
                <strong>${senderName}</strong> أتمّ هدفه اليومي في مجموعة <strong>${groupName}</strong>!
              </p>
              <p style="color:#6b7280;font-size:14px">هل أتممت هدفك اليوم أيضاً؟ افتح التطبيق وسجّل قراءتك.</p>
              <a href="https://werd-moatazs-projects-f7432b84.vercel.app"
                 style="display:inline-block;background:#059669;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px">
                افتح وِرْدٌ
              </a>
            </div>`,
        }),
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
});
