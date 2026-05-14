---
title: "[Nexacro N] 공유 이벤트 버스 패턴"
description: "Nexacro N에서 서로 다른 폼 간에 느슨하게 결합된 통신을 구현하는 이벤트 버스 패턴—application 객체 활용, gfn_on/gfn_emit 함수 설계—을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 8
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "이벤트버스", "폼간통신", "application객체", "gfn_on", "gfn_emit", "느슨한결합"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-form-template/)에서 폼 템플릿을 이용한 빠른 화면 생성 방법을 다루었다. 이번 글은 **공유 이벤트 버스** 패턴이다. 탭 프레임이나 팝업이 많은 Nexacro N 앱에서는 한 폼에서 일어난 일을 다른 폼에 알려야 할 때가 자주 있다. 이를 어떻게 설계하면 유지보수가 쉬운지 살펴본다.

## 폼 간 통신의 문제

업무 시스템에서 폼 간 통신이 필요한 대표 시나리오는 두 가지다.

1. **저장 후 목록 갱신**: 상세 폼에서 저장하면 옆의 목록 폼을 새로 조회
2. **선택 후 반영**: 팝업에서 항목을 선택하면 부모 폼의 필드에 값 채우기

두 번째 시나리오(팝업 콜백)는 다음 글에서 다루고, 이번 글에서는 첫 번째 시나리오—**서로 독립적인 폼이 데이터 변경을 서로에게 알리는 방법**—를 다룬다.

![폼 간 통신 패턴 비교](/assets/posts/nexacro-n-shared-event-bus-diagram.svg)

## 직접 참조 방식의 문제점

부모 폼이나 형제 폼에 직접 접근하는 코드는 폼 구조에 강하게 결합된다.

```javascript
// 직접 참조 — 위험한 패턴
function fn_saveCb(sId, nEC, sEM) {
    if (nEC != 0) { gfn_alert(sEM); return; }
    // 부모 폼의 SCR001을 직접 참조
    parent.SCR001.fn_search(); // SCR001 이름이 바뀌면 오류
}
```

폼 이름이 바뀌거나, 레이아웃이 바뀌어 부모-자식 관계가 달라지면 이 코드는 런타임 오류를 낸다.

## application 객체로 데이터 공유

더 안전한 방법은 `application` 객체를 공유 저장소로 사용하는 것이다. 발행자는 값을 `application`에 쓰고, 구독자는 `Form_onactivate`에서 읽는다.

```javascript
// 저장 완료 폼 — application에 플래그 기록
function fn_saveCb(sId, nEC, sEM) {
    if (nEC != 0) { gfn_alert(sEM); return; }
    application.gv_orderRefresh = true; // 갱신 필요 신호
    this.close();
}

// 목록 폼 — 활성화될 때마다 플래그 체크
function Form_onactivate(obj, e) {
    if (application.gv_orderRefresh) {
        application.gv_orderRefresh = false;
        this.fn_search();
    }
}
```

이 방법은 구현이 간단하지만, 플래그 변수가 많아지면 `application` 오염이 심해진다.

## 이벤트 버스 패턴 구현

더 체계적인 방법은 `application` 객체 위에 간단한 이벤트 버스를 구현하는 것이다.

![application 객체 기반 이벤트 버스 구현](/assets/posts/nexacro-n-shared-event-bus-code.svg)

```javascript
// gfn_eventbus.xjs — 전역 이벤트 버스
application._bus = {};

function gfn_on(eventName, handler) {
    if (!application._bus[eventName]) {
        application._bus[eventName] = [];
    }
    application._bus[eventName].push(handler);
}

function gfn_off(eventName, handler) {
    var handlers = application._bus[eventName];
    if (!handlers) return;
    for (var i = handlers.length - 1; i >= 0; i--) {
        if (handlers[i] === handler) handlers.splice(i, 1);
    }
}

function gfn_emit(eventName, data) {
    var handlers = application._bus[eventName];
    if (!handlers) return;
    for (var i = 0; i < handlers.length; i++) {
        handlers[i](data);
    }
}
```

## 업무 폼에서 이벤트 버스 사용

```javascript
// SCR002_주문목록.xfdl — 이벤트 구독
function fn_init() {
    var self = this;
    gfn_on("orderSaved", function(data) {
        self.fn_search(); // 주문 저장 이벤트 수신 시 재조회
    });
    this.fn_search();
}

// SCR001_주문등록.xfdl — 이벤트 발행
function fn_saveCb(sId, nEC, sEM) {
    if (nEC != 0) { gfn_alert(sEM); return; }
    this.ds_input.savePoint();
    gfn_alert("저장이 완료되었습니다.");
    gfn_emit("orderSaved", { orderId: this.ds_input.getColumn(0, "order_id") });
}
```

SCR001은 SCR002의 존재를 몰라도 된다. SCR002가 세 개로 늘어나도 SCR001 코드는 변경할 필요가 없다.

## 구독 해제(gfn_off) 주의사항

폼이 닫힐 때 구독을 해제하지 않으면 이미 닫힌 폼의 핸들러가 계속 실행되어 오류가 발생할 수 있다.

```javascript
// SCR002 — 폼 종료 시 구독 해제
var _handler_orderSaved;

function fn_init() {
    var self = this;
    _handler_orderSaved = function(data) { self.fn_search(); };
    gfn_on("orderSaved", _handler_orderSaved);
}

function Form_onunload(obj, e) {
    gfn_off("orderSaved", _handler_orderSaved);
}
```

핸들러를 변수로 저장해 두어야 `gfn_off`에서 정확히 제거할 수 있다.

## 실용적인 선택 기준

이벤트 버스는 강력하지만 디버깅이 어렵다. 이벤트가 어디서 발행되고 어디서 처리되는지 추적이 쉽지 않기 때문이다. 단순한 부모-자식 통신(팝업 결과 반환)에는 다음 글에서 다룰 팝업 콜백 패턴이 더 적합하다.

이벤트 버스는 **수평 관계의 독립 폼들이 같은 데이터 변경에 반응해야 할 때** 사용하는 것이 적절하다.

---

**지난 글:** [[Nexacro N] 폼 템플릿 활용 — 빠른 업무 화면 생성](/posts/nexacro-n-form-template/)

**다음 글:** [[Nexacro N] 팝업 기초 — openPopup과 팝업 생명주기](/posts/nexacro-n-popup/)

<br>
읽어주셔서 감사합니다. 😊
