// 테이블 스키마 생성 (한 번만 실행 — 배포 후 브라우저에서 /api/db-setup 호출)
export async function onRequest(context) {
  const { env } = context;
  const TURSO_URL = env.TURSO_URL;
  const TURSO_TOKEN = env.TURSO_TOKEN;

  if (!TURSO_URL || !TURSO_TOKEN) {
    return new Response(JSON.stringify({ ok: false, error: 'TURSO_URL / TURSO_TOKEN 환경변수 미설정' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }

  const tables = [
    `CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      nickname TEXT,
      server TEXT,
      rank TEXT,
      intro TEXT,
      is_main INTEGER DEFAULT 1,
      player_id TEXT,
      class TEXT,
      level INTEGER,
      combat_power INTEGER,
      item_level REAL,
      equipment TEXT,
      stats TEXT,
      daevanion TEXT,
      ranking TEXT,
      stigma TEXT,
      arcana TEXT,
      titles TEXT,
      pet TEXT,
      wing TEXT,
      server_name TEXT,
      guild_name TEXT,
      race TEXT,
      profile_img TEXT,
      character_id TEXT,
      last_synced TEXT,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS recruits (
      id TEXT PRIMARY KEY,
      title TEXT,
      type TEXT,
      author TEXT,
      reqs TEXT,
      min_cp TEXT,
      slots INTEGER,
      schedule TEXT,
      description TEXT,
      applies TEXT,
      comments TEXT,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS notices (
      id TEXT PRIMARY KEY,
      type TEXT,
      version TEXT,
      title TEXT,
      content TEXT,
      author TEXT,
      views INTEGER DEFAULT 0,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS war_surveys (
      id TEXT PRIMARY KEY,
      title TEXT,
      deadline TEXT,
      responses TEXT,
      created_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS boss_timers (
      id TEXT PRIMARY KEY,
      kill_time INTEGER,
      updated_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      latest_version TEXT,
      updated_at TEXT
    )`,
  ];

  const results = [];
  for (const sql of tables) {
    try {
      const res = await fetch(`${TURSO_URL}/v2/pipeline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TURSO_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            { type: 'execute', stmt: { sql: sql.replace(/\s+/g, ' ').trim(), args: [] } },
            { type: 'close' }
          ]
        })
      });
      const data = await res.json();
      const r = data.results?.[0];
      results.push({ ok: r?.type !== 'error', error: r?.error?.message || null });
    } catch(e) {
      results.push({ ok: false, error: e.message });
    }
  }

  const allOk = results.every(r => r.ok);
  return new Response(JSON.stringify({ ok: allOk, tables: ['members','recruits','notices','war_surveys','boss_timers','config'], results }), {
    status: allOk ? 200 : 500,
    headers: { 'Content-Type': 'application/json' }
  });
}
