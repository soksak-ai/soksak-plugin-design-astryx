// soksak-plugin-design-astryx 엔트리 — 로더가 blob-URL 로 import 하는 단일 ESM(esbuild 번들).
// 이 플러그인은 인앱 캔버스 뷰를 기여한다(§1·§7 View law): Astryx 컴포넌트를 앱 웹뷰의 Shadow DOM 에
// 직접 마운트하고 같은 모듈 스토어에 라이브 바인딩한다. 헤드리스 엔진이기도 하다 — 모든 편집이 명령이라
// 뷰 미오픈에도 sok CLI/MCP/스킬로 전부 동작한다. 활성화가 하는 일은: 스토어 구성(즉시) → 카탈로그
// 소스 등록 → 명령 26개 등록(즉시) → 캔버스 뷰 provider 등록("ui" 권한, 표면 있을 때만) → 문서
// 하이드레이트(비동기, 등록을 안 막음 — E2E 적재 경쟁 제거). 문서는 app.data.kv 에 프로젝트별 영속(§11).
//
// 뷰↔명령 라이브 바인딩(§7 Live law): createCanvasView 에 store 와 execute 를 주입한다. execute 는
// 툴바가 이 플러그인 명령(theme.set·preview.refresh)을 인프로세스로 태우는 통로다(짧은 명령명에
// plugin.<id>. 접두를 채운다). store.subscribe(view.notify) 로 재렌더를 배선한다 — 어떤 변이 명령이든
// store.persist/notify 가 구독자를 발화 → view.notify → useSyncExternalStore 재렌더. 스토어를 먼저
// 만들고 뷰가 그 스토어를 받은 뒤 subscribe 로 배선하므로 store↔view 순환이 없다(erd 동형).
import { createStore, type DataKv } from "./commands/store";
import { registerCommands } from "./commands";
import { createCanvasView, type ExecuteCommand } from "./view";
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
    ui?: {
      registerView?: (
        viewId: string,
        provider: ReturnType<typeof createCanvasView>["provider"],
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

    // 캔버스 뷰 등록(§7 View law) — "ui" 권한 표면이 있을 때만(헤드리스 ctx 면 건너뜀, 무거운 astryx
    // 렌더 모듈도 이때만 적재). 툴바 execute 통로는 짧은 명령명에 plugin.<id>. 접두를 채워 코어
    // registry 로 태운다 — CLI/MCP 와 같은 핸들러라 변이·검증·persist·재렌더가 한 곳에서 일어난다.
    if (app.ui?.registerView) {
      const rawExecute = app.commands?.execute;
      const execute: ExecuteCommand = (name, params) =>
        rawExecute
          ? rawExecute(`plugin.${pluginId}.${name}`, params)
          : Promise.resolve({
              ok: false,
              code: "INTERNAL",
              message: "commands.execute unavailable",
            });
      const view = createCanvasView({ store, execute });
      store.subscribe(view.notify); // 라이브 재렌더 배선(store↔view 순환 회피 — 뷰 생성 후 구독).
      ctx.subscriptions.push(app.ui.registerView("canvas", view.provider));
    }

    // 문서 복원(비동기, non-blocking). 하이드레이트 중 변이가 나면 우리 상태가 이긴다(store 가 처리).
    void store.hydrate();
  },
  deactivate() {
    // 회수는 subscriptions(store.dispose + registerView dispose)가 담당한다 — 별도 정리 없음.
    // v2 의 미리보기 서버 teardown 은 제거됐다(스폰 프로세스·http 서버가 없다, §7 Legacy-removal law).
  },
};
