// docs 런타임 표면 테스트 — 구운 데이터(docs.embedded.ts, 커밋 소스)를 로더·질의로 검증한다.
// 소스 대비 완전성(기계적)은 scripts/gen-docs.test.ts(fs)가 소유한다. 여기선 런타임 계약만:
// 로더 형식 강제, docs.list 한 줄 요약, docs.get 본문, dense 우선 적용.
import { describe, it, expect } from "vitest";
import { DOCS } from "./docs.embedded";
import { loadDocs } from "./load";
import { listDocs, getTopic, docsCount } from "./query";
import type { DocsIndex } from "./types";

const docs = loadDocs(DOCS as unknown);

describe("docs 로더(형식 강제)", () => {
  it("구운 데이터는 로더를 통과한다(형식 유효)", () => {
    expect(docsCount(docs)).toBeGreaterThan(0);
  });

  it("모든 토픽: title/description/text 비어있지 않음, dense 는 불리언", () => {
    for (const [topic, e] of Object.entries(docs)) {
      expect(e.title.length, topic).toBeGreaterThan(0);
      expect(e.description.length, topic).toBeGreaterThan(0);
      expect(e.text.length, topic).toBeGreaterThan(0);
      expect(typeof e.dense).toBe("boolean");
    }
  });

  it("빈 객체·비객체·필드 결손은 명확히 throw", () => {
    expect(() => loadDocs({})).toThrow();
    expect(() => loadDocs(null)).toThrow();
    expect(() => loadDocs({ x: { title: "T", dense: false, description: "d" } })).toThrow(); // text 결손
    expect(() => loadDocs({ x: { title: "", dense: false, description: "d", text: "t" } })).toThrow(); // 빈 title
  });
});

describe("listDocs (docs.list)", () => {
  it("토픽 id 오름차순, 각 행은 topic/title/dense/description(본문 text 제외)", () => {
    const rows = listDocs(docs);
    expect(rows.length).toBe(docsCount(docs));
    const topics = rows.map((r) => r.topic);
    expect(topics).toEqual([...topics].sort());
    for (const r of rows) {
      expect(typeof r.topic).toBe("string");
      expect(r.title.length).toBeGreaterThan(0);
      expect(r.description.length).toBeGreaterThan(0);
      expect("text" in r).toBe(false); // 목록엔 본문을 싣지 않는다.
    }
  });
});

describe("getTopic (docs.get)", () => {
  it("존재하는 토픽은 전체 엔트리, 없는 토픽은 undefined", () => {
    const first = listDocs(docs)[0].topic;
    const e = getTopic(docs, first);
    expect(e?.text.length).toBeGreaterThan(0);
    expect(getTopic(docs, "no-such-topic")).toBeUndefined();
    // 프로토타입 키는 토픽으로 오인되지 않는다.
    expect(getTopic(docs, "constructor")).toBeUndefined();
    expect(getTopic(docs, "__proto__")).toBeUndefined();
  });
});

describe("dense 우선(공식 Meta 압축)", () => {
  it("layout/principles/theme/tokens 는 dense 변형을 쓴다", () => {
    const d = docs as DocsIndex;
    for (const t of ["layout", "principles", "theme", "tokens"]) {
      expect(getTopic(d, t)?.dense, t).toBe(true);
    }
  });

  it("dense 없는 토픽은 평문(dense=false)", () => {
    for (const t of ["color", "getting-started", "styling", "working-with-ai"]) {
      expect(getTopic(docs, t)?.dense, t).toBe(false);
    }
  });
});
