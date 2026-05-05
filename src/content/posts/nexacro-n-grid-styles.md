---
title: "[Nexacro N] Grid Styles — 그리드 스타일 완전 가이드"
description: "Nexacro N Grid의 head/body/footer 밴드별 스타일 설정, CellStatus별 색상, odd/even 행 구분, 동적 스타일 변경, setCellStyle 사용법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 2
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "grid", "style", "cellstatus", "setCellStyle", "odd", "even", "head", "body", "footer"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-grid-binding/)에서 Dataset과 Grid의 바인딩 구조를 살펴봤습니다. 이번에는 Grid를 시각적으로 구성하는 스타일 설정을 다룹니다. 밴드별 배경색, 행 구분색, 선택 행 강조, 동적 스타일 변경까지 순서대로 설명합니다.

## Grid 스타일 구성 요소

Nexacro N Grid는 크게 네 가지 밴드 영역으로 나뉩니다.

| 밴드 | 용도 | 스타일 셀렉터 |
|---|---|---|
| `head` | 컬럼 헤더 | `Grid:head` |
| `body` | 데이터 표시 영역 | `Grid:body` |
| `summary` | 그룹별 소계 행 | `Grid:summary` |
| `footer` | 전체 합계 행 | `Grid:footer` |

각 밴드는 독립적으로 배경색, 글꼴, 경계선 스타일을 설정할 수 있습니다.

![Grid 밴드별 스타일 영역](/assets/posts/nexacro-n-grid-styles-bands.svg)

## XFD에서 StyleSet 정의

설계 단계에서 스타일을 정의할 때는 XFD 파일의 StyleSet을 사용합니다.

```xml
<StyleSet id="grdstyle_emp">
  <Style selector="Grid">
    background: #111827;
    border: 1px solid #1e2433;
    font-family: "맑은 고딕";
    font-size: 13px;
  </Style>
  <Style selector="Grid:head">
    background: #1a2744;
    color: #7ec8e3;
    font-weight: 700;
    border-bottom: 1px solid #253555;
  </Style>
  <Style selector="Grid:body">
    background: #111827;
    color: #e8e8e8;
    border-bottom: 1px solid #1a2030;
  </Style>
  <Style selector="Grid:body:odd">
    background: #0e1420;
  </Style>
  <Style selector="Grid:body:selected">
    background: #1d3a6e;
    color: #ffffff;
  </Style>
  <Style selector="Grid:footer">
    background: #1a2033;
    color: #e0a030;
    font-weight: 700;
  </Style>
</StyleSet>
```

StyleSet을 정의한 후 Grid의 `styleset` 속성에 해당 ID를 지정합니다.

```xml
<Grid id="grd_emp" styleset="grdstyle_emp" bindDataset="ds_emp"/>
```

## CellStatus로 상태별 스타일

`CellStatus`는 셀의 현재 상태를 나타내는 키워드로, 상태별로 다른 스타일을 지정할 수 있습니다.

| CellStatus | 설명 |
|---|---|
| (기본) | 일반 상태 |
| `selected` | 선택된 행/셀 |
| `focused` | 포커스된 셀 |
| `readonly` | 읽기 전용 셀 |
| `disabled` | 비활성 행/셀 |

```xml
<Style selector="Grid:body:focused">
  border: 2px solid #7ec8e3;
</Style>
<Style selector="Grid:body:disabled">
  color: #555555;
  background: #0a0a0a;
</Style>
```

## odd/even 행 교차 색상

긴 목록에서 행을 읽기 쉽게 하려면 홀수/짝수 행에 서로 다른 배경색을 지정합니다.

```xml
<Style selector="Grid:body">
  background: #111827;
</Style>
<Style selector="Grid:body:odd">
  background: #0e1420;
</Style>
```

`Grid:body:odd`는 1번째, 3번째, 5번째 ... 행(0-based로 짝수 인덱스 행)에 적용됩니다. `Grid:body:even`은 2번째, 4번째 ... 행에 적용됩니다.

## 동적 스타일 변경 — setCellStyle

