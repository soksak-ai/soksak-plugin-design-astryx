import { describe, it, expect } from "vitest";
import { compileGate, RUNNER_SUCRASE } from "./compile";
import { isErr } from "./envelope";
// 실제 출하 템플릿을 명령 게이트로 통과시켜 검증(§13 verbatim → §7 Gate B). generated/ 는
// gitignore(§12)라 npm run gen 선행이 전제 — templates-law.test.ts 와 동일한 산출물 의존.
import templatesJson from "../../generated/templates.json";

interface Tmpl {
  id: string;
  code: string;
  available: boolean;
}
const TEMPLATES = templatesJson as unknown as Tmpl[];

describe("compileGate", () => {
  it("유효한 'use client' TSX(훅·명명 import·타입·default export)는 통과(null)", () => {
    const code = `'use client';
import { useState } from 'react';
import { Button } from '@astryxdesign/core';
export default function Page() {
  const [n, setN] = useState<number>(0);
  return <Button onClick={() => setN(n + 1)}>count {n}</Button>;
}`;
    expect(compileGate(code, "p1.tsx")).toBeNull();
  });

  it("헬퍼 컴포넌트·미설치 모듈 import 도 문법만 맞으면 통과(모듈 해소는 러너 shim 소관)", () => {
    const code = `import Chart from 'recharts';
function Row() { return <li>row</li>; }
export default function Board() { return <ul><Row /><Chart /></ul>; }`;
    expect(compileGate(code, "p2.tsx")).toBeNull();
  });

  it("문법 오류(미종료 문자열)는 COMPILE_FAILED + message + data.diagnostics", () => {
    const bad = `export default function Broken() {
  const s = "unterminated
  return <div>{s}</div>;
}`;
    const r = compileGate(bad, "p3.tsx");
    expect(isErr(r)).toBe(true);
    if (r) {
      expect(r.code).toBe("COMPILE_FAILED");
      expect(r.message.length).toBeGreaterThan("TSX 컴파일 실패: ".length);
      expect(r.data).toBeDefined();
      expect(typeof (r.data as { diagnostics?: unknown }).diagnostics).toBe("string");
    }
  });

  it("설정은 CONTRACT §7 Gate B 를 못박는다", () => {
    expect(RUNNER_SUCRASE.transforms).toEqual(["typescript", "jsx", "imports"]);
    expect(RUNNER_SUCRASE.jsxRuntime).toBe("automatic");
    expect(RUNNER_SUCRASE.production).toBe(true);
    expect(RUNNER_SUCRASE.jsxImportSource).toBe("react");
  });

  it("실제 출하 템플릿 pages/ai-chat(verbatim)이 명령 게이트를 통과", () => {
    const ai = TEMPLATES.find((t) => t.id === "pages/ai-chat");
    expect(ai).toBeDefined();
    expect(ai!.available).toBe(true);
    expect(compileGate(ai!.code, "ai-chat.tsx")).toBeNull();
  });

  it("가용(available) 템플릿 전수가 명령 게이트를 통과", () => {
    const failed: string[] = [];
    for (const t of TEMPLATES) {
      if (!t.available) continue;
      if (compileGate(t.code, `${t.id}.tsx`) !== null) failed.push(t.id);
    }
    expect(failed).toEqual([]);
  });
});
