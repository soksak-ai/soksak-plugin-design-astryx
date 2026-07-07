# soksak-plugin-design-astryx — v2 계약

이 문서가 헌법이다. 모든 구현자는 이 문서에 정확히 맞춰 만든다. 이 법의 TypeScript 쌍둥이는 `src/types.ts` 에 있다. 산문과 `types.ts` 가 어긋나면 shape 은 `types.ts` 가, 동작은 이 문서가 이긴다.

플러그인 id 토큰: `design`, `astryx`. 명령 첫 세그먼트는 그 토큰과 같거나 그 축약이 되지 않는다.

---

## 1. 정체성과 범위

이 플러그인은 헤드리스 디자인 문서 엔진이다. 모든 기능은 레지스트리 명령이고, 이 플러그인이 소유하는 GUI 표면은 없다. 렌더는 자기완결 미리보기를 디스크에 쓰고 의존 브라우저 플러그인을 그 파일로 가리켜서 한다. 외부 LLM 은 `sok` CLI·MCP·동봉 스킬로 구동한다.

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

`OK`, `NOT_FOUND`, `INVALID_TYPE`, `INVALID_PROP`, `INVALID_TARGET`, `INVALID_ARG`, `DUPLICATE`, `TEMPLATE_UNKNOWN`, `TEMPLATE_UNAVAILABLE`, `THEME_UNKNOWN`, `COMPILE_FAILED`, `PREVIEW_FAILED`, `DEP_MISSING`, `EXPORT_FAILED`.

v2 신규 코드 둘:

- `TEMPLATE_UNAVAILABLE` — 템플릿 id 는 있으나 `available === false`(결손·컴파일타임 전용 의존, §13). `template.apply` 가 템플릿 `reason` 과 함께 반환한다. `TEMPLATE_UNKNOWN`(id 가 `templates.json` 에 없음)과 구별된다.
- `COMPILE_FAILED` — `page.code.set` 이 러너 sucrase 설정(§7)에서 컴파일 안 되는 TSX 를 받았다. 실패 봉투가 컴파일러 오류를 `data.diagnostics` 에 싣는다(§4).

`PERMISSION_DENIED`·`UNKNOWN_COMMAND`·`INVALID_PARAMS`·`INTERNAL` 은 코어 소유 결과(`registry.execute` 가 생산)이지 핸들러가 만들지 않는다.

---

## 4. 메시지 프로토콜(v1)과 핸들러 규약

와이어 결과는 언제나 대칭 봉투 `{ ok, code, message, data? }` 다. 코어 `registry.execute`/`normalizeOutcome` 가 짓는다. 핸들러는 재료를 준다:

- **성공** — 핸들러는 평범한 데이터 레코드(`data`)를 반환한다. 표시 `message` 는 `register(...).message = (data) => <한국어 한 줄>` 이 소유한다. 성공 시 핸들러가 넣은 `message` 는 버려지므로 한국어 한 줄은 `spec.message` 에만 산다(단일 소유).
- **실패** — 핸들러는 `src/types.ts` 의 `err(code, message)` = `{ ok:false, code, message }` 를 반환하고 그대로 보존된다. `{ ok:false, error }` 레거시 방언은 금지.
- **진단 포함 실패** — `err(code, message, data)` 는 실패 봉투에 선택적 구조 `data` 를 더한다. 대칭 봉투 `{ ok, code, message, data }` 를 따른다. v2 유일 사용자는 `page.code.set` 의 `COMPILE_FAILED` 로 `data.diagnostics` 가 sucrase 컴파일러 오류를 싣는다. 사람용 요약은 `message` 에도 담아, 코어가 실패 `data` 를 흘려도 오류가 사라지지 않게 한다.

모든 `register(...)` 호출은 `message` 를 반드시 제공한다. `message` 누락은 답을 라벨로 열화시키고 `plugin.conformance` 가 그 명령을 `messagesMissing` 으로 보고한다. 모든 명령 message 는 명령이 소유하는 한국어 산문이다.

명령 description 은 2축 i18n 규칙(`docs/I18N.md`)을 따른다: `spec.description` 은 영어 base 문자열(LLM 발견 표면), `spec.triggers` 는 비영어 트리거 맵(언어 → 단어). 사람 라벨은 매니페스트 `contributes.commands[].title`(`{en,ko}`)이다. 매니페스트는 param 스키마·description 을 담지 않는다 — 그건 런타임 `register(...)` 스펙에만 산다.

---

