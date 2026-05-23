---
title: "[Nexacro N] 트러블슈팅: 팝업 차단 문제"
description: "Nexacro N 애플리케이션에서 브라우저 팝업 차단이 발생하는 원인과 해결 패턴을 설명합니다. 비동기 콜백에서의 openPopup 호출 제약, 직접 액션 컨텍스트 유지 방법, 도메인 허용 설정을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 2
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "트러블슈팅", "팝업차단", "openPopup", "popup-blocker", "비동기", "window.open"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-troubleshoot-encoding/)에서 인코딩 문제를 다루었다. 이번에는 Nexacro N 프로젝트를 Chrome이나 Edge 같은 최신 브라우저 위에서 운영할 때 빈번하게 접수되는 **팝업 차단 문제**를 다룬다. Nexacro 14 시절에는 ActiveX로 팝업을 직접 제어했지만, Nexacro N의 HTML5 런타임은 브라우저의 팝업 정책을 그대로 따른다.

## 왜 팝업이 차단되는가

브라우저는 **사용자가 직접 수행한 액션(클릭·키 입력)**에서 유발된 `window.open` 호출만 허용한다. 비동기로 처리가 분리되면 그 컨텍스트는 소멸하고, 이후 호출되는 `window.open`은 차단 대상이 된다.

![팝업 차단 발생 메커니즘](/assets/posts/nexacro-n-troubleshoot-popup-blocked-flow.svg)

Nexacro의 `openPopup`·`open` 메서드는 내부적으로 `window.open`을 사용하므로, 동일한 규칙이 적용된다.

## 가장 흔한 원인: 트랜잭션 콜백

```javascript
// 잘못된 패턴 — 트랜잭션 콜백에서 팝업 호출
function fn_btnSearch_onclick(obj, e) {
    this.transaction(
        "svcGetInfo",
        "/service/getInfo",
        "",
        "dsResult=dsInfo",
        "",
        "fn_callbackOpen"  // 비동기 콜백
    );
}

function fn_callbackOpen(sId, nErrorCode, sErrorMsg) {
    if (nErrorCode >= 0) {
        // ✗ 이 시점은 사용자 클릭에서 분리된 비동기 컨텍스트
        this.openPopup("popDetail", "w=700&h=500");
    }
}
```

버튼 클릭에서 트랜잭션이 시작되고, 서버 응답 후 콜백이 실행된다. 이 콜백은 브라우저 관점에서 더 이상 "사용자 직접 액션"이 아니므로 팝업이 차단된다.

## 해결 패턴 A: 데이터를 먼저 받고, 팝업은 별도 클릭으로

트랜잭션과 팝업 오픈을 두 단계로 분리한다.

```javascript
// 1단계: 버튼 클릭 → 데이터 조회 (팝업 없음)
function fn_btnLoad_onclick(obj, e) {
    this.transaction(
        "svcGetInfo",
        "/service/getInfo",
        "",
        "dsResult=dsInfo",
        "",
        "fn_callbackLoad"
    );
}

function fn_callbackLoad(sId, nErrorCode, sErrorMsg) {
    if (nErrorCode >= 0) {
        // ✓ 팝업은 열지 않고 버튼 상태만 변경
        this.btn_openPopup.set_enable(true);
    }
}

// 2단계: 별도 버튼 클릭 → 팝업 오픈 (직접 액션)
function fn_btnOpenPopup_onclick(obj, e) {
    // ✓ 직접 액션 컨텍스트 — 차단 없음
    this.openPopup("popDetail", "w=700&h=500");
}
```

## 해결 패턴 B: 팝업에 필요한 인자를 클릭 시점에 이미 알고 있을 때

조회 없이 현재 선택 행의 값만 팝업에 넘기는 경우라면, 트랜잭션 없이 클릭 즉시 열 수 있다.

