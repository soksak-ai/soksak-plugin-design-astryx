// generated/docs.json + generated/docs-report.json + src/docs/docs.embedded.ts 생성기 — CONTRACT §14 docs law 의 유일 구현.
// 소스: node_modules/@astryxdesign/cli/docs/*.doc.mjs (Astryx 공식 토픽 독트린, Meta 저작).
//
// 토픽 집합(기계적·화이트리스트 없음): 소스 디렉토리에서 `.doc.mjs` 로 끝나는 파일(= `.doc.dense.mjs`·
// `.doc.zh.mjs` 변형 제외). 접미사를 떼면 토픽 id. 0.1.3 에서 17개.
//
// 변형 선택(토픽별): `<topic>.doc.dense.mjs` 가 있으면 그걸 우선(Meta 의 토큰 절약 LLM 압축 —
// layout/principles/theme/tokens), 없으면 `<topic>.doc.mjs`. dense 는 `docsDense`, 평문은 `docs` export.
//
// 완전성: 발견한 모든 토픽이 반드시 산출에 들어간다(누락 0). 어느 토픽이든 해소·렌더 실패면 throw
// (침묵 드랍·빈 산출 금지 — 카탈로그·템플릿 법과 같은 무손실 규율).
//
// 산출:
//   - generated/docs.json         : { <topic>: { title, dense, description, text } }  (런타임 아티팩트)
//   - generated/docs-report.json  : { sourceCount, topics[], dense[], plain[] }        (완전성 리포트)
//   - src/docs/docs.embedded.ts   : 커밋되는 TS 소스(런타임이 import — 번들·vitest 항상 존재, 클린빌드 안전)
//
// 런타임이 generated/docs.json 대신 커밋 TS 를 import 하는 이유: build.mjs(계약 소유·이 패스 밖)에
// __DOCS_JSON__ define 을 못 넣고, generated/ 는 git 무시라 클린 `npm run build` 시 esbuild 가 그 import 를
// 못 풀기 때문. 커밋 소스면 파이프라인 훅(package.json) 수정 없이 안전하다.

