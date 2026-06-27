#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const CHSI_BASE = "https://gaokao.chsi.com.cn";
const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9",
};

const csvHeaders = [
  "年份",
  "生源省份",
  "科类",
  "批次",
  "院校名称",
  "院校专业组",
  "专业",
  "计划数",
  "最低分",
  "最低位次",
  "数据来源",
  "来源链接",
];

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const outputDir = path.resolve(options.outputDir);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(path.dirname(path.resolve(options.csv)), { recursive: true });

  const schools = await collectSchools(options);
  const report = {
    generatedAt: new Date().toISOString(),
    sourceName: "教育部阳光高考信息平台院校信息库",
    sourceUrl: `${CHSI_BASE}/sch/`,
    note: "阳光高考公开端的“往年录取信息”多为高校自维护内容或外链；脚本只把可解析的表格写入 CSV，其余记录进入 report 供人工核验。",
    totals: {
      schools: schools.length,
      hireInfoItems: 0,
      structuredRecords: 0,
      externalLinks: 0,
      parseWarnings: 0,
    },
    schools: [],
  };

  const records = [];
  for (let index = 0; index < schools.length; index += 1) {
    const school = schools[index];
    console.log(`[${index + 1}/${schools.length}] ${school.name} (${school.id})`);
    try {
      const result = await scrapeSchoolHireInfo(school, options);
      records.push(...result.records);
      report.schools.push(result.summary);
      report.totals.hireInfoItems += result.summary.hireInfoItems;
      report.totals.structuredRecords += result.records.length;
      report.totals.externalLinks += result.summary.externalLinks.length;
      report.totals.parseWarnings += result.summary.warnings.length;
    } catch (error) {
      report.totals.parseWarnings += 1;
      report.schools.push({
        ...school,
        hireInfoItems: 0,
        records: 0,
        externalLinks: [],
        warnings: [error.message],
      });
    }
    await sleep(options.delay);
  }

  const csv = [csvHeaders.join(","), ...records.map(recordToCsvLine)].join("\n");
  fs.writeFileSync(path.resolve(options.csv), `\ufeff${csv}\n`);
  fs.writeFileSync(path.resolve(options.report), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote ${records.length} structured records to ${path.resolve(options.csv)}`);
  console.log(`Wrote scrape report to ${path.resolve(options.report)}`);
}

function parseArgs(argv) {
  const options = {
    limit: Infinity,
    start: 0,
    delay: 160,
    outputDir: "data/official",
    csv: "data/admissions/official-admissions.csv",
    report: "data/official/chsi-admissions-report.json",
    schoolQueries: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--school" && next) {
      options.schoolQueries.push(...next.split(/[，,]/).map((item) => item.trim()).filter(Boolean));
      index += 1;
    } else if (arg === "--limit" && next) {
      options.limit = Number(next);
      index += 1;
    } else if (arg === "--start" && next) {
      options.start = Number(next);
      index += 1;
    } else if (arg === "--delay" && next) {
      options.delay = Number(next);
      index += 1;
    } else if (arg === "--output-dir" && next) {
      options.outputDir = next;
      index += 1;
    } else if (arg === "--csv" && next) {
      options.csv = next;
      index += 1;
    } else if (arg === "--report" && next) {
      options.report = next;
      index += 1;
    } else if (arg === "--help") {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/fetch-official-admissions.js --school 北京大学
  node scripts/fetch-official-admissions.js --limit 60 --delay 200

Options:
  --school <name[,name]>   只抓指定院校名称的阳光高考公开页，可重复传入
  --limit <n>              限制抓取院校数量；默认抓全部公开院校页
  --start <n>              全量抓取时从院校库分页 start 偏移开始
  --delay <ms>             每所学校之间的等待时间，默认 160ms
  --csv <path>             输出可导入网站的 CSV
  --report <path>          输出抓取报告 JSON
`);
}

