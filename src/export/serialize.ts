// DesignNode 트리 → JSX 직렬화의 순수부. CONTRACT §10 의 prop/children 규칙을 그대로 못박는다.
// 카탈로그는 import 이름 매핑에만 쓰이고(§6 에서 type === importName), 없으면 type 을 그대로 쓴다.
import type { JsonValue, DesignNode, Catalog } from "../types";

// 문자열 prop 을 표현식 컨테이너로 감싸야 하는 문자 집합(속성 자리): 따옴표·중괄호·개행.
const ATTR_STRING_NEEDS_EXPR = /["{\n]/;
// children 텍스트를 표현식 컨테이너로 감싸야 하는 문자 집합(자식 자리): JSX 텍스트를 깨는 문자들.
const CHILD_TEXT_NEEDS_EXPR = /[<>{}&\n]/;

// prop 값 → JSX 속성 문자열 조각(예: `label="Save"`, `count={3}`, `disabled`). children 은 여기서 안 다룬다.
export function serializeAttr(name: string, value: JsonValue): string {
  if (value === true) return name; // boolean true = bare 속성
  if (value === false) return `${name}={false}`;
  if (typeof value === "number") return `${name}={${String(value)}}`;
  if (typeof value === "string") {
    if (!ATTR_STRING_NEEDS_EXPR.test(value)) return `${name}="${value}"`;
    return `${name}={${JSON.stringify(value)}}`;
  }
  // null / array / object → JSON 리터럴 표현식 컨테이너
  return `${name}={${JSON.stringify(value)}}`;
}

// children 위치의 값 → JSX 자식 조각(들여쓰기 없음). null = 자식 없음(부모는 self-close).
export function serializeChildValue(value: JsonValue): string | null {
  if (value === null) return null;
  if (typeof value === "string") {
    if (value === "") return null; // 빈 문자열 = 자식 없음
    if (!CHILD_TEXT_NEEDS_EXPR.test(value)) return value; // 안전한 raw 텍스트
    return `{${JSON.stringify(value)}}`; // 특수문자 → 표현식 컨테이너
  }
  if (typeof value === "number") return `{${String(value)}}`;
  if (value === true) return "{true}";
  if (value === false) return "{false}";
  // array / object → JSON 리터럴 표현식
  return `{${JSON.stringify(value)}}`;
}

// 노드 type → import 이름. 카탈로그가 있으면 importName, 없으면 type(§6: type === importName).
export function importNameFor(type: string, catalog?: Catalog): string {
  return catalog?.[type]?.importName ?? type;
}

// props 에서 속성 목록(children 제외, 이름 알파벳 정렬 = 결정적 출력).
function attributesOf(props: Record<string, JsonValue>): string[] {
  return Object.keys(props)
    .filter((k) => k !== "children")
    .sort()
    .map((k) => serializeAttr(k, props[k]));
}

// 한 노드를 depth 들여쓰기(2칸/단계)로 JSX 요소 문자열로 직렬화. 재귀.
// 구조 채널 우선순위: node.children 비어있지 않으면 자식 요소(§2 INV5 로 props.children 과 공존 불가).
// 비어있고 props.children 이 있으면 그 값을 자식으로. 둘 다 없으면 self-close.
export function serializeNode(
  node: DesignNode,
  catalog: Catalog | undefined,
  depth: number,
): string {
  const pad = "  ".repeat(depth);
  const tag = importNameFor(node.type, catalog);
  const attrs = attributesOf(node.props);
  const attrStr = attrs.length ? " " + attrs.join(" ") : "";

  const childNodes = node.children ?? [];
  if (childNodes.length > 0) {
    const inner = childNodes.map((c) => serializeNode(c, catalog, depth + 1)).join("\n");
    return `${pad}<${tag}${attrStr}>\n${inner}\n${pad}</${tag}>`;
  }

  if (Object.prototype.hasOwnProperty.call(node.props, "children")) {
    const child = serializeChildValue(node.props.children);
    if (child !== null) {
      return `${pad}<${tag}${attrStr}>\n${pad}  ${child}\n${pad}</${tag}>`;
    }
  }

  return `${pad}<${tag}${attrStr} />`;
}

// 트리에 등장하는 모든 노드 type 을 유일 집합으로(import 선언 산출용).
export function collectTypes(root: DesignNode): string[] {
  const set = new Set<string>();
  const walk = (n: DesignNode): void => {
    set.add(n.type);
    (n.children ?? []).forEach(walk);
  };
  walk(root);
  return [...set];
}
