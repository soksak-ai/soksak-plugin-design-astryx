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
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  const [catalog, templates] = await Promise.all([
    readGen("catalog.json"),
    readGen("templates.json"),
  ]);
  const controlled = controlledInputTypes(JSON.parse(catalog));
  // CSS 정의(__ASTRYX_CSS__/__THEME_CSS_MAP__) 폐기 — 뷰가 Chromium 사이드카 서피스로 이전해 main.js
  // 는 더는 CSS 를 주입하지 않는다(shadow :root→:host 재작성도 소멸). standalone 앱이 원문 :root CSS 를
  // generated/ 에서 직접 읽어 HTML 에 인라인한다(buildStandalone). render-modules 가 참조하던 define 은
  // typeof 가드로 "" 폴백(무해).
  return {
    __CATALOG_JSON__: JSON.stringify(catalog), // 이미 JSON 문자열 → 문자열 리터럴로 한 번 더 감싼다.
    __TEMPLATES_JSON__: JSON.stringify(templates),
    __CONTROLLED_INPUT_TYPES__: JSON.stringify(controlled), // string[] 리터럴(소비측이 Set 으로).
  };
}

// <script>/<style> 종료 시퀀스 이스케이프 — minify 된 JS/CSS 문자열에 </script>·</style> 가 들어가면
// 태그가 조기 종료된다. JS 문자열·CSS 안에선 <\/ 도 동일 의미라 무해하게 치환한다.
function escInline(s, tag) {
  return s.replace(new RegExp(`</${tag}`, "gi"), `<\\/${tag}`);
}

// 두 번째 타깃 — 사이드카(browser-chromium, CEF 149=anchor 네이티브) 서피스에 file:// 로 로드되는
// 자기완결 standalone.html. 앱 엔트리(src/app/entry.tsx)를 IIFE 로 번들(file:// 에서 ESM/CORS 회피)해
// 원문 :root CSS(재작성 없음 — 실 document 라 :root 가 <html> 에 바인딩)와 함께 한 파일로 인라인한다.
// 성능: 정적 자산(React·astryx·catalog·테마)만 굽고, 호스트 전용 templates(1.5MB)·docs 는 제외한다
// (앱은 스냅샷을 그릴 뿐 템플릿/문서를 안 읽는다). 시드(generated/standalone-snapshot.json)는 선택 —
// 없으면 빈 뷰어(호스트가 cefQuery 로 붙어 스냅샷 push).
async function buildStandalone(defines) {
  const [astryxCss, themeMapRaw, seedJson] = await Promise.all([
    readGen("astryx.css"), // 원문 :root(build:css 산출) — 재작성 안 함.
    readGen("theme-css.json").then(JSON.parse),
    readFile(path.join(GEN, "standalone-snapshot.json"), "utf8").catch(() => "null"),
  ]);
  const css = [astryxCss, ...Object.values(themeMapRaw)].join("\n");

  const result = await build({
    entryPoints: ["src/app/entry.tsx"],
    bundle: true,
    format: "iife", // 자기실행 — import/export 없음 → file:// 에서 CORS/모듈 문제 회피.
    platform: "browser",
    target: "es2022",
    jsx: "automatic",
    jsxImportSource: "react",
    define: {
      "process.env.NODE_ENV": '"production"',
      "import.meta.env.DEV": "false",
      __CATALOG_JSON__: defines.__CATALOG_JSON__, // 실 카탈로그 — 트리 렌더 레지스트리·인스펙터 스키마.
      __TEMPLATES_JSON__: JSON.stringify("[]"), // 앱 불요(호스트 전용) — 1.5MB 제외(성능).
      __ASTRYX_CSS__: '""', // CSS 는 HTML 래퍼가 주입 — CanvasApp 은 이 define 을 안 읽는다.
      __THEME_CSS_MAP__: JSON.stringify("{}"),
      __CONTROLLED_INPUT_TYPES__: "[]", // render-modules 가 카탈로그에서 런타임 파생(이 define 미사용).
    },
    outfile: "app.js",
    write: false, // 인라인 위해 캡처.
    minify: true, // HTML 인라인 → 크기 최소화.
    legalComments: "none",
    logLevel: "info",
  });
  const bundle = result.outputFiles[0].text;

  const html = `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body,#root{height:100%;margin:0;background:var(--color-background-body)}</style>
<style>${escInline(css, "style")}</style>
</head><body>
<div id="root"></div>
<script>window.__DESIGN_SNAPSHOT__=${escInline(seedJson, "script")};</script>
<script>${escInline(bundle, "script")}</script>
</body></html>`;

  await writeFile(path.resolve(root, "standalone.html"), html, "utf8");
  console.log(`[design-astryx] built standalone.html (${html.length}B, bundle ${bundle.length}B)`);
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
    await buildStandalone(defines); // watch 는 main.js 만 추종 — standalone 은 초기 1회(재빌드는 node build.mjs).
    console.log("[design-astryx] watching src → main.js …");
  } else {
    await build(opts);
    const { size } = await stat(path.resolve(root, "main.js"));
    console.log(`[design-astryx] built main.js (${size}B)`);
    await buildStandalone(defines); // 두 번째 타깃 — Chromium 서피스용 자기완결 뷰어.
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
