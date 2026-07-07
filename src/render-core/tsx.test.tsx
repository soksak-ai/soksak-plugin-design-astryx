// 러너 tsx 경로 검증(CONTRACT §7 TSX path) — 실물 소량 주입으로 sucrase→shim→마운트 전 파이프라인을 돈다.
// SSR(renderToStaticMarkup, node)로 확인: 실 템플릿 마운트·컴파일실패 박스·미지 모듈 자기명명·자산 자리표시자.
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";
import * as ReactJsxRuntime from "react/jsx-runtime";
import * as Astryx from "@astryxdesign/core";
import * as AstryxTheme from "@astryxdesign/core/theme";
import * as AstryxThemeSyntax from "@astryxdesign/core/theme/syntax";
import * as AstryxHooks from "@astryxdesign/core/hooks";
import * as HeroiconsOutline24 from "@heroicons/react/24/outline";
import * as HeroiconsSolid24 from "@heroicons/react/24/solid";
import * as HeroiconsSolid20 from "@heroicons/react/20/solid";
import * as Lucide from "lucide-react";
import {
  renderTsx,
  isSchemelessPath,
  fixImgProps,
  transformTsx,
  makeRequire,
  PLACEHOLDER_IMG,
  type RunnerModules,
} from "./tsx";

// 실 번들 네임스페이스를 그대로 주입(entry 와 동형). heroicons/lucide 는 실물 전량.
const MODULES: RunnerModules = {
  react: React,
  jsxRuntime: ReactJsxRuntime,
  core: Astryx,
  coreTheme: AstryxTheme,
  coreThemeSyntax: AstryxThemeSyntax,
  coreHooks: AstryxHooks,
  heroiconsOutline24: HeroiconsOutline24,
  heroiconsSolid24: HeroiconsSolid24,
  heroiconsSolid20: HeroiconsSolid20,
  lucide: Lucide,
};

// 소문자 서브패스 회귀(전수 적대 검증 실측): theme/syntax 의 githubLight 는 배럴 밖 심볼 —
// 명시 네임스페이스가 없으면 undefined 로 흘러 SyntaxTheme 가 tokens 접근에서 죽는다.
const SYNTAX_PRESET_TSX = `'use client';
import {SyntaxTheme} from '@astryxdesign/core/theme';
import {githubLight} from '@astryxdesign/core/theme/syntax';
import {CodeBlock} from '@astryxdesign/core/CodeBlock';
export default function P() {
  return (
    <SyntaxTheme theme={githubLight}>
      <CodeBlock code={"const a = 1;"} language="tsx" title="preset" />
    </SyntaxTheme>
  );
}
`;

// 실 shipped 템플릿의 verbatim 바이트(node_modules/@astryxdesign/cli/templates/blocks/components/Icon/
// IconShowcase.tsx 원문 그대로). node:fs 를 안 쓰는 이유 = tsconfig 가 runner/ 를 typecheck 하는데
// @types/node 미설치라 node 빌트인 타입이 없다. 원본 바이트를 그대로 담아 무손실 마운트를 실증한다.
const ICON_SHOWCASE_TSX = `// Copyright (c) Meta Platforms, Inc. and affiliates.

'use client';

import {Icon} from '@astryxdesign/core/Icon';

export default function IconShowcase() {
  return <Icon icon="search" color="primary" size="md" />;
}
`;

describe("renderTsx — 실 템플릿 마운트", () => {
  it("실 shipped 템플릿(IconShowcase)을 sucrase 로 컴파일·마운트한다", () => {
    const html = renderToStaticMarkup(renderTsx(ICON_SHOWCASE_TSX, MODULES, "IconShowcase.tsx"));
    expect(html.length).toBeGreaterThan(0);
    // 실 astryx Icon 컴포넌트 마운트 증거(안정 클래스 + 아이콘 svg).
    expect(html).toContain("astryx-icon");
    expect(html).toContain("<svg");
    // 컴파일/런타임/미지-default 오류 표면이 아니어야 한다.
    expect(html).not.toContain("Compile failed");
    expect(html).not.toContain("No default export");
  });
});

