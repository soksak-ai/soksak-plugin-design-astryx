// template.list / template.apply 데이터 로직 단위 테스트(순수). generated 산출물 미의존 — 손수 만든
// v2 TemplateEntry(verbatim TSX + available/reason) 픽스처로 목록·가용 분리·개수·조회를 검증한다.

import { describe, it, expect } from "vitest";
import type { TemplateEntry } from "../types";
import { listTemplates, getTemplate } from "./logic";

const fixtures: TemplateEntry[] = [
  {
    id: "pages/dashboard",
    kind: "page",
    name: "Dashboard",
    code: "export default function Dashboard(){return null;}",
    requires: ["@astryxdesign/core", "recharts"],
    available: false,
    reason: "recharts (not installed)",
  },
  {
    id: "pages/blank",
    kind: "page",
    name: "Blank",
    code: "export default function Blank(){return null;}",
    requires: ["@astryxdesign/core", "react"],
    available: true,
  },
  {
    id: "blocks/components/Badge/BadgeTags",
    kind: "block",
    name: "Badge Tags",
    code: "export default function BadgeTags(){return null;}",
    requires: ["@astryxdesign/core"],
    available: true,
  },
  {
    id: "pages/kanban-board",
    kind: "page",
    name: "Kanban Board",
    code: "export default function Kanban(){return null;}",
    requires: ["@astryxdesign/core", "@stylexjs/stylex"],
    available: false,
    reason: "@stylexjs/stylex compile-time transform required",
  },
];

describe("listTemplates", () => {
  it("기본은 available 만 목록에 담고 미가용은 개수+사유로 보고(§5)", () => {
    const out = listTemplates(fixtures);
    expect(out.templates.map((t) => t.id)).toEqual(["pages/blank", "blocks/components/Badge/BadgeTags"]);
    expect(out.available).toBe(2);
    expect(out.unavailableCount).toBe(2);
    expect(out.unavailable).toEqual([
      { id: "pages/dashboard", name: "Dashboard", reason: "recharts (not installed)" },
      { id: "pages/kanban-board", name: "Kanban Board", reason: "@stylexjs/stylex compile-time transform required" },
    ]);
    // 요약은 메타만 — code 본문 없음, reason 은 available 엔트리엔 부재.
    expect(out.templates[0]).not.toHaveProperty("code");
    expect(out.templates[0]).toEqual({
      id: "pages/blank", kind: "page", name: "Blank", requires: ["@astryxdesign/core", "react"], available: true,
    });
  });

  it("includeUnavailable=true 면 목록 배열에도 미가용 엔트리(available·reason 동반)를 싣는다", () => {
    const out = listTemplates(fixtures, { includeUnavailable: true });
    expect(out.templates.map((t) => t.id)).toEqual([
      "pages/dashboard", "pages/blank", "blocks/components/Badge/BadgeTags", "pages/kanban-board",
    ]);
    // available 카운트는 목록 담긴 가용 수 그대로(미가용은 unavailableCount).
    expect(out.available).toBe(2);
    expect(out.unavailableCount).toBe(2);
    const dash = out.templates.find((t) => t.id === "pages/dashboard")!;
    expect(dash.available).toBe(false);
    expect(dash.reason).toBe("recharts (not installed)");
  });

  it("kind 로 스코프를 좁힌다(가용 카운트·미가용 꼬리 모두 그 스코프 기준)", () => {
    const pages = listTemplates(fixtures, { kind: "page" });
    expect(pages.templates.map((t) => t.id)).toEqual(["pages/blank"]);
    expect(pages.available).toBe(1);
    expect(pages.unavailableCount).toBe(2);

    const blocks = listTemplates(fixtures, { kind: "block", includeUnavailable: true });
    expect(blocks.templates.map((t) => t.id)).toEqual(["blocks/components/Badge/BadgeTags"]);
    expect(blocks.available).toBe(1);
    expect(blocks.unavailableCount).toBe(0);
    expect(blocks.unavailable).toEqual([]);
  });
});

describe("getTemplate", () => {
  it("id 로 원본 엔트리(code·available·reason 완비)를 돌려준다", () => {
    const t = getTemplate(fixtures, "pages/dashboard")!;
    expect(t.name).toBe("Dashboard");
    expect(t.code).toContain("export default");
    expect(t.available).toBe(false);
    expect(t.reason).toBe("recharts (not installed)");
  });
  it("없는 id 는 undefined", () => {
    expect(getTemplate(fixtures, "nope")).toBeUndefined();
  });
});
