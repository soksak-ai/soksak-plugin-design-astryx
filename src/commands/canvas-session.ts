// canvas.select / canvas.set 순수 판정(CONTRACT §5·§7·§11) — 뷰-세션(선택·프레이밍)을 명령으로
// 몰기 위한 검증·해소·정규화. 부수효과(store.selection/canvasControls 변이·notify)는 index.ts 가 얹는다.
// 순수부라 콜로케이트 테스트로 못박고, 헤드리스(뷰 미마운트)에서도 판정이 동일하다(§5 headless law).
import {
  err,
  VIEWPORT_WIDTHS,
  type CanvasControls,
  type DesignDoc,
  type Err,
  type Selection,
  type ViewportWidth,
} from "../types";
import { getPage, findInPage } from "../model";
import { asNonEmptyString } from "./envelope";

// canvas.select 판정 — pageId 해소(명시 또는 활성 캔버스 페이지) → 페이지 존재 → nodeId 노드 존재 검증.
// nodeId null·미지정·공백 = 노드 해제(페이지-only, §5). 비-null nodeId 는 pageId 위 실노드여야 한다
// (tsx 페이지·부재 노드 → NOT_FOUND, §5). 반환 = 스토어에 실을 selection + 선택 노드 type(메시지·표시용).
export function resolveSelection(
  doc: DesignDoc,
  activePageId: string | null,
  params: Record<string, unknown>,
): { selection: Selection; type: string | null } | Err {
  const pageId = asNonEmptyString(params.pageId) ?? activePageId ?? "";
  if (!pageId) {
    return err(
      "NOT_FOUND",
      "선택할 페이지가 없습니다. pageId 를 지정하거나 preview.open 으로 활성 페이지를 여십시오.",
    );
  }
  const page = getPage(doc, pageId);
  if (!page) return err("NOT_FOUND", `페이지를 찾을 수 없습니다: '${pageId}'.`);

  const nodeId = asNonEmptyString(params.nodeId);
  // null·미지정·공백 → 노드 해제(페이지-only). tsx 페이지도 이 경로는 성공(노드 없이 페이지만 선택).
  if (nodeId === undefined) {
    return { selection: { pageId, nodeId: null }, type: null };
  }
  // tsx 페이지엔 노드 id 가 없으므로 findInPage 가 null → NOT_FOUND(§5).
  const located = findInPage(page, nodeId);
  if (!located) {
    return err("NOT_FOUND", `노드 '${nodeId}' 를 페이지 '${pageId}' 에서 찾을 수 없습니다.`);
  }
  return { selection: { pageId, nodeId }, type: located.node.type };
}

// viewport 정규화(§5) — fill 과 숫자 프리셋(1280·768·375)만 허용. 숫자 문자열("1280")은 관용적으로
// 숫자로(CLI 친화). 프리셋 밖은 undefined(호출부가 INVALID_PROP 로 전환).
export function normalizeViewport(v: unknown): ViewportWidth | undefined {
  if (v === "fill") return "fill";
  if (typeof v === "number" && (VIEWPORT_WIDTHS as readonly unknown[]).includes(v)) {
    return v as ViewportWidth;
  }
  if (v === "1280" || v === "768" || v === "375") return Number(v) as ViewportWidth;
  return undefined;
}

// canvas.set 판정 — viewport enum 검증(나쁜 값 → INVALID_PROP + data.validValues, §3·§4)·background
// 정규화("neutral"·"" → 중립 기본 ""). 최소 하나 필수(둘 다 없음 → INVALID_ARG). 반환 = 갱신 후 controls.
// current 를 제자리 변이하지 않는다(새 객체) — 스토어 필드 교체는 호출부 소관.
export function applyCanvasSet(
  current: CanvasControls,
  params: Record<string, unknown>,
): { next: CanvasControls } | Err {
  const hasViewport = params.viewport !== undefined && params.viewport !== null;
  const bg = typeof params.background === "string" ? (params.background as string) : undefined;
  const hasBackground = bg !== undefined;
  if (!hasViewport && !hasBackground) {
    return err("INVALID_ARG", "viewport 또는 background 중 하나 이상이 필요합니다.");
  }
  const next: CanvasControls = { width: current.width, background: current.background };
  if (hasViewport) {
    const w = normalizeViewport(params.viewport);
    if (w === undefined) {
      return err("INVALID_PROP", "viewport 는 fill·1280·768·375 중 하나여야 합니다.", {
        validValues: [...VIEWPORT_WIDTHS],
      });
    }
    next.width = w;
  }
  if (hasBackground) {
    // "neutral"·"" → 중립 기본(""); 그 외 문자열은 원시 CSS 색(미검증 — CSS 가 미지 색을 무시, 크래시 아님).
    next.background = bg === "neutral" ? "" : (bg as string);
  }
  return { next };
}
