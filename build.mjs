// soksak-plugin-design-astryx 번들 빌드 — esbuild 단일 ESM main.js(로더가 blob-URL 로 import).
// 제약(erd 선례): 단일 파일·sibling 파일 런타임 읽기 불가(blob). 빌드타임 생성물을 문자열 define 으로 주입한다.
//
// v3 전환(§7·§12): 러너(runner.js) 임베드 폐기 — 렌더 코어(src/render-core/)가 뷰를 통해 main.js import
// 그래프에 직접 들어간다(react·react-dom/client·@astryxdesign/core·sucrase·heroicons·lucide 동반). 더는 별도
// __RUNNER_JS__ 문자열이 아니다. CSS 페이로드(astryx.css·테마 7종)는 :root→:host 재작성을 이 지점에서만
// 적용해 임베드한다(shadow 주입용, 단일 지점 — scripts/css-rewrite.mjs, 유닛 테스트 동반).
//
// 선행: `npm run gen`(catalog·templates·docs) → `npm run build:css`(astryx.css·theme-css.json) → 이 빌드.
//       package.json build 스크립트가 순서를 강제한다. 생성물이 없으면 throw(침묵 폴백 금지 — 부분 산출은 잘못된 계약).
import { build, context } from "esbuild";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rewriteRootToHost } from "./scripts/css-rewrite.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const GEN = path.resolve(root, "generated");

// 필수 생성물을 읽는다. 하나라도 없으면 throw.
async function readGen(rel) {
  const p = path.join(GEN, rel);
  try {
    return await readFile(p, "utf8");
  } catch {
    throw new Error(
      `[design-astryx] 생성물 누락: generated/${rel} — 먼저 \`npm run gen && npm run build:css\` 를 실행하십시오.`,
    );
  }
}

// 카탈로그에서 제어 입력 컴포넌트 type 을 파생(단일 진실) — value prop 이 있고 on* 콜백 prop 을 가진 컴포넌트.
// 정적 목업 입력 법칙(render-core 트리 렌더의 sanitizeProps)이 이 집합에만 value→defaultValue 이관을 적용한다.
// ProgressBar/Timestamp 처럼 value 를 표시용으로만 읽는(on* 콜백 없는) 컴포넌트는 제외돼 손상되지 않는다.
// 뷰의 mount 가 __CONTROLLED_INPUT_TYPES__ define 을 소비하거나 임베드 카탈로그에서 파생한다 — 미참조 시 define 은 무해.
function controlledInputTypes(catalog) {
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

async function buildDefines() {
  const [catalog, templates, astryxCss, themeCssMap] = await Promise.all([
    readGen("catalog.json"),
    readGen("templates.json"),
    readGen("astryx.css"), // reset.css + dist/astryx.css 병합(build:css 산출, 원문 :root).
    readGen("theme-css.json"), // { "<theme>": "<theme.css 원문>" }(build:css 산출).
  ]);
  const controlled = controlledInputTypes(JSON.parse(catalog));
  // shadow 주입용 :root→:host 재작성 — astryx.css 통짜, 테마 맵은 값마다(§7·§12).
  const astryxCssHost = rewriteRootToHost(astryxCss);
  const themeMapHost = Object.fromEntries(
    Object.entries(JSON.parse(themeCssMap)).map(([name, css]) => [name, rewriteRootToHost(css)]),
  );
  return {
    __CATALOG_JSON__: JSON.stringify(catalog), // 이미 JSON 문자열 → 문자열 리터럴로 한 번 더 감싼다.
    __TEMPLATES_JSON__: JSON.stringify(templates),
    __ASTRYX_CSS__: JSON.stringify(astryxCssHost), // 재작성된 CSS 원문 문자열(소비측이 그대로 주입).
    __THEME_CSS_MAP__: JSON.stringify(JSON.stringify(themeMapHost)), // JSON 문자열(소비측이 JSON.parse).
    __CONTROLLED_INPUT_TYPES__: JSON.stringify(controlled), // string[] 리터럴(소비측이 Set 으로).
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
    jsx: "automatic", // 렌더 코어(render-core/*.tsx)·뷰 프로바이더가 main.js 그래프에 들어오므로 필수.
    jsxImportSource: "react",
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
    const { size } = await stat(path.resolve(root, "main.js"));
    console.log(`[design-astryx] built main.js (${size}B)`);
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
