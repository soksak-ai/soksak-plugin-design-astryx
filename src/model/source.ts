// 페이지 소스 법칙 — 종류 판별·강제(coerce)·종류 게이트. CONTRACT §2·§11.
// PageSource 는 kind 에 대한 판별 유니온(tree|tsx). 이 모듈은 그 유니온을 다루는 순수부를 소유한다:
//   - coercePage/coercePageSource: 영속값 → v2 페이지 강제(v1 root-only 승격, 훼손 시 빈 tree).
//     런타임 하이드레이트 경로(commands/store.coerceDoc)가 doc seq 로 새 노드 id 를 발급하며 호출한다.
//   - requireTreeRoot/requireTsxSource: comp.* ↔ page.code.* 종류 게이트(§2). 반대 종류면 INVALID_TARGET.
import type { DesignNode, DesignPage, PageSource } from "../types";
import { err, type Err } from "../types";

// 노드 형태 얕은 검사 — 강제(coerce) 방어용. 우리 ns 라 기록 시점에 유효하므로 루트만 얕게 본다.
function isNodeish(v: unknown): v is DesignNode {
  if (!v || typeof v !== "object") return false;
  const n = v as Record<string, unknown>;
  return (
    typeof n.id === "string" &&
    typeof n.type === "string" &&
    typeof n.props === "object" &&
    n.props !== null &&
    Array.isArray(n.children)
  );
}

// 영속된 페이지 레코드(raw) → PageSource(§2·§11). 우선순위:
//   1) v2 source(tree+nodeish root | tsx+string code) → 그대로.
//   2) v1 root-only(page.root 가 nodeish) → { kind:"tree", root }.
//   3) 그 외(소스 부재/훼손) → 빈 tree 페이지(bare Stack). 이때만 mintNodeId 로 루트 id 를 발급한다.
export function coercePageSource(raw: unknown, mintNodeId: () => string): PageSource {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const s = r.source;
  if (s && typeof s === "object") {
    const so = s as Record<string, unknown>;
    if (so.kind === "tree" && isNodeish(so.root)) {
      return { kind: "tree", root: so.root };
    }
    if (so.kind === "tsx" && typeof so.code === "string") {
      return typeof so.origin === "string"
        ? { kind: "tsx", code: so.code, origin: so.origin }
        : { kind: "tsx", code: so.code };
    }
    // source 는 있으나 형태가 깨짐 → 아래 폴백.
  }
  if (isNodeish(r.root)) return { kind: "tree", root: r.root }; // v1 승격.
  return { kind: "tree", root: { id: mintNodeId(), type: "Stack", props: {}, children: [] } };
}

// 영속된 페이지 레코드 → DesignPage. id·name 이 문자열이 아니면 버린다(null → 상위가 드랍).
// source 는 coercePageSource 로 강제한다. mintNodeId 는 훼손 폴백에서만 소비된다.
export function coercePage(raw: unknown, mintNodeId: () => string): DesignPage | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.name !== "string") return null;
  return { id: r.id, name: r.name, source: coercePageSource(r, mintNodeId) };
}

// 종류 게이트(§2): tree 페이지의 root. tsx 페이지면 INVALID_TARGET — page.code.* 로 유도.
export function requireTreeRoot(page: DesignPage): DesignNode | Err {
  if (page.source.kind === "tree") return page.source.root;
  return err(
    "INVALID_TARGET",
    `페이지 '${page.id}' 는 tsx 소스라 comp.* 로 편집할 수 없음. page.code.get / page.code.set 를 쓰십시오.`,
  );
}

// 종류 게이트(§2): tsx 페이지의 소스(code+origin). tree 페이지면 INVALID_TARGET — comp.*/export.tsx 로 유도.
export function requireTsxSource(page: DesignPage): { code: string; origin?: string } | Err {
  if (page.source.kind === "tsx") {
    return page.source.origin !== undefined
      ? { code: page.source.code, origin: page.source.origin }
      : { code: page.source.code };
  }
  return err(
    "INVALID_TARGET",
    `페이지 '${page.id}' 는 tree 소스라 page.code.* 를 쓸 수 없음. comp.* 로 편집하거나 export.tsx 로 직렬화된 코드를 읽으십시오.`,
  );
}
