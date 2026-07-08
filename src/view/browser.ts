// 발견(browse + search) 순수 빌더 — Meta 원본 PreviewShell.buildNavTree(apps/sandbox/.../PreviewShell.tsx:28-80)
// 를 우리 데이터(templates.json·catalog.json)로 포팅한다. 원본은 Next 라우터를 쓴다(pathname 로 선택 판정,
// router.push(href)/as={Link} 로 이동). 우리는 shadow 뷰라 라우터가 없다 — pathname 대신 view-local activeId
// (현재 적용된 템플릿 origin), href 이동 대신 명령 버스 execute 발행으로 대체한다. 트리/팔레트 선택 = execute.
import type { CatalogEntry, TemplateKind } from "../types";

// TreeList items 의 구조적 부분집합(배럴이 TreeListItemData 를 미export). tree-panel 도 같은 형상을 쓰므로
// (한 TreeList 로 흐른다) 이 타입을 단일 진실로 둔다 — inline 재정의 금지. children 재귀로 트리 깊이.
export interface NavItem {
  id: string;
  label: string;
  description?: string;
  isSelected?: boolean;
  isExpanded?: boolean;
  isDisabled?: boolean;
  onClick?: () => void;
  children?: NavItem[];
}

// 빌더 입력의 최소 형상 — 전체 TemplateEntry/CatalogEntry 를 요구하지 않아(code 본문 등 불필요) 순수
// 테스트가 작은 객체로 검증한다. 패널 글루가 templates.listTemplates()/catalog 에서 이 형상으로 낮춘다.
export interface TemplateRef {
  id: string;
  kind: TemplateKind;
  name: string;
  available: boolean;
}
export interface ComponentRef {
  type: string;
  group?: string;
  description?: string;
}

// block 템플릿 id 의 컴포넌트 폴더 = id.split('/')[2] (Meta 의 b.component 그룹핑과 동치). 예:
// "blocks/components/AlertDialog/AlertDialogAsyncAction" → "AlertDialog". 폴더가 없으면 빈 문자열.
export function componentFolder(id: string): string {
  return id.split("/")[2] ?? "";
}

// 리프 라벨 — 그룹(컴포넌트)명이 이미 상위 노드라 리프는 변형만 남긴다(Meta PreviewShell.tsx:46-48 은 이름의
// em-dash 앞 컴포넌트 접두를 벗김). 우리 이름은 대시가 없고 컴포넌트명을 띄어쓴 접두로 반복하므로
// ("Alert Dialog Async Action" under "AlertDialog"), 그룹명을 띄어쓴 형태를 접두에서 벗겨 같은 결과("Async
// Action")를 낸다. 접두가 없으면 원본 그대로.
export function shortBlockName(name: string, group: string): string {
  const spaced = group.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return name.startsWith(spaced + " ") ? name.slice(spaced.length + 1) : name;
}

// Templates 루트(순수) — page 종류 & available 템플릿을 평평한 한 행씩(id·이름). 클릭=onApply(id) →
// template.apply(호출부가 잇는다). activeId 와 일치하면 isSelected. Meta buildNavTree:31-36 의 pageItems 포팅.
export function buildTemplatesRoot(
  templates: readonly TemplateRef[],
  activeId: string | null,
  onApply: (id: string) => void,
): NavItem {
  const children: NavItem[] = templates
    .filter((t) => t.kind === "page" && t.available)
    .map((t) => ({
      id: t.id,
      label: t.name,
      isSelected: t.id === activeId,
      onClick: () => onApply(t.id),
    }));
  return { id: "templates", label: "Templates", children, isExpanded: true };
}

// Components 루트(순수) — block & available 템플릿을 컴포넌트 폴더로 묶는다(Meta buildNavTree:38-64 그대로).
// 그룹 노드=폴더명, 리프=짧은 이름. 클릭=onApply(id)(block 도 적용 가능한 템플릿). 그룹은 localeCompare
// 정렬, 활성 자식이 있으면 펼침. 폴더 없는 id(page 등)는 걸러진다.
export function buildComponentsRoot(
  templates: readonly TemplateRef[],
  activeId: string | null,
  onApply: (id: string) => void,
): NavItem {
  const groups = new Map<string, NavItem[]>();
  for (const t of templates) {
    if (t.kind !== "block" || !t.available) continue;
    const group = componentFolder(t.id);
    if (!group) continue;
    let items = groups.get(group);
    if (!items) {
      items = [];
      groups.set(group, items);
    }
    items.push({
      id: t.id,
      label: shortBlockName(t.name, group),
      isSelected: t.id === activeId,
      onClick: () => onApply(t.id),
    });
  }
  const children: NavItem[] = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, items]) => ({
      id: `component-${name}`,
      label: name,
      children: items,
      isExpanded: items.some((i) => i.isSelected),
    }));
  return { id: "components", label: "Components", children, isExpanded: true };
}

