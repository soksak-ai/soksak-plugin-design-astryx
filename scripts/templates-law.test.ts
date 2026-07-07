// 템플릿 법 테스트(CONTRACT §13, v2 verbatim) — generated/templates.json 을 읽어 불변식을 강제한다:
// 기계적 완전성(sourceCount === entries.length, 거부 버킷·침묵 드랍 0), verbatim(code === 소스 바이트),
// Learn Gate 인구조사(619 = 612 available + 7 unavailable, byReason recharts 2 / lab 3 / stylex 2),
// 엔트리 형태(id·kind·name·code·requires·available, reason ⇔ !available). catalog.json·트리 미의존.

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error — .mjs 순수 함수 모듈(빌드 스크립트).
import { generate, collectSources, resolveTemplatesDir, census } from "./gen-templates.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GEN = path.join(ROOT, "generated");

interface TemplateEntry {
  id: string;
  kind: "page" | "block";
  name: string;
  code: string;
  requires: string[];
  available: boolean;
  reason?: string;
}

let entries: TemplateEntry[];
let sourceCount: number;
let sourcePath: Map<string, string>;

// 미가용 census 고정(CONTRACT §13). 러너 shim 미해소·컴파일타임 트랜스폼 = honest unavailable.
const UNAVAILABLE = {
  "pages/dashboard": "recharts (not installed)",
  "pages/dashboard-portfolio": "recharts (not installed)",
  "pages/table-page-chart": "@astryxdesign/lab (not installed)",
  "pages/table-page-heatmap-status": "@astryxdesign/lab (not installed)",
  "pages/table-page-shoe-store-heatmap": "@astryxdesign/lab (not installed)",
  "pages/kanban-board": "@stylexjs/stylex compile-time transform required",
  "pages/shell-top-nav": "@stylexjs/stylex compile-time transform required",
  "themes/butter/icons": "helper module (no default export to mount)",
  "themes/chocolate/icons": "helper module (no default export to mount)",
  "themes/gothic/icons": "helper module (no default export to mount)",
  "themes/matcha/icons": "helper module (no default export to mount)",
  "themes/neutral/icons": "helper module (no default export to mount)",
  "themes/stone/icons": "helper module (no default export to mount)",
  "themes/y2k/icons": "helper module (no default export to mount)",
} as const;
// 러너가 담지 못하는 모듈(available=false 를 부르는 것). requires 정규화 후에도 원문 유지되는 3종.
const BLOCKING_MODULES = ["recharts", "@astryxdesign/lab", "@stylexjs/stylex"];

beforeAll(() => {
  // generated/ 는 git-ignore(§12) — 산출물이 없으면(클린 트리 `vitest run`) 즉석 생성해 자족한다.
  const out = generate();
  entries = out.entries;
  sourceCount = out.sourceCount;
  const sources: Array<{ id: string; tsxPath: string }> = collectSources(resolveTemplatesDir());
  sourcePath = new Map(sources.map((s) => [s.id, s.tsxPath]));
  // 디스크 산출물이 in-memory 와 일치하는지도 확인(generate 가 파일을 쓴다).
  expect(existsSync(path.join(GEN, "templates.json"))).toBe(true);
});

describe("기계적 완전성(CONTRACT §13)", () => {
  it("sourceCount === entries.length(거부 버킷·침묵 드랍 0)", () => {
    expect(entries.length).toBe(sourceCount);
  });
  it("레거시 templates-report.json 은 사라졌다(트리 변환 리포트 제거)", () => {
    expect(existsSync(path.join(GEN, "templates-report.json"))).toBe(false);
  });
  it("디스크 templates.json 이 generate 산출과 동일", () => {
    const disk = JSON.parse(readFileSync(path.join(GEN, "templates.json"), "utf8"));
    expect(disk.length).toBe(entries.length);
    expect(disk.map((e: TemplateEntry) => e.id)).toEqual(entries.map((e) => e.id));
  });
});

