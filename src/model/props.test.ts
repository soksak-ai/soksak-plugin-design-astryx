import { describe, it, expect } from "vitest";
import { validateProps } from "./props";
import { fixtureCatalog } from "./fixtures";

const cat = fixtureCatalog();
const Button = cat.Button;
const Stack = cat.Stack;

function code(r: ReturnType<typeof validateProps>): string | null {
  return r === null ? null : r.code;
}

describe("validateProps", () => {
  it("accepts a valid string prop", () => {
    expect(validateProps(Button, { label: "Save" }, false)).toBeNull();
  });

  it("rejects unknown prop -> INVALID_PROP", () => {
    expect(code(validateProps(Button, { nope: 1 }, false))).toBe("INVALID_PROP");
  });

  it("rejects callback prop (=> in type) -> INVALID_PROP", () => {
    expect(code(validateProps(Button, { onClick: "x" }, false))).toBe("INVALID_PROP");
  });

  it("accepts a valid enum member, rejects a non-member", () => {
    expect(validateProps(Button, { variant: "primary" }, false)).toBeNull();
    expect(code(validateProps(Button, { variant: "ghost" }, false))).toBe("INVALID_PROP");
  });

  it("rejects an enum value that is not a string", () => {
    expect(code(validateProps(Button, { variant: 3 }, false))).toBe("INVALID_PROP");
  });

  it("enforces string type", () => {
    expect(validateProps(Button, { label: "x" }, false)).toBeNull();
    expect(code(validateProps(Button, { label: 5 }, false))).toBe("INVALID_PROP");
  });

  it("enforces number type", () => {
    expect(validateProps(Button, { count: 3 }, false)).toBeNull();
    expect(code(validateProps(Button, { count: "3" }, false))).toBe("INVALID_PROP");
  });

  it("enforces boolean type", () => {
    expect(validateProps(Button, { disabled: true }, false)).toBeNull();
    expect(code(validateProps(Button, { disabled: "yes" }, false))).toBe("INVALID_PROP");
  });

  it("accepts any JsonValue for non-primitive catalog types", () => {
    expect(validateProps(Button, { data: { a: 1 } }, false)).toBeNull();
    expect(validateProps(Button, { data: [1, 2, 3] }, false)).toBeNull();
  });

  it("INV5: children string allowed only when node has no structural children", () => {
    expect(validateProps(Stack, { children: "hi" }, false)).toBeNull();
    expect(code(validateProps(Stack, { children: "hi" }, true))).toBe("INVALID_PROP");
  });

  it("stops at the first violation", () => {
    const r = validateProps(Button, { label: 5, count: "bad" }, false);
    expect(r && !r.ok && r.message).toContain("label");
  });
});

// 보편 forward prop 법칙 — className/style 은 카탈로그 99종에 주입하지 않고 검증 계층 한 곳에서
// 모든 노드에 허용한다(공식 styling 탈출구). Button/Stack 픽스처에 className/style prop 이 없어도 통과.
describe("forwarded props (className/style)", () => {
  it("allows a className string on any node", () => {
    expect(validateProps(Button, { className: "hero" }, false)).toBeNull();
    expect(validateProps(Stack, { className: "row" }, false)).toBeNull();
  });

  it("allows a style plain object on any node", () => {
    expect(validateProps(Button, { style: { color: "var(--color-fg)" } }, false)).toBeNull();
    expect(validateProps(Stack, { style: { gap: "var(--spacing-2)" } }, false)).toBeNull();
  });

  it("rejects a className that is not a string", () => {
    expect(code(validateProps(Button, { className: 3 } as never, false))).toBe("INVALID_PROP");
  });

  it("rejects a style that is not a plain object (array / null / function)", () => {
    expect(code(validateProps(Button, { style: [1, 2] } as never, false))).toBe("INVALID_PROP");
    expect(code(validateProps(Button, { style: null } as never, false))).toBe("INVALID_PROP");
    expect(code(validateProps(Button, { style: (() => ({})) as never }, false))).toBe("INVALID_PROP");
  });
});

// 실행 가능한 오류 데이터 — 실패 봉투의 data 축(§3 actionable). validProps/validValues/example.
describe("actionable INVALID_PROP data", () => {
  it("unknown prop carries validProps (incl. universal) + example", () => {
    const r = validateProps(Button, { nope: 1 }, false);
    expect(r && r.code).toBe("INVALID_PROP");
    const props = r?.data?.validProps as string[];
    expect(props).toContain("label");
    expect(props).toContain("className");
    expect(props).toContain("style");
    expect((r?.data?.example as { type: string }).type).toBe("Button");
  });

  it("enum violation carries validValues + an example with a valid value", () => {
    const r = validateProps(Button, { variant: "ghost" }, false);
    expect(r?.data?.validValues).toEqual(["primary", "secondary"]);
    const example = r?.data?.example as { props: Record<string, unknown> };
    expect(example.props.variant).toBe("primary");
  });

  it("type mismatch carries validProps + focused example", () => {
    const r = validateProps(Button, { label: 5 }, false);
    const example = r?.data?.example as { props: Record<string, unknown> };
    expect(example.props.label).toBe("text");
    expect(r?.data?.validProps).toContain("label");
  });
});
