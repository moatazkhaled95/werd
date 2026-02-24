const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  // Use service role client for all operations
  const admin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // Verify the user's token
  const { data: { user }, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    // 1. Delete push subscriptions
    await admin.from('push_subscriptions').delete().eq('user_id', user.id);

    // 2. Delete groups created by this user (cascades to members via FK)
    await admin.from('groups').delete().eq('created_by', user.id);

    // 3. Delete any remaining member records (groups created by others)
    await admin.from('members').delete().eq('user_id', user.id);

    // 4. Delete the auth user
    const { error: deleteErr } = await admin.auth.admin.deleteUser(user.id);
    if (deleteErr) throw deleteErr;

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('delete-account error:', e);
    return res.status(500).json({ error: e.message || 'Failed to delete account' });
  }
};
