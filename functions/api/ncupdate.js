export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const debug = url.searchParams.get('debug') === '1';
  const prevId = url.searchParams.get('prevId') || '0';

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
    'Referer': 'https://aion2.plaync.com/',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Origin': 'https://aion2.plaync.com',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site',
  };

  const endpoint = `https://api-community.plaync.com/aion2/board/update_ko/article/search/moreArticle?isVote=true&moreSize=15&moreDirection=BEFORE&previousArticleId=${prevId}`;

  if (debug) {
    try {
      const r = await fetch(endpoint, { headers });
      const data = await r.json();
      const rawList = data?.contentList || [];
      const firstItem = rawList[0] || null;
      return new Response(JSON.stringify({
        notices: [],
        debug: {
          url: endpoint,
          status: r.status,
          keys: Object.keys(data || {}),
          hasMore: data?.hasMore,
          count: rawList.length,
          firstItemKeys: firstItem ? Object.keys(firstItem) : null,
          firstItemArticleMetaKeys: firstItem?.articleMeta ? Object.keys(firstItem.articleMeta) : null,
          firstItemSnow: firstItem?.articleMeta?.snow || firstItem?.snow || null,
          firstItemPreview: JSON.stringify(firstItem).slice(0, 800),
        }
      }), { status: 200, headers: corsHeaders });
    } catch(e) {
      return new Response(JSON.stringify({ notices: [], debug: { error: e.message } }), { status: 200, headers: corsHeaders });
    }
  }

  try {
    const r = await fetch(endpoint, { headers });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();

    const rawList = data?.contentList || data?.articleList || data?.list || data?.articles
      || (Array.isArray(data) ? data : null) || [];

    if (!Array.isArray(rawList) || rawList.length === 0) {
      throw new Error('빈 목록: ' + JSON.stringify(Object.keys(data || {})));
    }

    const notices = rawList.slice(0, 15).map(item => {
      const m = item?.articleMeta || item;
      const id = m.id || m.articleId || '';
      const snowId = m?.snow?.contentId || item?.snow?.contentId || m?.contentId || item?.contentId || 0;
      const title = m.title || m.subject || '';
      const date = (m.createDate || m.registDate || m.regDate || m.date || '').slice(0, 10).replace(/-/g, '.');
      const articleUrl = `https://aion2.plaync.com/ko-kr/board/update/view?articleId=${id}`;
      const category = m.categoryName || m.category || '';
      return { id, title, date, url: articleUrl, category, snowId };
    }).filter(n => n.title);

    const hasMore = data?.hasMore ?? false;
    const lastSnowId = notices.length > 0 ? (notices[notices.length - 1].id || 0) : 0;

    return new Response(JSON.stringify({ notices, hasMore, lastSnowId, _src: endpoint }), { status: 200, headers: corsHeaders });
  } catch(e) {
    return new Response(JSON.stringify({ notices: [], _err: e.message }), { status: 200, headers: corsHeaders });
  }
}
