// Shadow CSS 조립(CONTRACT §7 Mount law) — main.js 는 blob 이라 sibling 파일을 못 읽으므로 CSS 는
// 빌드 define(__ASTRYX_CSS__·__THEME_CSS_MAP__)으로 임베드돼 온다(§12). 뷰는 그 원문을 shadow 안
// <style> 로 주입하되 :root 를 :host 로 재작성한다 — shadow 경계 안에서 토큰이 host 에 얹히도록.

// :root → :host 재작성(§7 (2)). astryx 토큰 블록은 `:root, .xhash {…}` 쌍으로 실려 오므로 이 치환이
// drop-in 이다(→ `:host, .xhash {…}`, 토큰이 shadow host 에 얹혀 하위로 상속). 테마 파일의 단독
// `:root { color-scheme }` 한 줄도 함께 :host 로 바뀌지만 래퍼의 인라인 color-scheme 이 authoritative
// 라 무해하다(§9). 셀렉터 `:root` 만 잡도록 단어경계를 쓴다.
export function rewriteRootToHost(css: string): string {
  return css.replace(/:root\b/g, ":host");
}

// shadow 에 주입할 전체 <style> 텍스트를 만든다: reset+astryx(:host 재작성) → 7 테마(:host 재작성).
// 테마는 각 파일이 @scope([data-astryx-theme="<name>"]) 로 자기 격리라 7개를 합쳐도 충돌 없다(§9);
// data-astryx-theme 가 일치하는 블록만 활성화된다. 반환은 순서가 고정된 단일 문자열(레이어 순서 보존).
export function buildShadowCss(astryxCss: string, themeCssMap: Record<string, string>): string {
  const parts: string[] = [rewriteRootToHost(astryxCss)];
  for (const name of Object.keys(themeCssMap)) {
    parts.push(rewriteRootToHost(themeCssMap[name]));
  }
  return parts.join("\n");
}
