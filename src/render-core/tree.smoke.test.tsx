// 실 astryx 배럴 스모크 — renderNode 가 진짜 @astryxdesign/core 컴포넌트를 이름으로 해소해
// 헤드리스(SSR)로 마크업을 낸다. 배럴 해소·트리 낮춤·미지 type 박스가 실물에서 도는지 검증한다.
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import * as Astryx from "@astryxdesign/core";
import { renderNode } from "./tree";
import type { DesignNode } from "../types";

const registry = Astryx as unknown as Record<string, unknown>;

describe("renderNode with the real Astryx registry", () => {
  it("실 컴포넌트를 렌더하고 미지 type 은 오류 박스", () => {
    const tree: DesignNode = {
      id: "n1",
      type: "Stack",
      props: {},
      children: [
        {
          id: "n2",
          type: "Card",
          props: {},
          children: [
            { id: "n3", type: "Text", props: { children: "Real Astryx" }, children: [] },
            { id: "n4", type: "Button", props: { children: "Go" }, children: [] },
            { id: "n5", type: "Bogus", props: {}, children: [] },
          ],
        },
      ],
    };
    const html = renderToStaticMarkup(renderNode(tree, registry));
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain("Real Astryx");
    expect(html).toContain("Go");
    expect(html).toContain("Unknown component: Bogus");
    // 실 astryx 컴포넌트는 안정 클래스(astryx-*)를 낸다 — 실제 렌더 증거.
    expect(html).toContain("astryx-");
  });
});
