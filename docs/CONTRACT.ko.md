# soksak-plugin-design-astryx — v2 계약

이 문서가 헌법이다. 모든 구현자는 이 문서에 정확히 맞춰 만든다. 이 법의 TypeScript 쌍둥이는 `src/types.ts` 에 있다. 산문과 `types.ts` 가 어긋나면 shape 은 `types.ts` 가, 동작은 이 문서가 이긴다.

플러그인 id 토큰: `design`, `astryx`. 명령 첫 세그먼트는 그 토큰과 같거나 그 축약이 되지 않는다.

---

## 1. 정체성과 범위

이 플러그인은 헤드리스 디자인 문서 엔진**이자 앱 내 캔버스 뷰**(플러그인 프로그램)다. 모든 편집 기능은 레지스트리 명령이고 문서는 헤드리스 완결이라 뷰 없이 `sok` CLI·MCP·동봉 스킬로 구동한다. **1차 디자인 표면**은 캔버스 뷰다: 앱 웹뷰 안 Shadow DOM 에 Astryx 컴포넌트를 **직접** React 트리로 마운트하고, 명령이 변이하는 **같은 모듈 스토어에 라이브 바인딩**되어 모든 명령이 활성 페이지를 즉시 재렌더한다. 디스크 아티팩트도, 이동도, 서버도, 브라우저 의존도 없다(§7). 뷰와 명령은 한 진실이다(툴바 자체가 명령 클라이언트, §7 Toolbar law).

### v2 → v3 피벗(캔버스 뷰, 브라우저 미리보기 제거)

v3 는 v2 의 브라우저 미리보기 수송(http 서버 + `file://` 금지 아티팩트를 의존 브라우저 플러그인으로 구동)을 앱 내 캔버스 뷰로 교체한다. 근거 — 1차 표면은 브라우저 문서가 아니라 패널 프로그램이라는 오너의 아키텍처 판정 + erd 선례(erd 는 전역 CSS 리셋을 가두려 자기 React 앱 전체를 `attachShadow` 에 마운트한다). Astryx TSX/트리 렌더 코어는 뷰의 렌더 엔진으로 **그대로 재사용**하고 수송만 바꾼다. 제거 아티팩트는 §7(Legacy-removal law)에 열거한다.

### 두 페이지 종류(v2 법)

페이지의 소스는 둘 중 하나다(§2):

- **tree** — Astryx 컴포넌트(`@astryxdesign/core` `0.1.3`)의 컴포넌트 트리로, `comp.*` 명령 가족이 편집한다. 명령 주도 편집 표면.
- **tsx** — 원본 `'use client'` TSX 소스로 **소스가 진실**이다. tsx 페이지는 `template.apply`(Astryx 의 619 shipped 템플릿 중 하나로부터) 또는 `page.create` `kind: "tsx"` 로 생기고 `page.code.set` 으로 통째 편집된다. 러너가 무손실 컴파일·마운트한다(§7).

Astryx 의 원래 단위는 **TSX 프로그램**이다 — 619 shipped 템플릿은 hooks·로컬 state·헬퍼 컴포넌트·타입 코드를 지닌다. 이들은 tsx 경로로 **무손실** 렌더되지 트리로 격하되지 않는다. 구 템플릿 트리 변환(정적 변환기 + 스켈레톤 로직 + `templates-report.json`)은 **레거시 제거** — git 이 기억한다, 죽은 코드는 남지 않는다.

범위는 전량이다: tree 페이지용 `@astryxdesign/core` 렌더 가능 컴포넌트 export 전부(화이트리스트 없음), 패키지 테마 7종 전부, 619 shipped Astryx CLI 템플릿 전량을 verbatim tsx 로(605개 사용 가능; 미가용 14개·정직한 사유 — 모듈 부재/컴파일타임 전용 7 + 마운트할 default export 없는 아이콘 헬퍼 7, §13), 두 종류 모두 TSX 내보내기.

### 디자인 워크플로(법)

두 종류는 순위가 아니라 상보적이다:

- **풍부한 페이지 → `template.apply` 먼저.** shipped 템플릿은 완결된 `'use client'` 프로그램이다. 적용하면 무손실 렌더되는 tsx 페이지가 생긴다. 실제로 밀도 있는 화면으로 가는 최단 경로.
- **명령 합성 → tree 페이지.** LLM 이 화면을 명령으로 점증 구성할 때(한 번에 컴포넌트 하나를 id 로 add/set/move) tree 페이지(`page.create` 기본 `kind:"tree"`)와 `comp.*` 가족을 쓴다.
- **TSX 수준 편집 → `page.code.set`.** tsx 페이지(템플릿에서 생긴 것 포함)를 바꾸려면 `code` 를 통째 교체한다. 게이트가 landing 전에 컴파일한다(§5).

`export.tsx` 는 두 종류 어느 쪽에서든 작동 코드를 넘긴다(§10).

### React 전제(법)

이 플러그인은 **React 19 를 전제**한다 — Astryx 의 기반. 우발적 의존이 아니다: Astryx 컴포넌트는 React 컴포넌트이고, 렌더 코어는 React 트리를 마운트하며, 캔버스 뷰는 `createRoot` 를 돈다. `-astryx` 엔진 접미사가 이 전제를 **선언**한다(하드 바인딩하는 엔진 이름을 단 플러그인, 명명 법). 확정된 귀결:

- 내보내기는 React TSX(`export.tsx`, §10) — 유일한 내보내기 shape.
- 캔버스 뷰와 그 chrome 은 React(§7 Dogfood 법).
- 코어는 프레임워크 불가지 유지: `app.ui.registerView` 로 뷰를 호스팅(DOM 컨테이너 + Shadow-DOM React 섬)할 뿐, 자기 React 의존을 두지 않는다.
- 다른 프레임워크(Vue·Svelte·순수 HTML)용 디자인 엔진은 **형제 플러그인**(`soksak-plugin-design-<engine>`)이지 이 플러그인의 한 모드가 아니다. 이 플러그인은 프레임워크를 추상화하지 않고 하나에 헌신한다.

---

## 2. 페이지·트리 모델

### Shape (규범은 `src/types.ts`)

```
DesignNode = { id: string, type: string, props: Record<string, JsonValue>, children: DesignNode[] }
PageSource = { kind: "tree", root: DesignNode } | { kind: "tsx", code: string, origin?: string }
DesignPage = { id: string, name: string, source: PageSource }
DesignDoc  = { version: 1, activeTheme: ThemeName, mode?: ColorMode, pages: DesignPage[], seq: number }
ColorMode  = "light" | "dark" | "system"
```

`DesignDoc.mode` 는 선택(모드 이전 문서엔 부재)이고 부재 시 `system` 으로 읽는다(§9, §11).

`JsonValue` 는 JSON 직렬화 가능한 값만이다. 문서 전체가 하나의 JSON 값으로 저장되고 미리보기에 `window.__DESIGN__` 로 주입된다.

### 페이지 소스 법(v2)

페이지의 `source` 는 `kind` 로 판별하는 합집합이다:

- **`{ kind: "tree", root }`** — `comp.*` 트리 가족(add/set/move/remove/get/find)이 `source.root` 를 편집한다. `export.tsx` 가 직렬화한다(§10). 명령 주도 편집 표면.
- **`{ kind: "tsx", code, origin? }`** — `code` 가 원본 TSX 이자 유일한 진실이다. `origin` 은 유래 `templateId`(해당 시). `page.code.get`/`page.code.set` 이 `code` 를 읽고 교체한다. `export.tsx` 는 그대로(verbatim) 반환한다(§10). 러너가 컴파일·마운트한다(§7). 트리 연산은 적용되지 않는다.

**v1 → v2 강제(제자리, 마이그레이션 파일 없음).** 저장된 v1 페이지는 root-only(`{ id, name, root }`)였다. 하이드레이트 시 `coerceDoc` 이 `{ id, name, source: { kind: "tree", root } }` 로 다시 쓴다. `DesignDoc.version` 은 `1` 유지 — 페이지 소스 법은 포맷의 상위집합이라 버전 상향도 마이그레이션 아티팩트도 없고, 강제는 하이드레이트 시점 규칙이다(§11). `source` 가 부재·불량인 페이지는 throw 하지 않고 빈 tree 페이지(`{ kind: "tree", root: 맨 Stack }`)로 강제한다.

### 종류별 명령 표적

`comp.*` 가족과 모든 트리 연산은 **tree 페이지에만** 작동한다. tsx 페이지에서 호출되면 `INVALID_TARGET` 을 반환하고 message 가 `page.code.get`/`page.code.set` 로 안내한다. 대칭으로 `page.code.get`/`page.code.set` 은 **tsx 페이지에만** 작동한다. tree 페이지에서는 `INVALID_TARGET` 을 반환하고 `comp.*` 가족(또는 직렬화 코드를 읽는 `export.tsx`)으로 안내한다. `export.tsx`·`page.rename`·`page.duplicate`·`page.remove`·`page.list`·`state`·`preview.*` 는 종류 무관하게 양쪽에 작동한다.

아래 `children 법`·`id 생성`·`불변식`·`prop 검증 법`은 **tree 페이지에만**(`source.kind === "tree"`) 적용된다. tsx 페이지는 노드도 노드 id 도 prop 검증도 없다 — `code` 가 진실이고 `page.code.set` 의 컴파일이 검증한다(§5).

### children 법(결정)

`node.children` 이 **유일한** 구조적 합성 채널이다. `node.children` 은 카탈로그가 `node.type` 에 대해 `acceptsChildren === true` 로 표시한 경우에만 비어있지 않을 수 있다. 러너는 `node.children` 을 컴포넌트의 React `children` prop 으로 채운다.

텍스트·스칼라는 언제나 prop 이다. **리터럴 텍스트**로 채운 ReactNode prop 은 문자열 prop 값이다(예: `props.label = "Save"`, 또는 텍스트 전용 노드의 `props.children = "Card Title"`). **컴포넌트**로 채운 ReactNode prop 은 `node.children` 을 쓴다. 이 둘은 공존하지 않는다: `node.children` 이 비어있지 않으면 `props` 에 `children` 키가 없어야 한다.

### id 생성

