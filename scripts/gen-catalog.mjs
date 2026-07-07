// generated/catalog.json 생성기 — CONTRACT §6 catalog law 의 유일 구현.
// 소스: node_modules/@astryxdesign/core (package.json exports + src/{Name}/{Name}.doc.mjs + dist/{Name}/index.d.ts).
//
// 집합(기계적·화이트리스트 없음): package.json exports 중 단일세그먼트 대문자 subpath(^\.\/[A-Z][A-Za-z0-9]*$).
// 0.1.3 에서 정확히 99종. 완전성 법칙 = 이 집합의 모든 원소가 카탈로그에 들어간다(누락 0).
//
// 엔트리 소스 우선순위:
//   1) src/{Name}/{Name}.doc.mjs 의 docs.props (Single/Sub) 또는 docs.components[name===Name].props (Multi inline).
//   2) doc 이 없거나(6종) doc 에 해당 컴포넌트 항목이 없으면(Multi no-match 4종) dist/{Name}/index.d.ts 의
//      {Name}Props 인터페이스를 TypeScript 컴파일러 API 로 풀어 파생(BaseProps/HTMLAttributes 상속분·ref·내부(_)prop 제외).
//   3) 그래도 비면 props={} · acceptsChildren=false (최소 엔트리) — 어떤 컴포넌트도 드랍하지 않는다.
//
// 산출: generated/catalog.json(카탈로그) + generated/catalog-report.json(진단: doc 결손·barrel 미해결 등).

import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import * as barrel from "@astryxdesign/core";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const CORE_DIR = path.resolve(ROOT, "node_modules/@astryxdesign/core");
const OUT_CATALOG = path.resolve(ROOT, "generated/catalog.json");
const OUT_REPORT = path.resolve(ROOT, "generated/catalog-report.json");

// 단일세그먼트 대문자 subpath 만 컴포넌트. ./utils ./hooks ./theme/* ./naming *.css *.mjs ./X/utils 는 정규식이 이미 배제.
const COMPONENT_RE = /^\.\/[A-Z][A-Za-z0-9]*$/;

// ── 순수 헬퍼 ────────────────────────────────────────────────────────────────

// children 이 ReactNode 값이면 자식 채널 허용. 콜백(=>포함)·string 은 자식 아님.
function isReactNodeType(typeStr) {
  return !typeStr.includes("=>") && /\bReactNode\b/.test(typeStr);
}

// doc PropDoc.type 이 단일따옴표 문자열-리터럴 유니온이면 멤버 배열(따옴표 제거), 아니면 null.
function parseEnumFromDocType(typeStr) {
  const parts = typeStr.split("|").map((s) => s.trim());
  if (parts.length === 0) return null;
  const members = [];
  for (const p of parts) {
    const m = /^'([^']*)'$/.exec(p);
    if (!m) return null; // 하나라도 리터럴이 아니면 enum 아님.
    members.push(m[1]);
  }
  return members;
}

