// 템플릿 런타임 바인딩 — 빌드타임에 build.mjs 가 generated/templates.json 을 __TEMPLATES_JSON__
// 문자열 define 으로 주입한다(main.js 는 sibling 파일을 못 읽으므로). 여기서 파싱해 순수 로직에 넘긴다.
// 핸들러(template.list/template.apply/ping)는 이 모듈만 import 한다.

import type { TemplateEntry } from "../types";
import {
  listTemplates as _list,
  getTemplate as _get,
  type TemplateSummary,
  type TemplateListing,
  type UnavailableSummary,
} from "./logic";

// esbuild define 으로 치환되는 전역 문자열. 테스트/미빌드 환경(치환 없음)에선 안전하게 빈 배열.
declare const __TEMPLATES_JSON__: string;
const RAW: string = typeof __TEMPLATES_JSON__ !== "undefined" ? __TEMPLATES_JSON__ : "[]";
const ALL: TemplateEntry[] = JSON.parse(RAW) as TemplateEntry[];

export function templateCount(): number {
  return ALL.length;
}

export function listTemplates(
  opts: { kind?: "page" | "block"; includeUnavailable?: boolean } = {},
): TemplateListing {
  return _list(ALL, opts);
}

export function getTemplate(id: string): TemplateEntry | undefined {
  return _get(ALL, id);
}

export type { TemplateSummary, TemplateListing, UnavailableSummary };