`DesignDoc.seq` 는 단조 증가 카운터이고 재사용되지 않는다(삭제 후에도). 새 페이지 id 는 `p${++seq}`, 새 tree 페이지 노드 id 는 `n${++seq}`. 페이지 id 와 노드 id 는 `seq` 공간을 공유하므로 문서 내 모든 id 가 전역 유일하다. tree 페이지 깊은 복사(`page.duplicate`)는 노드마다 `seq` 에서 새 id 를 발급한다. tsx 페이지는 노드 id 가 없다 — tsx 페이지 `page.duplicate` 는 새 페이지 id 만 발급하고 `code`(와 `origin`)를 verbatim 복사한다. `template.apply` 는 새 페이지 id 만 발급하고 노드 id 가 필요 없다.

### 불변식(명령 핸들러가 강제)

- **INV1 단일 루트** — 각 페이지는 루트 노드가 정확히 하나. 루트는 부모가 없다. 루트는 이동·삭제되지 않는다.
- **INV2 비순환** — children 은 트리를 이룬다. `comp.move` 는 대상이 이동 노드 자신이거나 그 자손이면 거부한다.
- **INV3 알려진 type** — 모든 `node.type` 이 카탈로그에 존재한다. `comp.add`·`comp.set`(type 무변)·템플릿 로드에서 강제.
- **INV4 children 게이트** — `node.children` 비어있지 않음 ⇒ `catalog[type].acceptsChildren === true`.
- **INV5 이중 children 금지** — `node.children` 비어있지 않은 동안 `props` 에 `children` 키 없음.
- **INV6 유일 id** — 문서 전역에서 모든 페이지 id·노드 id 가 유일.

### prop 검증 법

`comp.add`·`comp.set` 은 들어오는 각 prop 을 `catalog[type].props` 에 대해 검증한다:

- 미지 prop 이름 → `INVALID_PROP`.
- 카탈로그 `type` 에 `"=>"` 가 든 prop(콜백) → `INVALID_PROP`. 콜백은 JSON 직렬화 불가이고 v1 미리보기는 비상호작용이다.
- 카탈로그 `enum` 이 있는 prop → 값이 멤버여야 함 → 아니면 `INVALID_PROP`.
- 카탈로그 `type` 이 정확히 `"string"`·`"number"`·`"boolean"` 인 prop → 값이 그 원시형이어야 함 → 아니면 `INVALID_PROP`. 그 외 카탈로그 type 은 임의 `JsonValue` 를 받는다(유니온·`ReactNode`·배열·객체는 더 검사 불가).
- `props.children` 을 문자열로 설정하는 것은 `node.children` 이 비었을 때만 허용(INV5).

필수 prop 은 쓰기 시점에 강제하지 **않는다** — 트리는 점증적으로 짓는다. `export.tsx` 와 미리보기는 존재하는 것을 렌더한다.

---

## 3. 에러 코드(닫힌 집합)

명령 계층은 정확히 이 코드만 생산한다(`src/types.ts` `Code`):

`OK`, `NOT_FOUND`, `INVALID_TYPE`, `INVALID_PROP`, `INVALID_TARGET`, `INVALID_ARG`, `DUPLICATE`, `TEMPLATE_UNKNOWN`, `TEMPLATE_UNAVAILABLE`, `THEME_UNKNOWN`, `COMPILE_FAILED`, `PREVIEW_FAILED`, `EXPORT_FAILED`.

- `TEMPLATE_UNAVAILABLE` — 템플릿 id 는 있으나 `available === false`(결손·컴파일타임 전용 의존, §13). `template.apply` 가 템플릿 `reason` 과 함께 반환한다. `TEMPLATE_UNKNOWN`(id 가 `templates.json` 에 없음)과 구별된다.
- `COMPILE_FAILED` — `page.code.set` 이 렌더 코어 sucrase 설정(§7)에서 컴파일 안 되는 TSX 를 받았다. 실패 봉투가 컴파일러 오류를 `data.diagnostics` 에 싣는다(§4).
- `PREVIEW_FAILED` — v3 의미: 캔버스 뷰 열기/포커스 실패(`plugin.view.open` 비-ok, 예: 활성 프로젝트 없음). v2 의미(아티팩트 쓰기·브라우저 구동)는 사라졌다.

두 뷰-세션 명령(§5)은 새 코드를 **추가하지 않는다**. `canvas.select` 는 노드 존재를 검증하고 `NOT_FOUND`(미지 `pageId`/`nodeId`)를 반환한다. `canvas.set` 은 `viewport` 를 enum 검증하고 잘못된 값에 `INVALID_PROP` 를 반환하며 허용 집합을 `data.validValues` 에 싣는다(실패-`data` 채널의 두 번째 사용자, §4).

**v3 제거:** `DEP_MISSING` — 브라우저 의존 탐지가 더는 없다(캔버스는 앱 내). 참조 코드는 삭제, git 이 기억한다(§7 Legacy-removal law).

`PERMISSION_DENIED`·`UNKNOWN_COMMAND`·`INVALID_PARAMS`·`INTERNAL` 은 코어 소유 결과(`registry.execute` 가 생산)이지 핸들러가 만들지 않는다.

---

## 4. 메시지 프로토콜(v1)과 핸들러 규약

와이어 결과는 언제나 대칭 봉투 `{ ok, code, message, data? }` 다. 코어 `registry.execute`/`normalizeOutcome` 가 짓는다. 핸들러는 재료를 준다:

- **성공** — 핸들러는 평범한 데이터 레코드(`data`)를 반환한다. 표시 `message` 는 `register(...).message = (data) => <한국어 한 줄>` 이 소유한다. 성공 시 핸들러가 넣은 `message` 는 버려지므로 한국어 한 줄은 `spec.message` 에만 산다(단일 소유).
- **실패** — 핸들러는 `src/types.ts` 의 `err(code, message)` = `{ ok:false, code, message }` 를 반환하고 그대로 보존된다. `{ ok:false, error }` 레거시 방언은 금지.
- **진단 포함 실패** — `err(code, message, data)` 는 실패 봉투에 선택적 구조 `data` 를 더한다. 대칭 봉투 `{ ok, code, message, data }` 를 따른다. 두 사용자: `page.code.set` 의 `COMPILE_FAILED`(`data.diagnostics` = sucrase 컴파일러 오류)와 `canvas.set` 의 `INVALID_PROP`(`data.validValues` = 허용 `viewport` 집합, §5). 사람용 요약은 `message` 에도 담아, 코어가 실패 `data` 를 흘려도 오류가 사라지지 않게 한다.

모든 `register(...)` 호출은 `message` 를 반드시 제공한다. `message` 누락은 답을 라벨로 열화시키고 `plugin.conformance` 가 그 명령을 `messagesMissing` 으로 보고한다. 모든 명령 message 는 명령이 소유하는 한국어 산문이다.

명령 description 은 2축 i18n 규칙(`docs/I18N.md`)을 따른다: `spec.description` 은 영어 base 문자열(LLM 발견 표면), `spec.triggers` 는 비영어 트리거 맵(언어 → 단어). 사람 라벨은 매니페스트 `contributes.commands[].title`(`{en,ko}`)이다. 매니페스트는 param 스키마·description 을 담지 않는다 — 그건 런타임 `register(...)` 스펙에만 산다.

---

## 5. 명령 표면(28)

모든 명령은 단일 JSON params 객체를 받고 §4 대로 반환한다. `pageId`/`nodeId` 는 §2 의 id 다. 아래에서 "→" 는 성공 데이터 레코드, "errs" 는 핸들러가 반환할 수 있는 §3 부분집합이다.

순서 참고: `page.create` 가 소스를 한 번 정한다(tree 루트 또는 스타터 tsx). `comp.add` 는 루트를 만들지 않는다. tree 페이지 루트는 이동·삭제되지 않는다.

**종류 게이트(§2).** 모든 `comp.*` 명령은 `pageId` 가 **tsx 페이지**를 가리키면 추가로 `INVALID_TARGET` 을 반환한다 — message 가 `page.code.get`/`page.code.set` 로 안내. `page.code.get`/`page.code.set` 은 `pageId` 가 **tree 페이지**를 가리키면 `INVALID_TARGET` 을 반환한다 — message 가 `comp.*` 가족 또는 `export.tsx` 로 안내. 이 게이트는 아래 각 엔트리 `errs` 에 반복하지 않는다 — 두 가족에 보편이다.

### ping
- params: `{}`
- → `{ version, catalogCount, templateCount }`
- errs: 없음
- message: `Astryx 디자인 플러그인 v{version} — 컴포넌트 {catalogCount}종, 템플릿 {templateCount}개.`

### state
- params: `{}`
- → `{ activeTheme, pageCount, pages: [{ id, name, kind, rootType?, nodeCount? }] }`(`rootType`/`nodeCount` 는 tree 페이지에만, tsx 페이지는 `kind: "tsx"`)
- errs: 없음
- message: `문서: 테마 {activeTheme}, 페이지 {pageCount}개.`

### page.create
- params: `{ name: string, kind?: "tree" | "tsx" }`(`kind` 기본 `tree`)
- 동작: `kind` 페이지를 만든다. `tree` → `source = { kind:"tree", root: 맨 Stack }`(`{ type:"Stack", props:{}, children:[] }`). `tsx` → `source = { kind:"tsx", code: <스타터 컴포넌트> }`, 스타터는 최소 컴파일 가능 `'use client'` default-export 컴포넌트다. shipped 템플릿으로 페이지를 씨앗하려면 `template.apply`(템플릿 코드로 tsx 페이지 생성, §13)를 쓴다. `page.create` 는 더 이상 `template` param 을 받지 않는다 — 그 경로는 `template.apply`.
- → `{ pageId, name, kind, rootType?, nodeCount? }`(`rootType`/`nodeCount` 는 tree 페이지에만)
- errs: `INVALID_ARG`(빈 name, 또는 잘못된 `kind`)
- message: `{kind} 페이지 '{name}' 생성.`

### page.list
- params: `{}`
- → `{ pages: [{ id, name, kind, rootType?, nodeCount? }] }`(`rootType`/`nodeCount` 는 tree 페이지에만)
- errs: 없음
- message: `페이지 {pages.length}개.`

### page.rename
- params: `{ pageId: string, name: string }`
- → `{ pageId, name }`
- errs: `NOT_FOUND`, `INVALID_ARG`(빈 name)
- message: `페이지 이름 '{name}' 으로 변경.`

### page.duplicate
- params: `{ pageId: string, name?: string }`
- 동작: 페이지를 새 id 로 깊게 복제한다. 기본 새 이름 = `"{원본 이름} copy"`.
- → `{ pageId, name, nodeCount }`
- errs: `NOT_FOUND`
- message: `페이지 '{name}' 복제(노드 {nodeCount}개).`

