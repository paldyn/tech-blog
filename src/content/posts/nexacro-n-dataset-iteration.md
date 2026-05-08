---
title: "[Nexacro N] Dataset 행 순회 패턴"
description: "Nexacro N Dataset을 for 루프로 순회하는 기본 패턴부터 조건 순회, 변경 행만 걸러내는 패턴, deletedrowcount 활용까지 실무에서 자주 쓰는 순회 기법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 6
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "dataset", "iteration", "rowcount", "deletedrowcount", "getColumn", "getRowType"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-dataset-add-update-delete/)에서 행 추가·수정·삭제 API를 다뤘습니다. 데이터를 저장하거나 검증하려면 Dataset의 행을 하나씩 확인해야 합니다. Nexacro N Dataset에는 Iterator 같은 별도 API가 없어서 **`for` 루프와 인덱스 기반 접근**이 표준 패턴입니다.

## 기본 순회 — rowcount

`rowcount`는 현재 Dataset에 있는 행의 수입니다. DELETE(8) 상태 행은 포함되지 않으므로 일반적인 목적의 순회에 그대로 쓸 수 있습니다.

```javascript
for (var i = 0; i < ds.rowcount; i++) {
    var empCd = ds.getColumn(i, "EMP_CD");
    var empNm = ds.getColumn(i, "EMP_NM");
    trace(empCd + " / " + empNm);
}
```

![Dataset 행 순회 패턴 비교](/assets/posts/nexacro-n-dataset-iteration-pattern.svg)

## 조건 순회 — 특정 값인 행만 처리

특정 컬럼 값이 조건을 만족하는 행만 처리할 때는 루프 안에서 `continue`로 건너뜁니다.

```javascript
var total = 0;
for (var i = 0; i < ds.rowcount; i++) {
    if (ds.getColumn(i, "USE_YN") != "Y") continue;
    total += parseFloat(ds.getColumn(i, "AMT") || 0);
}
```

## 변경 행만 순회 — getRowType()

저장 전 유효성 검증은 INSERT·UPDATE 행만 대상으로 하면 충분합니다.

```javascript
var RT = Dataset.ROWTYPE;
for (var i = 0; i < ds.rowcount; i++) {
    if (ds.getRowType(i) == RT.NORMAL) continue; // 변경 없는 행 건너뜀
    var empNm = ds.getColumn(i, "EMP_NM");
    if (!empNm) {
        alert((i + 1) + "행: 사원명은 필수입니다.");
        return;
    }
}
```

![Dataset 순회 실전 코드](/assets/posts/nexacro-n-dataset-iteration-code.svg)

## DELETE 행 순회 — deletedrowcount

`rowcount`는 DELETE 상태의 행을 포함하지 않습니다. 삭제 대기 행에도 접근해야 할 때는 `deletedrowcount`와 `getDeletedRow()`를 씁니다.

```javascript
// DELETE 행 수 확인
trace("삭제 대기: " + ds.deletedrowcount);

// DELETE 행 순회 (별도 인덱스 필요)
for (var i = 0; i < ds.deletedrowcount; i++) {
    var row = ds.getDeletedRow(i);
    trace("삭제될 EMP_CD: " + row["EMP_CD"]);
}
```

## 역순 순회 — 삭제 시

루프 안에서 `deleteRow()`를 호출하면 인덱스가 밀립니다. 이 문제를 피하려면 반드시 **역순**으로 순회합니다.

```javascript
// 체크된 행 모두 삭제 (뒤에서 앞으로)
for (var i = ds.rowcount - 1; i >= 0; i--) {
    if (ds.getColumn(i, "CHK") == "Y") {
        ds.deleteRow(i);
    }
}
```

## 컬럼 인덱스 vs 컬럼 이름

`getColumn()`과 `setColumn()`은 컬럼 이름 문자열 대신 0-based 인덱스를 받기도 합니다. 이름을 쓰는 것이 가독성이 훨씬 좋지만, 루프 안에서 성능이 중요할 때는 `getColumn(i, 0)` 처럼 인덱스를 미리 결정해두고 쓰는 방법도 있습니다.

```javascript
// 컬럼 인덱스 미리 조회 (루프 전에 한 번만)
var colIdx = ds.getColIndex("EMP_NM");
for (var i = 0; i < ds.rowcount; i++) {
    var val = ds.getColumn(i, colIdx); // 이름 조회 없이 바로 접근
}
```

---

**지난 글:** [[Nexacro N] Dataset 행 추가·수정·삭제](/posts/nexacro-n-dataset-add-update-delete/)

**다음 글:** [[Nexacro N] Dataset 필터(setFilter) 완전 정복](/posts/nexacro-n-dataset-filter/)

<br>
읽어주셔서 감사합니다. 😊
