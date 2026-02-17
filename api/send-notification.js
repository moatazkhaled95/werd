const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { groupId, senderUserId, senderName, groupName } = req.body || {};
  if (!groupId || !senderUserId || !senderName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  webpush.setVapidDetails(
    'mailto:moataz_95@windowslive.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  // Get all push subscriptions for this group except the sender
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('group_id', groupId)
    .neq('user_id', senderUserId);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const payload = JSON.stringify({
    title: 'الْوِرْدُ الْقُرْآنِيُّ',
    body: `🎉 ${senderName} أتمّ الهدف في ${groupName}!`,
  });

  const results = await Promise.allSettled(
    (subs || []).map(row => {
      const sub = row.subscription;
      return webpush.sendNotification(sub, payload).catch(err => {
        // If subscription expired (410 Gone), delete it
        if (err.statusCode === 410 || err.statusCode === 404) {
          supabase
            .from('push_subscriptions')
            .delete()
            .eq('subscription', sub)
            .then(() => {});
        }
      });
    })
  );

  const sent = results.filter(r => r.status === 'fulfilled').length;
  res.status(200).json({ sent, total: subs?.length || 0 });
};
