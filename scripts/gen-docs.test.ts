// docs 완전성 법 테스트(CONTRACT §14) — generated/docs.json 이 소스 토픽 집합과 정확히 일치하는가.
// 카탈로그 법 테스트와 같은 스타일: 소스에서 기계적으로 토픽을 재계산해 산출과 집합 동일성을 단언한다
// (어느 방향 드리프트도 실패). fs 를 쓰므로 scripts/(tsconfig include 밖)에 둔다 — 템플릿 법 테스트 선례.
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error — .mjs 순수 함수 모듈(빌드 스크립트).
import { generate, topicsFromFiles, discoverTopics, resolveTopicFile } from "./gen-docs.mjs";
// @ts-expect-error — 생성기가 쓴 커밋 소스(런타임 데이터).
import { DOCS } from "../src/docs/docs.embedded.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GEN = path.join(ROOT, "generated");
const DOCS_DIR = path.join(ROOT, "node_modules/@astryxdesign/cli/docs");
const read = (rel: string) => JSON.parse(readFileSync(path.join(GEN, rel), "utf8"));

interface DocTopic { title: string; dense: boolean; description: string; text: string }
interface Report { sourceCount: number; topics: string[]; dense: string[]; plain: string[] }

let docsJson: Record<string, DocTopic>;
let report: Report;

beforeAll(async () => {
  // generated/ 는 git-ignore(§12) — 산출물이 없으면(클린 트리 `vitest run`) 즉석 생성해 자족한다.
  if (!existsSync(path.join(GEN, "docs.json")) || !existsSync(path.join(GEN, "docs-report.json"))) {
    await generate();
  }
  docsJson = read("docs.json");
  report = read("docs-report.json");
});

// 소스 디렉토리에서 기계적으로 재계산한 토픽 집합(생성기와 같은 규칙, 독립 계산).
function mechanicalTopics(): string[] {
  return readdirSync(DOCS_DIR)
    .filter((f) => f.endsWith(".doc.mjs"))
    .map((f) => f.slice(0, -".doc.mjs".length))
    .sort();
}

describe("완전성(CONTRACT §14)", () => {
  it("docs.json 키 == 소스 토픽 집합(드리프트 0, 침묵 드랍 0)", () => {
    expect(Object.keys(docsJson).sort()).toEqual(mechanicalTopics());
  });

  it("report.topics == 소스 토픽, sourceCount == 개수", () => {
    expect(report.topics.slice().sort()).toEqual(mechanicalTopics());
    expect(report.sourceCount).toBe(report.topics.length);
    expect(report.dense.length + report.plain.length).toBe(report.sourceCount);
  });

  it("생성기 순수 헬퍼 topicsFromFiles 는 변형(.dense/.zh)을 배제한다", () => {
    const files = [
      "layout.doc.mjs",
      "layout.doc.dense.mjs",
      "principles.doc.mjs",
      "principles.doc.dense.mjs",
      "principles.doc.zh.mjs",
      "color.doc.mjs",
    ];
    expect(topicsFromFiles(files)).toEqual(["color", "layout", "principles"]);
  });
});

describe("dense 우선 선택(§14)", () => {
  it("dense 변형이 있는 토픽만 dense=true, 그 외는 false", async () => {
    const topics: string[] = await discoverTopics();
    for (const topic of topics) {
      const { dense } = await resolveTopicFile(topic);
      expect(docsJson[topic].dense, topic).toBe(dense);
    }
    // 알려진 4개(layout/principles/theme/tokens)는 dense.
    expect(report.dense.slice().sort()).toEqual(["layout", "principles", "theme", "tokens"]);
  });
});

describe("커밋 소스 드리프트 가드", () => {
  it("src/docs/docs.embedded.ts DOCS == generated/docs.json(동일 산출)", () => {
    expect(DOCS).toEqual(docsJson);
  });

  it("모든 엔트리는 title/description/text 비어있지 않음", () => {
    for (const [topic, e] of Object.entries(docsJson)) {
      expect(e.title.length, topic).toBeGreaterThan(0);
      expect(e.description.length, topic).toBeGreaterThan(0);
      expect(e.text.length, topic).toBeGreaterThan(0);
    }
  });
});
