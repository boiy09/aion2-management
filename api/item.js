module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, enchantLevel, serverId = '2001', slotPos, lang = 'ko' } = req.query;
  // characterId는 이중 인코딩 방지를 위해 decodeURIComponent로 처리 (character.js와 동일)
  const characterId = req.query.characterId ? decodeURIComponent(req.query.characterId) : undefined;

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://aion2.plaync.com/ko-kr/characters/index',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Origin': 'https://aion2.plaync.com',
  };

  // NC API 그대로 반환 (응답 구조 제한 없이)
  async function tryFetch(url) {
    try {
      const r = await fetch(url, { headers });
      const text = await r.text();
      if (!text || !text.trim()) return null;
      const data = JSON.parse(text);
      return { _httpStatus: r.status, _url: url, ...data };
    } catch(e) { return null; }
  }

  // 1) characterId + slotPos + id
  if (characterId && slotPos !== undefined && id) {
    const p = new URLSearchParams({ lang, id, enchantLevel: enchantLevel||0, characterId, serverId, slotPos });
    const data = await tryFetch(`https://aion2.plaync.com/api/character/equipment/item?${p}`);
    if (data) return res.status(200).json(data);
  }

  // 2) characterId + id
  if (characterId && id) {
    const p = new URLSearchParams({ lang, id, enchantLevel: enchantLevel||0, characterId, serverId });
    const data = await tryFetch(`https://aion2.plaync.com/api/character/equipment/item?${p}`);
    if (data) return res.status(200).json(data);
  }

  // 3) id만으로 (characterId 없이)
  if (id) {
    const p = new URLSearchParams({ lang, id, enchantLevel: enchantLevel||0, serverId });
    const data = await tryFetch(`https://aion2.plaync.com/api/character/equipment/item?${p}`);
    if (data) return res.status(200).json(data);
  }

  // 4) characterId로 장비 목록 폴백
  if (characterId) {
    try {
      const equipUrl = `https://aion2.plaync.com/api/character/equipment?lang=${lang}&characterId=${encodeURIComponent(characterId)}&serverId=${serverId}`;
      const equipRes = await fetch(equipUrl, { headers });
      if (equipRes.ok) {
        const equipData = await equipRes.json();
        const equipList = (equipData?.equipment?.equipmentList) || [];
        let found = null;
        if (slotPos !== undefined) found = equipList.find(e => String(e.slotPos) === String(slotPos));
        if (!found && id)         found = equipList.find(e => String(e.itemId || e.id) === String(id));
        if (found) return res.status(200).json(found);
      }
    } catch(err) {
      return res.status(200).json({ error: '장비 목록 조회 실패', detail: err.message });
    }
  }

  res.status(200).json({ error: '조회 실패 — id 또는 characterId 필요', params: { id, characterId, slotPos } });
}