### page.remove
- params: `{ pageId: string }`
- 동작: 페이지를 삭제한다. 문서는 페이지 0개를 가질 수 있다.
- → `{ removedId }`
- errs: `NOT_FOUND`
- message: `페이지 삭제.`

### comp.add
- params: `{ pageId: string, type: string, parentId?: string, index?: number, props?: Record<string, JsonValue> }`
- 동작: `type` 노드를 `parentId`(기본 = 페이지 루트) 아래 `index`(기본 = 끝)에 추가한다. `type`(INV3), 부모 `acceptsChildren`(INV4), props(§2 검증)를 확인한다.
- → `{ nodeId, node }`(`node` = 생성된 서브트리)
- errs: `NOT_FOUND`(페이지/부모), `INVALID_TYPE`, `INVALID_TARGET`(부모 `acceptsChildren=false`), `INVALID_PROP`, `INVALID_ARG`(index 범위 초과)
- message: `{type} 를 {parentId} 아래 추가(노드 {nodeId}).`

### comp.set
- params: `{ pageId: string, nodeId: string, props: Record<string, JsonValue>, replace?: boolean }`
- 동작: `props` 를 노드에 병합한다(`replace===true` 면 전량 교체). prop 값 `null` 은 그 키를 삭제한다. §2 대로 검증.
- → `{ nodeId, node }`
- errs: `NOT_FOUND`, `INVALID_PROP`
- message: `{node.type} 속성 갱신.`

### comp.move
- params: `{ pageId: string, nodeId: string, parentId: string, index?: number }`
- 동작: `nodeId` 를 `parentId` 아래 `index`(기본 끝)로 재부모화.
- → `{ nodeId, parentId, index }`
- errs: `NOT_FOUND`, `INVALID_TARGET`(루트 이동·대상이 자신/자손·대상 `acceptsChildren=false`), `INVALID_ARG`(index 범위 초과)
- message: `{nodeId} 를 {parentId} 아래로 이동.`

### comp.remove
- params: `{ pageId: string, nodeId: string }`
- 동작: 노드와 서브트리를 삭제한다. 루트는 삭제 불가.
- → `{ removedId, removedCount }`
- errs: `NOT_FOUND`, `INVALID_TARGET`(루트 삭제)
- message: `노드 {removedCount}개 삭제.`

### comp.get
- params: `{ pageId: string, nodeId: string }`
- → `{ node }`(서브트리 전체)
- errs: `NOT_FOUND`
- message: `{node.type} 노드({nodeId}).`

### comp.find
- params: `{ pageId?: string, type?: string, propContains?: string }`
- 동작: 전 페이지(또는 한 페이지)에서 `type`(정확) 및/또는 `propContains`(직렬화된 prop 값에 대한 대소문자 무시 부분일치)로 노드를 찾는다.
- → `{ matches: [{ pageId, nodeId, type }] }`
- errs: `NOT_FOUND`(준 `pageId` 부재)
- message: `일치 노드 {matches.length}개.`

### theme.set
- params: `{ theme: ThemeName, mode?: ColorMode }`(`ColorMode` = `light` | `dark` | `system`, 기본 `system`)
- 동작: `activeTheme` 을 설정하고, `mode` 가 주어지면 색 모드도 설정한다. `gothic` 은 다크 전용이라 **실효** 모드가 `light` 인 호출(명시 `mode:"light"`, 또는 `mode` 무명시인데 저장된 모드가 `light`)은 `INVALID_PROP` 로 거부한다. `mode` 검증과 gothic 게이트는 `activeTheme` 변이 **전**에 돌므로 거부된 호출은 문서를 건드리지 않는다. `mode` 는 문서에 영속하고(§11) `mode` 무명시는 저장된 모드를 보존한다. 마운트된 캔버스 뷰는 `store.onChange` 로 자동 재렌더한다 — shadow 호스트의 `data-astryx-theme` 속성과 `color-scheme` 을 스왑(§7 Theme law). 구동할 브라우저도, 재발행할 아티팩트도 없어 테마/모드 변경은 순수 스토어 변이다.
- → `{ theme, mode }`(`mode` = 적용된 실효 모드)
- errs: `THEME_UNKNOWN`, `INVALID_PROP`(mode 가 light/dark/system 밖·gothic 에 실효 light 모드)
- message: `테마 {theme}·모드 {mode} 적용.`

### theme.list
- params: `{}`
- → `{ themes, active }`
- errs: 없음
- message: `테마 {themes.length}종(현재 {active}).`

### template.list
- params: `{ kind?: "page" | "block", includeUnavailable?: boolean }`
- 동작: 템플릿을 나열한다(§13). 기본은 **사용 가능**(`available === true`)만 내고 미가용 꼬리를 개수+사유로 보고한다. `includeUnavailable: true` 면 `templates` 배열에 미가용 엔트리도(각기 `available`·`reason` 포함) 싣는다.
- → `{ templates: [{ id, kind, name, requires, available, reason? }], available, unavailableCount, unavailable: [{ id, name, reason }] }`(`available` = 나열된 사용 가능 템플릿 개수)
- errs: `INVALID_ARG`(잘못된 kind)
- message: `템플릿 {available}개 사용 가능(미가용 {unavailableCount}개).`

### template.apply
- params: `{ id: string, pageId?: string, name?: string }`
- 동작: 템플릿의 verbatim `code` 로 **tsx 페이지**를 만든다(§13). `pageId` 가 있으면 그 페이지 `source` 를 `{ kind:"tsx", code, origin: id }` 로 교체한다(대상은 어느 종류든 — 소스가 tsx 로 덮인다). 없으면 새 tsx 페이지를 만든다(`name` 기본 = 템플릿 이름). `available === false` 템플릿은 `TEMPLATE_UNAVAILABLE` 과 그 `reason` 으로 거부한다. 기존 노드 아래 블록 삽입은 범위 밖.
- → `{ pageId, name, kind: "tsx", origin }`
- errs: `TEMPLATE_UNKNOWN`, `TEMPLATE_UNAVAILABLE`(reason 동반), `NOT_FOUND`(준 `pageId` 부재)
- message: `템플릿 '{id}' 적용(tsx 페이지).`

### page.code.get
- params: `{ pageId: string }`
- 동작: **tsx 페이지**의 TSX `code` 를 반환한다. tree 페이지는 `INVALID_TARGET`(종류 게이트, §2)으로 `comp.*`/`export.tsx` 안내.
- → `{ pageId, code, origin? }`
- errs: `NOT_FOUND`(페이지), `INVALID_TARGET`(tree 페이지)
- message: `{pageId} TSX {code.length}자.`

### page.code.set
- params: `{ pageId: string, code: string }`
- 동작: **tsx 페이지**의 `code` 를 교체한다. 렌더 코어의 정확한 sucrase 설정(§7)으로 `code` 를 인프로세스 컴파일해 검증한다 — 렌더 코어가 돌리는 그 변환 그대로라 나쁜 코드는 게이트에서 거부된다. 컴파일 실패 시 컴파일러 오류를 `data.diagnostics` 에(요약은 `message` 에) 담아 `COMPILE_FAILED` 반환, 페이지는 불변. 성공 시 `source = { kind:"tsx", code }`(기존 `origin` 보존). tree 페이지는 `INVALID_TARGET`(종류 게이트, §2) — 제자리 tree→tsx 변환은 없다. `page.create kind=tsx` 나 `template.apply` 로 tsx 페이지를 씨앗하라.
- → `{ pageId, bytes }`(`bytes` = `code.length`)
- errs: `NOT_FOUND`(페이지), `INVALID_TARGET`(tree 페이지), `INVALID_ARG`(빈 code), `COMPILE_FAILED`(`data.diagnostics` 동반)
- message: `{pageId} TSX 갱신({bytes}자).`

### catalog.list
- params: `{ group?: string, query?: string }`
- 동작: 카탈로그 컴포넌트를 나열한다. `group`(정확) 또는 `query`(`type`/`description` 부분일치, 대소문자 무시)로 필터.
- → `{ components: [{ type, description, acceptsChildren, propCount }] }`
- errs: 없음
- message: `컴포넌트 {components.length}종.`

### catalog.doc
- params: `{ type: string }`
- → `{ entry }`(`CatalogEntry` 전체)
- errs: `INVALID_TYPE`(카탈로그에 없는 type)
- message: `{type} — 속성 {propCount}개.`

### docs.list
- params: `{}`
- 동작: 구운 Astryx 독트린 토픽(§14)을 한 줄 요약과 함께 나열한다. 토픽 id 오름차순.
- → `{ topics: [{ topic, title, dense, description }] }`
- errs: 없음
- message: `Astryx 문서 토픽 {topics.length}개.`

### docs.get
- params: `{ topic: string }`
- 동작: `topic` 의 전체 독트린 본문을 반환한다(§14). `dense` 는 토큰 절약 변형을 구웠는지 알린다.
- → `{ topic, title, dense, description, text }`
- errs: `INVALID_ARG`(빈 topic), `NOT_FOUND`(미지 topic)
- message: `{topic} 문서 — {text.length}자.`

### preview.open
- params: `{ pageId: string }`
- 동작: 페이지를 캔버스의 활성 페이지로 선택하고(`store.preview.activePageId` 설정 + `onChange` 발화 → 마운트된 뷰가 그 페이지 재렌더), 캔버스 뷰를 열거나 포커스한다. 여는 호출은 `inv.execute("plugin.view.open", { view: "soksak-plugin-design-astryx.canvas", placement: "content" })`(spec §5 유래 계승, 크로스 플러그인 아님·danger 아님 — `commands` 로 충분). `plugin.view.open` content 결과의 `existing` 이 `opened`(`false` = 이미 열린 탭을 포커스)로 매핑된다. 활성 페이지를 여는 호출 **전**에 세팅하므로 신선 마운트가 즉시 옳은 페이지를 렌더한다.
- → `{ pageId, opened }`(`opened` = `true` 신규 탭 생성, `false` 기존 캔버스 탭 포커스)
- errs: `NOT_FOUND`(페이지), `PREVIEW_FAILED`(`plugin.view.open` 비-ok, 예: 활성 프로젝트 없음)
- message: `캔버스 열림(페이지 {pageId}).`

