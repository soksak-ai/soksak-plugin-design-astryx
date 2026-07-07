// @vitest-environment jsdom
// 프레임 검증(§7 Chrome law) — ThemeScope 의 중첩 테마 공급(data-astryx-theme·color-scheme·ThemeContext)과
// CanvasFrame 이 astryx Layout 슬롯(header/start/content/end)에 4 콘텐츠를 배치하는지 jsdom 에서 실제로 그린다.
import { describe, it, expect, beforeEach } from "vitest";
import { act } from "react";
import { createContext, createElement, useContext, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { ThemeScope, CanvasFrame } from "./frame";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(el: ReactElement): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(el);
  });
  return container;
}

describe("ThemeScope", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("data-astryx-theme·color-scheme 를 래퍼에 얹고 ThemeContext 로 { theme, mode } 를 공급한다", () => {
    const Ctx = createContext<unknown>(null);
    const Probe = (): ReactElement => {
      const v = useContext(Ctx) as { theme: unknown; mode: string } | null;
      return createElement("span", { "data-testid": "probe" }, JSON.stringify(v));
    };
    const container = mount(
      createElement(
        ThemeScope,
        {
          theme: "butter",
          mode: "dark",
          themeObjects: { butter: { tone: "b" } },
          ThemeContext: Ctx as unknown as React.Context<unknown>,
        },
        createElement(Probe),
      ),
    );
    const wrapper = container.querySelector("[data-astryx-theme]") as HTMLElement;
    expect(wrapper.getAttribute("data-astryx-theme")).toBe("butter");
    expect(wrapper.style.colorScheme).toBe("dark");
    const probe = container.querySelector('[data-testid="probe"]')!;
    expect(probe.textContent).toContain('"tone":"b"');
    expect(probe.textContent).toContain('"mode":"dark"');
  });

  it("built 객체가 없으면 neutral 로, 그것도 없으면 null 로 폴백(크래시 없음)", () => {
    const Ctx = createContext<unknown>(null);
    const Probe = (): ReactElement => {
      const v = useContext(Ctx) as { theme: unknown } | null;
      return createElement("span", { "data-testid": "p" }, v && v.theme === null ? "null" : "obj");
    };
    const container = mount(
      createElement(
        ThemeScope,
        {
          theme: "gothic",
          mode: "system",
          themeObjects: {}, // 스텁 — neutral 도 없음 → null.
          ThemeContext: Ctx as unknown as React.Context<unknown>,
        },
        createElement(Probe),
      ),
    );
    expect(container.querySelector('[data-testid="p"]')!.textContent).toBe("null");
    const wrapper = container.querySelector("[data-astryx-theme]") as HTMLElement;
    expect(wrapper.style.colorScheme).toBe("light dark"); // system.
  });
});

describe("CanvasFrame", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("4 슬롯(header·structure·canvas·inspector)을 전부 그린다", () => {
    const slot = (id: string): ReactElement =>
      createElement("div", { "data-testid": id }, id);
    const container = mount(
      createElement(CanvasFrame, {
        header: slot("h"),
        structure: slot("s"),
        canvas: slot("c"),
        inspector: slot("i"),
      }),
    );
    for (const id of ["h", "s", "c", "i"]) {
      expect(container.querySelector(`[data-testid="${id}"]`)).toBeTruthy();
    }
  });
});
