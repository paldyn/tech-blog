---
title: "[Nexacro N] 스크립트 오류 처리 패턴"
description: "Nexacro N 스크립트에서 트랜잭션 콜백 오류 처리, try-catch 활용, 전역 ontransactionerror 등록, 세션 만료 처리까지 실무에서 반드시 필요한 오류 처리 패턴을 단계별로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 10
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "error-handling", "try-catch", "ontransactionerror", "session-expired", "callback"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-naming-conventions/)에서 네이밍 컨벤션을 살펴봤습니다. 이번 글은 이번 배치의 마지막 주제로, Nexacro N 스크립트에서 **오류를 어떻게 처리해야 하는지**를 다룹니다. 오류 처리는 화면이 정상적으로 동작하는 것만큼이나 중요합니다. 적절한 오류 처리 없이는 사용자가 왜 화면이 멈췄는지 알 수 없고, 개발자는 문제의 원인을 찾기 어렵습니다.

## 오류 처리의 세 가지 계층

Nexacro N 스크립트의 오류 처리는 크게 세 가지 계층으로 나눌 수 있습니다.

![스크립트 오류 처리 계층](/assets/posts/nexacro-n-error-handling-script-layers.svg)

1. **클라이언트 예외 (try-catch)**: 스크립트 실행 중 발생하는 런타임 오류를 포착합니다.
2. **트랜잭션 콜백 오류**: 서버와의 통신 결과에서 오류 코드를 확인합니다.
3. **전역 오류 핸들러 (ontransactionerror)**: 콜백이 지정되지 않은 트랜잭션 오류를 Application 레벨에서 포착합니다.

## 트랜잭션 콜백 표준 오류 처리

가장 중요한 오류 처리는 **트랜잭션 콜백 함수**에서 이루어집니다. 콜백 함수의 `errCode` 파라미터가 `0`이 아니면 오류 상황입니다.

```javascript
function fn_saveCb(svcId, errCode, errMsg) {
    // ① 세션 만료 (예: errCode === -200)
    if (errCode === -200) {
        cmn_sessionExpired(); // 로그인 페이지로 이동
        return;
    }

    // ② 서버/네트워크 오류
    if (errCode !== 0) {
        cmn_alert("[저장 실패] " + errMsg);
        return;
    }

    // ③ 정상 처리 — 에러가 없을 때만 실행
    alert("저장되었습니다.");
    fn_search();
}
```

에러 코드 체크를 **항상 콜백 최상단**에 배치합니다. 이렇게 하면 정상 처리 코드에 오류 처리 로직이 섞이지 않습니다. 세션 만료 코드는 프로젝트마다 다르므로 공통 상수로 관리하는 것이 좋습니다.

## 전역 ontransactionerror 등록

콜백 함수를 지정하지 않은 트랜잭션이나, 공통 프레임에서 처리해야 할 전역 오류는 Application Script의 `ontransactionerror`로 포착합니다.

```javascript
// application.xfdl 또는 App Script
this.application.ontransactionerror = function(obj, e) {
    var nErrCode = e.errorcode;
    var sErrMsg  = e.errormsg;
    var sSvcId   = e.serviceid;

    trace("[전역 트랜잭션 오류] svcId=" + sSvcId + ", errCode=" + nErrCode);

    if (nErrCode === -200) {
        // 세션 만료 전역 처리
        this.gotoUrl("login.html");
        return;
    }

    // 기타 오류는 공통 알림
    alert("[시스템 오류] " + sErrMsg);
};
```

`e` 객체의 주요 속성은 다음과 같습니다.

| 속성 | 설명 |
|------|------|
| `e.errorcode` | 오류 코드 |
| `e.errormsg` | 오류 메시지 |
| `e.serviceid` | 오류가 발생한 서비스 ID |
| `e.statuscode` | HTTP 상태 코드 |

## try-catch 활용

