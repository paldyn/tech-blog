---
title: "[Nexacro N] Grid Summary — 합계 행 구성"
description: "Nexacro N Grid footer 밴드에 sumText/avgText/countText로 합계·평균·건수를 표시하는 방법, Dataset 집계 함수 연계, 스크립트로 커스텀 집계 처리를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 6
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "grid", "footer", "summary", "sumText", "avgText", "countText", "집계"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-grid-fixed-columns/)에서 고정 컬럼 설정 방법을 살펴봤습니다. 이번에는 Grid 하단에 합계·평균·건수를 표시하는 Summary(Footer) 행 구성을 다룹니다. 업무 시스템에서 집계 정보는 거의 모든 그리드에서 필요하므로 정확히 이해하는 것이 중요합니다.

## Footer 밴드 개요

Nexacro N Grid에서 집계 행은 `Footer` 밴드에 정의합니다. `Footer` 밴드는 Grid 하단에 고정 표시되며, 스크롤해도 항상 보입니다. 여러 개의 `FooterLine`을 선언해 합계, 평균 등 여러 종류의 집계를 각각 다른 행에 표시할 수 있습니다.

![Grid 합계 행(Summary/Footer) 구조](/assets/posts/nexacro-n-grid-summary-structure.svg)

## sumText — 합계

`sumtext` 속성에 Dataset 컬럼명을 지정하면 해당 컬럼의 모든 행을 합산해 표시합니다.

```xml
<Footer>
  <FooterLine height="38">
    <Cell col="2" text="합계" halign="center"/>
    <Cell col="3" datacolumn="sal_amt"
      sumtext="sal_amt"
      displayformat="#,##0"
      halign="right"/>
    <Cell col="4" datacolumn="bonus"
      sumtext="bonus"
      displayformat="#,##0"
      halign="right"/>
  </FooterLine>
</Footer>
```

`sumtext="sal_amt"`를 설정하면 `ds_emp`의 `sal_amt` 컬럼 전체 합계를 자동으로 계산해 표시합니다. Dataset 데이터가 갱신되면 합계도 자동으로 재계산됩니다.

![Footer 집계 행 XFD 코드](/assets/posts/nexacro-n-grid-summary-code.svg)

## avgText — 평균

`avgtext` 속성으로 컬럼 값의 산술 평균을 표시합니다.

```xml
<FooterLine height="36">
  <Cell col="2" text="평균" halign="center"/>
  <Cell col="3"
    avgtext="sal_amt"
    displayformat="#,##0"
    halign="right"/>
</FooterLine>
```

`avgtext`는 `count > 0`인 경우에만 유효하며, 전체 합 ÷ 행 수를 자동 계산합니다.

## countText — 건수

`counttext` 속성으로 Dataset의 행 수를 표시합니다.

```xml
<FooterLine height="38">
  <Cell col="0" counttext="emp_id"
    text_prefix="총 "
    text_suffix="건"
    halign="center"/>
</FooterLine>
```

`text_prefix`와 `text_suffix`를 함께 사용하면 `"총 4건"` 형태로 표시됩니다. `counttext` 값은 카운트할 컬럼명이며, NULL을 제외한 행 수를 셉니다.

## 여러 FooterLine 병용

합계, 평균, 건수를 각각 다른 행에 표시하려면 `FooterLine`을 여러 개 선언합니다.

```xml
<Footer>
  <!-- 첫 번째 행: 건수 + 합계 -->
  <FooterLine height="38">
    <Cell col="0" counttext="emp_id"
      text_prefix="총 " text_suffix="건"/>
    <Cell col="2" text="합계"/>
    <Cell col="3" sumtext="sal_amt"
      displayformat="#,##0" halign="right"/>
  </FooterLine>
  <!-- 두 번째 행: 평균 -->
  <FooterLine height="36">
    <Cell col="2" text="평균"/>
    <Cell col="3" avgtext="sal_amt"
      displayformat="#,##0" halign="right"/>
  </FooterLine>
</Footer>
```

