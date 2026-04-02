module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { keyword, serverId = '2001', race = '2' } = req.query;
  if (!keyword) return res.status(400).json({ error: '닉네임을 입력해주세요' });

  try {
    const url = `https://aion2.plaync.com/ko-kr/api/search/aion2/search/v2/character?keyword=${encodeURIComponent(keyword)}&race=${race}&serverId=${serverId}&page=1&size=10`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://aion2.plaync.com/ko-kr/characters/index',
      }
    });
    const data = await response.json();
    const list = (data.list || []).map(c => ({
      ...c,
      name: c.name.replace(/<[^>]+>/g, '')
    }));
    res.status(200).json({ list });
  } catch (err) {
    res.status(500).json({ error: '검색 실패', detail: err.message });
  }
}
