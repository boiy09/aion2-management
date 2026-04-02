export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    }});
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ data: null, error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
  }

  const TURSO_URL = env.TURSO_URL;
  const TURSO_TOKEN = env.TURSO_TOKEN;

  if (!TURSO_URL || !TURSO_TOKEN) {
    return new Response(JSON.stringify({ data: null, error: 'DB_NOT_CONFIGURED' }), { status: 500, headers: corsHeaders });
  }

  let body;
  try { body = await request.json(); } catch(e) {
    return new Response(JSON.stringify({ data: null, error: 'Invalid JSON' }), { status: 400, headers: corsHeaders });
  }

  const { sql, args = [] } = body;
  if (!sql) {
    return new Response(JSON.stringify({ data: null, error: 'Missing sql' }), { status: 400, headers: corsHeaders });
  }

  try {
    const tursoRes = await fetch(`${TURSO_URL}/v2/pipeline`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TURSO_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          { type: 'execute', stmt: { sql, args: args.map(toTurso) } },
          { type: 'close' }
        ]
      })
    });

    const tursoData = await tursoRes.json();
    const result = tursoData.results?.[0];

    if (!result || result.type === 'error') {
      const msg = result?.error?.message || JSON.stringify(result?.error) || 'Turso error';
      return new Response(JSON.stringify({ data: null, error: msg }), { headers: corsHeaders });
    }

    const execResult = result.response?.result;
    const cols = (execResult?.cols || []).map(c => c.name);
    const rows = execResult?.rows || [];

    const data = rows.map(row => {
      const obj = {};
      cols.forEach((col, i) => { obj[col] = fromTurso(row[i]); });
      return obj;
    });

    return new Response(JSON.stringify({
      data,
      error: null,
      affected: execResult?.affected_row_count || 0,
    }), { headers: corsHeaders });

  } catch(e) {
    return new Response(JSON.stringify({ data: null, error: e.message }), { headers: corsHeaders });
  }
}

function toTurso(v) {
  if (v === null || v === undefined) return { type: 'null' };
  if (typeof v === 'boolean') return { type: 'integer', value: v ? '1' : '0' };
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return { type: 'integer', value: String(v) };
    return { type: 'float', value: String(v) };
  }
  return { type: 'text', value: String(v) };
}

function fromTurso(cell) {
  if (!cell || cell.type === 'null') return null;
  if (cell.type === 'integer') return parseInt(cell.value, 10);
  if (cell.type === 'float') return parseFloat(cell.value);
  return cell.value;
}
