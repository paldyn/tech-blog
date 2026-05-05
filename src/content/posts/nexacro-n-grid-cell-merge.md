---
title: "[Nexacro N] Grid Cell Merge — 셀 병합 처리"
description: "Nexacro N Grid의 mergeType과 mergeRule 속성으로 body 영역 셀을 세로/가로 방향으로 자동 병합하는 방법과 병합 조건 지정, 주의사항을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 4
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "grid", "merge", "mergeType", "mergeRule", "셀병합"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-grid-multi-header/)에서 다중 헤더 구성 방법을 살펴봤습니다. 이번에는 바디 영역의 셀 병합을 다룹니다. 동일한 값이 연속되는 행에서 해당 셀을 자동으로 병합하면 데이터를 구조적으로 표현할 수 있습니다.

## 셀 병합의 원리

Nexacro N Grid의 셀 병합은 헤더의 colspan/rowspan과 달리 **데이터 기반 자동 병합**입니다. 부서 코드가 같은 행들이 연속될 때 부서 셀이 자동으로 합쳐지는 방식입니다. 사전에 고정된 병합 범위를 지정하는 것이 아니라, 실제 데이터 값을 비교해 자동으로 처리합니다.

![Grid 셀 병합 적용 전/후 비교](/assets/posts/nexacro-n-grid-cell-merge-visual.svg)

## mergeType 속성

`mergeType`은 셀 병합 방향을 지정하는 속성입니다.

| mergeType | 설명 |
|---|---|
| `none` | 병합 안함 (기본값) |
| `merge` | 세로 방향 동일 값 자동 병합 |
| `hmerge` | 가로 방향 동일 값 자동 병합 |

세로 병합이 가장 많이 사용됩니다. 부서별 직원 목록, 주문별 품목 목록 등에서 상위 그룹 컬럼을 병합해 표시할 때 사용합니다.

```xml
<Body>
  <!-- 부서 컬럼: 동일 값 세로 병합 -->
  <Cell col="0" datacolumn="dept_nm"
    mergeType="merge"
    halign="center"
    valign="middle"/>
  <!-- 성명 컬럼: 병합 없이 개별 표시 -->
  <Cell col="1" datacolumn="emp_nm"/>
  <Cell col="2" datacolumn="sal_amt" halign="right"/>
</Body>
```

![셀 병합 설정 코드](/assets/posts/nexacro-n-grid-cell-merge-code.svg)

## mergeRule — 병합 조건 지정

`mergeType="merge"`만 설정하면 해당 셀의 값이 같은 경우에 병합됩니다. 그런데 때로는 다른 컬럼의 값이 같을 때 병합하고 싶을 수 있습니다. 이때 `mergeRule`로 기준 컬럼을 지정합니다.

```xml
<Body>
  <!-- dept_cd가 같은 경우에만 team_nm 병합 -->
  <Cell col="1" datacolumn="team_nm"
    mergeType="merge"
    mergeRule="dept_cd"
    valign="middle"/>
</Body>
```

`mergeRule="dept_cd"`를 지정하면 `team_nm` 컬럼의 값이 동일하더라도, `dept_cd` 값이 다르면 병합하지 않습니다. 부서가 달라지면 팀 병합도 끊기도록 하는 용도입니다.

## 가로 병합 (hmerge)

`mergeType="hmerge"`로 같은 행에서 인접한 셀을 가로 방향으로 병합합니다.

```xml
<Body>
  <Cell col="0" datacolumn="title"
    mergeType="hmerge"/>
  <Cell col="1" datacolumn="title"
    mergeType="hmerge"/>
  <Cell col="2" datacolumn="title"
    mergeType="hmerge"/>
</Body>
```

세 셀 모두 `title` 컬럼을 참조하고 `mergeType="hmerge"`를 설정하면, `title` 값이 같은 경우 세 셀이 가로로 합쳐집니다. 공지 행이나 제목 행을 전체 너비로 표시할 때 사용합니다.

## valign 설정의 중요성

