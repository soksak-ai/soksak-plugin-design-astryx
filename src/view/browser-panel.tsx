// 발견 패널(browse + search) — Meta PreviewShell 의 CommandPalette 마운트(PreviewShell.tsx:376-484)와 사이드
// 트리(navTree)를 우리 명령 버스로 배선한 얇은 React 컴포넌트. 순수 판정은 전부 browser.ts 가 소유하고
// 여기는 팔레트 open 상태와 execute 라우팅만 든다. 라우터가 없어 Meta 의 router.push 를 resolveDispatch→
// execute 로 대체한다: 트리 리프 클릭·팔레트 선택 = 명령 발행(§7 All-elements clause).
import { useMemo, useState, type ReactElement } from "react";
import { Button, CommandPalette, TreeList, createStaticSource } from "@astryxdesign/core";
import type { ExecuteCommand } from "./model";
import {
  buildDiscoveryTree,
  buildPaletteItems,
  resolveDispatch,
  type ComponentRef,
  type DispatchContext,
  type PaletteItem,
  type TemplateRef,
} from "./browser";

export interface BrowserPanelProps {
  templates: readonly TemplateRef[]; // available page+block 요약(패널 글루가 templates 모듈에서 낮춘다).
  components: readonly ComponentRef[]; // 카탈로그 컴포넌트(type·group·description).
  activeId: string | null; // 현재 적용된 템플릿 origin(pathname 대체) — 트리 하이라이트.
  dispatchCtx: DispatchContext; // comp.add 대상 해소(활성 tree 페이지·선택 노드).
  execute: ExecuteCommand;
}

// 팔레트 항목 렌더(Meta PreviewShell.tsx:467-483 포팅) — 라벨 + 있으면 보조 설명 행.
function renderItem(item: { label: string; auxiliaryData?: unknown }, isSelected: boolean): ReactElement {
  const desc = (item.auxiliaryData as { description?: string } | undefined)?.description;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "2px 0", fontWeight: isSelected ? 600 : 400 }}>
      <span>{item.label}</span>
      {desc ? <span style={{ fontSize: 12, opacity: 0.6 }}>{desc}</span> : null}
    </div>
  );
}

export function BrowserPanel({
  templates,
  components,
  activeId,
  dispatchCtx,
  execute,
}: BrowserPanelProps): ReactElement {
  const [paletteOpen, setPaletteOpen] = useState(false);

  // 트리 리프 클릭 = template.apply(browser.ts 의 두-루트 트리가 이 콜백을 리프에 심는다).
  // 메모이즈 — 619 항목 트리를 매 notify 마다 재생성하면 느리다. templates·activeId 가 바뀔 때만 재빌드
  // (execute 는 안정 prop). 팔레트 소스와 동일 정책.
  const tree = useMemo(
    () => buildDiscoveryTree(templates, activeId, (id) => void execute("template.apply", { id })),
    [templates, activeId, execute],
  );

  // 팔레트 검색 소스(Meta createStaticSource) — 컴포넌트 + 템플릿. 입력이 안 바뀌면 재생성 안 함.
  const searchSource = useMemo(() => {
    const items: PaletteItem[] = buildPaletteItems(components, templates);
    return createStaticSource(items);
  }, [components, templates]);

  // 팔레트 선택 = resolveDispatch 로 명령 낮춤(컴포넌트→comp.add, 템플릿→template.apply). 붙일 표면이 없는
  // 컴포넌트 선택은 null → no-op(패널이 트리로 이미 안내). 어느 경우든 팔레트를 닫는다.
  function onValueChange(value: string): void {
    const cmd = resolveDispatch(value, dispatchCtx);
    if (cmd) void execute(cmd.name, cmd.params);
    setPaletteOpen(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 4px 8px" }}>
        <span style={{ font: "600 12px system-ui, sans-serif", opacity: 0.7 }}>발견</span>
        <Button
          label="검색"
          data-node="search"
          size="sm"
          variant="secondary"
          onClick={() => setPaletteOpen(true)}
          data-testid="browser-search"
        />
      </div>

      <CommandPalette
        isOpen={paletteOpen}
        onOpenChange={setPaletteOpen}
        searchSource={searchSource}
        label="컴포넌트·템플릿 검색"
        onValueChange={onValueChange}
        width={480}
        renderItem={renderItem}
      />

      <TreeList density="compact" items={tree} data-testid="discovery-tree" />
    </div>
  );
}
