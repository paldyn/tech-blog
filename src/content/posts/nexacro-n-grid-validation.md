---
title: "[Nexacro N] 그리드 유효성 검사"
description: "Nexacro N 그리드에서 변경된 행(INSERT·UPDATE)만 순회하며 셀 단위로 필수값·범위 검사를 수행하고, 실패한 셀로 포커스를 이동하는 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 8
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "그리드검증", "grid", "validation", "rowType", "setCellPos"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-server-validation/)에서 서버 유효성 검사를 다뤘다. 이번에는 **그리드**에서 여러 행을 편집한 뒤 저장할 때 행별로 유효성을 검사하는 패턴을 정리한다. 단건 폼 검사와 달리 그리드는 행이 N개이고 변경 여부도 행마다 다르므로 순회 방식이 달라진다.

## 그리드 검사의 핵심 원칙

첫째, **변경된 행만 검사한다.** NORMAL 상태(변경 없음)와 DELETE 상태(삭제 예약)는 검사할 필요가 없다. INSERT와 UPDATE 행만 대상으로 한다.

둘째, **첫 번째 실패 행에서 즉시 중단한다.** 모든 오류를 한꺼번에 표시하는 것보다 첫 번째 오류를 사용자에게 명확히 알리고, 수정 후 다시 저장을 시도하는 흐름이 자연스럽다.

셋째, **실패한 셀로 포커스를 이동한다.** `grid.setCellPos(row, colName)` 또는 `grid.setCellPos(row, colIndex)`로 그리드의 특정 셀로 커서를 보낸다.

## 그리드 유효성 검사 전략

![그리드 유효성 검사 전략](/assets/posts/nexacro-n-grid-validation-flow.svg)

## fn_validateGrid() 구현

![그리드 검사 코드](/assets/posts/nexacro-n-grid-validation-code.svg)

```javascript
function fn_validateGrid(ds) {
    var nRowCnt = ds.getRowCount();
    for (var r = 0; r < nRowCnt; r++) {
        var t = ds.getRowType(r);
        // NORMAL·DELETE 행 건너뜀
        if (t == Dataset.ROWTYPE_NORMAL ||
            t == Dataset.ROWTYPE_DELETE) continue;

        // 품목명 필수 검사
        if (gfn_isNull(ds.getColumn(r, "item_nm"))) {
            alert((r + 1) + "행: 품목명은 필수 입력값입니다.");
            this.grd_order.setCellPos(r, "item_nm");
            return false;
        }

        // 수량 범위 검사 (1 이상)
        var qty = ds.getColumn(r, "qty");
        if (!gfn_checkFormat(qty, "int") ||
            !gfn_checkRange(qty, "num", 1, null)) {
            alert((r + 1) + "행: 수량은 1 이상의 정수여야 합니다.");
            this.grd_order.setCellPos(r, "qty");
            return false;
        }

        // 단가 범위 검사 (0 이상)
        var price = ds.getColumn(r, "unit_price");
        if (!gfn_checkRange(price, "num", 0, null)) {
            alert((r + 1) + "행: 단가는 0 이상이어야 합니다.");
            this.grd_order.setCellPos(r, "unit_price");
            return false;
        }
    }
    return true;
}
```

`Dataset.ROWTYPE_NORMAL`, `Dataset.ROWTYPE_INSERT`, `Dataset.ROWTYPE_UPDATE`, `Dataset.ROWTYPE_DELETE`는 Nexacro N의 상수로 `getRowType()` 반환값과 비교에 사용한다.

## fn_save()에서 그리드 검사 호출

```javascript
function fn_save() {
    if (!fn_validateGrid(this.ds_order)) return;

    this.transaction(
        "saveOrder",
        "svc/order/save.do",
        "in:ds_order=ds_order",
        "",
        "fn_saveCb"
    );
}
```

`fn_validateGrid()`가 `false`를 반환하면 `fn_save()`는 `return`으로 빠져나와 `transaction()`을 호출하지 않는다.

## setCellPos()로 그리드 셀 포커스 이동

`Grid.setCellPos(row, col)` 메서드는 그리드의 특정 셀을 활성화한다. `col` 파라미터는 컬럼명(문자열) 또는 컬럼 인덱스(숫자) 모두 허용한다.

```javascript
// 컬럼명으로 이동
this.grd_order.setCellPos(r, "item_nm");

// 컬럼 인덱스로 이동
this.grd_order.setCellPos(r, 1);

// 스크롤도 자동으로 해당 행/열로 이동됨
```

그리드가 여러 페이지로 나뉜 경우(`virtualscroll`), `setCellPos()`는 해당 행으로 스크롤도 자동 처리한다.

## 실시간 셀 검사 — oncellkillfocus

저장 버튼을 누르기 전에 셀 이탈 시점에서 즉시 검사하는 방법도 있다. `Grid.oncellkillfocus` 이벤트를 활용한다.

```javascript
function grd_order_oncellkillfocus(obj, e) {
    var r   = e.row;
    var col = e.col;

    if (col == obj.getColumnIndex("qty")) {
        var qty = this.ds_order.getColumn(r, "qty");
        if (!gfn_checkFormat(qty, "int") ||
            !gfn_checkRange(qty, "num", 1, null)) {
            alert("수량은 1 이상의 정수를 입력해 주세요.");
            obj.setCellPos(r, col);
        }
    }
}
```

`e.row`는 현재 행 인덱스, `e.col`은 현재 컬럼 인덱스다. 모든 컬럼에 적용하면 성능에 영향을 줄 수 있으므로 중요 컬럼만 대상으로 한다.

## 그리드 헤더 컬럼 필수 표시

필수 컬럼을 시각적으로 구분하려면 그리드 헤더 셀에 빨간 별표(`*`)를 텍스트로 추가하거나, 헤더 셀의 스타일을 변경한다.

```javascript
// 헤더 텍스트에 * 추가 (Studio에서 직접 설정 권장)
// grd_order.formats[0].columns[1].band[0].cells[0].text = "*품목명";
```

Studio의 그리드 Format Editor에서 헤더 텍스트를 `*품목명`으로 설정하고, `*`에 빨간 색상을 적용하면 가독성이 좋다.

---

**지난 글:** [[Nexacro N] 서버 유효성 검사 처리](/posts/nexacro-n-server-validation/)

**다음 글:** [[Nexacro N] 유효성 검사 공통 함수](/posts/nexacro-n-validation-common-fn/)

<br>
읽어주셔서 감사합니다. 😊
