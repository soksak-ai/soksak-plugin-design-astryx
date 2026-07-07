// 뷰 모델 순수 검증 — 활성 페이지 선택·색 모드 투영(§7·§9).
import { describe, it, expect } from "vitest";
import {
  activePage,
  colorSchemeValue,
  effectiveMode,
  type CanvasStore,
} from "./model";
import type { DesignPage } from "../types";

function page(id: string): DesignPage {
  return { id, name: id, source: { kind: "tree", root: { id: `${id}r`, type: "Stack", props: {}, children: [] } } };
}
function store(pages: DesignPage[], activePageId: string | null): CanvasStore {
  return { doc: { version: 1, activeTheme: "neutral", mode: "system", pages, seq: 0 }, preview: { activePageId } };
}

describe("activePage", () => {
  it("빈 문서는 null", () => {
    expect(activePage(store([], null))).toBeNull();
  });
  it("activePageId 가 가리키는 페이지", () => {
    const p = [page("a"), page("b")];
    expect(activePage(store(p, "b"))?.id).toBe("b");
  });
  it("activePageId 없거나 부재하면 첫 페이지로 폴백", () => {
    const p = [page("a"), page("b")];
    expect(activePage(store(p, null))?.id).toBe("a");
    expect(activePage(store(p, "ghost"))?.id).toBe("a");
  });
});

describe("effectiveMode", () => {
  it("gothic 은 항상 dark", () => {
    expect(effectiveMode("light", "gothic")).toBe("dark");
    expect(effectiveMode("system", "gothic")).toBe("dark");
    expect(effectiveMode(undefined, "gothic")).toBe("dark");
  });
  it("그 외엔 명시값 존중, 없거나 이상값은 system", () => {
    expect(effectiveMode("light", "neutral")).toBe("light");
    expect(effectiveMode("dark", "neutral")).toBe("dark");
    expect(effectiveMode(undefined, "neutral")).toBe("system");
  });
});

describe("colorSchemeValue", () => {
  it("light/dark/system → CSS color-scheme", () => {
    expect(colorSchemeValue("light")).toBe("light");
    expect(colorSchemeValue("dark")).toBe("dark");
    expect(colorSchemeValue("system")).toBe("light dark");
  });
});
