// Chromium 앱 ↔ 호스트(플러그인 JS) 브리지 — 페이지 측. CEF MessageRouter(window.cefQuery)로 구조적
// 데이터만 주고받는다(JSON, 코드 아님 — eval 없음). 사이드카 브리지가 request 를 플러그인 JS 로 릴레이하고
// 플러그인 JS 가 명령 실행/구독을 해석한다(코어/사이드카는 불투명 relay). 두 채널:
//   - execute: page→host 1회 응답(명령 실행 → 결과 봉투). 툴바·트리·인스펙터 상호작용이 이걸 탄다.
//   - subscribeSnapshots: host→page persistent(모델 변할 때마다 스냅샷 push). 캔버스 라이브 반영 채널.
// 성능: request/response 는 작은 JSON. 정적 자산(astryx·catalog·템플릿)은 앱 번들에 구워 push 하지 않는다.
import type { CommandOutcome } from "../types";

interface CefQueryOptions {
  request: string;
  persistent?: boolean;
  onSuccess?: (response: string) => void;
  onFailure?: (errorCode: number, errorMessage: string) => void;
}

declare global {
  interface Window {
    cefQuery?: (opts: CefQueryOptions) => number;
    cefQueryCancel?: (id: number) => void;
  }
}

// 브리지 가용 여부 — 렌더-사이드 라우터가 window.cefQuery 를 주입했는지(파일 프리뷰/테스트에선 없음).
export function hasBridge(): boolean {
  return typeof window !== "undefined" && typeof window.cefQuery === "function";
}

// 명령 실행(page→host). 실패·미가용은 봉투로 표면화(throw 금지 — UI 가 죽지 않게). 응답은 결과 봉투 JSON.
export function execute(name: string, params?: Record<string, unknown>): Promise<CommandOutcome> {
  return new Promise((resolve) => {
    if (!hasBridge()) {
      resolve({ ok: false, code: "NO_BRIDGE", message: "cefQuery 미주입(브리지 없음)" });
      return;
    }
    window.cefQuery!({
      request: JSON.stringify({ kind: "execute", name, params: params ?? {} }),
      persistent: false,
      onSuccess: (r) => {
        try {
          resolve(JSON.parse(r) as CommandOutcome);
        } catch {
          // 파싱 실패해도 성공 응답이면 ok(방어) — 봉투 규약({ok,code,message})을 지켜 반환.
          resolve({ ok: true, code: "OK", message: "non-JSON success response" });
        }
      },
      onFailure: (code, msg) => resolve({ ok: false, code: "BRIDGE_FAIL", message: `${code} ${msg}` }),
    });
  });
}

// 스냅샷 구독(host→page, persistent). 호스트가 모델 변이마다 ViewStore 스냅샷을 push → onSnapshot 콜.
// 반환=구독 해제(cefQueryCancel). 미가용이면 no-op 해제.
export function subscribeSnapshots(
  onSnapshot: (snapshot: unknown) => void,
  onError?: (code: number, message: string) => void,
): () => void {
  if (!hasBridge()) return () => {};
  const id = window.cefQuery!({
    request: JSON.stringify({ kind: "subscribe" }),
    persistent: true,
    onSuccess: (r) => {
      try {
        onSnapshot(JSON.parse(r));
      } catch {
        /* 잘못된 스냅샷은 무시(이전 상태 유지) */
      }
    },
    onFailure: (code, message) => {
      // 구독 실패(브라우저 파괴·핸들러 부재) — 조용히 삼키지 않고 표면화한다.
      onError?.(code, message);
    },
  });
  return () => {
    try {
      window.cefQueryCancel?.(id);
    } catch {
      /* 이미 정리됨 */
    }
  };
}
