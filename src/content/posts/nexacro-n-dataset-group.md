---
title: "[Nexacro N] Dataset 그룹 집계 기능"
description: "Nexacro N Dataset의 addGroup·getGroupSummary·clearGroup API로 부서별·월별 집계를 구현하는 방법과 주의사항을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 9
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "dataset", "addGroup", "getGroupSummary", "groupcount", "clearGroup", "aggregation"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-dataset-sort/)에서 Dataset 정렬 방법을 다뤘습니다. 정렬로 데이터를 정리했다면 그 다음 단계는 **그룹별 집계**입니다. Dataset의 그룹 기능을 쓰면 서버 재조회 없이 클라이언트에서 부서별 합계, 월별 평균 같은 집계를 즉시 계산할 수 있습니다.

## 그룹 기능 개요

Dataset의 그룹 기능은 **동일한 값을 가진 연속된 행들을 하나의 그룹으로 묶어** 집계 값(합계·평균·최댓값·최솟값·건수)을 제공합니다. 연속된 행이 기준이므로 **정렬이 선행**되어야 합니다.

![Dataset 그룹 집계 구조](/assets/posts/nexacro-n-dataset-group-structure.svg)

## 사용 순서

1. 그룹 키 컬럼으로 `setSortByField()` 정렬
2. `addGroup(colName)` 으로 그룹 등록
3. `groupcount` 로 그룹 수 확인
4. `getGroupSummary()` 로 집계 값 조회

```javascript
// 1. 그룹 키로 정렬 (필수!)
this.dsEmp.setSortByField("DEPT_CD", "ASC");

// 2. 그룹 등록
this.dsEmp.addGroup("DEPT_CD");

// 3. 그룹 수 확인
trace("그룹 수: " + this.dsEmp.groupcount);
```

## getGroupSummary — 집계 조회

```javascript
var gc = this.dsEmp.groupcount;
for (var g = 0; g < gc; g++) {
    var sumAmt = this.dsEmp.getGroupSummary(g, "AMT", "sum");
    var avgAmt = this.dsEmp.getGroupSummary(g, "AMT", "avg");
    var cntRow = this.dsEmp.getGroupSummary(g, "AMT", "cnt");
    trace("그룹 " + g + ": 합계=" + sumAmt
        + ", 평균=" + avgAmt + ", 건수=" + cntRow);
}
```

집계 함수 키워드:

| 키워드 | 의미 |
|--------|------|
| `"sum"` | 합계 |
| `"avg"` | 평균 |
| `"max"` | 최댓값 |
| `"min"` | 최솟값 |
| `"cnt"` | 건수 |

![Dataset 그룹 집계 코드](/assets/posts/nexacro-n-dataset-group-code.svg)

## 그룹 내 행 범위 — getGroupStartRow / getGroupEndRow

특정 그룹에 속한 행들이 어느 인덱스 범위인지 알 수 있습니다.

```javascript
for (var g = 0; g < this.dsEmp.groupcount; g++) {
    var start = this.dsEmp.getGroupStartRow(g);
    var end   = this.dsEmp.getGroupEndRow(g);
    trace("그룹 " + g + ": 행 " + start + " ~ " + end);
    // 이 범위의 행에 setColumn으로 합계 값 등을 별도 컬럼에 채울 수 있음
}
```

## getGroupValue — 그룹 키 값 조회

```javascript
for (var g = 0; g < this.dsEmp.groupcount; g++) {
    var deptCd = this.dsEmp.getGroupValue(g, "DEPT_CD");
    trace("부서코드: " + deptCd);
}
```

## 다중 그룹 키

여러 컬럼을 기준으로 그룹을 만들 때는 `addGroup()`을 여러 번 호출합니다. 정렬도 같은 순서로 해야 합니다.

```javascript
// 부서 + 직급 두 단계 그룹
this.dsEmp.setSortByField("", "");
this.dsEmp.setSort("DEPT_CD:A,GRADE:A");
this.dsEmp.addGroup("DEPT_CD");
this.dsEmp.addGroup("GRADE");
```

## clearGroup — 그룹 해제

```javascript
this.dsEmp.clearGroup();
// 원본 데이터는 그대로 유지, 정렬도 유지됨
```

## 실전 활용: 부서별 집계 테이블 채우기

```javascript
function fn_calcDeptSummary() {
    var ds = this.dsEmp;
    ds.setSortByField("DEPT_CD", "ASC");
    ds.addGroup("DEPT_CD");
    // 요약 Dataset에 집계 결과 채우기
    this.dsSummary.clearData();
    for (var g = 0; g < ds.groupcount; g++) {
        var r = this.dsSummary.addRow();
        this.dsSummary.setColumn(r, "DEPT_CD",
            ds.getGroupValue(g, "DEPT_CD"));
        this.dsSummary.setColumn(r, "SUM_AMT",
            ds.getGroupSummary(g, "AMT", "sum"));
    }
    ds.clearGroup();
}
```

---

**지난 글:** [[Nexacro N] Dataset 정렬(setSortByField) 가이드](/posts/nexacro-n-dataset-sort/)

**다음 글:** [[Nexacro N] Dataset copyData·mergeData 완전 정복](/posts/nexacro-n-dataset-copy-merge/)

<br>
읽어주셔서 감사합니다. 😊
