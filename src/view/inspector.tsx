// 인스펙터 패널(§7 Inspector law) — 선택 노드의 prop 폼. 손으로 쓴 컴포넌트별 폼이 없다:
// prop-form.deriveForm 이 카탈로그 엔트리에서 필드 모델을 파생하고(99종 균일), 이 컴포넌트는 그걸
// 얇게 그린다. 편집은 전부 comp.set 을 인프로세스 execute 로 dispatch — 스토어 직접 변이 금지(단일 진실).
// 텍스트 입력은 ~300ms 디바운스(뷰-로컬 UX), 명령이 진실. 빈 선택 → 안내, tsx 페이지 → 읽기전용 고지.
// 컨트롤은 astryx 도그푸딩(TextInput/NumberInput/Selector/Switch — 배럴 직접 import).
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { Stack, Text, TextInput, NumberInput, Selector, Switch } from "@astryxdesign/core";
import type { CatalogEntry, DesignNode, DesignPage } from "../types";
import type { ExecuteCommand } from "./model";
import {
  deriveForm,
  coerceFieldValue,
  displayValue,
  numericValue,
  compSetParams,
  type FieldModel,
} from "./prop-form";

const DEBOUNCE_MS = 300; // 텍스트 입력 dispatch 디바운스(뷰-로컬 UX). 이산 컨트롤은 즉시.

export interface InspectorProps {
  page: DesignPage | null; // 선택이 속한 페이지(tsx 판별). null = 활성 페이지 없음.
  node: DesignNode | null; // 해소된 선택 노드. null = 노드 미선택(안내).
  entry: CatalogEntry | null; // node.type 의 카탈로그 엔트리. null = 미지 타입(방어 고지).
  execute: ExecuteCommand; // comp.set 인프로세스 실행(핸들러가 검증·persist·재렌더).
}

// astryx status 형(입력의 인라인 오류 표면) — INVALID_PROP 메시지를 필드 밑에 띄운다.
type InputStatus = { type: "error"; message: string } | undefined;

// 힌트: default 원문("'md'")에서 감싼 따옴표만 벗겨 placeholder 로.
function hint(field: FieldModel): string | undefined {
  if (field.default === undefined) return undefined;
  const d = field.default.replace(/^'(.*)'$/, "$1");
  return `default ${d}`;
}

// 한 필드의 편집 컨트롤(kind 별 astryx 매핑). 텍스트류는 draft/디바운스, 이산류는 즉시 commit.
function FieldControl(props: {
  field: FieldModel;
  status: InputStatus;
  draft: string | undefined;
  onDraft: (name: string, text: string) => void;
  commitNow: (field: FieldModel, value: unknown) => void;
  commitDebounced: (field: FieldModel, value: unknown) => void;
}): ReactElement | null {
  const { field: f, status, draft, onDraft, commitNow, commitDebounced } = props;
  const desc = f.description || undefined;

  if (f.kind === "enum") {
    return (
      <Selector
        label={f.name}
        size="sm"
        isRequired={f.required}
        description={desc}
        placeholder={hint(f) ?? "unset"}
        options={(f.options ?? []).map((o) => ({ value: o, label: o }))}
        value={typeof f.value === "string" ? f.value : ""}
        onChange={(v: string) => commitNow(f, v)}
        status={status}
      />
    );
  }

  if (f.kind === "boolean") {
    return (
      <Switch
        label={f.name}
        isRequired={f.required}
        description={desc}
        value={Boolean(f.value)}
        onChange={(checked: boolean) => commitNow(f, checked)}
        status={status}
      />
    );
  }

  // spacing → astryx NumberInput(스텝퍼). 이산 클릭이 주 상호작용 → 즉시 commit.
  if (f.kind === "spacing") {
    return (
      <NumberInput
        label={f.name}
        size="sm"
        isRequired={f.required}
        description={desc}
        placeholder={hint(f)}
        value={numericValue(f)}
        min={f.min}
        max={f.max}
        step={f.step}
        onChange={(n: number) => commitNow(f, n)}
        status={status}
      />
    );
  }

  // number(원시/비-간격 유니온)·string·raw → astryx TextInput(자유 입력). draft + 디바운스.
  const text = draft ?? displayValue(f);
  return (
    <TextInput
      label={f.name}
      size="sm"
      isRequired={f.required}
      description={desc}
      placeholder={hint(f)}
      value={text}
      onChange={(v: string) => {
        onDraft(f.name, v);
        commitDebounced(f, v);
      }}
      status={status}
    />
  );
}

