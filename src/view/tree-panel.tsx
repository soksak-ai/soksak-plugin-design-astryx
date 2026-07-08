// 구조 + 발견 패널(§7 Chrome law·Selection law) — 한 사이드 패널에 세 표면을 얹는다: (1) Current Page =
// 활성 페이지 노드 트리(구조 편집·선택, 기존 buildStructureItems), (2)(3) Templates·Components 발견 트리 +
// 검색 팔레트(browser-panel 이 소유). Meta PreviewShell 은 두 발견 루트(Pages·Components)만 뒀지만 우리는
// 편집 표면(Current Page)이 있어 세 번째 섹션으로 함께 둔다. 노드 클릭 = canvas.select(세 진입점 수렴,
// 스토어 직접 변이 금지 §7); 발견 리프·팔레트 = template.apply/comp.add(browser-panel 이 라우팅).
import type { ReactElement } from "react";
import { TreeList } from "@astryxdesign/core";
import type { DesignNode, DesignPage, Selection } from "../types";
import { listTemplates } from "../templates";
import * as catalog from "../catalog";
import type { ExecuteCommand } from "./model";
import { BrowserPanel } from "./browser-panel";
import {
  toComponentRef,
  type ComponentRef,
  type DispatchContext,
  type NavItem,
  type TemplateRef,
} from "./browser";

// 활성 페이지에 유효한 선택 노드(순수, §7 Selection law) — 선택이 활성 페이지에 속할 때만 그 nodeId,
// 아니면 null. 스토어가 persist 시 죽은 노드를 정리하므로(reconcileSelection) 여기선 페이지 소속만 본다.
// 뷰는 이 값으로 트리·캔버스를 하이라이트하고 인스펙터가 바인딩한다(세 표면 한 선택).
export function activeSelectedNodeId(
  selection: Selection | null | undefined,
  activePageId: string | null,
): string | null {
  if (!selection || !activePageId) return null;
  return selection.pageId === activePageId ? selection.nodeId : null;
}

// tsx 페이지의 단일 코드 행 id(고정) — 실제 노드 id 가 아니라 표시용 안내 행. 클릭 불가(읽기 전용).
export const TSX_ROW_ID = "__tsx_code__";
// 페이지 없음 안내 행 id(Current Page 루트 아래) — 빈 화면 대신 담백한 한 행.
export const NO_PAGE_ROW_ID = "__no_page__";

// 문자열 절단(순수) — prop 힌트가 트리 행을 넘치지 않게.
function truncate(s: string, n = 24): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

// 노드의 짧은 prop 힌트(순수) — variant 와 라벨/텍스트만 골라 한 줄로. 없으면 빈 문자열(설명 생략).
// 인스펙터가 전체 prop 폼을 소유하므로 여기선 식별에 족한 한두 단서만 준다(§7 Inspector law 와 역할 분리).
export function propHint(node: DesignNode): string {
  const p = node.props;
  const bits: string[] = [];
  const variant = p.variant;
  if (typeof variant === "string" && variant) bits.push(variant);
  const label = typeof p.label === "string" && p.label ? p.label : "";
  const text = label || (typeof p.children === "string" ? p.children : "");
  if (text) bits.push(`"${truncate(text)}"`);
  return bits.join(" · ");
}

