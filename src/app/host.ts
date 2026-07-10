// 사이드카 호스트(플러그인 JS 측) — 디자인 캔버스를 browser-chromium(CEF 149, anchor positioning 네이티브)
// 서피스에서 렌더한다. 앱 웹뷰(WKWebView, macOS 15)는 anchor 미지원이라 astryx 팝오버가 깨진다 — 엔진만
// astryx 가 요구하는 Chromium 으로 바꾸는 정공법. 모델·명령·영속은 플러그인 JS 에 남고(헤드리스 보존:
// 뷰 없이 CLI 동작), 뷰만 Chromium 앱(standalone.html)이 그린다. cefQuery 로 양방향(eval 없음):
//   - 앱이 {kind:subscribe} → 호스트가 store.notify 마다 ViewStore 스냅샷 push(라이브 반영)
//   - 앱 상호작용이 {kind:execute,name,params} → 호스트가 명령 실행 후 결과 봉투 응답
// 셸(도구 껍데기)은 file:// 정적 아티팩트(main.js 동급, 1회 로드·CEF 캐시). 디자인은 절대 파일이 안 되고
// 스냅샷 데이터로 흘러 앱 안에서 render-core(sucrase→astryx)로 라이브 tsx 렌더된다.
//
// 호스팅 모드 = offscreen(SIDECARS.md §8): 엔진이 offscreen 렌더해 모듈 소유 레이어로 present 하고,
// 이 셀(DOM)이 모든 입력을 소유한다 — 마우스/휠은 리스너로, 키보드/한글 조합은 숨김 편집 프록시의
// 네이티브 IME(composition 이벤트)로 받아 프로토콜 메시지(mouse/wheel/key/ime)로 포워딩한다.
// 엔진 커서는 cursor 이벤트로 돌아와 셀 CSS cursor 에 미러링된다.
import type { DesignStore } from "../commands/store";
import { forwardInput } from "./input-forward";

// 코어 app.sidecar.open 반환(browser-chromium host.ts 동형). 코어는 이 메시지 의미를 모른다(맹목 relay).
export interface SidecarHandle {
  send: (msg: Record<string, unknown>) => Promise<Record<string, unknown>>;
  on: (event: string, cb: (payload: Record<string, unknown>) => void) => { dispose(): void };
  close: () => Promise<void>;
}

// 사이드카 뷰가 쓰는 app 표면(코어 PluginApi 부분집합).
export interface SidecarApp {
  sidecar?: { open: (name: string) => Promise<SidecarHandle> };
  commands?: {
    execute: (name: string, params?: Record<string, unknown>) => Promise<{ ok: boolean; [k: string]: unknown }>;
  };
  events?: { on: (event: string, fn: (payload: unknown) => void) => { dispose(): void } };
}

export interface SidecarViewContext {
  projectId: string;
  viewId: string | null;
  setTitle?: (title: string) => void;
}
export interface SidecarViewProvider {
  mount(container: HTMLElement, ctx: SidecarViewContext): void;
  unmount?(container: HTMLElement): void;
}

export interface SidecarViewDeps {
  app: SidecarApp;
  store: DesignStore;
  pluginId: string;
  dir: string; // 플러그인 디렉토리 — file://<dir>/standalone.html 셸 위치.
}

// ViewStore 스냅샷 — 앱(CanvasApp)이 읽는 형태(doc·activePageId·selection·canvasControls). 동적 상태만
// (정적 자산은 앱 번들에 이미 있어 push 안 함 → 가볍다).
function snapshot(store: DesignStore): Record<string, unknown> {
  return {
    doc: store.doc,
    preview: { activePageId: store.preview.activePageId },
    selection: store.selection,
    canvasControls: store.canvasControls,
  };
}