// doc PropDoc[] → CatalogPropSpec 레코드 + acceptsChildren.
function fromPropDocs(propDocs) {
  const props = {};
  let acceptsChildren = false;
  for (const pd of propDocs) {
    if (!pd || typeof pd.name !== "string") continue;
    const spec = { type: String(pd.type ?? ""), required: pd.required === true };
    const en = parseEnumFromDocType(spec.type);
    if (en) spec.enum = en;
    if (pd.default !== undefined) spec.default = String(pd.default);
    spec.description = typeof pd.description === "string" ? pd.description : "";
    props[pd.name] = spec;
    if (pd.name === "children" && isReactNodeType(spec.type)) acceptsChildren = true;
  }
  return { props, acceptsChildren };
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

// ── doc 해석 ────────────────────────────────────────────────────────────────
// 반환: { docProps: PropDoc[]|null, docDesc: string|undefined, group: string|undefined, shape }
async function resolveDoc(name) {
  const p = path.join(CORE_DIR, "src", name, `${name}.doc.mjs`);
  if (!(await exists(p))) {
    return { docProps: null, docDesc: undefined, group: undefined, shape: "no-doc" };
  }
  const mod = await import(pathToFileURL(p).href);
  const d = mod.docs;
  if (!d || typeof d !== "object") {
    return { docProps: null, docDesc: undefined, group: undefined, shape: "no-docs-export" };
  }
  const group = typeof d.group === "string" && d.group ? d.group : undefined;
  if (Array.isArray(d.props)) {
    // SingleComponentDoc / SubComponentDoc — 이 doc 은 src/{name}/{name}.doc.mjs 로 그 subpath 를
    // 문서화한다. 매칭 키는 export/subpath 이름(경로로 이미 확정)이고 d.name 은 폴백 표시명일 뿐이다.
    // 그래서 d.name 이 export 이름과 달라도(예: NavMenu → 'NavHeadingMenu') 그 subpath 의 실제
    // props 를 채택한다 — 옛 로직은 d.name 불일치를 dist 폴백(빈 엔트리)으로 보내 NavMenu 를 비웠다.
    const shape = d.name === name ? "single" : "single-doc-name-fallback";
    return { docProps: d.props, docDesc: d.usage?.description, group, shape };
  }
  if (Array.isArray(d.components)) {
    const e = d.components.find((c) => c && c.name === name && Array.isArray(c.props));
    if (e) {
      // Multi inline — 해당 export 이름의 항목. 설명은 항목 usage → 문서 usage → 항목 description 순.
      const docDesc = e.usage?.description ?? d.usage?.description ?? e.description;
      return { docProps: e.props, docDesc, group, shape: "multi-inline" };
    }
    // Multi 이지만 export 이름과 일치하는 항목이 없음(Chat/Layer/Resizable/Stack) → dist 폴백으로.
    return { docProps: null, docDesc: d.usage?.description, group, shape: "multi-no-match" };
  }
  return { docProps: null, docDesc: d.usage?.description, group, shape: "unknown-shape" };
}

// ── dist/{Name}/index.d.ts 폴백(TypeScript 컴파일러 API) ─────────────────────
// {Name}Props 인터페이스의 자체 선언 prop 만 추린다(상속 HTMLAttributes/BaseProps·ref·내부 _prop 제외).
function deriveFromDts(name) {
  const entry = path.join(CORE_DIR, "dist", name, "index.d.ts");
  const empty = { props: {}, acceptsChildren: false, hadInterface: false };
  const program = ts.createProgram([entry], {
    noEmit: true,
    skipLibCheck: true,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    strict: false,
  });
  const checker = program.getTypeChecker();
  const sf = program.getSourceFile(entry);
  if (!sf) return empty;
  const modSym = checker.getSymbolAtLocation(sf);
  if (!modSym) return empty;
  const propsSym = checker
    .getExportsOfModule(modSym)
    .find((e) => e.getName() === `${name}Props`);
  if (!propsSym) return empty;

  const declaredType = checker.getDeclaredTypeOfSymbol(propsSym);
  const props = {};
  let acceptsChildren = false;

  for (const p of checker.getPropertiesOfType(declaredType)) {
    const nm = p.getName();
    if (nm === "ref" || nm.startsWith("_")) continue; // ref·내부 wiring 은 디자인 prop 아님.
    const decls = p.getDeclarations() ?? [];
    const ownDecl = decls.find((d) => {
      const f = d.getSourceFile().fileName;
      return f.includes("@astryxdesign/core") && path.basename(f) !== "BaseProps.d.ts";
    });
    if (!ownDecl) continue; // 상속(HTMLAttributes/BaseProps)분 배제.

    // 타입 문자열은 선언 텍스트(별칭 유지, doc 스타일). enum 은 해석된 타입 객체(리터럴 유니온 확장)에서.
    const typeText =
      ts.isPropertySignature(ownDecl) && ownDecl.type ? ownDecl.type.getText() : "unknown";
    const optional = !!(p.flags & ts.SymbolFlags.Optional);
    const spec = { type: typeText, required: !optional };

    const en = stringLiteralUnionMembers(checker.getTypeOfSymbolAtLocation(p, ownDecl));
    if (en) spec.enum = en;
    const def = jsdocDefault(p);
    if (def !== undefined) spec.default = def;
    spec.description = ts.displayPartsToString(p.getDocumentationComment(checker)) || "";

    props[nm] = spec;
    if (nm === "children" && isReactNodeType(typeText)) acceptsChildren = true;
  }
  return { props, acceptsChildren, hadInterface: true };
}

// 해석된 타입이 문자열 리터럴(들)의 유니온이면 값 배열, 아니면 null. undefined/null 구성원은 무시.
function stringLiteralUnionMembers(t) {
  const parts = t.isUnion() ? t.types : [t];
  const kept = parts.filter(
    (m) => !(m.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)),
  );
  if (kept.length === 0) return null;
  if (!kept.every((m) => m.isStringLiteral())) return null;
  return kept.map((m) => m.value);
}

