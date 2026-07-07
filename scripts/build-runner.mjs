// 러너 산출물 빌드 — CONTRACT §12 의 build:runner 단계. 세 생성물을 generated/ 에 쓴다:
//   generated/runner.js       — runner/entry.tsx 의 IIFE 번들(react + react-dom + @astryxdesign/core).
//   generated/astryx.css      — core reset.css + dist/astryx.css 병합(임베드 CSS §7 (1)).
//   generated/theme-css.json  — { 테마이름: theme.css }(7종, §9 재발행용 맵).
// build.mjs 가 이들을 __RUNNER_JS__/__ASTRYX_CSS__/__THEME_CSS_MAP__ define 으로 main.js 에 임베드한다.
// 부분 산출 금지: 7 테마 중 하나라도 없거나 비면 throw(침묵 폴백은 잘못된 계약).
import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GEN = path.join(root, "generated");

// 테마 7종 — 단일 진실은 src/types.ts 의 THEMES. 이 빌드 스크립트는 노드 .mjs 라 .ts 를 직접
// import 못 하므로 그 목록을 여기 복제한다. THEMES 가 바뀌면 이 배열도 함께 바꾼다(v1 고정 7종).
const THEMES = ["butter", "chocolate", "gothic", "matcha", "neutral", "stone", "y2k"];

// 카탈로그에서 제어 입력 컴포넌트 type 을 파생(단일 진실) — value prop 이 있고 on* 콜백 prop 을
// 하나라도 가진 컴포넌트. 정적 목업 입력 법칙(render.sanitizeProps)이 이 집합에만 value→defaultValue
// 이관을 적용한다. ProgressBar/Timestamp 처럼 value 를 표시용으로만 읽는(on* 콜백 없는) 컴포넌트는
// 제외돼 손상되지 않는다. gen 단계가 만든 generated/catalog.json 을 읽는다(파이프라인 순서 보장).
async function controlledInputTypes() {
  const catalogPath = path.join(GEN, "catalog.json");
  let raw;
  try {
    raw = await readFile(catalogPath, "utf8");
  } catch {
    throw new Error(
      `[design-astryx] catalog.json 없음(${catalogPath}) — build:runner 전에 gen 을 먼저 실행하세요.`,
    );
  }
  const catalog = JSON.parse(raw);
  const isCallback = (p) => typeof p?.type === "string" && p.type.includes("=>");
  const out = [];
  for (const [type, entry] of Object.entries(catalog)) {
    const props = entry?.props;
    if (!props || !props.value) continue;
    const hasHandler = Object.entries(props).some(([k, p]) => /^on[A-Z]/.test(k) && isCallback(p));
    if (hasHandler) out.push(type);
  }
  out.sort();
  return out;
}

// runner/entry.tsx 를 단일 IIFE 로 번들. 미리보기가 <script src="./runner.js"> 로 즉시 실행한다.
// __CONTROLLED_INPUT_TYPES__ 는 카탈로그 파생 배열 리터럴로 인라인된다(entry 가 Set 으로 소비).
async function bundleRunner(controlled) {
  const result = await build({
    entryPoints: [path.join(root, "runner/entry.tsx")],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2022",
    jsx: "automatic",
    define: {
      "process.env.NODE_ENV": '"production"',
      __CONTROLLED_INPUT_TYPES__: JSON.stringify(controlled),
    },
    minify: true,
    legalComments: "none",
    write: false,
  });
  const files = result.outputFiles ?? [];
  if (files.length !== 1) {
    throw new Error(`[design-astryx] runner 번들 출력이 1개가 아님(${files.length}개).`);
  }
  return files[0].text;
}

// reset.css → astryx.css 순서로 병합(§7 (1) 레이어 순서: reset → astryx-base → astryx-theme).
async function collectAstryxCss() {
  const resetPath = require.resolve("@astryxdesign/core/reset.css");
  const astryxPath = require.resolve("@astryxdesign/core/astryx.css");
  const [reset, astryx] = await Promise.all([
    readFile(resetPath, "utf8"),
    readFile(astryxPath, "utf8"),
  ]);
  return `${reset}\n${astryx}`;
}

// 각 테마 패키지의 dist/theme.css 를 { 이름: css } 로 수집(빌드된 :root 변수 — JS 테마 import 불사용).
async function collectThemeCss() {
  const entries = await Promise.all(
    THEMES.map(async (t) => {
      const cssPath = require.resolve(`@astryxdesign/theme-${t}/theme.css`);
      const css = await readFile(cssPath, "utf8");
      return [t, css];
    }),
  );
  return Object.fromEntries(entries);
}

async function main() {
  await mkdir(GEN, { recursive: true });
  const controlled = await controlledInputTypes();
  const [runnerJs, astryxCss, themeCss] = await Promise.all([
    bundleRunner(controlled),
    collectAstryxCss(),
    collectThemeCss(),
  ]);

  const missing = THEMES.filter((t) => typeof themeCss[t] !== "string" || themeCss[t].length === 0);
  if (missing.length) {
    throw new Error(`[design-astryx] theme.css 누락/빈값: ${missing.join(", ")}`);
  }
  if (!runnerJs || runnerJs.length === 0) {
    throw new Error("[design-astryx] runner.js 번들이 비었습니다.");
  }

  await Promise.all([
    writeFile(path.join(GEN, "runner.js"), runnerJs, "utf8"),
    writeFile(path.join(GEN, "astryx.css"), astryxCss, "utf8"),
    writeFile(path.join(GEN, "theme-css.json"), JSON.stringify(themeCss), "utf8"),
  ]);

  console.log(
    `[design-astryx] build:runner → runner.js ${runnerJs.length}B, ` +
      `astryx.css ${astryxCss.length}B, theme-css.json ${THEMES.length}themes, ` +
      `controlledInputs ${controlled.length}`,
  );
}

main().catch((e) => {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});
