// 원격 스토어 — 호스트(플러그인 JS)가 cefQuery persistent 로 push 하는 ViewStore 스냅샷을 보관하고
// React 재렌더를 구동한다(useSyncExternalStore 계약: subscribe + getVersion). 모델·명령은 호스트에
// 있고(헤드리스 보존) 이 앱은 스냅샷을 그리는 순수 뷰다 — 스냅샷은 동적 상태만(doc·activePageId·
// selection·canvasControls), 정적 자산(astryx·catalog·템플릿)은 앱 번들에 이미 있어 push 하지 않는다.
import { freshCanvasControls, type CanvasControls, type DesignDoc, type Selection } from "../types";

// CanvasApp 이 읽는 ViewStore 표면(canvas-app.tsx 의 ViewStore 와 동형). 호스트가 이 형태로 직렬화해 push.
export interface Snapshot {
  doc: DesignDoc;
  preview: { activePageId: string | null };
  selection: Selection | null;
  canvasControls: CanvasControls;
}

// 스냅샷 도착 전 초기값 — 빈 문서(activePage=null → EmptyState). 호스트는 subscribe 즉시 실 스냅샷을 push.
function emptySnapshot(): Snapshot {
  return {
    doc: { version: 1, activeTheme: "neutral", pages: [], seq: 0 },
    preview: { activePageId: null },
    selection: null,
    canvasControls: freshCanvasControls(),
  };
}

export interface RemoteStore {
  current(): Snapshot;
  set(next: unknown): void;
  subscribe(cb: () => void): () => void;
  getVersion(): number;
}

export function createRemoteStore(): RemoteStore {
  let snap: Snapshot = emptySnapshot();
  let version = 0;
  const listeners = new Set<() => void>();
  return {
    current: () => snap,
    set(next) {
      // 방어적 정규화 — 누락 필드는 빈 기본값으로 채워 잘못된/부분 스냅샷이 렌더를 죽이지 않게 한다.
      const s = (next ?? {}) as Partial<Snapshot>;
      snap = {
        doc: (s.doc ?? emptySnapshot().doc) as DesignDoc,
        preview: { activePageId: s.preview?.activePageId ?? null },
        selection: s.selection ?? null,
        canvasControls: s.canvasControls ?? freshCanvasControls(),
      };
      version++;
      for (const l of listeners) l();
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getVersion: () => version,
  };
}
