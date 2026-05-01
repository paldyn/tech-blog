---
title: "[Nexacro N] Spin — 숫자 증감 컴포넌트 완전 정복"
description: "Nexacro N Spin 컴포넌트의 min/max/step/value 속성, spintype(normal/loop/roll), edittype, numformat, onchanged 이벤트, 수량 입력·페이지 이동 등 실무 활용 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 5
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "spin", "스핀", "숫자증감", "min", "max", "step", "spintype", "onchanged"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-calendar/)에서 날짜 선택 UI를 구성하는 Calendar 컴포넌트를 살펴봤습니다. 이번에는 숫자를 증가·감소시키는 버튼이 달린 **Spin 컴포넌트**를 다룹니다. 수량 입력, 페이지 번호 이동, 설정값 조정처럼 숫자를 단계적으로 변경하는 UI에서 Spin을 활용하면 직접 숫자를 타이핑하는 것보다 오류가 적고 사용성이 높은 인터페이스를 만들 수 있습니다.

## Spin 컴포넌트 구조

Spin 컴포넌트는 값을 표시하는 **텍스트 영역**과 값을 올리는 **▲ 버튼**, 값을 내리는 **▼ 버튼**으로 구성됩니다. 사용자는 버튼을 클릭하거나 텍스트 영역에 직접 숫자를 입력할 수 있습니다(edittype이 normal인 경우).

```xml
<!-- Studio에서 기본 선언 -->
<Spin id="spnQty"
      value="1"
      min="1"
      max="999"
      step="1"
      spintype="normal"
      left="100" top="50" width="120" height="30"/>
```

![Spin — 컴포넌트 구조 및 속성](/assets/posts/nexacro-n-spin-structure.svg)

## 핵심 속성

### value, min, max, step

- **`value`**: 현재 값. 스크립트에서 `obj.value`로 읽습니다
- **`min`**: 최솟값. 이 값 이하로 내려가지 않습니다
- **`max`**: 최댓값. 이 값 이상으로 올라가지 않습니다
- **`step`**: 한 번 클릭에 증감되는 단위. 기본값은 1

```javascript
function Form_onload(obj, e) {
    this.spnQty.set_value(1);    // 초기값
    this.spnQty.set_min(1);      // 최소 1개
    this.spnQty.set_max(999);    // 최대 999개
    this.spnQty.set_step(1);     // 1씩 증감
}
```

step을 5로 설정하면 버튼 클릭 시 5씩 증감됩니다. 10, 100 단위 조정이 필요한 UI(예: 가격 설정 슬라이더 보조)에 유용합니다.

### spintype

`spintype`은 min/max 경계에서의 동작 방식을 결정합니다.

| spintype | 동작 |
|----------|------|
| `normal` | 경계에서 정지. max에서 ▲ 클릭 시 변화 없음 |
| `loop` | max 초과 시 min으로, min 미만 시 max로 순환 |
| `roll` | 경계에서 고정. max/min 값을 계속 유지 |

```javascript
// 시간(0~23) 순환 입력
this.spnHour.set_min(0);
this.spnHour.set_max(23);
this.spnHour.set_spintype("loop");

// 23에서 ▲ 클릭 → 0으로 순환
// 0에서 ▼ 클릭 → 23으로 순환
```

`loop` 타입은 시간, 요일 선택처럼 순환하는 개념에 적합합니다.

### edittype

`edittype`으로 직접 입력 허용 여부를 결정합니다.

| edittype | 동작 |
|----------|------|
| `normal` | 버튼 클릭 + 직접 숫자 입력 모두 가능 |
| `readonly` | 버튼 클릭으로만 값 변경 가능 |

```javascript
// 버튼 클릭만으로 제어 (직접 입력 불가)
this.spnPage.set_edittype("readonly");
```

페이지 이동 컨트롤처럼 정확한 단계별 이동이 필요할 때는 `readonly`가 더 안전합니다.

## numformat — 숫자 표시 형식