### preview.refresh
- params: `{ pageId?: string }`
- 동작: 활성 캔버스 페이지(준 `pageId`, 없으면 현재 유지)를 선택하고 `store.onChange` 를 발화해 재렌더를 강제한다. 뷰는 이미 라이브 바인딩(모든 변이가 재렌더, §7 Live law)이라 이건 **명시적** 재렌더 넛지이지 브라우저 이동이 아니다. **헤드리스 완결**이다: 마운트된 뷰가 없으면 성공 no-op(스토어 활성 페이지는 갱신됨)이지 실패가 아니다 — "열린 미리보기" 전제조건은 사라졌다.
- → `{ pageId }`(호출 후 활성 페이지, 문서에 페이지 없으면 `null`)
- errs: `NOT_FOUND`(준 `pageId` 부재)
- message: `캔버스 재렌더(페이지 {pageId}).`

### canvas.select
- params: `{ pageId?: string, nodeId: string | null }`(`pageId` 기본 = 활성 캔버스 페이지)
- 동작: 선택(§7 Selection law)을 스토어 뷰-세션의 `{ pageId, nodeId }` 로 설정한다 — 트리 노드 클릭·캔버스 클릭이 쓰는 그 **같은** 필드라 셋이 수렴한다. `nodeId: null` 은 노드 선택 해제(페이지만). null 아닌 `nodeId` 는 `pageId` 위 존재하는 노드(트리 페이지 노드 id, §2)를 가리켜야 함 — 아니면 `NOT_FOUND`. 성공 message 는 선택 노드의 **type + id**(또는 해제 상태)를 말한다. tsx 페이지는 노드 id 가 없으니 null 아닌 `nodeId` 는 `NOT_FOUND`. 헤드리스 완결: 뷰가 없어도 선택이 스토어에 남아 다음 마운트가 하이라이트한다. 순수 세션 변이 — `onChange` 발화로 마운트된 뷰가 재하이라이트.
- → `{ pageId, nodeId, type }`(해제 시 `nodeId`/`type` `null`)
- errs: `NOT_FOUND`(페이지 부재, 또는 `nodeId` 가 페이지 위 노드 아님)
- message: `{type} 노드({nodeId}) 선택.`(해제 시 `페이지 {pageId} 선택(노드 해제).`)

### canvas.set
- params: `{ viewport?: "fill" | 1280 | 768 | 375, background?: string }`(최소 하나. `background` = CSS 색 문자열, 또는 `"neutral"` 기본)
- 동작: 캔버스 프레이밍 컨트롤(§7 툴바 법, `CanvasControls`)을 스토어 뷰-세션에서 변이한다 — 툴바의 뷰포트/배경 컨트롤이 쓰는 그 **같은** 필드. `viewport` 를 `fill|1280|768|375` 로 enum 검증하고, 잘못된 값은 허용 집합을 `data.validValues` 에 실어 `INVALID_PROP` 반환(§3·§4). `background: "neutral"`(또는 `""`)은 중립 기본으로 리셋, 그 외 문자열은 raw CSS 색으로 취급(미검증 — CSS 는 미지 색 문자열을 무시하니 정직한 no-op 이지 크래시 아님). 헤드리스 완결: 뷰가 없어도 프레이밍이 스토어에 남아 다음 마운트가 이 프레임으로 연다. 순수 세션 변이 — `onChange` 발화로 마운트된 뷰가 재프레이밍.
- → `{ viewport, background }`(호출 후 프레이밍)
- errs: `INVALID_PROP`(잘못된 `viewport` enum — `data.validValues` 동반), `INVALID_ARG`(`viewport`·`background` 둘 다 없음)
- message: `캔버스 프레이밍 갱신(뷰포트 {viewport}).`

### export.tsx
- params: `{ pageId: string }`
- 동작: 페이지를 컴파일 가능한 TSX 파일로 낸다(§10). **tsx 페이지**는 `code` 를 verbatim 반환. **tree 페이지**는 기존 직렬화기로 트리를 직렬화.
- → `{ tsx, filename }`
- errs: `NOT_FOUND`, `EXPORT_FAILED`
- message: `TSX 내보내기({filename}).`

---

## 6. 카탈로그 법

`generated/catalog.json` 은 `scripts/gen-catalog.mjs` 가 `node_modules/@astryxdesign/core` 에서 만든다.

### 컴포넌트 집합(기계적, 화이트리스트 없음)

카탈로그 집합 = `@astryxdesign/core` `package.json` `exports` 키 중 `/^\.\/[A-Z][A-Za-z0-9]*$/` 일치(단일세그먼트·대문자 시작 subpath). `./utils`·`./hooks`·`./theme/*`·`./naming`·`*.css`·`*.mjs` 문서·`/utils` 하위 export(예: `./Table/utils`)를 제외한다. `0.1.3` 에서 이 집합은 **99** 개다.

`gen-catalog.mjs` 는 barrel `@astryxdesign/core` 를 import 해 각 엔트리의 `importName` 이 barrel 의 정의된 export 임을 단언한다. 유령 엔트리는 빌드를 깬다.

### 엔트리 출처

컴포넌트 `Name` 마다 props·description 은 `src/{Name}/{Name}.doc.mjs`(`docs` export, `src/docs-types.ts` 로 타입)에서 온다. `0.1.3` 에서 6개 export 가 `.doc.mjs` 없이 배포된다 — `Code`, `HStack`, `Heading`, `InteractiveRoleContext`, `SizeContext`, `VStack`. 이들은 생성기가 TypeScript 컴파일러 API 로 컴포넌트 `dist/{Name}/index.d.ts` props 인터페이스를 읽어 `props`·`acceptsChildren` 을 파생한다. 그것도 비면 `props = {}`, `description = importName`. 문서 커버리지와 무관하게 어떤 컴포넌트도 드랍되지 않는다.

### 엔트리 shape(`CatalogEntry`)

```
{ type, importName, description, props: { name -> { type, required, enum?, default?, description } }, acceptsChildren }
```

- `type === importName === Name`.
- `description` = `doc.usage.description`(있으면), 없으면 `importName`.
- `props[name]` 은 `doc.props[]`(`PropDoc`)에서: `type` = `PropDoc.type`; `required` = `PropDoc.required === true`; `default` = `PropDoc.default`(있으면); `description` = `PropDoc.description`; `enum` = `PropDoc.type` 이 작은따옴표 문자열 리터럴 유니온이면 파싱된 멤버(따옴표 제거), 아니면 생략.
- `acceptsChildren` = 타입이 `ReactNode` 인 `children` prop 존재 여부(또는 `.d.ts` 폴백에서 `ReactNode` 타입 `children` 멤버).

### 완전성 테스트(필수)

vitest 테스트가 `Object.keys(catalog.json)` 과 `core` `package.json` 에서 재계산한 기계적 컴포넌트 집합의 집합 동일성을 단언한다. 어느 방향의 드리프트도 실패한다.

---

## 7. 뷰 법(앱 내 캔버스)

1차 디자인 표면은 **플러그인 뷰**(`contributes.views` id `canvas`, 배치 `content`)이고 **프로그램**(`contributes.programs` id `design-astryx`, `kind:"view"`, `view:"canvas"`)이 연다. 뷰는 앱 웹뷰의 Shadow DOM 안에 Astryx 컴포넌트를 직접 마운트하고 모듈 스토어에 라이브 바인딩된 채 있다. 아티팩트도, `file://` 도, http 서버도, 브라우저 플러그인도 없다.

### 마운트 법(Shadow DOM, erd 선례)

`app.ui.registerView("canvas", provider)` 가 provider 를 바인딩한다(`"ui"` 권한. `contributes.views` 에 선언 안 하면 코어가 거부 §0-3). `provider.mount(container, ctx)` 에서:

1. `container.attachShadow({ mode: "open" })`(재마운트 시 `container.shadowRoot` 재사용, `replaceChildren()` 로 청소).
2. shadow 안에 이 순서로 `<style>` 블록을 주입한다(전부 빌드타임 임베드, §12 — 디스크 읽기 없음):
   - `reset.css`(Astryx `core/src/reset.css`) — shadow 경계가 가두므로 앱 chrome 을 리셋하지 않는다(shadow 를 쓰는 erd 격리 이유).
   - `astryx.css`(`core/dist/astryx.css`) 의 모든 `:root` 를 `:host` 로 재작성 — 검증된 drop-in: 토큰 블록이 `:root, .xhash { … }` 셀렉터 쌍으로 배포되므로(`0.1.3` 13개) 재작성이 `:host, .xhash { … }` 를 내고 토큰이 shadow 호스트에 붙는다.
   - **7 테마 `dist/theme.css` 블록 전부** — 각각 `@scope ([data-astryx-theme="<name>"]) to ([data-astryx-theme])` 로 자기 스코프(`0.1.3` 검증. 테마 토큰은 `:root` 를 안 쓴다)라 7개 주입이 무충돌이다. 호스트의 현재 `data-astryx-theme` 에 맞는 블록만 활성. 각 테마 파일의 단일 `:root { color-scheme: … }` 줄은 나머지와 함께 `:root`→`:host` 재작성되며 무해하다(호스트 인라인 `color-scheme` 이 권위).
3. shadow 안 wrapper `<div>` 가 `data-astryx-theme="<activeTheme>"` 와 인라인 `style="color-scheme:<light|dark|light dark>"`(mode 에서, §9)를 단다. 이 wrapper 가 마운트 호스트이자 astryx 토큰/테마 스코프 루트다.
4. `createRoot(wrapper)` 로 활성 페이지의 React 트리를 렌더 코어(아래)로 렌더한다. 루트 `<Theme>` 가 `document.documentElement` 를 스탬프하지 못하게 한다 — 루트가 아니도록 중첩/감싼다(중첩 `<Theme>` 는 html 동기를 건너뜀, 검증). 테마는 shadow 호스트 속성(3단계)이 지고 `documentElement` 가 아니다.

`provider.unmount` 는 `root.unmount()`(React effect cleanup 연쇄: 타이머 clear, 리스너 제거).

### Live 법

뷰와 명령은 **같은 모듈 스토어**를 공유한다(erd 패턴 — `plugin-entry` 명령 등록과 뷰가 한 `createStore` 인스턴스를 import). 뷰는 스토어 `onChange` 훅(`createStore` `opts.onChange`)을 구독한다. 모든 변이 명령(`comp.*`·`page.*`·`theme.set`·`template.apply`·`page.code.set`)이 persist 후 `onChange` 를 발화하고 뷰가 **활성 페이지**(`store.preview.activePageId`, §11)를 재렌더한다. 파일 발행도, 이동도 없다 — React 트리가 제자리 갱신. `preview.open` 은 활성 페이지를 세팅+`onChange`, `preview.refresh` 는 `onChange` 를 명시 발화. 멀티윈도우 정합은 기존 `app.data.kv.watch` → `rehydrate` → `onChange` 경로가 진다(§11).

