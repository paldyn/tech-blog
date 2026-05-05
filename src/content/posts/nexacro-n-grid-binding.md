---
title: "[Nexacro N] Grid Binding — 그리드 데이터 바인딩 심화"
description: "bindDataset과 datacolumn 속성으로 Dataset과 Grid를 연결하는 방법, 런타임 바인딩 변경, 멀티 Dataset 참조 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 1
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "grid", "dataset", "binding", "bindDataset", "datacolumn"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-grid-cell-types/)에서 Grid의 셀 타입(celltype) 설정 방법을 살펴봤습니다. 이번에는 Grid와 Dataset을 연결하는 바인딩 메커니즘을 깊이 있게 다룹니다. 바인딩을 올바르게 이해해야 데이터가 화면에 표시되는 원리를 파악할 수 있습니다.

## 바인딩의 기본 개념

Nexacro N에서 Grid는 데이터를 직접 보유하지 않습니다. 데이터는 항상 Dataset이 소유하고, Grid는 그 데이터를 "참조"해 화면에 표시합니다. 이 연결 관계를 **바인딩(Binding)**이라고 합니다.

바인딩이 설정되면:
- Dataset의 데이터가 변경되면 Grid 화면이 자동으로 갱신됩니다
- 사용자가 Grid 셀을 편집하면 Dataset의 데이터가 즉시 업데이트됩니다
- 트랜잭션으로 서버에서 받은 데이터가 Dataset에 로드되면 Grid에 바로 반영됩니다

![Dataset ↔ Grid 바인딩 구조](/assets/posts/nexacro-n-grid-binding-structure.svg)

## bindDataset 속성

Grid와 Dataset을 연결하는 첫 번째 속성이 `bindDataset`입니다. 값으로 Dataset의 ID를 지정합니다.

```xml
<Dataset id="ds_emp">
  <ConstColumns>
    <ConstColumn id="emp_id" type="INT"/>
    <ConstColumn id="emp_nm" type="STRING"/>
    <ConstColumn id="dept_cd" type="STRING"/>
    <ConstColumn id="sal_amt" type="INT"/>
  </ConstColumns>
</Dataset>

<Grid id="grd_emp"
  left="20" top="20" width="800" height="400"
  bindDataset="ds_emp">
</Grid>
```

`bindDataset`에 `"ds_emp"`를 지정하면 Grid는 `ds_emp` Dataset과 바인딩됩니다. `bindDataset`은 Form 로드 시점에 설정되며, 이후 데이터 흐름이 자동으로 연결됩니다.

## Column과 Cell의 datacolumn 매핑

`bindDataset`으로 Dataset과 연결했더라도, 각 컬럼이 어느 Dataset 컬럼을 표시할지 개별적으로 지정해야 합니다. 이를 `datacolumn` 속성으로 설정합니다.

![Grid 바인딩 XFD 코드](/assets/posts/nexacro-n-grid-binding-code.svg)

`Cell` 요소에 `datacolumn`을 지정하면 해당 셀이 Dataset의 지정 컬럼 값을 표시하고 편집합니다. `datacolumn` 값은 Dataset의 컬럼 ID와 대소문자까지 정확히 일치해야 합니다.

```xml
<Grid id="grd_emp" bindDataset="ds_emp">
  <Formats>
    <Format>
      <Columns>
        <Column size="80"/>
        <Column size="150"/>
        <Column size="100"/>
        <Column size="100"/>
      </Columns>
      <Head>
        <Cell col="0" text="사번"/>
        <Cell col="1" text="성명"/>
        <Cell col="2" text="부서코드"/>
        <Cell col="3" text="급여"/>
      </Head>
      <Body>
        <Cell col="0" datacolumn="emp_id" halign="center"/>
        <Cell col="1" datacolumn="emp_nm"/>
        <Cell col="2" datacolumn="dept_cd" halign="center"/>
        <Cell col="3" datacolumn="sal_amt" halign="right"/>
      </Body>
    </Format>
  </Formats>
</Grid>
```

