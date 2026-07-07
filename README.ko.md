# soksak-plugin-design-astryx

soksak 터미널 앱을 위한 "말로 하는 디자인" 플러그인.

디자인 문서는 Astryx 페이지(`@astryxdesign/core`) 집합이다 — 각 페이지는 컴포넌트 트리이거나 원본 TSX. 모든 기능이 명령으로 노출되어, GUI 없이 페이지를 조립하고 테마를 정하고 인앱 캔버스 뷰로 미리보고 TSX 로 내보낸다 — `sok` CLI, MCP 도구, e2e 소켓으로. 플러그인은 프로젝트마다 작업 문서 하나(단일 진실)를 들고 `app.data` 에 저장하며, 캔버스 뷰가 열려 있으면 Astryx 컴포넌트를 라이브로 마운트해 명령마다 재렌더한다. 외부 LLM 은 동봉 스킬(`contributes.skill`)로 구동한다.

## 무엇인가

- **두 페이지 종류.** 페이지는 **tree**(Astryx 컴포넌트 트리 `{ id, type, props, children }` 를 `comp.*` 로 한 노드씩 편집) 또는 **tsx**(원본 `'use client'` TSX 소스가 진실 — shipped 템플릿이나 `page.create kind=tsx` 로 씨앗, `page.code.set` 으로 통째 편집)다. 풍부한 페이지는 tsx 로 시작, 명령 합성 페이지는 tree.
- **전량 범위.** tree 페이지용 `@astryxdesign/core` `0.1.3` 렌더 가능 컴포넌트 export 전량(화이트리스트 없음), 패키지 테마 7종 전부, 619 shipped Astryx CLI 템플릿 전량을 verbatim tsx 로(605 가용, 14 미가용·정직한 사유), 두 종류 모두 TSX 내보내기.
- **헤드리스 완결.** 페이지 생성, 컴포넌트 추가/설정/이동/검색, 템플릿 적용, TSX 편집, 테마 설정, 미리보기, 내보내기까지 전부 명령으로. 문서가 단일 진실이고 뷰는 반영만 한다.
- **테마 주도.** 테마는 문서 레벨이다. 컴포넌트는 활성 테마의 토큰에서 색·간격·라운드·타이포를 읽는다. 좋은 디자인은 인라인 스타일로 테마와 싸우지 않고 7종 테마 전반에서 버틴다.

## 명령 표면

모든 명령은 JSON params 객체 하나를 받고 v1 메시지 봉투 `{ ok, code, message, data? }` 를 돌려준다.

