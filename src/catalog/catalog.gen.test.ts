// 완전성 법칙 테스트(CONTRACT §6) — 생성된 generated/catalog.json 이 core 의 기계적 컴포넌트 집합과
// 정확히 일치하는가. 어느 방향의 드리프트도 실패. 로더로도 통과시켜 생성기+로더를 함께 검증한다.
//
// node 내장(node:fs 등) 대신 JSON 모듈 import 를 쓴다 — 이 플러그인엔 @types/node 가 없어(소유 밖)
// 내 파일이 그것에 의존하지 않도록. resolveJsonModule 로 정적 import 된다.
import { describe, it, expect } from "vitest";
import catalogJson from "../../generated/catalog.json";
import corePkg from "../../node_modules/@astryxdesign/core/package.json";
import { loadCatalog } from "./load";
import { hasType, acceptsChildren } from "./query";

// 집합은 기계적으로 재계산한다(생성기와 같은 규칙): 단일세그먼트 대문자 subpath.
const COMPONENT_RE = /^\.\/[A-Z][A-Za-z0-9]*$/;
function mechanicalSet(): string[] {
  const exportsMap = (corePkg as { exports: Record<string, unknown> }).exports;
  return Object.keys(exportsMap)
    .filter((k) => COMPONENT_RE.test(k))
    .map((k) => k.slice(2))
    .sort();
}

// 실제 생성 산출물을 로더로 검증(문자열 경로도 통과함을 증명).
const catalog = loadCatalog(JSON.stringify(catalogJson));

describe("catalog completeness (§6)", () => {
  it("키 집합 == core 기계적 컴포넌트 export 집합(드리프트 0)", () => {
    expect(Object.keys(catalog).sort()).toEqual(mechanicalSet());
  });

  it("0.1.3 에서 정확히 99종", () => {
    expect(Object.keys(catalog).length).toBe(99);
  });

  it("모든 엔트리: type === importName === 키", () => {
    for (const [k, e] of Object.entries(catalog)) {
      expect(e.type).toBe(k);
      expect(e.importName).toBe(k);
    }
  });

  it("Stack(page.create 기본 루트)은 자식을 받는다 — 아니면 루트에 아무것도 못 붙인다", () => {
    expect(hasType(catalog, "Stack")).toBe(true);
    expect(acceptsChildren(catalog, "Stack")).toBe(true);
  });

  it("doc 있는 컴포넌트는 큐레이션된 props+enum 을 싣는다(Button)", () => {
    expect(catalog.Button.props.variant.enum).toEqual(["primary", "secondary", "ghost", "destructive"]);
    expect(catalog.Button.acceptsChildren).toBe(true);
  });

  it("NavMenu 는 doc-이름 폴백으로 실제 props+acceptsChildren 을 얻는다(빈 dist 폴백 아님)", () => {
    // doc.mjs 의 d.name('NavHeadingMenu')이 export 이름과 달라도 subpath doc 을 채택한다.
    const nav = catalog.NavMenu;
    expect(nav.acceptsChildren).toBe(true);
    expect(Object.keys(nav.props)).toEqual(
      expect.arrayContaining(["children", "size", "minWidth", "xstyle"]),
    );
    expect(nav.props.size.enum).toEqual(["sm", "md", "lg"]);
  });

  it(".doc.mjs 결손 6종도 카탈로그에 존재한다(폴백 최소 엔트리)", () => {
    for (const n of ["Code", "HStack", "Heading", "InteractiveRoleContext", "SizeContext", "VStack"]) {
      expect(hasType(catalog, n)).toBe(true);
    }
    // Code/HStack/VStack/Heading 은 .d.ts 폴백으로 children ReactNode 를 살려 자식을 받는다.
    expect(acceptsChildren(catalog, "Code")).toBe(true);
    expect(acceptsChildren(catalog, "HStack")).toBe(true);
    expect(acceptsChildren(catalog, "VStack")).toBe(true);
    expect(acceptsChildren(catalog, "Heading")).toBe(true);
  });
});
