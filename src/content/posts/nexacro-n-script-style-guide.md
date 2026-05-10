---
title: "[Nexacro N] 스크립트 스타일 가이드"
description: "Nexacro N Form 스크립트 작성의 모범 사례를 정리합니다. 영역 분리 구조, 조기 반환 패턴, 변수 선언 방식, 함수 단일 책임 원칙 등 팀 협업과 유지보수성을 높이는 실전 가이드를 제공합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 8
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "script", "style-guide", "best-practice", "code-quality"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-custom-events/)에서 커스텀 이벤트를 살펴봤습니다. 이번 글에서는 Nexacro N 프로젝트에서 스크립트를 작성할 때 따라야 할 **스타일 가이드**를 정리합니다. 이 가이드는 코드의 정상 동작을 위한 것이 아니라, 팀원 간의 코드 가독성, 유지보수 효율, 버그 예방을 위한 약속입니다. 표준이 없는 팀에서는 사람마다 다른 스타일로 코드를 작성하게 되어, 코드 리뷰와 인수인계에 불필요한 시간이 낭비됩니다.

## 1. Form Script 영역 분리

Form Script 전체를 **역할별 영역**으로 나누고, 각 영역을 구분 주석으로 명확히 표시합니다.

![Form Script 권장 구조](/assets/posts/nexacro-n-script-style-guide-structure.svg)

```javascript
/* =========================================
 * ① 전역 변수 선언 영역
 * ========================================= */
var g_bIsEditing  = false;
var g_nCurrentPage = 1;

/* =========================================
 * ② 이벤트 핸들러 영역
 * ========================================= */
this.form.onload = function(obj) { fn_init(); };
this.btn_search.onclick = function(obj, e) { fn_search(); };
this.btn_save.onclick   = function(obj, e) { fn_save(); };

/* =========================================
 * ③ 초기화 함수
 * ========================================= */
function fn_init() {
    // 화면 로드 시 최초 1회 실행
    this.dsList.clearData();
    this.edt_fromDt.value = fn_getToday();
}

/* =========================================
 * ④ 비즈니스 로직 함수
 * ========================================= */
function fn_search() { ... }
function fn_save()   { ... }
function fn_delete() { ... }

/* =========================================
 * ⑤ 트랜잭션 콜백 함수
 * ========================================= */
function fn_searchCb(svcId, errCode, errMsg) { ... }
function fn_saveCb(svcId, errCode, errMsg)   { ... }
```

영역 순서를 프로젝트 내에서 통일해두면 어느 파일을 열어도 동일한 위치에서 원하는 코드를 찾을 수 있습니다.

## 2. 핸들러는 얇게, 로직은 함수로

이벤트 핸들러는 가능한 한 **1줄**로 유지하고, 실제 처리는 별도 함수에 위임합니다.

![스타일 가이드 — 좋은 예 vs 나쁜 예](/assets/posts/nexacro-n-script-style-guide-code.svg)

```javascript
// ❌ 핸들러에 로직 혼재
this.btn_save.onclick = function(obj, e) {
    if (this.edt_name.value !== "" && this.edt_age.value !== "") {
        // 50줄의 저장 로직...
    } else {
        alert("필수값을 입력하세요.");
    }
};

// ✅ 핸들러는 위임만
this.btn_save.onclick = function(obj, e) { fn_save(); };

function fn_save() {
    if (!fn_validate()) return; // 조기 반환으로 중첩 감소
    // 저장 로직만 집중
    this.transaction("svcSave", "/save.do", ...);
}

function fn_validate() {
    if (!this.edt_name.value) {
        alert("이름을 입력하세요."); return false;
    }
    if (!this.edt_age.value) {
        alert("나이를 입력하세요."); return false;
    }
    return true;
}
```

함수를 단일 책임(Single Responsibility) 원칙에 따라 분리하면, 각 함수를 독립적으로 테스트하고 수정할 수 있습니다.

## 3. 조기 반환(Early Return) 패턴

중첩 `if-else`보다 조기 반환을 사용하면 코드 들여쓰기 단계를 줄이고 가독성을 높입니다.