| 명령 | Params | 결과 |
|---|---|---|
| `ping` | `{}` | `{ version, catalogCount, templateCount }` — 적재/버전 확인. |
| `state` | `{}` | `{ activeTheme, pageCount, pages[] }` — 문서 요약. |
| `docs.list` | `{}` | `docs.get` 으로 읽을 수 있는 독트린 토픽 목록. |
| `docs.get` | `{ topic }` | 독트린 문서 하나(`principles`, `tokens`, `theme`, …). |
| `page.create` | `{ name, kind? }` | 페이지 생성. `kind` `tree`(기본, 루트 `Stack`) 또는 `tsx`(스타터 코드). |
| `page.list` | `{}` | `{ pages[] }`. |
| `page.rename` | `{ pageId, name }` | 페이지 이름 변경. |
| `page.duplicate` | `{ pageId, name? }` | 페이지 복제(tree 는 새 id, tsx 는 `code` verbatim). |
| `page.remove` | `{ pageId }` | 페이지 삭제. |
| `page.code.get` | `{ pageId }` | tsx 페이지 `code`(tree 페이지 → `INVALID_TARGET`). |
| `page.code.set` | `{ pageId, code }` | tsx 페이지 `code` 교체. 게이트에서 컴파일. |
| `comp.add` | `{ pageId, type, parentId?, index?, props? }` | `parentId`(기본 루트) 아래 노드 추가. tree 페이지 전용. |
| `comp.set` | `{ pageId, nodeId, props, replace? }` | props 병합(또는 교체). `null` 값은 키 삭제. tree 페이지 전용. |
| `comp.move` | `{ pageId, nodeId, parentId, index? }` | 노드 재부모(사이클·루트 거부). tree 페이지 전용. |
| `comp.remove` | `{ pageId, nodeId }` | 노드와 서브트리 삭제(루트 제외). tree 페이지 전용. |
| `comp.get` | `{ pageId, nodeId }` | 서브트리 전체 반환. tree 페이지 전용. |
| `comp.find` | `{ pageId?, type?, propContains? }` | 일치 노드 검색. tree 페이지 전용. |
| `theme.set` | `{ theme, mode? }` | `activeTheme` 와 라이트/다크/시스템 `mode` 설정. 마운트된 캔버스가 라이브 재렌더. |
| `theme.list` | `{}` | `{ themes, active }` — 테마 7종. |
| `template.list` | `{ kind?, includeUnavailable? }` | 가용 템플릿 + 미가용 개수/사유. |
| `template.apply` | `{ id, pageId?, name? }` | 템플릿 verbatim 코드로 tsx 페이지 생성. |
| `catalog.list` | `{ group?, query? }` | 카탈로그 컴포넌트 목록. |
| `catalog.doc` | `{ type }` | 카탈로그 엔트리 전체: props·enum·기본값·`acceptsChildren`. |
| `preview.open` | `{ pageId }` | 페이지 선택 후 인앱 캔버스 뷰 열기/포커스. |
| `preview.refresh` | `{ pageId? }` | 캔버스 명시적 재렌더(뷰 없으면 무연산). |
| `canvas.select` | `{ pageId?, nodeId }` | 뷰-세션 선택 설정(구조 트리·캔버스 클릭이 쓰는 같은 필드). `pageId` 는 활성 페이지 기본, `nodeId` null 은 노드 해제(페이지만). 비 null `nodeId` 는 살아있는 tree 페이지 노드여야 함 → 아니면 `NOT_FOUND`. |
| `canvas.set` | `{ viewport?, background? }` | 뷰-세션 프레이밍 설정: `viewport` `fill`/`1280`/`768`/`375`(잘못된 값 → `data.validValues` 실은 `INVALID_PROP`), `background` CSS 색 또는 `neutral`/`''` 로 기본. 최소 하나 필수. |
| `export.tsx` | `{ pageId }` | 페이지의 TSX(tsx 페이지 `code` verbatim, 또는 트리 직렬화기). |

에러 `code` 는 닫힌 집합이다: `NOT_FOUND`, `INVALID_TYPE`, `INVALID_PROP`, `INVALID_TARGET`, `INVALID_ARG`, `DUPLICATE`, `TEMPLATE_UNKNOWN`, `TEMPLATE_UNAVAILABLE`, `THEME_UNKNOWN`, `COMPILE_FAILED`, `PREVIEW_FAILED`, `EXPORT_FAILED`.

## 캔버스 구조

주요 디자인 표면은 인앱 **캔버스 뷰**다(플러그인 뷰, id `canvas`, `+` 메뉴의 `design-astryx` 프로그램이 연다). 브라우저 문서가 아니다. `preview.open` 은 캔버스 탭을 열거나 포커스한다 — http 서버도, `file://` 아티팩트도, 브라우저 의존도 없다.

뷰는 활성 페이지의 Astryx 컴포넌트를 앱 웹뷰 안 Shadow DOM 에 React 트리로 **직접** 마운트하고, 명령이 변형하는 같은 모듈 스토어에 라이브 바인딩한다 — 그래서 모든 명령(`comp.*`, `page.*`, `theme.set`, `template.apply`, `page.code.set`)이 활성 페이지를 즉시 재렌더하며 내비게이션도 디스크 기록도 없다. Shadow DOM 이 전역 CSS 리셋을 격리한다(erd 선례): 뷰는 `reset.css` → `astryx.css`(`:root` 를 `:host` 로 치환) → 테마 7종 블록을 shadow 에 주입하고, 활성 테마는 shadow 호스트 래퍼의 `data-astryx-theme` + `color-scheme` 로 싣는다. 테마·모드 전환은 그 속성을 제자리에서 바꾼다.

뷰 크롬은 Astryx 자신으로 도그푸드한 3-패널 프레임이다(Layout + LayoutPanel + LayoutContent): **구조** 패널(왼쪽, ~260px), 캔버스(가운데), **인스펙터** 패널(오른쪽, ~320px), 위에 툴바 헤더. 모든 컨트롤은 명령 클라이언트다(헤드리스와 UI 가 한 진실):