### Chrome 법(dogfood, 3-pane 프레임)

툴 chrome 은 **Astryx 컴포넌트로 짓는다** — 플러그인이 자기가 실어 나르는 엔진을 dogfood 한다(오너 재가). 프레임은 오너의 확정 레이아웃이다: 상단 툴바 + 3-pane 바디.

```
┌──────────────────────────────────────────────────────────────────┐
│ 툴바  [페이지▾][테마▾][mode][뷰포트 fill·1280·768·375][배경▾][TSX 내보내기] │
├────────────┬──────────────────────────────┬──────────────────────┤
│ 구조(트리)  │ 캔버스 — Shadow-DOM 실물 렌더   │ 인스펙터              │
│ TreeList   │ (§7 Live law; 캔버스 클릭=선택,  │ (선택 노드 prop 폼)   │
│ 노드클릭↔선택│  선택 하이라이트)               │                     │
└────────────┴──────────────────────────────┴──────────────────────┘
```

- **프레임** — Astryx `Layout` + `LayoutPanel` + `LayoutContent`, frame-first 독트린(`docs.get layout`)대로. 사이드 패널은 px 예산: 구조 ≈ 240–280px, 인스펙터 ≈ 300–340px; 캔버스가 남은 `LayoutContent` 를 차지.
- **구조 패널** — Astryx `TreeList`, 활성 페이지 트리(tree 페이지)를 아웃라인으로 투영. tsx 페이지는 읽기전용 안내(§ 인스펙터 법).
- **인스펙터 패널** — Astryx `Field` / `TextInput` / `Selector` / `Switch` 폼(§ 인스펙터 법).
- **툴바** — Astryx `Toolbar`(§ 툴바 법).

**중첩 테마 분리(두 supply, `documentElement` 스탬프 없음).** chrome 은 캔버스와 **같은 shadow 루트 안에** 렌더하되 **자기 중립 `ThemeContext`** 를 공급한다 — chrome 은 문서 테마와 무관히 `neutral` 에 살고, 캔버스 서브트리는 **문서** 테마(`activeTheme`/`mode`)를 유지한다. 이는 기존 캔버스-루트 패턴(§ 마운트 법 4단계)의 확장이다: 각 `<Theme>`/`ThemeContext` supply 는 중첩이라 어느 것도 `document.documentElement` 를 스탬프하지 않는다. 문서 테마는 캔버스 렌더만 구동하고, `theme.set` 이 돌아도 chrome 은 다시 칠해지지 않는다.

### 툴바 법

툴바(Astryx `Toolbar`)는 캔버스 pane 위에 있고 다음 컨트롤을 갖는다. **전부 명령 클라이언트**다(CLI/MCP 가 쓰는 그 **같은** 인프로세스 `execute` 로 레지스트리를 호출하므로 헤드리스와 UI 가 한 진실 — 툴바는 스토어를 직접 변이하지 않는다):

- **페이지 선택기** — 문서 페이지(tree+tsx)를 나열·활성 페이지 선택(`preview.open`/`preview.refresh` 의미, 즉 `activePageId` 세팅).
- **테마(7) + 모드(light/dark/system) 선택기** — `theme.set`(CLI/MCP 와 같은 명령)을 구동. 라이브 재렌더가 호스트 `data-astryx-theme`/`color-scheme` 을 스왑(§9).
- **뷰포트 + 배경 컨트롤** — 뷰포트 폭 프리셋(`fill` / `1280` / `768` / `375`)과 캔버스 배경, **`canvas.set`**(§5) 구동. 렌더를 프레이밍한다(`CanvasControls`, `src/types.ts`): 문서의 일부가 아니고 `app.data.kv` 에 영속 안 하나, 뷰가 아니라 **스토어 뷰-세션**에 살아 `canvas.set` 이 헤드리스로 구동할 수 있다(§11). 경계는 명시적이다: 문서 상태(페이지/테마/모드)는 문서에 영속, 프레이밍 상태는 스토어-세션·비영속.
- **TSX 내보내기 버튼** — 활성 페이지에 **`export.tsx`** 를 호출해 결과를 제시하는 `TSX 내보내기` 버튼(§ 내보내기 제시 법).

### 내보내기 제시 법(핀)

`TSX 내보내기` 버튼은 `export.tsx` 를 호출해 반환된 `tsx` 를 **shadow 루트 안 선택 가능한 코드 오버레이**로 제시한다 — 사용자가 전체 선택·복사할 수 있는 스크롤 가능 `<pre>`/`<textarea>`. 이 플러그인은 `clipboard:read`/`clipboard:write` 권한을 **선언하지 않으므로**(§8) 코어 `ctx.app.clipboard` 표면은 **부재**다(`src/plugins/api.ts` 에서 clipboard 권한 하에서만 나타난다). 따라서 원클릭 복사는 권한 집합을 늘리지 않는 한 v3 에서 **미제공**이다. 핀된 제시는 새 권한이 필요 없는 in-shadow 선택 오버레이다. (향후 개정이 `clipboard:write` 를 더하면 오버레이가 복사 버튼을 더할 MAY. 그때까지 권한 집합은 §8 유지.)

### Selection 법

선택은 문서 개념이 아니라 세션 개념이다. shape 은 `{ pageId, nodeId | null }`(`src/types.ts` `Selection`), 스토어 **뷰-세션**에 쥔다(문서에 영속 안 함, `app.data.kv` 에 안 씀, §11).

- **세 수렴 writer.** 선택은 (1) `canvas.select` 명령, (2) 구조 패널 **트리 노드 클릭**, (3) 렌더된 노드 **캔버스 클릭** 이 설정한다. 셋이 **같은** 스토어 필드에 쓴다 — 선택은 셋이 아니라 하나다.
- **뷰 바인딩.** 뷰는 선택 노드를 트리(구조 패널)와 캔버스(렌더 요소의 선택 아웃라인) **양쪽**에 하이라이트하고, 인스펙터(§ 인스펙터 법)가 폼을 선택 노드에 바인딩한다.
- **재렌더 생존.** 페이지를 재렌더하는 변이도 선택을 유지한다(`nodeId` 는 안정, §2 id 법). 선택 노드가 사라지면(`comp.remove` 삭제, 또는 활성 페이지가 그 id 없는 페이지로 전환) 선택은 **해제**(nodeId → null)되어 인스펙터가 죽은 노드에 바인딩되지 않는다.
- **헤드리스.** `canvas.select` 는 뷰 없이 스토어 필드를 변이하고, 선택은 다음 마운트까지 남아 마운트가 하이라이트한다(§5).

### 인스펙터 법

인스펙터 패널은 선택 노드 `type` 의 **카탈로그 엔트리**(`catalog.doc`, §6)에서 **생성한** prop 폼을 렌더한다. 컴포넌트마다 손으로 쓴 폼이 없다 — 폼이 파생이라 99 컴포넌트를 균일히 덮는다. 카탈로그 prop `type` 별 컨트롤 매핑:

- 카탈로그 `enum` 존재 → enum 멤버 위 Astryx **`Selector`**.
- 카탈로그 `type` `"boolean"` → Astryx **`Switch`**.
- 카탈로그 `type` `"number"`, 또는 spacing prop(`0–12` 간격 스케일) → **`TextInput`**(숫자), 또는 경계 `0–12` spacing 은 **`Slider`**.
- 카탈로그 `type` `"string"` → **`TextInput`**.
- 보편 `style` / `className` prop(보편 prop 법, §6) → **raw 텍스트 `TextInput`**.
- 카탈로그 `type` 이 콜백(`"=>"`)·`ReactNode`, 혹은 JSON 표현 불가인 prop → **읽기전용 노트**(편집 불가; §2 는 트리 경로에서 콜백/컴포넌트 prop 을 금지).

모든 편집은 툴바가 쓰는 그 **같은** 인프로세스 `execute` 로 **`comp.set` 을 디스패치**한다 — 한 진실, 직접 스토어 변이 없음. 검증은 명령의 몫(§2 prop 검증 법)이고, `INVALID_PROP` 결과는 인라인 노출·스토어 불변.

**tsx 페이지**는 인스펙터가 `page.code.get` / `page.code.set` 로 안내하는 **읽기전용 안내**를 보인다(tsx 페이지는 검사할 노드가 없음, §2). 구조 패널도 tsx 안내를 보이고, 트리 연산 종류 게이트(§2)가 이미 `comp.*` 를 막는다.

### 전-요소-명령 조항(오너 법)

뷰의 모든 상호작용 요소는 **레지스트리 명령에 1:1 매핑**된다 — 뷰는 명령 **클라이언트**이지 사설 상태기계가 아니다:

| 뷰 요소 | 명령 |
|---------|------|
| 페이지 선택기 | `preview.open` / `preview.refresh`(`activePageId` 세팅) |
| 테마 / 모드 선택기 | `theme.set` |
| 뷰포트 / 배경 컨트롤 | `canvas.set` |
| TSX 내보내기 버튼 | `export.tsx` |
| 트리 노드 클릭 / 캔버스 클릭 / 선택 아웃라인 | `canvas.select` |
| 인스펙터 필드 편집 | `comp.set` |
| 구조 패널 추가 / 삭제 / 이동(tree 페이지) | `comp.add` / `comp.remove` / `comp.move` |

어떤 뷰 컨트롤도 스토어를 직접 변이하지 않고 각기 `execute` 로 라우팅한다. 그래서 LLM 이 전 표면을 헤드리스로 구동할 수 있고("저 버튼 선택해" → `canvas.select`; "375 폭 보여줘" → `canvas.set`), UI 와 CLI/MCP 가 결코 어긋날 수 없다.

### 렌더 코어 법(엔진 재사용)

v2 TSX+트리 렌더 엔진을 뷰의 렌더 코어로 **그대로 재사용**하고, 뷰(=`main.js` 번들)와 미래 러너 양쪽이 import 하도록 `src/render-core/` 로 이전한다(모듈 shim 입력이 동일):

