// astryx CSS 를 Shadow DOM 에 주입하기 위한 :root→:host 재작성 — 빌드타임 단일 지점(§7 Mount law, §12).
// astryx.css 토큰 블록은 `:root, .xhash{…}` 쌍으로 나오고, 각 theme.css 는 선두에 `:root { color-scheme }`
// 한 줄을 둔다(gothic 은 없음 — 다크 전용). 둘 다 :root 를 :host 로 바꿔야 토큰이 shadow 호스트에 안착한다.
// 정밀 매칭: `:root` 뒤가 단어문자/하이픈이면 건드리지 않는다(가상의 :root-x 방어). custom property(--root)
// 와 class(.root)는 콜론 프리픽스가 없어 애초에 걸리지 않는다. 멱등: :host 에는 :root 가 없어 재적용이 무해.
const ROOT_TOKEN = /:root(?![\w-])/g;

export function rewriteRootToHost(css) {
  if (typeof css !== "string") {
    throw new TypeError(`[design-astryx] rewriteRootToHost: 문자열이 아님(${typeof css}).`);
  }
  return css.replace(ROOT_TOKEN, ":host");
}