## 5. 명령 표면(26)

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
- 동작: `activeTheme` 을 설정하고, `mode` 가 주어지면 색 모드도 설정한다. `gothic` 은 다크 전용이라 **실효** 모드가 `light` 인 호출(명시 `mode:"light"`, 또는 `mode` 무명시인데 저장된 모드가 `light`)은 `INVALID_PROP` 로 거부한다. `mode` 검증과 gothic 게이트는 `activeTheme` 변이 **전**에 돌므로 거부된 호출은 문서를 건드리지 않는다. `mode` 는 문서에 영속하고(§11) `mode` 무명시는 저장된 모드를 보존한다. 미리보기가 열려 있으면 새 테마/모드로 아티팩트를 재발행하고 브라우저를 이동시킨다. 브라우저 실패는 명령을 실패시키지 않고(테마/모드 변경이 1차 효과) `previewRefreshed=false` 로 드러난다.
- → `{ theme, mode, previewRefreshed }`(`mode` = 적용된 실효 모드)
- errs: `THEME_UNKNOWN`, `INVALID_PROP`(mode 가 light/dark/system 밖·gothic 에 실효 light 모드)
- message: `테마 {theme}·모드 {mode} 적용{previewRefreshed ? " (미리보기 갱신)" : ""}.`

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
- 동작: **tsx 페이지**의 `code` 를 교체한다. 러너의 정확한 sucrase 설정(§7)으로 `code` 를 인프로세스 컴파일해 검증한다 — 러너가 돌리는 그 변환 그대로라 나쁜 코드는 게이트에서 거부된다. 컴파일 실패 시 컴파일러 오류를 `data.diagnostics` 에(요약은 `message` 에) 담아 `COMPILE_FAILED` 반환, 페이지는 불변. 성공 시 `source = { kind:"tsx", code }`(기존 `origin` 보존). tree 페이지는 `INVALID_TARGET`(종류 게이트, §2) — 제자리 tree→tsx 변환은 없다. `page.create kind=tsx` 나 `template.apply` 로 tsx 페이지를 씨앗하라.
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
- 동작: 페이지의 미리보기 아티팩트를 쓰고(§7) 브라우저 플러그인(§7 폴백 순서)을 아티팩트 URL 로 구동한다.
- → `{ url, engine }`(`engine` = `"chromium"` | `"native"`)
- errs: `NOT_FOUND`(페이지), `PREVIEW_FAILED`(쓰기·구동), `DEP_MISSING`(브라우저 미가용)
- message: `미리보기 열림({engine}).`

### preview.refresh
- params: `{ pageId?: string }`
- 동작: 현재 미리보기 중인 페이지(또는 준 `pageId`)의 아티팩트를 재작성하고 브라우저를 이동시킨다. 열린 미리보기가 없으면 실패.
- → `{ url, engine }`
- errs: `NOT_FOUND`(열린 미리보기 없음·페이지 부재), `PREVIEW_FAILED`, `DEP_MISSING`
- message: `미리보기 갱신({engine}).`

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

## 7. 미리보기 법

### 아티팩트

미리보기는 디스크에 쓰는 자기완결 문서다: `index.html` + `runner.js`, 디자인은 인라인 주입. `index.html` 은 이 순서로 담는다:

1. `<style>` 블록에 정확히 이 순서로 임베드: `core/src/reset.css` → `core/dist/astryx.css` → 활성 테마 `dist/theme.css`.
2. `<script>window.__DESIGN__ = { theme, mode, page };</script>`(그 페이지의 `DesignPayload`. `page` 는 `RunnerPage` — `{ kind:"tree", root }` 또는 `{ kind:"tsx", code }`. `mode` 는 §9 색 모드로 명령 계층이 `system` 으로 기본화).
3. `<script src="./runner.js"></script>` — sibling `file://` 스크립트. 문서는 `fetch()` 에 절대 의존하지 않는다(`file://` 에서 차단).

`runner.js` 는 프리빌트 러너 번들(`scripts/build-runner.mjs` 산출, `main.js` 에 문자열로 임베드 — §11)이다. `window.__DESIGN__` 을 읽고 `page.kind` 로 분기해 마운트한 결과를 코어 루트 `<Theme>`(전용 미리보기 문서 안이라 `document.documentElement` 스탬프는 안전)로 감싸 렌더한다. 컴파일·런타임 오류는 **빈 화면이 아니라 보이는 오류 표면**으로 렌더한다(기존 `ErrorBox`/`NodeBoundary`).

### 트리 경로

