// theme.set 의 mode 축 순수 판정(CONTRACT §9) — 명령 계층 I/O 와 분리한 테스트 seam.
// theme 검증(THEME_UNKNOWN)은 model.setTheme 이 소유한다. 이 함수는 mode 만 본다:
//   - mode 주어짐 → light|dark|system 중 하나여야 함(아니면 INVALID_PROP).
//   - gothic 은 다크 전용 → 실효 모드가 light 면 거부(INVALID_PROP, actionable). system 은 OS 를
//     따르므로 허용(gothic 은 다크로 렌더). 실효 모드 = 명시 mode ?? 현재 doc.mode ?? system.
//   - 변이 전에 판정한다(handler 는 이 결과가 Err 면 setTheme 을 부르지 않아 doc 를 더럽히지 않는다).
import { err, type Err, type ColorMode, COLOR_MODES } from "../types";

export interface ThemeModeResolved {
  effective: ColorMode; // 이번 theme.set 이 적용할 실효 모드(payload 로 관통).
  explicit: boolean; // mode 를 이번 호출이 명시했나 → true 여야 doc.mode 를 덮어쓴다(무명시 보존).
}

export function resolveThemeMode(
  theme: string,
  rawMode: unknown,
  currentMode: ColorMode | undefined,
): ThemeModeResolved | Err {
  let explicit: ColorMode | undefined;
  if (rawMode !== undefined && rawMode !== null) {
    if (!COLOR_MODES.includes(rawMode as ColorMode)) {
      return err("INVALID_PROP", "mode 는 light, dark, system 중 하나여야 합니다.");
    }
    explicit = rawMode as ColorMode;
  }
  const effective: ColorMode = explicit ?? currentMode ?? "system";
  if (theme === "gothic" && effective === "light") {
    return err(
      "INVALID_PROP",
      "gothic 테마는 다크 전용입니다. mode 를 dark 나 system 으로 두거나 다른 테마를 고르십시오.",
    );
  }
  return { effective, explicit: explicit !== undefined };
}
