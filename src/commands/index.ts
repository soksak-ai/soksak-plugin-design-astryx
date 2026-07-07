// 명령 카탈로그(26) — 전부 같은 스토어(DesignDoc)를 조작하는 얇은 래퍼. app.commands.register 로
// sok CLI/MCP/스킬에 자동 노출된다. 트리 의미(생성/조회/변이/검색/테마)와 페이지 소스는 src/model 이,
// 카탈로그/템플릿/내보내기/문서는 각 서브모듈이 소유한다. 이 파일은 params→서브모듈→봉투 매핑만 한다.
// preview.* 는 인앱 캔버스 뷰를 연다(inv.execute("plugin.view.open") — §7 View law. 브라우저·아티팩트 없음).
// 두 페이지 종류(§2): tree(comp.* 편집) / tsx(원본 소스가 진실 — page.code.* 편집).
//
// 반환 규약(CONTRACT §4, 코어 normalizeOutcome 확정): 성공 = 평문 데이터 레코드(ok 키 없음, 표시
// message 는 register spec.message 소유), 실패 = err(code,message[,data])={ok:false,code,message,data?}.
// 레거시 {ok:false,error} 방언은 절대 생산하지 않는다. 모든 register 는 message 를 반드시 준다(§4).
import {
  err,
  THEMES,
  COLOR_MODES,
  type Err,
  type CommandOutcome,
} from "../types";
import { isErr, errMsg, asString, asNonEmptyString } from "./envelope";
import { resolveThemeMode } from "./theme-mode";
import { compileGate } from "./compile";
import type { DesignStore } from "./store";

// 트리 모델·카탈로그·템플릿·내보내기·문서(각 병렬 에이전트 소유 — CONTRACT 시그니처에 맞춘다).
import * as model from "../model";
import * as catalog from "../catalog";
import * as templates from "../templates";
import * as exportMod from "../export";
import * as docs from "../docs";

// ── 코어 표면(로컬 선언 — erd/kanban 선례. 공유 타입에 없는 hint 를 포함하려 로컬로 둔다) ──────────
type Hint = { cmd: string; why: string };

interface ParamSpec {
  type: "string" | "number" | "boolean" | "json";
  description: string;
  required?: boolean;
  enum?: readonly string[];
  default?: unknown;
}

// 중첩 실행 컨텍스트(§5) — 코어 plugin.view.open 호출은 반드시 inv.execute 로(유래·상관 계승).
interface Inv {
  execute(name: string, params?: Record<string, unknown>): Promise<CommandOutcome>;
}

type HandlerResult = Record<string, unknown> | Err;
type Handler = (
  params: Record<string, unknown>,
  inv?: Inv,
) => Promise<HandlerResult> | HandlerResult;

interface RegisterSpec {
  description: string; // 영어 base(LLM 발견 표면 — I18N 2축).
  triggers?: Record<string, string>; // 비영어 트리거어(언어→단어).
  params?: Record<string, ParamSpec>;
  message?: (data: Record<string, unknown>) => string; // 표준 답변(§4, 필수).
  hint?: (data: Record<string, unknown>) => Hint[]; // 다음 단계 제시(선택).
  danger?: "destructive" | "inject"; // 위험 분류(제거·닫기). 매니페스트 선언과 일치해야 함(코어 api.ts).
  handler: Handler;
}

interface CommandsApi {
  register(name: string, spec: RegisterSpec): { dispose(): void } | (() => void);
}

interface Ctx {
  subscriptions: Array<{ dispose(): void } | (() => void)>;
  dir: string;
  manifest: { id: string; version: string };
  app: { commands?: CommandsApi };
}

