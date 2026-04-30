export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const characterId = url.searchParams.get('characterId') || '';
  const nickname = url.searchParams.get('nickname') || '';
  // NC API는 숫자 serverId만 허용 — 서버명이 넘어오면 '2001' 기본값 사용
  const rawServerId = url.searchParams.get('serverId') || '';
  const serverId = /^\d+$/.test(rawServerId) ? rawServerId : '2001';
  const lite = url.searchParams.get('lite') === '1'; // 카드 미리보기용: info만 조회, equipment 제외
  const boardId = url.searchParams.get('boardId') || '';

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (!characterId && !nickname) {
    return new Response(JSON.stringify({ error: 'characterId 또는 nickname이 필요해요' }), { status: 400, headers: corsHeaders });
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://aion2.plaync.com/ko-kr/characters/index',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Origin': 'https://aion2.plaync.com',
  };

  // 닉네임으로 characterId(base64 문자열) 검색
  async function searchCharacterId(nick) {
    const res = await fetch(
      `https://aion2.plaync.com/ko-kr/api/search/aion2/search/v2/character?keyword=${encodeURIComponent(nick)}&serverId=${serverId}`,
      { headers }
    );
    const sd = await res.json();
    const list = sd?.list || sd?.result?.character?.list || [];
    const found = list.find(c => (c.name || c.characterName) === nick) || list[0];
    return { id: found ? (found.characterId || found.id || null) : null };
  }

  // boardId 모드: 데바니온 노드 데이터만 조회
  if (boardId) {
    try {
      let rawId = characterId ? decodeURIComponent(characterId) : null;
      if (!rawId && nickname) {
        const nick = decodeURIComponent(nickname);
        const sr = await searchCharacterId(nick);
        rawId = sr.id;
      }
      if (!rawId) {
        return new Response(JSON.stringify({ error: '캐릭터를 찾을 수 없어요', boardId }), { status: 400, headers: corsHeaders });
      }
      // characterId: 검색 API가 %3D 형태로 반환하므로 먼저 decode 후 encode (이중인코딩 방지)
      const cleanId = (() => { try { return decodeURIComponent(rawId); } catch(e) { return rawId; } })();
      // boardId: boardList의 id가 이미 11,12,13... 형태이므로 그대로 사용
      const bid = parseInt(boardId);
      const apiUrl = `https://aion2.plaync.com/api/character/daevanion/detail?lang=ko&characterId=${encodeURIComponent(cleanId)}&serverId=${serverId}&boardId=${bid}`;
      try {
        const r = await fetch(apiUrl, { headers });
        const text = await r.text();
        const d = JSON.parse(text);
        const nl = d.nodeList || [];
        if (nl.length > 0 || d.openStatEffectList) {
          return new Response(JSON.stringify({
            nodeList: nl,
            openStatEffectList: d.openStatEffectList || [],
            openSkillEffectList: d.openSkillEffectList || [],
          }), { headers: corsHeaders });
        }
        return new Response(JSON.stringify({ error: '노드 데이터 없음', keys: Object.keys(d).join(',') }), { headers: corsHeaders });
      } catch(e) {
        return new Response(JSON.stringify({ error: '노드 파싱 실패', detail: e.message }), { headers: corsHeaders });
      }
    } catch(err) {
      return new Response(JSON.stringify({ error: '노드 조회 실패', detail: err.message }), { status: 500, headers: corsHeaders });
    }
  }

  try {
    let rawId = characterId ? decodeURIComponent(characterId) : null;

    if (!rawId) {
      const nick = decodeURIComponent(nickname);
      const sr = await searchCharacterId(nick);
      rawId = sr.id;
      if (!rawId) throw new Error(`'${nick}' 캐릭터를 찾을 수 없어요`);
    }

    // lite 모드: info만 조회 (카드 미리보기용 — 직업/전투력/아이템레벨)
    // full 모드: info + equipment 병렬 조회 (상세 스펙용)
    let infoRes, equipData = {};
    if (lite) {
      infoRes = await fetch(
        `https://aion2.plaync.com/api/character/info?lang=ko&characterId=${encodeURIComponent(rawId)}&serverId=${serverId}`,
        { headers }
      );
    } else {
      const [_infoRes, _equipRes] = await Promise.all([
        fetch(`https://aion2.plaync.com/api/character/info?lang=ko&characterId=${encodeURIComponent(rawId)}&serverId=${serverId}`, { headers }),
        fetch(`https://aion2.plaync.com/api/character/equipment?lang=ko&characterId=${encodeURIComponent(rawId)}&serverId=${serverId}`, { headers }),
      ]);
      infoRes = _infoRes;
      const _equipData = await _equipRes.json();
      equipData = _equipData || {};
    }

    if (!infoRes.ok) {
      return new Response(JSON.stringify({ error: `NC 응답 오류: ${infoRes.status}` }), { status: 502, headers: corsHeaders });
    }

    const infoData  = await infoRes.json();
    const equip   = (!lite && equipData.equipment && equipData.equipment.equipmentList) ? equipData.equipment.equipmentList : [];
    const skins   = (!lite && equipData.equipment && equipData.equipment.skinList) ? equipData.equipment.skinList : [];
    const petwing = (!lite && equipData.petwing) ? equipData.petwing : {};
    const skillData = (!lite && equipData.skill) ? equipData.skill : null;

    const profile = (infoData && infoData.profile) ? infoData.profile : {};

    const classMap = {
      'Gladiator':'검성','Templar':'수호성',
      'Assassin':'살성','Ranger':'궁성',
      'Sorcerer':'마도성','Spiritmaster':'정령성',
      'Cleric':'치유성','Chanter':'호법성',
    };

    // slotPos 기준으로 skin 매핑
    const skinBySlot = {};
    skins.forEach(function(s) { skinBySlot[s.slotPos] = s; });

    const mapEquip = function(e) {
      const sk = skinBySlot[e.slotPos] || null;
      return {
        name:        e.name || '',
        slot:        e.slotPosName || e.slot || '',
        slotPos:     e.slotPos !== undefined ? e.slotPos : null,
        enchant:     e.enchantLevel || 0,
        exceed:      e.exceedLevel || 0,
        grade:       e.grade || '',
        icon:        e.icon || '',
        itemId:      e.itemId || e.id || 0,
        itemLevel:   e.itemLevel || 0,
        setName:     e.setItemName || '',
        itemStats:   e.mainStats || (e.itemStat   && (e.itemStat.statList   || e.itemStat.list   || [])) || [],
        itemOptions: e.subStats  || e.randomStats || (e.itemOption && (e.itemOption.optionList || e.itemOption.list || [])) || [],
        itemSouls:   (e.soulCrystal && (e.soulCrystal.crystalList || e.soulCrystal.list || [])) || [],
        potential:   e.potential || null,
        skin:        sk ? { name: sk.name || '', icon: sk.icon || '', grade: sk.grade || '' } : null,
      };
    };

    var petData  = null;
    var wingData = null;
    if (petwing && petwing.pet) {
      petData = { name: petwing.pet.name || '', icon: petwing.pet.icon || '', grade: petwing.pet.grade || '', level: petwing.pet.level || 0, slot: 'Pet', enchant: 0, exceed: 0 };
    }
    if (petwing && petwing.wing) {
      wingData = { name: petwing.wing.name || '', icon: petwing.wing.icon || '', grade: petwing.wing.grade || '', enchant: petwing.wing.enchantLevel || 0, slot: 'Wing', exceed: 0,
        skin: petwing.wingSkin ? { name: petwing.wingSkin.name || '', icon: petwing.wingSkin.icon || '' } : null };
    }

    var allRawSkills = [];
    var seenSkillNames = new Set();
    function addSkills(list, defaultType) {
      if (!list || !list.length) return;
      list.forEach(function(s) {
        var name = s.skillName || s.name || '';
        if (!name || seenSkillNames.has(name)) return;
        seenSkillNames.add(name);
        allRawSkills.push({ _s: s, _defaultType: defaultType });
      });
    }
    addSkills(skillData && skillData.skillList, '');
    addSkills(infoData && infoData.skill && infoData.skill.skillList, '');
    addSkills(infoData && infoData.stigma && infoData.stigma.skillList, 'stigma');
    var skillList = allRawSkills.map(function(item) {
      var s = item._s;
      return { name: s.skillName||s.name||'', icon: s.skillIcon||s.icon||'', level: s.skillLevel||s.level||0,
        type: s.skillType||s.type||s.category||s.skillCategory||s.typeName||item._defaultType||'', effect: '' };
    });

    var statList = (infoData && infoData.stat && infoData.stat.statList) ? infoData.stat.statList : [];
    var itemLevelStat = statList.find(function(s) { return s.type === 'ItemLevel'; });
    var itemLevel = itemLevelStat ? (itemLevelStat.value || 0) : 0;
    var arcanaList = equip.filter(function(e) { return (e.slotPosName||'').indexOf('Arcana') !== -1; }).map(mapEquip);
    var daevList   = (infoData && infoData.daevanion && infoData.daevanion.boardList) ? infoData.daevanion.boardList : [];
    // ranking — character info API (rank, point per content)
    var rankRaw  = infoData && (infoData.ranking || infoData.abyssRanking
                  || infoData.rankingInfo || infoData.pvpRanking || {});
    var rankList = [];
    if (Array.isArray(rankRaw)) {
      rankList = rankRaw;
    } else if (rankRaw) {
      rankList = rankRaw.rankingList || rankRaw.rankingContentsList
              || rankRaw.contents    || rankRaw.content
              || rankRaw.list        || rankRaw.items || [];
    }
    // filter: only items with rank data
    rankList = rankList.filter(function(r) { return r.rank || r.point; });

    // NC ranking list API에서 grade/icon 데이터 보강
    // character info의 gradeName/gradeIcon은 null → 별도 ranking list API 호출 필요
    const CDN_GRADE = 'https://assets.playnccdn.com/static-aion2-gamedata/resources/';

    // 어비스(type 1) rank → grade (rank-based 구간 경계)
    function abyssGradeByRank(rank) {
      if (!rank) return null;
      if (rank === 1)              return { name:'총사령관', icon:'UT_Ranking_Grade_Abyss_Chief_Commander_02.png' };
      if (rank === 2)              return { name:'사령관',   icon:'UT_Ranking_Grade_Abyss_Chief_Commander_01.png' };
      if (rank <= 4)               return { name:'대장군',   icon:'UT_Ranking_Grade_Abyss_General_02.png' };
      if (rank <= 6)               return { name:'장군',     icon:'UT_Ranking_Grade_Abyss_General_01.png' };
      if (rank <= 20)              return { name:'5성장교',  icon:'UT_Ranking_Grade_Abyss_Officer_05.png' };
      if (rank <= 40)              return { name:'4성장교',  icon:'UT_Ranking_Grade_Abyss_Officer_04.png' };
      if (rank <= 70)              return { name:'3성장교',  icon:'UT_Ranking_Grade_Abyss_Officer_03.png' };
      if (rank <= 100)             return { name:'2성장교',  icon:'UT_Ranking_Grade_Abyss_Officer_02.png' };
      if (rank <= 130)             return { name:'1성장교',  icon:'UT_Ranking_Grade_Abyss_Officer_01.png' };
      return null; // 병사/훈련병은 아이콘 없음
    }

    // 악몽(type 3) rank → grade
    function nightmareGradeByRank(rank) {
      if (!rank) return null;
      if (rank === 1)  return { name:'챌린저1',    icon:'UT_Arena_Ranking_Grade_Challenger_01.png' };
      if (rank <= 3)   return { name:'챌린저2',    icon:'UT_Arena_Ranking_Grade_Challenger_02.png' };
      if (rank <= 5)   return { name:'챌린저3',    icon:'UT_Arena_Ranking_Grade_Challenger_03.png' };
      if (rank <= 10)  return { name:'그랜드마스터',icon:'UT_Arena_Ranking_Grade_GrandMaster.png' };
      if (rank <= 20)  return { name:'마스터',     icon:'UT_Arena_Ranking_Grade_Master.png' };
      if (rank <= 50)  return { name:'다이아몬드', icon:'UT_Arena_Ranking_Grade_Diamond.png' };
      if (rank <= 100) return { name:'플래티넘',   icon:'UT_Arena_Ranking_Grade_Platinum.png' };
      return null;
    }

    // 초월(type 4) / 각성전(type 21): point-based, top 100에서만 정확한 grade 획득
    function arenaGradeByRank(rank) {
      if (!rank) return null;
      if (rank === 1)  return { name:'그랜드마스터',icon:'UT_Arena_Ranking_Grade_GrandMaster.png' };
      if (rank <= 5)   return { name:'마스터',     icon:'UT_Arena_Ranking_Grade_Master.png' };
      if (rank <= 20)  return { name:'다이아몬드', icon:'UT_Arena_Ranking_Grade_Diamond.png' };
      if (rank <= 50)  return { name:'플래티넘',   icon:'UT_Arena_Ranking_Grade_Platinum.png' };
      if (rank <= 100) return { name:'골드',       icon:'UT_Arena_Ranking_Grade_Gold.png' };
      return null;
    }

    function fallbackGrade(type, rank) {
      if (type === 1)  return abyssGradeByRank(rank);
      if (type === 3)  return nightmareGradeByRank(rank);
      if (type === 4 || type === 21) return arenaGradeByRank(rank);
      return null;
    }

    var gradeMap = {};
    var classRankMap = {};
    try {
      var contentTypes = [];
      rankList.forEach(function(r) {
        if (r.rankingContentsType && contentTypes.indexOf(r.rankingContentsType) === -1) {
          contentTypes.push(r.rankingContentsType);
        }
      });

      await Promise.allSettled(contentTypes.map(async function(type) {
        var res = await fetch(
          'https://aion2.plaync.com/api/ranking/list?lang=ko&rankingContentsType='+type+'&rankingType=0&serverId='+serverId+'&pageSize=100',
          { headers }
        );
        var data = await res.json();
        var list = data.rankingList || [];
        var found = list.find(function(r) { return r.characterId === rawId; });
        if (found && found.gradeName) {
          gradeMap[type] = { gradeName: found.gradeName, gradeIcon: found.gradeIcon || '' };
        }
        // 직업별 랭킹: found.classId 우선, 없으면 profile의 className으로 추정
        if (type === 1) {
          const classNameToId = {
            Gladiator:1, Templar:2, Assassin:3, Ranger:4,
            Sorcerer:5, Spiritmaster:6, Cleric:7, Chanter:9,
          };
          var charClassId = (found && found.classId)
            || classNameToId[profile.className]
            || 0;
          if (charClassId) {
            var cres = await fetch(
              'https://aion2.plaync.com/api/ranking/list?lang=ko&rankingContentsType=1&rankingType=1&serverId='+serverId+'&classId='+charClassId+'&pageSize=100',
              { headers }
            );
            var cdata = await cres.json();
            var clist = cdata.rankingList || [];
            var cfound = clist.find(function(r) { return r.characterId === rawId; });
            if (cfound) classRankMap[1] = cfound.rank || 0;
          }
        }
      }));
    } catch(e) {}

    function absUrl(u) { return (u && typeof u==='string' && !u.startsWith('http')) ? 'https://aion2.plaync.com'+u : (u||''); }

    rankList = rankList.map(function(r) {
      var type = r.rankingContentsType;
      var apiGrade = gradeMap[type];
      var baseRank  = r.rank  || r.totalRank  || r.overallRank || 0;
      var basePoint = r.point || r.rankPoint  || r.totalPoint  || r.score || 0;
      var contentsName = r.rankingContentsName || '';
      // top 100 grade 우선, 없으면 rank-based 추정
      var computed = apiGrade || fallbackGrade(type, baseRank) || {};
      var gradeName = computed.gradeName || computed.name || '';
      var gradeIcon = computed.gradeIcon ? absUrl(computed.gradeIcon)
                    : (computed.icon ? CDN_GRADE + computed.icon : '');
      var classRank = (type === 1 && classRankMap[1]) ? classRankMap[1] : 0;
      var prevRank  = r.prevRank || 0;
      var rankChange = r.rankChange || (prevRank && baseRank ? prevRank - baseRank : 0);
      return {
        rankingContentsType: type,
        rankingContentsName: contentsName,
        rank:        baseRank,
        point:       basePoint,
        gradeName:   gradeName,
        gradeIcon:   gradeIcon,
        classRank:   classRank,
        classId:     r.classId || 0,
        rankChange:  rankChange,
        extraDataMap: r.extraDataMap || null,
      };
    });

    var rankingDebug = rankList.length === 0 ? rankRaw : null;
    var titleRaw       = (infoData && infoData.title) ? infoData.title : {};
    var titleList      = titleRaw.titleList      || [];
    var titleGroupList = titleRaw.titleGroupList || titleRaw.groupList || [];

    const result = {
      characterId:  rawId,
      serverId,
      nickname:     profile.characterName || '',
      class:        classMap[profile.className] || profile.className || '',
      level:        profile.characterLevel || 0,
      combat_power: profile.combatPower || 0,
      item_level:   itemLevel,
      server_name:  profile.serverName || '',
      guild_name:   profile.regionName || '',
      race:         profile.raceName   || '',
      profile_img:  (() => { const r = profile.profileImage || ''; return r ? (r.startsWith('http') ? r : 'https://aion2.plaync.com' + r) : ''; })(),
      equipment:    equip.map(mapEquip),
      stats:        statList,
      daevanion:    daevList,
      ranking:      rankList,
      ranking_debug: rankingDebug,  // rankList 비었을 때 원본 구조 확인용
      titles:       titleGroupList.length ? titleGroupList : titleList,
      stigma:       skillList,
      arcana:       arcanaList,
      pet:          petData,
      wing:         wingData,
    };

    return new Response(JSON.stringify(result), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: '조회 실패', detail: err.message }), { status: 500, headers: corsHeaders });
  }
}
