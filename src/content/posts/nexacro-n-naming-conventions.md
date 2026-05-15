---
title: "[Nexacro N] 네이밍 컨벤션 완전 정리"
description: "Nexacro N 프로젝트에서 컴포넌트 ID, Dataset, 변수, 함수명을 어떻게 짓는지 정리합니다. 접두사 규칙, 카멜케이스 vs 스네이크케이스 선택, 전역 변수 구분 방법을 실전 예시와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 9
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "naming-convention", "camelCase", "prefix", "code-standard"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-script-style-guide/)에서 스크립트 스타일 가이드를 다뤘습니다. 이번 글에서는 Nexacro N 개발에서 가장 기본적이면서도 팀 표준이 없으면 혼란을 초래하는 **네이밍 컨벤션**을 체계적으로 정리합니다. 컴포넌트 ID, Dataset 이름, 변수, 함수명을 어떻게 지어야 코드가 자기 설명적(self-documenting)이 되는지 살펴봅니다.

## 컴포넌트 ID 네이밍

컴포넌트 ID는 **`{유형 접두사}_{의미있는 이름}`** 형태로 짓습니다. 유형 접두사를 보면 어떤 컴포넌트인지 즉시 알 수 있어, 스크립트에서 `this.btn_search`를 보면 버튼임을 바로 파악할 수 있습니다.

![컴포넌트 및 유형별 네이밍 체계](/assets/posts/nexacro-n-naming-conventions-table.svg)

```javascript
// 컴포넌트 ID 예시
this.btn_search    // 조회 버튼
this.btn_save      // 저장 버튼
this.edt_userId    // 사용자ID 입력
this.edt_fromDt    // 시작일 입력
this.grd_list      // 목록 그리드
this.grd_detail    // 상세 그리드
this.cbo_gender    // 성별 콤보
this.cal_fromDt    // 시작일 달력
this.div_search    // 검색 영역 Div
this.pop_userSearch // 사용자 검색 팝업
this.stc_totalCnt  // 전체 건수 라벨
```

이름 부분은 **camelCase**를 사용합니다. 예: `fromDt`(시작일), `totalCnt`(전체 건수).

## Dataset 네이밍

Dataset은 보통 `ds_` 또는 `Ds` + 파스칼케이스 방식 중 프로젝트에서 하나를 선택합니다. 실무에서는 `ds_` 접두사가 더 일반적입니다.

```javascript
this.ds_search   // 검색 조건 Dataset
this.ds_list     // 목록 데이터 Dataset
this.ds_detail   // 상세 데이터 Dataset
this.ds_code     // 코드 데이터 Dataset (공통코드 등)
```

복수 개념의 목록은 `ds_list`, 단건 상세는 `ds_detail`이나 `ds_master`로 구분하는 경우가 많습니다. 검색 조건용 Dataset은 `ds_search` 또는 `ds_input`으로 명명합니다.

## 변수 네이밍 — 타입 접두사

변수명에는 타입을 나타내는 접두사를 붙입니다.

![변수 및 함수 네이밍 규칙](/assets/posts/nexacro-n-naming-conventions-vars.svg)

| 접두사 | 타입 | 예시 |
|--------|------|------|
| `s` | String | `sUserId`, `sDeptNm` |
| `n` | Number | `nPageSize`, `nRow` |
| `b` | Boolean | `bIsAdmin`, `bEditable` |
| `o` | Object/Component | `oDs`, `oBtn` |
| `a` | Array | `aSelected`, `aIds` |

전역 변수(Form Script 최상단 선언)는 `g_` 접두사를 추가합니다.

```javascript
// Form 전역 변수
var g_sUserId   = "";
var g_bEditable = false;
var g_nPage     = 1;

// 함수 내 지역 변수
function fn_search() {
    var sKeyword  = this.edt_keyword.value;
    var nFromYear = parseInt(this.edt_fromYear.value);
    var bIsExact  = this.chk_exact.value === "1";
    var oDs       = this.ds_list;
    // ...
}
```

