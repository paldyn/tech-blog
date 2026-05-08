---
title: "[Nexacro N] Grid EditControl — 셀 편집 컨트롤 완전 정복"
description: "Nexacro N Grid에서 edittype 속성으로 셀마다 다른 편집 컨트롤(텍스트·콤보·체크박스·날짜·스핀·버튼)을 지정하고 런타임에 동적으로 변경하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 1
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "grid", "edittype", "combo", "checkbox", "date", "편집컨트롤"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-grid-row-actions/)에서 Grid의 행 단위 액션(클릭·더블클릭·다중선택)을 다뤘습니다. 이번에는 Grid에서 가장 실무 빈도가 높은 주제 중 하나인 **셀 편집 컨트롤** 설정을 집중적으로 살펴봅니다. 어떤 컨트롤을 어떤 상황에서 쓸지, 그리고 런타임에 동적으로 바꾸는 패턴까지 모두 다룹니다.

## edittype이란?

Nexacro N Grid의 각 `Column`(또는 `GridColumn`) 에는 `edittype` 속성이 있습니다. 이 속성 하나로 해당 열의 셀이 클릭될 때 어떤 컨트롤이 활성화될지 결정됩니다.

```xml
<Column id="colName" edittype="normal" />
<Column id="colCode" edittype="combo"
        codecolumn="CODE" datacolumn="NAME" />
<Column id="colDate" edittype="date" />
<Column id="colCheck" edittype="checkbox"
        checkedvalue="Y" uncheckedvalue="N" />
```

디자인 타임에 속성을 지정하는 것이 기본이지만, 스크립트로도 언제든지 변경할 수 있습니다.

![Grid EditControl 유형](/assets/posts/nexacro-n-grid-edit-control-edittype.svg)

## 주요 edittype 값 상세

### normal — 텍스트 입력

가장 기본 값입니다. 셀을 클릭하면 일반 `Edit` 컨트롤이 열립니다. `mask` 속성으로 숫자·날짜 마스크를 걸거나, `inputtype="number"`로 숫자 전용 키패드를 강제할 수 있습니다.

```javascript
// 컬럼 속성 직접 접근
var oCol = grd.getColumnById("colAmt");
oCol.mask       = "###,###,###";
oCol.inputtype  = "number";
```

### combo — 드롭다운 선택

`edittype="combo"`를 지정하면 셀이 활성화될 때 드롭다운 목록이 표시됩니다. 핵심은 **bindingcodedataset** 연결입니다. `codecolumn`에는 실제 저장될 값 컬럼명, `datacolumn`에는 화면에 보여줄 텍스트 컬럼명을 씁니다.

```xml
<Column id="colDept"
        edittype="combo"
        bindingcodedataset="dsCode"
        codecolumn="DEPT_CD"
        datacolumn="DEPT_NM" />
```

Dataset `dsCode`에 코드 데이터가 사전에 로드되어 있어야 드롭다운 목록이 정상적으로 나타납니다. 빈 Dataset에 연결하면 목록이 비어 있는 채로 열립니다.

### checkbox — 불리언 체크

`checkedvalue`와 `uncheckedvalue`를 함께 지정합니다. Dataset에 `"Y"`/`"N"` 또는 `"1"`/`"0"` 형태로 저장할 수 있습니다.

```xml
<Column id="colUseYn"
        edittype="checkbox"
        checkedvalue="Y"
        uncheckedvalue="N" />
```

체크박스 셀은 클릭만으로 값이 토글됩니다. 별도로 `oncellclick` 이벤트를 처리하지 않아도 Dataset 값이 자동으로 변경됩니다.

### date — 날짜 캘린더

셀을 클릭하면 달력 팝업이 열립니다. `editformat`으로 편집 중 표시 형식을, `dateformat`으로 Dataset에 저장할 형식을 분리해 지정할 수 있습니다.

```xml
<Column id="colRegDate"
        edittype="date"
        dateformat="yyyyMMdd"
        editformat="yyyy-MM-dd" />
```

Dataset에는 `"20260506"` 형태로 저장되지만, 셀이 편집 상태일 때는 `"2026-05-06"`으로 보여줍니다.

### spin — 증감 입력

