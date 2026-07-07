// 템플릿 생성기 v2(순수) 단위 테스트 — 인라인 TSX 픽스처로 import 수집·requires 정규화·가용성 판정·
// 표시명 파생·verbatim 포장(CONTRACT §13)을 못박는다. generated 산출물·catalog.json 미의존.

import { describe, it, expect } from "vitest";
// @ts-expect-error — .mjs 순수 함수 모듈(빌드 스크립트). vitest/esbuild 가 그대로 로드한다.
import {
  collectImports,
  normalizeRequire,
  requiresOf,
  classifyAvailability,
  deriveName,
  buildEntry,
  census,
} from "./gen-templates.mjs";
import ts from "typescript";

function sf(code: string) {
  return ts.createSourceFile("t.tsx", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

describe("collectImports (AST — 코드샘플 문자열 무시)", () => {
  it("최상위 import/export-from 모듈 스펙만 모은다(값·타입 무구분)", () => {
    const mods = collectImports(sf(
      `import {Badge} from '@astryxdesign/core/Badge';\n` +
      `import {Stack} from '@astryxdesign/core/Layout';\n` +
      `import type {IconRegistry} from '@astryxdesign/core';\n` +
      `import {useState} from 'react';\n` +
      `import {ChartBarIcon} from '@heroicons/react/24/outline';\n` +
      `export {default} from 'lucide-react';\n` +
      `export default function T(){return null;}`,
    ));
    expect([...mods].sort()).toEqual([
      "@astryxdesign/core", "@astryxdesign/core/Badge", "@astryxdesign/core/Layout",
      "@heroicons/react/24/outline", "lucide-react", "react",
    ]);
  });

  it("템플릿 리터럴 안의 가짜 import/export default 는 세지 않는다(§16 compile-based)", () => {
    const mods = collectImports(sf(
      `import {Text} from '@astryxdesign/core/Typography';\n` +
      "export default function Doc(){ const sample = `import x from 'recharts';\\nexport default x;`; return sample; }",
    ));
    expect([...mods]).toEqual(["@astryxdesign/core/Typography"]);
  });
});

describe("requires 정규화", () => {
  it("@astryxdesign/core[/<Subpath>] 은 단일 배럴 id 로 접고 그 밖은 원문 유지(§16 barrel-only)", () => {
    expect(normalizeRequire("@astryxdesign/core")).toBe("@astryxdesign/core");
    expect(normalizeRequire("@astryxdesign/core/Chat")).toBe("@astryxdesign/core");
    expect(normalizeRequire("@heroicons/react/24/solid")).toBe("@heroicons/react/24/solid");
    expect(normalizeRequire("react")).toBe("react");
  });
  it("requiresOf 는 정규화·중복제거·정렬한다", () => {
    const mods = new Set(["@astryxdesign/core/Layout", "@astryxdesign/core/Chat", "react", "@heroicons/react/24/outline"]);
    expect(requiresOf(mods)).toEqual(["@astryxdesign/core", "@heroicons/react/24/outline", "react"]);
  });
});

describe("classifyAvailability (CONTRACT §13)", () => {
  it("러너 shim 이 담는 모듈만이면 available", () => {
    expect(classifyAvailability(new Set(["@astryxdesign/core/Layout", "react", "@heroicons/react/24/outline"])))
      .toEqual({ available: true });
    expect(classifyAvailability(new Set(["lucide-react", "@astryxdesign/core"])))
      .toEqual({ available: true });
  });
  it("recharts·@astryxdesign/lab 미설치는 unavailable + 사유", () => {
    expect(classifyAvailability(new Set(["@astryxdesign/core", "recharts"])))
      .toEqual({ available: false, reason: "recharts (not installed)" });
    expect(classifyAvailability(new Set(["@astryxdesign/core", "@astryxdesign/lab"])))
      .toEqual({ available: false, reason: "@astryxdesign/lab (not installed)" });
  });
  it("@stylexjs/stylex 는 설치돼도 컴파일타임 트랜스폼 필요 → unavailable(미설치 사유보다 우선)", () => {
    expect(classifyAvailability(new Set(["@astryxdesign/core", "@stylexjs/stylex"])))
      .toEqual({ available: false, reason: "@stylexjs/stylex compile-time transform required" });
    // stylex + 미설치 모듈 동거 시 컴파일타임 사유가 우선(결정론적).
    expect(classifyAvailability(new Set(["@stylexjs/stylex", "recharts"])).reason)
      .toBe("@stylexjs/stylex compile-time transform required");
  });
  it("미래 신규(미해소) 모듈도 정직하게 unavailable(not installed)", () => {
    expect(classifyAvailability(new Set(["@astryxdesign/core", "some-new-lib"])))
      .toEqual({ available: false, reason: "some-new-lib (not installed)" });
  });
});

describe("deriveName (slug 파생, §13)", () => {
  it("page id 는 디렉토리, block 은 파일 베이스, themes 아이콘은 테마명 접두", () => {
    expect(deriveName("pages/dashboard-portfolio")).toBe("Dashboard Portfolio");
    expect(deriveName("blocks/components/Badge/BadgeCategoryTags")).toBe("Badge Category Tags");
    expect(deriveName("themes/butter/icons")).toBe("Butter Icons");
  });
});

describe("buildEntry (verbatim 포장)", () => {
  it("code 는 원본 그대로, requires/available/reason 은 import 파생", () => {
    const code =
      `// Copyright\n'use client';\n` +
      `import {Badge} from '@astryxdesign/core/Badge';\n` +
      `import {ChartBarIcon} from '@heroicons/react/24/outline';\n` +
      `export default function Demo(){return <Badge label="x"/>;}`;
    const e = buildEntry({ id: "blocks/components/Badge/BadgeDemo", kind: "block", code });
    expect(e).toEqual({
      id: "blocks/components/Badge/BadgeDemo",
      kind: "block",
      name: "Badge Demo",
      code, // 바이트 그대로
      requires: ["@astryxdesign/core", "@heroicons/react/24/outline"],
      available: true,
    });
    expect(e).not.toHaveProperty("reason");
  });

  it("available=false 면 reason 을 실어 보낸다", () => {
    const code = `import {Chart} from 'recharts';\nexport default function P(){return null;}`;
    const e = buildEntry({ id: "pages/dashboard", kind: "page", code });
    expect(e.available).toBe(false);
    expect(e.reason).toBe("recharts (not installed)");
    expect(e.code).toBe(code);
  });
});

describe("census (정직 회계)", () => {
  it("total/available/unavailable/byReason 를 센다", () => {
    const entries = [
      { id: "a", available: true },
      { id: "b", available: false, reason: "recharts (not installed)" },
      { id: "c", available: false, reason: "recharts (not installed)" },
      { id: "d", available: false, reason: "@astryxdesign/lab (not installed)" },
    ];
    expect(census(entries)).toEqual({
      total: 4,
      available: 1,
      unavailable: 3,
      byReason: { "recharts (not installed)": 2, "@astryxdesign/lab (not installed)": 1 },
    });
  });
});