## 함수 네이밍

| 접두사 | 용도 | 예시 |
|--------|------|------|
| `fn_` | Form 내 일반 함수 | `fn_search`, `fn_save` |
| `fn_*Cb` | 트랜잭션 콜백 | `fn_searchCb`, `fn_saveCb` |
| `fn_get*` | 값 반환 함수 | `fn_getToday`, `fn_getRowCount` |
| `fn_set*` | 값 설정 함수 | `fn_setEditable`, `fn_setMode` |
| `fn_validate` | 유효성 검사 | `fn_validate`, `fn_validateInput` |
| `fn_on*` | 이벤트 결과 처리 | `fn_onDateChanged` |
| `cmn_` | Include 공통 함수 | `cmn_alert`, `cmn_getToday` |
| `util_` | 유틸리티 함수 | `util_formatDate`, `util_trimStr` |

함수명은 **동사 + 목적어** 형태로 작성합니다. `search` 보다 `fn_search`, `loadUserData` 보다 `fn_loadUserData`처럼 의도가 명확히 드러나야 합니다.

## Form 파일명 네이밍

Form 파일명(xfdl)도 일관된 규칙을 따릅니다.

```
// 업무화면: {업무코드}{화면구분}.xfdl
USERR010.xfdl     // 사용자관리 조회
USERR020.xfdl     // 사용자관리 등록

// 팝업: pop_{기능}.xfdl
pop_userSearch.xfdl
pop_deptSelect.xfdl

// 공통: cmn_{기능}.xfdl
cmn_codeSearch.xfdl
cmn_fileUpload.xfdl
```

화면 코드 체계는 프로젝트마다 다르지만, 팝업과 공통 화면은 `pop_`, `cmn_` 접두사로 구분하는 패턴이 일반적입니다.

## 서비스 ID 네이밍

`transaction` 함수의 첫 번째 파라미터인 서비스 ID는 **`svc{동사}{목적어}`** 형태로 작성합니다.

```javascript
// 서비스 ID 예시
this.transaction("svcSearch",      "/api/user/list",   ...);
this.transaction("svcSave",        "/api/user/save",   ...);
this.transaction("svcDelete",      "/api/user/delete", ...);
this.transaction("svcLoadCode",    "/api/code/list",   ...);
this.transaction("svcFileUpload",  "/api/file/upload", ...);
```

서비스 ID를 콜백 함수 내의 `svcId` 파라미터로 받을 수 있으므로, 의미 있는 이름을 지어두면 멀티 트랜잭션 환경에서 어느 서비스의 콜백인지 쉽게 구분할 수 있습니다.

## 네이밍 규칙 요약 체크리스트

```
✅ 컴포넌트 ID: {접두사}_{camelCase}  ex) btn_searchAll
✅ Dataset: ds_{camelCase}            ex) ds_searchResult
✅ 전역 변수: g_{타입접두사}{PascalCase}  ex) g_sUserId
✅ 지역 변수: {타입접두사}{camelCase}    ex) sUserId, nRow
✅ Form 함수: fn_{camelCase}           ex) fn_search
✅ 공통 함수: cmn_{camelCase}          ex) cmn_confirm
✅ 콜백 함수: fn_{서비스명}Cb           ex) fn_searchCb
✅ 서비스 ID: svc{PascalCase}          ex) svcSearch
```

일관된 네이밍 컨벤션은 새로운 팀원이 코드를 처음 볼 때 진입 장벽을 크게 낮춥니다. 가장 중요한 것은 **팀 내에서 하나의 기준을 정하고 모두가 따르는 것**입니다. 다음 글에서는 스크립트의 오류 처리 패턴을 다룹니다.

---

**지난 글:** [스크립트 스타일 가이드](/posts/nexacro-n-script-style-guide/)

**다음 글:** [스크립트 오류 처리 패턴](/posts/nexacro-n-error-handling-script/)

<br>
읽어주셔서 감사합니다. 😊