```javascript
// ❌ 깊은 중첩
function fn_process() {
    if (fn_validate()) {
        if (g_bIsEditing) {
            // 수정 로직
            if (this.dsMain.rowcount > 0) {
                this.transaction(...);
            }
        }
    }
}

// ✅ 조기 반환
function fn_process() {
    if (!fn_validate()) return;
    if (!g_bIsEditing)  return;
    if (this.dsMain.rowcount <= 0) return;

    this.transaction(...); // 핵심 로직만 남음
}
```

## 4. 변수 선언 위치와 명명

- `var`로 선언하고 함수 최상단에 모아서 선언합니다 (호이스팅 명확화).
- 전역 변수(Form 최상단)는 `g_` 접두사, 로컬 변수는 타입 접두사를 사용합니다.

```javascript
function fn_search() {
    // 변수를 함수 최상단에 모아서 선언
    var svcId  = "svcSearch";
    var sInput = "dsSearch:input=dsSearch";
    var sOutput = "dsResult:output=dsResult";
    var nRow, sValue;

    // ... 이후에 사용
    nRow   = this.grd_list.currentrow;
    sValue = this.edt_keyword.value;

    this.transaction(svcId, "/search.do", sInput, sOutput, "", "fn_searchCb");
}
```

## 5. 매직 넘버 상수화

코드 내에 의미를 알 수 없는 숫자나 문자열 리터럴을 직접 쓰지 않습니다. 상단에 상수로 선언합니다.

```javascript
// ❌ 매직 넘버
if (nStatus === 2) { ... }

// ✅ 상수 선언
var STATUS_APPROVED  = "2";
var STATUS_REJECTED  = "3";
var MAX_UPLOAD_SIZE  = 5 * 1024 * 1024; // 5MB

if (nStatus === STATUS_APPROVED) { ... }
```

## 6. 콜백 함수 명명 규칙

트랜잭션 콜백 함수 이름은 **`fn_{서비스ID}Cb`** 형태로 통일합니다. 서비스 ID에서 `svc` 접두사를 제거하거나 그대로 유지합니다.

```javascript
// 서비스: "svcSearch"  →  콜백: fn_searchCb
function fn_searchCb(svcId, errCode, errMsg) {
    if (errCode !== 0) { alert(errMsg); return; }
    // 정상 처리
}

// 서비스: "svcSave"  →  콜백: fn_saveCb
function fn_saveCb(svcId, errCode, errMsg) {
    if (errCode !== 0) { alert(errMsg); return; }
    alert("저장되었습니다.");
    fn_search(); // 저장 후 재조회
}
```

## 7. 에러 처리 최상단

콜백 함수에서 항상 **에러 여부를 가장 먼저 검사**합니다. 에러인 경우 `return`으로 조기 종료해서 정상 처리 코드가 오염되지 않게 합니다.

```javascript
function fn_saveCb(svcId, errCode, errMsg) {
    // 에러 처리 — 항상 최상단
    if (errCode !== 0) {
        alert("[저장 오류] " + errMsg);
        return;
    }

    // 에러가 없을 때만 실행
    alert("저장되었습니다.");
    fn_search();
}
```

## 요약

| 규칙 | 내용 |
|------|------|
| 영역 분리 | 전역변수 → 핸들러 → 초기화 → 비즈니스 → 콜백 순 |
| 핸들러 위임 | 핸들러 1줄, 로직은 fn_* 함수로 |
| 조기 반환 | 중첩 if-else 대신 guard clause |
| 변수 명명 | 전역 g_접두사, 로컬 타입 접두사 |
| 상수화 | 매직 넘버·문자열은 상수로 선언 |
| 콜백 명명 | fn_{서비스명}Cb 형식 |
| 에러 최상단 | 콜백에서 에러 체크 → return 먼저 |

다음 글에서는 Nexacro N의 네이밍 컨벤션을 세부적으로 다룹니다.

---

**지난 글:** [사용자 정의 이벤트(Custom Event) 만들기](/posts/nexacro-n-custom-events/)

**다음 글:** [네이밍 컨벤션 완전 정리](/posts/nexacro-n-naming-conventions/)

<br>
읽어주셔서 감사합니다. 😊
