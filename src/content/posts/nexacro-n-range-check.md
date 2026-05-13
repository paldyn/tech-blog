---
title: "[Nexacro N] 범위 검사 구현"
description: "Nexacro N에서 숫자 범위·날짜 범위·문자열 길이·상호 의존성을 검사하는 gfn_checkRange() 공통 함수 구현과 실전 활용 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 6
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "범위검사", "gfn_checkRange", "날짜범위", "숫자범위", "validation"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-format-check/)에서 형식 검사를 구현했다. 이번에는 **범위 검사**를 다룬다. 값의 형식이 맞더라도 수량이 음수이거나 종료일이 시작일보다 빠르면 비즈니스 오류가 발생한다. 범위 검사는 이런 의미론적 오류를 클라이언트에서 사전에 차단한다.

## 범위 검사 유형

![범위 검사 유형](/assets/posts/nexacro-n-range-check-types.svg)

범위 검사는 네 가지 유형으로 나눌 수 있다.

**숫자 범위**: 수량, 금액, 나이 등 숫자 값이 지정된 최솟값과 최댓값 사이에 있는지 확인한다.

**날짜 범위**: YYYYMMDD 형식의 날짜 문자열을 문자열 비교로 순서를 확인한다. 날짜 형식이 일관되면 문자열 비교만으로 충분하다.

**문자열 길이**: 비고, 메모, 주소 등 가변 길이 텍스트가 DB 컬럼 크기를 초과하지 않는지 확인한다.

**상호 의존성**: 두 컬럼 값의 관계(시작일 ≤ 종료일, 최소수량 ≤ 최대수량)를 교차 검증한다.

## gfn_checkRange() 구현

![범위 검사 공통 함수](/assets/posts/nexacro-n-range-check-code.svg)

```javascript
// 공통 라이브러리
// sType: "num" | "date" | "len"
// vMin, vMax: null이면 해당 방향 제한 없음
function gfn_checkRange(vVal, sType, vMin, vMax) {
    var v = String(vVal);
    if (sType == "num") {
        var n = Number(v);
        return (vMin == null || n >= vMin) &&
               (vMax == null || n <= vMax);
    }
    if (sType == "date") {
        return (!vMin || v >= vMin) && (!vMax || v <= vMax);
    }
    if (sType == "len") {
        return (!vMin || v.length >= vMin) &&
               (!vMax || v.length <= vMax);
    }
    return true;
}
```

`vMin`이나 `vMax`에 `null`을 전달하면 해당 방향의 제한을 적용하지 않는다. 예를 들어 "0 이상"만 확인하려면 `gfn_checkRange(val, "num", 0, null)`로 호출한다.

## 숫자 범위 검사 적용

```javascript
function fn_save() {
    var ds = this.ds_input;
    var qty = ds.getColumn(0, "qty");

    // 형식 검사 먼저
    if (!gfn_checkFormat(qty, "int")) {
        alert("수량은 정수로 입력해 주세요.");
        this.edt_qty.setFocus();
        return;
    }
    // 범위 검사
    if (!gfn_checkRange(qty, "num", 1, 9999)) {
        alert("수량은 1 이상 9999 이하로 입력해 주세요.");
        this.edt_qty.setFocus();
        return;
    }
    this.transaction("save", "svc/save.do",
        "in:ds_input=ds_input", "", "fn_saveCb");
}
```

형식 검사와 범위 검사를 순서대로 수행해야 한다. 형식이 맞지 않으면 `Number("abc")`가 `NaN`이 되어 범위 비교가 의미 없어진다.

## 날짜 범위 검사 — 시작일·종료일 교차 검증

```javascript
function fn_checkDateRange(ds) {
    var sFrom = ds.getColumn(0, "from_dt");
    var sTo   = ds.getColumn(0, "to_dt");

    if (gfn_isNull(sFrom) || gfn_isNull(sTo)) return true;

    // YYYYMMDD 형식이면 문자열 비교로 순서 확인 가능
    if (sFrom > sTo) {
        alert("종료일은 시작일 이후여야 합니다.");
        this.edt_to_dt.setFocus();
        return false;
    }
    return true;
}
```

날짜가 YYYYMMDD 형식이면 문자열 대소 비교가 곧 날짜 순서 비교다. 혼재된 형식(일부는 YYYY-MM-DD, 일부는 YYYYMMDD)이 있으면 비교 전 하이픈을 제거해 형식을 통일한다.

## 문자열 길이 검사

DB의 VARCHAR(100) 컬럼에 맞게 100자를 초과하는지 확인한다.

```javascript
var remark = ds.getColumn(0, "remark");
if (!gfn_isNull(remark) &&
    !gfn_checkRange(remark, "len", null, 100)) {
    alert("비고는 100자 이내로 입력해 주세요. " +
          "현재: " + remark.length + "자");
    this.edt_remark.setFocus();
    return;
}
```

현재 입력 글자 수를 메시지에 포함하면 사용자가 얼마나 줄여야 하는지 바로 알 수 있다.

## 상호 의존성 검사 모음

실무에서 자주 쓰는 상호 의존성 검사 패턴을 묶어 함수로 만든다.

```javascript
function fn_checkCrossValidation(ds) {
    var minQty = Number(ds.getColumn(0, "min_qty"));
    var maxQty = Number(ds.getColumn(0, "max_qty"));

    if (minQty > maxQty) {
        alert("최대수량은 최소수량 이상이어야 합니다.");
        return false;
    }

    var price = Number(ds.getColumn(0, "price"));
    var discount = Number(ds.getColumn(0, "discount"));
    if (discount > price) {
        alert("할인금액은 판매가격을 초과할 수 없습니다.");
        return false;
    }
    return true;
}
```

상호 의존성 검사는 항목별 검사 후 마지막에 수행하는 것이 자연스럽다. 개별 필드 검사를 다 통과한 뒤 필드 간 관계를 확인하는 순서다.

## Spin 컴포넌트의 min/max 속성 활용

Spin 컴포넌트는 UI 레벨에서 범위를 강제할 수 있다. `min`, `max` 속성을 설정하면 화살표 클릭 시 해당 범위를 벗어날 수 없다. 하지만 직접 키보드 입력은 여전히 허용될 수 있으므로 저장 전 스크립트 검사도 유지한다.

```javascript
// Spin 컴포넌트 속성
this.spn_qty.min = 1;
this.spn_qty.max = 9999;
// 직접 입력도 범위를 강제하려면 스크립트 검사 병행
```

---

**지난 글:** [[Nexacro N] 형식 검사 구현](/posts/nexacro-n-format-check/)

**다음 글:** [[Nexacro N] 서버 유효성 검사](/posts/nexacro-n-server-validation/)

<br>
읽어주셔서 감사합니다. 😊
