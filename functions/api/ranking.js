export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const serverId            = url.searchParams.get('serverId')            || '2001';
  const rankingContentsType = url.searchParams.get('rankingContentsType') || '1';
  const rankingType         = url.searchParams.get('rankingType')         || '0';
  const classId             = url.searchParams.get('classId')             || '';
  const pageSize            = url.searchParams.get('pageSize')            || '100';

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const ncHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://aion2.plaync.com/ko-kr/ranking/index',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Origin': 'https://aion2.plaync.com',
  };

  try {
    let ncUrl = `https://aion2.plaync.com/api/ranking/list?lang=ko&rankingContentsType=${rankingContentsType}&rankingType=${rankingType}&serverId=${serverId}&pageSize=${pageSize}`;
    if (classId) ncUrl += `&classId=${classId}`;

    const res = await fetch(ncUrl, { headers: ncHeaders });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `NC ranking API error: ${res.status}` }), { status: 502, headers: corsHeaders });
    }
    const data = await res.json();
    return new Response(JSON.stringify(data), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}
