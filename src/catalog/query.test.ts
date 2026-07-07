import { describe, it, expect } from "vitest";
import type { Catalog } from "../types";
import {
  listCatalog,
  catalogDoc,
  getEntry,
  hasType,
  acceptsChildren,
  propCount,
  entryGroup,
} from "./query";

// 순수 로직 검증용 인메모리 카탈로그(로더 무관). group 은 확장 필드로 심어둔다.
const catalog = {
  Stack: {
    type: "Stack",
    importName: "Stack",
    description: "Stack arranges items in a row or column.",
    group: "Layout",
    props: { direction: { type: "StackDirection", required: false, description: "방향." }, children: { type: "ReactNode", required: false, description: "자식." } },
    acceptsChildren: true,
  },
  Grid: {
    type: "Grid",
    importName: "Grid",
    description: "Grid lays out items on a two-dimensional grid.",
    group: "Layout",
    props: { columns: { type: "number", required: false, description: "열." } },
    acceptsChildren: true,
  },
  Badge: {
    type: "Badge",
    importName: "Badge",
    description: "Badge shows a small status label.",
    group: "Feedback",
    props: { label: { type: "string", required: true, description: "라벨." } },
    acceptsChildren: false,
  },
  Divider: {
    type: "Divider",
    importName: "Divider",
    description: "Divider draws a separating line.",
    props: {},
    acceptsChildren: false,
  },
} as unknown as Catalog;

describe("listCatalog", () => {
  it("필터 없으면 전 엔트리를 type 오름차순으로 반환한다", () => {
    const rows = listCatalog(catalog);
    expect(rows.map((r) => r.type)).toEqual(["Badge", "Divider", "Grid", "Stack"]);
    expect(rows.find((r) => r.type === "Stack")).toMatchObject({
      type: "Stack",
      acceptsChildren: true,
      propCount: 2,
    });
    expect(rows.find((r) => r.type === "Divider")?.propCount).toBe(0);
  });

  it("group(정확)으로 좁힌다", () => {
    const rows = listCatalog(catalog, { group: "Layout" });
    expect(rows.map((r) => r.type)).toEqual(["Grid", "Stack"]);
  });

  it("group 미보유 엔트리는 group 필터에서 제외된다", () => {
    expect(listCatalog(catalog, { group: "Feedback" }).map((r) => r.type)).toEqual(["Badge"]);
    // Divider 는 group 없음 → 어떤 group 필터에도 안 걸린다.
    expect(listCatalog(catalog, { group: "none" })).toEqual([]);
  });

  it("query 는 type/description 대소문자 무시 부분일치", () => {
    expect(listCatalog(catalog, { query: "grid" }).map((r) => r.type)).toEqual(["Grid"]);
    // description 의 'label' 매칭.
    expect(listCatalog(catalog, { query: "LABEL" }).map((r) => r.type)).toEqual(["Badge"]);
    // 'line' 은 Divider description 에만.
    expect(listCatalog(catalog, { query: "line" }).map((r) => r.type)).toEqual(["Divider"]);
  });

  it("group 과 query 를 동시에 주면 AND", () => {
    // Layout 그룹 + 'row' → Stack description 만.
    expect(listCatalog(catalog, { group: "Layout", query: "row" }).map((r) => r.type)).toEqual(["Stack"]);
    // Layout 그룹 + 'status' → Badge 는 Feedback 이라 제외 → 빈 결과.
    expect(listCatalog(catalog, { group: "Layout", query: "status" })).toEqual([]);
  });

  it("빈 문자열 group/query 는 필터 없음으로 취급", () => {
    expect(listCatalog(catalog, { group: "", query: "" }).length).toBe(4);
  });
});

describe("catalog atoms", () => {
  it("catalogDoc 은 존재 엔트리를, 미지 type 은 undefined 를 준다", () => {
    expect(catalogDoc(catalog, "Stack")?.type).toBe("Stack");
    expect(catalogDoc(catalog, "Nope")).toBeUndefined();
  });

  it("getEntry/hasType 는 프로토타입 상속 키를 엔트리로 오인하지 않는다", () => {
    expect(getEntry(catalog, "__proto__")).toBeUndefined();
    expect(getEntry(catalog, "toString")).toBeUndefined();
    expect(hasType(catalog, "constructor")).toBe(false);
    expect(hasType(catalog, "Stack")).toBe(true);
  });

  it("acceptsChildren 은 엔트리 값을, 미지 type 은 false 를 준다", () => {
    expect(acceptsChildren(catalog, "Stack")).toBe(true);
    expect(acceptsChildren(catalog, "Badge")).toBe(false);
    expect(acceptsChildren(catalog, "Nope")).toBe(false);
  });

  it("propCount 는 prop 키 수", () => {
    expect(propCount(catalog.Stack)).toBe(2);
    expect(propCount(catalog.Divider)).toBe(0);
  });

  it("entryGroup 은 확장 group 필드를(없으면 undefined) 준다", () => {
    expect(entryGroup(catalog.Stack)).toBe("Layout");
    expect(entryGroup(catalog.Divider)).toBeUndefined();
  });
});
