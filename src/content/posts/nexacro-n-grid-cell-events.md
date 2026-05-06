---
title: "[Nexacro N] Grid 셀 이벤트 완전 정복"
description: "Nexacro N Grid의 oncellclick, oncellchange, oncelleditbegin/end, oncelldblclick 이벤트 발생 순서와 이벤트 객체(e.row, e.col, e.newvalue)를 활용하는 실전 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 2
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "grid", "oncellclick", "oncellchange", "oncelleditend", "셀이벤트"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-grid-edit-control/)에서 Grid의 edittype으로 셀 편집 컨트롤을 지정하는 방법을 살펴봤습니다. 편집 컨트롤이 갖춰졌다면, 다음 단계는 사용자가 셀을 클릭하고 값을 바꿀 때 발생하는 **이벤트들을 제어하는 것**입니다. 이번 글에서는 Grid 셀 이벤트의 발생 순서부터 이벤트 객체 활용, 실무 패턴까지 다룹니다.

## 셀 이벤트 종류 한눈에 보기

| 이벤트 | 발생 시점 | 주요 용도 |
|---|---|---|
| `oncellclick` | 셀 단일 클릭 | 버튼 셀 처리, 행 선택 로직 |
| `oncelldblclick` | 셀 더블클릭 | 상세 팝업 열기 |
| `oncelleditbegin` | 편집 컨트롤 활성화 직전 | 특정 조건에서 편집 차단 |
| `oncelleditend` | 편집 완료(포커스 이탈) | 유효성 검사, 편집 취소 |
| `oncellchange` | Dataset 값 실제 변경 | 연동 계산, 하위 목록 갱신 |
| `onrowposchanged` | 행 포커스 이동 | 선택 행 데이터 표시 |

![Grid 셀 이벤트 발생 흐름](/assets/posts/nexacro-n-grid-cell-events-flow.svg)

## 이벤트 객체(e) 주요 속성

모든 셀 이벤트 핸들러는 `(obj, e)` 두 인자를 받습니다. `obj`는 이벤트가 발생한 Grid 컴포넌트 자신, `e`는 이벤트 상세 정보를 담은 객체입니다.

```javascript
function grd_oncellclick(obj, e) {
    trace("row=" + e.row + ", col=" + e.col);
    trace("colId=" + obj.getColumnId(e.col));
    trace("value=" + obj.getCellData(e.row, e.col));
}
```

| 속성 | 타입 | 설명 |
|---|---|---|
| `e.row` | Number | 이벤트 발생 행 인덱스 (0부터) |
| `e.col` | Number | 이벤트 발생 컬럼 인덱스 |
| `e.newvalue` | String | 변경 후 값 (oncellchange/oncelleditend) |
| `e.oldvalue` | String | 변경 전 값 (oncellchange) |
| `e.cancel` | Boolean | true 설정 시 이벤트 취소 |

## oncellclick — 클릭 처리의 기본

셀을 한 번 클릭할 때마다 발생합니다. 가장 자주 쓰이는 패턴은 **버튼 열 분기**입니다. `getColumnIndex()`로 컬럼 ID를 인덱스로 변환해서 `e.col`과 비교합니다.

![oncellclick / oncellchange 실전 패턴](/assets/posts/nexacro-n-grid-cell-events-code.svg)

```javascript
function grd_oncellclick(obj, e) {
    var nBtnCol = obj.getColumnIndex("colSearch");
    if (e.col == nBtnCol) {
        fn_openPopup(e.row);
    }
}
```

여러 버튼 열이 있을 때는 `switch(obj.getColumnId(e.col))` 패턴으로 분기합니다.

## oncelleditbegin — 편집 시작 전 제어

특정 조건에서 편집을 막아야 할 때 사용합니다. 이 이벤트에서 `e.cancel = true`를 반환하면 편집 컨트롤이 열리지 않습니다.

```javascript
function grd_oncelleditbegin(obj, e) {
    var sStatus = ds.getColumn(e.row, "STATUS");
    if (sStatus == "CLOSED") {
        e.cancel = true; // 확정된 행은 편집 불가
    }
}
```

