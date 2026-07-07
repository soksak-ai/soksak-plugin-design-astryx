// 미리보기 서버 수명주기 — 플러그인 소유 로컬 http 정적 서버(scripts/preview-server.cjs)를
// app.process("process" 권한)로 스폰하고 PORT 줄을 파싱해 기억한다. GUI 앱은 셸 PATH 를 상속하지
// 않으므로 로그인 셸 래핑(/bin/sh -lc)으로 node 를 해소한다(agents-acp 선례, GUI PATH 함정).
// 서버가 살아 있으면 재사용, 죽었으면 재스폰. 실패는 throw — 호출부가 PREVIEW_FAILED 로 낮춘다.

// 주입되는 프로세스 표면(코어 app.process 의 최소 부분집합).
export interface ServerProc {
  spawn: (cmd: string, args: string[], opts?: { cwd?: string }) => Promise<number>;
  onData: (handle: number, cb: (data: Uint8Array) => void) => { dispose(): void };
  onExit: (handle: number, cb: (code: number) => void) => { dispose(): void };
  kill: (handle: number) => Promise<void>;
}

export interface PreviewServerState {
  handle: number | null;
  port: number | null;
  alive: boolean;
}

export function freshServerState(): PreviewServerState {
  return { handle: null, port: null, alive: false };
}

// stdout 누적 버퍼에서 "PORT=<n>" 줄을 찾는다(순수 — 테스트 대상). 아직 없으면 null.
export function parsePortLine(buffer: string): number | null {
  const m = buffer.match(/(?:^|\n)PORT=(\d{2,5})(?:\n|$)/);
  if (!m) return null;
  const port = Number(m[1]);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : null;
}

// http 미리보기 URL 조립(순수). 페이지 아티팩트는 `${pageId}.html` 평면 배치(§7).
export function previewHttpUrl(port: number, pageId: string): string {
  return `http://127.0.0.1:${port}/${encodeURIComponent(pageId)}.html`;
}

const PORT_TIMEOUT_MS = 8000;

// 서버 보장 — alive 면 기존 포트, 아니면 스폰 후 PORT 줄 대기. state 는 제자리 갱신(스토어 소유).
export async function ensurePreviewServer(args: {
  proc: ServerProc;
  dir: string; // 플러그인 설치 디렉토리(ctx.dir) — 서버 스크립트·.preview 루트의 기준.
  state: PreviewServerState;
}): Promise<number> {
  const { proc, dir, state } = args;
  if (state.alive && state.port) return state.port;

  const serverPath = `${dir}/scripts/preview-server.cjs`;
  const rootPath = `${dir}/.preview`;
  // 로그인 셸 래핑 — debug/release 번들의 빈 PATH 에서도 node 해소(선례: acp-core 960dac9).
  const handle = await proc.spawn("/bin/sh", ["-lc", `exec node "${serverPath}" "${rootPath}"`]);

  let buf = "";
  const port = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => {
      subData.dispose();
      subExit.dispose();
      reject(new Error(`미리보기 서버가 ${PORT_TIMEOUT_MS}ms 안에 포트를 알리지 않았습니다(node 설치 필요).`));
    }, PORT_TIMEOUT_MS);
    const subData = proc.onData(handle, (data) => {
      buf += new TextDecoder().decode(data);
      const p = parsePortLine(buf);
      if (p !== null) {
        clearTimeout(timer);
        subData.dispose();
        resolve(p);
      }
    });
    const subExit = proc.onExit(handle, (code) => {
      clearTimeout(timer);
      subData.dispose();
      subExit.dispose();
      state.alive = false;
      state.handle = null;
      state.port = null;
      reject(new Error(`미리보기 서버가 기동 전에 종료했습니다(code ${code}) — node 가 PATH 에 있어야 합니다.`));
    });
  });

  state.handle = handle;
  state.port = port;
  state.alive = true;
  // 수명 추적 — 죽으면 다음 ensure 가 재스폰한다.
  proc.onExit(handle, () => {
    if (state.handle === handle) {
      state.alive = false;
      state.handle = null;
      state.port = null;
    }
  });
  return port;
}

// 서버 종료(플러그인 deactivate) — 멱등.
export async function stopPreviewServer(proc: ServerProc, state: PreviewServerState): Promise<void> {
  if (state.handle !== null) {
    try {
      await proc.kill(state.handle);
    } catch {
      // 이미 죽은 프로세스 kill 실패는 무해.
    }
  }
  state.handle = null;
  state.port = null;
  state.alive = false;
}
