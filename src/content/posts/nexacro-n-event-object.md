---
title: "[Nexacro N] 이벤트 객체(Event Object) 파헤치기"
description: "Nexacro N 이벤트 핸들러의 파라미터 obj와 e(이벤트 객체)의 속성과 활용법을 상세히 정리합니다. prevalue, postvalue, keycode, shiftkey 등 실무에서 자주 쓰는 속성을 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 3
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "event-object", "obj", "keycode", "prevalue", "onchanged"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-event-registration/)에서 이벤트를 등록하는 방법을 살펴봤습니다. 이번 글에서는 이벤트 핸들러가 호출될 때 전달되는 **두 파라미터 `obj`와 `e`**를 집중적으로 다룹니다. 이 두 객체를 잘 이해하면 컴포넌트 상태를 정확히 파악하고, 키보드 입력이나 값 변경에 정밀하게 대응할 수 있습니다.

## 핸들러 파라미터의 기본 구조

Nexacro N의 이벤트 핸들러는 기본적으로 두 개의 파라미터를 받습니다.

```javascript
this.btn_ok.onclick = function(obj, e) {
    // obj: 이벤트가 발생한 컴포넌트 (sender)
    // e  : 이벤트 상세 정보 객체
};
```

`obj`는 이벤트를 발생시킨 컴포넌트 자체를 가리킵니다. `e`는 이벤트 종류, 마우스 버튼 상태, 키 입력 정보, 값 변경 내역 등 이벤트에 관한 부가 정보를 담고 있습니다.

![이벤트 객체 주요 속성](/assets/posts/nexacro-n-event-object-properties.svg)

## obj 객체 활용

`obj`를 통해 이벤트가 발생한 컴포넌트의 속성을 읽고 변경할 수 있습니다. 동일한 핸들러를 여러 컴포넌트가 공유할 때 `obj.id`로 어느 컴포넌트에서 왔는지 판별합니다.

```javascript
// 하나의 핸들러를 여러 버튼이 공유
function btn_common_onclick(obj, e) {
    var sId = obj.id;

    if (sId === "btn_search") {
        fn_search();
    } else if (sId === "btn_save") {
        fn_save();
    } else if (sId === "btn_delete") {
        fn_delete();
    }
}

// Studio에서 각 버튼의 onclick을 모두 "btn_common_onclick"으로 설정
```

Grid 컴포넌트에서는 `obj`에 Grid 전용 속성이 추가됩니다.

```javascript
this.grd_list.oncellclick = function(obj, e) {
    var nRow = obj.currentrow;       // 클릭한 행 인덱스
    var nCol = obj.currentcol;       // 클릭한 열 인덱스
    var oDs  = obj.getBindDataset(); // 바인딩된 Dataset
    var sVal = oDs.getColumn(nRow, "PROD_NM");

    trace("클릭: " + nRow + "행, 값=" + sVal);
};
```

## e 객체 활용 — 변경 이벤트

`onchanged` 이벤트의 `e` 객체에는 변경 전후의 값이 담겨 있습니다. 값 유효성 검사나 연동 처리에 자주 활용합니다.

![이벤트 객체 실전 활용 코드](/assets/posts/nexacro-n-event-object-usage.svg)

```javascript
this.edt_qty.onchanged = function(obj, e) {
    var nPre  = e.prevalue;   // 변경 전 값
    var nPost = e.postvalue;  // 변경 후 값 (= obj.value)

    if (parseInt(nPost) < 0) {
        obj.value = nPre;  // 변경 전 값으로 복구
        alert("수량은 0 이상이어야 합니다.");
        return;
    }

    // 총액 재계산
    var nPrice = this.edt_price.value;
    this.edt_total.value = parseInt(nPost) * parseInt(nPrice);
};
```

`e.prevalue`와 `e.postvalue`는 문자열 타입이므로, 숫자 비교가 필요하면 `parseInt()` 또는 `parseFloat()`으로 변환해야 합니다.

## e 객체 활용 — 키보드 이벤트

`onkeydown` / `onkeyup` 이벤트의 `e` 객체에는 키코드와 보조키 상태가 담겨 있습니다.

```javascript
this.edt_search.onkeydown = function(obj, e) {
    // Enter 키 (keycode: 13) → 즉시 검색
    if (e.keycode === 13) {
        fn_search();
    }

    // Ctrl+A → 전체 선택 방지 (예시)
    if (e.ctrlkey && e.keycode === 65) {
        // keycode 65 = 'A'
        e.cancel = true;
    }
};
```

자주 사용하는 키코드 목록입니다.

| 키 | keycode |
|----|---------|
| Enter | 13 |
| Escape | 27 |
| Tab | 9 |
| F5 | 116 |
| Delete | 46 |
| Backspace | 8 |

## e 객체 활용 — 마우스 이벤트

마우스 이벤트에서는 어떤 버튼을 눌렀는지, 어느 위치인지를 알 수 있습니다.

```javascript
this.grd_list.onrclick = function(obj, e) {
    // 우클릭 컨텍스트 메뉴 표시
    if (e.rightbutton) {
        this.pop_context.trackPopupMenu(e.screenx, e.screeny);
    }
};
```

## Dataset 이벤트의 e 객체

Dataset의 `oncurrentchanged` 이벤트는 행 변경 정보를 제공합니다.

```javascript
this.dsList.oncurrentchanged = function(obj, e) {
    var nNewRow = e.newrow;  // 새로 선택된 행 인덱스
    var nOldRow = e.oldrow;  // 이전 행 인덱스

    trace("행 변경: " + nOldRow + " → " + nNewRow);

    // 디테일 조회
    fn_loadDetail(nNewRow);
};
```

## obj와 e를 활용한 범용 핸들러 패턴

대규모 프로젝트에서는 동일한 UI 패턴의 핸들러를 재사용하는 경우가 많습니다. `obj.id`로 컴포넌트를 구분하고, Dataset 메서드로 현재 행 값을 읽는 패턴을 공통 함수로 만들어두면 코드 중복을 줄일 수 있습니다.

```javascript
// 여러 Grid에서 공통으로 사용하는 더블클릭 핸들러
function cmn_gridDblClick(obj, e) {
    var oDs   = obj.getBindDataset();
    var nRow  = obj.currentrow;

    // 팝업 호출 또는 상세 조회
    var sKey  = oDs.getColumn(nRow, "KEY_CD");
    fn_openDetail(sKey);
}
```

이처럼 `obj`와 `e`를 잘 활용하면 컴포넌트별로 핸들러를 따로 만들지 않고도 다양한 상황에 대응할 수 있습니다. 다음 글에서는 핸들러 내부에서 `this`가 무엇을 가리키는지, 그리고 컨텍스트 문제를 어떻게 해결하는지 살펴봅니다.

---

**지난 글:** [이벤트 등록 방법 — Studio vs 스크립트](/posts/nexacro-n-event-registration/)

**다음 글:** [this 컨텍스트 이해와 활용](/posts/nexacro-n-this-context/)

<br>
읽어주셔서 감사합니다. 😊
