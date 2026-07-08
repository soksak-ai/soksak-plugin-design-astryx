// 캔버스 앱 — shadow 안에 마운트되는 React 트리(§7 View law). 명령과 같은 모듈 스토어를 공유하고
// (erd 동형) 외부 스토어 구독으로 라이브 재렌더한다: 어떤 변이 명령이든 onChange→notify→snapshot 증분
// → useSyncExternalStore 가 재렌더 → 활성 페이지가 제자리 갱신(아티팩트·네비게이션 없음, §7 Live law).
//
// 3-패널 프레임(§7 Chrome law): 이 앱은 astryx Layout 프레임(frame.tsx)에 툴바·구조 트리·캔버스·인스펙터를
// 꽂는다. 크롬은 neutral 테마 스코프, 캔버스 서브트리는 문서 테마 스코프(nested-theme separation). 모든
// 온스크린 요소는 레지스트리 명령 클라이언트다(§7 All-elements clause): 선택=canvas.select, 프레이밍=
// canvas.set, 내보내기=export.tsx — 스토어 직접 변이 없음.
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
} from "react";
import { Button, EmptyState } from "@astryxdesign/core";
import {
  freshCanvasControls,
  type CanvasControls,
  type DesignPage,
  type Selection,
} from "../types";
import { findInPage } from "../model";
import * as catalog from "../catalog";
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
import { CanvasFrame, ThemeScope } from "./frame";
import { TreePanel, activeSelectedNodeId } from "./tree-panel";
import { Inspector } from "./inspector";
import { CodeOverlay } from "./code-view";

// 뷰가 읽는 확장 스토어 표면 — model.CanvasStore(doc·preview)에 뷰-세션(selection·canvasControls)을
// 얹는다. 둘 다 선택적(?): 최소 store(헤드리스·테스트)도 방어 기본값으로 마운트되게(null 선택·fresh 프레임).
// 실 DesignStore 는 둘을 필수로 채우므로 그대로 assign 된다(구조적 부분집합).
type ViewStore = CanvasStore & {
  readonly selection?: Selection | null;
  readonly canvasControls?: CanvasControls;
};

// 활성 페이지를 React 로 낮춘다(§7 Rendering core law): tsx 는 원본 코드를 sucrase→shim→default 마운트,
// tree 는 배럴 레지스트리로 트리를 낮춘다. 트리 경로는 nodeIdAttr 를 켜 각 노드 DOM 에 data-node-id 를
// 실어 캔버스 클릭·선택 아웃라인이 노드를 역매핑하게 한다(§7 Selection law). 둘 다 실패는 빈 화면이
// 아니라 보이는 오류 표면(렌더 코어 소유).
function renderPage(page: DesignPage, render: RenderConfig): ReactElement {
  if (page.source.kind === "tsx") {
    return renderTsx(page.source.code, render.modules);
  }
  const registry = render.modules.core as Record<string, unknown>;
  return renderNode(page.source.root, registry, {
    controlledInputs: render.controlledInputs,
    nodeIdAttr: true,
  });
}

// 뷰포트 폭 프리셋 → CSS 폭. "fill" = 컨테이너 채움, 숫자 = 그 px(단, 컨테이너보다 크면 100% 로 제한).
function widthStyle(width: CanvasControls["width"]): { width: string; maxWidth: string } {
  if (width === "fill") return { width: "100%", maxWidth: "100%" };
  return { width: `${width}px`, maxWidth: "100%" };
}

export interface CanvasAppProps {
  store: ViewStore;
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
  // 외부 스토어 구독 — notify 로 version 이 오르면 재렌더. 값은 아웃라인 effect 의 의존성으로도 쓴다.
  const version = useSyncExternalStore(subscribe, getVersion, getVersion);

  const doc = store.doc;
  const theme = doc.activeTheme;
  const mode = effectiveMode(doc.mode, theme);
  const page = activePage(store);

  // 프레이밍(§7 Toolbar law) — 스토어의 뷰-세션이 진실(canvas.set·툴바가 수렴). 없으면 fresh 로 방어.
  const controls = store.canvasControls ?? freshCanvasControls();
  // 선택(§7 Selection law) — 활성 페이지에 속한 선택 노드만 하이라이트·인스펙터 바인딩 대상.
  const selNodeId = activeSelectedNodeId(store.selection, page?.id ?? null);
  // 인스펙터가 요구하는 해소된 노드+카탈로그 엔트리. tsx 페이지·미선택은 null(인스펙터가 안내 그림).
  const selectedNode =
    page && selNodeId ? findInPage(page, selNodeId)?.node ?? null : null;
  const entry = selectedNode ? catalog.getEntry(selectedNode.type) ?? null : null;

  // 테마 아이콘 전역 등록(테마 바뀔 때마다) — astryx Theme 을 안 쓰므로(root html 오염 회피) 그 역할을
  // 여기서 대신한다. 없으면 core 기본 SVG 로 폴백(무해).
  useEffect(() => {
    if (!render.registerIcons) return;
    const obj = render.themeObjects[theme] as { icons?: unknown } | undefined;
    if (obj?.icons != null) render.registerIcons(obj.icons);
  }, [theme, render]);

