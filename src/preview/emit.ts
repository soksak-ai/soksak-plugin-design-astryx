// 미리보기 문서 조립 — 순수 문자열 빌드(부수효과 0). CONTRACT §7 의 아티팩트 규범을 그대로 낮춘다.
// index.html 은 자기완결 문서: (1) <style> reset+astryx → 활성 theme.css 순서, (2) window.__DESIGN__
// 인라인 스크립트, (3) <script src="./runner.js">(형제 file:// 스크립트, fetch 불사용). 러너가 이
// 문서 안에서 트리를 렌더한다. 이 파일은 ctx/fs 를 만지지 않는다 — drive.ts 가 기록·구동을 맡는다.
import type { DesignPayload } from "../types";
import { resolvePreviewMode } from "./mode";

// 미리보기가 임베드하는 CSS 자산(순수 입력). astryxCss = reset.css + dist/astryx.css 병합(build-runner
// 산출), themeCss = { 테마이름: theme.css }(7종). 활성 테마 하나만 문서에 들어간다(CONTRACT §9 재발행).
export interface PreviewCssAssets {
  astryxCss: string;
  themeCss: Record<string, string>;
}

// <script> 인라인 JSON 안전화 — '<' 를 < 로 바꿔 </script>·<!-- 탈출을 막는다. 값은 JS 객체
// 리터럴로 들어가므로 U+2028/2029 는 ES2019+ 문자열 리터럴에서 합법이라 별도 처리 불필요.
export function escapeForScript(json: string): string {
  return json.replace(/</g, "\\u003c");
}

// 활성 테마의 CSS 를 고른다. 없으면 빈 문자열(상위에서 ThemeName 은 이미 검증됨 — 방어적 폴백).
export function selectThemeCss(themeCss: Record<string, string>, theme: string): string {
  return themeCss[theme] ?? "";
}

// 미리보기 index.html 전체 문서를 만든다. payload = 이 페이지의 { theme, root }.
export function buildPreviewIndexHtml(payload: DesignPayload, assets: PreviewCssAssets): string {
  const themeCss = selectThemeCss(assets.themeCss, payload.theme);
  const designJson = escapeForScript(JSON.stringify(payload));
  // <html> 정적 스탬프(첫 페인트 정합): data-astryx-theme 는 theme.css 의 @scope 토큰을 body 까지
  // 상속시켜 배경/글자색이 하이드레이션 전에도 해소되게 하고(플래시 방지), data-theme 는 reset.css 를
  // 통해 color-scheme(스크롤바·네이티브 컨트롤)을 맞춘다. system 은 data-theme 를 생략(OS 기본). 러너의
  // Theme mode prop 이 마운트 후 같은 값을 재확정하므로(mode.ts 단일 규칙) 정적/런타임이 어긋나지 않는다.
  const mode = resolvePreviewMode((payload as { mode?: unknown }).mode, payload.theme);
  // 명시 모드는 color-scheme 를 무층(unlayered) 규칙으로 강제한다 — theme.css 가 @layer 안에서
  // unscoped `:root{color-scheme:light dark}` 를 선언해 reset 의 data-theme 매핑을 이기고 OS 를
  // 따라가 버리므로(라이트 지정이 다크로 렌더), 무층 규칙(레이어보다 항상 우선)으로 되찾는다.
  const modeForce = mode === "system" ? "" : `html{color-scheme:${mode}}`;
  // 미리보기 호스트 프레임 — 테마 배경/글자색을 :root 변수에서 끌어와 캔버스를 채운다(빈 흰 배경 방지).
  const hostCss =
    modeForce +
    "html,body{margin:0}" +
    "body{background:var(--color-background-body,#fff);color:var(--color-text-primary,#111);" +
    "font-family:var(--font-family-body,system-ui,sans-serif)}" +
    "#root{min-height:100vh}";
  const themeAttr = ` data-astryx-theme="${escapeHtml(payload.theme)}"`;
  const modeAttr = mode === "system" ? "" : ` data-theme="${mode}"`;
  return `<!doctype html>
<html lang="en"${themeAttr}${modeAttr}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Astryx Preview — ${escapeHtml(payload.theme)}</title>
<style data-astryx-base>${assets.astryxCss}</style>
<style data-astryx-theme="${escapeHtml(payload.theme)}">${themeCss}</style>
<style data-preview-host>${hostCss}</style>
</head>
<body>
<div id="root"></div>
<script>window.__DESIGN__ = ${designJson};</script>
<script src="./runner.js"></script>
</body>
</html>
`;
}

// 속성값 최소 이스케이프(테마 이름은 THEMES 소속이라 사실상 안전하나 방어적).
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── 경로 헬퍼(순수) — 미리보기 아티팩트 위치. CONTRACT §7: `${ctx.dir}/.preview/` 평면 배치.
// 코어 app.fs.writeText 는 부모 디렉토리를 만들어 주지 않는다 — 페이지별 하위 폴더 대신
// 추적되는 .preview/.gitkeep 로 실존이 보장된 한 디렉토리에 `${pageId}.html` + 공유 runner.js 를 쓴다.
export interface PreviewPaths {
  dirPath: string;
  indexPath: string;
  runnerPath: string;
}
export function previewDir(dir: string): string {
  return `${dir}/.preview`;
}
export function previewPaths(dir: string, pageId: string): PreviewPaths {
  const dirPath = previewDir(dir);
  return { dirPath, indexPath: `${dirPath}/${pageId}.html`, runnerPath: `${dirPath}/runner.js` };
}
