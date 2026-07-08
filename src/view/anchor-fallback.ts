// CSS Anchor Positioning 수동 폴백 — WKWebView 는 anchor-name 미지원(실측: anchor=false, popover=true)이고
// @oddbird 폴리필은 shadow DOM + top-layer 팝오버 조합을 못 잡는다(실측: 폴리필 실행 후에도 top:0,left:0).
// 그래서 팝오버가 열릴 때(beforetoggle: open) 직접 위치를 계산해 fixed 배치한다. astryx Layer(useLayer.tsx:474)는
// 팝오버 el 에 style.positionAnchor=--id + style.positionArea="&lt;side&gt; &lt;span?&gt;" 를 심고, 트리거엔
// anchor-name:--id 를 단다 — 이 링크를 읽어 트리거 rect 아래/위/옆에 배치한다(getPositionArea 역산).
// 순수 계산부(computePlacement)는 브라우저 무의존 — 유닛 테스트 대상.

export interface Rect {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}
export interface Placement {
  top: number;
  left: number;
}

// position-area 문자열 → 트리거 rect 기준 팝오버 좌상단(fixed). astryx getPositionArea(useLayer.tsx:255)의
// 역산: above→top, below→bottom, start→left, end→right; alignment start/end→span-right/span-left(가로) 또는
// span-bottom/span-top(세로). span 없으면 center 정렬. 뷰포트 밖이면 flip(위/아래, 좌/우).
export function computePlacement(
  area: string,
  trigger: Rect,
  popover: { width: number; height: number },
  viewport: { width: number; height: number },
  gap = 4,
): Placement {
  const parts = area.trim().split(/\s+/);
  const side = parts[0] || "bottom";
  const span = parts.find((p) => p.startsWith("span-")) ?? "";

  let top = 0;
  let left = 0;

  if (side === "bottom" || side === "top") {
    // 가로 정렬: span-right=트리거 좌측에 맞춤, span-left=우측에 맞춤, 무span=중앙.
    if (span === "span-right") left = trigger.left;
    else if (span === "span-left") left = trigger.right - popover.width;
    else left = trigger.left + (trigger.width - popover.width) / 2;

    const below = trigger.bottom + gap;
    const above = trigger.top - popover.height - gap;
    if (side === "bottom") top = below + popover.height <= viewport.height || above < 0 ? below : above;
    else top = above >= 0 || below + popover.height > viewport.height ? above : below;
  } else {
    // start(left) / end(right): 세로 정렬 span-bottom/span-top, 무span=상단 맞춤.
    if (span === "span-top") top = trigger.bottom - popover.height;
    else if (span === "span-bottom") top = trigger.top;
    else top = trigger.top;

    const right = trigger.right + gap;
    const leftPos = trigger.left - popover.width - gap;
    if (side === "right") left = right + popover.width <= viewport.width || leftPos < 0 ? right : leftPos;
    else left = leftPos >= 0 || right + popover.width > viewport.width ? leftPos : right;
  }

  // 뷰포트 클램프(가장자리 넘침 방지).
  left = Math.max(gap, Math.min(left, viewport.width - popover.width - gap));
  top = Math.max(gap, Math.min(top, viewport.height - popover.height - gap));
  return { top, left };
}

// 하나의 열린 팝오버를 트리거 rect 기준으로 배치한다. trigger 는 열림 시점의 앵커(호출부가 준다).
// positionArea 가 직렬화되면 그 방향을, 아니면 "bottom"(드롭다운 기본) 을 쓴다 — WKWebView 는 미지원
// 속성 직렬화가 불규칙하므로 방향은 방어적으로 폴백한다.
export function positionPopover(pop: HTMLElement, trigger: HTMLElement): void {
  const area =
    (pop.style as unknown as Record<string, string>).positionArea ||
    pop.style.getPropertyValue("position-area") ||
    "bottom";
  const tr = trigger.getBoundingClientRect();
  if (tr.width === 0 && tr.height === 0) return; // 트리거가 렌더 안 됨(측정 불가) → 건드리지 않는다.
  const pr = pop.getBoundingClientRect();
  const vp =
    typeof window !== "undefined"
      ? { width: window.innerWidth, height: window.innerHeight }
      : { width: Infinity, height: Infinity };
  const { top, left } = computePlacement(
    area,
    { top: tr.top, bottom: tr.bottom, left: tr.left, right: tr.right, width: tr.width, height: tr.height },
    { width: pr.width, height: pr.height },
    vp,
  );
  pop.style.position = "fixed";
  pop.style.margin = "0";
  pop.style.top = `${Math.round(top)}px`;
  pop.style.left = `${Math.round(left)}px`;
}

// 열림 시점의 트리거 = shadow.activeElement(방금 클릭/포커스된 버튼). 팝오버 자신이면 무효.
function triggerAt(shadow: ShadowRoot, pop: HTMLElement): HTMLElement | null {
  const ae = shadow.activeElement as HTMLElement | null;
  if (ae && ae !== pop && !pop.contains(ae)) return ae;
  return null;
}

// shadow root 에 팝오버 배치 폴백을 건다. 네이티브 anchor-name 지원 시 no-op(반환=해제). astryx 는
// 트리거↔팝오버를 anchor-name 으로만 잇는데 WKWebView 가 그 속성을 직렬화 안 해 DOM 링크가 없다 —
// 대신 열림 시점의 activeElement(방금 클릭된 트리거)를 앵커로 잡는다(실측: beforetoggle 시 shadow
// activeElement === 트리거). 앵커는 이벤트 시점에 동기 포착(rAF 뒤엔 팝오버가 포커스를 가져갈 수 있음).
export function installAnchorFallback(shadow: ShadowRoot): () => void {
  const supported =
    typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("anchor-name", "--x");
  if (supported) return () => {};

  const onToggle = (e: Event): void => {
    if ((e as { newState?: string }).newState !== "open") return;
    const pop = e.target as HTMLElement | null;
    if (!pop || typeof pop.getBoundingClientRect !== "function") return;
    const trigger = triggerAt(shadow, pop); // 동기 포착.
    if (!trigger) return;
    requestAnimationFrame(() => {
      try {
        positionPopover(pop, trigger);
      } catch {
        // 배치 실패는 미리보기를 죽이지 않는다(위치만 근사).
      }
    });
  };
  shadow.addEventListener("beforetoggle", onToggle, true);
  return () => shadow.removeEventListener("beforetoggle", onToggle, true);
}