숫자 값을 ▲▼ 버튼으로 증감시키는 컨트롤입니다. `spinunit`으로 한 번에 증감할 단위를 설정합니다.

```xml
<Column id="colQty"
        edittype="spin"
        spinunit="1"
        spintype="vertical" />
```

### button — 커스텀 액션

셀 자체가 버튼처럼 동작합니다. `oncellclick` 이벤트에서 팝업을 열거나 서버를 조회하는 로직을 붙이는 패턴에 주로 씁니다.

```javascript
function grd_oncellclick(obj, e) {
    if (e.col == grd.getColumnIndex("colSearch")) {
        fn_openSearchPopup(e.row);
    }
}
```

### none — 읽기 전용

`edittype="none"`이면 해당 열 셀은 편집이 완전히 차단됩니다. 조회 전용 열이나 자동 생성 키 컬럼에 사용합니다.

## 런타임 동적 변경

비즈니스 로직에 따라 같은 열이라도 상황에 따라 편집 가능 여부를 바꿔야 할 때가 있습니다. `getColumnById()`로 컬럼 객체를 가져온 뒤 속성을 바꿉니다.

![edittype 동적 변경 코드 예시](/assets/posts/nexacro-n-grid-edit-control-code.svg)

```javascript
function fn_toggleEdit(bEditable) {
    var oCol = grd.getColumnById("colRemark");
    oCol.edittype = bEditable ? "normal" : "none";
}
```

컬럼 인덱스 기준으로 편집 허용 여부를 한 번에 제어하려면 `setColumnEditable(colIndex, bEditable)`을 사용합니다.

```javascript
// 3번 인덱스 컬럼을 편집 불가로
grd.setColumnEditable(3, false);
```

## combo edittype의 동적 Dataset 교체

콤보 열의 드롭다운 데이터를 런타임에 바꿔야 할 경우 `bindingcodedataset` 속성에 다른 Dataset 이름을 할당합니다.

```javascript
function fn_changeComboDataset(sNewDs) {
    var oCol = grd.getColumnById("colCode");
    oCol.bindingcodedataset = sNewDs;
}
```

새 Dataset이 이미 데이터를 가지고 있으면 즉시 드롭다운에 반영됩니다. 데이터가 아직 없다면 먼저 트랜잭션으로 Dataset을 채운 뒤 bindingcodedataset을 교체합니다.

## 셀 편집 이벤트 흐름

`edittype`이 설정된 셀에서 편집이 시작되고 종료되는 순서는 다음과 같습니다.

1. `oncellclick` — 사용자가 셀 클릭
2. `oncelleditbegin` — 편집 컨트롤 활성화 직전
3. *(편집 중)*
4. `oncelleditend` — 편집 완료(Tab·Enter·다른 셀 클릭)
5. `oncellchange` — Dataset 값 실제 반영

편집을 강제로 취소하려면 `oncelleditend` 이벤트 핸들러에서 `e.cancel = true`를 반환합니다.

```javascript
function grd_oncelleditend(obj, e) {
    if (e.col == grd.getColumnIndex("colAmt")) {
        var nVal = parseInt(e.newvalue);
        if (nVal < 0) {
            alert("0 이상을 입력하세요.");
            e.cancel = true; // 편집 취소
        }
    }
}
```

## 실무 주의사항

- `edittype="combo"`에서 `bindingcodedataset`을 연결하지 않으면 드롭다운이 열리지 않으므로, 공통 코드 Dataset 로드 타이밍을 반드시 확인합니다.
- `edittype="date"`의 `dateformat`은 Dataset 컬럼 타입과 일치시켜야 합니다. Dataset 컬럼이 `STRING` 타입이면 포맷 변환 없이 그대로 저장됩니다.
- 체크박스 열에서 `checkedvalue`/`uncheckedvalue`를 생략하면 기본값(`"1"`/`"0"`)이 적용되므로, 서버 스키마와 맞지 않으면 명시적으로 지정합니다.

---

**지난 글:** [Grid Row Actions — 행 단위 액션](/posts/nexacro-n-grid-row-actions/)

**다음 글:** [Grid 셀 이벤트 완전 정복](/posts/nexacro-n-grid-cell-events/)

<br>
읽어주셔서 감사합니다. 😊