// ── 등록 ──────────────────────────────────────────────────────────────────────
export function registerCommands(ctx: Ctx, store: DesignStore): void {
  const reg = ctx.app.commands?.register;
  if (!reg) return;
  const register = reg.bind(ctx.app.commands);
  const pluginId = ctx.manifest.id;

  // 완전정규화 명령 주소(hint.cmd 조립용).
  const cmd = (name: string) => `plugin.${pluginId}.${name}`;

  const add = (
    name: string,
    description: string,
    triggers: Record<string, string>,
    message: (d: Record<string, unknown>) => string,
    handler: Handler,
    params?: Record<string, ParamSpec>,
    hint?: (d: Record<string, unknown>) => Hint[],
    danger?: "destructive" | "inject",
  ) => {
    ctx.subscriptions.push(
      register(name, { description, triggers, params, message, hint, danger, handler }),
    );
  };

  // 변이 핸들러 래퍼 — 성공 시 영속화(CONTRACT §11), 실패 봉투는 그대로 반환. 모델은 doc 를 제자리
  // 변이하고 데이터 레코드 또는 Err 를 돌려준다(핸들러 반환 규약과 동형).
  const mutate =
    (fn: (params: Record<string, unknown>) => HandlerResult): Handler =>
    async (params) => {
      const r = fn(params ?? {});
      if (isErr(r)) return r;
      await store.persist();
      return r;
    };

  // 캔버스 뷰 열기/포커스(§7 View law) — plugin.view.open 을 inv.execute 로 부른다(유래·상관 계승, §5).
  // 이 명령은 blocked-for-plugins 아님·cross-plugin 아님·danger 아님이라 "commands" 권한으로 충분하다.
  // content 배치 결과의 existing(true=기존 탭 포커스)을 opened 로 뒤집어 돌려준다. 비-ok 는 PREVIEW_FAILED.
  const openCanvas = async (inv: Inv): Promise<{ ok: true; opened: boolean } | Err> => {
    let out: CommandOutcome;
    try {
      out = await inv.execute("plugin.view.open", {
        view: `${pluginId}.canvas`,
        placement: "content",
      });
    } catch (e) {
      return err("PREVIEW_FAILED", `캔버스 뷰 열기 실패: ${errMsg(e)}`);
    }
    if (!out.ok) {
      return err("PREVIEW_FAILED", `캔버스 뷰 열기 실패: ${out.message}`);
    }
    // existing=true → 이미 열린 캔버스 탭을 포커스한 것 → opened=false(새 탭 생성 아님).
    return { ok: true, opened: out.data?.existing !== true };
  };

  // ── ping / state(생태계 관례) ────────────────────────────────────────────────
  add(
    "ping",
    "Load/version probe — returns plugin version and catalog/template counts (E2E readiness check).",
    { ko: "핑 적재 버전 확인 로드" },
    (d) =>
      `Astryx 디자인 플러그인 v${d.version} — 컴포넌트 ${d.catalogCount}종, 템플릿 ${d.templateCount}개.`,
    () => ({
      version: ctx.manifest.version,
      catalogCount: catalog.catalogCount(),
      templateCount: templates.templateCount(),
    }),
  );

  add(
    "state",
    "Report document state — active theme, page count, and per-page summaries (id, name, kind; rootType/nodeCount on tree pages only).",
    { ko: "상태 문서 조회 현재 요약" },
    (d) => `문서: 테마 ${d.activeTheme}, 페이지 ${d.pageCount}개.`,
    () => {
      const pages = model.pageSummaries(store.doc);
      return { activeTheme: store.doc.activeTheme, pageCount: pages.length, pages };
    },
  );

  // ── page.* ───────────────────────────────────────────────────────────────────
  add(
    "page.create",
    "Create a page of the given kind. tree (default) starts as a bare Stack root edited by the comp.* family; tsx starts as a minimal compilable 'use client' default-export component edited by page.code.set. To seed a page from a shipped template use template.apply (it creates a tsx page from the template code).",
    { ko: "페이지 생성 추가 만들기 새 트리 tsx" },
    (d) => `${d.kind} 페이지 '${d.name}' 생성.`,
    // 이름 비었거나 kind 가 tree/tsx 밖이면 model.createPage 가 INVALID_ARG 로 거른다(검증 단일 소유).
    mutate((p) => model.createPage(store.doc, { name: asString(p.name) ?? "", kind: asString(p.kind) })),
    {
      name: { type: "string", required: true, description: "Page name (non-blank)." },
      kind: {
        type: "string",
        enum: ["tree", "tsx"],
        description: "Page kind: tree (comp.* editable, default) or tsx (source is the truth).",
      },
    },
    (d) => {
      if (!d.pageId) return [];
      const preview_ = { cmd: cmd("preview.open"), why: "캔버스로 미리볼 수 있습니다." };
      return d.kind === "tsx"
        ? [{ cmd: cmd("page.code.set"), why: "TSX 소스를 교체해 편집할 수 있습니다." }, preview_]
        : [{ cmd: cmd("comp.add"), why: "루트 아래에 컴포넌트를 추가할 수 있습니다." }, preview_];
    },
  );

  add(
    "page.list",
    "List pages with per-page summary (id, name, kind; rootType/nodeCount on tree pages only).",
    { ko: "페이지 목록 조회 리스트" },
    (d) => `페이지 ${(d.pages as unknown[] | undefined)?.length ?? 0}개.`,
    () => ({ pages: model.pageSummaries(store.doc) }),
    undefined,
    (d) =>
      ((d.pages as unknown[] | undefined)?.length ?? 0) === 0
        ? [{ cmd: cmd("page.create"), why: "첫 페이지를 만들 수 있습니다." }]
        : [],
  );

  add(
    "page.rename",
    "Rename an existing page.",
    { ko: "페이지 이름 변경 rename 개명" },
    (d) => `페이지 이름 '${d.name}' 으로 변경.`,
    mutate((p) => model.renamePage(store.doc, p)),
    {
      pageId: { type: "string", required: true, description: "Target page id." },
      name: { type: "string", required: true, description: "New page name (non-blank)." },
    },
  );

  add(
    "page.duplicate",
    "Deep-clone a page with fresh ids (a tree page copies its tree; a tsx page copies its code and origin). Default new name is '<source name> copy'.",
    { ko: "페이지 복제 복사 duplicate" },
    (d) => `페이지 '${d.name}' 복제(노드 ${d.nodeCount}개).`,
    mutate((p) => model.duplicatePage(store.doc, p)),
    {
      pageId: { type: "string", required: true, description: "Source page id." },
      name: { type: "string", description: "New page name (defaults to '<source> copy')." },
    },
  );

  add(
    "page.remove",
    "Remove a page. A document may hold zero pages.",
    { ko: "페이지 삭제 제거 remove" },
    () => "페이지 삭제.",
    mutate((p) => model.removePage(store.doc, p)),
    { pageId: { type: "string", required: true, description: "Page id to remove." } },
    undefined,
    "destructive", // 페이지 전체 영구 삭제 — 동의 게이트(commands:destructive).
  );

  // ── comp.* (tree 페이지 전용 — kind 게이트는 모델이 통과시킨다: tsx 페이지면 INVALID_TARGET, §2) ──
  add(
    "comp.add",
    "Add a component node of the given catalog type under parentId (default page root) at index (default append). Tree pages only — a tsx page returns INVALID_TARGET pointing to page.code.*. Validates type, parent acceptsChildren, and props against the catalog.",
    { ko: "컴포넌트 추가 노드 붙이기 넣기" },
    (d) => `${(d.node as { type?: string } | undefined)?.type} 를 ${d.parentId} 아래 추가(노드 ${d.nodeId}).`,
    mutate((p) => model.addNode(store.doc, p)),
    {
      pageId: { type: "string", required: true, description: "Target tree page id." },
      type: { type: "string", required: true, description: "Catalog component type (e.g. Button)." },
      parentId: { type: "string", description: "Parent node id (defaults to the page root)." },
      index: { type: "number", description: "Insertion index among siblings (defaults to append)." },
      props: { type: "json", description: "Prop map validated against the catalog (JSON-serializable only)." },
    },
    (d) =>
      d.nodeId
        ? [
            { cmd: cmd("comp.set"), why: "방금 만든 노드의 속성을 갱신할 수 있습니다." },
            { cmd: cmd("comp.add"), why: "그 아래에 자식 컴포넌트를 더 추가할 수 있습니다." },
            { cmd: cmd("preview.open"), why: "결과를 캔버스로 미리볼 수 있습니다." },
          ]
        : [],
  );

  add(
    "comp.set",
    "Merge props into a node (or replace all props when replace=true). A null prop value deletes that key. Tree pages only. Validates against the catalog.",
    { ko: "컴포넌트 속성 설정 변경 편집 값" },
    (d) => `${(d.node as { type?: string } | undefined)?.type} 속성 갱신.`,
    mutate((p) => model.setProps(store.doc, p)),
    {
      pageId: { type: "string", required: true, description: "Target tree page id." },
      nodeId: { type: "string", required: true, description: "Target node id." },
      props: { type: "json", required: true, description: "Prop map to merge (null value deletes the key)." },
      replace: { type: "boolean", description: "Replace all props instead of merging (default false)." },
    },
  );

  add(
    "comp.move",
    "Reparent a node under parentId at index (default append). Tree pages only. Rejects moving the root, or targeting the node itself or a descendant.",
    { ko: "컴포넌트 이동 옮기기 재부모 move" },
    (d) => `${d.nodeId} 를 ${d.parentId} 아래로 이동.`,
    mutate((p) => model.moveNode(store.doc, p)),
    {
      pageId: { type: "string", required: true, description: "Target tree page id." },
      nodeId: { type: "string", required: true, description: "Node id to move." },
      parentId: { type: "string", required: true, description: "New parent node id." },
      index: { type: "number", description: "Insertion index under the new parent (defaults to append)." },
    },
  );

  add(
    "comp.remove",
    "Remove a node and its subtree. Tree pages only. The root cannot be removed.",
    { ko: "컴포넌트 삭제 제거 노드 remove" },
    (d) => `노드 ${d.removedCount}개 삭제.`,
    mutate((p) => model.removeNode(store.doc, p)),
    {
      pageId: { type: "string", required: true, description: "Target tree page id." },
      nodeId: { type: "string", required: true, description: "Node id to remove (with its subtree)." },
    },
    undefined,
    "destructive", // 노드+서브트리 영구 삭제 — 동의 게이트(commands:destructive).
  );

  add(
    "comp.get",
    "Get a node's full subtree by id. Tree pages only.",
    { ko: "컴포넌트 조회 노드 가져오기 get" },
    (d) => `${(d.node as { type?: string } | undefined)?.type} 노드(${(d.node as { id?: string } | undefined)?.id}).`,
    (p) => model.getNode(store.doc, p ?? {}),
    {
      pageId: { type: "string", required: true, description: "Target tree page id." },
      nodeId: { type: "string", required: true, description: "Node id to fetch." },
    },
  );

  add(
    "comp.find",
    "Search all pages (or one page) for nodes matching type (exact) and/or propContains (case-insensitive substring over serialized prop values). Only tree pages carry nodes.",
    { ko: "컴포넌트 검색 찾기 노드 find" },
    (d) => `일치 노드 ${(d.matches as unknown[] | undefined)?.length ?? 0}개.`,
    (p) => model.findNodes(store.doc, p ?? {}),
    {
      pageId: { type: "string", description: "Restrict search to this page id (defaults to all pages)." },
      type: { type: "string", description: "Exact component type to match." },
      propContains: { type: "string", description: "Case-insensitive substring over serialized prop values." },
    },
  );

  // ── page.code.* (tsx 페이지 전용 — kind 게이트는 모델이 소유(tree 페이지면 INVALID_TARGET, §2);
  //    이 계층은 page.code.set 의 sucrase 컴파일 게이트만 얹는다) ──
  add(
    "page.code.get",
    "Return the TSX source of a tsx page (with its origin template id, if any). A tree page returns INVALID_TARGET pointing to comp.* / export.tsx.",
    { ko: "페이지 코드 조회 tsx 소스 읽기 get" },
    (d) => `${d.pageId} TSX ${(d.code as string | undefined)?.length ?? 0}자.`,
    // 존재(NOT_FOUND)·종류 게이트(tree 면 INVALID_TARGET→comp.*/export.tsx, §2)는 모델이 소유.
    (p) => model.getPageCode(store.doc, p ?? {}),
    { pageId: { type: "string", required: true, description: "Target tsx page id." } },
    (d) =>
      d.code !== undefined
        ? [
            { cmd: cmd("page.code.set"), why: "TSX 소스를 교체해 편집할 수 있습니다." },
            { cmd: cmd("preview.open"), why: "캔버스로 미리볼 수 있습니다." },
          ]
        : [],
  );

  add(
    "page.code.set",
    "Replace a tsx page's TSX source. Validates by compiling the code with the runner's exact sucrase config before it lands; on compile failure returns COMPILE_FAILED with the compiler diagnostics in data.diagnostics (page untouched). A tree page returns INVALID_TARGET — there is no in-place tree->tsx conversion; seed a tsx page via page.create kind=tsx or template.apply.",
    { ko: "페이지 코드 설정 tsx 소스 교체 수정 set" },
    (d) => `${d.pageId} TSX 갱신(${d.bytes}자).`,
    mutate((p) => {
      // 오류 우선순위(§5): 존재·종류 게이트 → 빈 코드 → 컴파일 → 설정. 존재/종류는 모델 getPageCode 로
      // 먼저 태워(NOT_FOUND, tree 면 INVALID_TARGET, §2) 컴파일 전에 tree 페이지를 걸러낸다.
      const gate = model.getPageCode(store.doc, p);
      if (isErr(gate)) return gate;
      const code = asString(p.code);
      if (code === undefined || code.trim().length === 0) {
        return err("INVALID_ARG", "code 는 비어 있지 않은 문자열이어야 합니다.");
      }
      // 러너와 같은 sucrase 설정으로 착지 전 컴파일 검증(§5·§7). 실패면 페이지 불변.
      const compileErr = compileGate(code, `${gate.pageId}.tsx`);
      if (compileErr) return compileErr;
      // 검증 통과 → 모델이 소스를 교체(기존 origin 보존).
      return model.setPageCode(store.doc, p);
    }),
    {
      pageId: { type: "string", required: true, description: "Target tsx page id." },
      code: { type: "string", required: true, description: "Full replacement TSX source (compiled before it lands)." },
    },
    (d) =>
      d.pageId
        ? [
            { cmd: cmd("preview.open"), why: "갱신된 페이지를 캔버스로 볼 수 있습니다." },
            { cmd: cmd("export.tsx"), why: "이 페이지를 TSX 로 내보낼 수 있습니다." },
          ]
        : [],
  );

  // ── theme.* ──────────────────────────────────────────────────────────────────
  add(
    "theme.set",
    "Set the active theme, and optionally the color mode (light, dark, or system — default system). gothic is dark-only, so {theme:'gothic', mode:'light'} is rejected. A mounted canvas view re-renders automatically (store.onChange swaps the shadow host's data-astryx-theme and color-scheme) — there is no browser to drive and no artifact to re-emit.",
    { ko: "테마 설정 변경 스킨 색 모드 다크 라이트" },
    (d) => `테마 ${d.theme}·모드 ${d.mode} 적용.`,
    async (params) => {
      const p = params ?? {};
      const themeName = asString(p.theme) ?? "";
      // mode 판정(변이 전) — 형식 위반·gothic 다크전용 위반은 여기서 INVALID_PROP 로 잡아 doc 를 안 더럽힌다.
      const mr = resolveThemeMode(themeName, p.mode, store.doc.mode);
      if (isErr(mr)) return mr;
      // theme 검증·activeTheme 변이는 모델 소유(THEME_UNKNOWN).
      const r = model.setTheme(store.doc, themeName);
      if (isErr(r)) return r;
      if (mr.explicit) store.doc.mode = mr.effective; // 명시했을 때만 덮어쓴다(무명시면 기존 모드 보존).
      // persist 가 kv 기록 후 notify 를 발화 → 마운트된 캔버스 뷰가 새 테마·모드로 재렌더(§7 Live law).
      await store.persist();
      return {
        theme: (r as { theme?: string }).theme ?? store.doc.activeTheme,
        mode: mr.effective,
      };
    },
    {
      theme: { type: "string", required: true, enum: THEMES, description: "Theme name (one of the 7 packaged themes)." },
      mode: { type: "string", enum: COLOR_MODES, description: "Color mode: light, dark, or system (default). gothic rejects light." },
    },
    (d) => (d.theme ? [{ cmd: cmd("preview.open"), why: "테마가 적용된 페이지를 캔버스로 볼 수 있습니다." }] : []),
  );

  add(
    "theme.list",
    "List the packaged theme names and the active theme.",
    { ko: "테마 목록 조회 리스트 스킨" },
    (d) => `테마 ${(d.themes as unknown[] | undefined)?.length ?? 0}종(현재 ${d.active}).`,
    () => ({ themes: [...THEMES], active: store.doc.activeTheme }),
  );

  // ── template.* (619개 shipped Astryx 템플릿 — 원본 TSX 를 verbatim 으로, §13) ───────────────────
  add(
    "template.list",
    "List shipped Astryx templates (verbatim tsx). Serves available templates by default (available=true) and reports the unavailable tail as counts + reasons; pass includeUnavailable=true to also carry unavailable entries in the list. Optionally filter by kind (page|block).",
    { ko: "템플릿 목록 조회 리스트" },
    (d) => `템플릿 ${d.available}개 사용 가능(미가용 ${d.unavailableCount}개).`,
    (p) => {
      const kind = (p ?? {}).kind;
      if (kind !== undefined && kind !== "page" && kind !== "block") {
        return err("INVALID_ARG", "kind 는 page 또는 block 이어야 합니다.");
      }
      // 스프레드 = TemplateListing(명명 인터페이스)을 평문 데이터 레코드로(핸들러 반환 규약, §4).
      return {
        ...templates.listTemplates({
          kind: kind as "page" | "block" | undefined,
          includeUnavailable: (p ?? {}).includeUnavailable === true,
        }),
      };
    },
    {
      kind: { type: "string", enum: ["page", "block"], description: "Filter by template kind." },
      includeUnavailable: {
        type: "boolean",
        description: "Include unavailable templates in the list (default false).",
      },
    },
    (d) =>
      ((d.available as number | undefined) ?? 0) > 0
        ? [{ cmd: cmd("template.apply"), why: "템플릿을 tsx 페이지로 적용할 수 있습니다." }]
        : [],
  );

  add(
    "template.apply",
    "Create a tsx page from a shipped template's verbatim code (origin recorded). With pageId, overwrite that page's source with the template code (the target may be either kind); without, create a new tsx page (name defaults to the template name). Rejects an unavailable template with TEMPLATE_UNAVAILABLE and its reason.",
    { ko: "템플릿 적용 삽입 apply 넣기" },
    () => "템플릿 적용(tsx 페이지).",
    mutate((p) => {
      // 템플릿 해소·available 검사(TEMPLATE_UNKNOWN/UNAVAILABLE)는 이 계층 소관. 소스 교체·페이지 생성은
      // 모델(applyTsxSource/createTsxPage)이 소유 — 넘기는 code 는 available=true 라 렌더 가능분.
      const id = asNonEmptyString(p.id);
      if (!id) return err("TEMPLATE_UNKNOWN", "template id 가 필요합니다.");
      const t = templates.getTemplate(id);
      if (!t) return err("TEMPLATE_UNKNOWN", `템플릿 '${id}' 을 찾을 수 없습니다.`);
      if (!t.available) {
        return err(
          "TEMPLATE_UNAVAILABLE",
          `템플릿 '${id}' 은 렌더할 수 없습니다: ${t.reason ?? "unavailable"}.`,
        );
      }
      const pageId = asNonEmptyString(p.pageId);
      return pageId
        ? model.applyTsxSource(store.doc, { pageId, code: t.code, origin: id })
        : model.createTsxPage(store.doc, {
            name: asNonEmptyString(p.name) ?? t.name,
            code: t.code,
            origin: id,
          });
    }),
    {
      id: { type: "string", required: true, description: "Shipped template id (e.g. pages/dashboard)." },
      pageId: { type: "string", description: "Existing page id to overwrite with the template source (omit to create a new page)." },
      name: { type: "string", description: "New page name when creating (defaults to the template name)." },
    },
    (d) =>
      d.pageId
        ? [
            { cmd: cmd("preview.open"), why: "적용된 페이지를 캔버스로 볼 수 있습니다." },
            { cmd: cmd("page.code.get"), why: "적용된 TSX 소스를 읽을 수 있습니다." },
            { cmd: cmd("export.tsx"), why: "TSX 로 내보낼 수 있습니다." },
          ]
        : [],
  );

  // ── catalog.* ────────────────────────────────────────────────────────────────
  add(
    "catalog.list",
    "List catalog components (type, description, acceptsChildren, propCount). Optionally filter by group (exact) or query (case-insensitive substring over type/description).",
    { ko: "카탈로그 목록 컴포넌트 조회 리스트" },
    (d) => `컴포넌트 ${(d.components as unknown[] | undefined)?.length ?? 0}종.`,
    (p) => ({
      components: catalog.listComponents({ group: asString((p ?? {}).group), query: asString((p ?? {}).query) }),
    }),
    {
      group: { type: "string", description: "Exact group filter." },
      query: { type: "string", description: "Case-insensitive substring over type/description." },
    },
    () => [
      { cmd: cmd("catalog.doc"), why: "한 컴포넌트의 속성 문서를 볼 수 있습니다." },
      { cmd: cmd("comp.add"), why: "컴포넌트를 트리 페이지에 추가할 수 있습니다." },
    ],
  );

  add(
    "catalog.doc",
    "Get the full catalog entry for a component type (props, enums, defaults, acceptsChildren).",
    { ko: "카탈로그 문서 컴포넌트 속성 조회" },
    (d) => {
      const e = d.entry as { type?: string; props?: Record<string, unknown> } | undefined;
      return `${e?.type} — 속성 ${Object.keys(e?.props ?? {}).length}개.`;
    },
    (p) => {
      const type = asNonEmptyString((p ?? {}).type);
      if (!type) return err("INVALID_TYPE", "컴포넌트 type 이 필요합니다.");
      const entry = catalog.getEntry(type);
      if (!entry) return err("INVALID_TYPE", `카탈로그에 없는 컴포넌트: '${type}'.`);
      return { entry };
    },
    { type: { type: "string", required: true, description: "Component type (catalog key)." } },
    (d) => (d.entry ? [{ cmd: cmd("comp.add"), why: "이 컴포넌트를 추가할 수 있습니다." }] : []),
  );

  // ── docs.* (빌드타임에 구운 공식 Astryx 독트린 — CONTRACT §14) ─────────────────
  add(
    "docs.list",
    "List the baked-in Astryx doctrine topics (official Meta design docs), each with a one-line summary. Read a topic in full with docs.get.",
    { ko: "문서 목록 토픽 독트린 가이드 조회 리스트" },
    (d) => `Astryx 문서 토픽 ${(d.topics as unknown[] | undefined)?.length ?? 0}개.`,
    () => ({ topics: docs.listDocs() }),
    undefined,
    () => [
      { cmd: cmd("docs.get"), why: "한 토픽의 전체 문서를 읽을 수 있습니다." },
      { cmd: cmd("catalog.list"), why: "컴포넌트 카탈로그를 볼 수 있습니다." },
    ],
  );

  add(
    "docs.get",
    "Get the full baked-in Astryx doctrine text for a topic (dense-preferred official Meta docs; layout/principles/theme/tokens use Meta's token-efficient compression).",
    { ko: "문서 조회 토픽 가이드 원문 읽기 get" },
    (d) => `${d.topic} 문서 — ${(d.text as string | undefined)?.length ?? 0}자.`,
    (p) => {
      const topic = asNonEmptyString((p ?? {}).topic);
      if (!topic) {
        return err("INVALID_ARG", "topic 이 필요합니다. docs.list 로 토픽 목록을 볼 수 있습니다.");
      }
      const entry = docs.getDoc(topic);
      if (!entry) {
        return err("NOT_FOUND", `문서 토픽 '${topic}' 을 찾을 수 없습니다. docs.list 로 사용 가능한 토픽을 확인하십시오.`);
      }
      return {
        topic,
        title: entry.title,
        dense: entry.dense,
        description: entry.description,
        text: entry.text,
      };
    },
    { topic: { type: "string", required: true, description: "Doctrine topic id (see docs.list, e.g. layout, principles, tokens)." } },
    (d) => (d.topic ? [{ cmd: cmd("catalog.doc"), why: "언급된 컴포넌트의 속성 문서를 볼 수 있습니다." }] : []),
  );

  // ── preview.* (인앱 캔버스 뷰 — 아티팩트·브라우저 없음, §7 View law) ────────────
  add(
    "preview.open",
    "Select a page (tree or tsx) as the canvas's active page, then open or focus the in-app canvas view. Sets the active page before opening so a fresh mount renders it immediately; a mounted view re-renders live. opened is true for a new tab, false when an already-open canvas tab was focused.",
    { ko: "캔버스 열기 미리보기 프리뷰 preview 뷰" },
    (d) => `캔버스 열림(페이지 ${d.pageId}).`,
    async (params, inv) => {
      const pageId = asNonEmptyString((params ?? {}).pageId);
      if (!pageId) return err("NOT_FOUND", "pageId 가 필요합니다.");
      const page = model.getPage(store.doc, pageId);
      if (!page) return err("NOT_FOUND", `페이지를 찾을 수 없습니다: '${pageId}'.`);
      // 활성 페이지를 먼저 세팅(§5) → 이미 열린 뷰는 즉시 재렌더, 새 마운트는 올바른 페이지를 그린다.
      store.preview.activePageId = pageId;
      store.notify();
      if (!inv) return err("PREVIEW_FAILED", "실행 컨텍스트가 없어 캔버스를 열 수 없습니다.");
      const res = await openCanvas(inv);
      if (isErr(res)) return res;
      return { pageId, opened: res.opened };
    },
    { pageId: { type: "string", required: true, description: "Page id to render in the canvas." } },
    (d) =>
      d.pageId
        ? [
            { cmd: cmd("theme.set"), why: "테마를 바꾸면 캔버스가 실시간 재렌더됩니다." },
            { cmd: cmd("export.tsx"), why: "이 페이지를 TSX 로 내보낼 수 있습니다." },
          ]
        : [],
  );

  add(
    "preview.refresh",
    "Select the active canvas page (a given pageId, or keep the current one) and force a live re-render by firing store.onChange. The view is already live-bound, so this is an explicit re-render nudge, not a navigation. Headless-complete: with no view mounted it is a successful no-op, never a failure.",
    { ko: "캔버스 재렌더 갱신 새로고침 refresh 리로드" },
    (d) => `캔버스 재렌더(페이지 ${d.pageId}).`,
    (params) => {
      const explicit = asNonEmptyString((params ?? {}).pageId);
      if (explicit !== undefined) {
        const page = model.getPage(store.doc, explicit);
        if (!page) return err("NOT_FOUND", `페이지를 찾을 수 없습니다: '${explicit}'.`);
        store.preview.activePageId = explicit;
      } else if (
        // 미설정이거나 삭제된 페이지를 가리키면 첫 페이지로 정렬(활성 페이지는 문서에 페이지가 있으면 non-null).
        !store.preview.activePageId ||
        !model.getPage(store.doc, store.preview.activePageId)
      ) {
        store.preview.activePageId = store.doc.pages[0]?.id ?? null;
      }
      store.notify(); // 라이브 재렌더 넛지 — 뷰 미마운트면 구독자 0 이라 성공 no-op(헤드리스 완결, §5).
      return { pageId: store.preview.activePageId };
    },
    { pageId: { type: "string", description: "Page id to make active (defaults to the current active page)." } },
  );

  // ── export.tsx ───────────────────────────────────────────────────────────────
  add(
    "export.tsx",
    "Emit a page as a compilable TSX file. A tsx page returns its code verbatim; a tree page is serialized (named barrel import + default export wrapped in <Theme>).",
    { ko: "TSX 내보내기 코드 생성 export" },
    (d) => `TSX 내보내기(${d.filename}).`,
    (p) => {
      const pageId = asNonEmptyString((p ?? {}).pageId);
      if (!pageId) return err("NOT_FOUND", "pageId 가 필요합니다.");
      const page = model.getPage(store.doc, pageId);
      if (!page) return err("NOT_FOUND", `페이지를 찾을 수 없습니다: '${pageId}'.`);
      try {
        const out = exportMod.exportPageToTsx(page, store.doc.activeTheme);
        if (isErr(out)) return out;
        return { tsx: out.tsx, filename: out.filename };
      } catch (e) {
        return err("EXPORT_FAILED", `TSX 직렬화 실패: ${errMsg(e)}`);
      }
    },
    { pageId: { type: "string", required: true, description: "Page id to export." } },
  );
}
