// 구조 패널(§7 Chrome law·Selection law) — 활성 페이지의 노드 트리를 astryx TreeList 로 투영한다.
// 트리 페이지: source.root 를 재귀로 낮춰 노드마다 한 행(type + 짧은 prop 힌트). tsx 페이지: 노드가
// 없으니(§2) '⌁ code' 한 행(읽기 전용 안내). 노드 클릭 = canvas.select 명령(세 진입점 수렴, 스토어 직접
// 변이 금지 §7). 선택은 isSelected 로 하이라이트한다 — 캔버스 아웃라인과 같은 selection 필드가 진실.
import type { ReactElement } from "react";
import { TreeList } from "@astryxdesign/core";
import type { DesignNode, DesignPage, Selection } from "../types";
import type { ExecuteCommand } from "./model";

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

// TreeList items 의 구조적 부분집합(TreeListItemData 가 배럴 미export 라 우리가 쓰는 필드만 선언).
// 구조적 호환이라 TreeList 의 items 로 그대로 넘어간다. children 재귀로 트리 깊이를 담는다.
export interface StructureItem {
  id: string;
  label: string;
  description?: string;
  isSelected?: boolean;
  isExpanded?: boolean;
  isDisabled?: boolean;
  onClick?: () => void;
  children?: StructureItem[];
}

// tsx 페이지의 단일 코드 행 id(고정) — 실제 노드 id 가 아니라 표시용 안내 행. 클릭 불가(읽기 전용).
export const TSX_ROW_ID = "__tsx_code__";

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
): StructureItem[] {
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
  const walk = (node: DesignNode): StructureItem => {
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

export interface TreePanelProps {
  page: DesignPage | null;
  selectedNodeId: string | null;
  execute: ExecuteCommand;
}

// 구조 패널 컴포넌트 — 노드 클릭을 canvas.select 로 잇고(§7 All-elements clause), TreeList 로 그린다.
// 페이지가 없으면 담백한 안내(빈 화면 금지). 헤드리스에서도 같은 selection 필드가 진실이라 클릭·명령이 수렴.
export function TreePanel({ page, selectedNodeId, execute }: TreePanelProps): ReactElement {
  const items = buildStructureItems(page, selectedNodeId, (nodeId) => {
    if (page) void execute("canvas.select", { pageId: page.id, nodeId });
  });

  if (items.length === 0) {
    return (
      <div style={{ font: "12px/1.5 system-ui, sans-serif", opacity: 0.6, padding: 8 }}>
        페이지가 없습니다.
      </div>
    );
  }

  return (
    <TreeList
      density="compact"
      items={items}
      data-testid="structure-tree"
    />
  );
}
