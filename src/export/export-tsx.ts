// export.tsx 명령의 순수 심장부: DesignPage → 컴파일 가능한 TSX 문자열.
// CONTRACT §10 규범. import 선언은 barrel named import(§10 리터럴 형식) — 트리에 등장하는 type
// 들 + Theme 을 중복 제거·정렬해 한 줄로. prop/children 직렬화는 serialize.ts 가 소유.
import type { DesignPage, ThemeName, Catalog } from "../types";
import { err, type Err } from "../types";
import { serializeNode, collectTypes, importNameFor } from "./serialize";
import { tsxFilename, componentName } from "./filename";

// 성공 산출물. 핸들러는 이걸 그대로 data 로 반환(성공 메시지는 register spec.message 소유).
export interface ExportResult {
  tsx: string;
  filename: string;
}

// 페이지를 TSX 파일 문자열로 내보낸다(§10, 두 종류). tsx 페이지는 source.code 를 그대로(진실),
// tree 페이지는 source.root 를 직렬화. 실패(표현 불가·소스 부재)는 err("EXPORT_FAILED", …).
// catalog 는 import 이름 매핑용(선택) — §6 에서 type === importName 이라 없으면 type 을 그대로 쓴다.
export function exportPageToTsx(
  page: DesignPage,
  theme: ThemeName,
  catalog?: Catalog,
): ExportResult | Err {
  try {
    const source = page?.source;
    if (!source) {
      return err("EXPORT_FAILED", "TSX 내보내기 실패: 페이지 소스가 없습니다.");
    }

    // tsx 페이지: 원본 코드가 진실 — 재직렬화 없이 그대로 반환(§10).
    if (source.kind === "tsx") {
      return { tsx: source.code, filename: tsxFilename(page.name) };
    }

    if (!source.root) {
      return err("EXPORT_FAILED", "TSX 내보내기 실패: 페이지 루트가 없습니다.");
    }

    const used = collectTypes(source.root).map((t) => importNameFor(t, catalog));
    const imports = [...new Set([...used, "Theme"])].sort();
    const importLine = `import { ${imports.join(", ")} } from '@astryxdesign/core';`;

    const body = serializeNode(source.root, catalog, 3);
    const fn = componentName(page.name);

    const tsx = [
      importLine,
      "",
      `export default function ${fn}() {`,
      "  return (",
      `    <Theme theme="${theme}">`,
      body,
      "    </Theme>",
      "  );",
      "}",
      "",
    ].join("\n");

    return { tsx, filename: tsxFilename(page.name) };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return err("EXPORT_FAILED", `TSX 내보내기 실패: ${detail}`);
  }
}