행 상태 컬럼 값에 따라 동적으로 편집을 허용/차단하는 패턴입니다. `edittype="none"` 속성으로 열 전체를 잠그는 것과 달리, 이 방식은 **행별** 제어가 가능합니다.

## oncelleditend — 유효성 검사와 편집 취소

편집이 완료되어 포커스가 이탈할 때 발생합니다. `e.newvalue`에 사용자가 입력한 값이 담겨 있고, `e.cancel = true`를 설정하면 Dataset에 값이 반영되지 않고 편집 상태가 원복됩니다.

```javascript
function grd_oncelleditend(obj, e) {
    if (obj.getColumnId(e.col) == "QTY") {
        var nQty = parseInt(e.newvalue || "0");
        if (isNaN(nQty) || nQty < 0) {
            alert("수량은 0 이상 정수를 입력하세요.");
            e.cancel = true;
        }
    }
}
```

## oncellchange — Dataset 값 변경 이후 연동

`oncellchange`는 Dataset에 값이 실제로 저장된 직후 발생합니다. `oncelleditend`와 달리 취소가 불가능하며, **변경 사실 이후에 해야 할 연동 계산**에 적합합니다.

```javascript
function grd_oncellchange(obj, e) {
    var sColId = obj.getColumnId(e.col);
    if (sColId == "QTY" || sColId == "PRICE") {
        // 수량 또는 단가 변경 시 금액 자동 계산
        var nQty   = ds.getColumn(e.row, "QTY");
        var nPrice = ds.getColumn(e.row, "PRICE");
        ds.setColumn(e.row, "AMT", nQty * nPrice);
    }
}
```

`oncellchange`에서 같은 행의 다른 컬럼 값을 `setColumn()`으로 바꿔도 무한 루프가 발생하지 않습니다. 단, 변경된 컬럼을 다시 바꾸면 재귀가 될 수 있으므로 주의합니다.

## oncelldblclick — 더블클릭 상세 팝업

행 전체를 대상으로 상세 화면을 열 때 더블클릭을 활용합니다.

```javascript
function grd_oncelldblclick(obj, e) {
    var sKey = ds.getColumn(e.row, "KEY_CD");
    fn_openDetail(sKey);
}
```

`oncellclick`과 `oncelldblclick`이 같은 셀에서 모두 설정되어 있으면, 더블클릭 시 `oncellclick`이 **먼저 두 번** 발생하고 그 다음 `oncelldblclick`이 발생합니다. 클릭 이벤트에서 특정 액션이 실행되면 의도치 않은 중복이 생길 수 있으므로, 더블클릭 전용 컬럼을 별도로 두는 것이 안전합니다.

## onrowposchanged — 행 이동 후 처리

Grid에서 포커스 행이 바뀔 때 발생합니다. 마스터-디테일 화면에서 상위 Grid의 행을 바꿀 때마다 하위 Grid를 재조회하는 패턴에 자주 씁니다.

```javascript
function grdMaster_onrowposchanged(obj, e) {
    var sMasterKey = dsMaster.getColumn(e.row, "MASTER_ID");
    fn_loadDetail(sMasterKey);
}
```

`e.row`에는 이동 **이후**의 행 인덱스가 담겨 있습니다. 이전 행 인덱스가 필요하다면 전역 변수에 보관해 두는 방식으로 대응합니다.

## 이벤트 등록 방법

이벤트는 디자인 타임에 속성 패널에서 등록하거나, 스크립트에서 동적으로 연결할 수 있습니다.

```javascript
// 동적 이벤트 연결
grd.oncellclick = fn_grdClick;
grd.oncellchange = fn_grdChange;

// 연결 해제
grd.oncellclick = null;
```

동적으로 연결하면 조건에 따라 이벤트를 활성화/비활성화할 수 있어, 편집 모드 전환 등의 시나리오에 유용합니다.

---

**지난 글:** [Grid EditControl — 셀 편집 컨트롤 완전 정복](/posts/nexacro-n-grid-edit-control/)

**다음 글:** [Grid 셀 유효성 검사](/posts/nexacro-n-grid-cell-validation/)

<br>
읽어주셔서 감사합니다. 😊