`page.kind === "tree"`: 러너가 각 `node.type` 을 번들 `@astryxdesign/core` barrel 에서 이름으로 해소해 트리를 React 엘리먼트로 낮춘다(v1 무변; §2 children/prop 법). 미지 `node.type` 은 이름을 단 `ErrorBox`.

### TSX 경로(v2)

`page.kind === "tsx"`: 러너가 **Learn Gate B 의 정확한 sucrase 설정**으로 `page.code` 를 컴파일하고 require-shim 으로 실행한다:

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
- require-shim 은 모듈 id 를 번들로 해소한다(Gate A 대로 — **barrel 전용** 맵으로 충분하다. 619 템플릿/94 subpath 의 모든 런타임 값 심볼이 `@astryxdesign/core` barrel 네임스페이스에서 해소되므로 subpath 별 엔트리가 필요 없다):
  - `react`·`react/jsx-runtime`(및 import 시 `react-dom`/`react-dom/client`) → 번들 React 런타임.
  - `@astryxdesign/core` **및** 모든 `@astryxdesign/core/<Subpath>` → 번들 barrel 네임스페이스.
  - `@heroicons/react/24/outline`·`@heroicons/react/24/solid`·`@heroicons/react/20/solid` → 번들 heroicons.
  - `lucide-react` → 번들 lucide.
  - **미지 모듈**(예: `recharts`·`@astryxdesign/lab`·런타임 `@stylexjs/stylex`) → 컴포넌트가 모듈 이름을 단 보이는 `ErrorBox` 를 렌더하는 정직-미가용 스텁. 게이트가 그런 템플릿을 걸러내지만(§13) 그런 모듈을 참조하는 손편집 `page.code.set` 은 throw 가 아니라 보이는 표면으로 열화해야 한다.
- 러너는 모듈의 **default export** 를 마운트한다(컴파일 기반 해소 — 템플릿마다 진짜 `export default function` 은 정확히 하나. 텍스트 스캔의 이중-default 는 템플릿 리터럴 코드 샘플 안이라 regex 로 default 를 찾으면 안 된다).
- 지연 `setTimeout` 타이머(chat/login 데모)와 실패하는 단일 `fetch`(코드 샘플 블록 하나, 오프라인)는 허용해야 한다: 마운트 후 발화하며 페이지를 죽이면 안 된다.

### 에셋 플레이스홀더 법(v2)

렌더 시점에 러너는 **스킴 없는 상대·절대 경로**(`./x`·`../x`·`/x`)인 이미지 소스를 **인라인 중립 SVG 플레이스홀더** `data:` URI 로 다시 쓴다 — `file://` 아래에서 해소 불가한 에셋의 정직한 플레이스홀더. 스킴 있는 소스(`http:`·`https:`·`data:`)는 그대로 통과한다(코퍼스는 원격 절대 이미지만 참조하고, 네트워크 차단된 원격 이미지는 throw 가 아니라 브라우저의 깨진 이미지 글리프를 보인다). 모든 `<img>` 는 같은 플레이스홀더로 가는 `onerror` 폴백도 지닌다. 이것은 문서화된 정직한 열화이지 침묵 파손이 아니다.

### 크기 법(v2)

러너 번들은 바이트 크기를 보고한다(빌드 로그 / `generated/` 아티팩트). v2 는 v1 의 `react`+`react-dom`+`@astryxdesign/core` 위에 `sucrase`·heroicons(`24/outline`·`24/solid`·`20/solid`)·`lucide-react` 를 번들에 더한다. 그 증가는 **수용·명기** — 무손실 TSX 렌더의 비용이다(v1 러너 기준선 ~0.94 MB, v2 번들은 더 크고 그 크기는 숨기지 않고 기록된다).

### 저장 API(핀)

아티팩트는 `app.fs.writeText(absPath, content)` 로 쓴다. 수송은 HTTP 다 — 플러그인이 로컬 정적 서버(`scripts/preview-server.cjs`, node 내장만, 127.0.0.1 전용, `.preview/` 루트 감금)를 소유하고 `app.process`("process" 권한)로 로그인 셸(`/bin/sh -lc "exec node …"` — GUI 앱은 셸 PATH 를 상속하지 않는다) 경유 스폰한다. 서버는 `PORT=<n>` 을 알리고, 미리보기 URL 은 `http://127.0.0.1:<port>/<pageId>.html` 이다. 살아 있으면 재사용, 죽으면 재스폰, 플러그인 deactivate 때 kill. `file://` 수송은 금지 — 문서마다 고유 보안 오리진이라 fetch 의존 코드(anchor 폴리필·astryx 이미지 훅)를 부수며, 원본 astryx 가 dev 서버 뒤에서 동작하는 이유가 이것이다. `app.fs.url` 도 금지: 그 blob URL 은 앱 웹뷰 문서 스코프라 외부 엔진이 해석할 수 없다. 미리보기 아티팩트는 `${ctx.dir}/.preview/` 한 디렉토리에 평면 배치한다(`${pageId}.html` + 공유 `runner.js`) — 코어 `writeText` 는 부모 디렉토리를 만들지 않으므로 페이지별 하위 폴더를 만들지 않고, 추적되는 `.preview/.gitkeep` 가 디렉토리 실존을 보장한다. `ctx.dir` 는 플러그인 설치 디렉토리(`PluginContext.dir`). `.preview/` 내용물은 git 무시(.gitkeep 제외). `writeText` 는 `fs:write`, 미리보기 서버는 `process` 권한 필요.

