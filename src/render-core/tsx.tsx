// 러너 tsx 경로 — 원본 TSX 프로그램을 무손실로 마운트한다(CONTRACT §7 TSX path). 트리 경로(render.tsx)와
// 대칭: 트리는 type→컴포넌트 레지스트리 주입, tsx 는 모듈 id→번들 네임스페이스(require-shim) 주입 —
// 둘 다 이 모듈은 astryx 에 묶이지 않고 주입받은 것만 쓴다(entry 가 실물, 테스트가 실물 소량 주입).
// 파이프라인: sucrase 트랜스폼(Learn Gate B 정확 설정) → require-shim 로 CJS 실행 → default export 마운트.
// 컴파일/런타임 실패는 빈 화면이 아니라 보이는 오류 표면(ErrorBox/NodeBoundary 재사용, 절대 throw 노출 금지).
import React from "react";
import { transform } from "sucrase";
import { ErrorBox, NodeBoundary } from "./tree";

// ── require-shim 이 해소할 번들 모듈(barrel-only 지도, Learn Gate A) ─────────────
// 94 subpath 의 모든 런타임 값 심볼이 @astryxdesign/core 배럴 네임스페이스에서 해소되므로 per-subpath
// 엔트리가 필요 없다. entry 는 실제 번들 네임스페이스를, 테스트는 실물 소량을 채운다.
export interface RunnerModules {
  react: unknown; // "react" — 훅(useState 등) 명명 export.
  jsxRuntime: unknown; // "react/jsx-runtime" — production jsx/jsxs/Fragment(automatic runtime).
  reactDom?: unknown; // "react-dom" — 임포트될 때만(코퍼스 0, 방어적).
  reactDomClient?: unknown; // "react-dom/client".
  core: unknown; // "@astryxdesign/core" 및 대문자 "@astryxdesign/core/<Subpath>" 의 배럴 네임스페이스.
  coreTheme: unknown; // "@astryxdesign/core/theme" — Theme/defineTheme/토큰 네임스페이스.
  coreThemeSyntax: unknown; // "@astryxdesign/core/theme/syntax" — githubLight 등 배럴 밖 프리셋.
  coreHooks: unknown; // "@astryxdesign/core/hooks" — useMediaQuery 등.
  heroiconsOutline24: unknown; // "@heroicons/react/24/outline".
  heroiconsSolid24: unknown; // "@heroicons/react/24/solid".
  heroiconsSolid20: unknown; // "@heroicons/react/20/solid".
  lucide: unknown; // "lucide-react".
}

// ── 자산 자리표시자 법칙(§7) — file:// 에서 해소 불가한 스킴 없는 이미지 경로의 정직한 자리표시자 ──
// 중립 회색 SVG(외부 자산·네트워크 무의존). scheme 있는 소스(http/https/data)는 손대지 않는다.
export const PLACEHOLDER_IMG: string =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="90" viewBox="0 0 120 90">' +
      '<rect width="120" height="90" rx="6" fill="#e5e7eb"/>' +
      '<path d="M20 66l24-28 18 20 12-12 26 20z" fill="#cbd5e1"/>' +
      '<circle cx="40" cy="30" r="8" fill="#cbd5e1"/></svg>',
  );

// 스킴 없는 경로 판정: ./x ../x /x x.png = 자리표시자 대상. http:/https:/data: = 스킴 보유(통과).
// //host (protocol-relative) 는 네트워크 URL 로 보아 통과(코퍼스 0, 브라우저 broken-image 로 정직 실패).
export function isSchemelessPath(src: string): boolean {
  if (src.startsWith("//")) return false;
  return !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(src);
}

// <img> prop 정직 강등: 스킴 없는 src → 자리표시자, 모든 img 에 onError 폴백(원 핸들러 보존).
export function fixImgProps(props: unknown): unknown {
  if (!props || typeof props !== "object") return props;
  const p = props as Record<string, unknown>;
  const src = p.src;
  const next: Record<string, unknown> = { ...p };
  if (typeof src === "string" && isSchemelessPath(src)) next.src = PLACEHOLDER_IMG;
  const prev = p.onError;
  next.onError = (e: unknown) => {
    const t = (e as { currentTarget?: { src?: string } } | undefined)?.currentTarget;
    if (t && t.src !== PLACEHOLDER_IMG) {
      try {
        t.src = PLACEHOLDER_IMG;
      } catch {
        // src 재지정 실패는 미리보기를 죽이지 않는다.
      }
    }
    if (typeof prev === "function") (prev as (ev: unknown) => void)(e);
  };
  return next;
}

// jsx-runtime 래핑 — <img> 를 만드는 자동 런타임 호출을 가로채 자산 법칙을 적용한다(§7 "at render time").
// 템플릿의 require("react/jsx-runtime") 는 이 래퍼를 받으므로 모든 템플릿-저작 <img> 가 교정된다
// (core 내부가 만드는 img 는 esbuild 로 이미 번들돼 이 shim 을 안 타므로 해당 없음 — 코퍼스는 원격 URL).
type JsxFn = (type: unknown, props: unknown, key?: unknown) => unknown;
interface JsxRuntimeShape {
  jsx: JsxFn;
  jsxs: JsxFn;
  Fragment: unknown;
}
export function wrapJsxRuntime(rt: unknown): JsxRuntimeShape {
  const r = rt as JsxRuntimeShape;
  const wrap =
    (orig: JsxFn): JsxFn =>
    (type, props, key) =>
      orig(type, type === "img" ? fixImgProps(props) : props, key);
  return { jsx: wrap(r.jsx), jsxs: wrap(r.jsxs), Fragment: r.Fragment };
}

