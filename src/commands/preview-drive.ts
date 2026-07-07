// 브라우저 구동 — chromium 우선·native 폴백(CONTRACT §7). exec 를 주입받아 순수하게 유지(테스트 가능).
// 여기서는 아티팩트를 만들지 않는다(그건 src/preview) — 이미 만들어진 url 로 브라우저 의존 플러그인만 몬다.
import type { CommandOutcome } from "../types";

export type Engine = "chromium" | "native";

// 의존 플러그인 id(CONTRACT §8, plugin.json dependencies 와 동일 — 미선언이면 코어가 호출경계를 막는다).
export const CHROMIUM_ID = "soksak-plugin-browser-chromium";
export const NATIVE_ID = "soksak-plugin-browser-native";

// 중첩 실행 통로 — inv.execute(§5 유래·상관 계승). app.commands.execute 를 쓰지 않는다.
export type Exec = (name: string, params?: Record<string, unknown>) => Promise<CommandOutcome>;

// 엔진 → 대상 플러그인 id.
export function engineId(engine: Engine): string {
  return engine === "chromium" ? CHROMIUM_ID : NATIVE_ID;
}

// 엔진 탐지 — 보편 ping 으로 가용성 확인. chromium ok ⇒ chromium, else native ok ⇒ native,
// 둘 다 실패 ⇒ null(호출부가 DEP_MISSING 으로 매핑). ping 은 danger 없음 → "commands" 로 충분.
export async function probeEngine(exec: Exec): Promise<Engine | null> {
  if (await pingOk(exec, CHROMIUM_ID)) return "chromium";
  if (await pingOk(exec, NATIVE_ID)) return "native";
  return null;
}

async function pingOk(exec: Exec, id: string): Promise<boolean> {
  try {
    const out = await exec(`plugin.${id}.ping`, {});
    return !!out && out.ok === true;
  } catch {
    // 미설치·비활성·예외는 전부 "가용 아님"으로 흡수(다음 후보로 폴백).
    return false;
  }
}

// 브라우저 구동 — open(최초) / navigate(갱신). url 은 app.fs.url 값. 예외는 non-ok 봉투로 흡수.
export async function driveBrowser(
  exec: Exec,
  engine: Engine,
  action: "open" | "navigate",
  url: string,
): Promise<CommandOutcome> {
  const name = `plugin.${engineId(engine)}.${action}`;
  try {
    return await exec(name, { url });
  } catch (e) {
    return { ok: false, code: "PREVIEW_FAILED", message: e instanceof Error ? e.message : String(e) };
  }
}
