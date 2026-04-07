module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { characterId, serverId = '2001', boardId } = req.query;
  if (!characterId || !boardId) return res.status(400).json({ error: 'characterId, boardId 필요' });

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://aion2.plaync.com/ko-kr/characters/index',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Origin': 'https://aion2.plaync.com',
  };

  try {
    // 내부 boardId = displayId - 20 으로 추정 (31→11, 32→12 ...)
    const internalId = parseInt(boardId) - 20;

    // 여러 NC API 엔드포인트 패턴 시도
    const urls = [
      `https://aion2.plaync.com/api/character/daevanion?lang=ko&characterId=${encodeURIComponent(characterId)}&serverId=${serverId}&boardId=${boardId}`,
      `https://aion2.plaync.com/api/character/daevanion?lang=ko&characterId=${encodeURIComponent(characterId)}&serverId=${serverId}&boardId=${internalId}`,
      `https://aion2.plaync.com/api/character/daevanion?lang=ko&characterId=${encodeURIComponent(characterId)}&serverId=${serverId}`,
    ];

    let data = null;
    let usedUrl = '';
    for (const url of urls) {
      try {
        const r = await fetch(url, { headers });
        if (!r.ok) continue;
        const d = await r.json();
        // nodeList가 있으면 성공
        const nl = d.nodeList || (d.daevanion && d.daevanion.nodeList);
        if (nl && nl.length > 0) { data = d; usedUrl = url; break; }
        // boardId 필터링 없이 전체를 받는 경우
        if (d && (d.boardList || d.nodeList || d.daevanion)) { data = d; usedUrl = url; break; }
      } catch(e) { /* 다음 시도 */ }
    }

    if (!data) return res.status(404).json({ error: '데이터 없음', tried: urls });

    // nodeList 추출
    const nodeList = data.nodeList
      || (data.daevanion && data.daevanion.nodeList)
      || [];
    const statList = data.openStatEffectList
      || (data.daevanion && data.daevanion.openStatEffectList)
      || [];
    const skillList = data.openSkillEffectList
      || (data.daevanion && data.daevanion.openSkillEffectList)
      || [];

    res.status(200).json({
      boardId: parseInt(boardId),
      nodeList,
      openStatEffectList: statList,
      openSkillEffectList: skillList,
      _usedUrl: usedUrl,
      _rawKeys: Object.keys(data),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
