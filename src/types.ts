// soksak-plugin-design-astryx 공유 타입 — 트리 모델·카탈로그·템플릿·메시지 봉투의 단일 진실.
// CONTRACT.md 가 규범 문서이고, 이 파일은 그 규범을 코드 타입으로 못박은 것이다.
// 구현자(카탈로그 생성기·명령 핸들러·러너·내보내기)는 전부 이 타입에 맞춘다.

// ── JSON 값 ─────────────────────────────────────────────────────────────────
// prop 값은 JSON 직렬화 가능한 값만(트리는 통째로 app.data 에 저장되고 __DESIGN__ 로 주입됨).
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

// ── 트리 모델 ───────────────────────────────────────────────────────────────

// 노드 = 한 Astryx 컴포넌트 인스턴스. type 은 카탈로그 CatalogEntry.type(=컴포넌트 export 이름).
// props = 스칼라/텍스트/콜백-불가 값(JSON). children = 구조적 합성 채널(유일) — 카탈로그
// acceptsChildren 이 true 인 type 만 비어있지 않을 수 있다. React 의 children prop 은 러너가
// node.children 로 채운다 → props 에 "children" 키를 두면서 동시에 node.children 를 채우는 것은 금지.
export interface DesignNode {
  id: string; // 문서 내 유일. 생성 규칙 = CONTRACT §2.
  type: string; // 카탈로그에 존재해야 함(INVALID_TYPE).
  props: Record<string, JsonValue>;
  children: DesignNode[];
}

// ── 페이지 소스 (v2 법칙: 두 페이지 종류) ────────────────────────────────────
// 페이지의 원본은 둘 중 하나다(CONTRACT §2):
//   - tree: comp.* 로 편집하는 트리(명령 주도 편집 표면). root = 유일 루트 노드.
//   - tsx: 원본 TSX 코드가 진실(source is truth). template.apply / page.create(kind:tsx) 로 생김.
//          origin = 유래 templateId(있으면). 619 shipped 템플릿을 무손실로 담는 채널.
// v1 root-only 페이지는 저장본에서 {kind:'tree', root} 로 제자리 강제(coerce)한다 — 마이그레이션
// 파일 없음, coerceDoc 이 hydrate 시점에 승격(§2·§11).
export type PageSource =
  | { kind: "tree"; root: DesignNode }
  | { kind: "tsx"; code: string; origin?: string };

export type PageKind = PageSource["kind"];

// 페이지 = id·이름·소스. 트리 페이지는 source.root, tsx 페이지는 source.code 가 진실.
export interface DesignPage {
  id: string; // 문서 내 유일.
  name: string;
  source: PageSource;
}

// 문서 = 한 프로젝트의 디자인. activeTheme 은 THEMES 중 하나.
// version 은 1 유지 — 페이지 소스 법칙은 포맷의 상위집합이라 별도 마이그레이션 판을 두지 않고
// coerceDoc 이 root-only 페이지를 {kind:'tree', root} 로 승격한다(§2·§11).
export interface DesignDoc {
  version: 1;
  activeTheme: ThemeName;
  mode?: ColorMode; // 색 모드(CONTRACT §9). 없으면 system 으로 읽는다. 구 문서 호환 위해 선택.
  pages: DesignPage[];
  seq: number; // id 생성 카운터(단조 증가, 재사용 없음) — CONTRACT §2.
}

// ── 색 모드 ─────────────────────────────────────────────────────────────────
// theme.set 이 스토어에 실어 미리보기·러너로 관통시키는 색 모드. system 은 OS 를 따른다(light-dark()).
// gothic 은 다크 전용이라 mode="light" 와 공존 못 한다(theme.set 이 INVALID_PROP 로 거부 — §9).
export type ColorMode = "light" | "dark" | "system";

export const COLOR_MODES: readonly ColorMode[] = ["light", "dark", "system"];

// ── 테마 ────────────────────────────────────────────────────────────────────
// 패키지 @astryxdesign/theme-<name> 의 <name>. 7종 고정(v1 전량).
export type ThemeName =
  | "butter"
  | "chocolate"
  | "gothic"
  | "matcha"
  | "neutral"
  | "stone"
  | "y2k";

export const THEMES: readonly ThemeName[] = [
  "butter",
  "chocolate",
  "gothic",
  "matcha",
  "neutral",
  "stone",
  "y2k",
];

// ── 카탈로그 ────────────────────────────────────────────────────────────────
// generated/catalog.json 의 엔트리. gen-catalog.mjs 가 @astryxdesign/core 에서 기계 생성.
// 집합 = core package.json exports 중 단일세그먼트 대문자 시작 subpath(^\.\/[A-Z][A-Za-z0-9]*$).
export interface CatalogPropSpec {
  type: string; // TS 타입 시그니처 문자열(doc.mjs PropDoc.type 원문).
  required: boolean; // doc.mjs required === true 일 때만 true.
  enum?: string[]; // type 이 문자열 리터럴 유니온이면 파싱된 멤버(작은따옴표 제거).
  default?: string; // doc.mjs PropDoc.default 원문(문자열). 없으면 생략.
  description: string; // doc.mjs PropDoc.description. doc 없으면 "".
}

