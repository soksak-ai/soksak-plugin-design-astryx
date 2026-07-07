// TSX 컴파일 게이트 — page.code.set 이 착지 전에 코드를 러너와 동일한 sucrase 설정으로 트랜스폼해
// 검증한다(CONTRACT §5·§7). 명령 시점 판정과 런타임 렌더 판정을 같은 설정으로 묶어, 컴파일 안 되는
// 코드가 tsx 페이지로 들어가는 걸 원천에서 막는다. 성공=null, 실패=COMPILE_FAILED Err(사람 요약은
// message, 컴파일러 원문은 data.diagnostics — 대칭 봉투 §4). 순수 함수(콜로케이트 테스트).
import { transform, type Options } from "sucrase";
import { err, type Err } from "../types";

// CONTRACT §7 Gate B — 러너가 tsx 페이지를 렌더할 때 쓰는 바로 그 설정. 여기서 못박아 드리프트를
// 막는다: imports=ESM→require(shim 이 만족), jsxRuntime automatic=명명 훅만 import 하는 템플릿 호환
// (classic 이면 React 미정의 throw), production=lean react/jsx-runtime(no jsxDEV), jsxImportSource=react.
export const RUNNER_SUCRASE: Omit<Options, "filePath"> = {
  transforms: ["typescript", "jsx", "imports"],
  jsxRuntime: "automatic",
  production: true,
  jsxImportSource: "react",
};

// code 를 러너 설정으로 트랜스폼한다. 통과면 null, 실패면 COMPILE_FAILED Err.
// sucrase.transform 은 파싱·토큰화 실패 시 throw → 잡아서 진단을 봉투로 감싼다. filePath 는 진단
// 메시지의 위치 표기용(디스크에 아무것도 쓰지 않는다).
export function compileGate(code: string, filePath: string): Err | null {
  try {
    transform(code, { ...RUNNER_SUCRASE, filePath });
    return null;
  } catch (e) {
    const diagnostics = e instanceof Error ? e.message : String(e);
    return err("COMPILE_FAILED", `TSX 컴파일 실패: ${firstLine(diagnostics)}`, { diagnostics });
  }
}

// 진단 첫 줄(사람 요약) — 전체 원문은 data.diagnostics 로 따로 실어 코어가 실패 data 를 흘려도
// message 만으로 사유가 남게 한다(§4).
function firstLine(s: string): string {
  const nl = s.indexOf("\n");
  return nl >= 0 ? s.slice(0, nl) : s;
}