// 페이지 → TreeList items 투영(순수, §7). 트리 페이지는 root 부터 재귀; tsx 페이지는 코드 안내 한 행;
// 페이지 없음은 빈 배열. selNodeId 는 하이라이트할 노드(활성 페이지에 속한 선택). onSelect 는 노드 클릭
// 진입점 — 호출부(TreePanel)가 canvas.select 로 잇는다. 항상 펼침(isExpanded=true)으로 전체 구조를 보인다.
export function buildStructureItems(
  page: DesignPage | null,
  selNodeId: string | null,
  onSelect: (nodeId: string) => void,
): NavItem[] {
  if (!page) return [];
  if (page.source.kind === "tsx") {
    return [
      {
        id: TSX_ROW_ID,
        label: "⌁ code",
        description: "읽기 전용 — page.code.get / page.code.set",
        isDisabled: true,
      },
    ];
  }
  const walk = (node: DesignNode): NavItem => {
    const hint = propHint(node);
    return {
      id: node.id,
      label: node.type,
      description: hint || undefined,
      isSelected: node.id === selNodeId,
      isExpanded: true,
      onClick: () => onSelect(node.id),
      children: node.children.length > 0 ? node.children.map(walk) : undefined,
    };
  };
  return [walk(page.source.root)];
}

// Current Page 루트(순수) — 활성 페이지 구조를 한 루트 아래로 묶는다(발견 루트와 나란한 세 번째 섹션).
// 페이지가 없으면 담백한 안내 한 행(빈 화면 금지). 항상 펼침.
export function buildCurrentPageRoot(
  page: DesignPage | null,
  selNodeId: string | null,
  onSelect: (nodeId: string) => void,
): NavItem {
  const items = buildStructureItems(page, selNodeId, onSelect);
  return {
    id: "current-page",
    label: page ? `Current Page — ${page.name}` : "Current Page",
    isExpanded: true,
    children:
      items.length > 0
        ? items
        : [{ id: NO_PAGE_ROW_ID, label: "페이지가 없습니다.", isDisabled: true }],
  };
}

// 활성 템플릿 id(순수) — Meta pathname 대체. 적용된 tsx 페이지의 origin 이 곧 현재 보는 템플릿이다
// (template.apply 가 origin 을 기록). tree 페이지·origin 없음은 null(하이라이트 없음).
export function activeTemplateId(page: DesignPage | null): string | null {
  if (page && page.source.kind === "tsx") return page.source.origin ?? null;
  return null;
}

// 발견 데이터 글루 — 빌드 define(templates/catalog)에서 browser.ts 빌더 입력으로 낮춘다. define 없는
// 환경(vitest)에선 빈 목록으로 폴백한다(모듈 typeof 가드) — 순수 빌더 검증은 browser.test 가 실데이터로 친다.
function defaultTemplates(): TemplateRef[] {
  return listTemplates().templates.map((t) => ({
    id: t.id,
    kind: t.kind,
    name: t.name,
    available: t.available,
  }));
}
function defaultComponents(): ComponentRef[] {
  return catalog.types().map((type) => toComponentRef(type, catalog.getEntry(type)));
}

export interface TreePanelProps {
  page: DesignPage | null;
  selectedNodeId: string | null;
  execute: ExecuteCommand;
  templates?: readonly TemplateRef[]; // 발견 데이터(생략 시 빌드 define 에서). 테스트가 명시 주입.
  components?: readonly ComponentRef[];
}

// 구조 + 발견 패널 컴포넌트 — Current Page 구조 트리(노드 클릭 → canvas.select)와 발견 패널(Templates·
// Components + 검색)을 세로로 얹는다. 발견 라우팅(template.apply/comp.add)은 browser-panel 소유.
export function TreePanel({
  page,
  selectedNodeId,
  execute,
  templates,
  components,
}: TreePanelProps): ReactElement {
  const currentPageRoot = buildCurrentPageRoot(page, selectedNodeId, (nodeId) => {
    if (page) void execute("canvas.select", { pageId: page.id, nodeId });
  });

  const dispatchCtx: DispatchContext = {
    activeTreePageId: page && page.source.kind === "tree" ? page.id : null,
    selectedNodeId,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
      <TreeList density="compact" items={[currentPageRoot]} data-testid="structure-tree" />
      <BrowserPanel
        templates={templates ?? defaultTemplates()}
        components={components ?? defaultComponents()}
        activeId={activeTemplateId(page)}
        dispatchCtx={dispatchCtx}
        execute={execute}
      />
    </div>
  );
}
