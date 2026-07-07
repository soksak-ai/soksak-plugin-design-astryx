// soksak-plugin-design-astryx 템플릿 생성기 v2 — Astryx CLI 템플릿(TSX) 을 원본 그대로(verbatim)
// generated/templates.json 으로 포장한다. CONTRACT §13(Template law v2): 트리 변환·스켈레톤 없음.
// 619 전량이 available/unavailable 로 들어간다(기계적 완전성 = sourceCount === entries.length,
// 거부 버킷·침묵 드랍 0). 렌더 가능성은 러너 require-shim(§7 Gate A) 이 담는 모듈로 판정한다:
// recharts·@astryxdesign/lab = 미설치, @stylexjs/stylex = 설치돼도 컴파일타임 CSS-in-JS(러너 미트랜스폼)
// → honest available:false + 기계 판독 reason. 그 밖은 available:true.
//
// 이 파일은 스크립트(CLI)이자 순수 함수 모듈이다. main() 은 CLI 직접 실행 때만 돈다.
// 테스트(scripts/*.test.ts)는 아래 export 된 순수 함수를 그대로 검증한다.

import ts from "typescript";
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(HERE, "..");

// ── 소스 위치 해석 ───────────────────────────────────────────────────────────
// 정본 = 설치된 @astryxdesign/cli 의 templates(핀 0.1.3). 없으면 로컬 체크아웃 폴백.
const CLI_TEMPLATES = path.join(PLUGIN_ROOT, "node_modules", "@astryxdesign", "cli", "templates");
const FALLBACK_TEMPLATES = "/Users/max/ai/cc/astryx/packages/cli/templates";

export function resolveTemplatesDir() {
  if (existsSync(path.join(CLI_TEMPLATES, "pages"))) return CLI_TEMPLATES;
  if (existsSync(path.join(FALLBACK_TEMPLATES, "pages"))) return FALLBACK_TEMPLATES;
  throw new Error("[gen-templates] Astryx CLI 템플릿을 찾지 못함(node_modules/@astryxdesign/cli/templates 부재).");
}

// ── import 모듈 id 수집(AST — 템플릿 리터럴 안의 가짜 import 는 안 센다) ──────
// 최상위 import/export-from 선언의 모듈 스펙만 본다. pages/ide·documentation-technical 처럼 코드
// 샘플 문자열에 `import ... from`·`export default` 가 박힌 파일도 AST 는 실제 최상위 선언만 집는다
// (§16 compile-based). 값/타입 import 구분 없이 스펙을 모은다 — requires 는 "파일이 import 하는 모듈".
export function collectImports(sf) {
  const mods = new Set();
  for (const st of sf.statements) {
    let spec = null;
    if (ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier)) {
      spec = st.moduleSpecifier.text;
    } else if (ts.isExportDeclaration(st) && st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier)) {
      spec = st.moduleSpecifier.text;
    }
    if (spec) mods.add(spec);
  }
  return mods;
}

// ── requires 정규화 ─────────────────────────────────────────────────────────
// @astryxdesign/core[/<Subpath>] 은 러너 배럴이 하나로 해소한다(§16 barrel-only, per-subpath 불요)
// → 단일 id 로 접는다. 그 밖 스펙(react·@heroicons/react/*·lucide-react·recharts·lab·stylex)은 원문 유지.
export function normalizeRequire(spec) {
  if (spec === "@astryxdesign/core" || spec.startsWith("@astryxdesign/core/")) return "@astryxdesign/core";
  return spec;
}
export function requiresOf(mods) {
  const out = new Set();
  for (const m of mods) out.add(normalizeRequire(m));
  return [...out].sort();
}

