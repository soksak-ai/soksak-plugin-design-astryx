// data-node-id seam(CONTRACT §7 Selection law) — 뷰가 켜는 nodeIdAttr 옵션이 각 렌더 노드에
// data-node-id 를 얹어 캔버스 클릭을 노드로 역매핑하게 한다. 기본 꺼짐 → 러너식 소비자(뷰 밖) 불변.
// SSR(renderToStaticMarkup)로 attr 이 DOM 에 도달하는지 확인 — spread 컴포넌트가 미지 prop 을 통과시킨다.
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { renderNode, type ComponentRegistry } from "./tree";
import type { DesignNode } from "../types";

// 미지 prop 을 루트 DOM 으로 spread 하는 컴포넌트(astryx 실컴포넌트의 관용 패턴 대역).
const Spread: React.FC<Record<string, unknown>> = (p) => {
  const { children, ...rest } = p;
  return React.createElement("div", rest, children as React.ReactNode);
};
const registry: ComponentRegistry = { Spread };

function node(partial: Partial<DesignNode> & { type: string; id: string }): DesignNode {
  return { props: {}, children: [], ...partial };
}

describe("renderNode nodeIdAttr seam", () => {
  it("nodeIdAttr 켜면 각 렌더 노드(자식 포함)에 data-node-id 를 싣는다", () => {
    const n = node({
      id: "n1",
      type: "Spread",
      children: [node({ id: "n2", type: "Spread" })],
    });
    const html = renderToStaticMarkup(renderNode(n, registry, { nodeIdAttr: true }));
    expect(html).toContain('data-node-id="n1"');
    expect(html).toContain('data-node-id="n2"');
  });

  it("기본(옵션 없음)은 data-node-id 를 싣지 않는다(러너식 소비자 불변)", () => {
    const n = node({ id: "n1", type: "Spread" });
    const html = renderToStaticMarkup(renderNode(n, registry));
    expect(html).not.toContain("data-node-id");
  });

  it("nodeIdAttr:false 명시도 부착하지 않는다", () => {
    const n = node({ id: "n1", type: "Spread" });
    const html = renderToStaticMarkup(renderNode(n, registry, { nodeIdAttr: false }));
    expect(html).not.toContain("data-node-id");
  });

  it("props 의 다른 값과 공존한다(seam 이 사용자 prop 을 덮지 않음)", () => {
    const n = node({ id: "n7", type: "Spread", props: { "data-tag": "keep" } });
    const html = renderToStaticMarkup(renderNode(n, registry, { nodeIdAttr: true }));
    expect(html).toContain('data-node-id="n7"');
    expect(html).toContain('data-tag="keep"');
  });
});