// 발견 트리(순수) — Meta buildNavTree 의 두-루트 반환(Pages+Components)을 우리 이름(Templates+Components)으로
// 포팅. 구조 편집(Current Page)은 tree-panel 이 세 번째 루트로 얹는다.
export function buildDiscoveryTree(
  templates: readonly TemplateRef[],
  activeId: string | null,
  onApply: (id: string) => void,
): NavItem[] {
  return [
    buildTemplatesRoot(templates, activeId, onApply),
    buildComponentsRoot(templates, activeId, onApply),
  ];
}

// 컴포넌트 id 접두 — 팔레트 항목 id 의 컴포넌트/템플릿 구분자. 템플릿 id 는 접두 없이 t.id 그대로라 충돌 없음.
export const COMPONENT_ID_PREFIX = "component:";

// 팔레트 검색 항목 — createStaticSource(items) 로 감싼다(Meta PreviewShell.tsx:376-385 searchSource 포팅).
// group 은 부제/필터, description 은 보조 행. auxiliaryData 형상은 renderItem 이 소비한다.
export interface PaletteItem {
  id: string;
  label: string;
  auxiliaryData: { group: string; description: string };
}

// 팔레트 항목 빌더(순수) — 카탈로그 컴포넌트(id='component:'+type) + available 템플릿(id=t.id). page 템플릿
// group='Pages', block 은 컴포넌트 폴더. description = 컴포넌트는 설명문, 템플릿은 id(경로).
export function buildPaletteItems(
  components: readonly ComponentRef[],
  templates: readonly TemplateRef[],
): PaletteItem[] {
  const compItems: PaletteItem[] = components.map((c) => ({
    id: `${COMPONENT_ID_PREFIX}${c.type}`,
    label: c.type,
    auxiliaryData: { group: c.group ?? "Components", description: c.description ?? "" },
  }));
  const tplItems: PaletteItem[] = templates
    .filter((t) => t.available)
    .map((t) => ({
      id: t.id,
      label: t.name,
      auxiliaryData: {
        group: t.kind === "page" ? "Pages" : componentFolder(t.id) || "Components",
        description: t.id,
      },
    }));
  return [...compItems, ...tplItems];
}

// 선택 시점의 뷰 상태(순수 dispatch 입력) — comp.add 대상 해소용. activeTreePageId 는 활성 페이지가 tree
// 종류일 때만 그 id(아니면 null: 컴포넌트를 붙일 곳이 없음). selectedNodeId 는 comp.add 의 parent(없으면 루트).
export interface DispatchContext {
  activeTreePageId: string | null;
  selectedNodeId: string | null;
}

// 발행 명령(순수). Meta 는 selection 을 router.push 로 낮췄다 — 우리는 명령으로 낮춘다:
//  - 템플릿 id(page/block) → template.apply{id}.
//  - 컴포넌트 id('component:'+type) → 활성 tree 페이지가 있으면 comp.add{pageId,type,parentId?}, 없으면
//    붙일 표면이 없어 null(패널이 안내). parentId 는 선택 노드가 있을 때만 실어 루트 append 를 기본으로.
export function resolveDispatch(
  id: string,
  ctx: DispatchContext,
): { name: string; params: Record<string, unknown> } | null {
  if (id.startsWith(COMPONENT_ID_PREFIX)) {
    const type = id.slice(COMPONENT_ID_PREFIX.length);
    if (!ctx.activeTreePageId) return null;
    const params: Record<string, unknown> = { pageId: ctx.activeTreePageId, type };
    if (ctx.selectedNodeId) params.parentId = ctx.selectedNodeId;
    return { name: "comp.add", params };
  }
  return { name: "template.apply", params: { id } };
}

// CatalogEntry → ComponentRef(글루) — types.CatalogEntry 는 group 을 타입에 안 싣지만(생성 JSON 엔 존재)
// 방어적으로 읽어 팔레트 group 을 채운다. description 은 엔트리에 있다.
export function toComponentRef(type: string, entry: CatalogEntry | undefined): ComponentRef {
  const group = (entry as unknown as { group?: string } | undefined)?.group;
  return { type, group, description: entry?.description };
}
