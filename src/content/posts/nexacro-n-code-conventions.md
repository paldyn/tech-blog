---
title: "[Nexacro N] 코드 컨벤션"
description: "Nexacro N 프로젝트에서 팀 전체가 따라야 할 코드 컨벤션을 정립하는 방법을 설명합니다. 명명 규칙, 스크립트 블록 구조, 함수 설계 원칙, 주석 기준을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 4
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "코드컨벤션", "명명규칙", "코딩스타일", "팀협업", "유지보수", "클린코드"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-logging-standard/)에서 로깅 표준을 다루었다. 에러 처리, 로깅과 함께 대규모 프로젝트의 품질을 좌우하는 또 다른 요소가 **코드 컨벤션**이다. 10명 이상이 협업하는 프로젝트에서 컨벤션 없이 개발하면 동일한 기능을 5가지 방식으로 구현하는 상황이 발생한다.

## 명명 규칙

Nexacro N 개발에서 적용하기 좋은 명명 규칙을 정리했다. 팀 내 합의를 통해 일부를 수정해도 좋지만, 정한 규칙은 반드시 문서화하고 공유해야 한다.

![명명 규칙 표](/assets/posts/nexacro-n-code-conventions-naming.svg)

가장 중요한 원칙은 **의도를 드러내는 이름**이다. `dsData1`, `fn_proc` 같은 이름은 어떤 데이터인지, 어떤 처리를 하는지 알 수 없다. `dsUserSearchResult`, `fn_searchUser`처럼 명확하게 짓는다.

## 스크립트 블록 구조

화면 스크립트(.xjs)는 항상 동일한 구조로 작성한다. 이 구조를 따르면 어떤 화면을 열어도 원하는 코드를 빠르게 찾을 수 있다.

![스크립트 블록 구조 가이드](/assets/posts/nexacro-n-code-conventions-structure.svg)

```javascript
/* =============================================
 * 1. 전역 변수 선언
 * ============================================= */
var g_curPage   = 1;
var g_pageSize  = 20;

/* =============================================
 * 2. 화면 이벤트 (onload / onunload)
 * ============================================= */
function Form_onload(obj, e) {
    fn_init();
}

function Form_onunload(obj, e) {
    fn_cleanup();
}

/* =============================================
 * 3. 컴포넌트 이벤트 핸들러
 * ============================================= */
function btn_search_onclick(obj, e) { fn_search(); }
function btn_save_onclick(obj, e)   { fn_save();   }
function btn_delete_onclick(obj, e) { fn_delete(); }

/* =============================================
 * 4. 비즈니스 함수 (fn_ 접두사)
 * ============================================= */
function fn_init() { ... }
function fn_search() { ... }
function fn_searchCb(svcId, errCode, errMsg) { ... }
function fn_save() { ... }
function fn_saveCb(svcId, errCode, errMsg) { ... }
function fn_delete() { ... }
function fn_deleteCb(svcId, errCode, errMsg) { ... }
function fn_validate() { ... }
function fn_cleanup() { ... }
```

이벤트 핸들러 함수는 실제 로직을 담지 않고, `fn_` 접두사가 붙은 비즈니스 함수를 단순 호출만 한다. 이렇게 하면 코드 검색이 쉬워지고, 다른 곳에서 같은 함수를 재호출할 때도 용이하다.

## 함수 설계 원칙

**단일 책임**: 함수 하나는 하나의 일만 한다. 함수명이 `fn_searchAndSave`처럼 "and"가 들어간다면 분리를 검토한다.

**적절한 길이**: 단일 함수는 50줄을 넘지 않도록 한다. 길어지면 서브 함수로 분리한다.

**파라미터 최소화**: 파라미터는 3개를 넘지 않도록 한다. 4개 이상이라면 Dataset으로 묶는다.

```javascript
// 나쁜 예 — 파라미터 과다
function fn_buildCondition(userId, deptCd, startDate, endDate, status, flag) { ... }

// 좋은 예 — Dataset으로 묶기
function fn_buildCondition(dsCondition) {
    var userId    = dsCondition.getColumn(0, "userId");
    var deptCd    = dsCondition.getColumn(0, "deptCd");
    var startDate = dsCondition.getColumn(0, "startDate");
    // ...
}
```

## 주석 기준

주석은 **코드가 설명하지 못하는 이유(WHY)** 에만 단다.

```javascript
// 나쁜 주석 — 코드가 이미 말하고 있음
var rowCount = dsResult.rowcount; // rowCount에 dsResult의 rowcount를 대입

// 좋은 주석 — 이유를 설명
// IE11에서 getColumn이 undefined를 반환하는 경우가 있어
// 빈 문자열로 기본값 처리
var value = dsData.getColumn(idx, "colName") || "";
```

섹션 구분 주석(`/* === 1. 전역 변수 === */`)은 블록 구조를 명확히 하므로 허용한다. 그 외 자명한 코드에 달린 주석은 제거한다.

## 컴포넌트 네이밍 접두사 표

| 컴포넌트 타입 | 접두사 | 예시 |
|--------------|--------|------|
| Button | btn | btn_search, btn_save |
| Edit | edt | edt_userId, edt_name |
| Grid | grd | grd_result, grd_detail |
| Dataset | ds | dsSearch, dsResult |
| Combo | cbo | cbo_deptCd, cbo_status |
| Calendar | cal | cal_startDate, cal_endDate |
| Label | lbl | lbl_title, lbl_rowCount |
| Div | div | div_header, div_search |
| Tab | tab | tab_main |
| Static | sta | sta_notice |

접두사 다음에는 의미 있는 이름을 PascalCase로 붙인다. 단, Dataset은 `ds` 뒤에 바로 PascalCase(예: `dsUserList`)를 쓰고, 컴포넌트는 두 번째 단어부터 PascalCase로 구분(예: `btn_searchUser`)한다.

---

**지난 글:** [로깅 표준](/posts/nexacro-n-logging-standard/)

**다음 글:** [폼 미표시 트러블슈팅](/posts/nexacro-n-troubleshoot-form-not-shown/)

<br>
읽어주셔서 감사합니다. 😊
