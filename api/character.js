module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { characterId, nickname, serverId = '2001' } = req.query;
  if (!characterId && !nickname) return res.status(400).json({ error: 'characterId 또는 nickname이 필요해요' });

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://aion2.plaync.com/ko-kr/characters/index',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Origin': 'https://aion2.plaync.com',
  };

  try {
    let rawId = characterId ? decodeURIComponent(characterId) : null;

    // characterId 없으면 닉네임으로 검색
    if (!rawId) {
      const nick = decodeURIComponent(nickname);
      const searchRes = await fetch(
        `https://aion2.plaync.com/ko-kr/api/search/aion2/search/v2/character?keyword=${encodeURIComponent(nick)}&serverId=${serverId}`,
        { headers }
      );
      const searchData = await searchRes.json();
      const list = searchData?.result?.character?.list || searchData?.list || [];
      const found = list.find(c => c.characterName === nick || c.name === nick) || list[0];
      if (!found) throw new Error(`'${nick}' 캐릭터를 찾을 수 없어요`);
      rawId = String(found.characterId || found.id || '');
    }

    const [infoRes, equipRes] = await Promise.all([
      fetch(`https://aion2.plaync.com/api/character/info?lang=ko&characterId=${encodeURIComponent(rawId)}&serverId=${serverId}`, { headers }),
      fetch(`https://aion2.plaync.com/api/character/equipment?lang=ko&characterId=${encodeURIComponent(rawId)}&serverId=${serverId}`, { headers }),
    ]);

    if (!infoRes.ok) return res.status(502).json({ error: `NC 응답 오류: ${infoRes.status}` });

    const infoData  = await infoRes.json();
    const equipData = await equipRes.json();

    const profile = (infoData && infoData.profile) ? infoData.profile : {};
    const equip   = (equipData && equipData.equipment && equipData.equipment.equipmentList) ? equipData.equipment.equipmentList : [];
    const petwing = (equipData && equipData.petwing) ? equipData.petwing : {};
    const skillData = (equipData && equipData.skill) ? equipData.skill : null;

    const classMap = {
      'Gladiator':'검성','Templar':'수호성',
      'Assassin':'살성','Ranger':'궁성',
      'Sorcerer':'마도성','Spiritmaster':'정령성',
      'Cleric':'치유성','Chanter':'호법성',
    };

    const mapEquip = function(e) {
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
      };
    };

    // 펫/날개
    var petData  = null;
    var wingData = null;
    if (petwing && petwing.pet) {
      petData = {
        name: petwing.pet.name || '',
        icon: petwing.pet.icon || '',
        grade: petwing.pet.grade || '',
        level: petwing.pet.level || 0,
        slot: 'Pet', enchant: 0, exceed: 0
      };
    }
    if (petwing && petwing.wing) {
      wingData = {
        name: petwing.wing.name || '',
        icon: petwing.wing.icon || '',
        grade: petwing.wing.grade || '',
        enchant: petwing.wing.enchantLevel || 0,
        slot: 'Wing', exceed: 0,
        skin: petwing.wingSkin ? {
          name: petwing.wingSkin.name || '',
          icon: petwing.wingSkin.icon || ''
        } : null
      };
    }

    // 스킬: 여러 소스 합치고 type 저장, 중복 제거
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
      return {
        name:   s.skillName   || s.name   || '',
        icon:   s.skillIcon   || s.icon   || '',
        level:  s.skillLevel  || s.level  || 0,
        type:   s.skillType   || s.type   || s.category || s.skillCategory || s.typeName || item._defaultType || '',
        effect: '',  // NC API에서 스킬 효과 텍스트 미제공
      };
    });
    var statList = (infoData && infoData.stat && infoData.stat.statList) ? infoData.stat.statList : [];
    var itemLevelStat = statList.find(function(s) { return s.type === 'ItemLevel'; });
    var itemLevel = itemLevelStat ? (itemLevelStat.value || 0) : 0;
    var arcanaList = equip.filter(function(e) { return (e.slotPosName||'').indexOf('Arcana') !== -1; }).map(mapEquip);
    var daevList   = (infoData && infoData.daevanion && infoData.daevanion.boardList) ? infoData.daevanion.boardList : [];
    var rankList   = (infoData && infoData.ranking   && infoData.ranking.rankingList)   ? infoData.ranking.rankingList   : [];
    var titleRaw       = (infoData && infoData.title) ? infoData.title : {};
    var titleList      = titleRaw.titleList      || [];
    var titleGroupList = titleRaw.titleGroupList || titleRaw.groupList || [];

    res.status(200).json({
      characterId:  rawId,
      serverId,
      nickname:     profile.characterName || '',  // 최신 닉네임 반환
      class:        classMap[profile.className] || profile.className || '',
      level:        profile.characterLevel || 0,
      combat_power: profile.combatPower || 0,
      item_level:   itemLevel,
      server_name:  profile.serverName || '',
      guild_name:   profile.regionName || '',
      race:         profile.raceName   || '',
      profile_img:  profile.profileImage || '',
      equipment:    equip.map(mapEquip),
      stats:        statList,
      daevanion:    daevList,
      ranking:      rankList,
      titles:       titleGroupList.length ? titleGroupList : titleList,
      stigma:       skillList,
      arcana:       arcanaList,
      pet:          petData,
      wing:         wingData,
    });
  } catch (err) {
    res.status(500).json({ error: '조회 실패', detail: err.message });
  }
}

// 아이템 상세 조회 핸들러는 별도 파일로 분리
