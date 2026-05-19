---
title: "[Nexacro N] 이벤트 핸들러 정리와 메모리 관리"
description: "Nexacro N에서 이벤트 핸들러를 올바르게 등록하고 해제하는 방법을 설명합니다. addEventHandler/removeEventHandler, 타이머 정리, 전역 이벤트 해제 패턴을 실무 코드와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 3
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "이벤트핸들러", "메모리관리", "addEventHandler", "removeEventHandler", "타이머"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-paint-optimization/)에서 렌더링 최적화 패턴을 다루었다. 성능 문제 중에서 렌더링만큼 흔하게 발생하는 또 다른 원인은 **이벤트 핸들러 누수**다. 폼을 닫아도 정리되지 않은 핸들러가 남아 계속 실행되고, 폼을 반복해서 열다 보면 핸들러가 중복 등록되어 같은 이벤트에 함수가 두 번, 세 번 호출되는 버그가 생긴다. 이를 원천 차단하는 패턴을 정리한다.

## 이벤트 핸들러 누수란

Studio에서 컴포넌트의 이벤트 속성에 함수를 직접 연결하는 방식은 폼이 닫힐 때 자동으로 해제된다. 하지만 스크립트에서 `addEventHandler()`로 동적으로 등록한 핸들러, `application.addEventHandler()`로 등록한 전역 핸들러, `setInterval/setTimeout`으로 만든 타이머는 **폼이 닫혀도 자동으로 해제되지 않는다.**

이런 핸들러들이 해제되지 않으면:
- 폼을 닫은 후에도 메모리에 남아 GC 대상이 되지 않는다
- 전역 이벤트 핸들러는 다른 폼에서 이벤트가 발생해도 계속 호출된다
- 타이머는 계속 실행되어 불필요한 Transaction을 유발한다
- 폼을 다시 열면 같은 핸들러가 중복 등록되어 중복 호출이 발생한다

![이벤트 핸들러 등록 / 해제 사이클](/assets/posts/nexacro-n-event-handler-cleanup-lifecycle.svg)

## 기본 원칙: onload 등록 → onunload 해제

Nexacro N에서의 황금 법칙은 하나다. **`form_onload`에서 등록한 것은 `form_onunload`에서 해제한다.** 이 쌍을 항상 함께 작성하는 습관이 메모리 누수를 원천 차단한다.

![이벤트 핸들러 등록·해제 코드 패턴](/assets/posts/nexacro-n-event-handler-cleanup-code.svg)

```javascript
// form_onload
function form_onload(obj, e) {
    // 동적 이벤트 핸들러 등록
    application.addEventHandler("onkeydown", "fnGlobalKey", this);
    this.dsMain.addEventHandler("onchanged", "fnOnChanged", this);

    // 타이머 등록 및 ID 저장
    this.nTimerId = setInterval(this.id + ".fnPoll()", 3000);
}

// form_onunload
function form_onunload(obj, e) {
    // 전역 핸들러 해제
    application.removeEventHandler("onkeydown", "fnGlobalKey", this);
    this.dsMain.removeEventHandler("onchanged", "fnOnChanged", this);

    // 타이머 해제
    if (this.nTimerId != null && this.nTimerId != -1) {
        clearInterval(this.nTimerId);
        this.nTimerId = -1;
    }
}
```

`removeEventHandler()`의 세 번째 인자(핸들러 객체)는 `addEventHandler()`에서 전달한 객체와 정확히 일치해야 한다. `this`로 등록했다면 해제할 때도 `this`다.

## 중복 등록 방지

팝업처럼 반복해서 열고 닫히는 폼에서는 `onload`가 여러 번 호출될 수 있다. 이 경우 이벤트 핸들러가 중복 등록될 위험이 있다. 등록 전에 먼저 해제하는 패턴으로 방어한다.

```javascript
function form_onload(obj, e) {
    // 혹시 남아있을 핸들러를 먼저 제거 (중복 방지)
    application.removeEventHandler("onkeydown", "fnGlobalKey", this);
    // 그 후 새로 등록
    application.addEventHandler("onkeydown", "fnGlobalKey", this);
}
```

이렇게 하면 이미 등록된 핸들러가 있더라도 제거 후 새로 등록하므로 중복 호출이 발생하지 않는다. `removeEventHandler`는 등록되지 않은 핸들러를 해제하려 해도 오류가 발생하지 않으므로 안전하게 사용할 수 있다.

## 전역 키 핸들러 패턴

F5 저장, F3 조회 같은 전역 단축키를 폼별로 다르게 처리해야 할 때 `application.addEventHandler`를 쓴다. 이 핸들러는 특히 해제에 신경 써야 한다. 폼 A에서 등록한 전역 키 핸들러가 폼 A를 닫은 후에도 남아있으면, 폼 B에서 F5를 눌렀을 때 폼 A의 저장 로직이 엉뚱하게 실행된다.

