module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const characterId = req.query.characterId || '';
  const serverId = req.query.serverId || '2001';

  if (!characterId) {
    return res.status(400).json({ error: 'characterId가 필요해요' });
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://aion2.plaync.com/ko-kr/characters/index',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Origin': 'https://aion2.plaync.com',
  };

  const rawId = decodeURIComponent(characterId);

  const endpoints = [
    `https://aion2.plaync.com/api/character/legion/memberList?lang=ko&characterId=${encodeURIComponent(rawId)}&serverId=${serverId}`,
    `https://aion2.plaync.com/api/character/legion/members?lang=ko&characterId=${encodeURIComponent(rawId)}&serverId=${serverId}`,
    `https://aion2.plaync.com/api/character/legion/member?lang=ko&characterId=${encodeURIComponent(rawId)}&serverId=${serverId}`,
    `https://aion2.plaync.com/api/legion/memberList?lang=ko&characterId=${encodeURIComponent(rawId)}&serverId=${serverId}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const r = await fetch(endpoint, { headers });
      if (!r.ok) continue;
      const text = await r.text();
      if (!text || !text.trim()) continue;
      const data = JSON.parse(text);

      const memberList =
        data?.legion?.memberList ||
        data?.memberList ||
        data?.members ||
        data?.member?.memberList ||
        (Array.isArray(data) ? data : null);

      if (!memberList || !Array.isArray(memberList) || memberList.length === 0) {
        return res.status(200).json({
          members: [],
          _debug: { endpoint, status: r.status, keys: Object.keys(data || {}), preview: JSON.stringify(data).slice(0, 500) }
        });
      }

      const members = memberList.map(m => ({
        nickname: m.characterName || m.nickname || m.name || '',
        rank: m.rankName || m.rank || '',
        class: m.className || m.class || '',
        level: m.characterLevel || m.level || 0,
        characterId: m.characterId || m.id || '',
      })).filter(m => m.nickname);

      return res.status(200).json({ members, _src: endpoint });
    } catch (e) {
      continue;
    }
  }

  return res.status(200).json({ members: [], _err: '레기온 멤버 API를 찾을 수 없어요. NC 공홈 로그인이 필요할 수 있습니다.' });
};