// prop 심볼의 @default JSDoc 태그 텍스트(있으면), 없으면 undefined.
function jsdocDefault(sym) {
  for (const tag of sym.getJsDocTags() ?? []) {
    if (tag.name === "default") {
      const text = ts.displayPartsToString(tag.text ?? []).trim();
      if (text) return text;
    }
  }
  return undefined;
}

// ── 컴파일된 타입에서 enum 진실 색인 ─────────────────────────────────────────
// 저작 doc.mjs 의 PropDoc.type 문자열이 컴포넌트의 실제 허용값보다 좁을 수 있다(예: Spinner.doc.mjs 는
// size 를 'sm'|'md'|'lg' 로 적지만 dist/Spinner.d.ts 의 SpinnerSize=keyof typeof SIZES 는 xl 을 포함).
// 컴파일된 .d.ts 타입이 실제로 렌더되는 값의 진실이므로, doc enum 이 그보다 좁으면 이 색인으로 확장한다.
// 전 컴포넌트의 index.d.ts 를 하나의 프로그램으로 묶어 {Name}Props 의 리터럴-유니온 prop 만 추린다.
function buildDtsEnumIndex(names) {
  const entries = names.map((n) => path.join(CORE_DIR, "dist", n, "index.d.ts"));
  const program = ts.createProgram(entries, {
    noEmit: true,
    skipLibCheck: true,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    strict: false,
  });
  const checker = program.getTypeChecker();
  const index = new Map(); // name -> { propName: string[] }
  for (const name of names) {
    const entry = path.join(CORE_DIR, "dist", name, "index.d.ts");
    const sf = program.getSourceFile(entry);
    if (!sf) continue;
    const modSym = checker.getSymbolAtLocation(sf);
    if (!modSym) continue;
    const propsSym = checker
      .getExportsOfModule(modSym)
      .find((e) => e.getName() === `${name}Props`);
    if (!propsSym) continue;
    const declaredType = checker.getDeclaredTypeOfSymbol(propsSym);
    const enums = {};
    for (const p of checker.getPropertiesOfType(declaredType)) {
      const nm = p.getName();
      if (nm === "ref" || nm.startsWith("_")) continue;
      const decls = p.getDeclarations() ?? [];
      const ownDecl = decls.find((d) => {
        const f = d.getSourceFile().fileName;
        return f.includes("@astryxdesign/core") && path.basename(f) !== "BaseProps.d.ts";
      });
      if (!ownDecl) continue; // 상속분(HTMLAttributes/BaseProps) 배제.
      const en = stringLiteralUnionMembers(checker.getTypeOfSymbolAtLocation(p, ownDecl));
      if (en) enums[nm] = en;
    }
    index.set(name, enums);
  }
  return index;
}

// doc 파생 enum 을 컴파일된 진실로 보정. dist enum 이 doc enum 의 STRICT 초집합일 때만 채택한다
// (doc 이 실제보다 좁은 경우만 확장). 축소·발산(불완전 dts 해석)은 doc 을 보존해 회귀를 막는다.
function reconcileEnums(props, dtsEnumsForName) {
  if (!dtsEnumsForName) return;
  for (const [name, spec] of Object.entries(props)) {
    if (!Array.isArray(spec.enum)) continue;
    const real = dtsEnumsForName[name];
    if (!real) continue;
    const superset = spec.enum.every((m) => real.includes(m)) && real.length > spec.enum.length;
    if (!superset) continue;
    spec.enum = real;
    spec.type = real.map((m) => `'${m}'`).join(" | "); // 표시 타입도 실제 유니온으로 일치.
  }
}

