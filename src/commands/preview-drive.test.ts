import { describe, it, expect, vi } from "vitest";
import {
  probeEngine,
  driveBrowser,
  engineId,
  CHROMIUM_ID,
  NATIVE_ID,
  type Exec,
} from "./preview-drive";
import type { CommandOutcome } from "../types";

const ok = (data?: Record<string, unknown>): CommandOutcome => ({ ok: true, code: "OK", message: "", data });
const no = (code = "DEP_MISSING"): CommandOutcome => ({ ok: false, code, message: "nope" });

describe("engineId", () => {
  it("엔진을 대상 플러그인 id 로", () => {
    expect(engineId("chromium")).toBe(CHROMIUM_ID);
    expect(engineId("native")).toBe(NATIVE_ID);
  });
});

describe("probeEngine — 폴백 순서", () => {
  it("chromium ping ok → chromium(그리고 native 는 안 물어본다)", async () => {
    const exec = vi.fn(async (name: string) =>
      name === `plugin.${CHROMIUM_ID}.ping` ? ok() : no(),
    ) as unknown as Exec;
    expect(await probeEngine(exec)).toBe("chromium");
    expect(exec).toHaveBeenCalledTimes(1);
    expect(exec).toHaveBeenCalledWith(`plugin.${CHROMIUM_ID}.ping`, {});
  });

  it("chromium 실패·native ok → native", async () => {
    const exec = vi.fn(async (name: string) =>
      name === `plugin.${NATIVE_ID}.ping` ? ok() : no(),
    ) as unknown as Exec;
    expect(await probeEngine(exec)).toBe("native");
    expect(exec).toHaveBeenCalledTimes(2);
  });

  it("둘 다 실패 → null", async () => {
    const exec = vi.fn(async () => no()) as unknown as Exec;
    expect(await probeEngine(exec)).toBeNull();
    expect(exec).toHaveBeenCalledTimes(2);
  });

  it("exec 예외는 가용 아님으로 흡수(다음 후보로)", async () => {
    const exec = vi.fn(async (name: string) => {
      if (name === `plugin.${CHROMIUM_ID}.ping`) throw new Error("channel dead");
      return ok();
    }) as unknown as Exec;
    expect(await probeEngine(exec)).toBe("native");
  });

  it("ok:false 인 ping 은 가용 아님(에러 아님)", async () => {
    const exec = vi.fn(async () => ({ ok: false, code: "X", message: "" })) as unknown as Exec;
    expect(await probeEngine(exec)).toBeNull();
  });
});

describe("driveBrowser", () => {
  it("open 은 plugin.<engine>.open{url} 을 부른다", async () => {
    const exec = vi.fn(async () => ok()) as unknown as Exec;
    const out = await driveBrowser(exec, "chromium", "open", "file:///x/index.html");
    expect(out.ok).toBe(true);
    expect(exec).toHaveBeenCalledWith(`plugin.${CHROMIUM_ID}.open`, { url: "file:///x/index.html" });
  });

  it("navigate 는 plugin.<engine>.navigate{url} 을 부른다", async () => {
    const exec = vi.fn(async () => ok()) as unknown as Exec;
    await driveBrowser(exec, "native", "navigate", "file:///y/index.html");
    expect(exec).toHaveBeenCalledWith(`plugin.${NATIVE_ID}.navigate`, { url: "file:///y/index.html" });
  });

  it("non-ok 는 그대로 전달(호출부가 PREVIEW_FAILED 로 매핑)", async () => {
    const exec = vi.fn(async () => no("PERMISSION_DENIED")) as unknown as Exec;
    const out = await driveBrowser(exec, "chromium", "open", "u");
    expect(out.ok).toBe(false);
    expect(out.code).toBe("PERMISSION_DENIED");
  });

  it("예외는 PREVIEW_FAILED 봉투로 흡수", async () => {
    const exec = vi.fn(async () => {
      throw new Error("dead");
    }) as unknown as Exec;
    const out = await driveBrowser(exec, "chromium", "open", "u");
    expect(out.ok).toBe(false);
    expect(out.code).toBe("PREVIEW_FAILED");
    expect(out.message).toContain("dead");
  });
});
