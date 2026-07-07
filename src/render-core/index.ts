// 렌더 코어 배럴 — 캔버스 뷰(src/view)가 임포트하는 재사용 엔진(CONTRACT §7 Rendering core law).
// v2 러너의 tsx/트리 렌더 경로를 환경 무관하게 상대이전한 것: tree(트리 낮춤+ErrorBox/NodeBoundary),
// tsx(sucrase→require-shim→default 마운트). 둘 다 astryx 에 안 묶임 — 주입받은 레지스트리/모듈만 쓴다.
export {
  renderNode,
  ErrorBox,
  NodeBoundary,
  resolveChildren,
  type ComponentRegistry,
  type RenderOptions,
} from "./tree";
export {
  renderTsx,
  transformTsx,
  evaluateTsx,
  makeRequire,
  wrapJsxRuntime,
  fixImgProps,
  isSchemelessPath,
  unknownModuleStub,
  PLACEHOLDER_IMG,
  type RunnerModules,
} from "./tsx";
