---
title: "[Nexacro N] Grid Sort & Filter — 정렬과 필터"
description: "Nexacro N Grid의 headersort로 컬럼 클릭 정렬을 활성화하고, Dataset.sort()와 Dataset.filter()로 데이터를 정렬/필터링하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 8
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "grid", "sort", "filter", "headersort", "dataset", "정렬", "필터"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-grid-grouping/)에서 그룹핑 처리 방법을 살펴봤습니다. 이번에는 Grid에서 정렬과 필터를 처리하는 방법을 다룹니다. 헤더 클릭으로 컬럼을 정렬하는 `headersort`와 Dataset의 `sort()`, `filter()` 함수를 중심으로 설명합니다.

## 정렬과 필터의 원리

Nexacro N에서 정렬과 필터는 Grid가 아닌 **Dataset**에 적용됩니다. Dataset의 행 순서와 가시성이 변경되면 Grid가 자동으로 재렌더링됩니다. 데이터 자체는 삭제되거나 복사되지 않고, 보여주는 순서와 표시 여부만 바뀝니다.

![Grid 정렬과 필터 동작 구조](/assets/posts/nexacro-n-grid-sort-filter-concept.svg)

## headersort — 헤더 클릭 정렬

`headersort="true"`를 Grid에 설정하면 사용자가 컬럼 헤더를 클릭할 때마다 해당 컬럼 기준으로 정렬이 토글됩니다.

```xml
<Grid id="grd_emp"
  headersort="true"
  bindDataset="ds_emp">
</Grid>
```

클릭 순서: 오름차순(▲) → 내림차순(▼) → 정렬 해제 → 다시 오름차순... 순으로 반복됩니다. 헤더 셀에 정렬 방향 아이콘이 자동으로 표시됩니다.

특정 컬럼만 정렬을 허용하거나 금지하려면 HeadCell에 `headersort` 속성을 개별 지정합니다.

```xml
<Head>
  <HeadCell col="0" text="사번" headersort="false"/>
  <HeadCell col="1" text="성명" headersort="true"/>
  <HeadCell col="2" text="급여" headersort="true"/>
</Head>
```

## Dataset.sort() — 스크립트 정렬

스크립트에서 직접 정렬을 적용하려면 `Dataset.sort()`를 사용합니다.

```javascript
function fn_sortBySalary(ascending) {
  var dir = ascending ? "A" : "D";
  this.ds_emp.sort("sal_amt " + dir);
}

function fn_multiSort() {
  // 부서 오름차순, 급여 내림차순 복합 정렬
  this.ds_emp.sort("dept_cd A, sal_amt D");
}
```

`sort()` 문법: `"컬럼명 A|D"`. 복합 정렬은 쉼표로 구분합니다.

정렬 후 Dataset의 실제 데이터는 보존됩니다. 행의 순서만 변경됩니다.

![정렬/필터 구현 코드](/assets/posts/nexacro-n-grid-sort-filter-code.svg)

## Dataset.filter() — 조건 필터

`filter()`는 조건에 맞는 행만 보이고, 나머지 행은 숨깁니다. 조건식은 자바스크립트 비교 연산자를 사용합니다.

```javascript
function fn_filterByDept(deptCd) {
  if (deptCd == "") {
    // 필터 해제
    this.ds_emp.filter("");
  } else {
    // 부서 코드 필터
    this.ds_emp.filter("dept_cd == '" + deptCd + "'");
  }
}

function fn_filterHighSalary(minSal) {
  // 급여 범위 필터
  this.ds_emp.filter("sal_amt >= " + minSal);
}

function fn_filterMultiCondition() {
  // AND 조건: 개발팀이면서 급여 4000000 이상
  this.ds_emp.filter(
    "dept_cd == '개발' && sal_amt >= 4000000"
  );
}
```

빈 문자열 `filter("")`를 전달하면 필터가 해제되어 모든 행이 다시 표시됩니다.

## 필터 조건식 문법

