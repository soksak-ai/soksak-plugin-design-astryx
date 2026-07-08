// 프로덕션 렌더 주입기 — v2 runner/entry.tsx 의 네임스페이스 주입 역할을 뷰로 이전한 것(§7 Rendering
// core law). 무거운 번들 심볼(React·astryx 배럴+소문자 서브패스·heroicons·lucide·built 테마·앵커 폴백)과
// 빌드 define CSS(__ASTRYX_CSS__·__THEME_CSS_MAP__)를 여기서 묶어 RenderConfig 로 낸다. 뷰 코어
// (mount/canvas-app)는 이걸 주입받아 astryx 에 안 묶인다. 이 파일은 테스트가 아니라 프로덕션 배선이다.
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
import type { Context } from "react";
import type { RunnerModules } from "../render-core";
import * as catalog from "../catalog";
import type { CatalogEntry, ThemeName } from "../types";
import { deriveControlledInputs } from "./controlled-inputs";
import type { RenderConfig } from "./model";

// tsx 경로 require-shim 이 해소할 번들 네임스페이스(§7 지도). 대문자 컴포넌트 subpath 는 배럴이
// forward 하고, 소문자 3종(theme·theme/syntax·hooks)은 배럴 밖 심볼(githubLight 등)이 있어 명시 탑재.
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

// built 테마 7종 — useTheme() JS 토큰 해소가 실물 객체를 요구한다(스텁은 Markdown 등에서 죽음).
// __built:true 라 런타임 CSS 주입은 스킵(CSS 는 shadow 에 이미 임베드).
const THEME_OBJECTS: Record<ThemeName, unknown> = {
  butter: butterTheme,
  chocolate: chocolateTheme,
  gothic: gothicTheme,
  matcha: matchaTheme,
  neutral: neutralTheme,
  stone: stoneTheme,
  y2k: y2kTheme,
};

// 빌드 define(§12). vitest 등 define 부재 환경엔 typeof 가드로 빈 값 폴백(프로덕션에서만 실값).
declare const __ASTRYX_CSS__: string; // reset+astryx.css 병합 원문.
declare const __THEME_CSS_MAP__: string | Record<string, string>; // { <theme>: css } 의 JSON 문자열 또는 객체.

function astryxCss(): string {
  return typeof __ASTRYX_CSS__ !== "undefined" ? __ASTRYX_CSS__ : "";
}

function themeCssMap(): Record<string, string> {
  if (typeof __THEME_CSS_MAP__ === "undefined") return {};
  const raw: string | Record<string, string> = __THEME_CSS_MAP__;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return {};
    }
  }
  return raw;
}

// 카탈로그에서 제어 입력 집합 파생(런타임 1회). define 부재시 빈 카탈로그 → 빈 집합(트리 렌더는 여전히
// 동작, value→defaultValue 리매핑만 생략).
function controlledInputs(): ReadonlySet<string> {
  const entries: CatalogEntry[] = catalog
    .types()
    .map((t) => catalog.getEntry(t))
    .filter((e): e is CatalogEntry => e != null);
  return deriveControlledInputs(entries);
}

// 앵커 포지셔닝 폴백·@oddbird 폴리필은 전부 legacy 제거했다 — 뷰가 Chromium 서피스(CEF 149)로
// 이전해 CSS anchor positioning 이 네이티브 지원되므로 팝오버가 폴백 없이 정확히 뜬다.

// 프로덕션 RenderConfig — standalone 앱 엔트리(app/entry.tsx)가 CanvasApp 에 넣는다.
export function productionRenderConfig(): RenderConfig {
  return {
    modules: RUNNER_MODULES,
    themeObjects: THEME_OBJECTS,
    themeContext: Astryx.ThemeContext as unknown as Context<unknown>,
    registerIcons: Astryx.registerIcons as unknown as (icons: unknown) => void,
    controlledInputs: controlledInputs(),
    astryxCss: astryxCss(),
    themeCssMap: themeCssMap(),
  };
}
