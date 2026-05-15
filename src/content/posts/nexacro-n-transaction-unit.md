---
title: "[Nexacro N] 트랜잭션 단위 설계"
description: "Nexacro N에서 transaction()을 어느 시점에, 어떤 단위로 끊을지 결정하는 기준—단건 즉시 저장, 멀티 행 일괄, 멀티 Dataset 동시 전송—을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 2
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "transaction", "트랜잭션단위", "멀티Dataset", "savePoint", "설계"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-multi-row-save/)에서 멀티 행 저장 패턴을 다뤘다. 이번에는 더 근본적인 질문인 **"언제, 어떤 단위로 transaction()을 호출해야 하는가"**를 설계 관점에서 정리한다. 잘못된 트랜잭션 단위는 불필요한 서버 요청을 늘리거나, 반대로 하나의 요청에 너무 많은 책임을 몰아넣어 오류 추적을 어렵게 만든다.

## 세 가지 트랜잭션 단위 패턴

![트랜잭션 단위 설계 패턴](/assets/posts/nexacro-n-transaction-unit-design.svg)

### 패턴 A — 단건 즉시 저장

사용자가 특정 행을 편집하는 즉시, 또는 토글·체크박스를 클릭하는 즉시 서버에 반영하는 패턴이다. 화면에 저장 버튼이 별도로 없다.

```javascript
function grd_status_oncelldblclick(obj, e) {
    // 행 상태 토글 후 즉시 저장
    var nRow = e.row;
    var sStatus = this.ds_list.getColumn(nRow, "status");
    this.ds_list.setColumn(nRow, "status",
        sStatus == "Y" ? "N" : "Y");

    this.transaction("updateStatus",
        "svc/updateStatus.do",
        "in:ds_req=ds_list",
        "", "fn_statusCb"
    );
}
```

사용 시나리오: 승인/반려 토글, 읽음 표시, 즐겨찾기. 빈번한 요청이 부담이므로 경량 API 엔드포인트와 매칭해야 한다.

### 패턴 B — 멀티 행 일괄 저장

그리드에서 여러 행을 INSERT·UPDATE·DELETE한 뒤 저장 버튼을 눌러 한 번에 전송한다. 앞선 글에서 다룬 `fn_multiSave()` 패턴이 여기에 해당한다.

```javascript
// getRowCount("A")로 변경 행 확인 후 transaction() 한 번
var nCnt = this.ds_list.getRowCount("A");
if (nCnt == 0) { alert("변경 없음"); return; }
this.transaction("saveList", "svc/saveList.do",
    "in:ds_list=ds_list", "", "fn_saveCb");
```

서버 요청이 최소화되어 네트워크 비용이 낮다. 단, 저장 도중 브라우저를 닫으면 미저장 데이터가 손실되므로 `beforeunload` 이벤트에 경고를 추가하는 것이 좋다.

### 패턴 C — 멀티 Dataset 동시 전송

주문 헤더와 주문 아이템처럼 **부모-자식 관계**에 있는 Dataset을 하나의 `transaction()` 호출로 묶어 서버에 전송한다.

![멀티 Dataset 트랜잭션 코드](/assets/posts/nexacro-n-transaction-unit-code.svg)

```javascript
this.transaction(
    "saveOrder",
    "svc/order/save.do",
    "in:ds_hdr=ds_header in:ds_itm=ds_item",
    "",
    "fn_saveOrderCb"
);
```

서버 Adapter는 두 Dataset을 하나의 DB 트랜잭션으로 처리해야 한다. 어느 하나라도 실패 시 전체를 롤백해야 하기 때문이다.

## 트랜잭션 ID 명명 규칙

`transaction()`의 첫 번째 인자는 트랜잭션 ID로, 콜백 함수의 `sId` 파라미터로 전달된다. 화면 내에서 여러 `transaction()`을 하나의 콜백으로 처리할 때 분기 기준이 된다.

```javascript
function fn_commonCallback(sId, nEC, sEM) {
    if (nEC != 0) { alert(sEM); return; }
    switch (sId) {
        case "searchList" : this.fn_afterSearch(); break;
        case "saveList"   : this.ds_list.savePoint(); break;
        case "deleteItem" : this.fn_search(); break;
    }
}
```

트랜잭션 ID는 `동사 + 명사` 형식(`searchList`, `saveOrder`, `deleteItem`)으로 통일하면 스위치 분기가 명확해진다.

## 중복 호출 방지

저장 버튼을 빠르게 두 번 클릭하면 같은 데이터가 두 번 전송될 수 있다. 저장 버튼의 `enable` 속성을 활용해 막는다.

```javascript
function fn_save() {
    this.btn_save.enable = false; // 전송 시작 시 비활성화
    this.transaction("save", "svc/save.do",
        "in:ds_list=ds_list", "", "fn_saveCb");
}

function fn_saveCb(sId, nEC, sEM) {
    this.btn_save.enable = true; // 콜백 수신 후 재활성화
    if (nEC != 0) { alert(sEM); return; }
    this.ds_list.savePoint();
}
```

`transaction()`은 비동기이므로 콜백이 도착하기 전에 버튼이 다시 눌릴 수 있다. 전송 시작 직후 비활성화, 콜백 수신 후 재활성화가 표준 패턴이다.

## 저장 단위와 롤백 범위

| 패턴 | 서버 롤백 범위 | 권장 사용 |
|---|---|---|
| 단건 즉시 | 1행 | 상태 토글·체크박스 |
| 멀티 행 일괄 | N행 (같은 테이블) | 그리드 일괄 편집 |
| 멀티 Dataset | 여러 테이블 묶음 | 마스터-디테일 저장 |

트랜잭션 단위가 클수록 서버 부담은 줄지만 롤백이 발생했을 때 사용자가 재입력해야 할 데이터가 많아진다. 화면의 성격에 맞는 단위를 설계 단계에서 결정해야 한다.

---

**지난 글:** [[Nexacro N] 멀티 행 저장 패턴 완전 가이드](/posts/nexacro-n-multi-row-save/)

**다음 글:** [[Nexacro N] 유효성 검사 개요](/posts/nexacro-n-validation/)

<br>
읽어주셔서 감사합니다. 😊
