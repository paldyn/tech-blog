---
title: "[Nexacro N] 런타임 오류 디버깅 전략"
description: "Nexacro N에서 런타임 오류를 체계적으로 처리하는 방법을 설명합니다. try/catch/finally 패턴, application.onerror 전역 핸들러, 오류 리포팅, 방어적 코딩 기법을 실무 코드와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 9
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "런타임오류", "예외처리", "try-catch", "onerror", "디버깅"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-studio-debug-mode/)에서 Studio 디버거 활용법을 다루었다. 디버거는 개발 중 문제를 찾는 데 탁월하지만, 운영 환경에서 예상치 못한 오류가 발생했을 때는 다른 대비가 필요하다. 이번 글에서는 Nexacro N 스크립트에서 런타임 오류를 잡고, 사용자에게 적절히 알리며, 운영 환경에서 오류 내용을 기록하는 전략을 정리한다.

## Nexacro N의 런타임 오류 유형

Nexacro N 스크립트에서 발생하는 런타임 오류는 크게 세 가지로 나뉜다.

1. **스크립트 예외(Script Exception)**: `null` 객체에 접근하거나, 정의되지 않은 함수를 호출하는 등 JavaScript 예외
2. **Transaction 오류**: 서버 응답의 ErrorCode가 0이 아닌 경우
3. **컴포넌트 오류**: 존재하지 않는 컴포넌트에 접근하거나, 잘못된 속성 타입 전달

이 중 Transaction 오류는 콜백에서 `nErrorCode != 0` 조건으로 처리한다. 스크립트 예외와 컴포넌트 오류는 `try/catch`와 `application.onerror`로 대응한다.

## try / catch / finally 패턴

Nexacro N 스크립트는 JavaScript 기반이므로 `try/catch/finally` 구문이 그대로 동작한다.

![런타임 오류 처리 흐름](/assets/posts/nexacro-n-runtime-debug-flow.svg)

```javascript
function fnProcess() {
    this.btnProcess.set_enable(false);

    try {
        fnValidateInput();
        fnComputeValues();
        fnSubmit();
    } catch (e) {
        // 오류 정보 로그
        gfn_error("[fnProcess] " + e.name + ": " + e.message);
        alert("처리 중 오류가 발생했습니다.\n" + e.message);
    } finally {
        // 성공/실패 관계없이 항상 실행
        this.btnProcess.set_enable(true);
    }
}
```

`finally`의 핵심 용도는 **보장된 정리 작업**이다. 버튼 비활성화, `beginUpdate()` 호출, 로딩 표시 같은 것들은 예외가 발생해도 반드시 원상 복구해야 한다.

```javascript
function fnBatchUpdate() {
    this.dsList.beginUpdate();
    try {
        for (var i = 0; i < this.dsList.rowcount; i++) {
            fnProcessRow(i);
        }
    } catch (e) {
        gfn_error("배치 처리 오류: " + e.message);
    } finally {
        this.dsList.endUpdate(); // 예외 발생 시에도 반드시 호출
    }
}
```

## application.onerror — 전역 오류 핸들러

`try/catch`로 감싸지 않은 코드에서 예외가 발생하면 `application.onerror` 이벤트가 호출된다. 여기서 전역 차원의 오류를 잡아 처리할 수 있다.

![전역 오류 핸들러 + 오류 리포팅](/assets/posts/nexacro-n-runtime-debug-code.svg)

```javascript
// application.xfdl 스크립트
function application_onerror(obj, e) {
    // 오류 정보 구성
    var sInfo = ""
        + "Form: "    + (e.formid    || "unknown") + "\n"
        + "Message: " + (e.errormsg  || "unknown") + "\n"
        + "Line: "    + (e.lineno    || "unknown") + "\n"
        + "Time: "    + (new Date()).toISOString();

    gfn_error("[GLOBAL ERROR] " + sInfo);

    // 운영 환경에서 서버로 오류 리포트 전송
    if (LOG_LEVEL <= 2) {
        fnSendErrorReport(sInfo);
    }
}

function fnSendErrorReport(sInfo) {
    this.dsErrorReport.clearData();
    this.dsErrorReport.addRow();
    this.dsErrorReport.setColumn(0, "ERROR_MSG",  sInfo);
    this.dsErrorReport.setColumn(0, "USER_ID",    gfn_getLoginId());
    this.dsErrorReport.setColumn(0, "CLIENT_IP",  gfn_getClientIp());

    this.transaction("ERROR_REPORT", "/api/errorReport",
                     "dsErr=dsErrorReport:I", "", "", "");
}
```

`application_onerror`의 이벤트 객체(`e`)에서 사용 가능한 정보:
- `e.errormsg`: 오류 메시지
- `e.lineno`: 오류 발생 라인 번호
- `e.formid`: 오류가 발생한 폼 ID
- `e.colno`: 컬럼 번호 (지원 환경에 따라 다름)