import { readdir, readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const DOCS_DIR = path.resolve(ROOT, "node_modules/@astryxdesign/cli/docs");
const OUT_DOCS = path.resolve(ROOT, "generated/docs.json");
const OUT_REPORT = path.resolve(ROOT, "generated/docs-report.json");
const OUT_EMBED = path.resolve(ROOT, "src/docs/docs.embedded.ts");

// ── 순수 헬퍼(테스트에서 직접 검증) ───────────────────────────────────────────

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

// 소스 디렉토리의 파일 목록 → 토픽 id 집합(정렬). `.doc.mjs` 만(변형 `.doc.dense.mjs`·`.doc.zh.mjs` 제외).
export function topicsFromFiles(files) {
  return files
    .filter((f) => f.endsWith(".doc.mjs"))
    .map((f) => f.slice(0, -".doc.mjs".length))
    .sort();
}

export async function discoverTopics(docsDir = DOCS_DIR) {
  return topicsFromFiles(await readdir(docsDir));
}

// 토픽 → 실제 사용할 소스 파일(dense 우선). { file, dense }.
export async function resolveTopicFile(topic, docsDir = DOCS_DIR) {
  const dense = path.join(docsDir, `${topic}.doc.dense.mjs`);
  if (await exists(dense)) return { file: dense, dense: true };
  return { file: path.join(docsDir, `${topic}.doc.mjs`), dense: false };
}

// kebab topic → Title Case(dense 문서엔 title 필드가 없어 폴백). "getting-started" → "Getting Started".
export function titleCase(topic) {
  return topic
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ── 렌더링(섹션 → 평문) ───────────────────────────────────────────────────────

function renderList(block) {
  const items = Array.isArray(block.items) ? block.items : [];
  const style = block.style;
  return items
    .map((it, i) => {
      const t = String(it);
      if (style === "ordered") return `${i + 1}. ${t}`;
      if (style === "do") return `[do] ${t}`;
      if (style === "dont") return `[don't] ${t}`;
      return `- ${t}`;
    })
    .join("\n");
}

function renderCode(block) {
  const lang = typeof block.lang === "string" ? block.lang : "";
  const label = typeof block.label === "string" && block.label ? `${block.label}\n` : "";
  const code = typeof block.code === "string" ? block.code : "";
  return `${label}\`\`\`${lang}\n${code}\n\`\`\``;
}

function renderTable(block) {
  const headers = Array.isArray(block.headers) ? block.headers.map(String) : [];
  const rows = Array.isArray(block.rows) ? block.rows : [];
  if (headers.length === 0) return "";
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${(Array.isArray(r) ? r : []).map(String).join(" | ")} |`).join("\n");
  return [head, sep, body].filter(Boolean).join("\n");
}

// content 블록 하나 → 평문(미지 타입은 text/code 필드 최선, 그래도 없으면 빈 문자열).
export function renderBlock(block) {
  if (!block || typeof block !== "object") return "";
  switch (block.type) {
    case "prose":
      return typeof block.text === "string" ? block.text : "";
    case "list":
      return renderList(block);
    case "code":
      return renderCode(block);
    case "table":
      return renderTable(block);
    default:
      if (typeof block.text === "string") return block.text;
      if (typeof block.code === "string") return block.code;
      return "";
  }
}

// doc(dense 또는 평문) → 전 섹션 평문. 섹션 제목은 `## ` 헤더로, null 블록은 건너뛴다.
export function renderDoc(doc) {
  const sections = Array.isArray(doc?.sections) ? doc.sections : [];
  const parts = [];
  for (const section of sections) {
    if (!section || typeof section !== "object") continue;
    const title = typeof section.title === "string" ? section.title : "";
    if (title) parts.push(`## ${title}`);
    const content = Array.isArray(section.content) ? section.content : [];
    for (const block of content) {
      const rendered = renderBlock(block).trim();
      if (rendered) parts.push(rendered);
    }
  }
  return parts.join("\n\n").trim();
}

// ── 메인 생성 ─────────────────────────────────────────────────────────────────

export async function generate(docsDir = DOCS_DIR) {
  const topics = await discoverTopics(docsDir);
  if (topics.length === 0) {
    throw new Error(`[gen-docs] 토픽 0개 — 소스 디렉토리 확인: ${docsDir}`);
  }

  const docsOut = {};
  const denseTopics = [];
  const plainTopics = [];

  for (const topic of topics) {
    const { file, dense } = await resolveTopicFile(topic, docsDir);
    const mod = await import(pathToFileURL(file).href);
    // dense 파일은 docsDense, 평문은 docs. 방어적으로 둘 다 본다.
    const doc = mod.docsDense ?? mod.docs;
    if (!doc || typeof doc !== "object") {
      throw new Error(`[gen-docs] '${topic}' — ${path.basename(file)} 에 docs/docsDense export 없음`);
    }
    const title =
      typeof doc.title === "string" && doc.title.trim() ? doc.title : titleCase(topic);
    const description =
      typeof doc.description === "string" && doc.description.trim() ? doc.description.trim() : title;
    const text = renderDoc(doc);
    if (!text) {
      throw new Error(`[gen-docs] '${topic}' — 렌더 결과가 비었음(${path.basename(file)})`);
    }
    docsOut[topic] = { title, dense, description, text };
    (dense ? denseTopics : plainTopics).push(topic);
  }

  const report = {
    sourceCount: topics.length,
    topics,
    dense: denseTopics,
    plain: plainTopics,
  };

  await mkdir(path.dirname(OUT_DOCS), { recursive: true });
  await writeFile(OUT_DOCS, JSON.stringify(docsOut, null, 2) + "\n", "utf8");
  await writeFile(OUT_REPORT, JSON.stringify(report, null, 2) + "\n", "utf8");
  await mkdir(path.dirname(OUT_EMBED), { recursive: true });
  await writeFile(OUT_EMBED, embeddedSource(docsOut), "utf8");

  return { docs: docsOut, report };
}

// 커밋되는 런타임 소스(src/docs/docs.embedded.ts) 본문. 헤더 + 타입 붙인 const.
function embeddedSource(docsOut) {
  const body = JSON.stringify(docsOut, null, 2);
  return (
    "// AUTO-GENERATED by scripts/gen-docs.mjs — do not edit by hand.\n" +
    "// 재생성: node scripts/gen-docs.mjs. 소스 = @astryxdesign/cli/docs 의 topic 독트린.\n" +
    "// dense 변형(.doc.dense.mjs)이 있으면 우선(Meta 의 토큰 절약 압축), 없으면 .doc.mjs.\n" +
    '// 런타임이 이 커밋 소스를 import 한다(generated/docs.json 은 동일 산출의 아티팩트·테스트 픽스처).\n' +
    'import type { DocsIndex } from "./types";\n\n' +
    `export const DOCS: DocsIndex = ${body};\n`
  );
}

// 직접 실행 시 생성. (테스트는 named export 를 import 한다.)
const invokedDirectly = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (invokedDirectly) {
  generate()
    .then(({ report }) => {
      console.log(`[gen-docs] ${report.sourceCount}개 토픽 → generated/docs.json + src/docs/docs.embedded.ts`);
      console.log(`[gen-docs] dense(${report.dense.length}): ${report.dense.join(", ")}`);
      console.log(`[gen-docs] plain(${report.plain.length}): ${report.plain.join(", ")}`);
    })
    .catch((e) => {
      console.error(e?.stack ?? e?.message ?? e);
      process.exit(1);
    });
}
