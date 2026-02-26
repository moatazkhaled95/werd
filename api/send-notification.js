const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');
let admin;

function getFirebaseAdmin() {
  if (admin) return admin;
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  const firebase = require('firebase-admin');
  if (!firebase.apps.length) {
    firebase.initializeApp({ credential: firebase.credential.cert(serviceAccount) });
  }
  admin = firebase;
  return admin;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { groupId, senderUserId, senderName, groupName, type } = req.body || {};
    if (!groupId || !senderUserId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Build message body based on type
    let body;
    switch (type) {
      case 'goal':
        body = `🎉 ${senderName} أتمّ الهدف في ${groupName}!`;
        break;
      case 'join':
        body = `👋 ${senderName} انضم إلى مجموعة ${groupName}`;
        break;
      case 'leave':
        body = `↩ ${senderName} غادر مجموعة ${groupName}`;
        break;
      case 'tasbeeh':
        body = `📿 ${senderName} أتمّ هدف التسبيح في ${groupName}!`;
        break;
      default:
        body = `🎉 ${senderName} أتمّ الهدف في ${groupName}!`;
    }

    const title = 'الْوِرْدُ الْقُرْآنِيُّ';
    let fcmSent = 0, webSent = 0;

    // ── FCM (Android native app) ──────────────────────────────────────────────
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const { data: fcmRows } = await supabase
          .from('fcm_tokens')
          .select('token')
          .eq('group_id', groupId)
          .neq('user_id', senderUserId);

        const tokens = (fcmRows || []).map(r => r.token).filter(Boolean);
        if (tokens.length > 0) {
          const firebase = getFirebaseAdmin();
          // FCM allows max 500 tokens per multicast call — chunk if needed
          const chunks = [];
          for (let i = 0; i < tokens.length; i += 500) chunks.push(tokens.slice(i, i + 500));
          const allResponses = [];
          for (const chunk of chunks) {
            const response = await firebase.messaging().sendEachForMulticast({
              tokens: chunk,
              notification: { title, body },
              android: { notification: { sound: 'default', priority: 'HIGH' } },
            });
            fcmSent += response.successCount;
            allResponses.push(...response.responses.map((r, i) => ({ r, token: chunk[i] })));
          }
          const response = { responses: allResponses.map(x => x.r) };
          const tokenList = allResponses.map(x => x.token);

          // Clean up expired tokens
          response.responses.forEach((r, i) => {
            if (!r.success &&
                (r.error?.code === 'messaging/registration-token-not-registered' ||
                 r.error?.code === 'messaging/invalid-registration-token')) {
              supabase.from('fcm_tokens').delete().eq('token', tokenList[i]).then(() => {});
            }
          });
        }
      } catch (e) {
        console.error('FCM send error:', e);
      }
    }

    // ── Web Push (PWA browsers) ────────────────────────────────────────────────
    if (process.env.VAPID_PRIVATE_KEY && process.env.VAPID_PUBLIC_KEY) {
      try {
        webpush.setVapidDetails(
          'mailto:moataz_95@windowslive.com',
          process.env.VAPID_PUBLIC_KEY,
          process.env.VAPID_PRIVATE_KEY
        );

        const { data: subs } = await supabase
          .from('push_subscriptions')
          .select('subscription')
          .eq('group_id', groupId)
          .neq('user_id', senderUserId);

        const payload = JSON.stringify({ title, body });
        const results = await Promise.allSettled(
          (subs || []).map(row => {
            const sub = row.subscription;
            return webpush.sendNotification(sub, payload).catch(err => {
              if (err.statusCode === 410 || err.statusCode === 404) {
                supabase.from('push_subscriptions').delete().eq('subscription', sub).then(() => {});
              }
            });
          })
        );
        webSent = results.filter(r => r.status === 'fulfilled').length;
      } catch (e) {
        console.error('Web push error:', e);
      }
    }

    res.status(200).json({ fcmSent, webSent });
  } catch (e) {
    console.error('send-notification error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
};
