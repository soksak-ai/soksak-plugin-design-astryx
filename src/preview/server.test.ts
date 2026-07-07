// 미리보기 서버 검증 — 순수부(PORT 파싱·URL 조립)와 실물부(실제 node 스폰→fetch→루트 감금)를
// 함께 강제한다. 실물부는 scripts/preview-server.cjs 를 그대로 스폰한다(러너 수송의 실경로).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parsePortLine, previewHttpUrl, ensurePreviewServer, stopPreviewServer, freshServerState, type ServerProc } from "./server";

const SERVER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../scripts/preview-server.cjs");

describe("parsePortLine(순수)", () => {
  it("PORT= 줄을 찾는다(부분 청크 누적 포함)", () => {
    expect(parsePortLine("")).toBeNull();
    expect(parsePortLine("PORT=")).toBeNull();
    expect(parsePortLine("PORT=8123\n")).toBe(8123);
    expect(parsePortLine("noise\nPORT=45678\n")).toBe(45678);
  });
  it("범위 밖·비정수는 거부", () => {
    expect(parsePortLine("PORT=0\n")).toBeNull();
    expect(parsePortLine("PORT=99999\n")).toBeNull();
  });
});

describe("previewHttpUrl(순수)", () => {
  it("127.0.0.1 + 평면 페이지 아티팩트", () => {
    expect(previewHttpUrl(8123, "p1")).toBe("http://127.0.0.1:8123/p1.html");
  });
});

describe("preview-server.cjs(실물 스폰)", () => {
  let root: string;
  let child: ChildProcess | null = null;
  let port = 0;

  beforeAll(async () => {
    root = mkdtempSync(path.join(tmpdir(), "design-astryx-srv-"));
    writeFileSync(path.join(root, "p1.html"), "<!doctype html><title>t</title>ok");
    writeFileSync(path.join(root, "runner.js"), "// js");
    child = spawn(process.execPath, [SERVER, root], { stdio: ["ignore", "pipe", "pipe"] });
    port = await new Promise<number>((resolve, reject) => {
      let buf = "";
      const timer = setTimeout(() => reject(new Error("PORT 타임아웃")), 8000);
      child!.stdout!.on("data", (d: Buffer) => {
        buf += d.toString();
        const p = parsePortLine(buf);
        if (p !== null) {
          clearTimeout(timer);
          resolve(p);
        }
      });
      child!.once("exit", () => reject(new Error("기동 전 종료")));
    });
  }, 15000);

  afterAll(() => {
    child?.kill();
    rmSync(root, { recursive: true, force: true });
  });

  it("html 을 올바른 content-type 으로 서빙", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/p1.html`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain("ok");
  });

  it("형제 js 서빙(러너 로드 경로)", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/runner.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("javascript");
  });

  it("없는 파일은 404", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/nope.html`);
    expect(res.status).toBe(404);
  });

  it("루트 감금 — .. 탈출은 403/404 로 차단(파일 유출 0)", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/..%2f..%2fetc%2fpasswd`);
    expect([403, 404]).toContain(res.status);
    const body = await res.text();
    expect(body).not.toContain("root:");
  });
});

describe("ensurePreviewServer(수명주기, 실물 node)", () => {
  it("스폰→PORT 파싱→재사용→종료", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "design-astryx-life-"));
    writeFileSync(path.join(root, ".keep"), "");
    // 실제 자식 프로세스로 ServerProc 표면을 구현(코어 app.process 동형).
    const children = new Map<number, ChildProcess>();
    let seq = 0;
    const proc: ServerProc = {
      spawn: async (cmd, args) => {
        const c = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
        const h = ++seq;
        children.set(h, c);
        return h;
      },
      onData: (h, cb) => {
        const c = children.get(h)!;
        const f = (d: Buffer) => cb(new Uint8Array(d));
        c.stdout!.on("data", f);
        return { dispose: () => c.stdout!.off("data", f) };
      },
      onExit: (h, cb) => {
        const c = children.get(h)!;
        const f = (code: number | null) => cb(code ?? -1);
        c.once("exit", f);
        return { dispose: () => c.off("exit", f) };
      },
      kill: async (h) => {
        children.get(h)?.kill();
      },
    };
    // dir 은 scripts/preview-server.cjs 와 .preview 의 기준 — 테스트는 플러그인 루트를 그대로 쓴다.
    const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    const state = freshServerState();
    const port = await ensurePreviewServer({ proc, dir, state });
    expect(port).toBeGreaterThan(0);
    expect(state.alive).toBe(true);
    // 재호출은 같은 포트 재사용(재스폰 0).
    const again = await ensurePreviewServer({ proc, dir, state });
    expect(again).toBe(port);
    await stopPreviewServer(proc, state);
    expect(state.alive).toBe(false);
    rmSync(root, { recursive: true, force: true });
  }, 20000);
});
