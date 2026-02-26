const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  // Verify cron secret or allow GET for Vercel Cron
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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

  // Reset tasbeeh_today for all members (daily cron cleanup)
  await supabase.from('members').update({ tasbeeh_today: 0 }).neq('tasbeeh_today', 0);

  // Get all members who haven't reached their goal today
  const { data: members } = await supabase
    .from('members')
    .select('user_id, group_id, pages_today, groups(goal_amount, name)');

  if (!members || members.length === 0) {
    return res.status(200).json({ sent: 0, message: 'No members found' });
  }

  // Find users who haven't completed their goal
  const usersToNotify = {};
  members.forEach(m => {
    if (!m.groups) return;
    const goal = m.groups.goal_amount;
    if (m.pages_today < goal) {
      if (!usersToNotify[m.user_id]) usersToNotify[m.user_id] = [];
      usersToNotify[m.user_id].push({ groupId: m.group_id, groupName: m.groups.name, remaining: goal - m.pages_today });
    }
  });

  let totalSent = 0;

  for (const [userId, groups] of Object.entries(usersToNotify)) {
    // Get push subscriptions for this user
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', userId);

    if (!subs || subs.length === 0) continue;

    // Build reminder message
    let body;
    if (groups.length === 1) {
      body = `📖 باقي عليك ${groups[0].remaining} في ${groups[0].groupName}، لا تنسَ وردك!`;
    } else {
      body = `📖 لم تكمل وردك في ${groups.length} مجموعات، لا تنسَ القراءة!`;
    }

    const payload = JSON.stringify({
      title: 'الْوِرْدُ الْقُرْآنِيُّ',
      body,
    });

    const results = await Promise.allSettled(
      subs.map(row => {
        return webpush.sendNotification(row.subscription, payload).catch(err => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            supabase.from('push_subscriptions').delete().eq('subscription', row.subscription).then(() => {});
          }
        });
      })
    );

    totalSent += results.filter(r => r.status === 'fulfilled').length;
  }

  res.status(200).json({ sent: totalSent, usersNotified: Object.keys(usersToNotify).length });
};