- `src/render-core/tsx.tsx` — sucrase 기반 TSX 경로(`runner/tsx.tsx` 에서 이전).
- `src/render-core/tree.tsx` — 트리 렌더러(`runner/render.tsx` 에서 이전. `ErrorBox`/`NodeBoundary` 소유).

뷰는 모듈 네임스페이스(React, astryx barrel + `theme`/`theme/syntax`/`hooks`, heroicons, lucide)를 자기 번들에서 해소해 렌더 코어에 주입한다 — 렌더 코어는 astryx 에 안 묶인 채다(주입 seam 은 v2 무변, 주입자만 `runner/entry.tsx` 에서 뷰 `mount` 로 이전).

**트리 경로**(`page.kind === "tree"`): 각 `node.type` 을 번들 `@astryxdesign/core` barrel 에서 이름으로 해소해 React 엘리먼트로 낮춘다(§2 children/prop 법). 미지 `node.type` 은 이름을 단 `ErrorBox`.

**TSX 경로**(`page.kind === "tsx"`): `page.code` 를 **Learn Gate B 의 정확한 sucrase 설정**으로 컴파일하고 require-shim 으로 실행한다:

```
sucrase.transform(code, {
  transforms: ["typescript", "jsx", "imports"],
  jsxRuntime: "automatic",
  production: true,
  jsxImportSource: "react",
  filePath,
})
```

- `imports` 는 ESM 을 CommonJS `require()`/`exports` 로 낮춰 shim 의 `require()` 가 모든 모듈 id 를 충족하게 한다. `jsxRuntime: "automatic"` 은 필수다(템플릿은 이름 붙은 hook 만 import 하고 `React` default 를 안 쓰므로 `classic` 이면 `React is not defined` throw). `production: true` 는 lean 한 `react/jsx-runtime`(no `jsxDEV`)을 낸다.
- require-shim 은 모듈 id 를 번들로 해소한다. 대문자 컴포넌트 subpath 는 barrel 로 forward. 소문자 3 subpath 는 EXPLICIT 번들 네임스페이스를 실는다(barrel 이 그 심볼 전부를 재-export 하지 않기 때문 — 전-코퍼스 적대 실행이 `@astryxdesign/core/theme/syntax` 의 `githubLight` 가 barrel 밖임을 증명, barrel 전용 forward 는 `undefined` 로 `SyntaxTheme` 크래시):
  - `react`·`react/jsx-runtime`(및 import 시 `react-dom`/`react-dom/client`) → 번들 React 런타임.
  - `@astryxdesign/core` **및** 모든 대문자 `@astryxdesign/core/<Subpath>` → 번들 barrel 네임스페이스.
  - `@astryxdesign/core/theme`/`@astryxdesign/core/theme/syntax`/`@astryxdesign/core/hooks` → 각 번들 네임스페이스(EXPLICIT 엔트리, barrel 폴백 전 확인).
  - `@heroicons/react/24/outline`·`@heroicons/react/24/solid`·`@heroicons/react/20/solid` → 번들 heroicons.
  - `lucide-react` → 번들 lucide.
  - **미지 모듈**(예: `recharts`·`@astryxdesign/lab`·런타임 `@stylexjs/stylex`) → 컴포넌트가 모듈 이름을 단 보이는 `ErrorBox` 를 렌더하는 정직-미가용 스텁. 게이트가 그런 템플릿을 걸러내지만(§13) 그런 모듈을 참조하는 손편집 `page.code.set` 은 throw 가 아니라 보이는 표면으로 열화해야 한다.
- 렌더 코어는 모듈의 **default export** 를 마운트한다(컴파일 기반 해소 — 템플릿마다 진짜 `export default function` 은 정확히 하나. 텍스트 스캔의 이중-default 는 템플릿 리터럴 코드 샘플 안이라 regex 로 default 를 찾으면 안 된다).
- 지연 `setTimeout` 타이머(chat/login 데모)와 실패하는 단일 `fetch`(코드 샘플 블록 하나, 오프라인)는 허용해야 한다: 마운트 후 발화하며 페이지를 죽이면 안 된다.

컴파일·런타임 오류는 **빈 화면이 아니라 보이는 오류 표면**으로 렌더한다(`ErrorBox`/`NodeBoundary`).

### 에셋 플레이스홀더 법

렌더 시점에 렌더 코어는 **스킴 없는 상대·절대 경로**(`./x`·`../x`·`/x`) 이미지 소스를 **인라인 중립 SVG 플레이스홀더** `data:` URI 로 다시 쓴다 — 해소 불가한 에셋의 정직한 플레이스홀더. 스킴 있는 소스(`http:`·`https:`·`data:`)는 그대로 통과한다. 앱 웹뷰는 원격 절대 이미지를 정상 로드한다(옛 `file://` 오리진과 달리 앱 내 문서는 앱의 정상 오리진이라 `network` 류 로드가 오리진 차단되지 않는다 — 다만 이 플러그인은 `network` 권한을 선언하지 않고 코퍼스는 마운트 시 그것을 필요로 하지 않는다). 모든 `<img>` 는 같은 플레이스홀더로 가는 `onerror` 폴백도 지닌다. 문서화된 정직한 열화이지 침묵 파손이 아니다.

### Anchor 폴리필 법(앱 내 정책, 핀)

Astryx popover/tooltip/menu 표면은 CSS anchor positioning 을 쓴다. 뷰는 anchor-positioning 폴리필을 **앱 문서당 한 번**(모듈 레벨 멱등 가드, 마운트당 아님), 그리고 `!CSS.supports("anchor-name", "--x")` 일 때만 실행한다 — 앱 웹뷰가 anchor positioning 을 네이티브 지원하면 폴리필은 실행되지 않는다(비용 0). 폴리필은 인라인 `<style>` 을 `innerHTML` 로 읽는다(`fetch` 없음)라 앱 내에서 온전히 동작한다(원본 astryx 를 dev 서버로 내몬 `file://` 오리진 파손은 여기 없다). 폴리필은 설계상 document-wide 이나 **core 에 INERT**: core chrome 은 anchor 배치 요소가 0(core CSS 에 `anchor-name`/`position-anchor` 없음)이라 document-wide 패스가 astryx 표면 밖에서 다시 스타일할 것을 못 찾는다. 정직한 caveat: document-wide light-DOM 폴리필은 astryx shadow 루트 내부 요소엔 닿지 않는다. 앱 웹뷰가 네이티브 미지원이면 shadow 안 anchored astryx 표면이 완벽히 배치되지 않을 수 있다 — 크래시가 아니라 명기된 한계이고, 현행 앱 웹뷰는 anchor positioning 을 네이티브 지원해 실무에선 게이트가 폴리필을 건너뛴다.

### Toast 법(핀)

Astryx `Toast` 는 `document.body` 로 portal 해 `astryx.css` 가 사는 shadow 루트를 탈출하므로 portal 된 toast 는 **스타일 없이** 렌더된다. 정책: astryx 가 portal-target prop/context 를 노출하면 뷰는 그것을 shadow 내부 컨테이너로 가리켜 toast 가 주입 CSS 를 상속하게 SHOULD; 그런 훅이 없으면 수용하는 정직한 열화는 toast 가 `document.body` 에 스타일 없이 렌더되는 것. v3 에서 toast 는 드물어(트리 경로는 비상호작용 — 콜백 제거 §2, tsx 데모 `setTimeout` 블록만 발화) 이는 문서화된 미관 한계이지 기능 결함이 아니다.

### 테마 모델(7 전부 임베드, 호스트-속성 스왑)

§9 참조 — v3 는 shadow 에 7 테마 블록 전부를 임베드하고 호스트 `data-astryx-theme` 속성 + `color-scheme` 스왑으로 전환한다. 재발행도 이동도 없다(그것들은 `file://`/브라우저 아티팩트였다).

### 번들 크기 법

렌더 코어의 페이로드(`react` + `react-dom/client` + `@astryxdesign/core` + `sucrase` + heroicons + `lucide-react`)는 이제 `__RUNNER_JS__` 문자열(프리빌트 `runner.js`, v2 에서 ~1 MB+)로 임베드되는 대신 뷰의 모듈 그래프의 일부로 **`main.js` 에 직접 번들**된다. 순 `main.js` 바이트 크기는 **같은 자릿수**를 유지 — 델타는 상쇄다: 같은 라이브러리가 임베드 문자열에서 나와 `main.js` import 그래프로 들어간다. `__ASTRYX_CSS__` 와 `__THEME_CSS_MAP__`(7 테마)는 임베드 유지(shadow 에 주입, §12). `generated/runner.js` 아티팩트와 그 `build:runner` 임베드는 제거된다(§12).

### Legacy-removal 법(피벗 기록, git 이 기억)

v2 브라우저 미리보기 수송은 **폐기(deprecate)가 아니라 삭제(DELETE)** — 오너의 판정(1차 표면 = 앱 내 패널 프로그램, 브라우저 문서 아님)과 erd 선례(CSS 격리 위한 React-in-`attachShadow`)가 이를 대체한다. 제거 아티팩트 전부:

- `scripts/preview-server.cjs` — 로컬 http 정적 서버.
- `src/preview/server.ts`(+ `server.test.ts`) — 서버 수명주기 모듈.
- `src/preview/emit.ts`/`write.ts`(+ 테스트) — `index.html`/`runner.js` 디스크 발행 경로(`app.fs.writeText`).
- `src/commands/preview-drive.ts`(+ `preview-drive.test.ts`) — 브라우저 탐지(`ping`) + 구동(`open`/`navigate`) + Chromium→native 폴백.
- `runner/entry.tsx` — 독립 `file://` 러너 앱(네임스페이스 주입 역할은 뷰 `mount` 로 이전). `scripts/build-runner.mjs` 의 `runner.js` 산출은 제거.
- `file://` 수송 법, `app.fs.url` 법, `${ctx.dir}/.preview/` 디렉토리 + `.preview/.gitkeep`.
- 매니페스트: `soksak-plugin-browser-chromium`/`soksak-plugin-browser-native` `dependencies`, `process` + `fs:write` 권한.
- 에러 코드 `DEP_MISSING`, `engine`/`url` 반환 필드, `PreviewSession` 의 `engine`/`url`/`server` 스토어 필드(§11).

죽은 코드도, 주석 처리된 수송도 남지 않는다 — git 이 역사다.

---

## 8. 의존성 법