// 미지 모듈 정직 스텁 — recharts/@astryxdesign/lab/raw @stylexjs/stylex 등 번들 밖 모듈. 어떤 심볼을
// 접근해도 자기 이름을 대는 ErrorBox 컴포넌트를 돌려준다(빈 화면·throw 금지). __esModule:true 로
// default/wildcard interop 이 이 프록시를 그대로 통과시켜 모든 명명 접근이 스텁 컴포넌트가 되게 한다.
export function unknownModuleStub(id: string): unknown {
  const Stub: React.FC = () => (
    <ErrorBox title={`Unavailable module: ${id}`} detail="not bundled in the preview runner" />
  );
  return new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "__esModule") return true;
        return Stub;
      },
    },
  );
}

// require-shim 조립 — 모듈 id 를 번들 네임스페이스로 해소. barrel-only(§7): @astryxdesign/core 와 그
// 모든 subpath 는 배럴 하나로 forward. jsx-runtime 은 자산 교정 래퍼로 감싼 것을 준다.
export function makeRequire(modules: RunnerModules): (id: string) => unknown {
  const jsxWrapped = wrapJsxRuntime(modules.jsxRuntime);
  return (id: string): unknown => {
    switch (id) {
      case "react":
        return modules.react;
      case "react/jsx-runtime":
      case "react/jsx-dev-runtime":
        return jsxWrapped;
      case "react-dom":
        return modules.reactDom ?? unknownModuleStub(id);
      case "react-dom/client":
        return modules.reactDomClient ?? unknownModuleStub(id);
      case "@heroicons/react/24/outline":
        return modules.heroiconsOutline24;
      case "@heroicons/react/24/solid":
        return modules.heroiconsSolid24;
      case "@heroicons/react/20/solid":
        return modules.heroiconsSolid20;
      case "lucide-react":
        return modules.lucide;
      case "@astryxdesign/core/theme":
        return modules.coreTheme;
      case "@astryxdesign/core/theme/syntax":
        return modules.coreThemeSyntax;
      case "@astryxdesign/core/hooks":
        return modules.coreHooks;
      default:
        if (id === "@astryxdesign/core" || id.startsWith("@astryxdesign/core/")) return modules.core;
        return unknownModuleStub(id);
    }
  };
}

// sucrase 트랜스폼(§7 Gate B 정확 설정) — ESM 을 CJS require/exports 로 낮추고 automatic jsx(production).
// 실패 시 throw(호출자가 잡아 COMPILE_FAILED/ErrorBox 로 바꾼다).
export function transformTsx(code: string, filePath = "page.tsx"): string {
  return transform(code, {
    transforms: ["typescript", "jsx", "imports"],
    jsxRuntime: "automatic",
    production: true,
    jsxImportSource: "react",
    filePath,
  }).code;
}

// 트랜스폼된 CJS 를 require-shim 아래 실행해 module.exports 를 얻는다. new Function 은 "use strict"·
// require/module/exports 를 받는 CJS 래퍼로 sucrase 출력을 그대로 돌린다.
export function evaluateTsx(
  compiled: string,
  req: (id: string) => unknown,
): Record<string, unknown> {
  const moduleObj = { exports: {} as Record<string, unknown> };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fn = new Function("require", "module", "exports", compiled) as (
    require: (id: string) => unknown,
    module: { exports: Record<string, unknown> },
    exports: Record<string, unknown>,
  ) => void;
  fn(req, moduleObj, moduleObj.exports);
  return moduleObj.exports;
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message || String(e);
  return String(e);
}

// tsx 페이지 렌더 — 전체 파이프라인. 각 실패 단계는 빈 화면 대신 이름 붙은 ErrorBox 로 낮춘다:
//   컴파일 실패 → "Compile failed", 실행 예외 → "Runtime error", default 부재 → "No default export".
// 성공 시 default export 컴포넌트를 NodeBoundary 로 감싸(마운트 후 렌더 예외 격리) 반환한다.
export function renderTsx(
  code: string,
  modules: RunnerModules,
  filePath = "page.tsx",
): React.ReactElement {
  let compiled: string;
  try {
    compiled = transformTsx(code, filePath);
  } catch (e) {
    return <ErrorBox title="Compile failed" detail={errorMessage(e)} />;
  }
  let exports: Record<string, unknown>;
  try {
    exports = evaluateTsx(compiled, makeRequire(modules));
  } catch (e) {
    return <ErrorBox title="Runtime error" detail={errorMessage(e)} />;
  }
  const def = exports.default;
  if (typeof def !== "function") {
    return (
      <ErrorBox
        title="No default export"
        detail="the TSX page has no `export default` component to mount"
      />
    );
  }
  const Page = def as React.ComponentType;
  return (
    <NodeBoundary label="tsx page">
      <Page />
    </NodeBoundary>
  );
}
