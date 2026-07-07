// export.tsx 통합 순수부 테스트 — 산출 TSX 를 TypeScript 컴파일러 API 로 transpile 해
// 구문 진단(diagnostics) 0 을 단언한다(§10: "valid TSX"). transpileModule 은 타입검사가 아니라
// 구문/경량 검사만 하므로 미해결 import 는 오류가 아니다 → 순수 구문 유효성만 검증된다.
import { describe, it, expect } from "vitest";
import * as ts from "typescript";
import type { DesignNode, DesignPage } from "../types";
import { exportPageToTsx, type ExportResult } from "./export-tsx";

// 산출 TSX → 구문 진단 목록. 빈 배열 = 구문상 유효.
function syntaxDiagnostics(tsx: string): readonly ts.Diagnostic[] {
  const out = ts.transpileModule(tsx, {
    fileName: "export.tsx",
    reportDiagnostics: true,
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  return out.diagnostics ?? [];
}

function assertCompiles(tsx: string): void {
  const diags = syntaxDiagnostics(tsx);
  const msgs = diags.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
  expect(msgs).toEqual([]);
}

function ok(r: ExportResult | { ok: false }): ExportResult {
  expect("ok" in r && r.ok === false).toBe(false);
  return r as ExportResult;
}

const leaf = (id: string, type: string, props: Record<string, unknown> = {}): DesignNode => ({
  id,
  type,
  props: props as DesignNode["props"],
  children: [],
});

const page = (name: string, root: DesignNode): DesignPage => ({
  id: "p1",
  name,
  source: { kind: "tree", root },
});

describe("exportPageToTsx — 형태", () => {
  it("barrel named import(정렬·중복제거) + Theme 래퍼 + default 함수", () => {
    const root: DesignNode = {
      id: "n1",
      type: "Stack",
      props: { gap: "md" },
      children: [
        {
          id: "n2",
          type: "Card",
          props: {},
          children: [
            leaf("n3", "Text", { children: "Hello" }),
            leaf("n4", "Button", { label: "Save", disabled: true }),
          ],
        },
      ],
    };
    const r = ok(exportPageToTsx(page("Card Demo", root), "neutral"));
    expect(r.filename).toBe("card-demo.tsx");
    expect(r.tsx).toBe(
      [
        "import { Button, Card, Stack, Text, Theme } from '@astryxdesign/core';",
        "",
        "export default function CardDemo() {",
        "  return (",
        '    <Theme theme="neutral">',
        '      <Stack gap="md">',
        "        <Card>",
        "          <Text>",
        "            Hello",
        "          </Text>",
        '          <Button disabled label="Save" />',
        "        </Card>",
        "      </Stack>",
        "    </Theme>",
        "  );",
        "}",
        "",
      ].join("\n"),
    );
    assertCompiles(r.tsx);
  });

  it("Theme 은 트리에 없어도 항상 import + 중복 시 한 번만", () => {
    const root: DesignNode = {
      id: "n1",
      type: "Theme",
      props: {},
      children: [leaf("n2", "Button")],
    };
    const r = ok(exportPageToTsx(page("x", root), "gothic"));
    expect(r.tsx.startsWith("import { Button, Theme } from '@astryxdesign/core';")).toBe(true);
    assertCompiles(r.tsx);
  });
});

describe("exportPageToTsx — 모든 prop 종류가 컴파일된다", () => {
  it("string/number/boolean/enum/null/array/object + 이스케이프 대상", () => {
    const root: DesignNode = {
      id: "n1",
      type: "Stack",
      props: {},
      children: [
        leaf("n2", "Box", {
          label: "Save",
          quotedStr: 'a"b',
          braceStr: "x{y}",
          multiline: "l1\nl2",
          count: 42,
          ratio: -1.5,
          flagOn: true,
          flagOff: false,
          variant: "primary", // enum 값도 결국 문자열
          meta: null,
          items: ["x", "y", 3],
          obj: { a: 1, nested: { b: [true, null] } },
        }),
      ],
    };
    const r = ok(exportPageToTsx(page("Props Zoo", root), "stone"));
    assertCompiles(r.tsx);
  });
});

describe("exportPageToTsx — 깊은 중첩", () => {
  it("여러 단계 중첩이 유효 TSX 로 컴파일", () => {
    let node: DesignNode = leaf("leaf", "Text", { children: "deep" });
    for (let i = 0; i < 6; i++) {
      node = { id: `w${i}`, type: "Stack", props: { gap: "sm" }, children: [node] };
    }
    const r = ok(exportPageToTsx(page("Nested", node), "matcha"));
    assertCompiles(r.tsx);
  });
});

describe("exportPageToTsx — 유니코드 텍스트", () => {
  it("한글·이모지·악센트 텍스트가 raw 로 렌더되고 컴파일", () => {
    const root: DesignNode = {
      id: "n1",
      type: "Card",
      props: {},
      children: [
        leaf("n2", "Text", { children: "안녕하세요 세계 🌏 Café — déjà vu" }),
        leaf("n3", "Text", { children: "R&D <tag> {expr}" }), // 특수문자 → 표현식 컨테이너
      ],
    };
    const r = ok(exportPageToTsx(page("유니코드 페이지", root), "y2k"));
    expect(r.filename).toBe("page.tsx"); // 유니코드-only 이름은 page 폴백
    expect(r.tsx).toContain("안녕하세요 세계 🌏 Café — déjà vu");
    expect(r.tsx).toContain('{"R&D <tag> {expr}"}');
    assertCompiles(r.tsx);
  });
});

describe("exportPageToTsx — children prop 비-문자열", () => {
  it("number/object children prop 도 표현식 자식으로 컴파일", () => {
    const root: DesignNode = {
      id: "n1",
      type: "Stack",
      props: {},
      children: [leaf("n2", "Badge", { children: 7 }), leaf("n3", "Meta", { children: { k: 1 } })],
    };
    const r = ok(exportPageToTsx(page("child-values", root), "butter"));
    expect(r.tsx).toContain("{7}");
    expect(r.tsx).toContain('{{"k":1}}');
    assertCompiles(r.tsx);
  });
});

describe("exportPageToTsx — 단일 루트/self-close", () => {
  it("빈 루트는 self-close 요소로", () => {
    const r = ok(exportPageToTsx(page("Empty", leaf("n1", "Stack")), "chocolate"));
    expect(r.tsx).toContain("      <Stack />");
    assertCompiles(r.tsx);
  });
});

describe("exportPageToTsx — tsx 페이지", () => {
  it("tsx 페이지는 source.code 를 그대로 반환(재직렬화 없음, §10)", () => {
    const code =
      "'use client';\nimport { Button } from '@astryxdesign/core';\nexport default function Demo() {\n  return <Button label=\"Go\" />;\n}\n";
    const tsxPage: DesignPage = {
      id: "p1",
      name: "AI Chat",
      source: { kind: "tsx", code, origin: "pages/ai-chat" },
    };
    const r = ok(exportPageToTsx(tsxPage, "neutral"));
    expect(r.tsx).toBe(code); // 바이트 동일 — verbatim
    expect(r.filename).toBe("ai-chat.tsx");
    assertCompiles(r.tsx);
  });
});

describe("exportPageToTsx — 실패 축", () => {
  it("소스가 없으면 EXPORT_FAILED(대칭 봉투)", () => {
    const bad = { id: "p1", name: "x", source: undefined } as unknown as DesignPage;
    const r = exportPageToTsx(bad, "neutral");
    expect(r).toEqual({
      ok: false,
      code: "EXPORT_FAILED",
      message: expect.stringContaining("TSX 내보내기 실패"),
    });
  });

  it("tree 소스인데 루트가 없으면 EXPORT_FAILED", () => {
    const bad = {
      id: "p1",
      name: "x",
      source: { kind: "tree", root: undefined },
    } as unknown as DesignPage;
    const r = exportPageToTsx(bad, "neutral");
    expect(r).toEqual({
      ok: false,
      code: "EXPORT_FAILED",
      message: expect.stringContaining("TSX 내보내기 실패"),
    });
  });
});