`plugin.json` 에 `dependencies` **없음**, `libraries` 없음, `sidecars` 없음. 캔버스는 앱 내 렌더(Astryx 컴포넌트를 앱 웹뷰 Shadow DOM 에 마운트, §7)라 호출할 브라우저 플러그인도, 선언할 크로스 플러그인 의존도 없다. v2 의 `soksak-plugin-browser-chromium`/`soksak-plugin-browser-native` 의존은 제거된다(§7 Legacy-removal law).

권한(`plugin.json` `permissions`): `["ui", "commands", "data", "programs"]`.

- `ui` — `canvas` 뷰 등록(`app.ui.registerView`).
- `commands` — 자기 명령 등록 + `plugin.view.open` 실행(크로스 플러그인 아님·danger 아님, §7).
- `data` — `DesignDoc` 을 `app.data.kv` 에 영속(§11).
- `programs` — `design-astryx` 프로그램 기여(캔버스를 여는 `+` 메뉴 항목).

v2 대비 제거: `process`(http 서버 없음), `fs:write`(디스크 아티팩트 없음 — `export.tsx` 는 TSX 를 데이터로 반환, 쓰지 않음).

---

## 9. 테마 법(결정: 7 전부 임베드, 호스트-속성 스왑)

shadow 는 **7 전부**의 테마 `dist/theme.css` 블록을 임베드한다(§7 마운트 법), 활성 것만이 아니라. 테마 전환은 shadow 호스트 wrapper 의 `data-astryx-theme` 속성을 스왑한다. 맞는 블록만 활성. 배포된 `theme.css` 가 `@scope ([data-astryx-theme="<name>"]) to ([data-astryx-theme])` 로 게이트되어 토큰이 `:root` 를 겨냥하지 않으므로(`0.1.3` 검증) 7종을 이어도 충돌하지 않아 옳고 무충돌이다. (v2 재발행 법 — 활성 테마만 임베드하고 `theme.set` 에 `file://` 문서를 재작성 — 은 단일-`:root` 문서 오리진용 우회였고, 브라우저 수송과 함께 제거된다.) 7 테마 CSS 페이로드는 `main.js` 에 `__THEME_CSS_MAP__` 로 임베드(§12)되어 디스크 읽기가 없다.

`theme.set` 은 스토어의 `activeTheme`/`mode` 를 변이하고 `onChange` 를 발화한다. 마운트된 뷰가 호스트 속성 + `color-scheme` 을 제자리 스왑한다(재발행도 이동도 없음, §7 Live law). `ThemeName` 과 고정 7테마 집합은 `src/types.ts`(`THEMES`)에 산다. `theme.set` 은 그 밖의 이름을 `THEME_UNKNOWN` 으로 거부한다.

### 색 모드(결정)

`DesignDoc.mode`(`ColorMode` = `light` | `dark` | `system`)는 스토어를 타고 뷰 렌더로 관통해, shadow 호스트 wrapper 의 인라인 `color-scheme`(`light` → `"light"`, `dark` → `"dark"`, `system` → `"light dark"`)으로 적용된다. Astryx 테마 토큰은 `light-dark()` 를 쓰고, 이는 호스트 `color-scheme` 에 해소된다(`system` 은 OS 를 따른다). `theme.set` 이 이를 관통시킨다(§5). 모드는 문서 수준 속성(activeTheme 처럼)이고 영속한다(§11). `DesignDoc`·`DesignPayload` 에서 선택이라 부재 시 `system` 으로 읽으니 모드 이전 문서는 마이그레이션이 필요 없다.

`gothic` 은 다크 전용이다(다크 토큰 값만 배포). `theme.set` 은 `gothic` 에 실효 `light` 모드를 변이 **전**에 `INVALID_PROP` 로 거부해, 문서가 렌더 불가한 테마/모드 쌍에 빠지지 않게 한다. gothic 게이트는 명령 계층(`src/commands/theme-mode.ts`, 순수 판정자)에, 테마 이름 검증은 모델 계층(`setTheme`)에 산다. `system` 은 `gothic` 에도 항상 허용된다(다크로 렌더).

---

## 10. 내보내기 법

`export.tsx` 는 단일 컴파일 가능 TSX 파일을 낸다. 산출은 페이지 종류에 따른다:

- **tsx 페이지** → 페이지 `code` 그대로(verbatim)(소스가 진실, §2). 재직렬화 없음.
- **tree 페이지** → 아래 트리 직렬화기.

### tree 페이지 직렬화

- barrel named import: `import { Theme, <쓰인 타입들…> } from '@astryxdesign/core';`. 트리에 실제로 있는 컴포넌트 타입(+`Theme`)만 import, 중복 제거·정렬.
- 트리를 `<Theme theme="<activeTheme>">…</Theme>` 로 감싸 반환하는 default export 함수.
- 트리 → JSX prop 규칙:
  - `string` 값 → `"`/`{`/개행이 없으면 `prop="value"`, 있으면 JSON 이스케이프한 `prop={"…"}`.
  - `boolean true` → 맨 `prop`; `boolean false` → `prop={false}`.
  - `number` → `prop={n}`.
  - 배열/객체/`null` → `prop={<JSON 리터럴>}`.
  - `children` 문자열 prop 과 `node.children` 는 JSX children(텍스트 노드 또는 중첩 요소)으로 렌더. children 도 `children` prop 도 없는 잎은 self-closing(`<Type … />`).
- 들여쓰기는 깊이당 2칸. `filename` 은 페이지 이름 파생(kebab-case, `.tsx`).

값을 표현할 수 없는 직렬화(§2 prop 검증상 발생하지 않아야 함)는 `err("EXPORT_FAILED", …)` 반환.

---

## 11. 상태 법

인메모리 스토어 하나가 작업 중 `DesignDoc` 을 쥔다(erd 패턴: 모든 명령이 공유하는 단일 소스). 스토어는 `app.data`(권한 `data`)에 영속하고 네임스페이스는 코어가 플러그인 id 로 강제한다:

- kv 키: `doc:${projectId}`, `projectId = app.project.current()?.id ?? "_global"`.
- activate 시: 스토어는 `app.data.kv.get(key)` 로 하이드레이트, 부재면 새 빈 문서(`{ version:1, activeTheme:"neutral", mode:"system", pages:[], seq:0 }`). `coerceDoc` 은 결손·미지 `mode` 를 `system` 으로 강제하고, 각 페이지 소스도 강제한다: v1 root-only 페이지(`{ id, name, root }`)는 `{ id, name, source:{ kind:"tree", root } }` 가 되고, `source` 가 결손·불량인 페이지는 빈 tree 페이지(§2)가 된다. 마이그레이션 파일 없음 — 강제는 하이드레이트 시점 규칙이고 `version` 은 `1` 유지.
- 매 변경 시: `app.data.kv.set(key, doc)` 로 되쓴다.
- `app.data.kv.watch` 로 같은 프로젝트의 여러 창을 일관 유지(외부 변경 시 재하이드레이트).

명령은 헤드리스 완결이다: 뷰가 필요 없다. 스토어는 영속 문서 곁에 **뷰-세션**을 쥔다 — 세 필드, `app.data.kv` 에 **아무것도 영속 안 함**(`DesignDoc` 만 영속):

- **활성 캔버스 페이지**(`preview.activePageId` — 마운트된 뷰가 렌더하는 페이지, §7 Live law).
- **선택**(`Selection` = `{ pageId, nodeId | null }`, §7 Selection law) — `canvas.select`·트리 클릭·캔버스 클릭이 설정. 선택 노드가 사라지면 해제.
- **캔버스 프레이밍**(`CanvasControls` = 뷰포트 폭 + 배경, §7 툴바 법) — `canvas.set` 이 설정.

이들은 문서가 아니라 세션이다: 명령으로 변이하고(LLM 이 헤드리스로 구동) 스토어 수명 내 마운트를 넘어 생존하나, kv 문서엔 들어가지 않는다. v2 세션 필드 `engine`/`url`/`server` 는 제거된다(브라우저 엔진·아티팩트 url·http 서버가 없다).

---

## 12. 빌드 법

`main.js` 는 blob 으로 import 되는 단일 ESM 번들이라 런타임에 sibling 파일을 못 읽는다. 따라서 모든 생성물은 빌드타임에 문자열 define 으로 임베드한다(`build.mjs`, erd 선례):

- `__CATALOG_JSON__` ← `generated/catalog.json`
- `__TEMPLATES_JSON__` ← `generated/templates.json`(verbatim-TSX `TemplateEntry[]`, §13)
- `__ASTRYX_CSS__` ← `generated/astryx.css`(reset.css + dist/astryx.css 병합. 뷰가 `:root`→`:host` 재작성해 shadow 에 주입, §7)
- `__THEME_CSS_MAP__` ← `generated/theme-css.json`(`{ "<theme>": "<theme.css>" }`, 7 엔트리 — 전부 shadow 에 주입, §9)

렌더 코어(`src/render-core/`, §7)는 임베드 문자열이 **아니다** — `main.js` 의 import 그래프의 일부다(뷰가 import 하고 그것이 `react` + `react-dom/client` + `@astryxdesign/core` + `sucrase` + heroicons + `lucide-react` 를 끌어온다). v2 `__RUNNER_JS__` define 과 `generated/runner.js` 임베드는 **제거**된다(§7 번들 크기 법).

`build.mjs` 는 생성물이 하나라도 없으면 throw 한다(침묵 부분 산출 금지). 파이프라인 순서는 `package.json` 이 고정한다: `gen`(카탈로그 + 템플릿) → `build:css`(astryx.css + theme-css.json) → `build.mjs`(main.js). v2 `build:runner` 단계의 `runner.js` 산출은 제거되고 CSS 아티팩트만 낸다(`build:css` 로 개명). `.gitignore` 는 `generated/` 를 유지하고, `.preview/*` + `.preview/.gitkeep` 항목은 제거한다(아티팩트 디렉토리 없음). `main.js` 는 커밋한다.

`build.mjs` 는 계약이 소유한다. `scripts/gen-catalog.mjs`·`scripts/gen-templates.mjs`·CSS 빌드 단계·`src/plugin-entry.ts`·`src/render-core/`·뷰 provider·`skill/SKILL.md` 는 구현자가 이 계약에 맞춰 만든다.

---

## 13. 템플릿 법(v2: verbatim TSX)

`generated/templates.json` 은 `scripts/gen-templates.mjs` 가 Astryx CLI 템플릿(`node_modules/@astryxdesign/cli/templates`)에서 만든다: `0.1.3` 에서 **619** 개(페이지 41 + 블록 578).

