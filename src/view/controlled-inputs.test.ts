// 제어 입력 파생 검증 — value + on* 콜백 을 가진 컴포넌트만(표시전용 value 는 제외).
import { describe, it, expect } from "vitest";
import { deriveControlledInputs } from "./controlled-inputs";
import type { CatalogEntry } from "../types";

function entry(type: string, props: CatalogEntry["props"]): CatalogEntry {
  return { type, importName: type, description: type, props, acceptsChildren: false };
}
function p(t: string): CatalogEntry["props"][string] {
  return { type: t, required: false, description: "" };
}

describe("deriveControlledInputs", () => {
  it("value + on* 콜백 = 제어 입력", () => {
    const set = deriveControlledInputs([
      entry("TextInput", { value: p("string"), onChange: p("(v: string) => void") }),
    ]);
    expect(set.has("TextInput")).toBe(true);
  });

  it("value 는 있으나 콜백 없음(ProgressBar) = 제외", () => {
    const set = deriveControlledInputs([entry("ProgressBar", { value: p("number") })]);
    expect(set.has("ProgressBar")).toBe(false);
  });

  it("value 없음 = 제외", () => {
    const set = deriveControlledInputs([entry("Card", { title: p("string"), onClick: p("() => void") })]);
    expect(set.has("Card")).toBe(false);
  });

  it("on* 이지만 콜백 타입 아님(문자열) = 제외", () => {
    const set = deriveControlledInputs([entry("Weird", { value: p("string"), onLabel: p("string") })]);
    expect(set.has("Weird")).toBe(false);
  });
});
