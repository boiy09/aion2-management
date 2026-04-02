export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const characterId = url.searchParams.get('characterId') || '';
  const nickname = url.searchParams.get('nickname') || '';
  const serverId = url.searchParams.get('serverId') || '2001';

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (!characterId && !nickname) {
    return new Response(JSON.stringify({ error: 'characterId 또는 nickname이 필요해요' }), { status: 400, headers: corsHeaders });
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://aion2.plaync.com/ko-kr/characters/index',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Origin': 'https://aion2.plaync.com',
  };

  try {
    let rawId = characterId ? decodeURIComponent(characterId) : null;

    // 닉네임으로 characterId 검색
    if (!rawId && nickname) {
      const nick = decodeURIComponent(nickname);
      const searchRes = await fetch(
        `https://aion2.plaync.com/ko-kr/api/search/aion2/search/v2/character?keyword=${encodeURIComponent(nick)}&serverId=${serverId}`,
        { headers }
      );
      const searchData = await searchRes.json();
      const list = searchData?.result?.character?.list || searchData?.list || [];
      const found = list.find(c => c.characterName === nick || c.name === nick) || list[0];
      if (!found) {
        return new Response(JSON.stringify({ members: [], _err: `'${nick}' 캐릭터를 찾을 수 없어요` }), { headers: corsHeaders });
      }
      rawId = String(found.characterId || found.id || '');
    }

    // 레기온 멤버 목록 엔드포인트 시도
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
          return new Response(JSON.stringify({
            members: [],
            _debug: { endpoint, status: r.status, keys: Object.keys(data || {}), preview: JSON.stringify(data).slice(0, 500) }
          }), { headers: corsHeaders });
        }

        const members = memberList.map(m => ({
          nickname: m.characterName || m.nickname || m.name || '',
          rank: m.rankName || m.rank || '',
          class: m.className || m.class || '',
          level: m.characterLevel || m.level || 0,
          characterId: m.characterId || m.id || '',
        })).filter(m => m.nickname);

        return new Response(JSON.stringify({ members, _src: endpoint }), { headers: corsHeaders });
      } catch (e) {
        continue;
      }
    }

    return new Response(JSON.stringify({ members: [], _err: '레기온 멤버 API를 찾을 수 없어요. NC 공홈 로그인이 필요한 API일 수 있습니다.' }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ members: [], _err: err.message }), { headers: corsHeaders });
  }
}
