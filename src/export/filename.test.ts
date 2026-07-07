// filename/componentName 순수부 단위테스트.
import { describe, it, expect } from "vitest";
import { kebab, tsxFilename, componentName } from "./filename";

describe("kebab", () => {
  it("공백 이름을 kebab 으로", () => {
    expect(kebab("Dashboard Home")).toBe("dashboard-home");
  });
  it("camelCase 경계를 나눈다", () => {
    expect(kebab("LandingPage")).toBe("landing-page");
  });
  it("연속 대문자 뒤 단어 경계", () => {
    expect(kebab("HTTPServer")).toBe("http-server");
  });
  it("기호·언더스코어를 하이픈으로 접는다", () => {
    expect(kebab("hero_split!!v2")).toBe("hero-split-v2");
  });
  it("숫자를 보존한다", () => {
    expect(kebab("y2k theme")).toBe("y2k-theme");
  });
  it("빈/유니코드-only 는 page 폴백", () => {
    expect(kebab("")).toBe("page");
    expect(kebab("페이지")).toBe("page");
    expect(kebab("   ")).toBe("page");
  });
});

describe("tsxFilename", () => {
  it(".tsx 확장자를 붙인다", () => {
    expect(tsxFilename("Dashboard Home")).toBe("dashboard-home.tsx");
    expect(tsxFilename("페이지")).toBe("page.tsx");
  });
});

describe("componentName", () => {
  it("단어들을 PascalCase 로 잇는다", () => {
    expect(componentName("landing page")).toBe("LandingPage");
    expect(componentName("Dashboard")).toBe("Dashboard");
  });
  it("선행 숫자를 제거한다(식별자 규칙)", () => {
    expect(componentName("123 test")).toBe("Test");
  });
  it("숫자 포함 단어의 첫 글자만 대문자화", () => {
    expect(componentName("y2k theme")).toBe("Y2kTheme");
  });
  it("뽑을 ASCII 가 없으면 Page 폴백", () => {
    expect(componentName("페이지")).toBe("Page");
    expect(componentName("")).toBe("Page");
    expect(componentName("123")).toBe("Page");
  });
});
