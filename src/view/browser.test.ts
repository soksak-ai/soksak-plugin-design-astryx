// 발견 순수 빌더 검증 — Meta buildNavTree 포팅(browser.ts)이 우리 데이터에서 두-루트 트리·팔레트 항목·명령
// dispatch 를 정확히 낮추는지 친다. 라우터 없는 적응(activeId·execute)이 pathname·router.push 를 대체함을 못박는다.
import { describe, it, expect, vi } from "vitest";
import type { CatalogEntry } from "../types";
import {
  componentFolder,
  shortBlockName,
  buildTemplatesRoot,
  buildComponentsRoot,
  buildDiscoveryTree,
  buildPaletteItems,
  resolveDispatch,
  toComponentRef,
  COMPONENT_ID_PREFIX,
  type TemplateRef,
  type ComponentRef,
} from "./browser";

const page = (id: string, name: string, available = true): TemplateRef => ({ id, kind: "page", name, available });
const block = (id: string, name: string, available = true): TemplateRef => ({ id, kind: "block", name, available });

const SAMPLE: TemplateRef[] = [
  page("pages/dashboard", "Dashboard"),
  page("pages/blank", "Blank"),
  page("pages/hidden", "Hidden", false),
  block("blocks/components/AlertDialog/AlertDialogAsyncAction", "Alert Dialog Async Action"),
  block("blocks/components/AlertDialog/AlertDialogDeleteConfirmation", "Alert Dialog Delete Confirmation"),
  block("blocks/components/AppShell/AppShellContentOnly", "App Shell Content Only"),
  block("blocks/components/Button/ButtonOff", "Button Off", false),
];

describe("componentFolder", () => {
  it("block id 의 [2] 세그먼트(Meta b.component 동치)", () => {
    expect(componentFolder("blocks/components/AlertDialog/AlertDialogAsyncAction")).toBe("AlertDialog");
  });
  it("폴더 없는 id(page)는 빈 문자열", () => {
    expect(componentFolder("pages/dashboard")).toBe("");
  });
});

describe("shortBlockName", () => {
  it("그룹명(띄어쓴 형태) 접두를 벗겨 변형만 남긴다", () => {
    expect(shortBlockName("Alert Dialog Async Action", "AlertDialog")).toBe("Async Action");
    expect(shortBlockName("App Shell Content Only", "AppShell")).toBe("Content Only");
  });
  it("접두가 없으면 원본 그대로", () => {
    expect(shortBlockName("Standalone Widget", "AlertDialog")).toBe("Standalone Widget");
  });
});

describe("buildTemplatesRoot", () => {
  it("page & available 만 평평한 한 행씩, 항상 펼침", () => {
    const root = buildTemplatesRoot(SAMPLE, null, () => {});
    expect(root.id).toBe("templates");
    expect(root.label).toBe("Templates");
    expect(root.isExpanded).toBe(true);
    expect(root.children!.map((c) => c.id)).toEqual(["pages/dashboard", "pages/blank"]); // hidden 제외.
    expect(root.children![0].label).toBe("Dashboard");
  });
  it("activeId 로 그 행만 isSelected", () => {
    const root = buildTemplatesRoot(SAMPLE, "pages/blank", () => {});
    expect(root.children![0].isSelected).toBe(false);
    expect(root.children![1].isSelected).toBe(true);
  });
  it("리프 클릭 → onApply(id)", () => {
    const onApply = vi.fn();
    const root = buildTemplatesRoot(SAMPLE, null, onApply);
    root.children![0].onClick!();
    expect(onApply).toHaveBeenCalledWith("pages/dashboard");
  });
});

describe("buildComponentsRoot", () => {
  it("block 을 컴포넌트 폴더로 묶고 localeCompare 정렬", () => {
    const root = buildComponentsRoot(SAMPLE, null, () => {});
    expect(root.id).toBe("components");
    expect(root.children!.map((g) => g.id)).toEqual(["component-AlertDialog", "component-AppShell"]); // Button 은 unavailable.
    const alert = root.children![0];
    expect(alert.label).toBe("AlertDialog");
    expect(alert.children!.map((c) => c.label)).toEqual(["Async Action", "Delete Confirmation"]);
  });
  it("리프 클릭 → onApply(block id)", () => {
    const onApply = vi.fn();
    const root = buildComponentsRoot(SAMPLE, null, onApply);
    root.children![0].children![0].onClick!();
    expect(onApply).toHaveBeenCalledWith("blocks/components/AlertDialog/AlertDialogAsyncAction");
  });
  it("활성 자식이 있는 그룹만 펼침", () => {
    const active = "blocks/components/AppShell/AppShellContentOnly";
    const root = buildComponentsRoot(SAMPLE, active, () => {});
    const [alert, appShell] = root.children!;
    expect(alert.isExpanded).toBe(false);
    expect(appShell.isExpanded).toBe(true);
    expect(appShell.children![0].isSelected).toBe(true);
  });
});

