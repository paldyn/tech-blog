---
title: "[Nexacro N] 팝업 파라미터 전달과 수신"
description: "Nexacro N에서 팝업에 파라미터를 전달하는 세 가지 방법(extraData, 전역 변수, Dataset 공유)과 팝업에서 opener.getArgs()로 수신하는 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 10
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "팝업파라미터", "openPopup", "extraData", "getArgs", "returnValue", "팝업인자"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-popup/)에서 팝업의 기본 구조와 생명주기를 살펴보았다. 이번 글은 **팝업에 파라미터를 전달하고 수신하는 방법**을 다룬다. "조회 모드로 열기", "수정 대상 키값 전달", "기본 조건 전달" 등 업무 로직에 따라 팝업 동작을 다르게 만들 때 파라미터 전달이 필요하다.

## 파라미터 전달 세 가지 방법

Nexacro N에서 팝업에 데이터를 전달하는 방법은 크게 세 가지다.

| 방법 | 장점 | 단점 |
|---|---|---|
| `openPopup` extraData | 가장 명확, 팝업별 독립 | 객체만 전달 가능 |
| 전역 변수(`application`) | 어느 팝업에서도 접근 | 변수 오염, 타이밍 주의 |
| Dataset 공유(`application.gds_xxx`) | 대용량 데이터 전달 | 팝업 종료 후 정리 필요 |

실무에서는 **extraData**가 가장 권장된다. 명확하고 팝업 인스턴스에 묶여 있어 여러 팝업을 동시에 열어도 데이터가 섞이지 않는다.

![팝업 파라미터 전달 흐름](/assets/posts/nexacro-n-popup-args-flow.svg)

## extraData 전달 방법

`openPopup`의 마지막 인자로 객체를 전달하면 팝업에서 `getArgs()`로 받을 수 있다.

![팝업 파라미터 전달 코드](/assets/posts/nexacro-n-popup-args-code.svg)

```javascript
// 부모 폼 — extraData로 파라미터 전달
function fn_openOrderPop(row) {
    var args = {
        orderNo: this.ds_list.getColumn(row, "order_no"),
        mode: "E",  // "E": 수정, "R": 읽기 전용
        custCd: this.ds_list.getColumn(row, "cust_cd")
    };
    this.openPopup(
        "POP_ORDER",
        "popup/POP_Order.xfdl",
        "fn_popOrderClose",
        700, 500,
        args  // extraData
    );
}

// 부모 폼 — 팝업 닫힘 콜백
function fn_popOrderClose(obj, e) {
    var rv = obj.returnValue;
    if (!rv || rv.result !== "ok") return;
    // 저장 완료 → 목록 재조회
    this.fn_search();
}
```

## 팝업 폼에서 인자 수신

팝업 폼의 `Form_onload`에서 `this.opener.팝업ID.getArgs()`로 인자를 받는다.

```javascript
// POP_Order.xfdl

var m_args;  // 폼 레벨 변수에 저장해 두면 fn_search 등에서도 사용 가능

function Form_onload(obj, e) {
    // 부모 폼의 팝업 인스턴스로 인자 수신
    m_args = this.opener.POP_ORDER.getArgs();

    var orderNo = m_args.orderNo;
    var mode    = m_args.mode;

    // 읽기 전용 모드면 저장 버튼 숨기기
    if (mode === "R") {
        this.btn_save.set_visible(false);
        this.btn_delete.set_visible(false);
    }

    if (orderNo) {
        this.fn_searchDetail(orderNo);
    } else {
        // 신규 입력 모드
        this.ds_order.addRow();
    }
}

function fn_searchDetail(orderNo) {
    this.ds_cond.clearData();
    this.ds_cond.addRow();
    this.ds_cond.setColumn(0, "order_no", orderNo);
    this.transaction(
        "searchDetail",
        "/order/getDetail.do",
        "in:ds_cond=ds_cond",
        "out:ds_order=detail",
        "fn_searchDetailCb",
        false
    );
}

function fn_save() {
    // 저장 후 결과 반환
    this.transaction(
        "save",
        "/order/save.do",
        "in:ds_order=ds_order",
        "",
        "fn_saveCb",
        false
    );
}

function fn_saveCb(sId, nEC, sEM) {
    if (nEC != 0) { gfn_alert(sEM); return; }
    gfn_alert("저장이 완료되었습니다.");
    this.returnValue = { result: "ok" };
    this.close();
}
```

## 팝업 ID와 getArgs 주의사항

`this.opener.POP_ORDER.getArgs()` 에서 `POP_ORDER`는 부모 폼이 `openPopup` 첫 번째 인자로 전달한 팝업 인스턴스 ID다. 팝업 ID가 일치하지 않으면 `null` 을 반환하거나 오류가 발생한다.

```javascript
// 부모가 이 ID로 열었다면
this.openPopup("POP_ORDER", ...);

// 팝업에서도 같은 ID로 수신해야 함
var args = this.opener.POP_ORDER.getArgs();
// 주의: this.opener.POP_order 또는 this.opener.pop_order 는 null
```

ID는 대소문자를 구분하므로, 팀 컨벤션으로 팝업 ID 규칙을 정해 두는 것이 좋다.

## Dataset을 extraData로 전달

대용량 데이터는 Dataset 레퍼런스를 전달하는 것보다 `application`에 Dataset을 붙이는 방법이 안전하다. extraData는 단순 객체(JSON-like)를 전달하는 용도가 적합하며, Dataset 자체를 extraData에 직접 담으면 예상치 못한 동작이 발생할 수 있다.

```javascript
// Dataset 공유가 필요한 경우 — application 경유
application.addChild("gds_popInput", this.ds_selected);
this.openPopup("POP_BATCH", "popup/POP_Batch.xfdl", "cb", 600, 500);

// 팝업에서 수신
var ds = application.gds_popInput;
```

팝업이 닫힌 후에는 `application.removeChild("gds_popInput")`으로 정리한다.

## 파라미터 유효성 체크

팝업 폼은 항상 인자가 있다고 가정하지 말고, 없을 경우 기본값을 사용하거나 신규 입력 모드로 동작하도록 설계한다.

```javascript
function Form_onload(obj, e) {
    var rawArgs = this.opener.POP_ORDER.getArgs();
    m_args = rawArgs || {};  // null 방어

    var orderNo = m_args.orderNo || "";
    var mode    = m_args.mode    || "N"; // 기본 신규(New)

    if (orderNo) {
        this.fn_searchDetail(orderNo);
    } else {
        this.ds_order.addRow();
    }
}
```

파라미터 전달과 수신의 패턴이 팀 내에서 표준화되면, 팝업을 새로 만들 때도 템플릿으로부터 시작해 인자 수신 코드를 빠르게 채울 수 있다.

---

**지난 글:** [[Nexacro N] 팝업 기초 — openPopup과 팝업 생명주기](/posts/nexacro-n-popup/)

<br>
읽어주셔서 감사합니다. 😊
