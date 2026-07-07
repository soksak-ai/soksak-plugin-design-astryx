import { describe, it, expect } from "vitest";
import { isErr, errMsg, asString, asNonEmptyString, asNumber, asRecord } from "./envelope";
import { err } from "../types";

describe("isErr", () => {
  it("성공 데이터 레코드(ok 키 없음)는 Err 가 아니다", () => {
    expect(isErr({ nodeId: "n1" })).toBe(false);
    expect(isErr({ ok: true, x: 1 })).toBe(false);
    expect(isErr({})).toBe(false);
  });

  it("{ok:false,...} 는 Err 다", () => {
    expect(isErr(err("NOT_FOUND", "없음"))).toBe(true);
    expect(isErr({ ok: false, code: "X", message: "y" })).toBe(true);
  });

  it("객체가 아니면 Err 가 아니다", () => {
    expect(isErr(null)).toBe(false);
    expect(isErr(undefined)).toBe(false);
    expect(isErr("no")).toBe(false);
    expect(isErr(0)).toBe(false);
  });
});

describe("errMsg", () => {
  it("Error 는 message 를 준다", () => {
    expect(errMsg(new Error("boom"))).toBe("boom");
  });
  it("문자열 throw 는 그대로", () => {
    expect(errMsg("string reject")).toBe("string reject");
  });
  it("객체는 JSON 문자열화", () => {
    expect(errMsg({ a: 1 })).toBe('{"a":1}');
  });
});

describe("coercion", () => {
  it("asString 은 문자열만 통과", () => {
    expect(asString("x")).toBe("x");
    expect(asString("")).toBe("");
    expect(asString(1)).toBeUndefined();
    expect(asString(null)).toBeUndefined();
  });

  it("asNonEmptyString 은 공백 아닌 문자열만", () => {
    expect(asNonEmptyString("x")).toBe("x");
    expect(asNonEmptyString("  ")).toBeUndefined();
    expect(asNonEmptyString("")).toBeUndefined();
    expect(asNonEmptyString(3)).toBeUndefined();
  });

  it("asNumber 는 유한수만", () => {
    expect(asNumber(3)).toBe(3);
    expect(asNumber(0)).toBe(0);
    expect(asNumber(NaN)).toBeUndefined();
    expect(asNumber(Infinity)).toBeUndefined();
    expect(asNumber("3")).toBeUndefined();
  });

  it("asRecord 는 평범한 객체만(배열/null 제외)", () => {
    expect(asRecord({ a: 1 })).toEqual({ a: 1 });
    expect(asRecord([])).toBeUndefined();
    expect(asRecord(null)).toBeUndefined();
    expect(asRecord("x")).toBeUndefined();
  });
});