```javascript
function fn_btnDetail_onclick(obj, e) {
    var nRow = this.grd_list.getCurRow();
    if (nRow < 0) {
        alert("항목을 선택하세요.");
        return;
    }

    // 그리드에서 현재 행 데이터를 인자로 구성
    var sKey = this.ds_list.getColumn(nRow, "itemKey");
    var sName = this.ds_list.getColumn(nRow, "itemName");

    // ✓ 직접 액션 안에서 openPopup 호출
    this.openPopup(
        "popDetail",
        "itemKey=" + sKey + "&itemName=" + encodeURIComponent(sName)
    );
}
```

## 해결 패턴 C: openWindow 대신 div/layer 팝업 사용

`window.open` 기반 팝업 대신 폼 안의 레이어(Div)를 show/hide하면 브라우저 팝업 정책의 영향을 전혀 받지 않는다.

```javascript
// 레이어 팝업 — 비동기 콜백에서도 사용 가능
function fn_callbackOpen(sId, nErrorCode, sErrorMsg) {
    if (nErrorCode >= 0) {
        // ✓ div 레이어는 window.open이 아님 — 차단 없음
        this.div_popup.set_visible(true);
        this.div_popup.set_left(200);
        this.div_popup.set_top(150);
    }
}
```

단, 레이어 팝업은 부모 폼 DOM 안에 존재하므로 독립 창이 필요한 경우엔 적합하지 않다.

## 해결 패턴 D: 팝업 창을 미리 열고 내용만 업데이트

부득이하게 별도 창이 필요하다면, 클릭 즉시 빈 창을 열고 비동기 결과 수신 후 내용을 채우는 방법도 있다.

```javascript
var gv_popWin = null;

function fn_btnOpen_onclick(obj, e) {
    // ✓ 직접 액션에서 창 미리 오픈
    gv_popWin = window.open("", "popDetail", "width=700,height=500");
    gv_popWin.document.write("<p>Loading...</p>");

    this.transaction(
        "svcGetInfo", "/service/getInfo", "", "dsResult=dsInfo", "",
        "fn_callbackFill"
    );
}

function fn_callbackFill(sId, nErrorCode, sErrorMsg) {
    if (nErrorCode >= 0 && gv_popWin && !gv_popWin.closed) {
        // 이미 열린 창에 URL 교체 또는 내용 업데이트
        gv_popWin.location.href = "/popup/detail?key=" +
            this.ds_info.getColumn(0, "key");
    }
}
```

이 방식은 일부 브라우저에서 Cross-Origin 제약이 걸릴 수 있으므로, 같은 Origin 내에서만 사용한다.

## 해결 패턴 요약

![팝업 차단 해결 패턴](/assets/posts/nexacro-n-troubleshoot-popup-blocked-solutions.svg)

## 부득이한 경우: 브라우저 팝업 허용 도메인 등록

사내 배포 환경이라면 그룹 정책이나 브라우저 설정으로 특정 도메인을 팝업 허용 목록에 추가할 수 있다.

```
Chrome: 설정 → 개인 정보 보호 및 보안 → 사이트 설정 → 팝업 및 리디렉션 → 허용 목록에 추가
예: https://erp.company.intranet
```

단, 이는 사용자 또는 관리자가 직접 설정해야 하므로 코드 수준의 해결책이 아니다. 외부 사용자 환경에는 적용할 수 없다.

## 진단 팁

팝업 차단은 브라우저 콘솔에 다음과 같은 메시지로 나타난다.

```
The following error originated from a script:
Pop-up window creation failed because the request was not triggered
by user activation.
```

또는 Chrome DevTools의 콘솔 탭에서 `window.open` 반환값이 `null`인지 확인한다.

```javascript
var popWin = window.open("...");
if (popWin === null) {
    // 팝업 차단됨 — 사용자에게 안내
    alert("팝업이 차단되었습니다. 브라우저 팝업 허용 설정을 확인해주세요.");
}
```

---

**지난 글:** [트러블슈팅: 인코딩 문제](/posts/nexacro-n-troubleshoot-encoding/)

<br>
읽어주셔서 감사합니다. 😊
