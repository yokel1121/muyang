(async () => {
  const data = await loadGaokaoData();
  const schools = data.universities;
  const provinces = data.provinces;
  const number = new Intl.NumberFormat("zh-CN");
  const basketKey = "muyang-gaokao-basket";
  const admissionKey = "muyang-admission-history-v1";
  let admissionRecords = loadAdmissionRecords();
  let admissionIndex = buildAdmissionIndex(admissionRecords);
  const majorScoreBasePath = "data/major-scores/";
  const subjectLabels = ["物理", "历史", "综合"];
  const levelLabels = ["本科", "专科"];
  const majorScoreState = {
    manifest: null,
    province: "",
    loading: false,
    error: "",
    data: null,
    records: [],
    bySchool: new Map(),
    cache: new Map(),
    schoolHistoryCache: new Map(),
  };
  let majorScoreLoadToken = 0;
  const majorMetaCache = new Map();

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const state = {
    score: 586,
    homeProvince: "河南省",
    subject: "物理",
    targetProvince: "全部",
    activeProvince: "全部",
    level: "全部",
    ownership: "全部",
    domain: "全部",
    risk: 48,
    search: "",
    sort: "fit",
    plan: "rush",
    mapCollapsed: false,
    basket: loadBasket(),
    riasec: { R: 46, I: 64, A: 42, S: 58, E: 52, C: 48 },
  };

  const riasecDefs = [
    { code: "R", name: "现实型", hint: "工程、制造、农林", domains: ["理工", "农林", "应用技术"] },
    { code: "I", name: "研究型", hint: "科研、医学、数据", domains: ["理工", "医药", "综合"] },
    { code: "A", name: "艺术型", hint: "设计、传媒、语言", domains: ["艺术传媒", "语言"] },
    { code: "S", name: "社会型", hint: "教育、健康、公共服务", domains: ["师范", "医药", "政法"] },
    { code: "E", name: "企业型", hint: "商业、法律、传播", domains: ["财经", "政法", "艺术传媒"] },
    { code: "C", name: "常规型", hint: "金融、运营、信息管理", domains: ["财经", "应用技术"] },
  ];

  const majorCatalog = [
    { name: "计算机科学与技术", level: "本科", category: "工学", domains: ["理工", "应用技术"], subjects: ["物理", "理科", "综合"], riasec: ["I", "R", "C"], scoreLine: 590, trend: "高热", careers: ["软件开发", "算法工程", "信息系统"], note: "适合数学逻辑强、愿意持续迭代技术栈的考生。" },
    { name: "人工智能", level: "本科", category: "工学", domains: ["理工"], subjects: ["物理", "理科", "综合"], riasec: ["I", "R"], scoreLine: 610, trend: "上升", careers: ["机器学习", "智能制造", "数据产品"], note: "对数学、编程和英文资料阅读要求较高。" },
    { name: "软件工程", level: "本科", category: "工学", domains: ["理工", "应用技术"], subjects: ["物理", "理科", "综合"], riasec: ["I", "C", "R"], scoreLine: 575, trend: "稳定", careers: ["后端开发", "测试开发", "架构助理"], note: "更看重项目实践和工程协作能力。" },
    { name: "数据科学与大数据技术", level: "本科", category: "工学", domains: ["理工", "财经"], subjects: ["物理", "理科", "综合"], riasec: ["I", "C"], scoreLine: 580, trend: "上升", careers: ["数据分析", "数据工程", "商业智能"], note: "适合喜欢用模型和数据解释问题的考生。" },
    { name: "网络空间安全", level: "本科", category: "工学", domains: ["理工", "政法"], subjects: ["物理", "理科", "综合"], riasec: ["I", "R", "C"], scoreLine: 595, trend: "上升", careers: ["安全工程", "等保测评", "攻防研究"], note: "需要扎实的计算机基础和规则意识。" },
    { name: "电子信息工程", level: "本科", category: "工学", domains: ["理工"], subjects: ["物理", "理科", "综合"], riasec: ["R", "I"], scoreLine: 570, trend: "稳定", careers: ["硬件开发", "通信工程", "嵌入式"], note: "适合动手能力强、能接受电路和信号课程的考生。" },
    { name: "电气工程及其自动化", level: "本科", category: "工学", domains: ["理工"], subjects: ["物理", "理科", "综合"], riasec: ["R", "I", "C"], scoreLine: 585, trend: "稳定", careers: ["电网", "新能源", "自动化控制"], note: "就业口径宽，物理基础越扎实越有优势。" },
    { name: "机械设计制造及其自动化", level: "本科", category: "工学", domains: ["理工", "应用技术"], subjects: ["物理", "理科", "综合"], riasec: ["R", "I"], scoreLine: 535, trend: "稳定", careers: ["机械设计", "智能制造", "工艺工程"], note: "适合愿意进入制造、装备和工程现场的考生。" },
    { name: "航空航天类", level: "本科", category: "工学", domains: ["理工"], subjects: ["物理", "理科", "综合"], riasec: ["I", "R"], scoreLine: 620, trend: "高门槛", careers: ["飞行器设计", "结构仿真", "航天系统"], note: "院校集中度高，适合高分段冲刺和强理工兴趣。" },
    { name: "土木工程", level: "本科", category: "工学", domains: ["理工"], subjects: ["物理", "理科", "综合"], riasec: ["R", "C"], scoreLine: 505, trend: "分化", careers: ["结构设计", "工程管理", "城市更新"], note: "建议重点比较院校行业资源和城市平台。" },
    { name: "临床医学", level: "本科", category: "医学", domains: ["医药"], subjects: ["物理", "理科", "综合"], riasec: ["I", "S", "R"], scoreLine: 615, trend: "高热", careers: ["临床医生", "医学科研", "公共卫生"], note: "培养周期长，需确认专业组和身体条件要求。" },
    { name: "口腔医学", level: "本科", category: "医学", domains: ["医药"], subjects: ["物理", "理科", "综合"], riasec: ["I", "S", "R"], scoreLine: 625, trend: "高热", careers: ["口腔医生", "正畸", "口腔修复"], note: "录取线通常较高，适合作为高位冲刺或稳妥专业。" },
    { name: "药学", level: "本科", category: "医学", domains: ["医药", "理工"], subjects: ["物理", "理科", "综合"], riasec: ["I", "C"], scoreLine: 545, trend: "稳定", careers: ["药物研发", "药企注册", "医院药学"], note: "化学、生物基础会影响后续学习体验。" },
    { name: "护理学", level: "本科", category: "医学", domains: ["医药"], subjects: ["物理", "历史", "理科", "文科", "综合"], riasec: ["S", "C"], scoreLine: 500, trend: "刚需", careers: ["临床护理", "护理管理", "健康管理"], note: "适合服务意识强、抗压能力好的考生。" },
    { name: "法学", level: "本科", category: "法学", domains: ["政法", "综合"], subjects: ["历史", "文科", "综合", "物理", "理科"], riasec: ["E", "S", "C"], scoreLine: 585, trend: "热门", careers: ["律师", "公务员", "企业法务"], note: "建议同时关注法考、院校法学平台和城市实习资源。" },
    { name: "汉语言文学", level: "本科", category: "文学", domains: ["语言", "师范", "综合"], subjects: ["历史", "文科", "综合"], riasec: ["A", "S", "C"], scoreLine: 555, trend: "稳定", careers: ["语文教师", "编辑策划", "公务员"], note: "适合阅读写作能力强、表达稳定的考生。" },
    { name: "新闻传播学类", level: "本科", category: "文学", domains: ["艺术传媒", "语言"], subjects: ["历史", "文科", "综合"], riasec: ["A", "E", "S"], scoreLine: 545, trend: "转型", careers: ["内容运营", "品牌传播", "媒体策划"], note: "应重点比较实践平台、城市媒体资源和复合技能课程。" },
    { name: "师范类", level: "本科", category: "教育学", domains: ["师范"], subjects: ["历史", "文科", "物理", "理科", "综合"], riasec: ["S", "A", "C"], scoreLine: 550, trend: "稳定", careers: ["中小学教师", "教研", "教育管理"], note: "要区分公费师范、普通师范和非师范培养口径。" },
    { name: "学前教育", level: "本科", category: "教育学", domains: ["师范"], subjects: ["历史", "文科", "综合"], riasec: ["S", "A"], scoreLine: 485, trend: "刚需", careers: ["幼儿教师", "课程研发", "儿童发展"], note: "适合耐心强、愿意长期做儿童教育服务的考生。" },
    { name: "会计学", level: "本科", category: "管理学", domains: ["财经"], subjects: ["历史", "文科", "物理", "理科", "综合"], riasec: ["C", "E"], scoreLine: 535, trend: "稳定", careers: ["审计", "财务管理", "税务"], note: "适合细致、规则感强且愿意考证的考生。" },
    { name: "金融学", level: "本科", category: "经济学", domains: ["财经"], subjects: ["历史", "文科", "物理", "理科", "综合"], riasec: ["E", "C", "I"], scoreLine: 565, trend: "分化", careers: ["银行", "投研助理", "风控"], note: "城市平台和数学统计能力对发展影响很大。" },
    { name: "信息管理与信息系统", level: "本科", category: "管理学", domains: ["财经", "应用技术", "理工"], subjects: ["物理", "理科", "综合"], riasec: ["C", "I", "E"], scoreLine: 530, trend: "稳定", careers: ["产品经理", "系统分析", "数字化运营"], note: "适合想把管理、数据和技术结合起来的考生。" },
    { name: "数字媒体技术", level: "本科", category: "工学", domains: ["艺术传媒", "理工", "应用技术"], subjects: ["物理", "理科", "综合"], riasec: ["A", "I", "R"], scoreLine: 540, trend: "上升", careers: ["交互开发", "游戏技术", "可视化"], note: "兼具审美和技术要求，适合复合型兴趣。" },
    { name: "视觉传达设计", level: "本科", category: "艺术学", domains: ["艺术传媒"], subjects: ["历史", "文科", "综合", "物理", "理科"], riasec: ["A", "E"], scoreLine: 490, trend: "稳定", careers: ["品牌设计", "UI设计", "视觉策划"], note: "需核对是否按艺术类招生及校考、省统考要求。" },
    { name: "农学", level: "本科", category: "农学", domains: ["农林"], subjects: ["物理", "理科", "综合"], riasec: ["I", "R"], scoreLine: 470, trend: "政策支持", careers: ["种业", "农业科研", "乡村产业"], note: "适合重视科研、食品安全和现代农业方向的考生。" },
    { name: "动物医学", level: "本科", category: "农学", domains: ["农林", "医药"], subjects: ["物理", "理科", "综合"], riasec: ["I", "S", "R"], scoreLine: 505, trend: "上升", careers: ["宠物医疗", "动保", "检验检疫"], note: "学习强度不低，要确认自己能接受医学基础课程。" },
    { name: "大数据与会计", level: "专科", category: "财经商贸", domains: ["财经", "应用技术"], subjects: ["历史", "文科", "物理", "理科", "综合"], riasec: ["C", "E"], scoreLine: 420, trend: "稳定", careers: ["会计助理", "财税服务", "数据核算"], note: "适合希望尽快形成职业技能并继续专升本的考生。" },
    { name: "智能制造装备技术", level: "专科", category: "装备制造", domains: ["应用技术", "理工"], subjects: ["物理", "理科", "综合"], riasec: ["R", "C"], scoreLine: 415, trend: "上升", careers: ["设备运维", "自动化产线", "数控技术"], note: "建议选择实训条件强、校企合作稳定的院校。" },
    { name: "护理", level: "专科", category: "医药卫生", domains: ["医药", "应用技术"], subjects: ["历史", "文科", "物理", "理科", "综合"], riasec: ["S", "C"], scoreLine: 405, trend: "刚需", careers: ["临床护理", "康复护理", "养老服务"], note: "要关注实习医院、执业资格通过率和身体条件要求。" },
  ];

  async function loadGaokaoData() {
    if (window.GAOKAO_DATA) return normalizeGaokaoData(window.GAOKAO_DATA);
    if (!window.GAOKAO_DATA_COMPRESSED) throw new Error("缺少高校数据");
    const compressed = Uint8Array.from(atob(window.GAOKAO_DATA_COMPRESSED), (char) => char.charCodeAt(0));
    if (!("DecompressionStream" in window)) {
      throw new Error("当前浏览器不支持数据解压，请使用新版 Chrome、Edge、Firefox 或 Safari。");
    }
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
    const text = await new Response(stream).text();
    return normalizeGaokaoData(JSON.parse(text));
  }

  function normalizeGaokaoData(raw) {
    if (raw.universities) return raw;
    const universities = raw.schools.map((row) => {
      const school = {
        id: row[0],
        name: row[1],
        code: row[2],
        department: row[3],
        city: row[4],
        level: row[5],
        remark: row[6],
        province: row[7],
        scoreLine: row[8],
      };
      school.ownership = schoolOwnership(school.remark);
      school.domains = schoolDomains(school.name);
      school.rankLine = Math.max(350, Math.min(520000, Math.pow(746 - school.scoreLine, 2) * 12 + stableHash(school.code) % 9000));
      school.rankLine = Math.round(school.rankLine);
      school.profile = schoolProfile(school);
      const quickTags = [school.level, school.ownership, school.profile, ...school.domains.slice(0, 2)];
      if (["教育部", "工业和信息化部", "交通运输部", "公安部", "司法部", "应急管理部", "中国科学院"].includes(school.department)) {
        quickTags.push("部属");
      }
      school.tags = Array.from(new Set(quickTags));
      return school;
    });
    return { ...raw, universities };
  }

  function stableHash(text) {
    let value = 0;
    for (const char of String(text)) value = (value * 131 + char.charCodeAt(0)) % 1000003;
    return value;
  }

  function schoolDomains(name) {
    const rules = [
      ["医药", ["医", "中医", "药", "护理", "卫生"]],
      ["师范", ["师范", "教育"]],
      ["财经", ["财经", "经济", "金融", "工商", "商业", "管理"]],
      ["政法", ["政法", "公安", "警察", "司法"]],
      ["理工", ["理工", "工业", "科技", "工程", "交通", "航空", "航天", "电子", "邮电", "电力", "石油", "矿业", "建筑", "水利", "海事"]],
      ["农林", ["农业", "农林", "林业", "牧", "水产"]],
      ["艺术传媒", ["艺术", "音乐", "戏剧", "美术", "传媒", "电影", "舞蹈"]],
      ["体育", ["体育"]],
      ["语言", ["外国语", "语言"]],
      ["民族", ["民族"]],
      ["海洋", ["海洋"]],
    ];
    const tags = rules.filter(([, keys]) => keys.some((key) => name.includes(key))).map(([label]) => label);
    if (name.includes("职业") || name.includes("技术") || name.includes("专科")) tags.push("应用技术");
    return tags.length ? tags : ["综合"];
  }

  function schoolOwnership(remark) {
    if (remark.includes("民办")) return "民办";
    if (remark.includes("合作办学") || remark.includes("境外")) return "合作办学";
    return "公办";
  }

  function schoolProfile(school) {
    if (school.level === "专科") return "职业技能";
    if (school.scoreLine >= 600 || ["教育部", "工业和信息化部", "中国科学院"].includes(school.department)) return "研究型";
    if (school.name.includes("职业") || school.name.includes("技术")) return "应用型";
    return "教学型";
  }

  function majorDomains(name, level = "") {
    const cacheKey = `${name}|${level}`;
    if (majorMetaCache.has(cacheKey)) return majorMetaCache.get(cacheKey).domains;
    const rules = [
      ["医药", ["医学", "临床", "口腔", "护理", "药", "康复", "麻醉", "影像", "检验", "中医", "针灸", "卫生", "预防"]],
      ["师范", ["师范", "教育", "学前", "小学教育", "特殊教育"]],
      ["财经", ["经济", "金融", "会计", "财务", "审计", "税收", "财政", "贸易", "商务", "工商", "市场营销", "保险"]],
      ["政法", ["法学", "公安", "警", "司法", "侦查", "治安", "思想政治"]],
      ["理工", ["计算机", "软件", "人工智能", "数据", "网络", "信息", "电子", "通信", "电气", "自动化", "机械", "车辆", "能源", "材料", "化学", "数学", "物理", "统计", "土木", "建筑", "交通", "环境", "测绘", "航空", "航天", "水利", "海洋", "安全工程"]],
      ["农林", ["农", "林", "园艺", "园林", "动物", "植物", "水产", "草业", "茶学"]],
      ["艺术传媒", ["艺术", "设计", "美术", "音乐", "舞蹈", "戏剧", "播音", "动画", "传媒", "新闻", "广告", "数字媒体", "影视"]],
      ["语言", ["语言", "英语", "日语", "俄语", "法语", "德语", "翻译", "汉语言", "中国语言文学"]],
      ["应用技术", ["技术", "工程技术", "装备", "制造", "物流", "电子商务", "旅游", "酒店", "烹饪", "汽车", "机电"]],
    ];
    const domains = rules.filter(([, keys]) => keys.some((key) => name.includes(key))).map(([domain]) => domain);
    if (level === "专科" && !domains.includes("应用技术")) domains.push("应用技术");
    const result = Array.from(new Set(domains.length ? domains : ["综合"]));
    majorMetaCache.set(cacheKey, { domains: result, category: inferMajorCategory(result, name, level) });
    return result;
  }

  function majorCategory(name, level = "") {
    const cacheKey = `${name}|${level}`;
    if (!majorMetaCache.has(cacheKey)) majorDomains(name, level);
    return majorMetaCache.get(cacheKey).category;
  }

  function inferMajorCategory(domains, name, level) {
    if (level === "专科") {
      if (domains.includes("医药")) return "医药卫生";
      if (domains.includes("财经")) return "财经商贸";
      if (domains.includes("艺术传媒")) return "文化艺术";
      if (domains.includes("农林")) return "农林牧渔";
      return "职业技能";
    }
    if (domains.includes("医药")) return "医学";
    if (domains.includes("理工")) return "工学/理学";
    if (domains.includes("财经")) return "经济管理";
    if (domains.includes("政法")) return "法学";
    if (domains.includes("师范")) return "教育学";
    if (domains.includes("语言")) return "文学";
    if (domains.includes("农林")) return "农学";
    if (domains.includes("艺术传媒")) return "艺术/传媒";
    return name.includes("管理") ? "管理学" : "综合";
  }

  function majorRiasecCodes(domains, name) {
    const map = {
      理工: ["I", "R", "C"],
      医药: ["I", "S"],
      财经: ["C", "E"],
      师范: ["S", "A", "C"],
      政法: ["E", "S", "C"],
      艺术传媒: ["A", "E"],
      语言: ["A", "S"],
      农林: ["R", "I"],
      应用技术: ["R", "C"],
      综合: ["I", "S"],
    };
    const codes = domains.flatMap((domain) => map[domain] || []);
    if (/计算机|软件|数据|人工智能/.test(name)) codes.push("I", "C");
    if (/管理|会计|审计|金融/.test(name)) codes.push("C", "E");
    return Array.from(new Set(codes.length ? codes : ["I", "S"]));
  }

  const selectors = {
    scoreInput: $("#scoreInput"),
    scoreRange: $("#scoreRange"),
    homeProvince: $("#homeProvince"),
    subjectSelect: $("#subjectSelect"),
    targetProvince: $("#targetProvince"),
    levelFilter: $("#levelFilter"),
    ownershipFilter: $("#ownershipFilter"),
    domainFilter: $("#domainFilter"),
    riskRange: $("#riskRange"),
    riskOutput: $("#riskOutput"),
    admissionFile: $("#admissionFile"),
    admissionDataStatus: $("#admissionDataStatus"),
    admissionDataNote: $("#admissionDataNote"),
    majorScoreStatus: $("#majorScoreStatus"),
    admissionSourceNote: $("#admissionSourceNote"),
    downloadAdmissionTemplate: $("#downloadAdmissionTemplate"),
    clearAdmissionData: $("#clearAdmissionData"),
    totalSchools: $("#totalSchools"),
    undergraduateSchools: $("#undergraduateSchools"),
    vocationalSchools: $("#vocationalSchools"),
    dataNote: $("#dataNote"),
    mapPanel: $(".map-panel"),
    toggleMap: $("#toggleMap"),
    provinceMap: $("#provinceMap"),
    activeProvinceLabel: $("#activeProvinceLabel"),
    activeProvinceTotal: $("#activeProvinceTotal"),
    undergradBar: $("#undergradBar"),
    vocationalBar: $("#vocationalBar"),
    undergradCount: $("#undergradCount"),
    vocationalCount: $("#vocationalCount"),
    searchInput: $("#searchInput"),
    resultCount: $("#resultCount"),
    sortSelect: $("#sortSelect"),
    schoolList: $("#schoolList"),
    recommendList: $("#recommendList"),
    riasecGrid: $("#riasecGrid"),
    riasecResult: $("#riasecResult"),
    majorSummary: $("#majorSummary"),
    majorList: $("#majorList"),
    basketList: $("#basketList"),
    schoolDialog: $("#schoolDialog"),
    dialogBody: $("#dialogBody"),
  };

  function init() {
    fillSelects();
    renderMap();
    renderRiasecControls();
    bindEvents();
    renderAll();
    refreshMajorScoreData();
  }

  function fillSelects() {
    const provinceOptions = provinces
      .map((item) => `<option value="${item.name}">${item.name.replace("省", "").replace("市", "")}</option>`)
      .join("");
    selectors.homeProvince.innerHTML = provinceOptions;
    selectors.homeProvince.value = state.homeProvince;
    selectors.targetProvince.insertAdjacentHTML("beforeend", provinceOptions);

    const domains = Array.from(new Set(schools.flatMap((school) => school.domains))).sort((a, b) => a.localeCompare(b, "zh-CN"));
    selectors.domainFilter.insertAdjacentHTML(
      "beforeend",
      domains.map((domain) => `<option value="${domain}">${domain}</option>`).join("")
    );

    selectors.totalSchools.textContent = number.format(data.meta.total);
    selectors.undergraduateSchools.textContent = number.format(data.meta.undergraduate);
    selectors.vocationalSchools.textContent = number.format(data.meta.vocational);
    selectors.dataNote.textContent = `数据源：${data.meta.sourceName}，截至 ${data.meta.asOf}。${data.meta.note}`;
  }

  function bindEvents() {
    selectors.scoreInput.addEventListener("input", () => {
      state.score = clamp(Number(selectors.scoreInput.value || 0), 100, 900);
      selectors.scoreRange.value = String(clamp(state.score, 180, 900));
      renderAll();
    });

    selectors.scoreRange.addEventListener("input", () => {
      state.score = Number(selectors.scoreRange.value);
      selectors.scoreInput.value = String(state.score);
      renderAll();
    });

    selectors.homeProvince.addEventListener("change", (event) => {
      state.homeProvince = event.target.value;
      refreshMajorScoreData();
    });

    selectors.subjectSelect.addEventListener("change", (event) => {
      state.subject = event.target.value;
      renderAll();
    });

    selectors.targetProvince.addEventListener("change", (event) => {
      state.targetProvince = event.target.value;
      state.activeProvince = event.target.value;
      renderAll();
    });

    selectors.levelFilter.addEventListener("change", (event) => {
      state.level = event.target.value;
      renderAll();
    });

    selectors.ownershipFilter.addEventListener("change", (event) => {
      state.ownership = event.target.value;
      renderAll();
    });

    selectors.domainFilter.addEventListener("change", (event) => {
      state.domain = event.target.value;
      renderAll();
    });

    selectors.riskRange.addEventListener("input", (event) => {
      state.risk = Number(event.target.value);
      renderAll();
    });

    selectors.admissionFile.addEventListener("change", handleAdmissionFile);
    selectors.downloadAdmissionTemplate.addEventListener("click", downloadAdmissionTemplate);
    selectors.clearAdmissionData.addEventListener("click", clearAdmissionData);

    selectors.searchInput.addEventListener("input", (event) => {
      state.search = event.target.value.trim();
      renderSchoolList();
    });

    selectors.sortSelect.addEventListener("change", (event) => {
      state.sort = event.target.value;
      renderSchoolList();
    });

    selectors.toggleMap.addEventListener("click", () => {
      setMapCollapsed(!state.mapCollapsed);
    });

    selectors.schoolList.addEventListener("scroll", handleSchoolListScroll, { passive: true });

    $$(".segment button").forEach((button) => {
      button.addEventListener("click", () => {
        state.plan = button.dataset.plan;
        renderRecommendations();
      });
    });

    selectors.schoolList.addEventListener("click", handleActionClick);
    selectors.recommendList.addEventListener("click", handleActionClick);
    selectors.majorList.addEventListener("click", handleActionClick);
    selectors.basketList.addEventListener("click", handleActionClick);

    $("#clearBasket").addEventListener("click", () => {
      state.basket = [];
      saveBasket();
      renderBasket();
    });

    $("#exportPlan").addEventListener("click", exportPlan);
    $("#resetAll").addEventListener("click", resetFilters);
    $("#closeDialog").addEventListener("click", () => selectors.schoolDialog.close());
  }

  function renderAll() {
    renderRiskLabel();
    renderAdmissionStatus();
    renderProvinceSummary();
    renderSchoolList();
    renderRecommendations();
    renderRiasecResult();
    renderMajorRecommendations();
    renderBasket();
  }

  function renderRiskLabel() {
    let label = "均衡";
    if (state.risk < 34) label = "稳妥优先";
    if (state.risk > 66) label = "冲刺优先";
    selectors.riskOutput.value = label;
  }

  function renderAdmissionStatus() {
    const scoped = admissionRecords.filter((record) => isCurrentAdmissionScope(record));
    const years = Array.from(new Set(scoped.map((record) => record.year))).sort((a, b) => a - b);
    selectors.admissionDataStatus.textContent = admissionRecords.length ? `${number.format(scoped.length)}/${number.format(admissionRecords.length)} 条` : "未导入";
    selectors.admissionDataNote.textContent = admissionRecords.length
      ? `当前 ${state.homeProvince}${state.subject} 可用 ${number.format(scoped.length)} 条记录，覆盖 ${years.length ? years.join("、") : "暂无匹配年份"}。`
      : "导入近三年官方投档线 CSV 后，院校排序、冲稳保和详情会优先使用真实分数/位次预测。";
    selectors.majorScoreStatus.textContent = majorScoreStatusText();
    selectors.admissionSourceNote.textContent = admissionRecords.length
      ? "预测按院校名称匹配；若同校多专业组，先取同年最低投档线作为院校入口线，详情中仍提示核对专业组。"
      : "字段建议：年份、生源省份、科类、批次、院校名称、院校专业组、专业、计划数、最低分、最低位次、数据来源、来源链接。";
  }

  function refreshMajorScoreData() {
    const token = ++majorScoreLoadToken;
    loadMajorScoresForProvince(state.homeProvince).then(() => {
      if (token === majorScoreLoadToken) renderAll();
    });
    renderAll();
  }

  async function loadMajorScoreManifest() {
    if (majorScoreState.manifest) return majorScoreState.manifest;
    const response = await fetch(`${majorScoreBasePath}manifest.json`, { cache: "force-cache" });
    if (!response.ok) throw new Error("专业分数线索引加载失败");
    majorScoreState.manifest = await response.json();
    return majorScoreState.manifest;
  }

  async function loadMajorScoresForProvince(province) {
    const provinceName = normalizeProvinceName(province);
    if (majorScoreState.province === provinceName && majorScoreState.data && !majorScoreState.error) return majorScoreState.data;
    if (majorScoreState.cache.has(provinceName)) {
      applyMajorScoreData(provinceName, majorScoreState.cache.get(provinceName));
      return majorScoreState.data;
    }

    majorScoreState.loading = true;
    majorScoreState.error = "";
    majorScoreState.province = provinceName;
    majorScoreState.data = null;
    majorScoreState.records = [];
    majorScoreState.bySchool = new Map();
    majorScoreState.schoolHistoryCache = new Map();

    try {
      const manifest = await loadMajorScoreManifest();
      const info = manifest.provinces?.[provinceName];
      if (!info?.file) throw new Error(`${provinceName} 暂无专业分数线数据`);
      const response = await fetch(`${majorScoreBasePath}${info.file}`, { cache: "force-cache" });
      if (!response.ok) throw new Error(`${provinceName} 专业分数线加载失败`);
      const raw = await readMajorScoreResponse(response, info);
      const decoded = decodeMajorScoreData(raw, info);
      majorScoreState.cache.set(provinceName, decoded);
      applyMajorScoreData(provinceName, decoded);
      return decoded;
    } catch (error) {
      majorScoreState.loading = false;
      majorScoreState.error = error.message || "专业分数线加载失败";
      majorScoreState.data = null;
      majorScoreState.records = [];
      majorScoreState.bySchool = new Map();
      majorScoreState.schoolHistoryCache = new Map();
      return null;
    }
  }

  async function readMajorScoreResponse(response, info) {
    if (info.encoding !== "gzip" && !String(info.file || "").endsWith(".gz")) return response.json();
    if (!("DecompressionStream" in window)) {
      throw new Error("当前浏览器不支持专业分数线解压，请使用新版 Chrome、Edge、Firefox 或 Safari");
    }
    const stream = new Blob([await response.arrayBuffer()]).stream().pipeThrough(new DecompressionStream("gzip"));
    const text = await new Response(stream).text();
    return JSON.parse(text);
  }

  function applyMajorScoreData(provinceName, dataSet) {
    majorScoreState.loading = false;
    majorScoreState.error = "";
    majorScoreState.province = provinceName;
    majorScoreState.data = dataSet;
    majorScoreState.records = dataSet.records;
    majorScoreState.bySchool = dataSet.bySchool;
    majorScoreState.schoolHistoryCache = new Map();
  }

  function decodeMajorScoreData(raw, manifestInfo) {
    const dict = raw.dict || {};
    const records = (raw.records || []).map((row) => {
      const school = dict.schools?.[row[0]] || "";
      const major = dict.majors?.[row[1]] || "";
      const history = decodeMajorHistory(row[10]);
      const latest = history[0] || {};
      const program = {
        school,
        schoolKey: cleanSchoolName(school),
        major,
        subject: subjectLabels[row[2]] || "",
        batch: dict.batches?.[row[3]] || "",
        group: dict.groups?.[row[4]] || "",
        requirement: dict.requirements?.[row[5]] || "",
        level: levelLabels[row[6]] || "",
        location: dict.locations?.[row[7]] || "",
        ownership: dict.ownerships?.[row[8]] || "",
        is985: Boolean(row[9] & 1),
        is211: Boolean(row[9] & 2),
        history,
        latestYear: latest.year || 0,
        latestScore: latest.minScore || 0,
        latestRank: latest.minRank || 0,
        latestPlan: latest.plan || 0,
      };
      program.domains = majorDomains(program.major, program.level);
      program.category = majorCategory(program.major, program.level);
      return program;
    });
    const bySchool = new Map();
    records.forEach((program) => {
      if (!program.schoolKey) return;
      if (!bySchool.has(program.schoolKey)) bySchool.set(program.schoolKey, []);
      bySchool.get(program.schoolKey).push(program);
    });
    return { meta: raw.meta || {}, info: manifestInfo, records, bySchool };
  }

  function decodeMajorHistory(flatHistory) {
    const items = [];
    const flat = Array.isArray(flatHistory) ? flatHistory : [];
    for (let index = 0; index < flat.length; index += 4) {
      items.push({
        year: Number(flat[index]) || 0,
        minScore: Number(flat[index + 1]) || 0,
        minRank: Number(flat[index + 2]) || 0,
        plan: Number(flat[index + 3]) || 0,
        source: "专业录取线",
      });
    }
    return items.filter((item) => item.year && item.minScore).sort((a, b) => b.year - a.year);
  }

  function majorScoreStatusText() {
    if (majorScoreState.loading) return `专业线：正在加载 ${majorScoreState.province || state.homeProvince} 2022-2025 年专业录取数据。`;
    if (majorScoreState.error) return `专业线：${majorScoreState.error}。`;
    if (!majorScoreState.data) return "专业线：等待加载当前生源省份数据。";
    const meta = majorScoreState.data.meta;
    const currentCount = majorScoreState.records.filter((program) => programMatchesSubject(program)).length;
    const years = (meta.years || []).join("、") || "2022-2025";
    return `专业线：${meta.province || majorScoreState.province}已加载 ${number.format(meta.records || majorScoreState.records.length)} 个专业-院校组合，覆盖 ${years}；当前科类可用 ${number.format(currentCount)} 条。`;
  }

  async function handleAdmissionFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = parseAdmissionCsv(text);
      if (!imported.length) {
        showToast("没有识别到有效招录记录");
        return;
      }
      admissionRecords = mergeAdmissionRecords(admissionRecords, imported);
      admissionIndex = buildAdmissionIndex(admissionRecords);
      saveAdmissionRecords();
      renderAll();
      showToast(`已导入 ${number.format(imported.length)} 条招录记录`);
    } catch (error) {
      showToast(error.message || "导入失败");
    } finally {
      event.target.value = "";
    }
  }

  function clearAdmissionData() {
    admissionRecords = [];
    admissionIndex = buildAdmissionIndex(admissionRecords);
    localStorage.removeItem(admissionKey);
    renderAll();
    showToast("已清空招录数据");
  }

  function downloadAdmissionTemplate() {
    const lines = [
      "年份,生源省份,科类,批次,院校名称,院校专业组,专业,计划数,最低分,最低位次,数据来源,来源链接",
      "2025,河南省,物理,普通本科批,示例大学,001,计算机类,12,586,42000,河南省教育考试院,https://example.gov.cn/admission-2025",
      "2024,河南省,理科,本科一批,示例大学,,计算机类,10,579,43800,阳光高考公开页,https://gaokao.chsi.com.cn/",
      "2023,河南省,理科,本科一批,示例大学,,计算机类,9,574,45200,高校招生网,https://example.edu.cn/admit",
    ];
    const blob = new Blob([`\ufeff${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "招录数据模板.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function setMapCollapsed(collapsed) {
    state.mapCollapsed = collapsed;
    selectors.mapPanel.classList.toggle("map-collapsed", collapsed);
    selectors.toggleMap.setAttribute("aria-pressed", String(collapsed));
    selectors.toggleMap.setAttribute("title", collapsed ? "展开地图" : "收起地图");
    selectors.toggleMap.setAttribute("aria-label", collapsed ? "展开地图" : "收起地图");
  }

  function handleSchoolListScroll() {
    const scrollTop = selectors.schoolList.scrollTop;
    if (scrollTop > 36 && !state.mapCollapsed) setMapCollapsed(true);
    if (scrollTop < 6 && state.mapCollapsed) setMapCollapsed(false);
  }

  function renderMap() {
    const allButton = document.createElement("button");
    allButton.type = "button";
    allButton.className = "province-node";
    allButton.style.left = "9%";
    allButton.style.top = "86%";
    allButton.dataset.province = "全部";
    allButton.dataset.count = data.meta.total;
    allButton.textContent = "全国";
    selectors.provinceMap.appendChild(allButton);

    provinces.forEach((province) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "province-node";
      button.style.left = `${province.x}%`;
      button.style.top = `${province.y}%`;
      button.dataset.province = province.name;
      button.dataset.count = province.total;
      button.textContent = province.short;
      const size = clamp(28 + province.total / 5.8, 31, 62);
      button.style.width = `${size}px`;
      button.style.height = `${size}px`;
      selectors.provinceMap.appendChild(button);
    });

    selectors.provinceMap.addEventListener("click", (event) => {
      const button = event.target.closest(".province-node");
      if (!button) return;
      state.activeProvince = button.dataset.province;
      state.targetProvince = button.dataset.province;
      selectors.targetProvince.value = state.targetProvince;
      renderAll();
    });
  }

  function renderProvinceSummary() {
    const selected = provinceSummary(state.activeProvince);
    selectors.activeProvinceLabel.textContent = state.activeProvince === "全部" ? "全国" : state.activeProvince;
    selectors.activeProvinceTotal.textContent = number.format(selected.total);
    selectors.undergradCount.textContent = number.format(selected.undergraduate);
    selectors.vocationalCount.textContent = number.format(selected.vocational);
    const total = Math.max(selected.total, 1);
    selectors.undergradBar.style.width = `${(selected.undergraduate / total) * 100}%`;
    selectors.vocationalBar.style.width = `${(selected.vocational / total) * 100}%`;
    $$(".province-node", selectors.provinceMap).forEach((node) => {
      node.classList.toggle("active", node.dataset.province === state.activeProvince);
    });
  }

  function provinceSummary(name) {
    if (name === "全部") {
      return {
        total: data.meta.total,
        undergraduate: data.meta.undergraduate,
        vocational: data.meta.vocational,
      };
    }
    return provinces.find((province) => province.name === name) || {
      total: 0,
      undergraduate: 0,
      vocational: 0,
    };
  }

  function parseAdmissionCsv(text) {
    const rows = parseCsv(text.replace(/^\ufeff/, "")).filter((row) => row.some((cell) => cell.trim()));
    if (rows.length < 2) return [];
    const headers = rows[0].map(normalizeAdmissionHeader);
    return rows.slice(1).map((row) => {
      const record = {};
      headers.forEach((key, index) => {
        if (!key) return;
        record[key] = (row[index] || "").trim();
      });
      const normalized = {
        year: Number(record.year),
        province: record.province || state.homeProvince,
        subject: record.subject || state.subject,
        batch: record.batch || "",
        school: record.school || "",
        group: record.group || "",
        major: record.major || "",
        plan: numberValue(record.plan),
        minScore: numberValue(record.minScore),
        minRank: numberValue(record.minRank),
        source: record.source || "",
        sourceUrl: record.sourceUrl || "",
      };
      if (!normalized.year || !normalized.school || !normalized.minScore) return null;
      return normalized;
    }).filter(Boolean);
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const next = text[index + 1];
      if (char === '"' && quoted && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        row.push(cell);
        cell = "";
      } else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && next === "\n") index += 1;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }
    if (cell || row.length) {
      row.push(cell);
      rows.push(row);
    }
    return rows;
  }

  function normalizeAdmissionHeader(header) {
    const key = String(header).trim().replace(/\s/g, "");
    const lower = key.toLowerCase();
    const aliases = ["year", "province", "subject", "batch", "school", "group", "major", "plan", "minscore", "minrank", "source", "sourceurl"];
    if (aliases.includes(lower)) {
      if (lower === "minscore") return "minScore";
      if (lower === "minrank") return "minRank";
      if (lower === "sourceurl") return "sourceUrl";
      return lower;
    }
    const map = {
      年份: "year",
      年: "year",
      生源省份: "province",
      省份: "province",
      考生省份: "province",
      科类: "subject",
      首选科目: "subject",
      选科: "subject",
      批次: "batch",
      录取批次: "batch",
      院校名称: "school",
      学校名称: "school",
      院校: "school",
      学校: "school",
      院校专业组: "group",
      专业组: "group",
      专业组代码: "group",
      专业名称: "major",
      专业: "major",
      招生计划: "plan",
      计划数: "plan",
      计划: "plan",
      最低分: "minScore",
      投档最低分: "minScore",
      录取最低分: "minScore",
      最低投档分: "minScore",
      最低位次: "minRank",
      投档最低位次: "minRank",
      录取最低位次: "minRank",
      位次: "minRank",
      数据来源: "source",
      来源: "source",
      来源名称: "source",
      来源链接: "sourceUrl",
      数据链接: "sourceUrl",
      原文链接: "sourceUrl",
    };
    return map[key] || "";
  }

  function mergeAdmissionRecords(current, imported) {
    const map = new Map();
    [...current, ...imported].forEach((record) => {
      const key = [
        record.year,
        compactProvince(record.province),
        normalizeSubjectGroup(record.subject),
        cleanSchoolName(record.school),
        record.group || "",
        record.major || "",
        record.sourceUrl || "",
      ].join("|");
      map.set(key, record);
    });
    return Array.from(map.values()).sort((a, b) => b.year - a.year || a.school.localeCompare(b.school, "zh-CN"));
  }

  function buildAdmissionIndex(records) {
    const index = new Map();
    records.forEach((record) => {
      const key = admissionScopeKey(record.province, record.subject, record.school);
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(record);
    });
    index.forEach((items) => items.sort((a, b) => b.year - a.year || a.minScore - b.minScore));
    return index;
  }

  function admissionPrediction(school) {
    const history = admissionHistoryForSchool(school);
    if (history.length) {
      const forecast = forecastFromYearly(aggregateAdmissionYears(history), school.rankLine);
      return {
        source: "real",
        label: "预测线",
        confidence: forecast.confidence,
        score: forecast.score,
        rank: forecast.rank,
        history: forecast.yearly,
        note: `基于${forecast.yearly.map((item) => item.year).join("、")}年${state.homeProvince}${state.subject}真实投档记录，结合趋势、计划变化和波动度预测。`,
      };
    }

    const majorHistory = majorScoreHistoryForSchool(school);
    if (majorHistory.length) {
      const forecast = forecastFromYearly(majorHistory, school.rankLine);
      const lowMajors = Array.from(new Set(forecast.yearly.map((item) => item.major).filter(Boolean))).slice(0, 3).join("、");
      return {
        source: "major",
        label: "专业线预测",
        confidence: forecast.confidence,
        score: forecast.score,
        rank: forecast.rank,
        history: forecast.yearly,
        note: `基于${forecast.yearly.map((item) => item.year).join("、")}年${state.homeProvince}${state.subject}专业录取分数线，取该校可报专业最低入口线预测${lowMajors ? `（近年低位专业：${lowMajors}）` : ""}。`,
      };
    }

    return {
      source: "model",
      label: "估算线",
      confidence: "低",
      score: modelScore(school),
      rank: school.rankLine,
      history: [],
      note: "暂无当前省份/科类真实三年投档或专业录取记录，使用院校库和偏好模型估算。",
    };
  }

  function forecastFromYearly(history, fallbackRank = 0) {
    const yearly = history.slice(0, 4).sort((a, b) => a.year - b.year).slice(-3);
    if (!yearly.length) {
      return {
        confidence: "低",
        score: 0,
        rank: fallbackRank,
        yearly: [],
      };
    }
    const scoreWeights = yearly.length === 1 ? [1] : yearly.length === 2 ? [0.38, 0.62] : [0.2, 0.3, 0.5];
    const weightedScore = weightedAverage(yearly.map((item) => item.minScore), scoreWeights);
    const rankPairs = yearly
      .map((item, index) => ({ item, weight: scoreWeights[index] || 0 }))
      .filter(({ item }) => item.minRank);
    const weightedRank = rankPairs.length
      ? weightedAverage(rankPairs.map(({ item }) => item.minRank), rankPairs.map(({ weight }) => weight))
      : 0;
    const recent = yearly[yearly.length - 1];
    const previous = yearly[yearly.length - 2];
    const scoreTrend = previous ? recent.minScore - previous.minScore : 0;
    const rankTrend = previous && recent.minRank && previous.minRank ? recent.minRank - previous.minRank : 0;
    const planAdjust = previous && recent.plan && previous.plan ? clamp(Math.log(recent.plan / previous.plan) * -5, -8, 8) : 0;
    const volatility = standardDeviation(yearly.map((item) => item.minScore));
    const score = clamp(Math.round(weightedScore + scoreTrend * 0.35 + planAdjust), 1, 900);
    const rank = weightedRank ? Math.max(1, Math.round(weightedRank + rankTrend * 0.2)) : fallbackRank;
    const confidenceScore = clamp(42 + yearly.length * 14 + (rankPairs.length >= 2 ? 10 : 0) - volatility * 2, 35, 94);
    const confidence = confidenceScore >= 78 ? "高" : confidenceScore >= 58 ? "中" : "低";
    return {
      confidence,
      score,
      rank,
      yearly,
    };
  }

  function aggregateAdmissionYears(records) {
    const map = new Map();
    records.forEach((record) => {
      const current = map.get(record.year);
      if (!current || record.minScore < current.minScore) {
        map.set(record.year, { ...record });
      } else if (current && record.plan) {
        current.plan = (current.plan || 0) + record.plan;
      }
    });
    return Array.from(map.values()).sort((a, b) => b.year - a.year);
  }

  function admissionHistoryForSchool(school) {
    const key = admissionScopeKey(state.homeProvince, state.subject, school.name);
    return admissionIndex.get(key) || [];
  }

  function majorScoreHistoryForSchool(school) {
    const cacheKey = [
      majorScoreState.province,
      normalizeSubjectGroup(state.subject),
      school.level,
      cleanSchoolName(school.name),
    ].join("|");
    if (majorScoreState.schoolHistoryCache.has(cacheKey)) return majorScoreState.schoolHistoryCache.get(cacheKey);

    const scoped = majorProgramsForSchool(school);
    const sameLevel = scoped.filter((program) => program.level === school.level);
    const candidates = sameLevel.length ? sameLevel : scoped;
    const ordinary = candidates.filter((program) => !isSpecialProgram(program));
    const programs = ordinary.length ? ordinary : candidates;
    const byYear = new Map();

    programs.forEach((program) => {
      program.history.forEach((item) => {
        const current = byYear.get(item.year);
        const entry = {
          ...item,
          major: program.major,
          batch: program.batch,
          group: program.group,
          source: `专业线·${program.major}`,
        };
        if (!current || item.minScore < current.minScore) {
          byYear.set(item.year, entry);
        } else if (current && item.plan) {
          current.plan = (current.plan || 0) + item.plan;
        }
      });
    });

    const result = Array.from(byYear.values()).sort((a, b) => b.year - a.year);
    majorScoreState.schoolHistoryCache.set(cacheKey, result);
    return result;
  }

  function majorProgramsForSchool(school) {
    const programs = majorScoreState.bySchool.get(cleanSchoolName(school.name)) || [];
    return programs.filter((program) => programMatchesSubject(program));
  }

  function currentMajorPrograms(options = {}) {
    if (!majorScoreState.records.length) return [];
    return majorScoreState.records.filter((program) => {
      if (!options.ignoreSubject && !programMatchesSubject(program)) return false;
      if (!options.ignoreLevel && state.level !== "全部" && program.level !== state.level) return false;
      if (!options.ignoreOwnership && state.ownership !== "全部" && normalizeProgramOwnership(program.ownership) !== state.ownership) return false;
      if (!options.ignoreProvince && state.activeProvince !== "全部" && compactProvince(program.location) !== compactProvince(state.activeProvince)) return false;
      if (!options.ignoreDomain && state.domain !== "全部" && !program.domains.includes(state.domain)) return false;
      if (options.ordinaryOnly && isSpecialProgram(program)) return false;
      return true;
    });
  }

  function programMatchesSubject(program) {
    const subject = normalizeSubjectGroup(state.subject);
    if (!subject) return true;
    return program.subject === subject || program.subject === "综合";
  }

  function programPrediction(program) {
    if (!program.forecast) program.forecast = forecastFromYearly(program.history, program.latestRank);
    const forecast = program.forecast;
    return {
      source: "major",
      label: "专业预测线",
      confidence: forecast.confidence,
      score: forecast.score,
      rank: forecast.rank,
      history: forecast.yearly.map((item) => ({ ...item, major: program.major, source: `专业线·${program.major}` })),
      note: `基于${forecast.yearly.map((item) => item.year).join("、")}年${state.homeProvince}${program.subject}专业录取线预测。`,
    };
  }

  function isSpecialProgram(program) {
    return /艺术|体育|提前|专项|高水平|预科|民族班|定向/.test(`${program.batch} ${program.major}`);
  }

  function normalizeProgramOwnership(value) {
    const text = String(value || "");
    if (text.includes("合作") || text.includes("境外") || text.includes("港澳台")) return "合作办学";
    if (text.includes("民办") || text.includes("独立学院")) return "民办";
    return "公办";
  }

  function admissionScopeKey(province, subject, schoolName) {
    return `${compactProvince(province)}|${normalizeSubjectGroup(subject)}|${cleanSchoolName(schoolName)}`;
  }

  function isCurrentAdmissionScope(record) {
    return compactProvince(record.province) === compactProvince(state.homeProvince) && normalizeSubjectGroup(record.subject) === normalizeSubjectGroup(state.subject);
  }

  function compactProvince(value) {
    return String(value || "")
      .replace(/壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区|省|市/g, "")
      .trim();
  }

  function normalizeProvinceName(value) {
    const compact = compactProvince(value);
    return provinces.find((province) => compactProvince(province.name) === compact)?.name || String(value || "");
  }

  function normalizeSubjectGroup(value) {
    const text = String(value || "").trim();
    if (text.includes("物理") || text.includes("理科") || text === "理") return "物理";
    if (text.includes("历史") || text.includes("文科") || text === "文") return "历史";
    if (text.includes("综合") || text.includes("不限")) return "综合";
    return text;
  }

  function cleanSchoolName(value) {
    return String(value || "")
      .replace(/[（(].*?[）)]/g, "")
      .replace(/\s/g, "")
      .trim();
  }

  function numberValue(value) {
    const text = String(value || "").replace(/[,，\s]/g, "");
    const match = text.match(/\d+(\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }

  function weightedAverage(values, weights) {
    const totalWeight = weights.reduce((sum, item) => sum + item, 0) || 1;
    return values.reduce((sum, item, index) => sum + item * (weights[index] || 0), 0) / totalWeight;
  }

  function standardDeviation(values) {
    if (values.length < 2) return 0;
    const average = values.reduce((sum, item) => sum + item, 0) / values.length;
    const variance = values.reduce((sum, item) => sum + Math.pow(item - average, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  function renderSchoolList() {
    const filtered = filteredSchools().map(withFit);
    sortSchools(filtered);
    selectors.resultCount.textContent = number.format(filtered.length);
    const list = filtered.slice(0, 80);
    if (!list.length) {
      selectors.schoolList.innerHTML = `<div class="basket-empty">没有找到匹配院校</div>`;
      setMapCollapsed(false);
      return;
    }
    selectors.schoolList.innerHTML = list.map(renderSchoolCard).join("");
    requestAnimationFrame(handleSchoolListScroll);
  }

  function renderSchoolCard(school) {
    const prediction = admissionPrediction(school);
    const gap = Math.round(state.score - prediction.score);
    const gapText = gap >= 0 ? `高 ${gap} 分` : `低 ${Math.abs(gap)} 分`;
    const typeClass = gap < 0 ? "rose" : gap < 30 ? "blue" : "green";
    const sourceClass = prediction.source === "real" ? "green" : prediction.source === "major" ? "blue" : "amber";
    const sourceText = prediction.source === "real"
      ? `真实投档·${prediction.confidence}`
      : prediction.source === "major"
        ? `专业线·${prediction.confidence}`
        : "待导入真实线";
    return `
      <article class="school-card">
        <div class="school-main">
          <div class="school-name">
            <button type="button" data-action="detail" data-id="${school.id}">${escapeHtml(school.name)}</button>
            <span class="pill ${typeClass}">${gapText}</span>
            <span class="pill ${sourceClass}">${sourceText}</span>
          </div>
          <div class="school-meta">
            <span>${school.province} · ${school.city}</span>
            <span>${escapeHtml(school.department)}</span>
            <span>标识码 ${school.code}</span>
          </div>
          <div class="school-tags">${school.tags.slice(0, 6).map(tagPill).join("")}</div>
          <div class="card-actions">
            <button class="mini-button primary" type="button" data-action="add" data-id="${school.id}">加入志愿篮</button>
            <button class="mini-button" type="button" data-action="detail" data-id="${school.id}">查看画像</button>
          </div>
        </div>
        <div class="score-chip ${prediction.source !== "model" ? "real" : ""}">
          <span>${Math.round(prediction.score)}</span>
          <small>${prediction.label}</small>
        </div>
      </article>
    `;
  }

  function renderRecommendations() {
    $$(".segment button").forEach((button) => {
      button.classList.toggle("active", button.dataset.plan === state.plan);
    });

    const buckets = buildPlanBuckets();
    $("#rushMeter").className = state.plan === "rush" ? "active" : buckets.rush.length ? "filled" : "";
    $("#steadyMeter").className = state.plan === "steady" ? "active" : buckets.steady.length ? "filled" : "";
    $("#safeMeter").className = state.plan === "safe" ? "active" : buckets.safe.length ? "filled" : "";

    const current = buckets[state.plan].slice(0, 6);
    if (!current.length) {
      selectors.recommendList.innerHTML = `<div class="basket-empty">当前条件下没有合适推荐</div>`;
      return;
    }

    selectors.recommendList.innerHTML = current
      .map((school) => {
        const prediction = admissionPrediction(school);
        const gap = Math.round(state.score - prediction.score);
        const confidence = confidenceLabel(state.plan, gap);
        return `
          <article class="recommend-card">
            <div class="recommend-top">
              <strong>${escapeHtml(school.name)}</strong>
              <span class="fit-score">${school.fit}%</span>
            </div>
            <div class="recommend-meta">
              <span>${school.province} · ${school.city}</span>
              <span>${school.level}</span>
              <span>${school.domains.slice(0, 2).join(" / ")}</span>
            </div>
            <p>${confidence}。${predictionBrief(prediction)}</p>
            <div class="card-actions">
              <button class="mini-button primary" type="button" data-action="add" data-id="${school.id}">加入志愿篮</button>
              <button class="mini-button" type="button" data-action="detail" data-id="${school.id}">详情</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function buildPlanBuckets() {
    const base = filteredSchools({ ignoreSearch: true })
      .map(withFit)
      .filter((school) => school.level === "本科" || state.level !== "本科")
      .sort((a, b) => b.fit - a.fit || adjustedScore(b) - adjustedScore(a));
    const riskBoost = (state.risk - 50) / 10;
    const windows = {
      rush: [-24 - riskBoost, 8 + riskBoost],
      steady: [9 - riskBoost / 2, 34 + riskBoost],
      safe: [35, 96 - riskBoost],
    };
    const buckets = { rush: [], steady: [], safe: [] };
    base.forEach((school) => {
      const gap = state.score - adjustedScore(school);
      Object.entries(windows).forEach(([name, [min, max]]) => {
        if (gap >= min && gap <= max) buckets[name].push(school);
      });
    });
    fillFallback(base, buckets.rush, -8);
    fillFallback(base, buckets.steady, 20);
    fillFallback(base, buckets.safe, 56);
    return buckets;
  }

  function fillFallback(base, bucket, targetGap) {
    if (bucket.length >= 6) return;
    const seen = new Set(bucket.map((item) => item.id));
    base
      .slice()
      .sort((a, b) => Math.abs(state.score - adjustedScore(a) - targetGap) - Math.abs(state.score - adjustedScore(b) - targetGap))
      .forEach((school) => {
        if (bucket.length >= 6 || seen.has(school.id)) return;
        bucket.push(school);
        seen.add(school.id);
      });
  }

  function renderRiasecControls() {
    selectors.riasecGrid.innerHTML = riasecDefs
      .map((item) => `
        <div class="riasec-item">
          <label for="riasec${item.code}">
            <span>${item.code} · ${item.name}</span>
            <small>${item.hint}</small>
          </label>
          <input id="riasec${item.code}" class="range" type="range" min="0" max="100" value="${state.riasec[item.code]}" data-riasec="${item.code}">
        </div>
      `)
      .join("");
    selectors.riasecGrid.addEventListener("input", (event) => {
      const input = event.target.closest("[data-riasec]");
      if (!input) return;
      state.riasec[input.dataset.riasec] = Number(input.value);
      renderRiasecResult();
      renderRecommendations();
      renderMajorRecommendations();
    });
  }

  function renderRiasecResult() {
    const top = riasecDefs
      .map((item) => ({ ...item, value: state.riasec[item.code] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 2);
    const domains = Array.from(new Set(top.flatMap((item) => item.domains)));
    const sample = schools
      .filter((school) => domains.some((domain) => school.domains.includes(domain)))
      .map(withFit)
      .sort((a, b) => b.fit - a.fit)
      .slice(0, 3)
      .map((school) => school.name)
      .join("、");
    selectors.riasecResult.innerHTML = `
      <strong>${top.map((item) => `${item.code}${item.name}`).join(" + ")}</strong>
      <span>可优先比较 ${domains.join("、")} 方向；当前画像下可参考 ${escapeHtml(sample || "综合类院校")}。</span>
    `;
  }

  function renderMajorRecommendations() {
    const top = topRiasecItems(2);
    const majors = buildMajorRecommendations().slice(0, 6);
    const focus = state.domain === "全部" ? "综合匹配" : state.domain;
    selectors.majorSummary.innerHTML = `
      <strong>${top.map((item) => `${item.code}${item.name}`).join(" + ")} · ${focus}</strong>
      <span>按分数 ${state.score}、${state.subject}、兴趣画像和地区筛选，优先使用 22-25 年真实专业录取线给出专业梯度。</span>
    `;

    if (!majors.length) {
      selectors.majorList.innerHTML = `<div class="basket-empty">当前条件下没有合适专业推荐</div>`;
      return;
    }

    selectors.majorList.innerHTML = majors.map(renderMajorCard).join("");
  }

  function renderMajorCard(major) {
    if (major.source === "major") return renderRealMajorCard(major);
    const sample = sampleSchoolsForMajor(major)
      .slice(0, 3)
      .map((school) => school.name)
      .join("、");
    const subject = subjectCompatibility(major);
    const ladder = majorLadder(major);
    const primaryDomain = major.domains[0];
    const careers = major.careers.slice(0, 3).join(" / ");
    return `
      <article class="major-card">
        <div class="major-top">
          <strong>${escapeHtml(major.name)}</strong>
          <span class="major-score">${major.fit}%</span>
        </div>
        <div class="major-meta">
          <span>${major.level} · ${major.category}</span>
          <span>${major.domains.join(" / ")}</span>
          <span>${subject.label}</span>
          <span>${ladder}</span>
        </div>
        <p>${escapeHtml(major.note)} 职业方向：${escapeHtml(careers)}。</p>
        <div class="major-schools">可对照：${escapeHtml(sample || "同方向综合类、理工类或应用型院校")}</div>
        <div class="card-actions">
          <button class="mini-button primary" type="button" data-action="set-domain" data-domain="${escapeHtml(primaryDomain)}">查看相关院校</button>
        </div>
      </article>
    `;
  }

  function renderRealMajorCard(major) {
    const evidence = major.samplePrograms
      .slice(0, 3)
      .map(({ program, prediction, gap }) => {
        const latest = program.history[0] || {};
        const group = program.group ? ` · ${escapeHtml(program.group)}` : "";
        const requirement = program.requirement ? ` · ${escapeHtml(program.requirement)}` : "";
        return `
          <div class="major-evidence-row">
            <strong>${escapeHtml(program.school)}</strong>
            <span>${escapeHtml(program.batch || program.level)}${group} · 预测${Math.round(prediction.score)}分 · ${gap >= 0 ? "高" : "低"}${Math.abs(Math.round(gap))}分</span>
            <small>${latest.year || "近年"}最低${latest.minScore || "-"}分${latest.minRank ? ` · 位次${number.format(latest.minRank)}` : ""}${latest.plan ? ` · ${latest.plan}人` : ""}${requirement}</small>
          </div>
        `;
      })
      .join("");
    return `
      <article class="major-card">
        <div class="major-top">
          <strong>${escapeHtml(major.name)}</strong>
          <span class="major-score">${major.fit}%</span>
        </div>
        <div class="major-meta">
          <span>${major.level} · ${major.category}</span>
          <span>${major.domains.join(" / ")}</span>
          <span>真实专业线</span>
          <span>${majorLadder(major)}</span>
        </div>
        <p>覆盖 ${number.format(major.schoolCount)} 所院校、${number.format(major.programCount)} 个招生单元，参考线约 ${Math.round(major.scoreLine)} 分；建议结合专业组、选科要求和计划数变化复核。</p>
        <div class="major-evidence">${evidence}</div>
        <div class="card-actions">
          <button class="mini-button primary" type="button" data-action="set-domain" data-domain="${escapeHtml(major.domains[0])}">查看相关院校</button>
        </div>
      </article>
    `;
  }

  function buildMajorRecommendations() {
    const realMajors = buildRealMajorRecommendations();
    if (realMajors.length) return realMajors;

    const topItems = topRiasecItems(3);
    const topDomains = new Set(topItems.flatMap((item) => item.domains));
    return majorCatalog
      .filter((major) => state.level === "全部" || major.level === state.level)
      .filter((major) => state.domain === "全部" || major.domains.includes(state.domain))
      .map((major) => {
        const gap = state.score - major.scoreLine;
        const subject = subjectCompatibility(major);
        const scoreFit = clamp(86 - Math.abs(gap) * 0.45, 20, 92);
        const interestFit = major.riasec.reduce((sum, code) => sum + (state.riasec[code] || 0), 0) / major.riasec.length;
        const interestScore = interestFit * 0.18;
        const domainScore = major.domains.some((domain) => topDomains.has(domain)) ? 8 : 0;
        const filterScore = state.domain !== "全部" && major.domains.includes(state.domain) ? 8 : 0;
        const levelScore = state.level === "全部" || state.level === major.level ? 4 : 0;
        const riskScore = riskAlignmentScore(gap);
        const trendScore = major.trend === "上升" || major.trend === "高热" ? 2 : 0;
        return {
          ...major,
          gap,
          fit: clamp(Math.round(scoreFit + subject.score + interestScore + domainScore + filterScore + levelScore + riskScore + trendScore - 20), 1, 99),
        };
      })
      .sort((a, b) => b.fit - a.fit || Math.abs(a.gap) - Math.abs(b.gap) || a.name.localeCompare(b.name, "zh-CN"));
  }

  function buildRealMajorRecommendations() {
    const sourcePrograms = currentMajorPrograms({ ordinaryOnly: true });
    if (!sourcePrograms.length) return [];

    const predicted = sourcePrograms
      .map((program) => {
        const prediction = programPrediction(program);
        return { program, prediction, gap: state.score - prediction.score };
      })
      .filter((item) => item.prediction.score);

    const riskBoost = (state.risk - 50) / 2;
    let close = predicted.filter((item) => item.gap >= -42 - riskBoost && item.gap <= 105 + riskBoost);
    if (close.length < 50) close = predicted.slice().sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap)).slice(0, 360);

    const groups = new Map();
    close.forEach((item) => {
      const key = `${item.program.major}|${item.program.level}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });

    const topItems = topRiasecItems(3);
    const topDomains = new Set(topItems.flatMap((item) => item.domains));

    return Array.from(groups.entries())
      .map(([key, items]) => {
        const [name, level] = key.split("|");
        const domains = majorDomains(name, level);
        const category = majorCategory(name, level);
        const riasecCodes = majorRiasecCodes(domains, name);
        const sorted = items
          .slice()
          .sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap) || b.prediction.score - a.prediction.score);
        const closest = sorted[0];
        const schoolCount = new Set(items.map((item) => item.program.school)).size;
        const scoreFit = clamp(92 - Math.abs(closest.gap) * 0.65, 18, 95);
        const interestFit = riasecCodes.reduce((sum, code) => sum + (state.riasec[code] || 0), 0) / riasecCodes.length;
        const domainScore = domains.some((domain) => topDomains.has(domain)) ? 9 : 0;
        const filterScore = state.domain !== "全部" && domains.includes(state.domain) ? 8 : 0;
        const coverageScore = clamp(Math.log(schoolCount + 1) * 4, 0, 12);
        const confidenceScore = sorted.slice(0, 6).filter((item) => item.prediction.confidence !== "低").length * 1.5;
        return {
          source: "major",
          name,
          level,
          category,
          domains,
          riasec: riasecCodes,
          scoreLine: closest.prediction.score,
          gap: closest.gap,
          fit: clamp(Math.round(scoreFit + interestFit * 0.18 + domainScore + filterScore + coverageScore + confidenceScore - 18), 1, 99),
          schoolCount,
          programCount: items.length,
          samplePrograms: sorted.slice(0, 5),
        };
      })
      .filter((major) => major.schoolCount >= 2 || Math.abs(major.gap) <= 18)
      .sort((a, b) => b.fit - a.fit || b.schoolCount - a.schoolCount || Math.abs(a.gap) - Math.abs(b.gap) || a.name.localeCompare(b.name, "zh-CN"));
  }

  function riskAlignmentScore(gap) {
    if (gap < -18) return state.risk > 66 ? 4 : -8;
    if (gap < 8) return state.risk > 45 ? 4 : 0;
    if (gap > 45) return state.risk < 45 ? 6 : 0;
    return 5;
  }

  function subjectCompatibility(major) {
    if (major.subjects.includes(state.subject)) return { score: 10, label: "选科匹配" };
    if (major.subjects.includes("综合") && state.subject === "综合") return { score: 9, label: "选科匹配" };
    if (major.subjects.includes("不限")) return { score: 6, label: "选科宽松" };
    if (["物理", "理科"].includes(state.subject) && major.subjects.some((item) => ["物理", "理科", "综合"].includes(item))) {
      return { score: 7, label: "偏理适配" };
    }
    if (["历史", "文科"].includes(state.subject) && major.subjects.some((item) => ["历史", "文科", "综合"].includes(item))) {
      return { score: 7, label: "偏文适配" };
    }
    return { score: -14, label: "需核对选科" };
  }

  function topRiasecItems(limit) {
    return riasecDefs
      .map((item) => ({ ...item, value: state.riasec[item.code] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  }

  function majorLadder(major) {
    if (major.gap < -22) return "谨慎冲";
    if (major.gap < 8) return "冲";
    if (major.gap < 42) return "稳";
    return "保";
  }

  function sampleSchoolsForMajor(major) {
    const provincePool = filteredSchools({ ignoreSearch: true })
      .filter((school) => major.domains.some((domain) => school.domains.includes(domain)))
      .map(withFit);
    const nationalPool = schools
      .filter((school) => major.domains.some((domain) => school.domains.includes(domain)))
      .filter((school) => state.level === "全部" || school.level === state.level)
      .map(withFit);
    return (provincePool.length ? provincePool : nationalPool)
      .sort((a, b) => b.fit - a.fit || Math.abs(state.score - adjustedScore(a)) - Math.abs(state.score - adjustedScore(b)))
      .slice(0, 3);
  }

  function renderBasket() {
    if (!state.basket.length) {
      selectors.basketList.innerHTML = `<div class="basket-empty">从推荐或院校库加入候选</div>`;
      return;
    }
    selectors.basketList.innerHTML = state.basket
      .map((id) => schools.find((school) => school.id === id))
      .filter(Boolean)
      .map((school, index) => `
        <div class="basket-item">
          <div>
            <strong>${index + 1}. ${escapeHtml(school.name)}</strong>
            <span>${school.province} · ${school.level} · ${admissionPrediction(school).label} ${Math.round(adjustedScore(school))}</span>
          </div>
          <button type="button" data-action="remove" data-id="${school.id}" aria-label="移除 ${escapeHtml(school.name)}">×</button>
        </div>
      `)
      .join("");
  }

  function filteredSchools(options = {}) {
    const keyword = state.search.toLowerCase();
    return schools.filter((school) => {
      if (state.activeProvince !== "全部" && school.province !== state.activeProvince) return false;
      if (state.level !== "全部" && school.level !== state.level) return false;
      if (state.ownership !== "全部" && school.ownership !== state.ownership) return false;
      if (state.domain !== "全部" && !school.domains.includes(state.domain)) return false;
      if (!options.ignoreSearch && keyword) {
        const haystack = `${school.name} ${school.city} ${school.province} ${school.department} ${school.domains.join(" ")}`.toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      return true;
    });
  }

  function withFit(school) {
    const prediction = admissionPrediction(school);
    const gap = state.score - prediction.score;
    const domainScore = state.domain !== "全部" && school.domains.includes(state.domain) ? 10 : 0;
    const homeScore = school.province === state.homeProvince ? 5 : 0;
    const ownershipScore = school.ownership === "公办" ? 2 : 0;
    const dataScore = prediction.source === "real" ? 6 : prediction.source === "major" ? 4 : 0;
    const scoreFit = 100 - Math.min(70, Math.abs(gap) * 1.25);
    return {
      ...school,
      prediction,
      fit: clamp(Math.round(scoreFit + domainScore + homeScore + ownershipScore + dataScore), 1, 99),
    };
  }

  function sortSchools(items) {
    if (state.sort === "scoreDesc") {
      items.sort((a, b) => adjustedScore(b) - adjustedScore(a));
    } else if (state.sort === "scoreAsc") {
      items.sort((a, b) => adjustedScore(a) - adjustedScore(b));
    } else if (state.sort === "name") {
      items.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
    } else {
      items.sort((a, b) => b.fit - a.fit || Math.abs(state.score - adjustedScore(a)) - Math.abs(state.score - adjustedScore(b)));
    }
  }

  function adjustedScore(school) {
    return admissionPrediction(school).score;
  }

  function modelScore(school) {
    let score = school.scoreLine;
    const domains = school.domains;
    if (["物理", "理科"].includes(state.subject)) {
      if (domains.includes("理工") || domains.includes("医药")) score += 5;
      if (domains.includes("艺术传媒") || domains.includes("语言")) score -= 3;
    }
    if (["历史", "文科"].includes(state.subject)) {
      if (domains.includes("财经") || domains.includes("师范") || domains.includes("语言") || domains.includes("政法")) score += 5;
      if (domains.includes("理工")) score -= 4;
    }
    return score;
  }

  function predictionBrief(prediction) {
    if (prediction.source !== "model") {
      const note = prediction.note.replace(/[，,。；;]+$/, "");
      const rank = prediction.rank ? `，预测位次约 ${number.format(prediction.rank)}` : "";
      const dataKind = prediction.source === "real" ? "真实投档记录" : "专业录取线";
      return `${note}${rank}，可信度${prediction.confidence}；数据依据为${dataKind}，仍需核对专业组、招生计划和选科限制。`;
    }
    return "暂无当前省份/科类真实三年投档或专业录取记录，当前仅为低可信度估算；建议用省考试院投档线和学校招生章程复核。";
  }

  function renderAdmissionHistory(prediction) {
    if (prediction.source === "model" || !prediction.history.length) {
      return `
        <div class="history-box muted">
          <strong>真实招录记录</strong>
          <span>当前省份和科类暂无该校近三年投档或专业录取记录，建议补充官方 CSV 后复核。</span>
        </div>
      `;
    }
    const title = prediction.source === "major" ? "近三年专业入口线" : "近三年投档记录";
    return `
      <div class="history-box">
        <strong>${title}</strong>
        <div class="history-table">
          ${prediction.history.map((item) => `
            <div>
              <span>${item.year}</span>
              <span>${item.minScore}分</span>
              <span>${item.minRank ? number.format(item.minRank) : "无位次"}</span>
              <span>${item.plan ? `${item.plan}人` : "计划待核"}</span>
              <span>${sourceLink(item)}</span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function sourceLink(item) {
    const label = escapeHtml(item.source || "来源待核");
    if (!item.sourceUrl) return label;
    return `<a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener">${label}</a>`;
  }

  function confidenceLabel(plan, gap) {
    if (plan === "rush") return gap < 0 ? `冲刺项，模拟分差 ${gap} 分` : `高位冲刺，模拟分差 +${gap} 分`;
    if (plan === "steady") return `稳妥项，模拟分差 +${gap} 分`;
    return `保底项，模拟分差 +${gap} 分`;
  }

  function handleActionClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    if (button.dataset.action === "set-domain") {
      setDomainFilter(button.dataset.domain);
      return;
    }
    const id = Number(button.dataset.id);
    if (button.dataset.action === "add") addToBasket(id);
    if (button.dataset.action === "remove") removeFromBasket(id);
    if (button.dataset.action === "detail") showDetail(id);
  }

  function setDomainFilter(domain) {
    if (!domain) return;
    state.domain = domain;
    selectors.domainFilter.value = domain;
    renderAll();
    showToast(`已切换到${domain}方向`);
  }

  function addToBasket(id) {
    if (state.basket.includes(id)) {
      showToast("已在志愿篮中");
      return;
    }
    state.basket = [...state.basket, id].slice(0, 36);
    saveBasket();
    renderBasket();
    showToast("已加入志愿篮");
  }

  function removeFromBasket(id) {
    state.basket = state.basket.filter((item) => item !== id);
    saveBasket();
    renderBasket();
  }

  function showDetail(id) {
    const school = schools.find((item) => item.id === id);
    if (!school) return;
    const prediction = admissionPrediction(school);
    const gap = Math.round(state.score - prediction.score);
    const relation = gap >= 35 ? "可作为保底或后段稳妥项" : gap >= 8 ? "适合放在稳妥梯队" : gap >= -25 ? "适合放在冲刺梯队" : "当前分差偏大，建议谨慎冲刺";
    const majorNames = buildMajorRecommendations()
      .filter((major) => major.domains.some((domain) => school.domains.includes(domain)))
      .slice(0, 3)
      .map((major) => major.name)
      .join("、");
    selectors.dialogBody.innerHTML = `
      <div class="dialog-content">
        <h3>${escapeHtml(school.name)}</h3>
        <div class="school-meta">
          <span>${school.province} · ${school.city}</span>
          <span>${escapeHtml(school.department)}</span>
          <span>${school.ownership}</span>
          <span>${school.level}</span>
        </div>
        <div class="school-tags">${school.tags.map(tagPill).join("")}</div>
        <div class="dialog-stats">
          <div><span>${prediction.label}</span><strong>${Math.round(prediction.score)}</strong></div>
          <div><span>预测位次</span><strong>${number.format(prediction.rank)}</strong></div>
          <div><span>分差</span><strong>${gap >= 0 ? "+" : ""}${gap}</strong></div>
        </div>
        ${renderAdmissionHistory(prediction)}
        ${renderSchoolMajorPrograms(school)}
        <ul class="advice-list">
          <li>${relation}，并结合专业组、选科要求、招生计划变化重新校验。</li>
          <li>${escapeHtml(predictionBrief(prediction))}</li>
          <li>当前画像可优先查看 ${escapeHtml(majorNames || school.domains.join("、"))}，并比较培养方向、转专业政策和所在校区。</li>
          <li>院校名单来自教育部；预测不替代各省考试院正式投档数据和当年招生章程。</li>
        </ul>
        <div class="card-actions">
          <button class="mini-button primary" type="button" data-action="add" data-id="${school.id}">加入志愿篮</button>
        </div>
      </div>
    `;
    selectors.dialogBody.onclick = handleActionClick;
    if (typeof selectors.schoolDialog.showModal === "function") {
      selectors.schoolDialog.showModal();
    } else {
      selectors.schoolDialog.setAttribute("open", "");
    }
  }

  function renderSchoolMajorPrograms(school) {
    const programs = majorProgramsForSchool(school)
      .filter((program) => state.level === "全部" || program.level === state.level || program.level === school.level)
      .filter((program) => !isSpecialProgram(program));
    if (!programs.length) return "";

    const rows = programs
      .map((program) => {
        const prediction = programPrediction(program);
        return { program, prediction, gap: state.score - prediction.score };
      })
      .filter((item) => item.prediction.score)
      .sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap) || b.prediction.score - a.prediction.score)
      .slice(0, 8);

    if (!rows.length) return "";

    return `
      <div class="program-score-box">
        <div class="program-score-head">
          <strong>专业录取线对照</strong>
          <span>${state.homeProvince}${state.subject}</span>
        </div>
        <div class="program-score-list">
          ${rows.map(({ program, prediction, gap }) => {
            const latest = program.history[0] || {};
            const group = program.group ? ` · ${escapeHtml(program.group)}` : "";
            const rank = latest.minRank ? ` · 位次${number.format(latest.minRank)}` : "";
            const plan = latest.plan ? ` · ${latest.plan}人` : "";
            const requirement = program.requirement ? escapeHtml(program.requirement) : "选科待核";
            return `
              <div class="program-score-item">
                <div>
                  <strong>${escapeHtml(program.major)}</strong>
                  <span>${escapeHtml(program.batch || program.level)}${group} · ${requirement}</span>
                  <small>${latest.year || "近年"}最低${latest.minScore || "-"}分${rank}${plan}</small>
                </div>
                <div class="program-score-value">
                  <strong>${Math.round(prediction.score)}</strong>
                  <span>${gap >= 0 ? "+" : ""}${Math.round(gap)}</span>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  function exportPlan() {
    const selected = state.basket
      .map((id) => schools.find((school) => school.id === id))
      .filter(Boolean);
    const buckets = buildPlanBuckets();
    const fallback = [...buckets.rush.slice(0, 4), ...buckets.steady.slice(0, 5), ...buckets.safe.slice(0, 5)];
    const list = selected.length ? selected : fallback;
    const majors = buildMajorRecommendations().slice(0, 6);
    const lines = [
      "沐阳志愿填报方案",
      `分数：${state.score}；生源：${state.homeProvince}；科目：${state.subject}；地区：${state.activeProvince}`,
      `数据源：${data.meta.sourceName}（截至 ${data.meta.asOf}）`,
      "",
      "专业推荐：",
      ...majors.map((major, index) => `${index + 1}. ${major.name}｜${major.level}｜${major.category}｜${major.domains.join("/")}｜匹配度 ${major.fit}%｜梯度 ${majorLadder(major)}`),
      "",
      "院校方案：",
      ...list.map((school, index) => {
        const prediction = admissionPrediction(school);
        const gap = Math.round(state.score - prediction.score);
        return `${index + 1}. ${school.name}｜${school.province}${school.city}｜${school.level}｜${school.domains.join("/")}｜${prediction.label} ${Math.round(prediction.score)}｜预测位次 ${number.format(prediction.rank)}｜可信度 ${prediction.confidence}｜分差 ${gap >= 0 ? "+" : ""}${gap}`;
      }),
      "",
      "提示：真实预测依赖导入的省考试院投档线；缺失真实数据的院校仅为低可信度估算，正式填报需核对本省考试院招生计划、投档线和选科要求。",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `沐阳志愿方案-${Date.now()}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("方案已导出");
  }

  function resetFilters() {
    state.score = 586;
    state.subject = "物理";
    state.targetProvince = "全部";
    state.activeProvince = "全部";
    state.level = "全部";
    state.ownership = "全部";
    state.domain = "全部";
    state.risk = 48;
    state.search = "";
    state.sort = "fit";
    setMapCollapsed(false);
    selectors.scoreInput.value = "586";
    selectors.scoreRange.value = "586";
    selectors.subjectSelect.value = "物理";
    selectors.targetProvince.value = "全部";
    selectors.levelFilter.value = "全部";
    selectors.ownershipFilter.value = "全部";
    selectors.domainFilter.value = "全部";
    selectors.riskRange.value = "48";
    selectors.searchInput.value = "";
    selectors.sortSelect.value = "fit";
    renderAll();
  }

  function tagPill(tag) {
    const className = tag === "本科" || tag === "部属" ? "blue" : tag === "公办" || tag === "研究型" ? "green" : tag === "民办" ? "rose" : "amber";
    return `<span class="pill ${className}">${escapeHtml(tag)}</span>`;
  }

  function loadBasket() {
    try {
      const saved = JSON.parse(localStorage.getItem(basketKey) || "[]");
      return Array.isArray(saved) ? saved.map(Number).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  function saveBasket() {
    localStorage.setItem(basketKey, JSON.stringify(state.basket));
  }

  function loadAdmissionRecords() {
    try {
      const saved = JSON.parse(localStorage.getItem(admissionKey) || "[]");
      return Array.isArray(saved) ? saved.filter((record) => record && record.year && record.school && record.minScore) : [];
    } catch {
      return [];
    }
  }

  function saveAdmissionRecords() {
    try {
      localStorage.setItem(admissionKey, JSON.stringify(admissionRecords));
    } catch {
      showToast("数据量较大，浏览器本地存储已满");
    }
  }

  function showToast(message) {
    $(".toast")?.remove();
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1600);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char]));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  init();
})();