function safeParse(s: unknown): { kind?: string; name?: string; params?: unknown } | null {
  if (typeof s !== "string") return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// 통합 rect → 정수 스냅(네이티브 반올림 틈 방지, browser-view 동형). 같은 rect 면 skip(0 IPC).
function measureRect(el: HTMLElement): { x: number; y: number; w: number; h: number } {
  const r = el.getBoundingClientRect();
  const x = Math.ceil(r.left);
  const y = Math.ceil(r.top);
  return { x, y, w: Math.max(1, Math.floor(r.right) - x), h: Math.max(1, Math.floor(r.bottom) - y) };
}

interface Mounted {
  id: number;
  dispose: () => void;
}

// 서피스 id 영속(sessionStorage, viewId→id). 플러그인 reload 는 JS 모듈을 교체해 이전 인스턴스의
// 서피스 id 를 메모리에서 잃는다 — 그러면 옛 CEF child 를 아무도 못 닫는 유령이 된다(실측: reload 반복
// 시 child 누적). sessionStorage 는 앱 웹뷰 수명 동안 reload 를 넘어 살아남으므로, init 에서 이전
// 인스턴스가 남긴 id 를 회수한다(browser-chromium 선례의 축소판 — 재사용 대신 회수+재생성). 창-스코프.
const SURFACE_STORE_KEY = "soksak-plugin-design-astryx:surfaces";
function loadPersistedSurfaces(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(SURFACE_STORE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}
function persistSurfaces(map: Record<string, number>): void {
  try {
    sessionStorage.setItem(SURFACE_STORE_KEY, JSON.stringify(map));
  } catch {
    /* 저장 불가 환경(테스트) — 영속 없이 동작 */
  }
}

// 이 플러그인이 점유 주장하는 엔진 서피스(viewId → surfaceId) — 영속 지도의 스냅샷.
// P6(모든 status 노출): 공유 엔진의 회수(reconcile)는 소유자들의 주장 합집합이 근거다 —
// 주장을 노출하지 않는 소유자의 서피스는 외부에서 안전하게 회수할 수 없다.
export function surfaceClaims(): Record<string, number> {
  return loadPersistedSurfaces();
}

export function createSidecarView(deps: SidecarViewDeps): { provider: SidecarViewProvider; dispose(): void } {
  const { app, store, pluginId, dir } = deps;
  const shellUrl = `file://${dir}/standalone.html`;

  // 현 인스턴스의 라이브 서피스 맵(viewId→id) — create 시 등록, close 시 제거, 항상 영속과 동기.
  const surfaceByView: Record<string, number> = {};

  let handleP: Promise<SidecarHandle> | null = null;
  function engine(): Promise<SidecarHandle> {
    if (!app.sidecar) return Promise.reject(new Error("sidecar 권한/선언 없음"));
    if (!handleP) {
      handleP = app.sidecar.open("browser-chromium").catch((e) => {
        handleP = null; // 실패는 캐시 안 함(스테이징 후 재시도).
        throw e;
      });
    }
    return handleP;
  }
  async function send(msg: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    try {
      return await (await engine()).send(msg);
    } catch (e) {
      console.warn("[design] sidecar send 실패:", e);
      return null;
    }
  }

  // init 회수 — 이전 인스턴스(reload)가 남긴 서피스는 이 인스턴스가 못 참조하는 유령이다. 영속된 id 를
  // 읽어 전부 닫고 영속을 비운다. 그다음 뷰가 mount 하면 새로 만든다(재사용 대신 회수+재생성 — flash 는
  // dev reload 한정, 정상 open/close 엔 무영향). 첫 기동(유령 없음)엔 no-op.
  {
    const orphans = loadPersistedSurfaces();
    persistSurfaces({});
    const ids = Object.values(orphans);
    if (ids.length) {
      void (async () => {
        for (const id of ids) await send({ type: "close", id });
      })();
    }
  }

  function trackSurface(viewId: string, id: number): void {
    surfaceByView[viewId] = id;
    persistSurfaces(surfaceByView);
  }
  function untrackSurface(viewId: string): void {
    delete surfaceByView[viewId];
    persistSurfaces(surfaceByView);
  }

  // 스냅샷 구독자(cefQuery persistent query id) — 앱이 {kind:subscribe} 로 등록. store.notify 마다 push.
  const subscribers = new Set<number>();
  function pushSnapshot(queryId: number): void {
    void send({
      type: "query-reply",
      queryId,
      success: true,
      response: JSON.stringify(snapshot(store)),
      keep: true, // persistent — 콜백 유지(다음 변이도 push).
    });
  }

  async function relayExecute(queryId: number, name: string, params: Record<string, unknown>): Promise<void> {
    const exec = app.commands?.execute;
    // 앱은 짧은 명령명(canvas.select 등)을 보낸다 — plugin.<id>. 접두를 채워 코어 registry 로 태운다
    // (CLI/MCP 와 같은 핸들러 → 변이·검증·persist·재렌더가 한 곳에서, 단일 진실).
    const outcome = exec
      ? await exec(`plugin.${pluginId}.${name}`, params)
      : { ok: false, code: "INTERNAL", message: "commands.execute unavailable" };
    void send({ type: "query-reply", queryId, success: true, response: JSON.stringify(outcome), keep: false });
  }

  // 서피스 id → 셀 컨테이너 — cursor 이벤트 미러링 대상 조회(offscreen 은 네이티브 커서가 없다).
  const containerById = new Map<number, HTMLElement>();

  // 쿼리 릴레이 — 앱 page 의 cefQuery → 브리지 event:"query". 사이드카 핸들당 1회 배선.
  let relayReady = false;
  async function ensureRelay(): Promise<void> {
    if (relayReady) return;
    relayReady = true;
    const h = await engine();
    h.on("query", (p) => {
      const queryId = p.queryId as number;
      const req = safeParse(p.request);
      if (!req || typeof queryId !== "number") return;
      if (req.kind === "subscribe") {
        subscribers.add(queryId);
        pushSnapshot(queryId); // 즉시 현재 상태 push.
      } else if (req.kind === "execute") {
        void relayExecute(queryId, String(req.name ?? ""), (req.params ?? {}) as Record<string, unknown>);
      }
    });
    h.on("query-canceled", (p) => {
      const queryId = p.queryId as number;
      if (typeof queryId === "number") subscribers.delete(queryId);
    });
    h.on("cursor", (p) => {
      const el = typeof p.id === "number" ? containerById.get(p.id) : undefined;
      if (el) el.style.cursor = String(p.type ?? "default");
    });
  }

  // ── 입력 포워딩(스펙 §8) — 이벤트→메시지 변환은 input-forward.ts 가 소유(테스트 가능 경계).
  // 여기서는 표면 id 바인딩과 cursor 미러링 등록만 한다.
  function inputForwarder(container: HTMLElement, id: number): () => void {
    containerById.set(id, container);
    const stop = forwardInput(container, (m) => void send({ ...m, id }));
    return () => {
      containerById.delete(id);
      stop();
    };
  }

  // store 변이 → 구독자 전원에 스냅샷 push(§7 Live law). 명령이 store.persist/notify 를 태우면 여기로 온다.
  const unsubStore = store.subscribe(() => {
    for (const q of subscribers) pushSnapshot(q);
  });

  const mounts = new WeakMap<HTMLElement, Mounted>();

  // bounds-follow — 컨테이너 rect 를 CEF 서피스에 동기화. 크기 변화(ResizeObserver)·창 리사이즈·위치
  // 이동(패널 분할·사이드바 토글은 rect 를 옮기되 크기 불변 → ResizeObserver 가 못 봄)까지 잡기 위해
  // 자기종료 rAF settle 루프를 이벤트로 재무장한다(browser-view 축소판). 가림(탭 전환)은 Intersection-
  // Observer 로 hidden 토글(가려진 CEF child 는 rAF 정지 → 자원 절약).
  function hostSurface(container: HTMLElement, id: number, viewId: string | null): () => void {
    let lastKey = "";
    const sync = (): void => {
      const r = measureRect(container);
      const key = `${r.x},${r.y},${r.w},${r.h}`;
      if (key === lastKey) return;
      lastKey = key;
      void send({ type: "bounds", id, x: r.x, y: r.y, w: r.w, h: r.h });
    };

    let raf = 0;
    let frames = 0;
    const STABLE = 4;
    const tick = (): void => {
      const before = lastKey;
      sync();
      // 변화가 멎으면(STABLE 프레임 연속 동일) 정지 — 상시 60fps 폴링 아님.
      frames = before === lastKey ? frames + 1 : 0;
      if (frames < STABLE) raf = requestAnimationFrame(tick);
      else raf = 0;
    };
    const arm = (): void => {
      frames = 0;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const ro = new ResizeObserver(arm);
    ro.observe(container);
    const onResize = (): void => arm();
    window.addEventListener("resize", onResize);
    // 드래그 중 위치 이동(ResizeObserver 사각) — pointermove(버튼 눌림)로 재무장.
    const onPointer = (e: PointerEvent): void => {
      if (e.buttons) arm();
    };
    document.addEventListener("pointermove", onPointer, true);
    document.addEventListener("pointerdown", onPointer, true);
    // 코어 리사이즈 신호(있으면 더 부드럽게) — 없으면 pointer+rAF 로 충분.
    const offLive = app.events?.on("window.live-resize", arm);
    const offGesture = app.events?.on("layout.resize-gesture", arm);

    const io = new IntersectionObserver((entries) => {
      const visible = entries.some((e) => e.isIntersecting);
      void send({ type: "hidden", id, hidden: !visible });
      if (visible) {
        lastKey = ""; // 재표시 시 강제 재동기(park 되어 있던 rect 정정).
        arm();
      }
    });
    io.observe(container);
    // 1차 신호는 코어 view.parked(시트 활성 && 탭 활성의 단일 판정) — IO 는 안전망으로 유지.
    const offPark = app.events?.on("view.parked", (p) => {
      const q = p as { viewId?: string; parked?: boolean };
      if (!viewId || q.viewId !== viewId) return;
      void send({ type: "hidden", id, hidden: !!q.parked });
      if (!q.parked) {
        lastKey = "";
        arm();
      }
    });

    arm(); // 초기 settle.

    return () => {
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("pointermove", onPointer, true);
      document.removeEventListener("pointerdown", onPointer, true);
      offLive?.dispose();
      offGesture?.dispose();
      offPark?.dispose();
      if (raf) cancelAnimationFrame(raf);
    };
  }

  // 마운트 진행/완료 마커 — async create 전에 동기 등록해 재진입(중복 mount)을 막는다. 서피스는
  // 컨테이너당 정확히 1개(누수 방지). create 실패·해제 시 마커를 지워 다음 mount 를 허용한다.
  const PENDING: Mounted = { id: -1, dispose: () => {} };

  const provider: SidecarViewProvider = {
    mount(container, ctx) {
      const viewId = ctx.viewId;
      if (!viewId) return; // 콘텐츠 배치만(사이드바 등 viewId 없는 배치는 서피스 없음).
      if (mounts.has(container)) return; // 이미 마운트/진행 중 — 중복 서피스 생성 방어(누수 방지).
      mounts.set(container, PENDING); // 동기 마커 — async create 전에 재진입 차단.
      void ensureRelay();
      // 투명 홀 — 컨테이너를 채우는 투명 영역. 매니페스트 transparent:true 와 짝: CEF child 가 메인 웹뷰
      // 아래에서 이 rect 를 통해 비친다. 위에 불투명 페인트가 있으면 서피스가 가려진다.
      container.style.position = "absolute";
      container.style.inset = "0";
      container.style.background = "transparent";
      container.style.overflow = "hidden";

      void (async () => {
        const r = measureRect(container);
        // offscreen 모드(스펙 §8) — 엔진이 모듈 소유 레이어로 present, 이 셀이 입력을 소유한다.
        const out = await send({
          type: "create",
          owner: "soksak-plugin-design-astryx",
          mode: "offscreen",
          scale: window.devicePixelRatio || 1,
          x: r.x, y: r.y, w: r.w, h: r.h,
          url: shellUrl,
        });
        const id = out && typeof out.id === "number" ? (out.id as number) : null;
        if (id == null) {
          console.warn("[design] 서피스 생성 실패");
          if (mounts.get(container) === PENDING) mounts.delete(container); // 실패 → 재시도 허용.
          return;
        }
        // create 대기 중 unmount 됐으면(마커가 사라졌거나 교체) 즉시 닫는다(late-create 유령 방지).
        if (mounts.get(container) !== PENDING) {
          void send({ type: "close", id });
          return;
        }
        trackSurface(viewId, id); // 영속(reload 넘어 유령 회수용).
        const stop = hostSurface(container, id, viewId);
        const stopInput = inputForwarder(container, id);
        mounts.set(container, {
          id,
          dispose: () => {
            stopInput();
            stop();
            untrackSurface(viewId);
            void send({ type: "close", id });
          },
        });
      })();
    },
    unmount(container) {
      const m = mounts.get(container);
      mounts.delete(container); // 먼저 지워 진행 중 late-create 가 스스로 닫히게(마커 불일치 감지).
      if (m && m !== PENDING) m.dispose();
    },
  };

  return {
    provider,
    dispose() {
      unsubStore();
    },
  };
}
