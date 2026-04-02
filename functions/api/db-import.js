export async function onRequest(context) {
  const { request, env } = context;
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  if (request.method === 'OPTIONS') return new Response(null, { status: 200, headers });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers });

  const TURSO_URL = env.TURSO_URL;
  const TURSO_TOKEN = env.TURSO_TOKEN;
  if (!TURSO_URL || !TURSO_TOKEN) return new Response(JSON.stringify({ error: 'env 미설정' }), { status: 500, headers });

  let body;
  try { body = await request.json(); } catch(e) { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers }); }

  const { table, rows } = body;
  if (!table || !Array.isArray(rows) || rows.length === 0) {
    return new Response(JSON.stringify({ error: 'table, rows 필요' }), { status: 400, headers });
  }

  const JSON_COLS = ['equipment','stats','daevanion','ranking','stigma','arcana','titles','pet','wing','reqs','applies','comments','responses'];
  const INT_COLS  = ['combat_power','level','slots','views','is_main','kill_time'];

  let inserted = 0, errors = 0;
  const BATCH = 20;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const requests = batch.map(row => {
      const cols = Object.keys(row).filter(k => row[k] !== null && row[k] !== undefined && row[k] !== '');
      const args = cols.map(c => {
        let v = row[c];
        if (v === null || v === undefined || v === '') return { type: 'null' };
        if (JSON_COLS.includes(c)) {
          if (typeof v === 'string' && (v[0] === '[' || v[0] === '{')) {
            return { type: 'text', value: v };
          }
          return { type: 'text', value: JSON.stringify(v) };
        }
        if (INT_COLS.includes(c)) {
          const n = parseInt(v) || 0;
          return { type: 'integer', value: String(n) };
        }
        if (typeof v === 'boolean') return { type: 'integer', value: v ? '1' : '0' };
        if (typeof v === 'number') return Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: String(v) };
        return { type: 'text', value: String(v) };
      });
      return { type: 'execute', stmt: { sql: `INSERT OR IGNORE INTO ${table} (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`, args } };
    });
    requests.push({ type: 'close' });

    try {
      const res = await fetch(`${TURSO_URL}/v2/pipeline`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TURSO_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests })
      });
      const d = await res.json();
      (d.results || []).forEach(r => {
        if (r.type === 'error') errors++;
        else if (r.type === 'ok' && r.response?.type === 'execute') inserted++;
      });
    } catch(e) { errors += batch.length; }
  }

  return new Response(JSON.stringify({ ok: true, table, total: rows.length, inserted, errors }), { headers });
}
