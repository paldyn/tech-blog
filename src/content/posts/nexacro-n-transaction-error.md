---
title: "[Nexacro N] 트랜잭션 오류 처리 전략"
description: "Nexacro N transaction() 콜백의 errCode 분류(네트워크·비즈니스 오류), 세션 만료 처리, 전역 ontransactionerror 핸들러 등록, 프로젝트 공통 오류 처리 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 8
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "transaction", "errCode", "오류처리", "세션만료", "ontransactionerror"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-sync-vs-async/)에서 동기·비동기 트랜잭션의 차이를 다뤘습니다. 이번 글은 트랜잭션 오류를 어떻게 체계적으로 처리할지를 다룹니다. 단순히 `alert(errMsg)`로 끝내는 것과 세션 만료·네트워크 오류·비즈니스 오류를 구분해서 처리하는 것은 실무 완성도 면에서 큰 차이가 있습니다.

## errCode 분류 체계

![트랜잭션 errCode 분류와 처리 전략](/assets/posts/nexacro-n-transaction-error-codes.svg)

`errCode`는 크게 세 범위로 나뉩니다:

- **0**: 성공
- **음수 (< 0)**: 네트워크·인프라·세션 오류
- **양수 (> 0)**: 비즈니스 로직 오류 (서버가 의도적으로 설정)

정확한 코드 범위는 사용하는 Nexacro 어댑터와 프로젝트 관례에 따라 달라집니다. 팀 내 표준을 정해두는 것이 중요합니다.

## 기본 오류 처리 구조

```javascript
function fn_searchCb(svcId, errCode, errMsg) {
    // 1. 세션 만료 최우선 처리
    if (errCode === -200) {
        gfn_sessionExpired();
        return;
    }

    // 2. 시스템/네트워크 오류 (음수)
    if (errCode < 0) {
        alert("[시스템 오류] " + errMsg);
        trace("[ERROR] svcId=" + svcId + " errCode=" + errCode);
        return;
    }

    // 3. 비즈니스 오류 (양수)
    if (errCode > 0) {
        alert(errMsg); // 서버가 설정한 사용자 친화적 메시지
        return;
    }

    // 4. 성공 처리 (errCode === 0)
    trace("조회 완료: " + this.dsMain.rowcount + "건");
}
```

## 세션 만료 처리

세션 만료는 `-200`(또는 팀에서 정한 코드)으로 오는 경우가 많습니다. 로그인 페이지로 이동하는 공통 함수를 만들어두고 모든 콜백에서 사용합니다.

```javascript
// 공통 라이브러리에 정의
function gfn_sessionExpired() {
    // 진행 중인 팝업 닫기
    nexacro.getActiveFrame().closeAllChildForms();

    // 세션 만료 안내 후 로그인 이동
    alert("세션이 만료되었습니다. 다시 로그인하세요.");
    nexacro.getApplication().open(
        "LOGIN_FORM",
        "url::login.xfdl",
        "parent",
        ""
    );
}
```

## 전역 오류 핸들러 — ontransactionerror

콜백을 지정하지 않은 트랜잭션이나, 콜백에서 오류를 처리하지 않은 경우를 위한 **안전망**입니다.

![전역 오류 핸들러 — ontransactionerror](/assets/posts/nexacro-n-transaction-error-global.svg)

Application 스크립트에 등록합니다:

```javascript
function Application_onload(obj, e) {
    // 전역 트랜잭션 오류 핸들러
    nexacro.ontransactionerror = gfn_onTransactionError;
}

function gfn_onTransactionError(svcId, errCode, errMsg) {
    if (errCode === -200) {
        gfn_sessionExpired();
        return;
    }
    // 로그 기록 및 사용자 안내
    trace("[GLOBAL_ERROR] svcId=" + svcId
        + " errCode=" + errCode
        + " msg=" + errMsg);
    alert("시스템 오류가 발생했습니다.\n" + errMsg);
}
```

콜백 함수에서 오류를 직접 처리하면 `ontransactionerror`는 호출되지 않습니다. 콜백이 없거나 콜백에서 오류를 무시하면 전역 핸들러가 동작합니다.

## 서버에서 비즈니스 오류 설정

서버 Java에서 errCode와 errMsg를 직접 설정할 수 있습니다.

```java
// Spring Adapter에서 비즈니스 오류 반환
if (isAlreadyRegistered) {
    res.setErrCode(1);
    res.setErrMsg("이미 등록된 사원번호입니다.");
    return;
}
```

클라이언트 콜백에서는 `errCode > 0`으로 감지합니다:

```javascript
function fn_saveCb(svcId, errCode, errMsg) {
    if (errCode === -200) { gfn_sessionExpired(); return; }
    if (errCode < 0) { alert("[저장 실패] " + errMsg); return; }
    if (errCode > 0) {
        // 서버가 설정한 비즈니스 오류 메시지 그대로 표시
        alert(errMsg);  // "이미 등록된 사원번호입니다."
        return;
    }
    // 성공
    alert("저장되었습니다.");
    this.fn_search();
}
```

## 공통 오류 처리 함수

모든 콜백에서 반복되는 오류 처리를 공통 함수로 추출합니다.

```javascript
// 공통 라이브러리 (cmn_lib.xjs)
function cmn_checkError(errCode, errMsg) {
    if (errCode === -200) {
        gfn_sessionExpired();
        return false;
    }
    if (errCode !== 0) {
        alert(errMsg || "오류가 발생했습니다.");
        return false;
    }
    return true; // 성공
}
```

사용:

```javascript
function fn_searchCb(svcId, errCode, errMsg) {
    if (!cmn_checkError(errCode, errMsg)) return;

    // 성공 처리만 여기서
    this.grdMain.setReadOnly(true);
    trace("조회 완료: " + this.dsMain.rowcount + "건");
}

function fn_saveCb(svcId, errCode, errMsg) {
    if (!cmn_checkError(errCode, errMsg)) return;

    alert("저장되었습니다.");
    this.fn_search();
}
```

오류 처리가 한 곳으로 집중되어 각 콜백이 성공 로직에만 집중할 수 있습니다.

## 오류 처리 체크리스트

| 체크 항목 | 확인 방법 |
|-----------|-----------|
| 모든 콜백에 errCode 확인 코드가 있는가 | 코드 리뷰 |
| 세션 만료 코드 처리가 있는가 | errCode === -200 분기 확인 |
| 전역 ontransactionerror가 등록되어 있는가 | Application 스크립트 확인 |
| 오류 메시지가 사용자 친화적인가 | 시스템 코드 노출 여부 확인 |
| 오류 발생 시 trace()로 로그가 남는가 | Output 창 확인 |

---

**지난 글:** [동기 vs 비동기 트랜잭션](/posts/nexacro-n-sync-vs-async/)

**다음 글:** [복수 Dataset 동시 처리](/posts/nexacro-n-multi-dataset/)

<br>
읽어주셔서 감사합니다. 😊