| 연산자 | 의미 | 예시 |
|---|---|---|
| `==` | 같음 | `dept_cd == '개발'` |
| `!=` | 다름 | `status != 'N'` |
| `>`, `>=` | 크다/이상 | `sal_amt >= 3500000` |
| `<`, `<=` | 작다/이하 | `age <= 30` |
| `&&` | AND | `dept_cd == '개발' && age >= 25` |
| `\|\|` | OR | `dept_cd == '개발' \|\| dept_cd == '기획'` |
| `contains()` | 포함 | `contains(emp_nm, '김')` |

```javascript
function fn_filterByName(keyword) {
  if (keyword == "") {
    this.ds_emp.filter("");
    return;
  }
  // 성명에 키워드 포함 여부
  this.ds_emp.filter("contains(emp_nm, '" + keyword + "')");
}
```

## 검색 UI와 연동 패턴

실무에서는 검색 조건 입력 후 버튼 클릭 시 필터를 적용하는 패턴이 가장 일반적입니다.

```javascript
function btn_search_onclick(obj, e) {
  var deptCd = this.combo_dept.value;
  var minSal = this.edt_minSal.value;
  var empNm = this.edt_empNm.value;

  var filterStr = "";

  if (deptCd != "") {
    filterStr += "dept_cd == '" + deptCd + "'";
  }
  if (minSal != "") {
    if (filterStr != "") filterStr += " && ";
    filterStr += "sal_amt >= " + minSal;
  }
  if (empNm != "") {
    if (filterStr != "") filterStr += " && ";
    filterStr += "contains(emp_nm, '" + empNm + "')";
  }

  this.ds_emp.filter(filterStr);
}
```

검색 조건마다 부분 필터를 AND로 연결해 종합 필터 문자열을 만든 뒤 한 번에 적용합니다.

## 필터와 집계

`filter()`를 적용하면 Grid footer의 집계(sumtext, avgtext, counttext)도 자동으로 재계산됩니다. 필터된 행만을 기준으로 합계·평균·건수가 다시 계산되어 표시됩니다.

```javascript
function fn_filterDeptAndShowSum(dept) {
  this.ds_emp.filter("dept_cd == '" + dept + "'");
  // footer의 합계·평균·건수가 자동으로 필터 결과 기준으로 갱신됨
}
```

## 정렬과 필터 동시 적용

정렬과 필터는 독립적으로 동작하므로 동시에 적용할 수 있습니다. 일반적으로 필터 후 정렬하는 순서를 권장합니다.

```javascript
function fn_filterAndSort() {
  // 1. 필터 먼저
  this.ds_emp.filter("dept_cd == '개발'");
  // 2. 정렬 나중
  this.ds_emp.sort("sal_amt D");
}
```

## 서버사이드 검색과의 차이

클라이언트 필터(`Dataset.filter()`)는 이미 로드된 데이터 안에서 조건을 적용합니다. 반면 서버사이드 검색은 트랜잭션을 통해 서버에서 새 데이터를 받아오는 방식입니다.

- **클라이언트 필터**: 이미 받은 데이터 안에서 빠른 필터링. 추가 서버 요청 없음
- **서버사이드 검색**: 조건을 서버로 전송해 필터된 데이터를 새로 받음. 대용량 데이터에 적합

업무 시스템에서는 초기 조회 시 서버사이드 검색으로 데이터를 가져오고, 추가적인 세부 필터링은 클라이언트 필터로 처리하는 조합을 많이 사용합니다.

## 정리

`headersort="true"`로 헤더 클릭 정렬을 활성화하고, `Dataset.sort()`로 스크립트에서 직접 정렬합니다. `Dataset.filter(조건식)`으로 조건에 맞는 행만 표시하고, `filter("")`로 해제합니다. 필터 적용 시 footer 집계도 자동 재계산됩니다.

---

**지난 글:** [Nexacro N Grid Grouping — 그룹핑 처리](/posts/nexacro-n-grid-grouping/)

**다음 글:** [Nexacro N Grid Paging — 페이징 처리](/posts/nexacro-n-grid-paging/)

<br>
읽어주셔서 감사합니다. 😊
