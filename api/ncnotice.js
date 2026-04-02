module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();

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

  const prevId = req.query.prevId || '0';
  const moreEndpoint = `https://api-community.plaync.com/aion2/board/notice_ko/article/search/moreArticle?isVote=true&moreSize=15&moreDirection=BEFORE&previousArticleId=${prevId}`;

  if (req.query.debug === '1') {
    try {
      const r = await fetch(moreEndpoint, { headers });
      const data = await r.json();
      const rawList = data?.contentList || [];
      const firstItem = rawList[0] || null;
      return res.status(200).json({
        notices: [],
        debug: {
          url: moreEndpoint, status: r.status, keys: Object.keys(data || {}),
          hasMore: data?.hasMore, count: rawList.length,
          firstItemKeys: firstItem ? Object.keys(firstItem) : null,
          firstItemArticleMetaKeys: firstItem?.articleMeta ? Object.keys(firstItem.articleMeta) : null,
          firstItemSnow: firstItem?.articleMeta?.snow || firstItem?.snow || null,
          firstItemPreview: JSON.stringify(firstItem).slice(0, 800),
        }
      });
    } catch(e) {
      return res.status(200).json({ notices: [], debug: { error: e.message } });
    }
  }

  try {
    const r = await fetch(moreEndpoint, { headers });
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
      const articleUrl = `https://aion2.plaync.com/ko-kr/board/notice/view?articleId=${id}`;
      const category = m.categoryName || m.category || '';
      return { id, title, date, url: articleUrl, category, snowId };
    }).filter(n => n.title);

    const hasMore = data?.hasMore ?? false;
    const lastSnowId = notices.length > 0 ? (notices[notices.length - 1].id || 0) : 0;

    return res.status(200).json({ notices, hasMore, lastSnowId, _src: moreEndpoint });
  } catch(e) {
    return res.status(200).json({ notices: [], _err: e.message });
  }
};
