// 캔버스 뷰 마운트(§7 Mount law, erd 선례) — container 에 shadow 를 붙여 전역 CSS 리셋을 가두고,
// reset+astryx+7테마 CSS 를 :host 재작성해 주입한 뒤 React 트리를 그린다. 뷰-명령 라이브 바인딩은
// emitter(version+listeners)로 한다: plugin-entry 가 createStore({onChange: view.notify}) 로 배선하면
// 모든 변이 명령이 notify 를 태워 useSyncExternalStore 가 재렌더한다(§7 Live law).
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { PluginViewProvider, ViewContext } from "../types";
import { CanvasApp } from "./canvas-app";
import { buildShadowCss } from "./css";
import { activePage, type CanvasViewDeps } from "./model";

// container 별 마운트 상태. attachShadow 는 요소당 1회라 shadowRoot 를 재사용한다(리로드/재마운트).
interface MountState {
  root: Root;
  shadow: ShadowRoot;
}

// 라이브 재렌더 emitter — notify 로 version 증가·listeners 통지(useSyncExternalStore snapshot).
interface Emitter {
  notify(): void;
  subscribe(cb: () => void): () => void;
  getVersion(): number;
}

function createEmitter(): Emitter {
  let version = 0;
  const listeners = new Set<() => void>();
  return {
    notify() {
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

export interface CanvasView {
  provider: PluginViewProvider;
  notify: () => void; // plugin-entry 가 store onChange 에 배선.
}

// 뷰 코어 팩토리 — store/execute/render 를 받아 provider+notify 를 낸다. render(무거운 모듈)은
// 프로덕션(render-modules)/테스트가 주입한다 — 이 코어는 astryx 에 안 묶인다.
export function buildCanvasView(deps: CanvasViewDeps): CanvasView {
  const { store, execute, render } = deps;
  const emitter = createEmitter();
  const mounts = new WeakMap<HTMLElement, MountState>();
  let polyfilled = false;

  function mount(container: HTMLElement, ctx?: ViewContext): void {
    unmount(container); // 중복 mount 방어 — 먼저 회수.

    const shadow = container.shadowRoot ?? container.attachShadow({ mode: "open" });
    shadow.replaceChildren(); // 재마운트 시 이전 style/host 잔여 제거.

    // CSS 주입 — reset+astryx(:host) + 7 테마(:host). data-astryx-theme 일치 블록만 활성(§9).
    const style = document.createElement("style");
    style.textContent = buildShadowCss(render.astryxCss, render.themeCssMap);
    shadow.appendChild(style);

    // React 루트 host — 컨테이너를 채운다(코어가 container 를 definite 박스로 보장).
    const host = document.createElement("div");
    host.style.width = "100%";
    host.style.height = "100%";
    host.style.overflow = "hidden";
    shadow.appendChild(host);

    // 앵커 포지셔닝 폴백 — 네이티브 미지원시 1회(§7 Anchor polyfill law). 프로덕션 폴백은 자체
    // 게이트+idempotent, 테스트는 render.polyfill 미주입이라 건너뛴다.
    if (!polyfilled && render.polyfill) {
      polyfilled = true;
      render.polyfill();
    }

    const root = createRoot(host);
    root.render(
      createElement(CanvasApp, {
        store,
        execute,
        render,
        subscribe: emitter.subscribe,
        getVersion: emitter.getVersion,
      }),
    );
    mounts.set(container, { root, shadow });

    // 활성 페이지명을 탭 제목에 반영(선택).
    const page = activePage(store);
    if (ctx?.setTitle && page) ctx.setTitle(page.name);
  }

  function unmount(container: HTMLElement): void {
    const state = mounts.get(container);
    if (!state) return;
    state.root.unmount(); // effect cleanup 연쇄(구독 해제·타이머 정리).
    mounts.delete(container);
  }

  return {
    provider: { mount, unmount },
    notify: emitter.notify,
  };
}
