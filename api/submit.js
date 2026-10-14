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
  // Handle delete requests
  if (body && body.action === 'delete') {
    var charId = String(body.characterId || '').trim();
    if (!charId || !/^[a-z0-9-]+$/.test(charId)) return res.status(400).json({ error: 'Invalid character ID' });
    try {
      // Get current index.json
      var idxRes = await fetch('https://api.github.com/repos/Mrcool210/Bullpen-/contents/gallery/index.json', {
        headers: { 'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer ' + token, 'User-Agent': 'Bullpen-Vault-Relay' }
      });
      if (!idxRes.ok) return res.status(502).json({ error: 'Could not read gallery' });
      var idxData = await idxRes.json();
      var idxContent = JSON.parse(Buffer.from(idxData.content, 'base64').toString('utf8'));
      // Remove the character
      var before = (idxContent.characters || []).length;
      idxContent.characters = (idxContent.characters || []).filter(function(c) { return c.id !== charId; });
      if (idxContent.characters.length === before) return res.status(404).json({ error: 'Character not found' });
      idxContent.updatedAt = new Date().toISOString();
      // Update index.json
      var updRes = await fetch('https://api.github.com/repos/Mrcool210/Bullpen-/contents/gallery/index.json', {
        method: 'PUT',
        headers: { 'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'User-Agent': 'Bullpen-Vault-Relay' },
        body: JSON.stringify({
          message: 'Community Vault: remove ' + charId,
          content: Buffer.from(JSON.stringify(idxContent, null, 2) + '\n').toString('base64'),
          sha: idxData.sha
        })
      });
      if (!updRes.ok) return res.status(502).json({ error: 'Could not update gallery' });
      // Delete the char file (best effort)
      try {
        var charRes = await fetch('https://api.github.com/repos/Mrcool210/Bullpen-/contents/gallery/chars/' + charId + '.json', {
          headers: { 'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer ' + token, 'User-Agent': 'Bullpen-Vault-Relay' }
        });
        if (charRes.ok) {
          var charData = await charRes.json();
          await fetch('https://api.github.com/repos/Mrcool210/Bullpen-/contents/gallery/chars/' + charId + '.json', {
            method: 'DELETE',
            headers: { 'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'User-Agent': 'Bullpen-Vault-Relay' },
            body: JSON.stringify({ message: 'Community Vault: delete ' + charId + '.json', sha: charData.sha })
          });
        }
      } catch (e) {}
      return res.status(200).json({ ok: true, deleted: charId });
    } catch (e) { return res.status(502).json({ error: 'Delete failed' }); }
  }
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