`numformat` 속성으로 값을 표시할 때의 숫자 포맷을 지정합니다.

```javascript
// 소수점 2자리까지 표시
this.spnRate.set_numformat("#,##0.00");

// 정수만 표시
this.spnQty.set_numformat("#,###");
```

포맷 지정 시 표시는 포맷에 맞게 나타나지만, `value`에서 읽는 값은 원래 숫자 형식입니다.

## onchanged 이벤트

버튼 클릭 또는 직접 입력으로 값이 변경될 때 `onchanged` 이벤트가 발생합니다.

```javascript
function spnQty_onchanged(obj, e) {
    var nQty   = obj.value;
    var nPrice = this.dsItem.getColumn(0, "PRICE");
    var nTotal = nQty * nPrice;
    this.edtTotal.set_value(nTotal.toString());
}
```

`obj.value`는 현재 숫자 값입니다. 문자열이 아니라 숫자로 처리되므로 바로 산술 연산에 사용할 수 있습니다.

![Spin — 초기화 및 이벤트 처리](/assets/posts/nexacro-n-spin-code.svg)

## 수량 입력 패턴

주문·재고 화면에서 수량을 입력받는 표준 패턴입니다.

```javascript
// Spin + 합계 자동 계산
function spnQty_onchanged(obj, e) {
    this.fn_calcTotal();
}

function fn_calcTotal() {
    var nQty   = this.spnQty.value;
    var nPrice = parseInt(this.edtUnitPrice.value) || 0;
    var nTotal = nQty * nPrice;
    // 천 단위 구분자 포맷
    this.edtTotalPrice.set_value(
        nTotal.toLocaleString()
    );
}
```

## 페이지 이동 컨트롤 패턴

대용량 데이터의 페이지별 조회에 Spin을 활용합니다.

```javascript
var gnTotalPage = 1;
var gnCurPage   = 1;

function fn_initPaging(nTotalPage) {
    gnTotalPage = nTotalPage;
    this.spnPage.set_min(1);
    this.spnPage.set_max(nTotalPage);
    this.spnPage.set_value(1);
    this.stcPageInfo.set_text("1 / " + nTotalPage);
}

function spnPage_onchanged(obj, e) {
    gnCurPage = obj.value;
    this.stcPageInfo.set_text(
        gnCurPage + " / " + gnTotalPage
    );
    this.fn_search(gnCurPage);
}
```

## 소수점 입력 처리

소수점이 있는 값(요율, 비율 등) 입력 시 `step`을 소수로 설정합니다.

```javascript
// 이자율: 0.1씩 조정
this.spnRate.set_min(0);
this.spnRate.set_max(100);
this.spnRate.set_step(0.1);
this.spnRate.set_numformat("##0.0");
```

## 입력값 검증

Spin 직접 입력 모드(`edittype="normal"`)에서는 사용자가 min/max 범위 밖의 숫자를 직접 타이핑할 수 있습니다. `onkillfocus`에서 범위를 검증합니다.

```javascript
function spnQty_onkillfocus(obj, e) {
    var nVal = obj.value;
    if (nVal < obj.min) {
        obj.set_value(obj.min);
    } else if (nVal > obj.max) {
        obj.set_value(obj.max);
    }
}
```

직접 입력 후 포커스가 떠날 때 자동으로 범위 내 값으로 클램핑됩니다.

## Spin을 Grid와 함께 사용

Grid 셀 안에 Spin을 배치해 행 단위 수량 입력 UI를 만들 수 있습니다. 이 경우 Grid의 cellstyle을 `spin`으로 지정하면 됩니다. 자세한 내용은 Grid 관련 글에서 다룹니다.

---

**지난 글:** [Calendar — 날짜 선택 컴포넌트 활용 가이드](/posts/nexacro-n-calendar/)

**다음 글:** [Radio / CheckBox — 선택 컴포넌트 활용 가이드](/posts/nexacro-n-radio-checkbox/)

<br>
읽어주셔서 감사합니다. 😊
