// 미리보기 아티팩트 기록 — 얇은 ctx 층. 문서(index.html)와 러너(runner.js)를 디스크에 쓰고,
// webview 로드 가능 URL 을 돌려준다. CONTRACT §7 의 "쓰기" 책임만 담당한다 — 브라우저 구동(ping·
// open·navigate·폴백)은 호출부(src/commands/preview-drive)의 몫이다. 실패는 throw(호출부가 잡아
// PREVIEW_FAILED 로 매핑). fs 는 주입받아(app.fs.writeText/url) 테스트/구동을 분리한다.
import type { DesignPayload } from "../types";
import { buildPreviewIndexHtml, previewPaths } from "./emit";
import { PREVIEW_ASSETS } from "./assets";

// 주입되는 파일 표면(코어 app.fs 의 최소 부분집합). writeText = fs:write 게이트.
// URL 은 app.fs.url 을 쓰지 않는다 — 그 blob: URL 은 앱 웹뷰 문서에 스코프되어 별도 엔진
// (chromium 사이드카·네이티브 child)이 해석할 수 없다(구글 검색 폴백으로 실증). file:// 직접 구성.
export interface WritePreviewFs {
  writeText: (path: string, content: string) => Promise<void>;
}

export interface WritePreviewArgs {
  fs: WritePreviewFs;
  dir: string; // 플러그인 설치 디렉토리(PluginContext.dir) — 아티팩트 루트.
  pageId: string;
  payload: DesignPayload; // 이 페이지의 { theme, root }.
}

export interface WritePreviewResult {
  indexPath: string; // 수송은 http(§7 서버) — URL 조립은 드라이브 층(previewHttpUrl)의 몫.
}

// `${pageId}.html` + 공유 runner.js 를 `${dir}/.preview/` (평면, .gitkeep 로 실존 보장)에 기록하고
// index 의 URL 을 돌려준다. runner.js 를 먼저 쓴다(문서가 형제 ./runner.js 를 참조).
export async function writePreview(args: WritePreviewArgs): Promise<WritePreviewResult> {
  const { fs, dir, pageId, payload } = args;
  const { indexPath, runnerPath } = previewPaths(dir, pageId);
  await fs.writeText(runnerPath, PREVIEW_ASSETS.runnerJs);
  await fs.writeText(indexPath, buildPreviewIndexHtml(payload, PREVIEW_ASSETS));
  return { indexPath };
}
