---
title: "[Nexacro N] Grid Fixed Columns — 고정 컬럼 설정"
description: "Nexacro N Grid의 fixedcol과 fixedrow 속성으로 좌측 컬럼과 상단 행을 고정해 수평/수직 스크롤 시에도 주요 컬럼이 유지되도록 설정하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 5
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "grid", "fixedcol", "fixedrow", "고정컬럼", "스크롤"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-grid-cell-merge/)에서 셀 병합 처리 방법을 살펴봤습니다. 이번에는 컬럼 수가 많은 그리드에서 필수적인 고정 컬럼(Fixed Column) 설정을 다룹니다. 수평 스크롤을 하더라도 사번·성명 같은 주요 식별 컬럼이 항상 보이도록 고정하는 방법입니다.

## 고정 컬럼의 필요성

인사, 회계, 재고 등 업무 시스템에서는 한 행에 30~50개 이상의 컬럼이 필요한 경우가 많습니다. 사용자가 오른쪽 컬럼을 보기 위해 스크롤하면 어떤 행의 데이터인지 파악하기 어려워집니다. 사번·성명처럼 행을 식별하는 컬럼을 고정하면 스크롤 중에도 맥락을 유지할 수 있습니다.

![Grid 고정 컬럼 구조](/assets/posts/nexacro-n-grid-fixed-columns-concept.svg)

## fixedcol 속성

`fixedcol` 속성에 숫자를 지정하면 좌측에서부터 해당 수만큼의 컬럼이 고정됩니다.

```xml
<Grid id="grd_emp"
  left="10" top="10" width="760" height="400"
  fixedcol="2"
  bindDataset="ds_emp">
</Grid>
```

`fixedcol="2"`를 설정하면 0번, 1번 컬럼(사번, 성명)이 고정됩니다. 사용자가 우측으로 스크롤해도 이 두 컬럼은 화면 좌측에 고정되어 유지됩니다.

고정된 컬럼 영역과 스크롤 영역 사이에는 구분선이 자동으로 표시됩니다. 구분선 색상은 StyleSet으로 변경할 수 있습니다.

## fixedrow — 상단 행 고정

`fixedrow` 속성으로 body 영역의 상단 행도 고정할 수 있습니다.

```xml
<Grid id="grd_report"
  fixedcol="1"
  fixedrow="2"
  bindDataset="ds_report">
</Grid>
```

`fixedrow="2"`를 설정하면 body의 첫 두 행이 수직 스크롤 시에도 고정됩니다. 헤더(head 밴드)는 항상 고정이므로 `fixedrow`는 body 행에만 적용됩니다. 월별 비교표처럼 첫 몇 행이 기준 행 역할을 할 때 유용합니다.

![고정 컬럼 설정 코드](/assets/posts/nexacro-n-grid-fixed-columns-code.svg)

## 런타임 동적 변경

스크립트에서 `fixedcol` 값을 변경하면 런타임에도 고정 컬럼 수를 바꿀 수 있습니다.

```javascript
function fn_toggleFixedCol(useFixed) {
  if (useFixed) {
    this.grd_emp.fixedcol = 2;
  } else {
    this.grd_emp.fixedcol = 0;
  }
}
```

사용자 설정 화면에서 "컬럼 고정 사용" 토글을 제공할 때 활용할 수 있습니다.

## 고정 컬럼의 스타일 분리

고정 컬럼 영역과 일반 스크롤 영역에 서로 다른 배경색을 지정하면 시각적으로 구분이 명확해집니다.

```xml
<StyleSet id="grdstyle_wide">
  <!-- 고정 컬럼 영역 -->
  <Style selector="Grid:fixedcell">
    background: #0d1a0d;
    color: #e8e8e8;
    border-right: 2px solid #55c555;
  </Style>
  <!-- 일반 스크롤 영역 -->
  <Style selector="Grid:body">
    background: #111827;
    color: #e8e8e8;
  </Style>
</StyleSet>
```

`Grid:fixedcell` 셀렉터가 고정 영역 body 셀에 적용됩니다.

## 고정 컬럼과 병합의 상호작용

`mergeType="merge"`로 셀 병합을 설정한 컬럼이 고정 컬럼 범위에 포함될 경우, 병합은 고정 영역 내에서만 적용됩니다. 고정 영역과 스크롤 영역에 걸친 병합은 지원되지 않습니다.

```xml
<!-- 0번 컬럼은 고정, 병합 설정도 가능 -->
<Cell col="0" datacolumn="dept_nm"
  mergeType="merge"
  halign="center" valign="middle"/>
```

`fixedcol="1"` 상태에서 0번 컬럼에 `mergeType="merge"`를 설정하면 고정 영역 내에서 병합이 정상 동작합니다.

## 고정 컬럼 수 결정 기준

| 상황 | 권장 fixedcol |
|---|---|
| 사번·성명 식별 컬럼 | 2 |
| 순번·사번·성명·부서 | 4 |
| 전체 컬럼이 10개 이하 | 0 (고정 불필요) |
| 모바일/좁은 화면 | 0~1 |

고정 컬럼이 너무 많으면 스크롤 영역이 좁아져 오히려 불편합니다. 전체 그리드 너비 대비 고정 영역이 50% 이하가 되도록 조정합니다.

## 고정 컬럼 구분선 색상 변경

고정 컬럼 우측 경계선 색상을 변경하려면 `fixedLineColor` 속성을 사용합니다.

```javascript
// 런타임에 구분선 색상 변경
this.grd_emp.fixedlinecolor = "RGB(85,197,85)"; // #55c555
```

또는 StyleSet에서 `Grid:fixedcolumn` 셀렉터의 `border-right`로 지정할 수도 있습니다.

## 컬럼 너비와 고정 영역 계산

고정 컬럼의 너비 합계가 Grid 전체 너비보다 크면 스크롤 영역이 생기지 않아 사실상 모든 컬럼이 보이는 상태가 됩니다. `fixedcol`에 지정한 수만큼의 컬럼 너비 합이 Grid 너비보다 충분히 작아야 스크롤 영역이 의미 있게 나타납니다.

```javascript
function fn_checkFixedWidth() {
  var fixedWidth = 0;
  var fixedCount = this.grd_emp.fixedcol;
  for (var i = 0; i < fixedCount; i++) {
    fixedWidth += this.grd_emp.getCellProperty(
      "body", 0, i, "width"
    );
  }
  trace("고정 영역 너비: " + fixedWidth + "px");
}
```

## 정리

`fixedcol` 속성으로 좌측 N개 컬럼을 고정하면 수평 스크롤 시에도 식별 컬럼이 항상 표시됩니다. `fixedrow`로 상단 body 행도 고정할 수 있습니다. 컬럼 수가 많은 업무 그리드에서 사용자 경험을 크게 개선하는 중요한 설정입니다.

---

**지난 글:** [Nexacro N Grid Cell Merge — 셀 병합 처리](/posts/nexacro-n-grid-cell-merge/)

**다음 글:** [Nexacro N Grid Summary — 합계 행 구성](/posts/nexacro-n-grid-summary/)

<br>
읽어주셔서 감사합니다. 😊