// ── 가용성 판정(CONTRACT §13) ───────────────────────────────────────────────
// available = 러너 require-shim(§7 Gate A) 이 모든 import 를 해소하는가. 판정은 러너의 능력이지
// node_modules 존재가 아니다(러너 esbuild 번들이 담는 모듈이 진실).
//   RESOLVABLE = react[/*]·react-dom[/*]·@astryxdesign/core[/*]·@heroicons/react[/*]·lucide-react.
//   COMPILE_TIME_ONLY = @stylexjs/stylex — 설치돼도 러너가 babel/postcss 트랜스폼을 안 돌려 CSS 무발행.
//   그 밖(recharts·@astryxdesign/lab·미래 신규 모듈) = 러너 미해소 → "<mod> (not installed)".
function isResolvable(spec) {
  if (spec === "react" || spec.startsWith("react/")) return true;
  if (spec === "react-dom" || spec.startsWith("react-dom/")) return true;
  if (spec === "@astryxdesign/core" || spec.startsWith("@astryxdesign/core/")) return true;
  if (spec === "@heroicons/react" || spec.startsWith("@heroicons/react/")) return true;
  if (spec === "lucide-react") return true;
  return false;
}
const COMPILE_TIME_ONLY = [
  [(s) => s === "@stylexjs/stylex" || s.startsWith("@stylexjs/stylex/"), "@stylexjs/stylex compile-time transform required"],
];
export function classifyAvailability(mods) {
  // 컴파일타임 전용(설치돼도 러너 미트랜스폼) 우선.
  for (const [match, reason] of COMPILE_TIME_ONLY) {
    for (const m of mods) if (match(m)) return { available: false, reason };
  }
  // 러너 shim 미해소 모듈 = 미설치. 결정론적 사유 위해 스펙 사전순 첫 미해소.
  for (const spec of [...mods].sort()) {
    if (!isResolvable(spec)) return { available: false, reason: `${spec} (not installed)` };
  }
  return { available: true };
}

