export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: 'Relay not configured' });
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch (e) { return res.status(400).json({ error: 'Invalid JSON' }); }
  const { title, issueBody } = body || {};
  if (!title || !issueBody) return res.status(400).json({ error: 'Missing fields' });
  if (!/BPCH1-/.test(issueBody)) return res.status(400).json({ error: 'No character code' });
  try {
    const gh = await fetch('https://api.github.com/repos/Mrcool210/Bullpen-/issues', {
      method: 'POST',
      headers: { 'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'User-Agent': 'Bullpen-Vault-Relay' },
      body: JSON.stringify({ title: String(title).slice(0, 120), body: String(issueBody).slice(0, 60000), labels: ['vault-submission'] })
    });
    const data = await gh.json();
    if (!gh.ok) return res.status(502).json({ error: data.message || gh.status });
    return res.status(200).json({ ok: true, issue: data.number });
  } catch (e) { return res.status(502).json({ error: 'Upstream failure' }); }
}