async function collectSchools(options) {
  const schools = [];
  const seen = new Set();

  if (options.schoolQueries.length) {
    for (const query of options.schoolQueries) {
      const url = `${CHSI_BASE}/sch/search.do?searchType=1&yxmc=${encodeURIComponent(query)}`;
      const html = await fetchText(url);
      for (const school of parseSchoolsFromHtml(html)) {
        if (seen.has(school.id)) continue;
        seen.add(school.id);
        schools.push(school);
      }
      await sleep(options.delay);
    }
    return Number.isFinite(options.limit) ? schools.slice(0, options.limit) : schools;
  }

  let start = Number.isFinite(options.start) ? options.start : 0;
  let lastStart = Infinity;
  while (schools.length < options.limit && start <= lastStart) {
    const url = `${CHSI_BASE}/sch/search--ss-on,option-qg,searchType-1,start-${start}.dhtml`;
    const html = await fetchText(url);
    lastStart = Math.min(lastStart, parseLastStart(html));
    const pageSchools = parseSchoolsFromHtml(html);
    if (!pageSchools.length) break;
    for (const school of pageSchools) {
      if (seen.has(school.id)) continue;
      seen.add(school.id);
      schools.push(school);
      if (schools.length >= options.limit) break;
    }
    start += 20;
    await sleep(options.delay);
  }
  return schools;
}