외부 데이터 파싱이나 예측하기 어려운 런타임 오류는 `try-catch`로 처리합니다. Nexacro N 스크립트도 일반 JavaScript와 동일하게 `try-catch` 문을 지원합니다.

![오류 처리 공통 패턴 코드](/assets/posts/nexacro-n-error-handling-script-code.svg)

```javascript
function fn_parseJson(sJson) {
    try {
        var oData = JSON.parse(sJson);
        return oData;
    } catch (e) {
        trace("[JSON 파싱 오류] " + e.message + " / 입력값: " + sJson);
        return null;
    }
}

// 안전한 숫자 변환
function fn_safeInt(sVal) {
    try {
        var nResult = parseInt(sVal, 10);
        if (isNaN(nResult)) return 0;
        return nResult;
    } catch (e) {
        return 0;
    }
}
```

`try-catch`는 트랜잭션이 아닌 **스크립트 내부 로직**의 예외 처리에 사용합니다. 트랜잭션 오류는 콜백 파라미터로 전달되므로 `try-catch`가 필요하지 않습니다.

## 세션 만료 공통 처리 함수

여러 콜백 함수에서 공통으로 사용하는 세션 만료 처리를 Include 스크립트에 공통 함수로 만들어두면 중복 코드를 줄일 수 있습니다.

```javascript
// Include Script (cmn_common.xjs)
var ERR_SESSION_EXPIRED = -200;
var ERR_NO_AUTH         = -403;

function cmn_handleError(svcId, errCode, errMsg) {
    if (errCode === ERR_SESSION_EXPIRED) {
        cmn_sessionExpired();
        return true; // 처리 완료 신호
    }
    if (errCode === ERR_NO_AUTH) {
        alert("접근 권한이 없습니다.");
        return true;
    }
    if (errCode !== 0) {
        alert("[오류] " + errMsg);
        return true;
    }
    return false; // 오류 없음
}

// 각 콜백에서 한 줄로 처리
function fn_searchCb(svcId, errCode, errMsg) {
    if (cmn_handleError(svcId, errCode, errMsg)) return;
    // 정상 처리
}

function fn_saveCb(svcId, errCode, errMsg) {
    if (cmn_handleError(svcId, errCode, errMsg)) return;
    alert("저장되었습니다."); fn_search();
}
```

## 오류 메시지 UX 고려사항

좋은 오류 메시지는 다음 요소를 포함합니다.

- **무슨 일이 발생했는지**: "저장 중 오류가 발생했습니다."
- **사용자가 할 수 있는 행동**: "다시 시도하거나 관리자에게 문의하세요."
- **기술적 세부사항(선택)**: 개발/테스트 환경에서만 `[ERR-500] ...` 형태로 추가

```javascript
function fn_saveCb(svcId, errCode, errMsg) {
    if (errCode !== 0) {
        // 운영: 사용자 친화적 메시지
        var sUserMsg = "저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";

        // 개발: 기술 정보 포함
        if (g_bDevMode) {
            sUserMsg += "\n[" + errCode + "] " + errMsg;
        }
        alert(sUserMsg);
        return;
    }
    // ...
}
```

## 오류 처리 체크리스트

```
✅ 모든 트랜잭션 콜백에 errCode 체크
✅ 세션 만료 코드 별도 분기 처리
✅ 에러 처리 후 반드시 return
✅ 콜백 최상단에 에러 체크 배치
✅ 공통 오류 처리 함수로 중복 제거
✅ Application 레벨 ontransactionerror 등록
✅ try-catch는 스크립트 예외에만 사용
✅ trace()로 오류 정보 로깅 (운영에선 제거)
```

이번 배치에서 이벤트 시스템부터 스크립트 오류 처리까지 핵심 개념을 모두 다뤘습니다. 다음 배치에서는 트랜잭션 패턴을 심층적으로 살펴봅니다.

---

**지난 글:** [네이밍 컨벤션 완전 정리](/posts/nexacro-n-naming-conventions/)

<br>
읽어주셔서 감사합니다. 😊