## 방어적 코딩: null 체크

Nexacro N에서 가장 빈번한 런타임 오류는 `null` 또는 `undefined` 값에 메서드를 호출하는 것이다.

```javascript
// 나쁜 패턴: null 가능성 무시
function fnGetValue() {
    return this.grdList.getCellProperty("body", 0, 0, "value");
    // grdList가 없거나 행이 없으면 오류
}

// 좋은 패턴: 방어적 체크
function fnGetValue() {
    if (!this.grdList) {
        gfn_warn("grdList 컴포넌트를 찾을 수 없음");
        return null;
    }
    if (this.dsList.rowcount === 0) {
        return null;
    }
    return this.grdList.getCellProperty("body", 0, 0, "value");
}
```

Dataset에서 컬럼 값을 가져올 때도 행이 존재하는지 먼저 확인한다.

```javascript
function fnGetCurrentValue(sColId) {
    var ds = this.dsMain;
    if (ds.rowcount === 0) return null;
    var nRow = ds.rowposition;
    if (nRow < 0 || nRow >= ds.rowcount) return null;
    return ds.getColumn(nRow, sColId);
}
```

## typeof로 함수 존재 여부 확인

상속 또는 다형성 패턴에서 자식 폼이 함수를 구현했는지 확인할 때 `typeof`를 사용한다.

```javascript
// BaseForm에서 자식 폼의 훅 함수 호출
function fnBeforeSave() {
    // 자식 폼에 fnBeforeSaveHook이 있으면 호출, 없으면 skip
    if (typeof this.fnBeforeSaveHook === "function") {
        var bContinue = this.fnBeforeSaveHook();
        if (!bContinue) return false;
    }
    return true;
}
```

## 오류 메시지 표준화

사용자에게 보여주는 오류 메시지는 기술적 세부사항보다 행동 안내를 중심으로 작성한다.

```javascript
function cbSave(sId, nErrorCode, sErrorMsg) {
    if (nErrorCode != 0) {
        // 나쁜 예: 기술적 메시지 그대로 노출
        // alert(sErrorMsg);

        // 좋은 예: 사용자 친화적 메시지 + 로그
        gfn_error("[cbSave] err=" + nErrorCode + " msg=" + sErrorMsg);

        if (nErrorCode === -1001) {
            alert("세션이 만료됐습니다. 다시 로그인해 주세요.");
        } else if (nErrorCode === -2001) {
            alert("권한이 없습니다. 관리자에게 문의해 주세요.");
        } else {
            alert("저장에 실패했습니다. 잠시 후 다시 시도해 주세요.\n(오류코드: " + nErrorCode + ")");
        }
        return;
    }
    alert("저장이 완료됐습니다.");
}
```

## 운영 환경 오류 추적 체계

개발 환경에서는 `trace()`로 오류를 즉시 확인할 수 있지만, 운영 환경에서는 오류를 서버에 기록해야 한다.

```javascript
// 공통 오류 처리 + 리포팅 함수
function gfn_handleError(sContext, e) {
    var sMsg = "[" + sContext + "] " + (e.message || e) + " (line: " + (e.lineno || "?") + ")";

    // 개발: console 출력
    gfn_error(sMsg);

    // 운영: 서버 전송 (비동기, 실패해도 무시)
    try {
        application.fnSendErrorReport({
            context:  sContext,
            message:  e.message || String(e),
            formid:   (typeof this !== "undefined" && this.id) ? this.id : "unknown",
            time:     (new Date()).toISOString(),
            userid:   gfn_getLoginId()
        });
    } catch (reportErr) {
        // 리포팅 실패는 무시 (무한 루프 방지)
    }
}
```

## 정리

Nexacro N 런타임 오류 처리는 세 층위로 구성한다. 첫째, 예상 가능한 오류 구간은 `try/catch/finally`로 감싸고 `finally`에서 UI 상태를 복원한다. 둘째, `application.onerror`에서 `try/catch`를 벗어난 uncaught 예외를 잡아 로그를 남기고 운영 환경에서는 서버에 리포트한다. 셋째, 방어적 null 체크로 오류 발생 자체를 줄인다. 이 세 층위를 갖추면 예측 가능한 오류도, 예측 불가한 오류도 적절히 처리할 수 있다.

---

**지난 글:** [\[Nexacro N\] Studio 디버그 모드 활용](/posts/nexacro-n-studio-debug-mode/)

**다음 글:** [\[Nexacro N\] 스크립트 단위 테스트 전략](/posts/nexacro-n-script-unit-test/)

<br>
읽어주셔서 감사합니다. 😊