  // 캔버스 선택 아웃라인(§7 Selection law) — 렌더된 노드 DOM(data-node-id)에서 선택 노드에 아웃라인을
  // 얹고 나머지는 벗긴다. version 으로 매 재렌더마다 재적용(재렌더가 DOM 을 새로 그려 아웃라인이 날아감).
  const frameRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const root = frameRef.current;
    if (!root) return;
    const els = root.querySelectorAll<HTMLElement>("[data-node-id]");
    els.forEach((el) => {
      const on = selNodeId !== null && el.getAttribute("data-node-id") === selNodeId;
      el.style.outline = on ? "2px solid #4f8cff" : "";
      el.style.outlineOffset = on ? "1px" : "";
    });
  }, [selNodeId, version]);

  // 캔버스 클릭 → 가장 가까운 data-node-id → canvas.select(§7 All-elements clause). 노드 밖 클릭은 무시
  // (현 선택 유지). tsx 페이지엔 data-node-id 가 없어 자연히 no-op.
  function onCanvasClick(e: ReactMouseEvent<HTMLDivElement>): void {
    if (!page) return;
    const el = (e.target as HTMLElement).closest?.("[data-node-id]");
    const nodeId = el?.getAttribute("data-node-id");
    if (nodeId) void execute("canvas.select", { pageId: page.id, nodeId });
  }

  // 툴바 프레이밍 변경 → canvas.set(§7 Toolbar law). 툴바는 setControls 로 완성 CanvasControls 를 주고,
  // 여기서 명령으로 라우팅한다 — 스토어 직접 변이 없이 CLI/MCP 와 같은 핸들러를 탄다(단일 진실).
  function applyControls(next: CanvasControls): void {
    void execute("canvas.set", { viewport: next.width, background: next.background });
  }

  // TSX 내보내기(§7 Export presentation law) — export.tsx 결과를 shadow 안 CodeOverlay(astryx CodeBlock)로
  // 띄운다(Meta PreviewShell Code view 이식). 코드/오류만 소유하고 표면 렌더는 code-view 가 낮춘다.
  const [exportText, setExportText] = useState<string | null>(null);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [exportFilename, setExportFilename] = useState<string>("");
  const exportOpen = exportText !== null || exportErr !== null;

  async function openExport(): Promise<void> {
    if (!page) return;
    const out = await execute("export.tsx", { pageId: page.id });
    if (out.ok) {
      const d = out.data as { tsx?: unknown; filename?: unknown } | undefined;
      setExportText(typeof d?.tsx === "string" ? d.tsx : "");
      setExportFilename(typeof d?.filename === "string" ? d.filename : "");
      setExportErr(null);
    } else {
      setExportErr(out.message || "내보내기에 실패했습니다.");
      setExportText(null);
    }
  }
  function closeExport(): void {
    setExportText(null);
    setExportErr(null);
    setExportFilename("");
  }

  // 툴바 행 — astryx Toolbar(페이지·테마·모드·뷰포트·배경) + TSX 내보내기 버튼(§7 Toolbar law 다이어그램).
  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        <CanvasToolbar store={store} execute={execute} controls={controls} setControls={applyControls} />
      </div>
      <Button
        label="TSX 내보내기"
        data-node="export"
        size="sm"
        variant="secondary"
        onClick={() => void openExport()}
        isDisabled={!page}
      />
    </div>
  );

  // 캔버스 서브트리 — 문서 테마 스코프(nested). 실물 렌더를 담고 선택 아웃라인·클릭 매핑을 건다.
  const canvasContent = (
    <ThemeScope
      className="canvas-scope"
      theme={theme}
      mode={mode}
      themeObjects={render.themeObjects}
      ThemeContext={render.themeContext}
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        color: "var(--color-text-primary)",
      }}
    >
      <div
        className="canvas-viewport"
        style={{
          flex: "1 1 auto",
          overflow: "auto",
          minHeight: 0,
          padding: 16,
          background: controls.background || "var(--color-background-body)",
        }}
      >
        {page ? (
          <div
            className="canvas-frame"
            ref={frameRef}
            onClick={onCanvasClick}
            style={{ ...widthStyle(controls.width), margin: "0 auto" }}
          >
            <NodeBoundary label={`page ${page.id}`}>{renderPage(page, render)}</NodeBoundary>
          </div>
        ) : (
          <EmptyState
            title="No pages yet"
            description="create one with page.create or template.apply."
          />
        )}
      </div>
    </ThemeScope>
  );

  return (
    <div
      className="canvas-root"
      data-astryx-theme={theme}
      style={{
        colorScheme: colorSchemeValue(mode),
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* 크롬 스코프 — neutral 테마(nested). Layout·툴바·트리·인스펙터가 문서 테마와 무관하게 neutral. */}
      <ThemeScope
        className="astryx-chrome"
        theme="neutral"
        mode="system"
        themeObjects={render.themeObjects}
        ThemeContext={render.themeContext}
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          color: "var(--color-text-primary)",
        }}
      >
        <CanvasFrame
          header={header}
          structure={<TreePanel page={page} selectedNodeId={selNodeId} execute={execute} />}
          canvas={canvasContent}
          inspector={<Inspector page={page} node={selectedNode} entry={entry} execute={execute} />}
        />
      </ThemeScope>

      {exportOpen && (
        <CodeOverlay
          code={exportText}
          error={exportErr}
          filename={exportFilename}
          onClose={closeExport}
        />
      )}
    </div>
  );
}
