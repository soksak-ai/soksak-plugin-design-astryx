// 정적 목업 입력 법칙(CONTRACT §2 보강) — renderNode 가 컴포넌트에 실제로 넘기는 props 를 캡처해 검증:
// on* inert 제거, 제어 입력 문자열/숫자 value→defaultValue+no-op onChange, boolean value 유지,
// 비제어(집합 밖) 컴포넌트 value 보존. SSR(node)로 캡처만 하므로 경고 경로는 여기서 다루지 않는다.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { renderNode, type ComponentRegistry, type RenderOptions } from "./render";
import type { DesignNode } from "../src/types";

function capture(): { box: { props: Record<string, unknown> | null }; Comp: React.FC } {
  const box: { props: Record<string, unknown> | null } = { props: null };
  const Comp: React.FC<Record<string, unknown>> = (p) => {
    box.props = p;
    return React.createElement("div");
  };
  return { box, Comp };
}
function node(partial: Partial<DesignNode> & { type: string; id: string }): DesignNode {
  return { props: {}, children: [], ...partial };
}
const opts: RenderOptions = { controlledInputs: new Set(["TextInput"]) };

describe("sanitizeProps — static-mockup input law", () => {
  it("제어 입력의 문자열 value → defaultValue + no-op onChange(value 제거)", () => {
    const { box, Comp } = capture();
    const n = node({ id: "n1", type: "TextInput", props: { value: "hello", placeholder: "p" } });
    renderToStaticMarkup(renderNode(n, { TextInput: Comp } as ComponentRegistry, opts));
    expect(box.props).toBeTruthy();
    expect(box.props!.defaultValue).toBe("hello");
    expect("value" in box.props!).toBe(false);
    expect(typeof box.props!.onChange).toBe("function");
    expect(box.props!.placeholder).toBe("p");
  });

  it("숫자 value 도 defaultValue 로 이관", () => {
    const { box, Comp } = capture();
    const n = node({ id: "n1", type: "TextInput", props: { value: 42 } });
    renderToStaticMarkup(renderNode(n, { TextInput: Comp } as ComponentRegistry, opts));
    expect(box.props!.defaultValue).toBe(42);
    expect("value" in box.props!).toBe(false);
  });

  it("boolean value 는 이관 않고 유지 + no-op onChange(설계 상태 표시)", () => {
    const { box, Comp } = capture();
    const n = node({ id: "n1", type: "TextInput", props: { value: true } });
    renderToStaticMarkup(renderNode(n, { TextInput: Comp } as ComponentRegistry, opts));
    expect(box.props!.value).toBe(true);
    expect("defaultValue" in box.props!).toBe(false);
    expect(typeof box.props!.onChange).toBe("function");
  });

  it("집합 밖(비입력) 컴포넌트의 value 는 그대로 보존, onChange 도 안 붙임", () => {
    const { box, Comp } = capture();
    const n = node({ id: "n1", type: "ProgressBar", props: { value: 70 } });
    renderToStaticMarkup(renderNode(n, { ProgressBar: Comp } as ComponentRegistry, opts));
    expect(box.props!.value).toBe(70);
    expect("defaultValue" in box.props!).toBe(false);
    expect("onChange" in box.props!).toBe(false);
  });

  it("on* prop 는 전부 inert 로 제거(JSON 문자열 핸들러 eval 금지)", () => {
    const { box, Comp } = capture();
    const n = node({
      id: "n1",
      type: "TextInput",
      props: { onClick: "alert(1)", onFocus: "steal()", value: "x", label: "L" },
    });
    renderToStaticMarkup(renderNode(n, { TextInput: Comp } as ComponentRegistry, opts));
    expect("onClick" in box.props!).toBe(false);
    expect("onFocus" in box.props!).toBe(false);
    expect(box.props!.label).toBe("L");
    // value 리매핑으로 붙는 onChange 는 우리 no-op 함수(문자열 아님).
    expect(typeof box.props!.onChange).toBe("function");
  });

  it("on 뒤가 대문자 아닌 prop(onset 등)은 핸들러가 아니므로 보존", () => {
    const { box, Comp } = capture();
    const n = node({ id: "n1", type: "TextInput", props: { onset: "keep" } });
    renderToStaticMarkup(renderNode(n, { TextInput: Comp } as ComponentRegistry, opts));
    expect(box.props!.onset).toBe("keep");
  });

  it("controlledInputs 미지정(opts 없음)이면 리매핑 없이 순수 통과", () => {
    const { box, Comp } = capture();
    const n = node({ id: "n1", type: "TextInput", props: { value: "raw" } });
    renderToStaticMarkup(renderNode(n, { TextInput: Comp } as ComponentRegistry));
    expect(box.props!.value).toBe("raw");
    expect("defaultValue" in box.props!).toBe(false);
    expect("onChange" in box.props!).toBe(false);
  });
});
