// Chromium 앱 엔트리 — 사이드카 browser-chromium 서피스에 file:// 로 로드되는 standalone 디자인 패널.
// astryx 는 CSS anchor positioning(Chrome 125+/Safari 26+ 전제)을 쓰는데 앱 웹뷰(WKWebView, macOS 15)는
// 미지원이라 팝오버가 깨진다 — 그래서 뷰만 CEF 149(anchor 네이티브)에서 렌더한다. 모델·명령·영속은
// 호스트(플러그인 JS)에 남아(헤드리스 보존: 뷰 없이 CLI 동작) cefQuery 로만 통신한다(eval 없음):
//   - 호스트가 persistent 구독으로 ViewStore 스냅샷을 push → 캔버스 라이브 반영
//   - 툴바·트리·인스펙터 상호작용 → execute(cefQuery) → 호스트 명령 실행 → 새 스냅샷 push
// 정적 자산(React·astryx·catalog·테마·render-core)은 이 번들에 구워 스냅샷 push 를 가볍게 유지한다.
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { CanvasApp } from "../view/canvas-app";
import { productionRenderConfig } from "../view/render-modules";
import { createRemoteStore } from "./remote-store";
import { execute, subscribeSnapshots } from "./bridge";

const remote = createRemoteStore();

// CanvasApp 은 store 를 PROPS 로 읽고 useSyncExternalStore(subscribe, getVersion)로 재렌더한다. 스냅샷은
// 매 push 마다 새 객체라, 안정 참조의 getter 프록시로 store 를 노출해 재렌더 시 항상 최신 스냅샷을 읽게
// 한다(shadow 마운트의 in-place 라이브 스토어와 동일 계약을 원격 스냅샷으로 재현).
const storeView = {
  get doc() {
    return remote.current().doc;
  },
  get preview() {
    return remote.current().preview;
  },
  get selection() {
    return remote.current().selection;
  },
  get canvasControls() {
    return remote.current().canvasControls;
  },
};

// 스탠드얼론(file://) 초기 렌더용 시드 — 호스트 미연결 시 정적 렌더(P2 검증·오프라인 뷰어). HTML
// 래퍼가 window.__DESIGN_SNAPSHOT__ 로 굽는다(없으면 빈 뷰어). 호스트가 cefQuery 로 붙으면 첫 스냅샷이
// 시드를 덮는다 — 시드는 초기값일 뿐 진실은 호스트(헤드리스 보존).
const seed = (globalThis as { __DESIGN_SNAPSHOT__?: unknown }).__DESIGN_SNAPSHOT__;
if (seed) remote.set(seed);

// 호스트가 push 하는 스냅샷 → 원격 스토어 갱신 → version 증가 → CanvasApp 재렌더.
// 구독 실패는 조용히 삼키지 않는다 — 브리지 불통은 콘솔에 표면화(침묵 강등 금지).
subscribeSnapshots(
  (snap) => remote.set(snap),
  (code, message) => console.warn(`[design] 스냅샷 구독 실패(${code}): ${message}`),
);

const el = document.getElementById("root");
if (el) {
  createRoot(el).render(
    createElement(CanvasApp, {
      store: storeView,
      execute,
      render: productionRenderConfig(),
      subscribe: remote.subscribe,
      getVersion: remote.getVersion,
    }),
  );
}