`mergeType="merge"`로 세로 병합된 셀은 병합 범위의 상단에 텍스트가 표시됩니다. 텍스트를 가운데 위치시키려면 반드시 `valign="middle"`을 설정해야 합니다.

```xml
<Cell col="0" datacolumn="dept_nm"
  mergeType="merge"
  halign="center"
  valign="middle"/>
```

`valign`을 지정하지 않으면 병합 영역 상단에 텍스트가 붙어 표시되어 어색하게 보입니다.

## 병합과 정렬의 관계

Dataset에서 `sort()`나 `filter()`를 적용하면 행 순서가 변경됩니다. 병합은 연속된 행의 값 비교이므로, 정렬 후에는 병합 상태가 자동으로 재계산됩니다.

```javascript
function fn_sortByDept() {
  // 부서 기준 정렬 → 동일 부서가 연속 → 자동 병합
  this.ds_emp.sort("dept_cd A");
  // Grid는 Dataset 변경 시 자동으로 병합을 재계산합니다
}
```

반대로 무작위 정렬하면 동일 부서 행이 흩어져 병합이 해제됩니다. 병합이 필요한 경우 항상 데이터를 그룹 기준 컬럼으로 정렬한 뒤 표시해야 합니다.

## 선택 행과 병합의 상호작용

병합된 셀에서 특정 행을 클릭하면 Dataset의 `rowposition`은 클릭한 실제 행의 인덱스로 설정됩니다. 병합 셀을 클릭해도 여러 행이 선택되지 않고, 내부적으로는 개별 행이 유지됩니다.

```javascript
function grd_emp_oncellclick(obj, e) {
  // 병합 셀 클릭 시에도 e.row는 실제 Dataset 행 인덱스
  var deptNm = this.ds_emp.getColumn(e.row, "dept_nm");
  var empNm = this.ds_emp.getColumn(e.row, "emp_nm");
  trace("클릭 행: " + e.row + " | 부서: " + deptNm + " | 성명: " + empNm);
}
```

## 병합 해제 조건

다음 상황에서는 셀 병합이 자동으로 해제됩니다.
- 데이터를 필터링해 행이 비연속적으로 숨겨질 때
- Dataset에 새 행을 삽입할 때 (연속성 끊김)
- Grid를 새 Dataset으로 다시 바인딩할 때

병합이 실무 화면에서 의도대로 표시되지 않는다면 Dataset의 정렬 상태를 먼저 확인하세요.

## 실무 활용 패턴

가장 일반적인 사용 패턴은 부서-직원 목록처럼 상위-하위 그룹 구조입니다.

```xml
<Body>
  <!-- 상위 그룹: 부서 코드 기준 병합 -->
  <Cell col="0" datacolumn="dept_nm"
    mergeType="merge"
    mergeRule="dept_cd"
    halign="center" valign="middle"/>
  <!-- 하위 항목: 병합 없이 각 행 표시 -->
  <Cell col="1" datacolumn="emp_nm"/>
  <Cell col="2" datacolumn="job_title"/>
  <Cell col="3" datacolumn="sal_amt" halign="right"/>
</Body>
```

`mergeRule="dept_cd"`를 추가해 부서 코드 컬럼이 바뀔 때 병합 경계를 명확히 지정합니다. `dept_nm` 값이 우연히 같더라도 `dept_cd`가 다르면 병합되지 않아 안전합니다.

## 정리

Grid 셀 병합은 `mergeType="merge"`(세로) 또는 `mergeType="hmerge"`(가로)로 설정하고, `mergeRule`로 병합 기준 컬럼을 지정합니다. 세로 병합 시 `valign="middle"`을 반드시 함께 설정하고, 데이터가 그룹 기준 컬럼으로 정렬된 상태에서만 올바르게 동작합니다.

---

**지난 글:** [Nexacro N Grid Multi Header — 다중 헤더 구성](/posts/nexacro-n-grid-multi-header/)

**다음 글:** [Nexacro N Grid Fixed Columns — 고정 컬럼 설정](/posts/nexacro-n-grid-fixed-columns/)

<br>
읽어주셔서 감사합니다. 😊