헤더 셀(`Head`의 `Cell`)에는 `text`로 컬럼 제목을 표시하고, 바디 셀(`Body`의 `Cell`)에는 `datacolumn`으로 Dataset 컬럼을 매핑합니다.

## bindId 속성

`bindId`는 같은 Dataset을 여러 컴포넌트가 참조할 때 어느 행 기준으로 동기화할지를 지정하는 속성입니다. 대부분의 경우 `bindId`를 별도로 지정하지 않으면 Dataset의 현재 행(current row)을 기준으로 동작합니다.

```xml
<!-- 마스터 그리드 -->
<Grid id="grd_master" bindDataset="ds_order" bindId="order_id"/>

<!-- 디테일 그리드 (별도 Dataset) -->
<Grid id="grd_detail" bindDataset="ds_orderdetail"/>
```

마스터-디테일 패턴에서는 마스터 Grid의 행 선택에 따라 디테일 Dataset을 서버에서 다시 조회하는 방식이 더 일반적입니다.

## 런타임 바인딩 변경

폼이 열린 상태에서도 `setBindDataset()`으로 바인딩 대상 Dataset을 동적으로 변경할 수 있습니다.

```javascript
function fn_switchDataset(tabIndex) {
  if (tabIndex == 0) {
    this.grd_main.setBindDataset(this.ds_emp);
  } else {
    this.grd_main.setBindDataset(this.ds_contract);
  }
}
```

탭 전환이나 조건 분기에 따라 같은 Grid에 다른 Dataset을 연결하는 방식입니다. `setBindDataset()`에는 Dataset 객체를 전달하거나 Dataset ID 문자열을 전달할 수 있습니다.

## 바인딩 없이 직접 값 설정

특수한 경우에는 바인딩 없이 Grid 셀에 직접 값을 표시할 수도 있습니다. 단순 레이아웃 설명이나 고정 텍스트를 표시할 때 사용합니다.

```xml
<!-- Head 셀 : text 고정 텍스트 -->
<Cell col="0" text="항목" halign="center"/>

<!-- Body 셀 : 바인딩 없이 displayvalue로 표시 -->
<Cell col="0" text="합계" halign="right"/>
```

바디 영역에서 `text`를 사용하면 모든 행에 동일한 고정 텍스트가 표시됩니다. 합계 행처럼 특수 목적에만 사용합니다.

## 바인딩과 Dataset.rowposition

Grid에서 사용자가 행을 클릭하면 Dataset의 `rowposition`이 변경됩니다. 반대로 스크립트에서 `Dataset.rowposition`을 변경하면 Grid의 선택 행도 함께 이동합니다.

```javascript
function fn_moveToRow(rowIdx) {
  // Dataset rowposition 변경 → Grid 선택 행 동기화
  this.ds_emp.rowposition = rowIdx;
}
```

이 양방향 동기화 덕분에 Grid와 Dataset은 항상 같은 "현재 행"을 가리킵니다.

## 바인딩 체크리스트

실무에서 바인딩이 안 될 때 확인해야 할 사항입니다.

| 확인 항목 | 설명 |
|---|---|
| `bindDataset` 값 | Dataset ID와 정확히 일치하는가 |
| `datacolumn` 값 | Dataset 컬럼 ID와 대소문자 포함 일치하는가 |
| Dataset 존재 여부 | Form에 Dataset이 선언되어 있는가 |
| Dataset 타입 | ConstColumn 타입과 데이터 타입이 맞는가 |
| Form 로드 순서 | Dataset이 Grid보다 먼저 초기화되는가 |

## 정리

`bindDataset`으로 Grid와 Dataset을 연결하고, 각 `Cell`의 `datacolumn`으로 Dataset 컬럼을 매핑하면 바인딩이 완성됩니다. 바인딩이 올바르게 설정되면 데이터 표시와 편집이 자동으로 양방향으로 처리됩니다.

---

**지난 글:** [Nexacro N Grid Cell Types — 셀 타입 완전 가이드](/posts/nexacro-n-grid-cell-types/)

**다음 글:** [Nexacro N Grid Styles — 그리드 스타일 완전 가이드](/posts/nexacro-n-grid-styles/)

<br>
읽어주셔서 감사합니다. 😊
