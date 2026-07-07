// 적합성 게이트(§0-3): plugin.json 이 선언한 명령 집합 ≡ registerCommands 가 실제 등록하는 집합.
// 코어는 매니페스트에 없는 명령의 등록을 거부하고(undeclared → 런타임 거부), 선언만 하고 등록 안 한
// 명령은 호출 시 사라진다(unregistered → dead 표면). 양방향 동치를 강제해 둘 다 막는다.
//
// 등록 표면 introspection: 가짜 ctx 의 commands.register 로 이름을 수집한다(핸들러는 호출 안 함).
// plugin.json 은 resolveJsonModule 정적 import(이 플러그인엔 @types/node 가 없어 node:fs 회피).
import { describe, it, expect } from "vitest";
import pluginJson from "../../plugin.json";
import { registerCommands } from "./index";
import { createStore } from "./store";

type Sub = { dispose(): void } | (() => void);

function collectRegistered(): string[] {
  const names: string[] = [];
  const ctx = {
    subscriptions: [] as Sub[],
    dir: "/tmp/soksak-design-astryx-conformance",
    manifest: { id: pluginJson.id, version: pluginJson.version },
    app: {
      commands: {
        register(name: string): Sub {
          names.push(name);
          return { dispose() {} };
        },
      },
      fs: {},
    },
  };
  const store = createStore({ projectId: null, dir: ctx.dir });
  registerCommands(ctx as unknown as Parameters<typeof registerCommands>[0], store);
  store.dispose();
  return names;
}

function declaredNames(): string[] {
  return (pluginJson.contributes.commands as Array<{ name: string }>).map((c) => c.name);
}

describe("적합성: 선언 ≡ 등록", () => {
  const declared = declaredNames();
  const registered = collectRegistered();

  it("등록된 모든 명령은 plugin.json 에 선언돼 있다(undeclared 등록 금지)", () => {
    const declaredSet = new Set(declared);
    const undeclared = registered.filter((n) => !declaredSet.has(n));
    expect(undeclared).toEqual([]);
  });

  it("선언된 모든 명령은 실제로 등록된다(dead 선언 금지)", () => {
    const registeredSet = new Set(registered);
    const unregistered = declared.filter((n) => !registeredSet.has(n));
    expect(unregistered).toEqual([]);
  });

  it("이름 중복 없음(양쪽 다 유일)", () => {
    expect(new Set(declared).size).toBe(declared.length);
    expect(new Set(registered).size).toBe(registered.length);
  });

  it("집계 일치 — 고정 명령 표면 28개(26 + canvas.select/canvas.set)", () => {
    expect(registered.length).toBe(declared.length);
    expect(declared.length).toBe(28);
  });
});
