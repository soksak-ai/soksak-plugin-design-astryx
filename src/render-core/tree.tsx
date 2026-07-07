// 러너 렌더 코어 — DesignNode 트리를 React 엘리먼트로 낮춘다. 레지스트리(type→컴포넌트)는
// 주입받으므로(entry 는 실제 @astryxdesign/core 배럴, 테스트는 목) 이 모듈은 astryx 에 묶이지 않는다.
// 규범: CONTRACT §2(children 법칙·prop) + §7(미지 type 은 빈 화면 대신 보이는 오류 박스, 절대 throw 금지).
import React from "react";
import type { DesignNode, JsonValue } from "../types";

// type → 컴포넌트(또는 무엇이든). undefined = 카탈로그에 없는 미지 type.
export type ComponentRegistry = Record<string, unknown>;

// 렌더 옵션 — controlledInputs = 제어 입력 컴포넌트 type 집합(카탈로그에서 파생, 빌드타임 주입).
// 없으면(테스트 등) 입력 리매핑을 건너뛴다 — 순수 렌더 경로는 카탈로그 무의존.
export interface RenderOptions {
  controlledInputs?: ReadonlySet<string>;
}

// 안정 no-op — 매 렌더 새 함수를 만들지 않도록 모듈 스코프 단일 인스턴스.
const NOOP: (...args: unknown[]) => void = () => {};

// 정적 목업 입력 법칙(CONTRACT §2 보강) — 트리는 정적이라 콜백이 존재할 수 없다.
//  1. on* prop 는 JSON 발 문자열(또는 불가능한 함수)일 수 있어 절대 실제 핸들러로 승격하지 않는다:
//     전부 떼어내 inert 로 만든다(문자열을 eval 하지 않음).
//  2. 제어 입력 컴포넌트의 문자열/숫자 value → defaultValue 로 이관 + no-op onChange. astryx 입력은
//     value 를 통제값으로 읽으므로 value 를 비우면 내부 native input 이 uncontrolled 가 되어 초기값을
//     보이며 타이핑이 가능해지고(목업 상호작용 유지), React "value without onChange" 경고도 사라진다.
//     boolean/배열 value 는 이관하지 않고 no-op onChange 만 붙인다(설계된 on/off·선택 상태 표시 유지).
//  3. ProgressBar/Timestamp 등 value 를 표시용으로 읽는 비입력 컴포넌트는 controlledInputs 밖이라
//     손대지 않는다(이관하면 표시가 깨진다).
function sanitizeProps(
  type: string,
  props: Record<string, JsonValue>,
  opts?: RenderOptions,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (/^on[A-Z]/.test(k)) continue; // inert
    out[k] = v;
  }
  if (opts?.controlledInputs?.has(type) && "value" in out) {
    const v = out.value;
    if (typeof v === "string" || typeof v === "number") {
      delete out.value;
      out.defaultValue = v;
    }
    out.onChange = NOOP;
  }
  return out;
}

// 보이는 오류 박스 — 미지 type·렌더 예외를 빈 화면 대신 표시. 인라인 스타일(외부 CSS 무의존).
export function ErrorBox({ title, detail }: { title: string; detail?: string }): React.ReactElement {
  return (
    <div
      style={{
        border: "1px solid #f43f5e",
        background: "#fff1f2",
        color: "#9f1239",
        padding: "6px 10px",
        borderRadius: 6,
        margin: 2,
        font: "12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {title}
      {detail ? `\n${detail}` : ""}
    </div>
  );
}

// 노드별 에러 바운더리 — 한 컴포넌트의 렌더 예외가 형제/전체 미리보기를 죽이지 않도록 격리한다.
// 클라이언트(createRoot) 렌더에서만 예외를 잡는다(SSR 정적 렌더는 예외가 전파됨 — 미리보기는
// 브라우저에서 createRoot 로 돌아가므로 실효). 잡으면 그 노드만 ErrorBox 로 대체.
interface BoundaryProps {
  label: string;
  children: React.ReactNode;
}
interface BoundaryState {
  error: Error | null;
}
export class NodeBoundary extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };
  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }
  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <ErrorBox
          title={`Render error in ${this.props.label}`}
          detail={this.state.error.message || String(this.state.error)}
        />
      );
    }
    return this.props.children;
  }
}

// 렌더 대상 children 을 고른다(CONTRACT §2): node.children 가 비지 않으면 그것이 유일한 합성 채널.
// 비었으면 props.children 이 리터럴 문자열일 때 그 텍스트가 children. (둘의 공존은 INV5 로 금지됨.)
export function resolveChildren(
  node: DesignNode,
  renderChild: (child: DesignNode) => React.ReactNode,
): React.ReactNode {
  if (node.children.length > 0) {
    return node.children.map(renderChild);
  }
  const literal = node.props.children;
  if (literal === undefined) return undefined;
  // 문자열/숫자만 React 가 텍스트로 렌더; boolean/null 은 무시됨. 그대로 넘긴다.
  return literal as React.ReactNode;
}

// 한 노드를 React 엘리먼트로. 미지 type 은 ErrorBox, 알려진 type 은 바운더리로 감싸 렌더.
export function renderNode(
  node: DesignNode,
  registry: ComponentRegistry,
  opts?: RenderOptions,
): React.ReactElement {
  const Comp = registry[node.type];
  if (Comp === undefined || Comp === null) {
    return (
      <NodeBoundary key={node.id} label={node.type}>
        <ErrorBox title={`Unknown component: ${node.type}`} detail={`node ${node.id}`} />
      </NodeBoundary>
    );
  }

  // props 에서 children 키를 떼어낸다(위 resolveChildren 가 소유). 나머지는 정적 목업 법칙으로
  // 정제(on* inert · value→defaultValue)한 뒤 컴포넌트 prop 으로 전달.
  const { children: _children, ...rest } = node.props;
  void _children;
  const props = sanitizeProps(node.type, rest, opts);
  const kids = resolveChildren(node, (child) => renderNode(child, registry, opts));

  const element = React.createElement(
    Comp as React.ComponentType<Record<string, unknown>>,
    props,
    kids,
  );
  return (
    <NodeBoundary key={node.id} label={node.type}>
      {element}
    </NodeBoundary>
  );
}
