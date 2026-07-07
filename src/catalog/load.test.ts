import { describe, it, expect } from "vitest";
import { loadCatalog } from "./load";

// 최소 유효 카탈로그 픽스처(엔트리 2종). group 은 미선언 확장 필드지만 보존돼야 한다.
function fixtureJson(): string {
  return JSON.stringify({
    Stack: {
      type: "Stack",
      importName: "Stack",
      description: "Stack arranges items.",
      group: "Layout",
      props: {
        direction: { type: "StackDirection", required: false, enum: ["horizontal", "vertical"], default: "'vertical'", description: "방향." },
        children: { type: "ReactNode", required: false, description: "자식." },
      },
      acceptsChildren: true,
    },
    Badge: {
      type: "Badge",
      importName: "Badge",
      description: "Badge shows a label.",
      props: {
        label: { type: "string", required: true, description: "라벨." },
      },
      acceptsChildren: false,
    },
  });
}

describe("loadCatalog", () => {
  it("유효 JSON 을 파싱해 두 엔트리를 반환한다", () => {
    const c = loadCatalog(fixtureJson());
    expect(Object.keys(c).sort()).toEqual(["Badge", "Stack"]);
    expect(c.Stack.acceptsChildren).toBe(true);
    expect(c.Badge.props.label.required).toBe(true);
    expect(c.Stack.props.direction.enum).toEqual(["horizontal", "vertical"]);
    expect(c.Stack.props.direction.default).toBe("'vertical'");
  });

  it("미선언 확장 필드(group)를 보존한다", () => {
    const c = loadCatalog(fixtureJson());
    expect((c.Stack as { group?: string }).group).toBe("Layout");
    expect((c.Badge as { group?: string }).group).toBeUndefined();
  });

  it("깨진 JSON 은 throw 한다", () => {
    expect(() => loadCatalog("{ not json")).toThrow(/JSON 파싱 실패/);
  });

  it("최상위가 배열이면 throw 한다", () => {
    expect(() => loadCatalog("[]")).toThrow(/최상위가 객체가 아님/);
  });

  it("type 이 키와 불일치하면 throw 한다", () => {
    const bad = JSON.stringify({ Stack: { type: "Nope", importName: "Stack", description: "x", props: {}, acceptsChildren: false } });
    expect(() => loadCatalog(bad)).toThrow(/키와 불일치/);
  });

  it("importName 이 키와 불일치하면 throw 한다", () => {
    const bad = JSON.stringify({ Stack: { type: "Stack", importName: "Nope", description: "x", props: {}, acceptsChildren: false } });
    expect(() => loadCatalog(bad)).toThrow(/importName/);
  });

  it("description 이 비면 throw 한다", () => {
    const bad = JSON.stringify({ Stack: { type: "Stack", importName: "Stack", description: "", props: {}, acceptsChildren: false } });
    expect(() => loadCatalog(bad)).toThrow(/description/);
  });

  it("acceptsChildren 이 불리언이 아니면 throw 한다", () => {
    const bad = JSON.stringify({ Stack: { type: "Stack", importName: "Stack", description: "x", props: {}, acceptsChildren: "yes" } });
    expect(() => loadCatalog(bad)).toThrow(/acceptsChildren/);
  });

  it("prop 스펙 필드 타입 위반은 throw 한다", () => {
    const bad = JSON.stringify({
      Stack: { type: "Stack", importName: "Stack", description: "x", acceptsChildren: false, props: { p: { type: 1, required: false, description: "x" } } },
    });
    expect(() => loadCatalog(bad)).toThrow(/type 이 문자열이 아님/);
  });

  it("enum 이 문자열 배열이 아니면 throw 한다", () => {
    const bad = JSON.stringify({
      Stack: { type: "Stack", importName: "Stack", description: "x", acceptsChildren: false, props: { p: { type: "string", required: false, description: "x", enum: [1, 2] } } },
    });
    expect(() => loadCatalog(bad)).toThrow(/enum/);
  });
});
