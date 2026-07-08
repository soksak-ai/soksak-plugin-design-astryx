// 코드 뷰 오버레이(§7 Export presentation law) — export.tsx 결과 tsx 를 shadow 안 astryx CodeBlock 으로
// 띄운다(Meta PreviewShell Code view 이식: CodeBlock code language="tsx" hasLineNumbers hasCopyButton).
// 손hex 크롬 없이 테마 토큰(var(--color-*))·astryx 컴포넌트만 쓴다. 실패는 빈 화면이 아니라 EmptyState 로
// 보이는 오류 표면. 순수 프리젠테이션 — 상태(export 텍스트·오류·파일명)는 canvas-app 이 소유·주입한다.
import type { ReactElement } from "react";
import { Button, CodeBlock, EmptyState, Text } from "@astryxdesign/core";

export interface CodeOverlayProps {
  code: string | null; // export.tsx 성공 시 tsx 코드(null=오류/미개봉).
  error: string | null; // 실패 메시지(null=성공).
  filename: string; // 헤더 파일명 라벨(빈 문자열이면 생략).
  onClose: () => void; // 오버레이 닫기.
}

// export.tsx 결과 오버레이. error 가 있으면 EmptyState, 아니면 CodeBlock 으로 코드를 낮춘다.
export function CodeOverlay({ code, error, filename, onClose }: CodeOverlayProps): ReactElement {
  return (
    <div
      className="export-overlay"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        background: "var(--color-background-surface)",
        color: "var(--color-text-primary)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          borderBottom: "1px solid var(--color-border-emphasized)",
          flexShrink: 0,
        }}
      >
        <Text type="label" weight="semibold">
          TSX 내보내기{filename ? ` — ${filename}` : ""}
        </Text>
        <div style={{ marginLeft: "auto" }}>
          <Button label="닫기" size="sm" variant="secondary" onClick={onClose} />
        </div>
      </div>
      <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "auto", padding: 12 }}>
        {error !== null ? (
          <EmptyState title="내보내기에 실패했습니다." description={error} />
        ) : (
          <CodeBlock code={code ?? ""} language="tsx" hasLineNumbers hasCopyButton />
        )}
      </div>
    </div>
  );
}
