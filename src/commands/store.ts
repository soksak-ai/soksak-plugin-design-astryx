// 인메모리 스토어 — 작업 중 DesignDoc 단일 진실(erd 선례: 모든 명령이 같은 소스 공유). 영속은
// app.data.kv(권한 "data", ns 는 코어가 플러그인 id 로 강제). 세션 상태(미리보기 엔진·마지막 페이지)는
// 스토어에만 두고 영속하지 않는다(CONTRACT §11). 문서 수준 강제(version/theme/mode/seq/pages 배열)는
// 여기가 소유하고, 페이지 소스 강제(v1→v2 승격·훼손 폴백)는 PageSource 소유자(model.coercePage)에
// 위임한다 — 강제 규칙 단일 진실(§2·§11, 인라인 재정의 금지).
import { freshServerState, type PreviewServerState } from "../preview/server";
import {
  type DesignDoc,
  type DesignPage,
  type ThemeName,
  type ColorMode,
  THEMES,
  COLOR_MODES,
} from "../types";
import { coercePage } from "../model";

export type Engine = "chromium" | "native";

// 미리보기 세션 상태 — 영속 대상 아님. 선택된 엔진과 마지막 미리보기 페이지/URL.
export interface PreviewSession {
  engine: Engine | null;
  pageId: string | null;
  url: string | null;
  server: PreviewServerState; // 플러그인 소유 http 정적 서버(§7 수송) — 세션 상태, 영속 안 함.
}

// 코어 app.data.kv 의 최소 표면(스토어가 실제 쓰는 것만). 전체는 src/plugins/api.ts.
export interface DataKv {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  watch(cb: (key: string | null) => void): { dispose(): void };
}

export interface DesignStore {
  doc: DesignDoc; // 작업 문서(모델이 제자리 변이, watch 재수화 시 교체). 핸들러는 호출 시점에 참조.
  dir: string; // 플러그인 설치 디렉토리(미리보기 아티팩트 기록 루트) = PluginContext.dir.
  preview: PreviewSession;
  persist(): Promise<void>; // 변이 후 doc 를 kv 에 기록(멱등).
  hydrate(): Promise<void>; // kv 에서 doc 복원(활성화 직후 1회, 비동기 — 등록은 즉시).
  dispose(): void; // watch 구독 해제.
}

// 신선 빈 문서 — 하이드레이트 부재 시 기본값(CONTRACT §11). mode 기본은 system(OS 따름).
export function freshDoc(): DesignDoc {
  return { version: 1, activeTheme: "neutral", mode: "system", pages: [], seq: 0 };
}

// kv 키 — 프로젝트별 파티션(CONTRACT §11). 프로젝트 없으면 "_global".
export function docKey(projectId: string | null | undefined): string {
  return `doc:${projectId ?? "_global"}`;
}

// 영속값(unknown) → DesignDoc 방어적 강제. 이 ns 는 우리 플러그인만 쓰므로(기록 시점에 유효) 얕은
// 강제로 충분하다. 상위 형태가 크게 깨졌으면 신선 문서로 폴백(침묵 손실 대신 안전 복구).
//
// 문서 수준(version/theme/mode/seq)만 여기서 강제하고, 각 페이지는 model.coercePage 에 위임한다:
// v1 root-only 페이지({id,name,root}) → {kind:"tree",root} 승격, 유효 v2 소스 보존, 부재·손상 →
// 빈 tree 페이지(bare Stack), id/name 없는 항목만 드랍(§2·§11). 마이그레이션 파일 없음 — 하이드레이트
// 시점 규칙이라 version 은 1 유지. 빈 tree 폴백의 루트 노드 id 는 seq 에서 발급(전역 유일 §2) → seq 관통.
export function coerceDoc(raw: unknown): DesignDoc {
  if (!raw || typeof raw !== "object") return freshDoc();
  const r = raw as Record<string, unknown>;
  if (r.version !== 1) return freshDoc();
  const activeTheme: ThemeName = THEMES.includes(r.activeTheme as ThemeName)
    ? (r.activeTheme as ThemeName)
    : "neutral";
  // mode 는 구 문서(필드 부재)·미지 값이면 system 으로 강제(activeTheme 폴백과 대칭).
  const mode: ColorMode = COLOR_MODES.includes(r.mode as ColorMode)
    ? (r.mode as ColorMode)
    : "system";
  let seq =
    typeof r.seq === "number" && Number.isFinite(r.seq) && r.seq >= 0 ? Math.floor(r.seq) : 0;
  const pages: DesignPage[] = [];
  if (Array.isArray(r.pages)) {
    for (const item of r.pages) {
      const page = coercePage(item, () => "n" + ++seq); // 훼손 폴백에서만 seq 소비.
      if (page) pages.push(page);
    }
  }
  return { version: 1, activeTheme, mode, pages, seq };
}

// 스토어 생성 — 동기 구성(doc=freshDoc)으로 즉시 반환한다. 하이드레이트는 별도 async(활성화 직후
// void store.hydrate()). 이렇게 하면 명령 등록이 하이드레이트를 안 기다려 E2E 적재 경쟁이 없다.
// 하이드레이트 진행 중 변이가 나면 우리 상태가 최신이므로 재수화 스왑을 건너뛴다(정합).
export function createStore(opts: {
  kv?: DataKv;
  projectId: string | null | undefined;
  dir: string;
  onChange?: () => void; // 재수화/외부변경 후 알림(멀티윈도우 뷰 갱신 훅 — 헤드리스면 no-op).
}): DesignStore {
  const { kv, dir } = opts;
  const key = docKey(opts.projectId);

  let writing = 0; // persist 진행 카운터(자기 쓰기 watch 무시용).
  let hydrating = false; // hydrate 의 kv.get 대기 중.
  let staleHydrate = false; // hydrate 대기 중 변이 발생 → 스왑 건너뜀.
  let watchSub: { dispose(): void } | null = null;

  const store: DesignStore = {
    doc: freshDoc(),
    dir,
    preview: { engine: null, pageId: null, url: null, server: freshServerState() },
    persist,
    hydrate,
    dispose,
  };

  async function persist(): Promise<void> {
    if (!kv) return;
    if (hydrating) staleHydrate = true; // 하이드레이트 중 변이 → 그 결과를 우리 것이 이긴다.
    writing++;
    try {
      await kv.set(key, store.doc);
    } finally {
      writing--;
    }
  }

  async function hydrate(): Promise<void> {
    if (!kv) return;
    hydrating = true;
    staleHydrate = false;
    try {
      const v = await kv.get(key);
      if (staleHydrate) return; // 대기 중 변이 발생 → 인메모리(이미 영속됨)가 최신.
      store.doc = coerceDoc(v);
      opts.onChange?.();
    } catch {
      // 읽기 실패는 현 상태 유지(신선 문서로 계속).
    } finally {
      hydrating = false;
    }
  }

  async function rehydrate(): Promise<void> {
    if (!kv) return;
    try {
      store.doc = coerceDoc(await kv.get(key));
      opts.onChange?.();
    } catch {
      // 유지.
    }
  }

  function dispose(): void {
    watchSub?.dispose();
    watchSub = null;
  }

  if (kv) {
    // 전 창 변경 구독 — CLI/MCP·다른 창의 kv 변경을 폴링 0 으로 반영(같은 프로젝트 일관).
    watchSub = kv.watch((changed) => {
      if (writing > 0) return; // 자기 쓰기 무시(최선努力 — 놓쳐도 재수화는 멱등).
      if (changed !== null && changed !== key) return; // 다른 프로젝트 키 무시.
      void rehydrate();
    });
  }

  return store;
}