describe("renderTsx — 오류 표면(빈 화면 금지)", () => {
  it("깨진 TSX 는 컴파일 실패 박스", () => {
    const broken = "export default function B(){ return <div>unterminated }";
    const html = renderToStaticMarkup(renderTsx(broken, MODULES, "broken.tsx"));
    expect(html).toContain("Compile failed");
  });

  it("default export 부재는 보이는 박스", () => {
    const code = "export function Named(){ return null; }";
    const html = renderToStaticMarkup(renderTsx(code, MODULES, "nodefault.tsx"));
    expect(html).toContain("No default export");
  });

  it("미지 모듈은 자기 이름을 대는 박스", () => {
    const code =
      "import { LineChart } from 'recharts';\n" +
      "export default function P(){ return <LineChart data={[]} />; }";
    const html = renderToStaticMarkup(renderTsx(code, MODULES, "chart.tsx"));
    expect(html).toContain("Unavailable module: recharts");
  });

  it("@astryxdesign/lab 미설치도 자기 이름을 댄다", () => {
    const code =
      "import { Thing } from '@astryxdesign/lab';\n" +
      "export default function P(){ return <Thing />; }";
    const html = renderToStaticMarkup(renderTsx(code, MODULES, "lab.tsx"));
    expect(html).toContain("Unavailable module: @astryxdesign/lab");
  });
});

describe("자산 자리표시자 법칙(§7)", () => {
  it("isSchemelessPath: 상대·루트 경로는 스킴 없음, http/https/data 는 스킴 있음", () => {
    expect(isSchemelessPath("./a.png")).toBe(true);
    expect(isSchemelessPath("../a.png")).toBe(true);
    expect(isSchemelessPath("/a.png")).toBe(true);
    expect(isSchemelessPath("a.png")).toBe(true);
    expect(isSchemelessPath("https://cdn.example.com/a.png")).toBe(false);
    expect(isSchemelessPath("http://x/a.png")).toBe(false);
    expect(isSchemelessPath("data:image/png;base64,AAA")).toBe(false);
    expect(isSchemelessPath("//cdn.example.com/a.png")).toBe(false);
  });

  it("fixImgProps: 스킴 없는 src → 자리표시자, http src 통과, onError 항상 부착", () => {
    const rewritten = fixImgProps({ src: "./local.png", alt: "x" }) as Record<string, unknown>;
    expect(rewritten.src).toBe(PLACEHOLDER_IMG);
    expect(typeof rewritten.onError).toBe("function");
    const passed = fixImgProps({ src: "https://cdn/a.png" }) as Record<string, unknown>;
    expect(passed.src).toBe("https://cdn/a.png");
    expect(typeof passed.onError).toBe("function");
  });

  it("템플릿의 스킴 없는 <img> 는 마운트 시 자리표시자로 렌더된다", () => {
    const code =
      "export default function P(){ return <img src='./missing.png' alt='m' />; }";
    const html = renderToStaticMarkup(renderTsx(code, MODULES, "img.tsx"));
    expect(html).toContain("data:image/svg+xml");
    expect(html).not.toContain("missing.png");
  });

  it("스킴 있는 원격 <img> 는 그대로 통과한다", () => {
    const code =
      "export default function P(){ return <img src='https://cdn.example.com/a.png' alt='a' />; }";
    const html = renderToStaticMarkup(renderTsx(code, MODULES, "remote.tsx"));
    expect(html).toContain("https://cdn.example.com/a.png");
  });
});

describe("require-shim — 배럴 forward + 소문자 서브패스 명시 지도(§7)", () => {
  it("@astryxdesign/core subpath 는 배럴 하나로 해소된다", () => {
    const req = makeRequire(MODULES);
    expect(req("@astryxdesign/core")).toBe(Astryx);
    expect(req("@astryxdesign/core/Icon")).toBe(Astryx);
    expect(req("@astryxdesign/core/Chat")).toBe(Astryx);
    expect(req("react")).toBe(React);
    expect(req("@heroicons/react/24/outline")).toBe(HeroiconsOutline24);
    expect(req("lucide-react")).toBe(Lucide);
  });

  it("소문자 서브패스(theme·theme/syntax·hooks)는 명시 네임스페이스로 해소된다", () => {
    const req = makeRequire(MODULES);
    expect(req("@astryxdesign/core/theme")).toBe(AstryxTheme);
    expect(req("@astryxdesign/core/theme/syntax")).toBe(AstryxThemeSyntax);
    expect(req("@astryxdesign/core/hooks")).toBe(AstryxHooks);
  });

  it("theme/syntax 프리셋(githubLight) 템플릿이 무손실 렌더된다 — 배럴 밖 심볼 회귀", () => {
    const el = renderTsx(SYNTAX_PRESET_TSX, MODULES, "syntax-preset.tsx");
    const html = renderToStaticMarkup(el);
    expect(html).not.toContain("Compile failed");
    expect(html).not.toContain("Runtime error");
    expect(html).toContain("preset");
  });

  it("transformTsx 는 Learn Gate B 설정으로 automatic jsx-runtime 을 낸다", () => {
    const out = transformTsx("export default function P(){ return <div/>; }", "p.tsx");
    expect(out).toContain('require("react/jsx-runtime")');
    expect(out).toContain("exports.default");
  });
});
