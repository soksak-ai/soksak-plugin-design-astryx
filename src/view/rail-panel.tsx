// 레일 패널 앱 — 방출된 구조/인스펙터 패널의 서피스 루트(§7 Chrome law 의 사이드 패널을 레일 서피스로).
// 캔버스 앱과 같은 계약이다: 상태는 호스트 스토어가 소유하고(스냅샷 push), 이 앱은 파생만 그린다.
// 파생(활성 페이지·유효 선택·카탈로그 엔트리)은 canvas-app 과 동일 규칙 — 세 표면 한 선택(§7 Selection law).
// 크롬은 neutral 테마 스코프(캔버스 크롬과 동일 — nested-theme separation).
import { useSyncExternalStore, type ReactElement } from "react";
import type { CanvasControls, Selection } from "../types";
import { findInPage } from "../model";
import * as catalog from "../catalog";
import { activePage, type CanvasStore, type ExecuteCommand, type RenderConfig } from "./model";
import { ThemeScope } from "./frame";
import { TreePanel, activeSelectedNodeId } from "./tree-panel";
import { Inspector } from "./inspector";
import type { RailSlot } from "../app/railBridge";

// canvas-app 의 ViewStore 와 동형(부분집합) — 패널이 읽는 것만.
type PanelStore = CanvasStore & {
  readonly selection?: Selection | null;
  readonly canvasControls?: CanvasControls;
};

export interface RailPanelAppProps {
  slot: RailSlot;
  store: PanelStore;
  execute: ExecuteCommand;
  render: RenderConfig; // 테마 컨텍스트 공급용(패널은 modules 로 트리를 낮추지 않는다).
  subscribe: (cb: () => void) => () => void;
  getVersion: () => number;
}

export function RailPanelApp({
  slot,
  store,
  execute,
  render,
  subscribe,
  getVersion,
}: RailPanelAppProps): ReactElement {
  useSyncExternalStore(subscribe, getVersion, getVersion);

  const page = activePage(store);
  const selNodeId = activeSelectedNodeId(store.selection, page?.id ?? null);
  const selectedNode = page && selNodeId ? findInPage(page, selNodeId)?.node ?? null : null;
  const entry = selectedNode ? catalog.getEntry(selectedNode.type) ?? null : null;

  return (
    <div
      className="rail-root"
      style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      <ThemeScope
        className="astryx-chrome"
        theme="neutral"
        mode="system"
        themeObjects={render.themeObjects}
        ThemeContext={render.themeContext}
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          overflowY: "auto",
          padding: slot === "structure" ? 8 : 0, // 인스펙터는 자기 패딩을 든다(inspector.tsx).
          color: "var(--color-text-primary)",
          background: "var(--color-background-body)",
        }}
      >
        {slot === "structure" ? (
          <TreePanel page={page} selectedNodeId={selNodeId} execute={execute} />
        ) : (
          <Inspector page={page} node={selectedNode} entry={entry} execute={execute} />
        )}
      </ThemeScope>
    </div>
  );
}