### 크로스 플러그인 호출(핀)

브라우저 플러그인 구동은 그 브라우저 플러그인의 레지스트리 명령을 실행해서 한다. 핸들러 안에서는 주입된 `inv.execute(name, params?)`(`PluginInvocation` 컨텍스트)를 쓴다 — `app.commands.execute` 는 쓰지 않는다 — 유래·상관이 계승되도록(spec §5). 명령 이름은 `plugin.<targetId>.<cmd>`. 인가에는 (a) `commands` 권한과 (b) `manifest.dependencies` 에 `<targetId>` 선언(호출경계 강제)이 필요하다. 두 브라우저 플러그인 모두 선언되고(§8) 그 `open`/`navigate`/`ping` 은 비파괴라 `commands` 로 충분하다.

### 브라우저 구동 + 폴백 순서(핀)

우선 엔진은 Chromium(`soksak-plugin-browser-chromium`), 폴백은 네이티브(`soksak-plugin-browser-native`). 가용성은 범용 `ping` 명령(활성화 시 등록됨)으로 탐지한다:

1. `inv.execute("plugin.soksak-plugin-browser-chromium.ping")` → `ok` ⇒ engine = chromium.
2. 아니면 `inv.execute("plugin.soksak-plugin-browser-native.ping")` → `ok` ⇒ engine = native.
3. 아니면 `err("DEP_MISSING", …)` 반환.

그다음:

- 열기: `inv.execute("plugin.<engineId>.open", { url })`, `url` 은 `app.fs.url(indexPath)` 값.
- 갱신/이동: `inv.execute("plugin.<engineId>.navigate", { url })`(같은 url — 파일 바이트가 바뀌었으니 브라우저가 새 내용을 다시 로드).

`open`/`navigate` 의 비-`ok` 결과는 `PREVIEW_FAILED` 로 맵. 선택된 엔진은 스토어에 기록해 `preview.refresh`·`theme.set` 가 재사용한다.

`open` param shape: `{ url?: string }`. `navigate` param shape: `{ url: string }`. `ping` param shape: `{}`. (배포된 브라우저 번들에서 검증.)

---

## 8. 의존성 법

`plugin.json` `dependencies`(플러그인↔플러그인, 핀):

```
"dependencies": {
  "soksak-plugin-browser-chromium": "^0.1.0",
  "soksak-plugin-browser-native": "^2.0.0"
}
```

둘 다 필요하다 — 어느 브라우저 명령이든 호출 가능하려면(호출경계가 미선언 크로스 플러그인 호출을 거부). 이 플러그인 설치는 두 브라우저 설치를 전이 동반한다. 활성화는 플러그인별·사용자 동의로 유지되고, `DEP_MISSING` 은 구동 시점에 두 브라우저 모두 비활성일 때만(`ping` 둘 다 실패) 난다.

`libraries`·`sidecars` 엔트리 없음: 미리보기는 브라우저 플러그인 자신의 사이드카 선언을 통해 간접적으로 Chromium 엔진에 닿지, 이 플러그인의 것이 아니다.

---

## 9. 테마 법(결정: 재발행)

미리보기는 **활성 테마의** `dist/theme.css` 만 임베드한다. `theme.set` 은 `activeTheme` 을 바꾸고, 미리보기가 열려 있으면 새 테마 블록으로 `index.html` 을 재발행하고 이동시킨다. 7종을 모두 임베드하고 `data-astryx-theme` 속성을 토글하는 방식 대신 재발행을 택한다 — 배포된 `theme.css` 가 `:root`(테마별 스코프 셀렉터 아님)를 겨냥하므로 7종을 이으면 `:root` 변수가 충돌(뒤가 이김)하기 때문이다. 한 테마 재발행이 옳고 더 작다. 7개 테마 CSS 페이로드는 여전히 전부 `main.js` 에 임베드(빌드타임 맵, §11)되어 재발행에 디스크 읽기가 필요 없다.

