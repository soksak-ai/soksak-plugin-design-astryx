// soksak-plugin-design-astryx 엔트리 — 로더가 blob-URL 로 import 하는 단일 ESM(esbuild 번들).
// 이 플러그인은 캔버스 뷰를 기여한다(§1·§7 View law): 뷰는 browser-chromium 사이드카(CEF 149, CSS
// anchor positioning 네이티브)에서 standalone.html(앱 껍데기)을 렌더하고 cefQuery 로 스냅샷 push/명령
// 릴레이한다(app/host.ts). 헤드리스 엔진이기도 하다 — 모든 편집이 명령이라 뷰 미오픈에도 sok CLI/MCP/
// 스킬로 전부 동작한다. 활성화가 하는 일은: 스토어 구성(즉시) → 카탈로그 소스 등록 → 명령 등록(즉시) →
// 사이드카 뷰 provider 등록("ui" 권한, 표면 있을 때만) → 문서 하이드레이트(비동기, 등록을 안 막음).
// 문서는 app.data.kv 에 프로젝트별 영속(§11).
//
// 뷰↔명령 라이브 바인딩(§7 Live law): createSidecarView 가 store.subscribe 로 재렌더 push 를 배선한다 —
// 어떤 변이 명령이든 store.persist/notify → 구독자 스냅샷 push(cefQuery) → 앱 재렌더. 무거운 astryx/
// render-core 는 앱 번들(standalone)에 있어 main.js(플러그인 JS = 헤드리스 두뇌)엔 없다.
import { createStore, type DataKv } from "./commands/store";
import { registerCommands } from "./commands";
import { createSidecarView, type SidecarApp, type SidecarViewProvider } from "./app/host";
import type { CommandOutcome } from "./types";
import * as model from "./model";
import * as catalog from "./catalog";

// 코어 app.commands 최소 표면 — register 는 명령 등록(registerCommands 소관), execute 는 툴바 통로.
interface CommandsSurface {
  register?: unknown;
  execute?: (
    name: string,
    params?: Record<string, unknown>,
    opts?: { origin?: string },
  ) => Promise<CommandOutcome>;
}

// 활성화 컨텍스트의 최소 표면(실제 ctx 는 코어 PluginContext — 구조적 부분집합만 선언). "ui" 권한 표면
// (registerView)은 선택 — 없으면(예: 헤드리스 테스트 ctx) 뷰 등록을 건너뛰고 명령만 등록한다.
interface ActivateCtx {
  app: {
    commands?: CommandsSurface;
    data?: { kv?: DataKv };
    project?: { current?: () => { id: string; root: string | null } | null };
    // 사이드카(browser-chromium 엔진) 채널 — 캔버스를 Chromium 서피스에서 렌더한다(anchor 네이티브).
    sidecar?: SidecarApp["sidecar"];
    events?: SidecarApp["events"];
    ui?: {
      registerView?: (
        viewId: string,
        provider: SidecarViewProvider,
      ) => { dispose(): void } | (() => void);
    };
  };
  manifest: { id: string; version: string };
  dir: string;
  subscriptions: Array<{ dispose(): void } | (() => void)>;
}

export default {
  activate(ctx: ActivateCtx) {
    const app = ctx.app;
    const pluginId = ctx.manifest.id;
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
    ctx.subscriptions.push({ dispose: () => store.dispose() });

    // 카탈로그 소스 등록 — 명령 계층은 model.addNode/setProps/moveNode 를 catalog 인자 없이 호출한다.
    // 이 등록이 없으면 model 은 빈 카탈로그로 폴백해 모든 comp.add 가 INVALID_TYPE 로 실패한다.
    // catalog 모듈의 getEntry(type) 가 CatalogSource 와 동형이라 네임스페이스를 그대로 넘긴다.
    model.useCatalog(catalog);

    // 명령 등록(즉시) — 코어 표면은 구조적으로 registerCommands 의 Ctx 와 동형.
    registerCommands(ctx as unknown as Parameters<typeof registerCommands>[0], store);

    // 캔버스 뷰 등록(§7 View law) — "ui" 권한 표면이 있을 때만(헤드리스 ctx 면 건너뜀). 뷰는 browser-
    // chromium 사이드카 서피스에서 standalone.html(앱 껍데기)을 렌더하고, cefQuery 로 스냅샷 push/명령
    // 릴레이한다. 무거운 astryx/render-core 는 앱 번들(standalone)에 있어 main.js(플러그인 JS)에 없다 —
    // main.js 는 모델·명령·사이드카 호스트만(헤드리스 두뇌). store.subscribe 는 호스트가 내부에서 건다.
    if (app.ui?.registerView) {
      const sidecarView = createSidecarView({
        app: app as SidecarApp,
        store,
        pluginId,
        dir: ctx.dir,
      });
      ctx.subscriptions.push({ dispose: () => sidecarView.dispose() });
      ctx.subscriptions.push(app.ui.registerView("canvas", sidecarView.provider));
    }

    // 문서 복원(비동기, non-blocking). 하이드레이트 중 변이가 나면 우리 상태가 이긴다(store 가 처리).
    void store.hydrate();
  },
  deactivate() {
    // 회수는 subscriptions(store.dispose + registerView dispose)가 담당한다 — 별도 정리 없음.
    // v2 의 미리보기 서버 teardown 은 제거됐다(스폰 프로세스·http 서버가 없다, §7 Legacy-removal law).
  },
};
