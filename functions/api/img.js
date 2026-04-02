export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const imgUrl = url.searchParams.get('url') || '';

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (!imgUrl || !imgUrl.startsWith('https://aion2.plaync.com/')) {
    return new Response(null, { status: 400 });
  }

  try {
    const res = await fetch(imgUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://aion2.plaync.com/ko-kr/characters/index',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });

    if (!res.ok) {
      return new Response(null, { status: res.status });
    }

    const contentType = res.headers.get('content-type') || 'image/png';
    const body = await res.arrayBuffer();

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    return new Response(null, { status: 502 });
  }
}
