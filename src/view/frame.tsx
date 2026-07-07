// 3-패널 프레임(§7 Chrome law) — 플러그인이 자기가 파는 엔진을 도그푸딩한다: astryx Layout +
// LayoutHeader/LayoutPanel/LayoutContent 로 툴바 위 3분할(구조 | 캔버스 | 인스펙터)을 짠다. 프레임은
// 순수 배치일 뿐 — 테마·명령·선택 로직은 canvas-app 이 슬롯 콘텐츠로 넣는다(관심사 분리).
import type { Context, CSSProperties, ReactElement, ReactNode } from "react";
import {
  Layout,
  LayoutContent,
  LayoutHeader,
  LayoutPanel,
} from "@astryxdesign/core";
import type { ColorMode, ThemeName } from "../types";
import { colorSchemeValue } from "./model";

// 중첩 테마 스코프(§7 Chrome law: nested-theme separation) — data-astryx-theme(CSS 토큰 스코프)와
// color-scheme 를 든 래퍼 div 안에 astryx ThemeContext(useTheme JS 토큰)를 함께 공급한다. 루트가 아니라
// 중첩이라 document.documentElement 를 스탬프하지 않는다(§7 Mount law step 4). 크롬은 neutral 로, 캔버스
// 서브트리는 문서 테마로 — 두 번(neutral·문서) 쓰여 크롬과 캔버스가 각자 자기 테마를 갖는다.
export interface ThemeScopeProps {
  theme: ThemeName;
  mode: ColorMode;
  themeObjects: Record<string, unknown>;
  ThemeContext: Context<unknown>;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export function ThemeScope({
  theme,
  mode,
  themeObjects,
  ThemeContext,
  className,
  style,
  children,
}: ThemeScopeProps): ReactElement {
  // built 테마 객체(없으면 neutral, 그것도 없으면 null → useTheme 기본 토큰 폴백, 크래시 없음).
  const themeObj = (themeObjects[theme] ?? themeObjects.neutral ?? null) as unknown;
  return (
    <div
      className={className}
      data-astryx-theme={theme}
      style={{ colorScheme: colorSchemeValue(mode), ...style }}
    >
      <ThemeContext.Provider value={{ theme: themeObj, mode }}>{children}</ThemeContext.Provider>
    </div>
  );
}

// 사이드 패널 픽셀 예산(§7 Chrome law: 구조 ≈ 240–280, 인스펙터 ≈ 300–340). 캔버스는 남는 LayoutContent.
const STRUCTURE_WIDTH = 260;
const INSPECTOR_WIDTH = 320;

export interface CanvasFrameProps {
  header: ReactNode; // 툴바 행(페이지·테마·모드·뷰포트·배경·TSX 내보내기).
  structure: ReactNode; // 구조 패널(TreeList).
  canvas: ReactNode; // 캔버스(Shadow-DOM 실물 렌더).
  inspector: ReactNode; // 인스펙터(선택 노드 prop 폼).
}

// 3-패널 프레임 — Layout 슬롯(header/start/content/end)에 크롬을 배치한다(§7 Chrome law 다이어그램).
// 패널은 스크롤 가능, 캔버스 content 는 여백 0(안쪽 캔버스가 자기 패딩·스크롤을 든다).
export function CanvasFrame({
  header,
  structure,
  canvas,
  inspector,
}: CanvasFrameProps): ReactElement {
  return (
    <Layout
      height="fill"
      header={<LayoutHeader hasDivider>{header}</LayoutHeader>}
      start={
        <LayoutPanel
          hasDivider
          isScrollable
          padding={2}
          width={STRUCTURE_WIDTH}
          role="navigation"
          label="구조"
        >
          {structure}
        </LayoutPanel>
      }
      content={
        <LayoutContent padding={0} role="main" label="캔버스">
          {canvas}
        </LayoutContent>
      }
      end={
        <LayoutPanel
          hasDivider
          isScrollable
          padding={2}
          width={INSPECTOR_WIDTH}
          role="complementary"
          label="인스펙터"
        >
          {inspector}
        </LayoutPanel>
      }
    />
  );
}