export interface CatalogEntry {
  type: string; // = importName. 노드 type 이 이것과 매칭.
  importName: string; // barrel '@astryxdesign/core' 의 named export. type 과 동일.
  description: string; // doc.mjs usage.description || 컴포넌트 이름 폴백.
  props: Record<string, CatalogPropSpec>; // doc.mjs props. doc 없으면 .d.ts 폴백 파생.
  acceptsChildren: boolean; // props 에 name==="children"(ReactNode) 존재 여부에서 파생.
}

export type Catalog = Record<string, CatalogEntry>; // key = type.

// ── 템플릿 (v2 법칙: 원본 TSX 를 그대로 담는다) ──────────────────────────────
// generated/templates.json = 619 shipped 템플릿 전량. 각 엔트리는 원본 TSX 를 verbatim 으로 보관
// (트리 변환·스켈레톤 없음 — 구 변환 기계는 레거시 제거, git 이 기억한다). CONTRACT §13.
// available=false 이면 미설치/컴파일타임 의존(recharts·@astryxdesign/lab·@stylexjs/stylex 트랜스폼)
// 으로 렌더 불가 → reason 에 기계 판독 사유. template.apply 는 available=false 를 거부한다.
export type TemplateKind = "page" | "block";

export interface TemplateEntry {
  id: string; // 소스 상대경로 파생 slug(예: "pages/dashboard", "blocks/components/hero-split").
  kind: TemplateKind;
  name: string; // 사람이 읽는 표시명.
  code: string; // 원본 TSX 소스 그대로(진실). 러너가 sucrase 로 트랜스폼·마운트.
  requires: string[]; // import 하는 모듈 id 집합(예: react, @astryxdesign/core, lucide-react).
  available: boolean; // 러너가 렌더 가능한가(설치·트랜스폼 조건 충족).
  reason?: string; // available=false 사유(기계 판독). available=true 면 생략.
}

// ── 메시지 프로토콜 v1 (MESSAGE-PROTOCOL / CONTRACT §4) ─────────────────────
// 닫힌 코드 집합. 성공 = "OK". 실패 = 나머지 중 하나. 코어가 cross-plugin 거부 시 돌려주는
// "PERMISSION_DENIED" 는 코어 소유(우리 집합 밖) — 핸들러가 만들지 않는다.
export type Code =
  | "OK"
  | "NOT_FOUND" // 페이지/노드/컴포넌트 id 없음.
  | "INVALID_TYPE" // node.type 이 카탈로그에 없음.
  | "INVALID_PROP" // prop 이 카탈로그 스펙 위반(미지 prop·타입 불일치·enum 이탈).
  | "INVALID_TARGET" // move/add 대상이 부재·자기자손·acceptsChildren=false.
  | "INVALID_ARG" // 명령 파라미터 자체가 형식 위반.
  | "DUPLICATE" // 이름 충돌 등 중복.
  | "TEMPLATE_UNKNOWN" // template id 가 templates.json 에 없음.
  | "TEMPLATE_UNAVAILABLE" // template 은 있으나 available=false(미설치/컴파일타임 의존) — reason 동반.
  | "THEME_UNKNOWN" // theme 이름이 THEMES 밖.
  | "COMPILE_FAILED" // page.code.set 의 TSX 가 러너 sucrase 설정에서 컴파일 실패(진단 = data.diagnostics).
  | "PREVIEW_FAILED" // 미리보기 아티팩트 기록/브라우저 구동 실패.
  | "DEP_MISSING" // 브라우저 의존 플러그인이 둘 다 미가용(ping 실패).
  | "EXPORT_FAILED"; // TSX 직렬화 실패.

// 대칭 봉투 = 소비자(CLI/MCP/활동 트레이스)가 보는 정규화된 와이어 결과. 코어 registry.execute 가
// 짓는다(핸들러가 직접 만드는 게 아님) — 아래 핸들러 규약이 그 재료를 준다.
export interface Ok<D extends Record<string, unknown> = Record<string, unknown>> {
  ok: true;
  code: "OK";
  message: string;
  data: D;
}
export interface Err {
  ok: false;
  code: Exclude<Code, "OK">;
  message: string;
  // 실패 축의 구조적 진단 채널 — 대칭 봉투 {ok,code,message,data} 를 따른다. 성공 축 데이터와 달리
  // 실패 데이터는 선택적이며, 유일 소비자는 page.code.set 의 COMPILE_FAILED(data.diagnostics = 컴파일러
  // 오류 원문). 사람용 요약은 늘 message 에도 담아 코어가 실패 data 를 흘려도 진단이 사라지지 않게 한다.
  data?: Record<string, unknown>;
}
export type Envelope<D extends Record<string, unknown> = Record<string, unknown>> = Ok<D> | Err;

