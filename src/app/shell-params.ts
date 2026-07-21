// 셸 URL 해시 파라미터(순수) — 호스트가 서피스 create URL 프래그먼트에 싣는 자기식별을 앱 부트가
// 읽는다: vid = 이 서피스가 섬기는 캔버스 콘텐츠 뷰 id(스냅샷 rails 에서 자기 항목을 찾는 키),
// panel = 레일 패널 모드(structure/inspector — 없으면 캔버스 모드). 미지 값은 null 로 무해화한다
// (잘못된 URL 이 빈 화면 대신 캔버스 폴백으로 떨어지게).
import type { RailSlot } from "./railBridge";
import { RAIL_SLOTS } from "./railBridge";

export interface ShellParams {
  vid: string | null;
  panel: RailSlot | null;
}

export function parseShellHash(hash: string): ShellParams {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  const vid = params.get("vid");
  const panel = params.get("panel");
  return {
    vid: vid || null,
    panel: panel && (RAIL_SLOTS as readonly string[]).includes(panel) ? (panel as RailSlot) : null,
  };
}
