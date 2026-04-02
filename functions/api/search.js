export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const keyword  = url.searchParams.get('keyword')  || '';
  const serverId = url.searchParams.get('serverId') || 'all';

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (!keyword) {
    return new Response(JSON.stringify({ error: '닉네임을 입력해주세요' }), { status: 400, headers: corsHeaders });
  }

  const fetchHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://aion2.plaync.com/ko-kr/characters/index',
  };

  // 특정 서버 지정 여부 (all/elyos/asmo 외의 서버명)
  const isSpecificServer = serverId !== 'all' && serverId !== 'elyos' && serverId !== 'asmo';
  const size = 50;

  try {
    const apiUrl = `https://aion2.plaync.com/ko-kr/api/search/aion2/search/v2/character?keyword=${encodeURIComponent(keyword)}&page=1&size=${size}`;
    const response = await fetch(apiUrl, { headers: fetchHeaders });
    const data = await response.json();

    let list = (data.list || []).map(c => ({
      ...c,
      name:        (c.name || '').replace(/<[^>]+>/g, ''),
      // NC 검색 API 필드명 통일 (profileImageUrl → profile_img)
      profile_img: c.profileImageUrl
        ? (c.profileImageUrl.startsWith('http') ? c.profileImageUrl : 'https://aion2.plaync.com' + c.profileImageUrl)
        : (c.profileUrl || c.profile_img || ''),
    }));

    // 특정 서버 선택 시 서버명으로 필터
    if (isSpecificServer) {
      list = list.filter(c => (c.serverName || '') === serverId);
    }

    return new Response(JSON.stringify({ list }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: '검색 실패', detail: err.message }), { status: 500, headers: corsHeaders });
  }
}
