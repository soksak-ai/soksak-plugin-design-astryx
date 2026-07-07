// canvas.select / canvas.set 순수 판정(CONTRACT §5·§7) — 부수효과(스토어 변이·notify)는 index.ts 가
// 얹고, 여기서는 검증·해소·정규화만 못박는다(순수부 추출 = 테스트 seam). 실패는 닫힌 코드 집합(§3).
import { describe, it, expect } from "vitest";
import { resolveSelection, applyCanvasSet, normalizeViewport } from "./canvas-session";
import { freshCanvasControls, type DesignDoc, type DesignPage } from "../types";

function isErr(v: unknown): v is { ok: false; code: string; message: string; data?: Record<string, unknown> } {
  return typeof v === "object" && v !== null && (v as { ok?: unknown }).ok === false;
}

const treePage = (): DesignPage => ({
  id: "p1",
  name: "Home",
  source: {
    kind: "tree",
    root: {
      id: "n1",
      type: "Stack",
      props: {},
      children: [{ id: "n2", type: "Button", props: {}, children: [] }],
    },
  },
});
const tsxPage = (): DesignPage => ({
  id: "p2",
  name: "Landing",
  source: { kind: "tsx", code: "export default () => null", origin: "pages/landing" },
});
const doc = (): DesignDoc => ({
  version: 1,
  activeTheme: "neutral",
  mode: "system",
  pages: [treePage(), tsxPage()],
  seq: 2,
});

// ── resolveSelection ─────────────────────────────────────────────────────────
describe("resolveSelection", () => {
  it("명시 pageId + 존재 노드 → 선택(type 동반)", () => {
    const r = resolveSelection(doc(), null, { pageId: "p1", nodeId: "n2" });
    expect(r).toEqual({ selection: { pageId: "p1", nodeId: "n2" }, type: "Button" });
  });

  it("루트 노드도 선택 가능", () => {
    const r = resolveSelection(doc(), null, { pageId: "p1", nodeId: "n1" });
    expect(r).toEqual({ selection: { pageId: "p1", nodeId: "n1" }, type: "Stack" });
  });

  it("pageId 생략 시 활성 페이지로 해소", () => {
    const r = resolveSelection(doc(), "p1", { nodeId: "n2" });
    expect(r).toEqual({ selection: { pageId: "p1", nodeId: "n2" }, type: "Button" });
  });

  it("nodeId null → 페이지-only 선택(노드 해제, type null)", () => {
    const r = resolveSelection(doc(), null, { pageId: "p1", nodeId: null });
    expect(r).toEqual({ selection: { pageId: "p1", nodeId: null }, type: null });
  });

  it("nodeId 미지정·공백도 노드 해제로 취급", () => {
    expect(resolveSelection(doc(), "p1", {})).toEqual({
      selection: { pageId: "p1", nodeId: null },
      type: null,
    });
    expect(resolveSelection(doc(), "p1", { nodeId: "   " })).toEqual({
      selection: { pageId: "p1", nodeId: null },
      type: null,
    });
  });

  it("없는 페이지 → NOT_FOUND", () => {
    const r = resolveSelection(doc(), null, { pageId: "p9", nodeId: null });
    expect(isErr(r) && r.code).toBe("NOT_FOUND");
  });

  it("pageId 생략 + 활성 페이지 없음 → NOT_FOUND", () => {
    const r = resolveSelection(doc(), null, { nodeId: null });
    expect(isErr(r) && r.code).toBe("NOT_FOUND");
  });

  it("없는 노드 → NOT_FOUND", () => {
    const r = resolveSelection(doc(), null, { pageId: "p1", nodeId: "n9" });
    expect(isErr(r) && r.code).toBe("NOT_FOUND");
  });

  it("tsx 페이지의 비-null nodeId → NOT_FOUND(노드 id 없음, §5)", () => {
    const r = resolveSelection(doc(), null, { pageId: "p2", nodeId: "n2" });
    expect(isErr(r) && r.code).toBe("NOT_FOUND");
  });

  it("tsx 페이지의 노드 해제(null)는 성공 — 페이지-only 선택", () => {
    const r = resolveSelection(doc(), null, { pageId: "p2", nodeId: null });
    expect(r).toEqual({ selection: { pageId: "p2", nodeId: null }, type: null });
  });
});

// ── normalizeViewport ────────────────────────────────────────────────────────
describe("normalizeViewport", () => {
  it("fill·숫자 프리셋을 통과", () => {
    expect(normalizeViewport("fill")).toBe("fill");
    expect(normalizeViewport(1280)).toBe(1280);
    expect(normalizeViewport(768)).toBe(768);
    expect(normalizeViewport(375)).toBe(375);
  });

  it("숫자 문자열도 관용적으로 숫자 프리셋으로(CLI 친화)", () => {
    expect(normalizeViewport("1280")).toBe(1280);
    expect(normalizeViewport("375")).toBe(375);
  });

  it("프리셋 밖은 undefined", () => {
    expect(normalizeViewport(1024)).toBeUndefined();
    expect(normalizeViewport("wide")).toBeUndefined();
    expect(normalizeViewport(null)).toBeUndefined();
    expect(normalizeViewport(undefined)).toBeUndefined();
  });
});

// ── applyCanvasSet ───────────────────────────────────────────────────────────
describe("applyCanvasSet", () => {
  it("viewport 설정 → width 갱신(background 보존)", () => {
    const r = applyCanvasSet({ width: "fill", background: "#111" }, { viewport: 768 });
    expect(r).toEqual({ next: { width: 768, background: "#111" } });
  });

  it("background 설정 → 원시 CSS 색(width 보존)", () => {
    const r = applyCanvasSet(freshCanvasControls(), { background: "rebeccapurple" });
    expect(r).toEqual({ next: { width: "fill", background: "rebeccapurple" } });
  });

  it("background 'neutral'·'' → 중립 기본('')", () => {
    expect(applyCanvasSet({ width: 375, background: "#000" }, { background: "neutral" })).toEqual({
      next: { width: 375, background: "" },
    });
    expect(applyCanvasSet({ width: 375, background: "#000" }, { background: "" })).toEqual({
      next: { width: 375, background: "" },
    });
  });

  it("둘 다 설정 가능", () => {
    const r = applyCanvasSet(freshCanvasControls(), { viewport: 1280, background: "#fafafa" });
    expect(r).toEqual({ next: { width: 1280, background: "#fafafa" } });
  });

  it("나쁜 viewport → INVALID_PROP + data.validValues", () => {
    const r = applyCanvasSet(freshCanvasControls(), { viewport: 999 });
    expect(isErr(r) && r.code).toBe("INVALID_PROP");
    if (isErr(r)) expect(r.data?.validValues).toEqual(["fill", 1280, 768, 375]);
  });

  it("viewport·background 둘 다 없음 → INVALID_ARG", () => {
    const r = applyCanvasSet(freshCanvasControls(), {});
    expect(isErr(r) && r.code).toBe("INVALID_ARG");
  });

  it("비문자열 background 단독은 미제공 취급 → INVALID_ARG", () => {
    const r = applyCanvasSet(freshCanvasControls(), { background: 123 });
    expect(isErr(r) && r.code).toBe("INVALID_ARG");
  });

  it("입력 controls 를 제자리 변이하지 않는다(새 객체 반환)", () => {
    const cur = freshCanvasControls();
    const r = applyCanvasSet(cur, { viewport: 768 });
    expect(cur).toEqual({ width: "fill", background: "" }); // 원본 불변
    expect(isErr(r)).toBe(false);
  });
});