function parseSchoolsFromHtml(html) {
  const schools = [];
  const pattern = /window\.open\('\/sch\/schoolInfo--schId-(\d+)\.dhtml'[\s\S]*?<span class="name js-yxk-yxmc">([\s\S]*?)<\/span>/g;
  let match;
  while ((match = pattern.exec(html))) {
    const name = textContent(match[2]);
    if (!name) continue;
    schools.push({ id: match[1], name });
  }
  return schools;
}

function parseLastStart(html) {
  let last = 0;
  for (const match of html.matchAll(/start-(\d+)\.dhtml/g)) {
    last = Math.max(last, Number(match[1]));
  }
  return last || Infinity;
}

async function scrapeSchoolHireInfo(school, options) {
  const listUrl = `${CHSI_BASE}/sch/listHireInfo--schId-${school.id},categoryId-26199,mindex-6.dhtml`;
  const listHtml = await fetchText(listUrl);
  const items = parseHireInfoItems(listHtml);
  const summary = {
    ...school,
    listUrl,
    hireInfoItems: items.length,
    records: 0,
    externalLinks: [],
    warnings: [],
  };
  const records = [];

  if (!items.length) {
    summary.warnings.push("阳光高考公开页没有往年录取信息条目");
    return { records, summary };
  }

  for (const item of items) {
    await sleep(options.delay);
    const html = await fetchText(item.url);
    const detailHtml = extractDetailHtml(html);
    const links = extractExternalLinks(detailHtml);
    summary.externalLinks.push(...links);
    const parsed = extractAdmissionRecords(detailHtml, {
      school,
      title: item.title,
      sourceUrl: item.url,
    });
    if (!parsed.length) {
      summary.warnings.push(`未解析到结构化表格：${item.title}`);
    }
    records.push(...parsed);
  }

  summary.externalLinks = Array.from(new Set(summary.externalLinks));
  summary.records = records.length;
  return { records, summary };
}

function parseHireInfoItems(html) {
  const items = [];
  const pattern = /<a href=['"]([^'"]*viewHireInfo--[^'"]+)['"][^>]*>([\s\S]*?)<\/a>[\s\S]*?<td[^>]*class=["']ch-table-center["'][^>]*>([\s\S]*?)<\/td>/g;
  let match;
  while ((match = pattern.exec(html))) {
    items.push({
      url: toAbsolute(match[1]),
      title: textContent(match[2]),
      publishTime: textContent(match[3]),
    });
  }
  return items;
}

function extractDetailHtml(html) {
  const match = html.match(/<div class="yxk-detail-con">([\s\S]*?)<\/div>\s*<\/div>/);
  return match ? match[1] : html;
}

function extractAdmissionRecords(detailHtml, context) {
  const tables = parseHtmlTables(detailHtml);
  const records = [];
  for (const table of tables) {
    if (table.length < 2) continue;
    const headerIndex = table.findIndex((row) => row.some((cell) => normalizeHeader(cell)));
    if (headerIndex < 0) continue;
    const headers = table[headerIndex].map(normalizeHeader);
    for (const row of table.slice(headerIndex + 1)) {
      const raw = {};
      headers.forEach((key, index) => {
        if (!key) return;
        raw[key] = row[index] || "";
      });
      const year = numberValue(raw.year) || inferYear(context.title);
      const province = normalizeProvince(raw.province);
      const minScore = numberValue(raw.minScore);
      if (!year || !province || !minScore) continue;
      records.push({
        year,
        province,
        subject: normalizeSubject(raw.subject),
        batch: cleanValue(raw.batch),
        school: cleanValue(raw.school) || context.school.name,
        group: cleanValue(raw.group),
        major: cleanValue(raw.major),
        plan: numberValue(raw.plan),
        minScore,
        minRank: numberValue(raw.minRank),
        source: "阳光高考公开页",
        sourceUrl: context.sourceUrl,
      });
    }
  }
  return records;
}

function parseHtmlTables(html) {
  const tables = [];
  for (const tableMatch of html.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    const rows = [];
    for (const rowMatch of tableMatch[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
      const cells = [];
      for (const cellMatch of rowMatch[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)) {
        cells.push(textContent(cellMatch[1]));
      }
      if (cells.length) rows.push(cells);
    }
    if (rows.length) tables.push(rows);
  }
  return tables;
}

function normalizeHeader(header) {
  const key = textContent(header).replace(/\s/g, "");
  const lower = key.toLowerCase();
  const aliases = {
    year: "year",
    province: "province",
    subject: "subject",
    batch: "batch",
    school: "school",
    group: "group",
    major: "major",
    plan: "plan",
    minscore: "minScore",
    minrank: "minRank",
  };
  if (aliases[lower]) return aliases[lower];

  const map = {
    年份: "year",
    年: "year",
    录取年份: "year",
    生源省份: "province",
    省份: "province",
    省市: "province",
    地区: "province",
    生源地: "province",
    考生省份: "province",
    科类: "subject",
    类别: "subject",
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
    最低录取分: "minScore",
    最低投档分: "minScore",
    分数线: "minScore",
    最高分: "",
    平均分: "",
    最低位次: "minRank",
    投档最低位次: "minRank",
    录取最低位次: "minRank",
    位次: "minRank",
    排名: "minRank",
  };
  return map[key] || "";
}

function recordToCsvLine(record) {
  return [
    record.year,
    record.province,
    record.subject,
    record.batch,
    record.school,
    record.group,
    record.major,
    record.plan || "",
    record.minScore,
    record.minRank || "",
    record.source,
    record.sourceUrl,
  ].map(csvEscape).join(",");
}

function extractExternalLinks(html) {
  const links = new Set();
  for (const match of html.matchAll(/href=['"]([^'"]+)['"]/gi)) {
    const url = toAbsolute(decodeHtml(match[1]));
    if (/^https?:\/\//.test(url) && !url.includes("gaokao.chsi.com.cn")) links.add(url);
  }
  for (const match of textContent(html).matchAll(/https?:\/\/[^\s"'<>，。)）]+/g)) {
    const url = match[0].replace(/[.;；。]+$/, "");
    if (!url.includes("gaokao.chsi.com.cn")) links.add(url);
  }
  return Array.from(links);
}

async function fetchText(url) {
  const response = await fetch(url, { headers: DEFAULT_HEADERS, redirect: "follow" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${url}`);
  }
  return response.text();
}

function toAbsolute(value) {
  if (!value) return "";
  if (/^https?:\/\//.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;
  return new URL(value, CHSI_BASE).href;
}

function textContent(html) {
  return decodeHtml(String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim());
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function inferYear(text) {
  const match = String(text || "").match(/20\d{2}/);
  return match ? Number(match[0]) : 0;
}

function cleanValue(value) {
  return textContent(value).replace(/^[-—]+$/, "").trim();
}

function normalizeProvince(value) {
  const text = cleanValue(value);
  if (!text || text === "全国") return "";
  return text;
}

function normalizeSubject(value) {
  const text = cleanValue(value);
  if (text.includes("物理") || text.includes("理科")) return "物理";
  if (text.includes("历史") || text.includes("文科")) return "历史";
  if (text.includes("综合")) return "综合";
  return text;
}

function numberValue(value) {
  const match = String(value || "").replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
