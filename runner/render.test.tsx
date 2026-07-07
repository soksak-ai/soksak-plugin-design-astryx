// renderNode 순수 로직 테스트(목 레지스트리) — children 법칙(§2)·prop 통과·미지 type 오류 박스.
// SSR(renderToStaticMarkup, node 환경)로 확인 — 던지지 않는 경로만(바운더리 격리는 별 파일에서 jsdom).
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { renderNode, type ComponentRegistry } from "./render";
import type { DesignNode } from "../src/types";

const Box: React.FC<{ "data-tag"?: string; children?: React.ReactNode }> = (p) =>
  React.createElement("div", { "data-tag": p["data-tag"] }, p.children);
const Label: React.FC<{ children?: React.ReactNode }> = (p) =>
  React.createElement("span", { className: "lbl" }, p.children);
const registry: ComponentRegistry = { Box, Label };

function node(partial: Partial<DesignNode> & { type: string; id: string }): DesignNode {
  return { props: {}, children: [], ...partial };
}

describe("renderNode", () => {
  it("props.children 문자열을 텍스트로 렌더", () => {
    const n = node({ id: "n1", type: "Label", props: { children: "Hi" } });
    const html = renderToStaticMarkup(renderNode(n, registry));
    expect(html).toContain("Hi");
    expect(html).toContain('class="lbl"');
  });

  it("children 이외 prop 을 컴포넌트로 통과", () => {
    const n = node({ id: "n1", type: "Box", props: { "data-tag": "x" } });
    const html = renderToStaticMarkup(renderNode(n, registry));
    expect(html).toContain('data-tag="x"');
  });

  it("node.children 이 유일한 합성 채널", () => {
    const n = node({
      id: "n1",
      type: "Box",
      children: [node({ id: "n2", type: "Label", props: { children: "Kid" } })],
    });
    const html = renderToStaticMarkup(renderNode(n, registry));
    expect(html).toContain('<span class="lbl">Kid</span>');
  });

  it("node.children 이 있으면 props.children 은 무시(INV5 전제)", () => {
    // 정상 트리는 둘을 공존시키지 않지만, 공존해도 node.children 우선임을 못박는다.
    const n = node({
      id: "n1",
      type: "Box",
      props: { children: "ignored-literal" },
      children: [node({ id: "n2", type: "Label", props: { children: "Kid" } })],
    });
    const html = renderToStaticMarkup(renderNode(n, registry));
    expect(html).toContain("Kid");
    expect(html).not.toContain("ignored-literal");
  });

  it("미지 type 은 보이는 오류 박스(빈 화면 금지)", () => {
    const n = node({ id: "n9", type: "Ghost" });
    const html = renderToStaticMarkup(renderNode(n, registry));
    expect(html).toContain("Unknown component: Ghost");
    expect(html).toContain("node n9");
  });
});
