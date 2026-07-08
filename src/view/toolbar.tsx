// 캔버스 툴바(§7 Toolbar law) — 세 컨트롤 그룹 전부 명령 클라이언트다(스토어 직접 변이 금지):
//   1) 페이지 선택 → preview.refresh(활성 페이지),  2) 테마(7)+모드(light/dark/system) → theme.set,
//   3) 캔버스 컨트롤(뷰포트 폭·배경) → 뷰-로컬 프레이밍(문서 아님·비영속·창마다 독립).
// astryx 컴포넌트를 도그푸딩한다(Toolbar/Selector — 배럴 직접 import, main.js 그래프에 번들됨).
import type { ReactElement } from "react";
import { Toolbar, Selector } from "@astryxdesign/core";
import {
  COLOR_MODES,
  THEMES,
  VIEWPORT_WIDTHS,
  type CanvasControls,
  type ColorMode,
  type DesignDoc,
  type ThemeName,
  type ViewportWidth,
} from "../types";
import { applyTheme, selectPage } from "./actions";
import { activePage, type CanvasStore, type ExecuteCommand } from "./model";

// 배경 프리셋(뷰-로컬) — 빈 문자열 = 중립 기본(캔버스 CSS 가 정함).
const BACKGROUND_PRESETS: { value: string; label: string }[] = [
  { value: "", label: "Neutral" },
  { value: "#ffffff", label: "White" },
  { value: "#0b0b0c", label: "Dark" },
  { value: "transparent", label: "Transparent" },
];

// 폭 프리셋 → 문자열 값(Selector 는 문자열 value 만). "fill" 은 그대로, 숫자는 문자열화.
function widthValue(w: ViewportWidth): string {
  return String(w);
}
function parseWidth(v: string): ViewportWidth {
  return v === "fill" ? "fill" : (Number(v) as ViewportWidth);
}

export interface CanvasToolbarProps {
  store: CanvasStore;
  execute: ExecuteCommand;
  controls: CanvasControls;
  setControls: (next: CanvasControls) => void;
}

export function CanvasToolbar({
  store,
  execute,
  controls,
  setControls,
}: CanvasToolbarProps): ReactElement {
  const doc: DesignDoc = store.doc;
  const current = activePage(store);
  const mode: ColorMode = doc.mode ?? "system";

  const pageOptions = doc.pages.map((p) => ({ value: p.id, label: p.name }));
  const themeOptions = THEMES.map((t) => ({ value: t, label: t }));
  const modeOptions = COLOR_MODES.map((m) => ({ value: m, label: m }));
  const widthOptions = VIEWPORT_WIDTHS.map((w) => ({
    value: widthValue(w),
    label: w === "fill" ? "Fill" : String(w),
  }));

  const pageSelector = (
    <Selector
      label="Page"
      data-node="page"
      isLabelHidden
      size="sm"
      placeholder="No pages"
      options={pageOptions}
      value={current?.id ?? ""}
      onChange={(id: string) => void selectPage(execute, id)}
      isDisabled={pageOptions.length === 0}
    />
  );

  const themeSelector = (
    <Selector
      label="Theme"
      data-node="theme"
      isLabelHidden
      size="sm"
      options={themeOptions}
      value={doc.activeTheme}
      onChange={(t: string) => void applyTheme(execute, t as ThemeName, mode)}
    />
  );

  const modeSelector = (
    <Selector
      label="Mode"
      data-node="mode"
      isLabelHidden
      size="sm"
      options={modeOptions}
      value={mode}
      onChange={(m: string) => void applyTheme(execute, doc.activeTheme, m as ColorMode)}
    />
  );

  const widthSelector = (
    <Selector
      label="Width"
      data-node="width"
      isLabelHidden
      size="sm"
      options={widthOptions}
      value={widthValue(controls.width)}
      onChange={(v: string) => setControls({ ...controls, width: parseWidth(v) })}
    />
  );

  const backgroundSelector = (
    <Selector
      label="Background"
      data-node="background"
      isLabelHidden
      size="sm"
      options={BACKGROUND_PRESETS}
      value={controls.background}
      onChange={(v: string) => setControls({ ...controls, background: v })}
    />
  );

  return (
    <Toolbar
      label="Canvas controls"
      size="sm"
      startContent={pageSelector}
      centerContent={
        <>
          {themeSelector}
          {modeSelector}
        </>
      }
      endContent={
        <>
          {widthSelector}
          {backgroundSelector}
        </>
      }
    />
  );
}
