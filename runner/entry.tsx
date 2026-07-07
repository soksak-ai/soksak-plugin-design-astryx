// 미리보기 러너 — 독립 React 앱. 브라우저가 file:// 로 이 번들(runner.js)을 로드하면,
// 인라인된 window.__DESIGN__({ theme, mode?, root }) 를 읽어 트리를 렌더한다. CONTRACT §7.
// 컴포넌트는 @astryxdesign/core 배럴에서 이름으로 해소하고, 루트를 <Theme> 로 감싼다.
// 테마 시각은 문서에 임베드된 theme.css(:root 변수)가 담당하므로 여기선 무거운 테마 JS 를
// 들이지 않는다 — Theme 에는 최소 built 스텁({name, __built:true})만 준다. Theme 은 이 스텁으로
// documentElement 에 data-theme·data-astryx-theme 를 찍고(전용 미리보기 문서라 안전), CSS 는
// 이미 임베드돼 있어 런타임 주입을 건너뛴다(__built:true). 아이콘은 core 의 기본 SVG 로 폴백된다.
import React from "react";
import * as ReactDOM from "react-dom";
import * as ReactDOMClient from "react-dom/client";
import * as ReactJsxRuntime from "react/jsx-runtime";
import * as Astryx from "@astryxdesign/core";
import * as AstryxTheme from "@astryxdesign/core/theme";
import * as AstryxThemeSyntax from "@astryxdesign/core/theme/syntax";
import * as AstryxHooks from "@astryxdesign/core/hooks";
import { butterTheme } from "@astryxdesign/theme-butter/built";
import { chocolateTheme } from "@astryxdesign/theme-chocolate/built";
import { gothicTheme } from "@astryxdesign/theme-gothic/built";
import { matchaTheme } from "@astryxdesign/theme-matcha/built";
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import { stoneTheme } from "@astryxdesign/theme-stone/built";
import { y2kTheme } from "@astryxdesign/theme-y2k/built";
import * as HeroiconsOutline24 from "@heroicons/react/24/outline";
import * as HeroiconsSolid24 from "@heroicons/react/24/solid";
import * as HeroiconsSolid20 from "@heroicons/react/20/solid";
import * as Lucide from "lucide-react";
import anchorPolyfill from "@oddbird/css-anchor-positioning/fn";
import { renderNode, NodeBoundary, ErrorBox, type RenderOptions } from "./render";
import { renderTsx, type RunnerModules } from "./tsx";
import { resolvePreviewMode } from "../src/preview/mode";
import type { DesignPayload } from "../src/types";

const { createRoot } = ReactDOMClient;

// tsx 경로 require-shim 이 해소할 번들 모듈(§7 지도). 실제 번들 네임스페이스를 묶는다 —
// 대문자 컴포넌트 subpath 는 배럴이 forward 하고, 소문자 subpath 3종(theme·theme/syntax·hooks)은
// 배럴 밖 심볼(githubLight 등 — 전수 검증에서 실측)이 있어 네임스페이스를 명시 탑재한다.
const RUNNER_MODULES: RunnerModules = {
  react: React,
  jsxRuntime: ReactJsxRuntime,
  reactDom: ReactDOM,
  reactDomClient: ReactDOMClient,
  core: Astryx,
  coreTheme: AstryxTheme,
  coreThemeSyntax: AstryxThemeSyntax,
  coreHooks: AstryxHooks,
  heroiconsOutline24: HeroiconsOutline24,
  heroiconsSolid24: HeroiconsSolid24,
  heroiconsSolid20: HeroiconsSolid20,
  lucide: Lucide,
};

declare global {
  interface Window {
    __DESIGN__?: DesignPayload;
  }
}

// 빌드타임 주입(scripts/build-runner.mjs) — 카탈로그에서 파생한 제어 입력 컴포넌트 type 목록.
// define 부재(가드) 시 빈 배열로 폴백. 정적 목업 입력 법칙(render.sanitizeProps)이 이 집합을 쓴다.
declare const __CONTROLLED_INPUT_TYPES__: string[];
const CONTROLLED_INPUTS: ReadonlySet<string> = new Set(
  typeof __CONTROLLED_INPUT_TYPES__ !== "undefined" ? __CONTROLLED_INPUT_TYPES__ : [],
);
const RENDER_OPTIONS: RenderOptions = { controlledInputs: CONTROLLED_INPUTS };

