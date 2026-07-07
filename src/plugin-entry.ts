// soksak-plugin-design-astryx 엔트리 — 로더가 blob-URL 로 import 하는 단일 ESM(esbuild 번들).
// 이 플러그인은 뷰를 기여하지 않는다(헤드리스 디자인 엔진 — CONTRACT §1). 미리보기는 의존 브라우저
// 플러그인에 위임한다. 활성화가 하는 일은: 스토어 구성(즉시) → 명령 26개 등록(즉시) → 문서 하이드레이트
// (비동기, 등록을 안 막음 — E2E 적재 경쟁 제거). 문서는 app.data.kv 에 프로젝트별로 영속한다(§11).
import { stopPreviewServer } from "./preview";
import { createStore, type DataKv } from "./commands/store";
import { registerCommands } from "./commands";
import * as model from "./model";
import * as catalog from "./catalog";

// 활성화 컨텍스트의 최소 표면(실제 ctx 는 코어 PluginContext — 구조적 부분집합만 선언).
interface ActivateCtx {
  app: {
    commands?: unknown;
    fs?: unknown;
    data?: { kv?: DataKv };
    project?: { current?: () => { id: string; root: string | null } | null };
  };
  manifest: { id: string; version: string };
  dir: string;
  subscriptions: Array<{ dispose(): void } | (() => void)>;
}

// deactivate 가 회수할 활성 세션(스토어+ctx) — activate 가 채우고 deactivate 가 비운다.
interface ActiveProc {
  spawn: (cmd: string, args: string[], opts?: { cwd?: string }) => Promise<number>;
  onData: (handle: number, cb: (data: Uint8Array) => void) => { dispose(): void };
  onExit: (handle: number, cb: (code: number) => void) => { dispose(): void };
  kill: (handle: number) => Promise<void>;
}
let active: {
  store: { preview: { server: Parameters<typeof stopPreviewServer>[1] } };
  proc: ActiveProc | null;
} | null = null;

export default {
  activate(ctx: ActivateCtx) {
    const app = ctx.app;
    const projectId = app.project?.current?.()?.id ?? null;

    // app.data.kv 를 스토어의 최소 DataKv 표면으로 감싼다(this 바인딩 회피 — 코어는 클로저 객체).
    const rawKv = app.data?.kv;
    const kv: DataKv | undefined = rawKv
      ? {
          get: (k) => rawKv.get(k),
          set: (k, v) => rawKv.set(k, v),
          watch: (cb) => rawKv.watch(cb),
        }
      : undefined;

    const store = createStore({ kv, projectId, dir: ctx.dir });
    active = { store, proc: (ctx as { app?: { process?: ActiveProc } }).app?.process ?? null };
    ctx.subscriptions.push({ dispose: () => store.dispose() });

    // 카탈로그 소스 등록 — 명령 계층은 model.addNode/setProps/moveNode 를 catalog 인자 없이 호출한다.
    // 이 등록이 없으면 model 은 빈 카탈로그로 폴백해 모든 comp.add 가 INVALID_TYPE 로 실패한다.
    // catalog 모듈의 getEntry(type) 가 CatalogSource 와 동형이라 네임스페이스를 그대로 넘긴다.
    model.useCatalog(catalog);

    // 명령 등록(즉시) — 코어 표면은 구조적으로 registerCommands 의 Ctx 와 동형.
    registerCommands(ctx as unknown as Parameters<typeof registerCommands>[0], store);

    // 문서 복원(비동기, non-blocking). 하이드레이트 중 변이가 나면 우리 상태가 이긴다(store 가 처리).
    void store.hydrate();
  },
  async deactivate() {
    // 미리보기 서버 회수(§7) — 플러그인이 스폰한 프로세스는 플러그인이 거둔다. 멱등.
    const a = active;
    active = null;
    if (a?.proc) {
      await stopPreviewServer(a.proc, a.store.preview.server);
    }
  },
};
