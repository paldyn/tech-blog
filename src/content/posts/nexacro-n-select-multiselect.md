---
title: "[Nexacro N] Select / MultiSelect — 리스트 박스 선택 컴포넌트"
description: "Nexacro N Select와 MultiSelect 컴포넌트의 차이, 단일·다중 선택, selectcount·getSelectItem(i), 데이터 바인딩, onchanged 이벤트, Grid 연동, 실무 활용 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 8
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "select", "multiselect", "리스트박스", "다중선택", "selectcount", "getSelectItem"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-combo/)에서 드롭다운 형태의 Combo 컴포넌트를 살펴봤습니다. Combo가 클릭해야 목록이 펼쳐지는 방식이라면, **Select**와 **MultiSelect**는 목록이 화면에 **항상 펼쳐진 상태**로 표시됩니다. 선택 가능한 항목이 많지 않고, 한눈에 전체 목록을 보면서 선택해야 하는 경우에 적합합니다.

## Select와 MultiSelect의 차이

`Select`는 목록에서 **하나의 항목**만 선택할 수 있습니다. Combo와 기능은 유사하지만, 항상 리스트가 펼쳐진 상태로 표시됩니다. `MultiSelect`는 **여러 항목을 동시에** 선택할 수 있으며, 각 항목 앞에 체크박스 스타일의 선택 표시가 나타납니다.

| 특성 | Select | MultiSelect |
|------|--------|-------------|
| 선택 수 | 1개 | 여러 개 |
| UI 형태 | 항상 펼쳐진 리스트 | 체크박스 리스트 |
| value | 선택된 코드값 | 첫 번째 선택값 |
| 다중값 추출 | `value`만 | `getSelectItem(i)` |

## Select 기본 사용

```xml
<Select id="sel1"
        innerdataset="dsItems"
        codecolumn="ITEM_CD"
        displaycolumn="ITEM_NM"
        left="100" top="50" width="200" height="150"/>
```

Combo와 동일하게 `innerdataset`, `codecolumn`, `displaycolumn`으로 데이터를 바인딩합니다.

```javascript
// 선택값 읽기
function fn_getSelectedItem() {
    return this.sel1.value; // 선택된 코드 반환
}

// 특정 항목 선택
function fn_selectItem(sCode) {
    this.sel1.set_value(sCode);
}
```

![Select / MultiSelect — 리스트 박스 선택 비교](/assets/posts/nexacro-n-select-multiselect-compare.svg)

## MultiSelect 사용법

```xml
<MultiSelect id="msel1"
             innerdataset="dsItems"
             codecolumn="ITEM_CD"
             displaycolumn="ITEM_NM"
             left="100" top="50" width="200" height="200"/>
```

MultiSelect도 동일하게 바인딩합니다. 차이는 여러 항목을 동시에 선택할 수 있다는 점입니다.

## MultiSelect 선택값 수집

MultiSelect에서 선택된 항목들은 `selectcount`와 `getSelectItem(i)`로 수집합니다.

```javascript
// 선택된 항목 목록 수집
function fn_getSelectedItems() {
    var n   = this.msel1.selectcount; // 선택 항목 수
    var arr = [];
    for (var i = 0; i < n; i++) {
        arr.push(this.msel1.getSelectItem(i));
    }
    return arr.join(","); // "A001,A003,A005"
}
```

`getSelectItem(i)`는 i번째로 선택된 항목의 **코드값**(`codecolumn`의 값)을 반환합니다. `getSelectItemIndex(i)`는 원본 Dataset에서의 행 인덱스를 반환합니다.

![Select / MultiSelect — 선택값 수집 패턴](/assets/posts/nexacro-n-select-multiselect-code.svg)

## onchanged 이벤트

```javascript
function msel1_onchanged(obj, e) {
    var nCount = obj.selectcount;
    this.stcCount.set_text("선택: " + nCount + "개");
    // 선택 개수 제한 (최대 5개)
    if (nCount > 5) {
        alert("최대 5개까지 선택할 수 있습니다.");
        // 마지막 선택 취소는 직접 구현 필요
    }
}
```

## 전체 선택 / 전체 해제

MultiSelect에는 전체 선택 버튼을 별도로 만들어 제공하는 것이 일반적입니다.

```javascript
// 전체 선택
function btnSelectAll_onclick(obj, e) {
    var nCount = this.dsItems.rowcount;
    for (var i = 0; i < nCount; i++) {
        this.msel1.selectItem(i, true);
    }
}

// 전체 해제
function btnClearAll_onclick(obj, e) {
    this.msel1.clearSelectItem();
}
```

`selectItem(nIndex, bSelect)`는 Dataset 행 인덱스 기준으로 항목을 선택하거나 해제합니다. `clearSelectItem()`은 모든 선택을 해제합니다.

## 선택 여부 확인

특정 항목이 선택되어 있는지 확인합니다.

```javascript
// 특정 코드가 선택되어 있는지 확인
function fn_isItemSelected(sCode) {
    var n = this.msel1.selectcount;
    for (var i = 0; i < n; i++) {
        if (this.msel1.getSelectItem(i) === sCode) {
            return true;
        }
    }
    return false;
}
```

## 데이터 바인딩 패턴

서버에서 선택 가능한 항목 목록을 로드하고, 기존 저장값으로 선택 상태를 복원하는 패턴입니다.

```javascript
// 항목 목록 로드 후 기존 선택값 복원
function fn_restoreSelection(sSelectedCodes) {
    // "A001,A003,A005" 형식의 문자열로 저장된 값 복원
    var aCodes = sSelectedCodes.split(",");
    var nRows  = this.dsItems.rowcount;

    for (var r = 0; r < nRows; r++) {
        var sCode = this.dsItems.getColumn(r, "ITEM_CD");
        var bSel  = false;
        for (var c = 0; c < aCodes.length; c++) {
            if (aCodes[c] === sCode) {
                bSel = true;
                break;
            }
        }
        this.msel1.selectItem(r, bSel);
    }
}
```

## Select와 Grid 연동

Select 또는 MultiSelect의 선택이 바뀌면 Grid에 필터를 적용하는 패턴은 실무에서 자주 사용됩니다.

```javascript
function sel1_onchanged(obj, e) {
    var sCateCd = obj.value;
    if (sCateCd) {
        // Dataset 필터 적용
        this.dsGoods.setfilter("CATE_CD == '" + sCateCd + "'");
    } else {
        this.dsGoods.setfilter(""); // 필터 해제
    }
}
```

## Combo vs Select 선택 기준

| 상황 | 권장 컴포넌트 |
|------|---------------|
| 항목이 많고 공간이 제한적 | Combo (드롭다운) |
| 항목이 적고 한눈에 보여줘야 함 | Select |
| 여러 항목 동시 선택 | MultiSelect |
| 모바일 환경 | Combo |
| 관리자 화면 권한 설정 등 | MultiSelect |

Select와 MultiSelect는 항목 수가 5~20개 정도이고, 사용자가 선택지 전체를 비교하며 선택해야 하는 경우에 Combo보다 나은 UX를 제공합니다.

---

**지난 글:** [Combo — 드롭다운 목록의 구조와 데이터 바인딩](/posts/nexacro-n-combo/)

**다음 글:** [Hidden — 화면에 보이지 않는 데이터 컨테이너](/posts/nexacro-n-hidden-input/)

<br>
읽어주셔서 감사합니다. 😊
