// 빌드타임 임베드 자산 — main.js 는 blob 으로 import 되어 형제 파일을 못 읽으므로(CONTRACT §12),
// 러너 번들·CSS 는 build.mjs 가 문자열 define 으로 주입한다. 이 모듈이 그 define 을 PreviewAssets 로
// 묶는다. typeof 가드: 빌드 밖(vitest 등 define 부재)에서 import 돼도 ReferenceError 없이 빈값으로
// 폴백한다 — 이 층은 순수 emit 과 분리돼 테스트 대상이 아니며, 실빌드에선 define 이 채운다.
import type { PreviewCssAssets } from "./emit";

// 러너 번들까지 포함한 전체 자산. themeCss/astryxCss 는 emit 의 PreviewCssAssets.
export interface PreviewAssets extends PreviewCssAssets {
  runnerJs: string; // generated/runner.js(IIFE) 원문.
}

// build.mjs 의 esbuild define. 런타임 값 = 각 생성물 파일 원문 문자열(build.mjs 가 JSON.stringify 로
// 문자열 리터럴화). THEME_CSS_MAP 만 JSON 객체 텍스트라 parse 한다.
declare const __ASTRYX_CSS__: string;
declare const __THEME_CSS_MAP__: string;
declare const __RUNNER_JS__: string;

const astryxCss = typeof __ASTRYX_CSS__ !== "undefined" ? __ASTRYX_CSS__ : "";
const themeMapRaw = typeof __THEME_CSS_MAP__ !== "undefined" ? __THEME_CSS_MAP__ : "{}";
const runnerJs = typeof __RUNNER_JS__ !== "undefined" ? __RUNNER_JS__ : "";

export const PREVIEW_ASSETS: PreviewAssets = {
  astryxCss,
  themeCss: JSON.parse(themeMapRaw) as Record<string, string>,
  runnerJs,
};