// ── 메인 ────────────────────────────────────────────────────────────────────
async function main() {
  const pkg = JSON.parse(await readFile(path.join(CORE_DIR, "package.json"), "utf8"));
  const names = Object.keys(pkg.exports)
    .filter((k) => COMPONENT_RE.test(k))
    .map((k) => k.slice(2))
    .sort();

  const subpathSet = new Set(names); // ./{Name} subpath 가 실재하는가(팬텀 가드).
  const barrelNames = new Set(Object.keys(barrel));

  // 컴파일된 .d.ts 의 enum 진실 색인(doc enum 이 좁을 때 확장에 씀 — Spinner.size 'xl' 등).
  const dtsEnums = buildDtsEnumIndex(names);

  const catalog = {};
  const report = {
    total: names.length,
    shapes: {},
    lackedDocs: [], // .doc.mjs 자체가 없는 것(6종).
    dtsFallback: [], // dist .d.ts 폴백을 탄 것(6 + multi-no-match).
    dtsFallbackEmpty: [], // 폴백했으나 {Name}Props 가 없어 빈 엔트리.
    barrelUnresolvable: [], // barrel 평면 export 에 없는 것(subpath 전용).
  };

  for (const name of names) {
    // 팬텀 가드: 이름은 반드시 실재하는 subpath export 에서 파생돼야 한다(집합이 그 자체이므로 항상 참).
    if (!subpathSet.has(name)) {
      throw new Error(`[gen-catalog] 팬텀 컴포넌트: ${name} — package.json exports 에 ./${name} 없음`);
    }
    if (!barrelNames.has(name)) report.barrelUnresolvable.push(name);

    const { docProps, docDesc, group, shape } = await resolveDoc(name);
    report.shapes[shape] = (report.shapes[shape] ?? 0) + 1;
    if (shape === "no-doc") report.lackedDocs.push(name);

    let props;
    let acceptsChildren;
    if (docProps != null) {
      ({ props, acceptsChildren } = fromPropDocs(docProps));
      // 저작 doc enum 이 실제 타입보다 좁으면 컴파일된 진실로 확장(dist 폴백은 이미 dts 해석).
      reconcileEnums(props, dtsEnums.get(name));
    } else {
      const fb = deriveFromDts(name);
      props = fb.props;
      acceptsChildren = fb.acceptsChildren;
      report.dtsFallback.push(name);
      if (!fb.hadInterface || Object.keys(props).length === 0) report.dtsFallbackEmpty.push(name);
    }

    const description = docDesc && String(docDesc).trim() ? String(docDesc) : name;

    const entry = { type: name, importName: name, description };
    if (group) entry.group = group; // catalog.list group 필터용(types.ts 미선언 확장 필드).
    entry.props = props;
    entry.acceptsChildren = acceptsChildren;
    catalog[name] = entry;
  }

  await mkdir(path.dirname(OUT_CATALOG), { recursive: true });
  await writeFile(OUT_CATALOG, JSON.stringify(catalog, null, 2) + "\n", "utf8");
  await writeFile(OUT_REPORT, JSON.stringify(report, null, 2) + "\n", "utf8");

  // 콘솔 요약(진단). barrel 미해결은 완전성 법칙에 따라 유지하되 경고로 남긴다.
  console.log(`[gen-catalog] ${names.length}종 → generated/catalog.json`);
  console.log(`[gen-catalog] shapes: ${JSON.stringify(report.shapes)}`);
  console.log(`[gen-catalog] .doc.mjs 결손(${report.lackedDocs.length}): ${report.lackedDocs.join(", ")}`);
  console.log(`[gen-catalog] dist 폴백(${report.dtsFallback.length}): ${report.dtsFallback.join(", ")}`);
  console.log(`[gen-catalog] 폴백 빈엔트리(${report.dtsFallbackEmpty.length}): ${report.dtsFallbackEmpty.join(", ")}`);
  if (report.barrelUnresolvable.length) {
    console.warn(
      `[gen-catalog] 경고: barrel 평면 export 부재(subpath 전용, 완전성 유지)(${report.barrelUnresolvable.length}): ${report.barrelUnresolvable.join(", ")}`,
    );
  }
}

main().catch((e) => {
  console.error(e?.stack ?? e?.message ?? e);
  process.exit(1);
});
