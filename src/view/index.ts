// 캔버스 뷰 공개 표면 — plugin-entry 가 이 팩토리로 provider 를 만들어 app.ui.registerView("canvas", …)
// 로 코어에 바인딩하고, createStore({ onChange: view.notify }) 로 라이브 재렌더를 배선한다(§7 View law).
//   const view = createCanvasView({ store, execute });
//   app.ui.registerView("canvas", view.provider);
//   const store = createStore({ …, onChange: () => view.notify() });   // 배선
// render 모듈(무거운 astryx/CSS 주입)은 여기서 productionRenderConfig() 로 채운다. 뷰 코어
// (buildCanvasView)는 테스트가 가벼운 RenderConfig 를 주입할 수 있게 별도로 노출한다.
import { buildCanvasView, type CanvasView } from "./mount";
import { productionRenderConfig } from "./render-modules";
import type { CanvasStore, ExecuteCommand } from "./model";

export interface CreateCanvasViewDeps {
  store: CanvasStore;
  execute: ExecuteCommand;
}

// 프로덕션 팩토리 — render 를 productionRenderConfig 로 채워 buildCanvasView 에 위임.
export function createCanvasView(deps: CreateCanvasViewDeps): CanvasView {
  return buildCanvasView({
    store: deps.store,
    execute: deps.execute,
    render: productionRenderConfig(),
  });
}

export { buildCanvasView, type CanvasView } from "./mount";
export type {
  CanvasStore,
  CanvasViewDeps,
  ExecuteCommand,
  RenderConfig,
} from "./model";
