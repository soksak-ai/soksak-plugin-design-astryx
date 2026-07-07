// @vitest-environment jsdom
// 노드별 에러 바운더리 격리 — 던지는 컴포넌트 하나가 형제/전체 미리보기를 죽이지 않고 그 노드만
// 오류 박스로 대체됨을 클라이언트 렌더(createRoot)로 검증. SSR 은 바운더리를 안 타므로 여기선 jsdom.
import { describe, it, expect } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderNode, type ComponentRegistry } from "./render";
import type { DesignNode } from "../src/types";

// React 19 act 환경 플래그 — 없으면 act 가 경고하고 플러시가 비결정적일 수 있다.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const Boom: React.FC = () => {
  throw new Error("kaboom");
};
const Safe: React.FC<{ children?: React.ReactNode }> = (p) =>
  React.createElement("div", { className: "safe" }, p.children ?? "OK");
const registry: ComponentRegistry = { Boom, Safe };

describe("NodeBoundary isolation", () => {
  it("던지는 노드만 오류 박스로 격리, 형제는 생존", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const tree: DesignNode = {
      id: "r",
      type: "Safe",
      props: {},
      children: [
        { id: "b", type: "Boom", props: {}, children: [] },
        { id: "s", type: "Safe", props: { children: "sibling" }, children: [] },
      ],
    };
    const root = createRoot(container);
    act(() => {
      root.render(renderNode(tree, registry));
    });
    const html = container.innerHTML;
    expect(html).toContain("Render error in Boom");
    expect(html).toContain("kaboom");
    expect(html).toContain("sibling"); // 형제 생존
    act(() => {
      root.unmount();
    });
  });
});
