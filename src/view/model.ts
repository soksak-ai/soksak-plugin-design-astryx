// 캔버스 뷰 모델 — 뷰가 소비하는 구조적 계약과 순수 투영 로직(CONTRACT §7). 무거운 렌더 모듈
// (React/astryx/CSS)은 render-modules 가 주입하고, 여기는 뷰-명령 seam 타입과 순수 함수만 둔다.
import type { Context } from "react";
import type {
  ColorMode,
  CommandOutcome,
  DesignDoc,
  DesignPage,
  ThemeName,
} from "../types";
import type { RunnerModules } from "../render-core";

// 뷰가 읽는 스토어 최소 표면(commands/store 의 DesignStore 구조적 부분집합). doc = 문서, preview.
// activePageId = 마운트된 뷰가 그리는 활성 페이지(§7 Live law·§11, 영속 안 함). 뷰는 이 둘만 읽는다.
export interface CanvasStore {
  readonly doc: DesignDoc;
  readonly preview: { activePageId: string | null };
}

// 툴바가 문서를 바꾸는 통로 — 이 플러그인 자신의 명령을 인프로세스로 실행한다(sok 소켓 왕복 아님).
// name 은 짧은 명령명("theme.set"·"preview.refresh"); plugin-entry 가 plugin.<id>. 접두를 채워 넘긴다.
// 명령 핸들러가 공유 스토어를 변이하고 onChange 를 발화 → notify → 뷰 재렌더(단일 진실, §7 Toolbar law).
export type ExecuteCommand = (
  name: string,
  params?: Record<string, unknown>,
) => Promise<CommandOutcome>;

// 렌더 설정 — render-modules(프로덕션) 또는 테스트가 주입한다. 뷰 코어(mount/canvas-app)는 astryx 에
// 안 묶이고 이걸로만 그린다(§7 Rendering core law — 주입 seam 이 러너에서 뷰로 옮겨온 것뿐).
export interface RenderConfig {
  modules: RunnerModules; // tsx 경로 require-shim 이 해소할 번들 네임스페이스.
  themeObjects: Record<string, unknown>; // 이름→built 테마 객체(useTheme JS 토큰 해소용).
  themeContext: Context<unknown>; // astryx ThemeContext(배럴 export) — useTheme 소비자에 값 공급.
  registerIcons?: (icons: unknown) => void; // 테마 아이콘 전역 등록(선택 — 없으면 core 기본 SVG 폴백).
  controlledInputs: ReadonlySet<string>; // 트리 경로 정적 목업 입력 법칙 집합(카탈로그 파생).
  astryxCss: string; // reset+astryx.css 병합 원문(:root→:host 재작성해 shadow 주입).
  themeCssMap: Record<string, string>; // 7 테마 theme.css(:root→:host 재작성해 전부 shadow 주입, §9).
}

// 뷰 팩토리 입력. store/execute 는 plugin-entry 가, render 는 프로덕션(render-modules)/테스트가 준다.
export interface CanvasViewDeps {
  store: CanvasStore;
  execute: ExecuteCommand;
  render: RenderConfig;
}

// 활성 페이지 선택(순수) — preview.activePageId 가 가리키는 페이지, 없으면 첫 페이지, 문서가 비면 null.
// 라이브 재렌더가 매번 이걸로 그릴 페이지를 정한다(§7 Live law).
export function activePage(store: CanvasStore): DesignPage | null {
  const { doc, preview } = store;
  if (doc.pages.length === 0) return null;
  if (preview.activePageId) {
    const found = doc.pages.find((p) => p.id === preview.activePageId);
    if (found) return found;
  }
  return doc.pages[0];
}

// 색 모드 투영(순수, 렌더 프레이밍) — 문서 mode 를 shadow 래퍼 color-scheme 로 낮춘다(§9). gothic 은
// 다크 전용이라 항상 dark. 명령 계층의 gothic 게이트(theme-mode)와는 다른 관심사(그건 쓰기 거부, 이건
// 렌더 투영) — 잘못 저장된 조합이 와도 렌더는 죽지 않게 방어적으로 낮춘다.
export function effectiveMode(mode: ColorMode | undefined, theme: ThemeName): ColorMode {
  if (theme === "gothic") return "dark";
  if (mode === "light" || mode === "dark" || mode === "system") return mode;
  return "system";
}

// color-scheme CSS 값 — light→"light", dark→"dark", system→"light dark"(light-dark() 가 OS 를 따름).
export function colorSchemeValue(mode: ColorMode): string {
  return mode === "light" ? "light" : mode === "dark" ? "dark" : "light dark";
}
