// 모델 반환 규약(CONTRACT §4 / types.ts 139-147): 성공 = 평문 데이터 레코드를 그대로 반환,
// 실패 = Err = { ok:false, code, message }. 성공 축엔 래퍼가 없다(데이터를 그대로 return).
// 명령 계층(commands)이 isErr 로 갈라 봉투로 1:1 매핑한다(성공→data, 실패→그대로).
import { err, type Err } from "../types";

export type ModelResult<D> = D | Err;

// 모델 반환(D | Err) 판별 — 성공 레코드엔 ok 키가 없고 Err 는 ok:false. 모델 내부 게이트가
// requireTreeRoot/requireTsxSource 등의 Err 를 갈라 조기 반환하는 데 쓴다(단일 진실, fixtures 도 재사용).
export function isErr(r: unknown): r is Err {
  return typeof r === "object" && r !== null && (r as { ok?: unknown }).ok === false;
}

export { err };
export type { Err };
