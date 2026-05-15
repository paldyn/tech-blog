---
title: "[Nexacro N] 팝업 기초 — openPopup과 팝업 생명주기"
description: "Nexacro N에서 openPopup으로 팝업 폼을 여는 방법, 팝업 생명주기(onload → 조작 → close → 부모 콜백), Modal/Modeless 차이를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 9
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "팝업", "openPopup", "popup", "팝업생명주기", "returnValue", "Modal"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-shared-event-bus/)에서 폼 간 이벤트 버스 패턴을 살펴보았다. 이번 글부터는 **팝업** 을 본격적으로 다룬다. Nexacro N에서 팝업은 사용자 선택, 상세 입력, 확인 대화상자 등에 폭넓게 쓰인다. 팝업을 올바르게 사용하려면 생명주기를 이해하는 것이 먼저다.

## 팝업이란

Nexacro N의 팝업은 별도 `.xfdl` 폼 파일을 새 창(또는 레이어)으로 여는 방식이다. 부모 폼 위에 열리며, `close()` 호출로 닫힌다. 닫힐 때 `returnValue`를 통해 부모 폼에 결과를 전달한다.

![팝업 생명주기](/assets/posts/nexacro-n-popup-lifecycle.svg)

## openPopup 기본 구문

```javascript
// this.openPopup(팝업ID, 폼경로, 콜백함수명, 너비, 높이, [left, top, 스타일])
this.openPopup(
    "POP001",              // 팝업 인스턴스 ID
    "popup/POP001.xfdl",   // 팝업 폼 경로
    "pop_close_cb",        // 닫힘 콜백 함수명 (문자열)
    500, 400               // 팝업 너비, 높이 (px)
);
```

파라미터 설명:
- **팝업 ID**: 같은 폼을 여러 번 열 수 있어 고유 ID가 필요하다. 같은 ID로 열면 기존 팝업이 활성화된다.
- **폼 경로**: 프로젝트 루트 기준 상대 경로
- **콜백 함수명**: 팝업이 닫힐 때 부모 폼에서 실행되는 함수 이름 (문자열로 전달)
- **너비·높이**: 팝업 창의 크기 (px)

## 부모 폼 + 팝업 폼 코드 패턴

![openPopup 기본 코드 패턴](/assets/posts/nexacro-n-popup-code.svg)

```javascript
// 부모 폼 — 팝업 열기
function btn_search_onclick(obj, e) {
    this.openPopup(
        "POP_ITEM",
        "popup/POP_ItemSearch.xfdl",
        "pop_itemSearch_cb",
        600, 500
    );
}

// 부모 폼 — 팝업 닫힘 콜백
function pop_itemSearch_cb(obj, e) {
    var rv = obj.returnValue;
    if (!rv || rv.result !== "ok") return; // 취소 시 무시

    // 선택한 값을 현재 폼에 반영
    this.ds_order.setColumn(
        this.ds_order.rowposition,
        "item_cd", rv.itemCd
    );
    this.ds_order.setColumn(
        this.ds_order.rowposition,
        "item_nm", rv.itemNm
    );
}
```

## 팝업 폼 — Form_onload와 close

팝업 폼은 일반 업무 폼과 동일하게 `Form_onload`에서 초기화한다. `close()`를 호출하면 팝업이 닫히고 부모 폼의 콜백이 실행된다.

```javascript
// POP_ItemSearch.xfdl

function Form_onload(obj, e) {
    // 팝업 크기 맞춤
    this.move(0, 0, 600, 500);
    this.fn_search(); // 초기 데이터 로드
}

function fn_search() {
    this.transaction(
        "searchItem",
        "/item/getList.do",
        "in:ds_cond=ds_cond",
        "out:ds_item=list",
        "fn_searchCb",
        false
    );
}

function fn_searchCb(sId, nEC, sEM) {
    if (nEC != 0) { gfn_alert(sEM); return; }
}

// 그리드 더블클릭 — 즉시 선택
function grd_item_ondblclick(obj, e) {
    var row = obj.currentrow;
    this.returnValue = {
        result: "ok",
        itemCd: this.ds_item.getColumn(row, "item_cd"),
        itemNm: this.ds_item.getColumn(row, "item_nm")
    };
    this.close();
}

// 확인 버튼
function btn_ok_onclick(obj, e) {
    var row = this.grd_item.currentrow;
    if (row < 0) { gfn_alert("항목을 선택하세요."); return; }
    this.returnValue = {
        result: "ok",
        itemCd: this.ds_item.getColumn(row, "item_cd"),
        itemNm: this.ds_item.getColumn(row, "item_nm")
    };
    this.close();
}

// 취소 버튼 — returnValue 없이 닫기
function btn_cancel_onclick(obj, e) {
    this.close();
}
```

## Modal vs Modeless

| 구분 | Modal | Modeless |
|---|---|---|
| 부모 폼 조작 | 불가 (팝업이 닫힐 때까지) | 가능 |
| 사용 사례 | confirm 대화상자, 단건 입력 | 보조 정보 조회, 검색 지원 |
| 기본값 | `openPopup` 기본이 Modal | `openModelessPopup` 사용 |

Nexacro N에서 `openPopup`은 기본적으로 Modal로 동작한다. Modeless 팝업이 필요하면 `openModelessPopup` 메서드를 사용한다.

```javascript
// Modeless 팝업
this.openModelessPopup(
    "POP_HELP",
    "popup/POP_Help.xfdl",
    "pop_help_cb",
    400, 300
);
```

## 팝업 중복 열기 방지

같은 ID의 팝업을 다시 열면 기존 팝업이 포커스를 받는다. 이 동작은 일반적으로 원하는 동작이다. 단, 다른 ID로 같은 폼을 여러 개 열 수 있으므로 팝업 ID를 고정해 두면 중복 방지 효과가 있다.

```javascript
// 팝업이 이미 열려 있으면 포커스만 이동
this.openPopup("POP_ITEM", "popup/POP_ItemSearch.xfdl", "cb", 600, 500);
// 같은 ID "POP_ITEM"이 이미 열려 있으면 새로 열리지 않고 포커스만 이동
```

---

**지난 글:** [[Nexacro N] 공유 이벤트 버스 패턴](/posts/nexacro-n-shared-event-bus/)

**다음 글:** [[Nexacro N] 팝업 파라미터 전달과 수신](/posts/nexacro-n-popup-args/)

<br>
읽어주셔서 감사합니다. 😊
