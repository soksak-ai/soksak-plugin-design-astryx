// 툴바 액션 검증 — 문서 변경은 이 플러그인 명령을 태운다(§7 Toolbar law). execute 인자를 못박는다.
import { describe, it, expect, vi } from "vitest";
import { selectPage, applyTheme } from "./actions";
import type { ExecuteCommand } from "./model";

function spy(): { exec: ExecuteCommand; calls: Array<[string, unknown]> } {
  const calls: Array<[string, unknown]> = [];
  const exec: ExecuteCommand = vi.fn(async (name, params) => {
    calls.push([name, params]);
    return { ok: true, code: "OK", message: "" };
  });
  return { exec, calls };
}

describe("selectPage", () => {
  it("preview.refresh 로 활성 페이지를 옮긴다", async () => {
    const { exec, calls } = spy();
    await selectPage(exec, "p3");
    expect(calls).toEqual([["preview.refresh", { pageId: "p3" }]]);
  });
});

describe("applyTheme", () => {
  it("mode 있으면 theme+mode 를 theme.set 에 넘긴다", async () => {
    const { exec, calls } = spy();
    await applyTheme(exec, "gothic", "dark");
    expect(calls).toEqual([["theme.set", { theme: "gothic", mode: "dark" }]]);
  });
  it("mode 없으면 theme 만(핸들러가 저장 모드 보존)", async () => {
    const { exec, calls } = spy();
    await applyTheme(exec, "y2k");
    expect(calls).toEqual([["theme.set", { theme: "y2k" }]]);
  });
});
