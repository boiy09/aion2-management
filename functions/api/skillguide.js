export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const className = url.searchParams.get('class') || '';

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // 클래스명 → 가이드북 title 매핑
  const CLASS_TITLE = {
    '검성':   '검성 스킬',   'Gladiator':    '검성 스킬',
    '수호성': '수호성 스킬', 'Templar':      '수호성 스킬',
    '살성':   '살성 스킬',   'Assassin':     '살성 스킬',
    '궁성':   '궁성 스킬',   'Ranger':       '궁성 스킬',
    '마도성': '마도성 스킬', 'Sorcerer':     '마도성 스킬',
    '정령성': '정령성 스킬', 'Spiritmaster': '정령성 스킬',
    '치유성': '치유성 스킬', 'Cleric':       '치유성 스킬',
    '호법성': '호법성 스킬', 'Chanter':      '호법성 스킬',
  };

  // ':숫자' suffix 제거 (예: '검성:1' → '검성')
  const cleanedClass = className.replace(/:\d+$/, '').trim();
  const title = CLASS_TITLE[cleanedClass];
  if (!title) {
    return new Response(JSON.stringify({ error: 'class 파라미터가 필요합니다' }), { status: 400, headers: corsHeaders });
  }

  const encodedTitle = encodeURIComponent(title);
  const apiUrl = `https://aion2.plaync.com/api/v2/aion2/guide/${encodedTitle}?_=${Date.now()}`;

  const reqHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://aion2.plaync.com/ko-kr/guidebook/list',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Origin': 'https://aion2.plaync.com',
  };

  try {
    const res = await fetch(apiUrl, { headers: reqHeaders });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `가이드 API 오류: ${res.status}` }), { status: 502, headers: corsHeaders });
    }

    const data = await res.json();
    const paragraphList = data?.paragraphList || data?.result?.paragraphList || data?.data?.paragraphList || null;

    if (!paragraphList) {
      return new Response(JSON.stringify({ skills: {} }), { headers: corsHeaders });
    }

    // paragraphList 키 순서대로 HTML 결합
    let allHTML = '';
    for (const k of Object.keys(paragraphList).sort((a, b) => Number(a) - Number(b))) {
      const p = paragraphList[k];
      if (p?.content) allHTML += p.content;
    }

    return new Response(JSON.stringify({ skills: parseSkillTable(allHTML) }), { headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: '스킬 가이드 조회 실패', detail: err.message }), { status: 500, headers: corsHeaders });
  }
}

function parseSkillTable(html) {
  const skills = {};
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowHTML = rowMatch[1];
    const cells = [];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowHTML)) !== null) {
      const text = cellMatch[1]
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/\s+/g, ' ')
        .trim();
      cells.push(text);
    }
    let name = '', desc = '';
    if (cells.length >= 3) {
      const skip = cells[0].length < 2 || /^\d+$/.test(cells[0]);
      name = skip ? cells[1] : cells[0];
      desc = skip ? cells[2] : cells[1];
    } else if (cells.length === 2) {
      name = cells[0]; desc = cells[1];
    }
    if (!name || !desc || name.length > 60) continue;
    if (['스킬명','이름','명칭','Skill','스킬','아이콘','효과','설명'].includes(name)) continue;
    for (const part of name.split(/\s*[-–—]\s*/)) {
      const n = part.trim();
      if (n) skills[n] = desc;
    }
  }
  return skills;
}