```javascript
function form_onload(obj, e) {
    // 이전 핸들러 정리 후 등록
    application.removeEventHandler("onkeydown", "fnKeyHandler", this);
    application.addEventHandler("onkeydown", "fnKeyHandler", this);
}

function fnKeyHandler(obj, e) {
    // 현재 활성 폼이 자신일 때만 처리
    if (application.activeform != this) return;

    if (e.keycode === 116) { // F5
        this.fnSearch();
        e.cancelBubble = true;
    }
}

function form_onunload(obj, e) {
    application.removeEventHandler("onkeydown", "fnKeyHandler", this);
}
```

## 타이머 관리

`setInterval`로 폴링을 구현할 때 타이머 ID를 반드시 저장하고, `form_onunload`에서 `clearInterval`로 해제한다. 타이머 ID를 폼 변수(스크립트 변수)로 저장하면 폼마다 독립적으로 관리할 수 있다.

```javascript
var nPollTimer = -1;

function fnStartPolling() {
    // 중복 방지: 기존 타이머 먼저 해제
    if (nPollTimer != -1) {
        clearInterval(nPollTimer);
    }
    nPollTimer = setInterval(this.id + ".fnPoll()", 5000);
}

function fnStopPolling() {
    if (nPollTimer != -1) {
        clearInterval(nPollTimer);
        nPollTimer = -1;
    }
}

function form_onunload(obj, e) {
    fnStopPolling();
}
```

`setTimeout`으로 지연 실행을 구현할 때도 마찬가지다. 폼이 닫힌 후에 콜백이 실행되면 이미 소멸한 컴포넌트에 접근해 오류가 발생한다.

```javascript
var nDelayTimer = -1;

function fnDelayedAction() {
    // 기존 타이머 취소
    if (nDelayTimer != -1) clearTimeout(nDelayTimer);
    nDelayTimer = setTimeout(this.id + ".fnExecute()", 500);
}

function form_onunload(obj, e) {
    if (nDelayTimer != -1) {
        clearTimeout(nDelayTimer);
        nDelayTimer = -1;
    }
}
```

## Dataset 이벤트 핸들러

Dataset의 `onchanged`, `onrowposchanged` 등도 스크립트에서 `addEventHandler()`로 등록하면 수동으로 해제해야 한다. Studio의 속성 패널에서 연결한 이벤트는 걱정하지 않아도 된다.

```javascript
function form_onload(obj, e) {
    // 공통 Dataset(dsComboCode)에 핸들러 등록
    dsComboCode.addEventHandler("onload", "fnOnComboLoaded", this);
}

function fnOnComboLoaded(obj, e) {
    // 콤보 데이터 로드 완료 후 처리
    this.fnInitCombo();
    // 이 핸들러가 한 번만 실행되어야 한다면 직접 해제
    dsComboCode.removeEventHandler("onload", "fnOnComboLoaded", this);
}

function form_onunload(obj, e) {
    // 혹시 해제되지 않았을 경우를 위한 안전망
    dsComboCode.removeEventHandler("onload", "fnOnComboLoaded", this);
}
```

## WebSocket 연결 해제

WebSocket을 사용하는 화면에서는 소켓 연결을 반드시 닫아야 한다.

```javascript
var oWs = null;

function form_onload(obj, e) {
    oWs = new WebSocket("wss://example.com/ws");
    oWs.onmessage = function(e) {
        // 메시지 처리
    };
}

function form_onunload(obj, e) {
    if (oWs != null) {
        oWs.close();
        oWs = null;
    }
}
```

## 공통 정리 함수로 묶기

핸들러 종류가 많아지면 `form_onunload`가 길어진다. 공통 정리 함수를 만들어 관리하면 빠뜨릴 가능성이 줄어든다.

```javascript
function fnCleanup() {
    // 전역 핸들러 해제
    application.removeEventHandler("onkeydown", "fnKeyHandler", this);
    // Dataset 핸들러 해제
    this.dsMain.removeEventHandler("onchanged", "fnOnChanged", this);
    // 타이머 해제
    if (nPollTimer != -1) { clearInterval(nPollTimer); nPollTimer = -1; }
    // WebSocket 해제
    if (oWs != null) { oWs.close(); oWs = null; }
}

function form_onunload(obj, e) {
    this.fnCleanup();
}
```

## 정리

이벤트 핸들러 누수는 증상이 뒤늦게 나타나서 원인을 찾기 어렵다. 전역 키 핸들러 중복 호출, 타이머가 계속 돌아가는 현상, 폼을 닫아도 줄지 않는 메모리 — 모두 핸들러를 해제하지 않아 발생한다. 등록과 해제를 항상 쌍으로 작성하는 습관 하나가 이 문제들 전부를 예방한다.

---

**지난 글:** [\[Nexacro N\] 화면 렌더링(Paint) 최적화](/posts/nexacro-n-paint-optimization/)

**다음 글:** [\[Nexacro N\] 메모리 누수 패턴과 진단](/posts/nexacro-n-memory-leak-patterns/)

<br>
읽어주셔서 감사합니다. 😊