## 스크립트로 커스텀 집계

내장 집계 속성으로 처리하기 어려운 복잡한 집계는 Dataset 함수를 사용해 직접 계산하고 결과를 표시합니다.

```javascript
function fn_calcSummary() {
  var ds = this.ds_emp;
  var rowCnt = ds.rowcount;

  // 조건부 합계: 급여 3,000,000 이상인 행만
  var highSalSum = 0;
  for (var i = 0; i < rowCnt; i++) {
    var sal = ds.getColumn(i, "sal_amt");
    if (sal >= 3000000) {
      highSalSum += sal;
    }
  }

  // footer 셀에 직접 표시
  this.grd_emp.setCellProperty(
    "footer", 0, 3, "text",
    nexacro.FormatDate(highSalSum, "#,##0")
  );
}
```

`setCellProperty("footer", lineIdx, col, "text", value)`로 footer 셀 텍스트를 직접 지정합니다. 이 방식은 내장 집계와 달리 Dataset 변경 시 자동 갱신되지 않으므로 데이터 변경 후 명시적으로 호출해야 합니다.

## Dataset 집계 함수 활용

Dataset에는 집계에 편리한 내장 함수가 있습니다.

```javascript
function fn_calcWithDataset() {
  var ds = this.ds_emp;

  // 컬럼 합계
  var totalSal = ds.getSum("sal_amt");
  // 컬럼 최댓값
  var maxSal = ds.getMax("sal_amt");
  // 컬럼 최솟값
  var minSal = ds.getMin("sal_amt");
  // 건수
  var cnt = ds.rowcount;

  trace("합계: " + totalSal);
  trace("최대: " + maxSal + " | 최소: " + minSal);
  trace("건수: " + cnt);
}
```

`getSum()`, `getMax()`, `getMin()` 등 Dataset 집계 함수로 계산한 값을 footer에 설정하면 복잡한 집계도 유연하게 처리할 수 있습니다.

## 필터 적용 시 집계 동작

Dataset에 `filter()`를 적용하면 보이는 행만 집계에 포함됩니다. `sumtext`, `avgtext`, `counttext` 모두 필터된 행 기준으로 자동 재계산됩니다.

```javascript
function fn_filterAndSum(dept) {
  // 부서 필터 적용
  this.ds_emp.filter("dept_cd == '" + dept + "'");
  // footer는 자동으로 필터된 데이터 기준으로 집계
}
```

이 자동 연동 덕분에 필터를 바꿀 때마다 footer를 수동으로 갱신하지 않아도 됩니다.

## 표시 형식 지정

집계 값의 표시 형식은 `displayformat` 속성으로 지정합니다.

| 형식 | 설명 |
|---|---|
| `#,##0` | 천 단위 구분, 0이면 0 표시 |
| `#,##0.00` | 소수점 2자리 |
| `0%` | 백분율 |
| `#,##0원` | 단위 붙이기 |

```xml
<Cell col="3" sumtext="sal_amt"
  displayformat="#,##0원"
  halign="right"/>
```

## 정리

Grid footer 밴드의 `sumtext`, `avgtext`, `counttext` 속성으로 합계·평균·건수를 자동 집계해 표시할 수 있습니다. `FooterLine`을 여러 개 선언해 여러 집계 행을 구성하고, 복잡한 집계가 필요할 때는 Dataset 집계 함수와 `setCellProperty()`를 조합합니다. 필터 적용 시에는 보이는 행 기준으로 집계가 자동 재계산됩니다.

---

**지난 글:** [Nexacro N Grid Fixed Columns — 고정 컬럼 설정](/posts/nexacro-n-grid-fixed-columns/)

**다음 글:** [Nexacro N Grid Grouping — 그룹핑 처리](/posts/nexacro-n-grid-grouping/)

<br>
읽어주셔서 감사합니다. 😊