// ── 표시명(슬러그 파생, CONTRACT §13) ───────────────────────────────────────
function humanize(base) {
  return base
    .replace(/[-_]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
// name = slug 파생. page id = "pages/<dir>" → 디렉토리 휴머나이즈. block id 파일 베이스 휴머나이즈.
// themes/<theme>/icons = 베이스 "icons" 만으론 7종 동명 → 테마명 접두("Butter Icons").
export function deriveName(id) {
  const parts = id.split("/");
  const base = parts[parts.length - 1];
  const parent = parts.length >= 2 ? parts[parts.length - 2] : "";
  if (base === "icons" && parent) return humanize(parent) + " Icons";
  return humanize(base);
}

// ── 마운트 가능성(CONTRACT §13) — AST 최상위 default export 만 진짜로 센다 ──
// 코드샘플 템플릿 리터럴 속 `export default`(pages/ide 등) 는 문장이 아니므로 오탐 없음(정규식 금지 사유).
export function hasDefaultExport(sf) {
  for (const st of sf.statements) {
    if (ts.isExportAssignment(st) && !st.isExportEquals) return true; // export default <expr>
    const mods = ts.canHaveModifiers(st) ? ts.getModifiers(st) : undefined;
    if (mods && mods.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) return true; // export default function/class
    if (ts.isExportDeclaration(st) && st.exportClause && ts.isNamedExports(st.exportClause)) {
      for (const el of st.exportClause.elements) if (el.name.text === "default") return true; // export {X as default}
    }
  }
  return false;
}

// ── 한 소스 → verbatim TemplateEntry ────────────────────────────────────────
// code = 파일 바이트 그대로(진실). requires/available/reason 은 파싱된 import 에서 파생. 부분 변환·
// 거부 없음 — 못 렌더하면 available:false + reason 으로 들어간다. 가용성 = 심 해소 AND 마운트 가능한
// default export(테마 아이콘 헬퍼 7종이 후자에서 걸린다 — 적용하면 "No default export" 라 정직 차단).
export function buildEntry({ id, kind, code }) {
  const sf = ts.createSourceFile(`${id}.tsx`, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const mods = collectImports(sf);
  const requires = requiresOf(mods);
  let { available, reason } = classifyAvailability(mods);
  if (available && !hasDefaultExport(sf)) {
    available = false;
    reason = "helper module (no default export to mount)";
  }
  const entry = { id, kind, name: deriveName(id), code, requires, available };
  if (!available) entry.reason = reason;
  return entry;
}

// ── 소스 수집(pages/*/page.tsx + blocks/components/**/*.tsx + themes/*/*.tsx) ──
// 619 전량 = 41 page + 578 block(571 컴포넌트 블록 + 7 테마 아이콘 헬퍼). 테마 아이콘은 default
// export 없는 헬퍼 모듈이라 page 가 아니라 block 종류로 들어간다(마운트 아닌 참조 대상, §13).
export function collectSources(templatesDir) {
  const out = [];
  // pages: pages/<dir>/page.tsx → id "pages/<dir>", kind page.
  const pagesDir = path.join(templatesDir, "pages");
  if (existsSync(pagesDir)) {
    for (const dir of readdirSync(pagesDir).sort()) {
      const pageTsx = path.join(pagesDir, dir, "page.tsx");
      if (!existsSync(pageTsx)) continue;
      out.push({ id: `pages/${dir}`, kind: "page", tsxPath: pageTsx });
    }
  }
  // blocks: blocks/components/<Comp>/<file>.tsx → id "blocks/components/<Comp>/<file>", kind block.
  const compRoot = path.join(templatesDir, "blocks", "components");
  if (existsSync(compRoot)) {
    for (const comp of readdirSync(compRoot).sort()) {
      const compDir = path.join(compRoot, comp);
      let files;
      try { files = readdirSync(compDir); } catch { continue; }
      for (const f of files.sort()) {
        if (!f.endsWith(".tsx")) continue;
        out.push({ id: `blocks/components/${comp}/${f.slice(0, -4)}`, kind: "block", tsxPath: path.join(compDir, f) });
      }
    }
  }
  // themes: themes/<theme>/*.tsx → id "themes/<theme>/<file>", kind block(아이콘 헬퍼).
  const themesDir = path.join(templatesDir, "themes");
  if (existsSync(themesDir)) {
    for (const theme of readdirSync(themesDir).sort()) {
      const themeDir = path.join(themesDir, theme);
      let files;
      try { files = readdirSync(themeDir); } catch { continue; }
      for (const f of files.sort()) {
        if (!f.endsWith(".tsx")) continue;
        out.push({ id: `themes/${theme}/${f.slice(0, -4)}`, kind: "block", tsxPath: path.join(themeDir, f) });
      }
    }
  }
  return out;
}

// ── 정직 회계(byReason) — main() 과 법 테스트 공용 ──────────────────────────
export function census(entries) {
  const available = entries.filter((e) => e.available).length;
  const byReason = {};
  for (const e of entries) if (!e.available) byReason[e.reason] = (byReason[e.reason] || 0) + 1;
  return { total: entries.length, available, unavailable: entries.length - available, byReason };
}

// ── 생성 파이프라인(스캔 → verbatim 포장 → 기록) — CLI·법 테스트 공용 ────────
// generated/templates.json 을 쓰고 { entries, sourceCount } 를 돌려준다. 레거시 templates-report.json
// 은 v2 에서 사라졌다(트리 변환 리포트 개념 제거) — 남아있으면 지운다(git remembers).
export function generate() {
  const templatesDir = resolveTemplatesDir();
  const sources = collectSources(templatesDir);

  const entries = [];
  for (const s of sources) {
    const code = readFileSync(s.tsxPath, "utf8");
    entries.push(buildEntry({ id: s.id, kind: s.kind, code }));
  }
  entries.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const genDir = path.join(PLUGIN_ROOT, "generated");
  mkdirSync(genDir, { recursive: true });
  writeFileSync(path.join(genDir, "templates.json"), JSON.stringify(entries, null, 2) + "\n");
  const legacyReport = path.join(genDir, "templates-report.json");
  if (existsSync(legacyReport)) rmSync(legacyReport);

  return { entries, sourceCount: sources.length };
}

function main() {
  const { entries, sourceCount } = generate();
  if (sourceCount !== entries.length) {
    console.error(`[gen-templates] 회계 불일치: sourceCount=${sourceCount} entries=${entries.length}`);
    process.exit(1);
  }
  const c = census(entries);
  console.log(
    `[gen-templates] total=${c.total} available=${c.available} unavailable=${c.unavailable}` +
    ` byReason=${JSON.stringify(c.byReason)}`,
  );
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  try { main(); } catch (e) { console.error(e.stack || e.message || e); process.exit(1); }
}
