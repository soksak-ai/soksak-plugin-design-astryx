import { describe, it, expect } from "vitest";
import {
  buildExample,
  errData,
  forwardedExample,
  suggestTypes,
  validPropNames,
} from "./actionable";
import { fixtureCatalog } from "./fixtures";

const cat = fixtureCatalog();

describe("suggestTypes", () => {
  const names = ["Button", "Card", "Stack", "Text"];

  it("ranks the closest name first for a one-edit typo", () => {
    expect(suggestTypes("Buton", names)[0]).toBe("Button");
    expect(suggestTypes("Stac", names)[0]).toBe("Stack");
  });

  it("is case-insensitive", () => {
    expect(suggestTypes("button", names)).toContain("Button");
  });

  it("boosts substring matches", () => {
    expect(suggestTypes("Butt", names)).toContain("Button");
  });

  it("drops far-off candidates below the threshold", () => {
    expect(suggestTypes("Zephyr", names)).toEqual([]);
  });

  it("caps at the limit and is deterministic", () => {
    const many = ["Button", "Buttons", "Buttonx", "Buttony", "Buttonz", "Buttonw"];
    const out = suggestTypes("Button", many, 3);
    expect(out).toHaveLength(3);
    expect(out[0]).toBe("Button");
  });
});

describe("validPropNames", () => {
  it("lists catalog props plus the universal forwarded props, no duplicates", () => {
    const names = validPropNames(cat.Button);
    expect(names).toContain("label");
    expect(names).toContain("variant");
    expect(names).toContain("className");
    expect(names).toContain("style");
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("buildExample", () => {
  it("fills required scalar props with type-appropriate placeholders", () => {
    // Button.label 은 required string → "text".
    expect(buildExample(cat.Button).props.label).toBe("text");
  });

  it("does not put a required children into example props (structural channel)", () => {
    // Text.children 은 required ReactNode 가 아니라 optional 이지만, children 은 예시 props 에서 제외한다.
    expect(buildExample(cat.Text).props).not.toHaveProperty("children");
  });

  it("focuses a specific prop with its own valid value (enum → first member)", () => {
    expect(buildExample(cat.Button, "variant").props.variant).toBe("primary");
  });
});

describe("forwardedExample", () => {
  it("className example is a string, style example uses a token", () => {
    expect(typeof forwardedExample(cat.Button, "className").props.className).toBe("string");
    expect(forwardedExample(cat.Button, "style").props.style).toEqual({ color: "var(--color-fg)" });
  });
});

describe("errData", () => {
  it("builds a failure envelope carrying data", () => {
    const e = errData("INVALID_TYPE", "no", { suggestions: ["Button"] });
    expect(e.ok).toBe(false);
    expect(e.code).toBe("INVALID_TYPE");
    expect(e.data).toEqual({ suggestions: ["Button"] });
  });
});
