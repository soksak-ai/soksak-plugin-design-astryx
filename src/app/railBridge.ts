// 레일 브리지 — 이 플러그인의 rail 뷰(structure/inspector) 컨테이너를 결부된 캔버스 뷰에 연결한다
// (사이드바 방출 v1). 상태·선택·명령은 호스트 스토어가 계속 소유하고, rail 뷰는 컨테이너만 등록한다.
// 키 = 결부 캔버스 콘텐츠 뷰의 viewId(rail 뷰 ctx.boundViewId ↔ 캔버스 ctx.viewId — per-view 인스턴스라
// 1:1). 캔버스 호스트(host.ts)가 이 레지스트리를 구독해 등록된 컨테이너에 패널 서피스를 present 한다 —
// 캔버스 앱이 CEF 사이드카(별도 document)에 살아 React 포털이 못 건너는 경계를, 이 플러그인의 렌더
// 수송로(오프스크린 서피스)가 같은 원리(컨테이너 등록 → 콘텐츠 소유자가 그린다)로 잇는다.

export type RailSlot = "structure" | "inspector";
export const RAIL_SLOTS: readonly RailSlot[] = ["structure", "inspector"];

const containers = new Map<string, Partial<Record<RailSlot, HTMLElement>>>();
const subs = new Map<string, Set<() => void>>();

function notify(viewId: string): void {
  for (const fn of subs.get(viewId) ?? []) fn();
}

// rail 뷰 마운트가 자기 컨테이너를 등록한다. 반환 = 해제(언마운트 시). 낡은 해제는 no-op —
// 같은 슬롯을 새 컨테이너가 차지한 뒤 이전 해제가 그걸 지우지 않는다.
export function registerRailContainer(
  viewId: string,
  slot: RailSlot,
  el: HTMLElement,
): () => void {
  const entry = containers.get(viewId) ?? {};
  entry[slot] = el;
  containers.set(viewId, entry);
  notify(viewId);
  return () => {
    const cur = containers.get(viewId);
    if (!cur || cur[slot] !== el) return;
    delete cur[slot];
    if (!cur.structure && !cur.inspector) containers.delete(viewId);
    else containers.set(viewId, cur);
    notify(viewId);
  };
}

export function railContainer(
  viewId: string | null | undefined,
  slot: RailSlot,
): HTMLElement | null {
  if (!viewId) return null;
  return containers.get(viewId)?.[slot] ?? null;
}

// 캔버스 호스트가 결부 viewId 의 등록 변화를 구독한다.
export function subscribeRail(viewId: string | null | undefined, fn: () => void): () => void {
  if (!viewId) return () => {};
  let set = subs.get(viewId);
  if (!set) {
    set = new Set();
    subs.set(viewId, set);
  }
  set.add(fn);
  return () => {
    const s = subs.get(viewId);
    if (!s) return;
    s.delete(fn);
    if (s.size === 0) subs.delete(viewId);
  };
}