describe("buildDiscoveryTree", () => {
  it("두 루트(Templates·Components) — Meta 두-루트 반환 포팅", () => {
    const tree = buildDiscoveryTree(SAMPLE, null, () => {});
    expect(tree.map((r) => r.id)).toEqual(["templates", "components"]);
  });
});

describe("buildPaletteItems", () => {
  const components: ComponentRef[] = [
    { type: "Button", group: "Button", description: "A button." },
    { type: "AlertDialog", group: "Dialog", description: "Confirm destructive actions." },
  ];
  it("컴포넌트는 'component:'+type, group·description 을 auxiliaryData 로", () => {
    const items = buildPaletteItems(components, []);
    expect(items[0]).toEqual({
      id: "component:Button",
      label: "Button",
      auxiliaryData: { group: "Button", description: "A button." },
    });
  });
  it("템플릿은 id/name, page→group 'Pages', block→폴더, description=id", () => {
    const items = buildPaletteItems([], SAMPLE);
    const dash = items.find((i) => i.id === "pages/dashboard")!;
    expect(dash.auxiliaryData).toEqual({ group: "Pages", description: "pages/dashboard" });
    const blk = items.find((i) => i.id === "blocks/components/AlertDialog/AlertDialogAsyncAction")!;
    expect(blk.auxiliaryData).toEqual({
      group: "AlertDialog",
      description: "blocks/components/AlertDialog/AlertDialogAsyncAction",
    });
  });
  it("unavailable 템플릿은 팔레트에서 제외", () => {
    const items = buildPaletteItems([], SAMPLE);
    expect(items.find((i) => i.id === "pages/hidden")).toBeUndefined();
  });
  it("group 없는 컴포넌트는 'Components' 폴백", () => {
    const items = buildPaletteItems([{ type: "Mystery" }], []);
    expect(items[0].auxiliaryData.group).toBe("Components");
  });
});

describe("resolveDispatch", () => {
  it("템플릿 id → template.apply{id}", () => {
    expect(resolveDispatch("pages/dashboard", { activeTreePageId: null, selectedNodeId: null })).toEqual({
      name: "template.apply",
      params: { id: "pages/dashboard" },
    });
  });
  it("컴포넌트 + 활성 tree 페이지 → comp.add{pageId,type}(선택 없으면 parentId 생략)", () => {
    expect(
      resolveDispatch(`${COMPONENT_ID_PREFIX}Button`, { activeTreePageId: "p1", selectedNodeId: null }),
    ).toEqual({ name: "comp.add", params: { pageId: "p1", type: "Button" } });
  });
  it("컴포넌트 + 선택 노드 → parentId 실림", () => {
    expect(
      resolveDispatch(`${COMPONENT_ID_PREFIX}Text`, { activeTreePageId: "p1", selectedNodeId: "n5" }),
    ).toEqual({ name: "comp.add", params: { pageId: "p1", type: "Text", parentId: "n5" } });
  });
  it("컴포넌트 + 활성 tree 페이지 없음 → null(붙일 표면 없음)", () => {
    expect(
      resolveDispatch(`${COMPONENT_ID_PREFIX}Button`, { activeTreePageId: null, selectedNodeId: null }),
    ).toBeNull();
  });
});

describe("toComponentRef", () => {
  it("엔트리의 group(타입 미표기)·description 을 방어적으로 읽는다", () => {
    const entry = { type: "Button", group: "Button", description: "A button." } as unknown as CatalogEntry;
    expect(toComponentRef("Button", entry)).toEqual({ type: "Button", group: "Button", description: "A button." });
  });
  it("엔트리 없음 → group/description undefined", () => {
    expect(toComponentRef("Ghost", undefined)).toEqual({ type: "Ghost", group: undefined, description: undefined });
  });
});
