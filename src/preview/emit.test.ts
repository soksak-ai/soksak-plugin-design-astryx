// 순수 미리보기 문서 조립 테스트 — CSS 순서·__DESIGN__ 주입·스크립트 탈출·경로 규범(§7).
import { describe, it, expect } from "vitest";
import {
  buildPreviewIndexHtml,
  selectThemeCss,
  escapeForScript,
  previewDir,
  previewPaths,
  type PreviewCssAssets,
} from "./emit";
import type { DesignPayload } from "../types";

const assets: PreviewCssAssets = {
  astryxCss: "/*A*/.astryx{color:red}",
  themeCss: { neutral: ":root{--x:1}", gothic: ":root{--x:2}" },
};
const payload: DesignPayload = {
  theme: "neutral",
  page: { kind: "tree", root: { id: "n1", type: "Stack", props: {}, children: [] } },
};

describe("buildPreviewIndexHtml", () => {
  it("임베드 순서: astryx(base) CSS 다음에 활성 테마 CSS", () => {
    const html = buildPreviewIndexHtml(payload, assets);
    const baseIdx = html.indexOf(".astryx{color:red}");
    const themeIdx = html.indexOf("--x:1");
    expect(baseIdx).toBeGreaterThan(-1);
    expect(themeIdx).toBeGreaterThan(baseIdx);
  });

  it("활성 테마 하나만 임베드(다른 테마 CSS 는 없음)", () => {
    const html = buildPreviewIndexHtml(payload, assets);
    expect(html).toContain("--x:1");
    expect(html).not.toContain("--x:2");
  });

  it("__DESIGN__ 스크립트가 runner.js 스크립트보다 앞", () => {
    const html = buildPreviewIndexHtml(payload, assets);
    const designIdx = html.indexOf("window.__DESIGN__");
    const runnerIdx = html.indexOf('src="./runner.js"');
    expect(designIdx).toBeGreaterThan(-1);
    expect(runnerIdx).toBeGreaterThan(designIdx);
  });

  it("직렬화된 페이로드를 담는다", () => {
    const html = buildPreviewIndexHtml(payload, assets);
    expect(html).toContain('"theme":"neutral"');
    expect(html).toContain('"type":"Stack"');
  });

  it("페이로드의 < 를 이스케이프해 </script> 탈출을 막는다", () => {
    const evil: DesignPayload = {
      theme: "neutral",
      page: {
        kind: "tree",
        root: {
          id: "n1",
          type: "Text",
          props: { children: "</script><script>alert(1)" },
          children: [],
        },
      },
    };
    const html = buildPreviewIndexHtml(evil, assets);
    expect(html).not.toContain("</script><script>alert(1)");
    expect(html).toContain("\\u003c/script>\\u003cscript>alert(1)");
  });

  it("tsx 페이지 페이로드는 code 를 __DESIGN__ 에 직렬화한다(§7 RunnerPage)", () => {
    const tsx: DesignPayload = {
      theme: "neutral",
      page: { kind: "tsx", code: "export default function P(){ return null; }" },
    };
    const html = buildPreviewIndexHtml(tsx, assets);
    expect(html).toContain('"kind":"tsx"');
    expect(html).toContain("export default function P");
  });

  it("완결된 독립 문서(doctype + #root)", () => {
    const html = buildPreviewIndexHtml(payload, assets);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<div id="root"></div>');
  });
});

describe("buildPreviewIndexHtml — 테마/모드 정적 스탬프(<html>)", () => {
  it("data-astryx-theme 를 <html> 에 찍는다(첫 페인트 토큰 상속)", () => {
    const html = buildPreviewIndexHtml(payload, assets);
    expect(html).toContain('data-astryx-theme="neutral"');
  });

  it("system(기본)은 data-theme 를 생략(reset.css OS 기본)", () => {
    const html = buildPreviewIndexHtml(payload, assets); // neutral, mode 없음 → system
    expect(html).not.toContain("data-theme=");
  });

  it('gothic 은 data-theme="dark"(다크 전용)', () => {
    const g: DesignPayload = { theme: "gothic", page: payload.page };
    const html = buildPreviewIndexHtml(g, assets);
    expect(html).toContain('data-astryx-theme="gothic"');
    expect(html).toContain('data-theme="dark"');
  });

  it("명시 mode=dark 를 <html data-theme> 로 반영", () => {
    const d = {
      theme: "neutral",
      mode: "dark",
      page: payload.page,
    } as unknown as DesignPayload;
    const html = buildPreviewIndexHtml(d, assets);
    expect(html).toContain('data-theme="dark"');
  });
});

describe("selectThemeCss", () => {
  it("활성 테마 CSS 를 고른다", () => {
    expect(selectThemeCss(assets.themeCss, "gothic")).toBe(":root{--x:2}");
  });
  it("없는 테마는 빈 문자열(방어적 폴백)", () => {
    expect(selectThemeCss(assets.themeCss, "butter")).toBe("");
  });
});

describe("escapeForScript", () => {
  it("모든 < 를 \\u003c 로", () => {
    expect(escapeForScript("a<b<c")).toBe("a\\u003cb\\u003cc");
  });
  it("< 없는 문자열은 그대로", () => {
    expect(escapeForScript('{"k":"v"}')).toBe('{"k":"v"}');
  });
});

describe("preview paths", () => {
  it(".preview 평면 레이아웃(CONTRACT §7) — writeText 는 부모 디렉토리를 만들지 않으므로 하위 폴더 금지", () => {
    expect(previewDir("/plug")).toBe("/plug/.preview");
    const p = previewPaths("/plug", "p3");
    expect(p.dirPath).toBe("/plug/.preview");
    expect(p.indexPath).toBe("/plug/.preview/p3.html");
    expect(p.runnerPath).toBe("/plug/.preview/runner.js");
  });
});
