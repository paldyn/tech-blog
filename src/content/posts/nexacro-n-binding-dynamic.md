---
title: "[Nexacro N] 동적 바인딩 — 런타임에 Dataset 교체하기"
description: "Nexacro N에서 set_binddataset·set_dataset·set_value 등을 사용해 런타임에 바인딩 대상을 교체하는 패턴을 탭 전환·언어 교체·대량 데이터 삽입 시나리오로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 9
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "databinding", "dynamic-binding", "set_binddataset", "runtime-binding"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-binding-expression/)에서 바인딩 표현식과 ConstColumn을 살펴봤습니다. Designer에서 설정한 `dataset`, `binddataset` 속성은 런타임에도 스크립트로 변경할 수 있습니다. 탭 전환에 따라 Grid가 표시하는 Dataset을 바꾸거나, 언어 설정에 따라 표시 컬럼을 교체하거나, 대용량 데이터 삽입 성능을 높이기 위해 바인딩을 일시적으로 해제하는 등 다양한 상황에서 동적 바인딩이 쓰입니다.

## Dataset 교체 — set_binddataset

Grid의 `binddataset`을 런타임에 바꾸면 Grid가 즉시 새 Dataset의 데이터를 표시합니다.

```javascript
// 탭에 따라 Grid Dataset 교체
function fn_changeTab(tabId) {
    var dsMap = {
        "sales":   "dsSales",
        "returns": "dsReturns",
        "stock":   "dsStock"
    };
    this.grdMain.set_binddataset(dsMap[tabId] || "dsSales");
}
```

![동적 바인딩 패턴](/assets/posts/nexacro-n-binding-dynamic-flow.svg)

## 탭 이벤트와 연동

탭 컨트롤의 `onitemchanged` 이벤트에서 `e.postitem`(새로 선택된 탭 ID)을 이용해 Dataset을 교체합니다.

![탭 전환 시 Grid Dataset 동적 교체](/assets/posts/nexacro-n-binding-dynamic-tab.svg)

이 패턴은 여러 탭이 같은 Grid를 공유하면서 서로 다른 데이터를 표시할 때 유용합니다. Grid의 Format(컬럼 구조)은 유지한 채 데이터만 교체할 수 있습니다.

## Edit 바인딩 컬럼 교체

Edit·Combo 등 단건 컴포넌트의 `dataset`이나 `value`도 스크립트로 교체 가능합니다.

```javascript
// 언어 설정에 따라 Combo 표시 컬럼 전환
function fn_applyLanguage(lang) {
    var nameCol = (lang == "EN") ? "NAME_EN" : "NAME_KO";
    this.cboCategory.set_datacolumn(nameCol);
    this.cboItem.set_datacolumn(nameCol);
}

// 조건에 따라 Edit가 참조할 Dataset 전환
function fn_switchDataset(mode) {
    var dsId = (mode == "compare") ? "dsCompare" : "dsMain";
    this.edtValue.set_dataset(dsId);
}
```

## 대량 데이터 삽입 시 성능 최적화

수만 건의 행을 `addRow()` 루프로 Dataset에 채울 때 Grid가 바인딩되어 있으면 행마다 렌더링이 발생해 성능이 급격히 저하됩니다. 삽입 전에 바인딩을 해제하고, 완료 후 재연결하면 렌더링을 한 번으로 줄일 수 있습니다.

```javascript
function fn_loadLargeData(arr) {
    // 1. 바인딩 해제
    this.grdMain.set_binddataset("");
    this.dsMain.set_enableevent(false); // onchanged 이벤트도 억제

    // 2. 데이터 채우기
    this.dsMain.clearData();
    for (var i = 0; i < arr.length; i++) {
        var nRow = this.dsMain.addRow();
        this.dsMain.setColumn(nRow, "CODE", arr[i].code);
        this.dsMain.setColumn(nRow, "NAME", arr[i].name);
    }

    // 3. 바인딩 재연결
    this.dsMain.set_enableevent(true);
    this.grdMain.set_binddataset("dsMain");
}
```

`enableevent=false`로 Dataset 이벤트를 억제하면 `onchanged`가 발화하지 않아 부가 로직이 반복 실행되는 것도 막을 수 있습니다.

## 빈 문자열로 바인딩 해제

```javascript
// 완전 해제 — Grid가 아무것도 표시하지 않음
this.grdMain.set_binddataset("");

// Edit 바인딩 해제
this.edtName.set_dataset("");
```

빈 문자열로 설정하면 바인딩이 완전히 해제됩니다. 이후 `set_value()`로 직접 텍스트를 지정할 수 있습니다.

## 주의: 동적 바인딩 후 컬럼 구조 불일치

Dataset을 교체할 때 Grid Format에 선언된 `bindcolumn`이 새 Dataset에 없는 컬럼을 참조하면 해당 셀이 공백으로 표시됩니다. 교체 전에 두 Dataset의 컬럼 구조가 호환되는지 확인하거나, 교체 후 `Grid.setColumnProperty()` 등으로 `bindcolumn`도 함께 변경해야 합니다.

```javascript
function fn_switchToCompareMode() {
    this.grdMain.set_binddataset("dsCompare");
    // dsCompare는 AMT_CMP 컬럼 → bindcolumn도 교체
    this.grdMain.setCellProperty(0, 3, "bindcolumn", "AMT_CMP");
}
```

---

**지난 글:** [[Nexacro N] 바인딩 표현식 — 계산 컬럼과 포맷](/posts/nexacro-n-binding-expression/)

**다음 글:** [[Nexacro N] 마스터-디테일 패턴 구현](/posts/nexacro-n-master-detail/)

<br>
읽어주셔서 감사합니다. 😊
