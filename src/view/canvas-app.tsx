// 캔버스 앱 — shadow 안에 마운트되는 React 트리(§7 View law). 명령과 같은 모듈 스토어를 공유하고
// (erd 동형) 외부 스토어 구독으로 라이브 재렌더한다: 어떤 변이 명령이든 onChange→notify→snapshot 증분
// → useSyncExternalStore 가 재렌더 → 활성 페이지가 제자리 갱신(아티팩트·네비게이션 없음, §7 Live law).
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactElement,
} from "react";
import {
  freshCanvasControls,
  type CanvasControls,
  type DesignPage,
} from "../types";
import { NodeBoundary, renderNode, renderTsx } from "../render-core";
import {
  activePage,
  colorSchemeValue,
  effectiveMode,
  type CanvasStore,
  type ExecuteCommand,
  type RenderConfig,
} from "./model";
import { CanvasToolbar } from "./toolbar";

// 활성 페이지를 React 로 낮춘다(§7 Rendering core law): tsx 는 원본 코드를 sucrase→shim→default 마운트,
// tree 는 배럴 레지스트리로 트리를 낮춘다. 둘 다 실패는 빈 화면이 아니라 보이는 오류 표면(렌더 코어 소유).
function renderPage(page: DesignPage, render: RenderConfig): ReactElement {
  if (page.source.kind === "tsx") {
    return renderTsx(page.source.code, render.modules);
  }
  const registry = render.modules.core as Record<string, unknown>;
  return renderNode(page.source.root, registry, {
    controlledInputs: render.controlledInputs,
  });
}

// 뷰포트 폭 프리셋 → CSS 폭. "fill" = 컨테이너 채움, 숫자 = 그 px(단, 컨테이너보다 크면 100% 로 제한).
function widthStyle(width: CanvasControls["width"]): { width: string; maxWidth: string } {
  if (width === "fill") return { width: "100%", maxWidth: "100%" };
  return { width: `${width}px`, maxWidth: "100%" };
}

export interface CanvasAppProps {
  store: CanvasStore;
  execute: ExecuteCommand;
  render: RenderConfig;
  subscribe: (cb: () => void) => () => void; // 외부 스토어 구독(mount 의 emitter).
  getVersion: () => number; // 스냅샷 — notify 마다 증가(재렌더 트리거).
}

export function CanvasApp({
  store,
  execute,
  render,
  subscribe,
  getVersion,
}: CanvasAppProps): ReactElement {
  // 외부 스토어 구독 — notify 로 version 이 오르면 재렌더. 값 자체는 안 쓰고 트리거로만(스토어를 매
  // 렌더 신선히 읽는다). server 스냅샷도 같은 getVersion(뷰는 클라이언트 전용이라 무해).
  useSyncExternalStore(subscribe, getVersion, getVersion);

  // 캔버스 컨트롤 — 뷰-로컬·비영속·창마다 독립(§7 Toolbar law). 문서 상태와 직교.
  const [controls, setControls] = useState<CanvasControls>(freshCanvasControls);

  const doc = store.doc;
  const theme = doc.activeTheme;
  const mode = effectiveMode(doc.mode, theme);
  const page = activePage(store);

  // 테마 아이콘 전역 등록(테마 바뀔 때마다) — astryx Theme 을 안 쓰므로(root html 오염 회피) 그 역할을
  // 여기서 대신한다. 없으면 core 기본 SVG 로 폴백(무해).
  useEffect(() => {
    if (!render.registerIcons) return;
    const obj = render.themeObjects[theme] as { icons?: unknown } | undefined;
    if (obj?.icons != null) render.registerIcons(obj.icons);
  }, [theme, render]);

  // ThemeContext 값 — useTheme 소비자(툴바·페이지 컴포넌트)에 { theme, mode } 공급. astryx Theme 을
  // 직접 안 쓰는 이유 = root Theme 이 document.documentElement 를 스탬프해 앱 chrome 을 오염시키기
  // 때문(§7 (2)). 대신 여기서 ThemeContext 를 직접 공급하고 data-astryx-theme·color-scheme 는 아래
  // 래퍼가 든다 — "wrap so it is not root" 를 깔끔히 실현.
  const ThemeProvider = render.themeContext.Provider;
  const themeObj = (render.themeObjects[theme] ?? render.themeObjects.neutral ?? null) as unknown;
  const ctxValue = { theme: themeObj, mode };

  return (
    <div
      className="canvas-root"
      data-astryx-theme={theme}
      style={{
        colorScheme: colorSchemeValue(mode),
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <ThemeProvider value={ctxValue}>
        <CanvasToolbar
          store={store}
          execute={execute}
          controls={controls}
          setControls={setControls}
        />
        <div
          className="canvas-viewport"
          style={{
            flex: "1 1 auto",
            overflow: "auto",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            padding: 16,
            background: controls.background || undefined,
          }}
        >
          {page ? (
            <div className="canvas-frame" style={widthStyle(controls.width)}>
              <NodeBoundary label={`page ${page.id}`}>
                {renderPage(page, render)}
              </NodeBoundary>
            </div>
          ) : (
            <div
              className="canvas-empty"
              style={{
                font: "13px/1.5 system-ui, sans-serif",
                opacity: 0.6,
                padding: 24,
              }}
            >
              No pages yet — create one with page.create or template.apply.
            </div>
          )}
        </div>
      </ThemeProvider>
    </div>
  );
}
