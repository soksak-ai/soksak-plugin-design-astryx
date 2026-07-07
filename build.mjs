// soksak-plugin-design-astryx 번들 빌드 — esbuild 단일 ESM main.js(로더가 blob-URL 로 import).
// 제약(erd 선례): 단일 파일·상대/bare import 0. main.js 는 sibling 파일을 못 읽으므로(blob),
// 빌드타임에 만들어진 모든 생성물(카탈로그·템플릿·러너 번들·CSS)을 문자열 define 으로 주입한다.
//
// 선행: `npm run gen`(scripts/gen-catalog.mjs, scripts/gen-templates.mjs) 과
//       `npm run build:runner`(scripts/build-runner.mjs) 가 generated/ 를 채운 뒤 실행된다.
//       package.json 의 build 스크립트가 그 순서를 강제한다. 생성물이 없으면 이 빌드는 실패한다
//       (침묵 폴백 금지 — 부분 산출은 잘못된 계약이다).
import { build, context } from "esbuild";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const GEN = path.resolve(root, "generated");

// 필수 생성물을 읽어 JSON 문자열 리터럴 define 으로 만든다. 하나라도 없으면 throw.
async function readGen(rel) {
  const p = path.join(GEN, rel);
  try {
    return await readFile(p, "utf8");
  } catch {
    throw new Error(
      `[design-astryx] 생성물 누락: generated/${rel} — 먼저 \`npm run gen && npm run build:runner\` 를 실행하십시오.`,
    );
  }
}

// 7개 테마 CSS 를 { name: css } 맵으로 묶는다(러너 임베드용). 러너 빌드가 이미 generated/theme-css.json
// 으로 합쳐 놓았다고 가정 — build-runner.mjs 가 소유하는 산출물이다. 여기선 통짜 문자열로만 다룬다.
async function buildDefines() {
  const [catalog, templates, runnerJs, astryxCss, themeCssMap] = await Promise.all([
    readGen("catalog.json"),
    readGen("templates.json"),
    readGen("runner.js"), // scripts/build-runner.mjs 산출 — 러너 IIFE 번들 문자열.
    readGen("astryx.css"), // reset.css + dist/astryx.css 병합(build-runner.mjs 산출).
    readGen("theme-css.json"), // { "<theme>": "<theme.css 원문>" } (build-runner.mjs 산출).
  ]);
  return {
    __CATALOG_JSON__: JSON.stringify(catalog), // 이미 JSON 문자열 → 문자열 리터럴로 한 번 더 감싼다.
    __TEMPLATES_JSON__: JSON.stringify(templates),
    __RUNNER_JS__: JSON.stringify(runnerJs),
    __ASTRYX_CSS__: JSON.stringify(astryxCss),
    __THEME_CSS_MAP__: JSON.stringify(themeCssMap),
  };
}

async function main() {
  const defines = await buildDefines();
  const opts = {
    entryPoints: ["src/plugin-entry.ts"],
    bundle: true,
    format: "esm", // 로더가 dynamic import() 하는 ESM 단일 파일.
    platform: "browser",
    target: "es2022",
    define: {
      "process.env.NODE_ENV": '"production"',
      "import.meta.env.DEV": "false",
      ...defines,
    },
    outfile: "main.js",
    minify: false, // 가독(stale 검토). 발행 시 minify 전환.
    legalComments: "none",
    logLevel: "info",
  };

  if (process.argv.includes("--watch")) {
    const ctx = await context(opts);
    await ctx.watch();
    console.log("[design-astryx] watching src → main.js …");
  } else {
    await build(opts);
    console.log("[design-astryx] built main.js");
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