`ThemeName` 과 고정 7테마 집합은 `src/types.ts`(`THEMES`)에 산다. `theme.set` 은 그 밖의 이름을 `THEME_UNKNOWN` 으로 거부한다.

### 색 모드(결정)

`DesignDoc.mode`(`ColorMode` = `light` | `dark` | `system`)는 스토어를 타고 `DesignPayload.mode` 로, 다시 러너로 관통한다. 러너가 이를 해소한다(Astryx 테마 CSS 는 `light-dark()` 를 쓰고 `system` 은 OS 를 따른다). `theme.set` 이 이를 관통시킨다(§5). 모드는 문서 수준 속성(activeTheme 처럼)이고 영속한다(§11). `DesignDoc`·`DesignPayload` 에서 선택이라 부재 시 `system` 으로 읽으니 모드 이전 문서는 마이그레이션이 필요 없다.

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

명령은 헤드리스 완결이다: 뷰가 필요 없다. 미리보기 엔진 선택과 마지막 미리보기 `pageId`/`url` 은 스토어에 산다(비영속 — 세션 상태).

---

## 12. 빌드 법

`main.js` 는 blob 으로 import 되는 단일 ESM 번들이라 런타임에 sibling 파일을 못 읽는다. 따라서 모든 생성물은 빌드타임에 문자열 define 으로 임베드한다(`build.mjs`, erd 선례):

- `__CATALOG_JSON__` ← `generated/catalog.json`
- `__TEMPLATES_JSON__` ← `generated/templates.json`(verbatim-TSX `TemplateEntry[]`, §13)
- `__RUNNER_JS__` ← `generated/runner.js`(프리빌트 러너 번들 — v2 는 sucrase+heroicons+lucide 임베드, §7)
- `__ASTRYX_CSS__` ← `generated/astryx.css`(reset.css + dist/astryx.css 병합)
- `__THEME_CSS_MAP__` ← `generated/theme-css.json`(`{ "<theme>": "<theme.css>" }`, 7 엔트리)

`build.mjs` 는 생성물이 하나라도 없으면 throw 한다(침묵 부분 산출 금지). 파이프라인 순서는 `package.json` 이 고정한다: `gen`(카탈로그 + 템플릿) → `build:runner`(runner.js·astryx.css·theme-css.json) → `build.mjs`(main.js). `.gitignore` 에 `.preview/*`(단 `.gitkeep` 추적)와 `generated/` 를 넣고, `main.js` 는 커밋한다.

`build.mjs` 는 계약이 소유한다. `scripts/gen-catalog.mjs`·`scripts/gen-templates.mjs`·`scripts/build-runner.mjs`·`src/plugin-entry.ts`·`runner/`·`skill/SKILL.md` 는 구현자가 이 계약에 맞춰 만든다.

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
- `available` = 러너가 렌더 가능한가: 모든 `requires` 가 러너 require-shim(§7)에서 해소되면 `true`. 번들이 안 담는 모듈이나 러너가 안 돌리는 **컴파일타임 전용** 변환이 필요하면 `false`.
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

612/619 파일이 최상위 `export default function`(React 컴포넌트)을 정확히 하나 노출한다. 러너는 `module.default` 를 마운트한다. 두 파일(`pages/ide`·`pages/documentation-technical`)은 여분 `export default` 텍스트를 **템플릿 리터럴 코드 샘플 안**에 담는다 — esbuild/sucrase 는 각기 진짜 default 하나만 컴파일하므로 default 해소는 regex 텍스트 스캔이 아니라 컴파일 기반이어야 한다. 7 파일은 default 없음(`themes/*/icons.tsx`, `pages/theme-showcase` 가 쓰는 이름 전용 아이콘 헬퍼) — 헬퍼 모듈이지 독립 마운트 페이지가 아니고 `page` 종류 엔트리가 아니다.

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
- **런타임** — `import()`=0, `requestAnimationFrame`=0, `setInterval`=0, `localStorage`=0. `setTimeout` 10 파일(마운트 후 데모 타이머), 진짜 `fetch` 하나(오프라인 거부 코드 샘플 블록). 미리보기는 로더도, 실 DOM 외 polyfill 도 필요 없다.

---

Version: 2.0.0
Spec: soksak-spec-plugin@0.0.1
Core: @astryxdesign/core 0.1.3