// 실물 built 테마 7종 — 스텁({name,__built}) 은 시각(CSS)엔 충분했지만 useTheme() 의 JS 토큰 해소
// (resolveThemeTokens)가 죽는다(실마운트 적대 검증: Markdown→useStreamingText→useTheme crash).
// 무손실 법: Theme 에는 실물 테마 객체를 준다(__built:true 라 런타임 CSS 주입은 여전히 스킵).
const THEMES: Record<string, unknown> = {
  butter: butterTheme,
  chocolate: chocolateTheme,
  gothic: gothicTheme,
  matcha: matchaTheme,
  neutral: neutralTheme,
  stone: stoneTheme,
  y2k: y2kTheme,
};
const ThemeRoot = Astryx.Theme as unknown as React.ComponentType<{
  theme: unknown;
  mode?: "light" | "dark" | "system";
  children?: React.ReactNode;
}>;

// 엔진 진단(CONTRACT §7 보강) — 공식 astryx 3종 피처 프로브를 documentElement 에 찍고 콘솔에 남긴다.
// window.snapshot 디버깅이 한눈에 엔진 티어를 보게 한다. anchor-name 지원 여부가 Tier-1(Chromium)
// 대 native-WebKit 폴백을 가른다. 렌더 전에 한 번 실행(스냅샷이 마운트 전에도 티어를 보게).
function reportEngineTier(): { popover: boolean; anchor: boolean; lightDark: boolean } {
  const cssSupports = (prop: string, val: string): boolean => {
    try {
      return typeof CSS !== "undefined" && typeof CSS.supports === "function"
        ? CSS.supports(prop, val)
        : false;
    } catch {
      return false;
    }
  };
  const popover =
    typeof HTMLElement !== "undefined" &&
    Object.prototype.hasOwnProperty.call(HTMLElement.prototype, "popover");
  const anchor = cssSupports("anchor-name", "--x");
  const lightDark = cssSupports("color", "light-dark(#fff, #000)");
  const tier = anchor ? "tier1" : "fallback";
  const de = typeof document !== "undefined" ? document.documentElement : undefined;
  if (de) {
    de.setAttribute("data-astryx-engine-tier", tier);
    de.setAttribute(
      "data-astryx-caps",
      `popover:${popover} anchor-name:${anchor} light-dark:${lightDark}`,
    );
  }
  // eslint-disable-next-line no-console
  console.log(
    `[astryx-preview] tier=${tier} popover=${popover} anchor-name=${anchor} light-dark=${lightDark}`,
  );
  return { popover, anchor, lightDark };
}

// CSS Anchor Positioning 폴백(공식 astryx 전략) — 네이티브 anchor-name 미지원 엔진에서만 실행한다.
// Tier-1(Chromium 등)은 이 분기를 건너뛰어 0 비용, native-WebKit 폴백 브라우저는 팝업 위치가 교정된다.
// 폴백에서는 팝오버/드롭다운이 상호작용으로 열리므로 useAnimationFrame 으로 위치를 추종시킨다.
function maybePolyfillAnchor(anchorSupported: boolean): void {
  if (anchorSupported) return;
  try {
    void anchorPolyfill({ useAnimationFrame: true });
  } catch {
    // 폴백 실패는 미리보기를 죽이지 않는다 — 위치만 근사가 아닐 뿐 렌더는 계속.
  }
}

// 페이지 두 종류를 가른다(§7): tree 는 배럴 레지스트리로 트리를 낮추고, tsx 는 원본 코드를 sucrase
// 트랜스폼 후 require-shim 으로 실행해 default export 를 마운트한다. 둘 다 <Theme> 로 감싼다.
function renderPage(page: DesignPayload["page"], registry: Record<string, unknown>): React.ReactElement {
  if (page.kind === "tsx") {
    return renderTsx(page.code, RUNNER_MODULES);
  }
  return renderNode(page.root, registry, RENDER_OPTIONS);
}

function App({ design }: { design: DesignPayload }): React.ReactElement {
  const registry = Astryx as unknown as Record<string, unknown>;
  const activeTheme = THEMES[design.theme] ?? THEMES.neutral;
  // 문서가 실은 mode(optional)를 테마와 함께 해소 — gothic 은 다크, 그 외엔 명시값/ system.
  const mode = resolvePreviewMode((design as { mode?: unknown }).mode, design.theme);
  // 최상위 바운더리 — Theme 이 던져도 빈 화면 대신 오류 박스.
  return (
    <NodeBoundary label={`Theme(${design.theme})`}>
      <ThemeRoot theme={activeTheme} mode={mode}>
        {renderPage(design.page, registry)}
      </ThemeRoot>
    </NodeBoundary>
  );
}

function mount(): void {
  const caps = reportEngineTier();
  maybePolyfillAnchor(caps.anchor);
  const el = document.getElementById("root");
  if (!el) return;
  const design = window.__DESIGN__;
  const root = createRoot(el);
  if (!design || !design.page) {
    root.render(
      <ErrorBox
        title="No design payload"
        detail="window.__DESIGN__ is missing or has no page."
      />,
    );
    return;
  }
  root.render(<App design={design} />);
}

mount();
