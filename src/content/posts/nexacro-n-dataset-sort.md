---
title: "[Nexacro N] Dataset 정렬(setSortByField) 가이드"
description: "Nexacro N Dataset의 setSortByField, setSortByIndex, setSort API로 단일·다중 컬럼 정렬을 구현하는 방법과 그리드 헤더 클릭 연동 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 8
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "dataset", "setSortByField", "setSortByIndex", "setSort", "sort", "multi-column-sort"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-dataset-filter/)에서 필터로 표시 행을 제한하는 방법을 익혔습니다. 데이터 목록에서 사용자가 원하는 기준으로 행을 재배열하는 기능이 **정렬**입니다. Nexacro N은 Dataset 레벨에서 `setSortByField()`, `setSortByIndex()`, `setSort()`를 제공합니다.

## setSortByField — 컬럼 이름으로 정렬

가장 기본적인 정렬 API입니다. 컬럼 이름과 방향(ASC/DESC)을 인수로 받습니다.

```javascript
// AMT 컬럼 내림차순 정렬
this.dsEmp.setSortByField("AMT", "DESC");

// EMP_NM 오름차순 정렬
this.dsEmp.setSortByField("EMP_NM", "ASC");
```

![Dataset 정렬 API 비교](/assets/posts/nexacro-n-dataset-sort-flow.svg)

## setSortByIndex — 컬럼 인덱스로 정렬

컬럼 인덱스(0-based)를 쓰는 버전입니다. 기능은 `setSortByField()`와 동일합니다.

```javascript
// 0번 컬럼(첫 번째 컬럼) 오름차순
this.dsEmp.setSortByIndex(0, "ASC");
```

## setSort — 다중 컬럼 정렬

여러 컬럼을 기준으로 정렬할 때는 `setSort()`를 씁니다. 콤마로 컬럼을 구분하고, `:A`(오름차순) 또는 `:D`(내림차순)로 방향을 지정합니다.

```javascript
// DEPT_CD 오름차순, 같은 DEPT_CD 안에서 AMT 내림차순
this.dsEmp.setSort("DEPT_CD:A,AMT:D");
```

![Dataset 다중 컬럼 정렬 코드](/assets/posts/nexacro-n-dataset-sort-code.svg)

## 그리드 헤더 클릭 연동

그리드의 `onheaderclick` 이벤트와 Dataset 정렬을 연결하면 사용자가 컬럼 헤더를 클릭할 때마다 정렬이 바뀝니다.

```javascript
function grdEmp_onheaderclick(obj, e) {
    // e.colid: 클릭된 컬럼 ID
    // e.sorttype: "asc" 또는 "desc" (자동 토글)
    this.dsEmp.setSortByField(e.colid, e.sorttype);
}
```

그리드 컴포넌트는 헤더 클릭 시 정렬 화살표 아이콘을 자동으로 표시하므로 별도 처리가 필요 없습니다.

## 정렬과 필터의 조합

정렬과 필터를 함께 쓸 수 있습니다. 적용 순서는 상관없으며 서로 독립적으로 동작합니다.

```javascript
// 부서가 D001인 행만 표시하면서 AMT 내림차순
this.dsEmp.setFilter("DEPT_CD == 'D001'");
this.dsEmp.setSortByField("AMT", "DESC");
```

## 정렬 해제

`setSortByField("")`나 `setSort("")`를 호출하면 정렬이 초기화됩니다.

```javascript
// 정렬 해제
this.dsEmp.setSortByField("", "");
```

## 커스텀 정렬 — 비교 함수 활용

단순 오름/내림차순 외에 복잡한 정렬 기준이 필요하면 스크립트에서 직접 구현할 수 있습니다.

```javascript
function fn_customSort() {
    var ds = this.dsEmp;
    // AMT로 정렬 후 동일 AMT는 EMP_NM 가나다순
    ds.setSort("AMT:D,EMP_NM:A");
}
```

## rowType과 정렬

정렬은 rowType에 영향을 주지 않습니다. 정렬 후 `transaction()`을 호출하면 각 행의 rowType에 따라 INSERT/UPDATE/DELETE가 서버로 정상 전송됩니다.

---

**지난 글:** [[Nexacro N] Dataset 필터(setFilter) 완전 정복](/posts/nexacro-n-dataset-filter/)

**다음 글:** [[Nexacro N] Dataset 그룹 집계 기능](/posts/nexacro-n-dataset-group/)

<br>
읽어주셔서 감사합니다. 😊