describe("엔트리 형태(verbatim TSX)", () => {
  it("각 엔트리는 id/kind/name/code/requires/available 완비, reason ⇔ !available", () => {
    for (const e of entries) {
      expect(typeof e.id).toBe("string");
      expect(e.id.length).toBeGreaterThan(0);
      expect(["page", "block"]).toContain(e.kind);
      expect(typeof e.name).toBe("string");
      expect(e.name.length).toBeGreaterThan(0);
      expect(typeof e.code).toBe("string");
      expect(e.code.length).toBeGreaterThan(0);
      expect(Array.isArray(e.requires)).toBe(true);
      for (const r of e.requires) expect(typeof r).toBe("string");
      expect(typeof e.available).toBe("boolean");
      expect(Object.prototype.hasOwnProperty.call(e, "reason")).toBe(!e.available);
      if (!e.available) expect((e.reason as string).length).toBeGreaterThan(0);
    }
  });
  it("id 는 전역 유일", () => {
    const ids = entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("requires 는 중복 없이 정렬돼 있다", () => {
    for (const e of entries) {
      const sorted = [...e.requires].sort();
      expect(e.requires, e.id).toEqual(sorted);
      expect(new Set(e.requires).size, e.id).toBe(e.requires.length);
    }
  });
  it("code 는 원본 소스 바이트 그대로(verbatim)", () => {
    for (const e of entries) {
      const p = sourcePath.get(e.id);
      expect(p, e.id).toBeTruthy();
      expect(e.code, e.id).toBe(readFileSync(p as string, "utf8"));
    }
  });
});

describe("Learn Gate 인구조사(CONTRACT §13)", () => {
  it("619 = 41 page + 578 block", () => {
    expect(entries.length).toBe(619);
    expect(entries.filter((e) => e.kind === "page").length).toBe(41);
    expect(entries.filter((e) => e.kind === "block").length).toBe(578);
  });
  it("605 available + 14 unavailable, byReason recharts 2 / lab 3 / stylex 2 / helper 7", () => {
    const c = census(entries);
    expect(c.total).toBe(619);
    expect(c.available).toBe(605);
    expect(c.unavailable).toBe(14);
    expect(c.byReason).toEqual({
      "recharts (not installed)": 2,
      "@astryxdesign/lab (not installed)": 3,
      "@stylexjs/stylex compile-time transform required": 2,
      "helper module (no default export to mount)": 7,
    });
  });
  it("미가용 엔트리 id·사유가 census 와 정확히 일치", () => {
    const got: Record<string, string> = {};
    for (const e of entries) if (!e.available) got[e.id] = e.reason as string;
    expect(got).toEqual(UNAVAILABLE);
  });
  it("blocking 모듈(recharts/lab/stylex) ⇒ unavailable, blocking 없는 unavailable 은 헬퍼 7종뿐", () => {
    for (const e of entries) {
      const blocks = e.requires.some((r) => BLOCKING_MODULES.includes(r));
      if (blocks) expect(e.available, e.id).toBe(false);
      if (!e.available && !blocks)
        expect(e.reason, e.id).toBe("helper module (no default export to mount)");
      if (e.available) expect(blocks, e.id).toBe(false);
    }
  });
  it("lucide-react 요구 8종 = 쇼케이스 1(available) + 아이콘 헬퍼 7(unavailable, 헬퍼 사유)", () => {
    const luc = entries.filter((e) => e.requires.includes("lucide-react"));
    expect(luc.length).toBe(8);
    for (const e of luc) {
      if (e.id === "pages/theme-showcase") {
        expect(e.available, e.id).toBe(true);
      } else {
        expect(e.available, e.id).toBe(false);
        expect(e.reason, e.id).toBe("helper module (no default export to mount)");
      }
    }
    expect(luc.map((e) => e.id).sort()).toEqual([
      "pages/theme-showcase",
      "themes/butter/icons",
      "themes/chocolate/icons",
      "themes/gothic/icons",
      "themes/matcha/icons",
      "themes/neutral/icons",
      "themes/stone/icons",
      "themes/y2k/icons",
    ]);
  });
});
