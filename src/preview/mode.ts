// 미리보기 색 모드 해소 — 단일 진실. 러너(Theme `mode` prop)와 emit(`<html data-theme>` 정적 스탬프)이
// 같은 규칙을 써야 첫 페인트와 하이드레이션 이후가 일치한다(플래시 방지). 문서는 {theme, mode} 를 싣고
// 러너 페이로드로 흐르지만, mode 는 optional 이라 방어적으로(unknown) 받는다.
export type PreviewMode = "light" | "dark" | "system";

// mode 규칙:
//   - gothic 은 다크 전용 테마 → 항상 dark(라이트 대응 토큰이 없음).
//   - 그 외엔 명시된 light/dark/system 을 존중, 없거나 이상값이면 system(reset.css 가 OS 를 따름).
export function resolvePreviewMode(mode: unknown, theme: string): PreviewMode {
  if (theme === "gothic") return "dark";
  if (mode === "light" || mode === "dark" || mode === "system") return mode;
  return "system";
}
