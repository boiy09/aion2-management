-- ================================================================
-- 아이온2 도태 — Supabase 전체 스키마
-- Supabase 대시보드 > SQL Editor 에서 전체 복붙 후 실행
-- 이미 존재하는 테이블/컬럼/정책은 자동으로 무시됩니다
-- ================================================================


-- ────────────────────────────────────────
-- 1. 테이블 생성
-- ────────────────────────────────────────

-- members 테이블 (길드원 정보)
CREATE TABLE IF NOT EXISTS members (
  id              TEXT PRIMARY KEY,
  nickname        TEXT,
  server          TEXT,
  rank            TEXT DEFAULT '',
  intro           TEXT DEFAULT '',
  is_main         BOOLEAN DEFAULT true,
  player_id       TEXT,
  class           TEXT DEFAULT '',
  level           INTEGER DEFAULT 0,
  combat_power    BIGINT DEFAULT 0,
  item_level      BIGINT DEFAULT 0,
  equipment       JSONB DEFAULT '[]',
  stats           JSONB DEFAULT '[]',
  daevanion       JSONB DEFAULT '[]',
  ranking         JSONB DEFAULT '[]',
  stigma          JSONB DEFAULT '[]',
  arcana          JSONB DEFAULT '[]',
  titles          JSONB DEFAULT '[]',
  pet             JSONB,
  wing            JSONB,
  server_name     TEXT DEFAULT '',
  guild_name      TEXT DEFAULT '',
  race            TEXT DEFAULT '',
  profile_img     TEXT DEFAULT '',
  character_id    TEXT DEFAULT '',
  last_synced     TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- recruits 테이블 (모집 공고)
CREATE TABLE IF NOT EXISTS recruits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT,
  type        TEXT DEFAULT '던전',
  author      TEXT,
  reqs        JSONB DEFAULT '[]',
  min_cp      TEXT DEFAULT '',
  slots       INTEGER DEFAULT 4,
  schedule    TEXT DEFAULT '',
  description TEXT DEFAULT '',
  applies     JSONB DEFAULT '[]',
  comments    JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- notices 테이블 (공지/패치노트)
CREATE TABLE IF NOT EXISTS notices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT DEFAULT '공지사항',
  version     TEXT DEFAULT '',
  title       TEXT,
  content     TEXT,
  author      TEXT DEFAULT '',
  views       INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- war_surveys 테이블 (길드전 참가 조사)
CREATE TABLE IF NOT EXISTS war_surveys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT,
  deadline    TEXT DEFAULT '',
  responses   JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- boss_timers 테이블 (보스 타이머)
CREATE TABLE IF NOT EXISTS boss_timers (
  id          TEXT PRIMARY KEY,
  kill_time   BIGINT,
  updated_at  TEXT
);

-- config 테이블 (시스템 설정)
CREATE TABLE IF NOT EXISTS config (
  key             TEXT PRIMARY KEY,
  latest_version  TEXT DEFAULT '',
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);


-- ────────────────────────────────────────
-- 2. 누락 컬럼 추가 (기존 DB 마이그레이션)
--    이미 있으면 자동 무시됩니다
-- ────────────────────────────────────────

ALTER TABLE members ADD COLUMN IF NOT EXISTS titles       JSONB DEFAULT '[]';
ALTER TABLE members ADD COLUMN IF NOT EXISTS server_name  TEXT DEFAULT '';
ALTER TABLE members ADD COLUMN IF NOT EXISTS guild_name   TEXT DEFAULT '';
ALTER TABLE members ADD COLUMN IF NOT EXISTS race         TEXT DEFAULT '';
ALTER TABLE members ADD COLUMN IF NOT EXISTS profile_img  TEXT DEFAULT '';
ALTER TABLE members ADD COLUMN IF NOT EXISTS character_id TEXT DEFAULT '';
ALTER TABLE members ADD COLUMN IF NOT EXISTS last_synced  TIMESTAMPTZ;
ALTER TABLE members ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE notices ADD COLUMN IF NOT EXISTS type         TEXT DEFAULT '공지사항';
ALTER TABLE notices ADD COLUMN IF NOT EXISTS version      TEXT DEFAULT '';
ALTER TABLE notices ADD COLUMN IF NOT EXISTS author       TEXT DEFAULT '';
ALTER TABLE notices ADD COLUMN IF NOT EXISTS views        INTEGER DEFAULT 0;

ALTER TABLE war_surveys ADD COLUMN IF NOT EXISTS deadline TEXT DEFAULT '';


-- ────────────────────────────────────────
-- 3. RLS (Row Level Security) 설정
--    길드 내부 전용 — anon 키로 전체 접근 허용
-- ────────────────────────────────────────

ALTER TABLE members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruits    ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices     ENABLE ROW LEVEL SECURITY;
ALTER TABLE war_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE boss_timers ENABLE ROW LEVEL SECURITY;
ALTER TABLE config      ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "public_all" ON members     FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_all" ON recruits    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_all" ON notices     FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_all" ON war_surveys FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_all" ON boss_timers FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "public_all" ON config      FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ────────────────────────────────────────
-- 4. Realtime 활성화
--    Supabase 대시보드 > Database > Replication 에서
--    아래 테이블들의 토글을 ON 해주세요:
--    members / recruits / notices / war_surveys / boss_timers / config
-- ────────────────────────────────────────
