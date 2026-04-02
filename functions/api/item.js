export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const sp = url.searchParams;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const id = sp.get('id') || '';
  const enchantLevel = sp.get('enchantLevel') || '0';
  const serverId = sp.get('serverId') || '2001';
  const slotPos = sp.get('slotPos');
  const lang = sp.get('lang') || 'ko';
  const characterId = sp.get('characterId') ? decodeURIComponent(sp.get('characterId')) : null;

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://aion2.plaync.com/ko-kr/characters/index',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Origin': 'https://aion2.plaync.com',
  };

  async function tryFetch(fetchUrl) {
    try {
      const r = await fetch(fetchUrl, { headers });
      const text = await r.text();
      if (!text || !text.trim()) return null;
      const data = JSON.parse(text);
      return { _httpStatus: r.status, _url: fetchUrl, ...data };
    } catch(e) { return null; }
  }

  // 1) characterId + slotPos + id
  if (characterId && slotPos !== undefined && slotPos !== null && id) {
    const p = new URLSearchParams({ lang, id, enchantLevel, characterId, serverId, slotPos });
    const data = await tryFetch(`https://aion2.plaync.com/api/character/equipment/item?${p}`);
    if (data) return new Response(JSON.stringify(data), { headers: corsHeaders });
  }

  // 2) characterId + id
  if (characterId && id) {
    const p = new URLSearchParams({ lang, id, enchantLevel, characterId, serverId });
    const data = await tryFetch(`https://aion2.plaync.com/api/character/equipment/item?${p}`);
    if (data) return new Response(JSON.stringify(data), { headers: corsHeaders });
  }

  // 3) id only
  if (id) {
    const p = new URLSearchParams({ lang, id, enchantLevel, serverId });
    const data = await tryFetch(`https://aion2.plaync.com/api/character/equipment/item?${p}`);
    if (data) return new Response(JSON.stringify(data), { headers: corsHeaders });
  }

  // 4) characterId fallback
  if (characterId) {
    try {
      const equipUrl = `https://aion2.plaync.com/api/character/equipment?lang=${lang}&characterId=${encodeURIComponent(characterId)}&serverId=${serverId}`;
      const equipRes = await fetch(equipUrl, { headers });
      if (equipRes.ok) {
        const equipData = await equipRes.json();
        const equipList = (equipData?.equipment?.equipmentList) || [];
        let found = null;
        if (slotPos !== undefined && slotPos !== null) found = equipList.find(e => String(e.slotPos) === String(slotPos));
        if (!found && id) found = equipList.find(e => String(e.itemId || e.id) === String(id));
        if (found) return new Response(JSON.stringify(found), { headers: corsHeaders });
      }
    } catch(err) {
      return new Response(JSON.stringify({ error: '장비 목록 조회 실패', detail: err.message }), { headers: corsHeaders });
    }
  }

  return new Response(JSON.stringify({ error: '조회 실패 — id 또는 characterId 필요', params: { id, characterId, slotPos } }), { headers: corsHeaders });
}
