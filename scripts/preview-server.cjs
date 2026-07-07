// 미리보기 정적 http 서버 — 127.0.0.1 전용, 루트 감금, 외부 의존성 0(node 내장만).
// file:// 수송의 병리(고유 오리진 fetch 차단·폴리필 무력화·이미지 훅 차단)를 클래스째 제거한다(§7).
// 기동 시 "PORT=<n>" 한 줄을 stdout 으로 알린다 — 부모(플러그인)가 이 줄만 파싱한다.
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || ".");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
};

const srv = http.createServer((req, res) => {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    const rel = decodeURIComponent(url.pathname);
    const p = path.normalize(path.join(root, rel));
    // 루트 감금 — 정규화 후에도 root 밖이면 거부(.. 탈출 차단).
    if (p !== root && !p.startsWith(root + path.sep)) {
      res.writeHead(403, { "content-type": "text/plain" });
      res.end("forbidden");
      return;
    }
    const st = fs.statSync(p, { throwIfNoEntry: false });
    if (!st || !st.isFile()) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
      return;
    }
    res.writeHead(200, {
      "content-type": MIME[path.extname(p).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-store",
    });
    fs.createReadStream(p).pipe(res);
  } catch {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end("error");
  }
});

srv.listen(0, "127.0.0.1", () => {
  process.stdout.write(`PORT=${srv.address().port}\n`);
});