런타임에 특정 셀이나 특정 행의 스타일을 변경하려면 `setCellStyle()`을 사용합니다.

```javascript
function fn_highlightRow(rowIdx) {
  // 특정 행 전체 강조
  this.grd_emp.setCellStyle(
    "body", rowIdx, -1,
    "background:#1d3a6e;color:#ffffff"
  );
}

function fn_clearHighlight() {
  // 전체 body 행 스타일 초기화
  this.grd_emp.setCellStyle(
    "body", -1, -1, ""
  );
}
```

`setCellStyle(band, row, col, styleString)` 파라미터:
- `band`: `"body"`, `"head"`, `"footer"` 중 하나
- `row`: 행 인덱스, `-1`이면 전체 행
- `col`: 컬럼 인덱스, `-1`이면 전체 컬럼
- `styleString`: CSS 스타일 문자열 (빈 문자열이면 초기화)

![Grid 스타일 속성 코드](/assets/posts/nexacro-n-grid-styles-code.svg)

## 조건부 스타일 — oncellstyle 이벤트

셀 값에 따라 자동으로 스타일을 변경하려면 `oncellstyle` 이벤트를 사용합니다.

```javascript
function grd_emp_oncellstyle(obj, e) {
  // 급여 컬럼에서 3,000,000 미만이면 빨간색
  if (e.col == 3) {
    var sal = this.ds_emp.getColumn(e.row, "sal_amt");
    if (sal < 3000000) {
      e.style = "color:#e05555";
    }
  }
  // 재직여부 컬럼: N이면 회색
  if (e.col == 4) {
    var yn = this.ds_emp.getColumn(e.row, "status");
    if (yn == "N") {
      e.style = "color:#555555";
    }
  }
}
```

`oncellstyle` 이벤트는 셀을 그릴 때마다 호출되며, `e.style`에 스타일을 지정하면 해당 셀에 즉시 적용됩니다.

## 컬럼 너비와 정렬

스타일은 색상만이 아닙니다. 정렬(`halign`, `valign`)과 패딩도 셀 스타일의 일부입니다.

```xml
<Style selector="Grid:body:col2">
  halign: right;
  padding-right: 8px;
</Style>
```

또는 Cell 속성으로 직접 지정합니다.

```xml
<Cell col="3" datacolumn="sal_amt"
  halign="right"
  displayformat="#,##0"/>
```

`displayformat`은 데이터 표시 형식입니다. `#,##0`은 천 단위 구분 기호를 붙여 표시합니다.

## 경계선(border) 스타일

Grid 전체 외곽선과 각 셀 경계선을 별도로 지정할 수 있습니다.

```xml
<Style selector="Grid">
  border: 1px solid #1e2433;
</Style>
<Style selector="Grid:body">
  border-bottom: 1px solid #1a2030;
</Style>
<Style selector="Grid:head">
  border-bottom: 2px solid #253555;
</Style>
```

`border-bottom`만 지정하면 행 구분선만 그려져 깔끔한 테이블 형태가 만들어집니다.

## 스타일 우선순위

여러 스타일이 동시에 적용될 때 우선순위는 다음과 같습니다.

1. `setCellStyle()`로 동적 설정한 스타일 (가장 높음)
2. `oncellstyle` 이벤트에서 설정한 스타일
3. CellStatus별 StyleSet 스타일
4. 기본 StyleSet 스타일 (가장 낮음)

## 정리

Grid 스타일은 `head`, `body`, `footer` 밴드별로 StyleSet에 선언하고, 런타임 조건에 따른 변경은 `setCellStyle()`이나 `oncellstyle` 이벤트로 처리합니다. `odd`/`even` 교차 색상과 `selected` 상태 스타일을 함께 설정하면 실무 수준의 그리드 UX를 구현할 수 있습니다.

---

**지난 글:** [Nexacro N Grid Binding — 그리드 데이터 바인딩 심화](/posts/nexacro-n-grid-binding/)

**다음 글:** [Nexacro N Grid Multi Header — 다중 헤더 구성](/posts/nexacro-n-grid-multi-header/)

<br>
읽어주셔서 감사합니다. 😊
