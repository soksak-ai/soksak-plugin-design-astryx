// 페이지 이름 → 내보내기 파일명(kebab-case + .tsx) 및 export 함수 식별자(PascalCase).
// 유니코드/특수문자만으로 이뤄진 이름은 ASCII 로 못 뽑아내므로 안전한 폴백(page / Page)을 쓴다.

// "Landing Page" / "LandingPage" / "landing_page" → "landing-page". 빈 결과는 "page".
export function kebab(s: string): string {
  const out = s
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2") // camelCase 경계
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2") // 연속 대문자 뒤 단어 경계(HTTPServer → HTTP-Server)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // 나머지(공백·기호·유니코드) → 하이픈
    .replace(/^-+|-+$/g, ""); // 양끝 하이픈 제거
  return out || "page";
}

// 페이지 이름 → 파일명. §10: kebab-case + ".tsx".
export function tsxFilename(pageName: string): string {
  return `${kebab(pageName)}.tsx`;
}

// 페이지 이름 → export default 함수 식별자. ASCII 단어들을 PascalCase 로 잇고, 선행 숫자 제거,
// 뽑을 게 없으면 "Page". (식별자는 문자로 시작해야 하고 유효한 JS 이름이어야 한다.)
export function componentName(pageName: string): string {
  const words = pageName.match(/[A-Za-z0-9]+/g) ?? [];
  const joined = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
  const name = joined.replace(/^[0-9]+/, "");
  return name || "Page";
}
