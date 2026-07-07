// 미리보기 서브시스템 공개 표면 — src/commands 가 `import * as preview from "../preview"` 로 쓴다.
// 책임 = 아티팩트 조립(순수 emit)과 기록(write). 브라우저 구동은 src/commands/preview-drive 소유.
export {
  writePreview,
  type WritePreviewArgs,
  type WritePreviewFs,
  type WritePreviewResult,
} from "./write";
export { PREVIEW_ASSETS, type PreviewAssets } from "./assets";
export { resolvePreviewMode, type PreviewMode } from "./mode";
export {
  buildPreviewIndexHtml,
  selectThemeCss,
  escapeForScript,
  previewDir,
  previewPaths,
  type PreviewCssAssets,
  type PreviewPaths,
} from "./emit";
export { ensurePreviewServer, stopPreviewServer, previewHttpUrl, parsePortLine, freshServerState } from "./server";
export type { PreviewServerState, ServerProc } from "./server";
