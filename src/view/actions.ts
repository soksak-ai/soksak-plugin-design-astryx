// 툴바 액션 — 문서를 바꾸는 유일 통로는 이 플러그인 명령이다(§7 Toolbar law: 툴바는 명령 클라이언트,
// 스토어 직접 변이 금지). 짧은 명령명으로 execute 를 호출해 CLI/MCP 와 같은 핸들러를 탄다 → 공유
// 스토어 변이·검증(gothic 게이트)·persist·onChange 가 한 곳에서 일어난다(단일 진실). 얇은 함수라
// 툴바 컴포넌트와 분리해 두어 execute 인자 검증만 순수하게 테스트한다.
import type { ColorMode, ThemeName } from "../types";
import type { ExecuteCommand } from "./model";

// 페이지 선택 — preview.refresh 로 활성 페이지를 옮긴다(활성 페이지 세팅 + onChange 발화, §5).
export function selectPage(execute: ExecuteCommand, pageId: string): Promise<unknown> {
  return execute("preview.refresh", { pageId });
}

// 테마/모드 적용 — theme.set(§5). gothic+light 거부·persist 는 핸들러가 강제한다(툴바는 요청만).
export function applyTheme(
  execute: ExecuteCommand,
  theme: ThemeName,
  mode?: ColorMode,
): Promise<unknown> {
  return execute("theme.set", mode === undefined ? { theme } : { theme, mode });
}
