// 문서 수준 순수 함수 — 요약·조회·테마. 빈 문서 생성/영속값 강제(coerce)의 단일 진실은
// src/commands/store.ts(freshDoc/coerceDoc, 런타임 영속 경로)다 — 이 모듈은 그 문서를 읽는 조회만 소유한다.
import type { DesignDoc, DesignPage, ThemeName } from "../types";
import { THEMES, err, type Err } from "../types";
import { summarizePage, type PageSummary } from "./tree";

// state·page.list 가 쓰는 페이지 요약 배열.
export function pageSummaries(doc: DesignDoc): PageSummary[] {
  return doc.pages.map(summarizePage);
}

// 페이지 원본 조회(preview·export·theme.set 재emit 용) — 없으면 undefined.
export function getPage(doc: DesignDoc, pageId: string): DesignPage | undefined {
  return doc.pages.find((p) => p.id === pageId);
}

// theme.set 의 모델 축 — activeTheme 만 검증·설정(previewRefreshed 는 명령 계층 I/O).
export function setTheme(doc: DesignDoc, theme: string): { theme: ThemeName } | Err {
  if (!THEMES.includes(theme as ThemeName)) {
    return err("THEME_UNKNOWN", `테마 '${theme}' 는 알 수 없음.`);
  }
  doc.activeTheme = theme as ThemeName;
  return { theme: theme as ThemeName };
}
