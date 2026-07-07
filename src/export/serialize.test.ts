// prop/children/node 직렬화 순수부 단위테스트 — CONTRACT §10 규칙별.
import { describe, it, expect } from "vitest";
import type { DesignNode, Catalog } from "../types";
import {
  serializeAttr,
  serializeChildValue,
  serializeNode,
  collectTypes,
  importNameFor,
} from "./serialize";

describe("serializeAttr — prop 종류별", () => {
  it("boolean true = bare 속성", () => {
    expect(serializeAttr("disabled", true)).toBe("disabled");
  });
  it("boolean false = {false}", () => {
    expect(serializeAttr("open", false)).toBe("open={false}");
  });
  it("number = {n}", () => {
    expect(serializeAttr("count", 3)).toBe("count={3}");
    expect(serializeAttr("ratio", 1.5)).toBe("ratio={1.5}");
    expect(serializeAttr("neg", -2)).toBe("neg={-2}");
  });
  it("안전한 string = 큰따옴표", () => {
    expect(serializeAttr("label", "Save")).toBe('label="Save"');
    expect(serializeAttr("label", "여러 단어 텍스트")).toBe('label="여러 단어 텍스트"');
  });
  it("따옴표/중괄호/개행 포함 string = 표현식 컨테이너(JSON 이스케이프)", () => {
    expect(serializeAttr("label", 'a"b')).toBe('label={"a\\"b"}');
    expect(serializeAttr("tpl", "a{b}")).toBe('tpl={"a{b}"}');
    expect(serializeAttr("multi", "l1\nl2")).toBe('multi={"l1\\nl2"}');
  });
  it("null = {null}", () => {
    expect(serializeAttr("meta", null)).toBe("meta={null}");
  });
  it("array = JSON 리터럴", () => {
    expect(serializeAttr("items", ["x", "y"])).toBe('items={["x","y"]}');
  });
  it("object = JSON 리터럴", () => {
    expect(serializeAttr("data", { a: 1, b: [2, 3] })).toBe('data={{"a":1,"b":[2,3]}}');
  });
});

describe("serializeChildValue", () => {
  it("안전한 문자열 = raw 텍스트", () => {
    expect(serializeChildValue("Hello world")).toBe("Hello world");
  });
  it("유니코드/이모지 = raw 텍스트", () => {
    expect(serializeChildValue("안녕하세요 🌟 Café")).toBe("안녕하세요 🌟 Café");
  });
  it("따옴표만 있는 문자열은 raw 텍스트(JSX 텍스트에선 허용)", () => {
    expect(serializeChildValue('He said "hi"')).toBe('He said "hi"');
  });
  it("<>{}& 개행 포함 = 표현식 컨테이너", () => {
    expect(serializeChildValue("a<b")).toBe('{"a<b"}');
    expect(serializeChildValue("x{y}")).toBe('{"x{y}"}');
    expect(serializeChildValue("R&D")).toBe('{"R&D"}');
    expect(serializeChildValue("l1\nl2")).toBe('{"l1\\nl2"}');
  });
  it("빈 문자열 = 자식 없음(null)", () => {
    expect(serializeChildValue("")).toBeNull();
  });
  it("null = 자식 없음(null)", () => {
    expect(serializeChildValue(null)).toBeNull();
  });
  it("number/boolean = 표현식 컨테이너", () => {
    expect(serializeChildValue(42)).toBe("{42}");
    expect(serializeChildValue(true)).toBe("{true}");
    expect(serializeChildValue(false)).toBe("{false}");
  });
  it("array/object = JSON 표현식", () => {
    expect(serializeChildValue([1, 2])).toBe("{[1,2]}");
    expect(serializeChildValue({ a: 1 })).toBe('{{"a":1}}');
  });
});

const leaf = (type: string, props: Record<string, unknown> = {}): DesignNode => ({
  id: `n-${type}`,
  type,
  props: props as DesignNode["props"],
  children: [],
});

describe("serializeNode", () => {
  it("자식 없고 children prop 없으면 self-close", () => {
    expect(serializeNode(leaf("Stack"), undefined, 0)).toBe("<Stack />");
  });
  it("속성은 알파벳 정렬로 결정적 출력", () => {
    const n = leaf("Button", { label: "Save", disabled: true, count: 3 });
    expect(serializeNode(n, undefined, 0)).toBe('<Button count={3} disabled label="Save" />');
  });
  it("children prop(문자열)은 텍스트 자식으로, 속성에서 제외", () => {
    const n = leaf("Text", { children: "Card Title", tone: "muted" });
    expect(serializeNode(n, undefined, 0)).toBe('<Text tone="muted">\n  Card Title\n</Text>');
  });
  it("node.children 는 중첩 요소로(2칸 들여쓰기)", () => {
    const tree: DesignNode = {
      id: "n1",
      type: "Stack",
      props: { gap: "md" },
      children: [leaf("Card"), leaf("Button", { label: "Go" })],
    };
    expect(serializeNode(tree, undefined, 0)).toBe(
      ['<Stack gap="md">', "  <Card />", '  <Button label="Go" />', "</Stack>"].join("\n"),
    );
  });
  it("node.children 가 있으면 props.children 은 무시(구조 채널 우선)", () => {
    const tree: DesignNode = {
      id: "n1",
      type: "Card",
      props: { children: "ignored" },
      children: [leaf("Text", { children: "real" })],
    };
    expect(serializeNode(tree, undefined, 0)).toBe(
      ["<Card>", "  <Text>", "    real", "  </Text>", "</Card>"].join("\n"),
    );
  });
  it("depth 로 들여쓰기가 밀린다", () => {
    expect(serializeNode(leaf("Stack"), undefined, 3)).toBe("      <Stack />");
  });
  it("catalog importName 으로 태그를 매핑(있을 때)", () => {
    const catalog: Catalog = {
      Foo: {
        type: "Foo",
        importName: "FooBar",
        description: "",
        props: {},
        acceptsChildren: false,
      },
    };
    expect(serializeNode(leaf("Foo"), catalog, 0)).toBe("<FooBar />");
  });
});

describe("importNameFor / collectTypes", () => {
  it("카탈로그 없으면 type 그대로", () => {
    expect(importNameFor("Button")).toBe("Button");
  });
  it("트리의 모든 type 을 유일 집합으로 수집", () => {
    const tree: DesignNode = {
      id: "n1",
      type: "Stack",
      props: {},
      children: [leaf("Card"), { ...leaf("Stack"), children: [leaf("Button")] }],
    };
    expect(collectTypes(tree).sort()).toEqual(["Button", "Card", "Stack"]);
  });
});
