// Supabase → Turso 데이터 마이그레이션 (페이지네이션 지원)
// 사용법: /api/db-migrate?confirm=migrate&table=members&offset=0
// offset을 20씩 올려가며 빈 inserted가 나올 때까지 반복

const SB_URL = 'https://kyltdtasbhqjwbaapark.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5bHRkdGFzYmhxandiYWFwYXJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTM3NjQsImV4cCI6MjA5MDA4OTc2NH0.oTqSe1jO1rqXe2H8UHPeeoX2I9Hj3BrJTvs-RY4n2ho';

const TABLE_ORDER = {
  members: 'combat_power.desc',
  notices: 'created_at.asc',
  recruits: 'created_at.asc',
  war_surveys: 'created_at.asc',
  boss_timers: null,
  config: null,
};

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const headers = { 'Content-Type': 'application/json' };

  if (url.searchParams.get('confirm') !== 'migrate') {
    return new Response(JSON.stringify({ error: '?confirm=migrate 필요' }), { status: 400, headers });
  }

  const TURSO_URL = env.TURSO_URL;
  const TURSO_TOKEN = env.TURSO_TOKEN;
  if (!TURSO_URL || !TURSO_TOKEN) {
    return new Response(JSON.stringify({ error: 'env 미설정' }), { status: 500, headers });
  }

  const table  = url.searchParams.get('table');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const limit  = parseInt(url.searchParams.get('limit')  || '15');

  if (!table || !TABLE_ORDER.hasOwnProperty(table)) {
    return new Response(JSON.stringify({ error: 'table 파라미터 필요: ' + Object.keys(TABLE_ORDER).join(', ') }), { status: 400, headers });
  }

  try {
    const order = TABLE_ORDER[table];
    const orderQs = order ? `&order=${order}` : '';
    const sbRes = await fetch(
      `${SB_URL}/rest/v1/${table}?select=*${orderQs}&limit=${limit}&offset=${offset}`,
      { headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` } }
    );
    const rows = await sbRes.json();
    if (!Array.isArray(rows)) {
      return new Response(JSON.stringify({ error: 'Supabase 오류', detail: rows }), { headers });
    }

    if (rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, table, offset, inserted: 0, done: true }), { headers });
    }

    // Turso 일괄 삽입
    const requests = rows.map(row => {
      const cols = Object.keys(row).filter(k => row[k] !== undefined);
      const args = cols.map(c => {
        const v = row[c];
        if (v === null || v === undefined) return { type: 'null' };
        if (typeof v === 'object') return { type: 'text', value: JSON.stringify(v) };
        if (typeof v === 'boolean') return { type: 'integer', value: v ? '1' : '0' };
        const n = Number(v);
        if (!isNaN(n) && (c === 'combat_power' || c === 'level' || c === 'slots' || c === 'views' || c === 'kill_time')) {
          return { type: 'integer', value: String(Math.round(n)) };
        }
        return { type: 'text', value: String(v) };
      });
      return {
        type: 'execute',
        stmt: {
          sql: `INSERT OR IGNORE INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
          args
        }
      };
    });
    requests.push({ type: 'close' });

    const res = await fetch(`${TURSO_URL}/v2/pipeline`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TURSO_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests })
    });
    const d = await res.json();
    let inserted = 0, errors = 0;
    (d.results || []).forEach(r => {
      if (r.type === 'error') errors++;
      else if (r.type === 'ok' && r.response?.type === 'execute') inserted++;
    });

    return new Response(JSON.stringify({
      ok: true, table, offset, limit,
      fetched: rows.length, inserted, errors,
      next_offset: offset + rows.length,
      done: rows.length < limit
    }), { headers });

  } catch(e) {
    return new Response(JSON.stringify({ error: e.message }), { headers });
  }
}