// 핸들러 반환 규약(코어 normalizeOutcome 확정 동작):
//   - 성공: 핸들러는 *데이터 레코드*를 그대로 반환한다. 표시 message 는 register 의
//     spec.message(data) 가 소유한다(핸들러가 넣은 message 는 성공 시 버려진다 — 단일 소유).
//   - 실패: 핸들러는 err(code, message) 를 반환한다. code/message 가 그대로 보존된다
//     (레거시 {ok:false, error} 방언 금지 — 코어가 흡수는 하나 우리는 절대 생산하지 않는다).
// 따라서 성공 축엔 헬퍼가 없다(데이터를 그대로 return). 실패 축만 err() 로 못박는다.
// data 는 선택 — page.code.set 의 COMPILE_FAILED 만 diagnostics 를 실어 보낸다(§4).
export function err(
  code: Exclude<Code, "OK">,
  message: string,
  data?: Record<string, unknown>,
): Err {
  return data === undefined ? { ok: false, code, message } : { ok: false, code, message, data };
}

// ── 러너로 주입되는 디자인 페이로드 (window.__DESIGN__) ──────────────────────
// 미리보기 문서에 인라인되는 값. 러너는 page.kind 로 두 경로를 가른다(CONTRACT §7):
//   - tree: root 트리를 배럴에서 type→컴포넌트로 해소해 렌더(v1 경로).
//   - tsx: code 를 러너의 sucrase 설정(Learn Gate B)으로 트랜스폼 후 require-shim 으로 실행,
//          default export 를 마운트. 컴파일/런타임 오류는 빈 화면이 아니라 보이는 오류 표면.
// RunnerPage 는 PageSource 의 렌더 부분집합(origin 제외 — 러너는 유래를 모른다).
export type RunnerPage =
  | { kind: "tree"; root: DesignNode }
  | { kind: "tsx"; code: string };

export interface DesignPayload {
  theme: ThemeName;
  mode?: ColorMode; // 없으면 러너가 system 으로 렌더(§9). 명령 계층이 store.doc.mode ?? "system" 로 채운다.
  page: RunnerPage;
}

// ── 호스트 API 구조 타입(최소 부분집합) ─────────────────────────────────────
// 플러그인은 코어 소스를 import 할 수 없다(독립 번들). 런타임이 activate(ctx) 로 주는 표면 중
// 이 플러그인이 실제로 쓰는 부분만 구조적으로 선언한다. 전체 표면 = 코어 src/plugins/api.ts.
export interface HostDisposable {
  dispose: () => void;
}

export interface CommandOutcome {
  ok: boolean;
  code: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface HostCommandSpec {
  description: string; // 영어 base(LLM 발견 표면).
  triggers?: Record<string, string>; // 비영어 트리거어(언어→단어) — I18N 2축 발화.
  params?: Record<string, unknown>; // ParamSpec(코어 registry). 이 플러그인은 느슨히 다룸.
  returns?: string;
  examples?: readonly string[];
  danger?: "destructive" | "inject";
  message?: (data: Record<string, unknown>) => string;
  handler: (
    params: Record<string, unknown>,
    inv?: HostInvocation,
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
}

// 중첩 실행 컨텍스트 — 다른 플러그인(브라우저) 명령 호출은 inv.execute 로(유래·상관 계승, §5).
export interface HostInvocation {
  origin?: string;
  parent?: string;
  execute: (name: string, params?: Record<string, unknown>) => Promise<CommandOutcome>;
}

export interface HostApi {
  appVersion: string;
  pluginId: string;
  commands?: {
    execute: (
      name: string,
      params?: Record<string, unknown>,
      opts?: { origin?: string },
    ) => Promise<CommandOutcome>;
    register: (name: string, spec: HostCommandSpec) => HostDisposable;
  };
  data?: {
    kv: {
      get: (key: string) => Promise<unknown>;
      set: (key: string, value: unknown) => Promise<void>;
      delete: (key: string) => Promise<boolean>;
      keys: (prefix?: string) => Promise<string[]>;
      watch: (cb: (key: string | null) => void) => HostDisposable;
    };
  };
  fs?: {
    writeText?: (path: string, content: string) => Promise<void>;
    url?: (path: string) => Promise<string>;
  };
  // 코어 app.process 최소 부분집합("process" 권한) — 미리보기 http 서버 스폰(§7 수송).
  process?: {
    spawn: (cmd: string, args: string[], opts?: { cwd?: string }) => Promise<number>;
    onData: (handle: number, cb: (data: Uint8Array) => void) => { dispose(): void };
    onStderr: (handle: number, cb: (data: Uint8Array) => void) => { dispose(): void };
    onExit: (handle: number, cb: (code: number) => void) => { dispose(): void };
    kill: (handle: number) => Promise<void>;
  };
  project: { current: () => { id: string; root: string | null } | null };
}

export interface HostContext {
  app: HostApi;
  manifest: { id: string; version: string };
  dir: string; // 플러그인 설치 디렉토리(미리보기 아티팩트 기록 루트).
  subscriptions: HostDisposable[];
}