export function Inspector({ page, node, entry, execute }: InspectorProps): ReactElement {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // 선택 노드가 바뀌면 draft·오류 초기화(이전 노드 텍스트가 새 노드로 새지 않게).
  const nodeId = node?.id ?? null;
  useEffect(() => {
    setDrafts({});
    setErrors({});
  }, [nodeId]);

  // 언마운트 시 잔여 타이머 회수.
  useEffect(() => {
    const t = timers.current;
    return () => {
      for (const id of Object.values(t)) clearTimeout(id);
    };
  }, []);

  async function send(field: FieldModel, value: unknown): Promise<void> {
    if (!page || !node) return;
    const params = compSetParams(page.id, node.id, field.name, coerceFieldValue(field, value));
    const out = await execute("comp.set", params);
    // INVALID_PROP 등 실패는 필드 밑 인라인 오류로(스토어는 핸들러가 안 건드림). 성공은 오류 해제.
    setErrors((prev) => {
      const next = { ...prev };
      if (out && out.ok === false) next[field.name] = out.message;
      else delete next[field.name];
      return next;
    });
  }

  function commitNow(field: FieldModel, value: unknown): void {
    const pending = timers.current[field.name];
    if (pending) clearTimeout(pending);
    void send(field, value);
  }

  function commitDebounced(field: FieldModel, value: unknown): void {
    const pending = timers.current[field.name];
    if (pending) clearTimeout(pending);
    timers.current[field.name] = setTimeout(() => void send(field, value), DEBOUNCE_MS);
  }

  function onDraft(name: string, text: string): void {
    setDrafts((d) => ({ ...d, [name]: text }));
  }

  // ── 상태 분기 ──
  // tsx 페이지: 노드가 없다(§2) → 소스 편집 경로로 안내하는 읽기전용 고지.
  if (page && page.source.kind === "tsx") {
    return (
      <Note>
        This page is TSX — its source is the truth. Edit it with page.code.get / page.code.set. The
        inspector edits tree-page nodes only.
      </Note>
    );
  }

  // 선택 노드 없음 → 안내.
  if (!node) {
    return <Note>Select a node in the canvas or structure tree to edit its properties.</Note>;
  }

  // 노드는 있으나 카탈로그 엔트리 없음(미지 타입 — INV3 상 정상 경로에선 안 옴) → 방어 고지.
  if (!entry) {
    return <Note>Unknown component &quot;{node.type}&quot; — no catalog entry to inspect.</Note>;
  }

  const fields = deriveForm(entry, node.props);
  const editable = fields.filter((f) => f.kind !== "readonly");
  const readonly = fields.filter((f) => f.kind === "readonly");

  return (
    <div
      className="inspector"
      style={{ padding: 12, overflow: "auto", height: "100%", boxSizing: "border-box" }}
    >
      <Stack gap={2}>
        <div className="inspector-header">
          <Text type="label" weight="semibold">
            {node.type}
          </Text>{" "}
          <Text type="supporting" color="secondary">
            {node.id}
          </Text>
        </div>

        {editable.length === 0 ? (
          <Text type="supporting" color="secondary">
            No editable properties.
          </Text>
        ) : (
          <Stack gap={2}>
            {editable.map((f) => (
              <FieldControl
                key={f.name}
                field={f}
                status={errors[f.name] ? { type: "error", message: errors[f.name] } : undefined}
                draft={drafts[f.name]}
                onDraft={onDraft}
                commitNow={commitNow}
                commitDebounced={commitDebounced}
              />
            ))}
          </Stack>
        )}

        {readonly.length > 0 && (
          <div className="inspector-readonly" style={{ marginTop: 4 }}>
            <Text type="supporting" color="secondary">
              Read-only ({readonly.length}): {readonly.map((f) => f.name).join(", ")} — callbacks,
              component slots, and non-JSON props are not editable here.
            </Text>
          </div>
        )}
      </Stack>
    </div>
  );
}

// 안내/고지 표면(빈 선택·tsx·미지 타입). 얇은 astryx Text 래퍼.
function Note({ children }: { children: ReactNode }): ReactElement {
  return (
    <div
      className="inspector-note"
      style={{ padding: 16, height: "100%", boxSizing: "border-box" }}
    >
      <Text type="supporting" color="secondary">
        {children}
      </Text>
    </div>
  );
}