- **툴바 헤더** — 페이지 선택기, `theme.set` 을 구동하는 테마(7) + 모드(라이트/다크/시스템) 선택기, `canvas.set` 을 구동하는 뷰포트/배경 프레이밍, `TSX 내보내기`(`export.tsx`) 버튼.
- **구조 패널** — 활성 페이지 노드 트리를 투영하는 `TreeList`(tsx 페이지는 읽기전용 `⌁ code` 행 하나). 노드 클릭은 `canvas.select` 로 흐른다.
- **인스펙터 패널** — 선택 노드의 `catalog.doc` 스키마로 만든 prop 폼(enum → Selector, boolean → Switch, spacing → 스테퍼, string/number/style → 텍스트), 편집 시 `comp.set` dispatch.
- **캔버스** — 렌더된 노드 클릭은 `canvas.select` 로 흐르고, 선택은 트리와 캔버스 양쪽에서 하이라이트된다. 프레이밍(`canvas.set`)과 선택(`canvas.select`)은 뷰-로컬 뷰-세션 상태다 — 문서의 일부가 아니고 저장되지 않으며 창마다 독립이되, 완전히 명령 가능해 LLM 이 헤드리스로 프레이밍·선택할 수 있다.

렌더 코어(이전 전송에서 재사용)는 `page.kind` 로 분기한다: **tree** 페이지는 각 `node.type` 을 `@astryxdesign/core` 바렐에서 해소해 트리를 렌더하고, **tsx** 페이지는 sucrase 로 컴파일해 `react`·`@astryxdesign/core` 바렐·heroicons·lucide 를 번들에서 해소하는 require-shim 으로 마운트한다(default export 무손실 마운트). 컴파일·런타임 오류는 빈 화면이 아니라 보이는 오류 표면으로 렌더한다.

## 사용

라이브 명령 표면 발견(이름·파라미터는 바뀌니 추측 금지):

```
sok commands | grep plugin.soksak-plugin-design-astryx
sok help plugin.soksak-plugin-design-astryx.<command>
```

조립·미리보기·확인:

```
sok plugin.soksak-plugin-design-astryx.theme.set theme=matcha
sok plugin.soksak-plugin-design-astryx.page.create name='Landing'
sok plugin.soksak-plugin-design-astryx.comp.add pageId=<p> type=Card
sok plugin.soksak-plugin-design-astryx.comp.add pageId=<p> parentId=<cardId> type=Button \
  props='{"label":"Get started","variant":"primary"}'
sok plugin.soksak-plugin-design-astryx.preview.open pageId=<p>   # 인앱 캔버스 뷰 열기
sok window.snapshot            # 앱 창 캡처 후 픽셀 확인
sok plugin.soksak-plugin-design-astryx.export.tsx pageId=<p>
```

동봉된 `soksak-design-astryx` 스킬(`contributes.skill`)이 AI 에이전트용 트리 모델과 워크플로 전체를 담는다.

## 개발

```
npm install
npm test
npm run build   # 카탈로그·템플릿 생성 → CSS 빌드 → main.js 번들(esbuild)
```

`npm run build` 는 순서대로 `scripts/gen-catalog.mjs` 와 `scripts/gen-templates.mjs`(`@astryxdesign/core`·`@astryxdesign/cli` 에서 `generated/catalog.json`·`generated/templates.json` 생성), `build:css` 단계(`generated/astryx.css` 와 테마 7종 `generated/theme-css.json`, 캔버스 shadow 에 주입), 그다음 `build.mjs`(`src` → 커밋되는 `main.js` 번들 — 렌더 코어와 그 라이브러리는 `main.js` import 그래프의 일부)를 실행한다. `generated/` 는 git-ignore, `main.js` 는 커밋한다.

## 라이선스

이 플러그인은 [Astryx](https://github.com/facebook/astryx)(`@astryxdesign/core` 와 `@astryxdesign/theme-*` 7종) 위에 만들어졌다. Astryx 는 Meta 의 디자인 시스템이며 MIT 라이선스다. 플러그인은 사전 컴파일된 Astryx 배포물에 의존·번들하며 `@stylexjs/stylex` 는 `0.18.3` 에 고정한다.
