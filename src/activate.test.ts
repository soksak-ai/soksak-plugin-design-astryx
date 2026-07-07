// 활성화 배선 회귀 게이트: activate() 는 반드시 model.useCatalog(catalog) 를 호출해야 한다.
// 없으면 model 은 빈 카탈로그로 폴백해 comp.add/comp.set/comp.move 가 전부 INVALID_TYPE 로 실패한다
// (명령 계층이 mutate 에 catalog 인자를 넘기지 않기 때문 — commands/index.ts). 단위테스트는 카탈로그를
// 명시 주입하므로 이 배선 누락을 못 잡는다. 여기서 실제 activate 를 구동해 등록 소스 동일성을 강제한다.
import { describe, it, expect, beforeEach } from "vitest";
import entry from "./plugin-entry";
import * as model from "./model";
import * as catalog from "./catalog";

type Sub = { dispose(): void } | (() => void);

function fakeCtx() {
  return {
    app: {
      commands: { register: (_n: string) => ({ dispose() {} }) },
      fs: {},
      data: {},
      project: { current: () => null },
    },
    manifest: { id: "soksak-plugin-design-astryx", version: "0.0.1" },
    dir: "/tmp/soksak-design-astryx-activate",
    subscriptions: [] as Sub[],
  };
}

describe("activate 카탈로그 배선", () => {
  beforeEach(() => {
    // 격리 — 다른 테스트가 등록한 소스를 초기화.
    model.useCatalog({ getEntry: () => undefined });
  });

  it("activate 후 model 등록 소스는 catalog 서브모듈이다(런타임 type 해소 보장)", () => {
    const ctx = fakeCtx();
    entry.activate(ctx as unknown as Parameters<typeof entry.activate>[0]);
    // resolveCatalog(인자 없음) = 등록 소스. plugin-entry 가 catalog 네임스페이스를 그대로 넘겼으므로
    // 그 getEntry 는 catalog.getEntry 와 동일 참조여야 한다.
    const src = model.resolveCatalog();
    expect(src.getEntry).toBe(catalog.getEntry);
  });
});