### 레거시 제거(git 이 기억)

v1 트리 변환 기계는 폐기가 아니라 **삭제**된다: TypeScript 컴파일러 변환기, 페이지 스켈레톤 로직, `generated/templates-report.json` 과 그 `TemplateReject`/`TemplatesReport` 타입이 사라진다. `'use client'` TSX 프로그램(hooks·로컬 state·헬퍼 컴포넌트·타입 코드)을 정적 `DesignNode` 트리로 바꾸는 것은 격하였다. v2 는 원본 프로그램을 러너 tsx 경로(§7)로 무손실 렌더한다. 죽은 변환 코드는 남지 않는다.

### Verbatim 패키징

각 `TemplateEntry` 는 **원본 TSX 소스를 verbatim** 담는다:

```
{ id, name, kind: "page" | "block", code, requires: string[], available: boolean, reason? }
```

- `id` = 소스 상대경로 slug(`pages/dashboard`·`blocks/components/hero-split`). `kind` = `pages/*` 는 `page`, 그 외 `block`. `name` = slug 파생 표시명.
- `code` = 파일 TSX 바이트 그대로.
- `requires` = 파일이 import 하는 모듈 id 집합(`react`·`@astryxdesign/core`·`@heroicons/react/24/outline`·`lucide-react` …).
- `available` = 렌더 코어가 렌더 가능한가: 모든 `requires` 가 렌더 코어 require-shim(§7)에서 해소되면 `true`. 번들이 안 담는 모듈이나 렌더 코어가 안 돌리는 **컴파일타임 전용** 변환이 필요하면 `false`.
- `reason`(`available: false` 에만) = 기계 판독 사유.

### 기계적 완전성(필수)

**619 템플릿 전량**이 `templates.json` 에 들어간다 — 가용·미가용 불문. vitest 테스트가 `sourceCount === entries.length`(스캔한 소스 TSX 수 = 엔트리 수)를 단언한다. 거부 버킷도 침묵 드랍도 없다 — 렌더 불가 템플릿은 `available: false` + `reason` 으로 존재하지 부재하지 않는다.

### 가용성 센서스(Learn Gate, 인용)

619 중 **605 가용**, **14 미가용**(모듈 7 + 헬퍼 7):

- **604** 는 `react` + `@astryxdesign/core` + 번들 heroicons 만으로 렌더.
- **8** 은 번들 `lucide-react`(번들에 있음)도 필요 — 가용.
- **7 미가용**, 사유별:
  - `recharts (미설치)` — `pages/dashboard`·`pages/dashboard-portfolio`(2).
  - `@astryxdesign/lab (미설치)` — `pages/table-page-chart`·`pages/table-page-heatmap-status`·`pages/table-page-shoe-store-heatmap`(3).
  - `@stylexjs/stylex 컴파일타임 변환 필요` — `pages/kanban-board`·`pages/shell-top-nav`(2). StyleX 는 `0.18.3` 설치됐으나 컴파일타임 CSS-in-JS 다: `stylex.create`/`props` 는 StyleX babel/postcss 변환 없이는 런타임 CSS 를 안 낸다. 러너 esbuild 번들은 그 변환을 안 돌리므로 시각적으로 깨진다. 정직한 `available: false` 이지 번들 시도가 아니다.

`@astryxdesign/lab`·`recharts` 는 **미설치**(5 템플릿), `@stylexjs/stylex` 는 설치됐으나 런타임 무용(2 템플릿)이다. 이 플래그는 정직이지 번들 약속이 아니다.

### export shape(마운트 법, 인용)

612/619 파일이 최상위 `export default function`(React 컴포넌트)을 정확히 하나 노출한다. 렌더 코어는 `module.default` 를 마운트한다. 두 파일(`pages/ide`·`pages/documentation-technical`)은 여분 `export default` 텍스트를 **템플릿 리터럴 코드 샘플 안**에 담는다 — esbuild/sucrase 는 각기 진짜 default 하나만 컴파일하므로 default 해소는 regex 텍스트 스캔이 아니라 컴파일 기반이어야 한다. 7 파일은 default 없음(`themes/*/icons.tsx`, `pages/theme-showcase` 가 쓰는 이름 전용 아이콘 헬퍼) — 헬퍼 모듈이지 독립 마운트 페이지가 아니고 `page` 종류 엔트리가 아니다.

### `template.list` 와 `template.apply`

`template.list` 는 기본으로 `available` 템플릿을 내고 미가용 꼬리를 개수+사유로 보고한다(§5). `template.apply` 는 `code` 로 tsx 페이지를 만들고 `available: false` 템플릿은 `TEMPLATE_UNAVAILABLE` + `reason` 으로 거부한다(§5).

---

## 14. 문서 법

`generated/docs.json` + `generated/docs-report.json` + `src/docs/docs.embedded.ts` 는 `scripts/gen-docs.mjs` 가 공식 Astryx 독트린(`node_modules/@astryxdesign/cli/docs/*.doc.mjs`, Meta 저작)에서 만든다. 이들이 `docs.list` / `docs.get` 명령(§5)을 받친다.

### 토픽 집합(기계적, 화이트리스트 없음)

토픽 집합 = 소스에서 `.doc.mjs` 로 끝나는 파일(`.doc.dense.mjs`·`.doc.<lang>.mjs` 변형 제외). 접미사를 떼면 토픽 id. `0.1.3` 에서 **17** 개다.

### 변형 선택(dense 우선)

토픽마다 `<topic>.doc.dense.mjs` 가 있으면 그걸 굽고(Meta 의 토큰 절약 LLM 압축 — `0.1.3` 의 `layout`·`principles`·`theme`·`tokens`), 없으면 `<topic>.doc.mjs`. dense 파일은 `docsDense`, 평문은 `docs` export. 선택한 변형은 토픽별 `dense: boolean` 로 기록된다.

### 빌드타임에 구움(fetch 아님)

독트린은 빌드타임에 플러그인에 컴파일되고 런타임에 fetch 하지 않는다(카탈로그·템플릿 선례). `gen-docs.mjs` 는 각 섹션을 평문으로 렌더하고(`prose`, `ordered`/`unordered`/`do`/`dont` 스타일의 `list`, `code`, `table`; `null` 슬롯 건너뜀) `{ <topic>: { title, dense, description, text } }` 를 낸다. `title` = 문서 `title`(dense 문서는 Title-Case 한 토픽 id). `description` = 문서 `description`(docs.list 한 줄). `text` = 렌더된 전체 독트린(docs.get 본문).

런타임은 커밋 소스 `src/docs/docs.embedded.ts` 를 import 한다(`generated/docs.json` 아님) — `build.mjs` define 이나 파이프라인 훅 없이 번들·vitest 양쪽에서 항상 해소되게. `generated/docs.json` 은 동일 산출의 아티팩트·테스트 픽스처이고, 드리프트 테스트가 둘의 동일성을 단언한다.

### 완전성(필수)

`scripts/gen-docs.test.ts` 가 소스 디렉토리에서 토픽 집합을 재계산(같은 규칙)해 `Object.keys(docs.json)` 및 `docs-report.json` `topics` 와 집합 동일성을 단언한다. 어느 방향 드리프트도 실패한다. `gen-docs.mjs` 는 발견한 토픽이 해소·렌더에 실패하면 throw 한다 — 침묵 드랍·빈 엔트리 없음.

---

## 15. 업그레이드 거버넌스

`@astryxdesign/*` 핀은 **정확** `0.1.3`(`package.json`)이지 캐럿 범위가 아니다. 카탈로그(§6)·템플릿(§13)·문서(§14)가 전부 이 핀 패키지에서 기계적으로 파생되므로, 버전 상향은 컴포넌트 집합·템플릿 변환·독트린 토픽을 한 번에 바꿀 수 있다.

업그레이드는 손편집이 아니라 Astryx CLI 코드모드로 간다: `npx astryx upgrade --apply`(핀 버전 코드모드 적용) 실행 → 정확 핀 상향 → 모든 파생 아티팩트 재생성(`npm run gen` 은 카탈로그+템플릿, `node scripts/gen-docs.mjs` 는 문서) → 러너/CSS 재빌드. 생성기의 완전성 테스트(카탈로그 §6·템플릿 §13·문서 §14)가 수용 게이트다: 그들이 드러낸 드리프트는 파생에서 조정하지, 테스트를 약화해서 넘기지 않는다.

---

## 16. Learn Gate 인용(v2 증거)

v2 법은 619-템플릿 코퍼스의 기계 센서스에 근거한다(신뢰·인용해 계약이 자체 증거를 지니게 한다):

- **컴파일** — sucrase `{ transforms:["typescript","jsx","imports"], jsxRuntime:"automatic", production:true, jsxImportSource:"react" }` 가 619/619 를 무실패 컴파일. esbuild tsx 로더도 깨끗. `satisfies`/`enum`/`namespace`/데코레이터 전무 — 베이스라인 typescript+jsx 만.
- **shim** — **barrel 전용** require 맵이 94 subpath 의 모든 런타임 값 심볼을 해소(고유 import 심볼 207개. 미해소 18개는 sucrase 가 지우는 `import type` 이름, 1개는 doc 문자열 안 오탐). subpath 별 엔트리 불요.
- **export** — 612/619 가 진짜 `export default function` 하나. 이중-default 2개는 템플릿 리터럴 코드 샘플(컴파일 기반 해소 필수). default 없는 7개는 아이콘 헬퍼.
- **에셋** — 로컬·번들 에셋 의존 0. 모든 이미지가 원격 절대 URL(Meta CDN + 파비콘 소수). `next/image`=0, 상대·로컬 `img src`=0, import 이미지 모듈=0. 플레이스홀더 법(§7)이 스킴 없는 경로를 방어적으로 덮는다.
- **런타임** — `import()`=0, `requestAnimationFrame`=0, `setInterval`=0, `localStorage`=0. `setTimeout` 10 파일(마운트 후 데모 타이머), 진짜 `fetch` 하나(오프라인 거부 코드 샘플 블록). 캔버스는 로더가 필요 없다. anchor-positioning 폴리필은 앱 웹뷰가 네이티브 미지원일 때만 돌고 게이트되며 core 에 무해하다(§7 Anchor 폴리필 법).

---

Version: 3.0.0
Spec: soksak-spec-plugin@0.0.1
Core: @astryxdesign/core 0.1.3
