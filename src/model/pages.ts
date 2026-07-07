// 페이지 mutation — 실패 시 문서 불변(검증 후 변경). 성공 시 CONTRACT §5 평문 데이터 레코드,
// 실패 시 Err. 두 페이지 종류(tree|tsx)를 모두 소유한다(§2). 명령 계층이 원시 params 를 그대로 넘긴다.
import type { DesignDoc, PageKind, PageSource } from "../types";
import { err, type Err } from "../types";
import { makeNode, nextPageId } from "./ids";
import { isErr } from "./result";
import { readStr } from "./read";
import { requireTsxSource } from "./source";
import { cloneWithFreshIds, countNodes } from "./tree";

// page.create kind=tsx 의 씨앗 코드 — 컴파일·마운트 가능한 최소 'use client' default-export(§5·§7).
// 러너의 sucrase(jsxRuntime:automatic)가 <div /> 를 react/jsx-runtime 으로 낮춰 빈 div 를 렌더한다.
const STARTER_TSX = "'use client';\n\nexport default function Page() {\n  return <div />;\n}\n";

function blank(name: string): boolean {
  return name.trim().length === 0;
}

// tree 페이지는 rootType/nodeCount 를 낸다(§5); tsx 페이지는 kind 만.
type CreatePageResult = {
  pageId: string;
  name: string;
  kind: PageKind;
  rootType?: string;
  nodeCount?: number;
};

// template.apply 두 경로(생성·덮어쓰기)의 공통 데이터 레코드(§5). origin = 유래 templateId.
type TsxPageResult = { pageId: string; name: string; kind: "tsx"; origin: string };

// page.create — kind(기본 tree)의 빈 페이지를 만든다(§5). tree → bare Stack 루트, tsx → 씨앗 코드.
// template 씨앗은 template.apply 소관(§13) — page.create 는 template 파라미터를 받지 않는다.
export function createPage(
  doc: DesignDoc,
  params: { name: string; kind?: string },
): CreatePageResult | Err {
  if (blank(params.name)) return err("INVALID_ARG", "이름이 비어 있음.");
  const kind = params.kind ?? "tree";
  if (kind !== "tree" && kind !== "tsx") {
    return err("INVALID_ARG", `kind '${String(params.kind)}' 는 tree 또는 tsx 여야 함.`);
  }
  const pageId = nextPageId(doc); // 페이지 id 를 노드 id 보다 먼저 발급(seq 순서, §2).
  if (kind === "tsx") {
    doc.pages.push({ id: pageId, name: params.name, source: { kind: "tsx", code: STARTER_TSX } });
    return { pageId, name: params.name, kind: "tsx" };
  }
  const root = makeNode(doc, "Stack");
  doc.pages.push({ id: pageId, name: params.name, source: { kind: "tree", root } });
  return { pageId, name: params.name, kind: "tree", rootType: root.type, nodeCount: countNodes(root) };
}

export function renamePage(
  doc: DesignDoc,
  params: Record<string, unknown>,
): { pageId: string; name: string } | Err {
  const name = readStr(params, "name") ?? "";
  if (blank(name)) return err("INVALID_ARG", "이름이 비어 있음.");
  const pageId = readStr(params, "pageId") ?? "";
  const page = doc.pages.find((p) => p.id === pageId);
  if (!page) return err("NOT_FOUND", `페이지 '${pageId}' 없음.`);
  page.name = name;
  return { pageId: page.id, name: page.name };
}

// 페이지 깊은 복제 — 새 페이지 id. tree 는 새 노드 id 전량, tsx 는 code(+origin) 그대로(§2 Id 생성).
// 기본 새 이름 = "{원본} copy". nodeCount 는 tree=노드수, tsx=0(노드 없음).
export function duplicatePage(
  doc: DesignDoc,
  params: Record<string, unknown>,
): { pageId: string; name: string; nodeCount: number } | Err {
  const pageId = readStr(params, "pageId") ?? "";
  const src = doc.pages.find((p) => p.id === pageId);
  if (!src) return err("NOT_FOUND", `페이지 '${pageId}' 없음.`);
  const newPageId = nextPageId(doc); // 페이지 id 먼저(노드 id 는 클론에서 그 뒤에, §2).
  const given = readStr(params, "name");
  const name = given !== undefined ? given : `${src.name} copy`;
  let source: PageSource;
  let nodeCount: number;
  if (src.source.kind === "tree") {
    const root = cloneWithFreshIds(doc, src.source.root);
    source = { kind: "tree", root };
    nodeCount = countNodes(root);
  } else {
    source =
      src.source.origin !== undefined
        ? { kind: "tsx", code: src.source.code, origin: src.source.origin }
        : { kind: "tsx", code: src.source.code };
    nodeCount = 0;
  }
  doc.pages.push({ id: newPageId, name, source });
  return { pageId: newPageId, name, nodeCount };
}

