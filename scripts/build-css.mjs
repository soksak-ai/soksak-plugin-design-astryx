// CSS 산출물 빌드 — CONTRACT §12 build:css 단계. 두 생성물을 generated/ 에 쓴다:
//   generated/astryx.css      — core reset.css + dist/astryx.css 병합(§7 (1) 레이어 순서: reset → astryx-base → astryx-theme).
//   generated/theme-css.json  — { 테마이름: theme.css }(7종, §9).
// build.mjs 가 이들을 :root→:host 재작성 후 __ASTRYX_CSS__/__THEME_CSS_MAP__ define 으로 main.js 에 임베드한다.
// v3 전환: 러너(runner.js) 산출은 폐기 — 렌더 코어(src/render-core/)가 main.js import 그래프에 직접 들어간다(§12).
// 부분 산출 금지: 7 테마 중 하나라도 없거나 비면 throw(침묵 폴백은 잘못된 계약).
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GEN = path.join(root, "generated");

// 테마 7종 — 단일 진실은 src/types.ts 의 THEMES. 이 노드 .mjs 는 .ts 를 직접 import 못 하므로 목록을
// 복제한다. THEMES 가 바뀌면 이 배열도 함께 바꾼다(v1 고정 7종).
const THEMES = ["butter", "chocolate", "gothic", "matcha", "neutral", "stone", "y2k"];

// reset.css → astryx.css 순서로 병합(§7 (1) 레이어 순서).
async function collectAstryxCss() {
  const resetPath = require.resolve("@astryxdesign/core/reset.css");
  const astryxPath = require.resolve("@astryxdesign/core/astryx.css");
  const [reset, astryx] = await Promise.all([
    readFile(resetPath, "utf8"),
    readFile(astryxPath, "utf8"),
  ]);
  return `${reset}\n${astryx}`;
}

// 각 테마 패키지의 dist/theme.css 를 { 이름: css } 로 수집(빌드된 토큰 — JS 테마 import 불사용).
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
  const [astryxCss, themeCss] = await Promise.all([collectAstryxCss(), collectThemeCss()]);

  const missing = THEMES.filter((t) => typeof themeCss[t] !== "string" || themeCss[t].length === 0);
  if (missing.length) {
    throw new Error(`[design-astryx] theme.css 누락/빈값: ${missing.join(", ")}`);
  }

  await Promise.all([
    writeFile(path.join(GEN, "astryx.css"), astryxCss, "utf8"),
    writeFile(path.join(GEN, "theme-css.json"), JSON.stringify(themeCss), "utf8"),
  ]);

  console.log(
    `[design-astryx] build:css → astryx.css ${astryxCss.length}B, theme-css.json ${THEMES.length}themes`,
  );
}

main().catch((e) => {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});