// 페이지 삭제 — 문서는 0개 페이지도 허용. 종류 무관.
export function removePage(
  doc: DesignDoc,
  params: Record<string, unknown>,
): { removedId: string } | Err {
  const pageId = readStr(params, "pageId") ?? "";
  const idx = doc.pages.findIndex((p) => p.id === pageId);
  if (idx < 0) return err("NOT_FOUND", `페이지 '${pageId}' 없음.`);
  doc.pages.splice(idx, 1);
  return { removedId: pageId };
}

// template.apply(pageId 무): 템플릿 verbatim code 로 새 tsx 페이지 생성(§5·§13). origin=templateId.
// 템플릿 해소·available 검사(TEMPLATE_UNKNOWN/UNAVAILABLE)는 명령 계층 소관 — 여기 오는 code 는 렌더 가능분.
export function createTsxPage(
  doc: DesignDoc,
  params: { name: string; code: string; origin: string },
): TsxPageResult | Err {
  const pageId = nextPageId(doc);
  doc.pages.push({
    id: pageId,
    name: params.name,
    source: { kind: "tsx", code: params.code, origin: params.origin },
  });
  return { pageId, name: params.name, kind: "tsx", origin: params.origin };
}

// template.apply(pageId 유): 기존 페이지의 source 를 tsx 로 덮어쓴다(§5 — 대상 종류 무관, source 교체).
// tree→tsx in-place 변환 금지는 page.code.set 에만 적용된다(그건 이미 tsx 여야 함); template.apply 는 덮어쓴다.
export function applyTsxSource(
  doc: DesignDoc,
  params: { pageId: string; code: string; origin: string },
): TsxPageResult | Err {
  const page = doc.pages.find((p) => p.id === params.pageId);
  if (!page) return err("NOT_FOUND", `페이지 '${params.pageId}' 없음.`);
  page.source = { kind: "tsx", code: params.code, origin: params.origin };
  return { pageId: page.id, name: page.name, kind: "tsx", origin: params.origin };
}

// page.code.get — tsx 페이지의 code(+origin). tree 페이지면 INVALID_TARGET(종류 게이트, §2).
export function getPageCode(
  doc: DesignDoc,
  params: Record<string, unknown>,
): { pageId: string; code: string; origin?: string } | Err {
  const pageId = readStr(params, "pageId") ?? "";
  const page = doc.pages.find((p) => p.id === pageId);
  if (!page) return err("NOT_FOUND", `페이지 '${pageId}' 없음.`);
  const src = requireTsxSource(page);
  if (isErr(src)) return src;
  return src.origin !== undefined
    ? { pageId: page.id, code: src.code, origin: src.origin }
    : { pageId: page.id, code: src.code };
}

// page.code.set — tsx 페이지의 code 를 통째 교체(기존 origin 보존). 순수 mutation 만:
// NOT_FOUND → INVALID_TARGET(tree 페이지) → INVALID_ARG(빈 코드) → 설정. COMPILE_FAILED(sucrase)는
// 명령 계층의 게이트라 여기 없다(§5·§7). 명령 계층은 이 함수 호출 전에 code 를 컴파일해 거른다.
export function setPageCode(
  doc: DesignDoc,
  params: Record<string, unknown>,
): { pageId: string; bytes: number } | Err {
  const pageId = readStr(params, "pageId") ?? "";
  const page = doc.pages.find((p) => p.id === pageId);
  if (!page) return err("NOT_FOUND", `페이지 '${pageId}' 없음.`);
  const cur = requireTsxSource(page); // tree 페이지면 INVALID_TARGET(§2).
  if (isErr(cur)) return cur;
  const code = readStr(params, "code") ?? "";
  if (blank(code)) return err("INVALID_ARG", "코드가 비어 있음.");
  page.source =
    cur.origin !== undefined ? { kind: "tsx", code, origin: cur.origin } : { kind: "tsx", code };
  return { pageId: page.id, bytes: code.length };
}
