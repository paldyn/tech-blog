---
title: "[Nexacro N] Dataset 탐색 함수 완전 정복 — find·findRow·findRowExpr"
description: "Nexacro N Dataset의 find, findRow, findRowExpr, getRowPosition API를 비교하고, 순환 탐색·복합 조건·필터 후 이동 등 실전 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 1
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "dataset", "find", "findRow", "findRowExpr", "dataset-search"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-dataset-copy-merge/)에서 Dataset 간 복사·병합 API를 살펴봤습니다. 조회된 데이터 안에서 특정 조건을 만족하는 행을 빠르게 찾아야 할 때가 있습니다. Nexacro N은 `find()`, `findRow()`, `findRowExpr()`, `getRowPosition()` 네 가지 탐색 함수를 제공합니다. 이름이 비슷해 혼동하기 쉽지만 각자 다른 시나리오에 최적화되어 있습니다.

## 네 함수 한눈에 비교

![Dataset 탐색 함수 한눈에 보기](/assets/posts/nexacro-n-dataset-find-functions-api.svg)

`find(startRow, col, val)`는 지정한 행 번호부터 검색을 시작한다는 점에서 나머지와 구별됩니다. `findRow(col, val)`는 항상 0번 행부터 시작해 첫 번째 일치를 반환합니다. `findRowExpr(expr)`는 컬럼명을 직접 쓴 표현식으로 복합 조건을 지정할 수 있습니다. `getRowPosition(originalrow)`는 필터가 적용된 상태에서 원본 행 번호를 필터 내 위치로 변환할 때 씁니다.

## findRow — 가장 기본적인 탐색

단일 컬럼의 값이 특정 값과 일치하는 첫 번째 행을 찾습니다.

```javascript
// CODE 컬럼이 'A001'인 첫 번째 행 찾기
var nRow = this.dsMain.findRow("CODE", "A001");
if (nRow < 0) {
    alert("해당 코드가 없습니다.");
    return;
}
this.dsMain.setRow(nRow); // 해당 행으로 이동
```

반환값이 `-1`이면 일치하는 행이 없다는 의미입니다. 그리드에 바인딩된 경우 `setRow()` 호출만으로 그리드 포커스도 자동으로 이동됩니다.

## find — 현재 행 이후 순방향 탐색

`find()`는 `startRow` 파라미터 덕분에 "다음 찾기" 기능을 구현하기에 적합합니다.

```javascript
function fn_findNext(searchVal) {
    var startRow = this.dsMain.currentrow + 1;
    var nRow = this.dsMain.find(startRow, "NAME", searchVal);
    if (nRow == -1) {
        alert("더 이상 결과가 없습니다.");
        return;
    }
    this.dsMain.setRow(nRow);
}
```

`startRow`에 `0`을 넣으면 처음부터, `currentrow + 1`을 넣으면 현재 행 다음부터 검색합니다. 마지막 행에서 `-1`이 반환되면 탐색 종료로 처리하거나, 다시 0부터 순환할 수 있습니다.

## findRowExpr — 복합 조건 탐색

단일 컬럼 값 비교로 부족할 때 표현식을 문자열로 전달합니다. Dataset 필터 표현식과 동일한 문법을 사용합니다.

```javascript
// AMT가 1000 초과이고 STATUS가 'A'인 첫 행
var expr = "AMT > 1000 && STATUS == 'A'";
var nRow = this.dsMain.findRowExpr(expr);
if (nRow >= 0) {
    this.dsMain.setRow(nRow);
}
```

표현식 안에서 컬럼명을 그대로 사용합니다. 문자열 비교는 `==` (단순 동등), 숫자 비교는 `>`, `<`, `>=`, `<=` 모두 사용 가능합니다.

![find 함수 실전 패턴](/assets/posts/nexacro-n-dataset-find-functions-code.svg)

## getRowPosition — 필터 후 행 위치 변환

Dataset에 필터가 적용된 상태에서는 원본 행 번호와 필터 내 행 번호가 다릅니다. `getRowPosition(originalrow)`는 원본 행 번호를 현재 필터 기준 행 번호로 변환합니다.

```javascript
// findRow로 원본 행 번호를 얻고
var originalRow = this.dsMain.findRow("CODE", "B002");

// 필터가 적용된 상태에서 그리드 포커스 이동
var filteredRow = this.dsMain.getRowPosition(originalRow);
if (filteredRow >= 0) {
    this.dsMain.setRow(filteredRow);
}
```

필터가 없을 때는 원본 행 번호와 같은 값을 반환합니다.

## 여러 행 일치 — 반복 탐색 패턴

`find()` 또는 `findRowExpr()`는 첫 번째 일치만 반환합니다. 조건에 맞는 모든 행을 처리하려면 반복문을 씁니다.

```javascript
function fn_processAllMatched() {
    var startRow = 0;
    while (true) {
        var nRow = this.dsMain.find(startRow, "STATUS", "N");
        if (nRow < 0) break;
        // 찾은 행 처리
        this.dsMain.setColumn(nRow, "STATUS", "P");
        startRow = nRow + 1; // 다음 행부터 계속
    }
}
```

## 성능 고려사항

탐색 함수는 내부적으로 순차 탐색입니다. 행 수가 수만 건이 넘으면 `findRowExpr()`보다 JavaScript 루프와 조건 분기가 빠를 수 있습니다. 대용량 Dataset에서는 서버에서 필터링하거나 `setFilter()`로 미리 범위를 줄인 뒤 탐색하는 것이 효율적입니다.

---

**지난 글:** [[Nexacro N] Dataset copyData·mergeData 완전 정복](/posts/nexacro-n-dataset-copy-merge/)

**다음 글:** [[Nexacro N] Dataset loadXml로 클라이언트 데이터 초기화하기](/posts/nexacro-n-dataset-loadxml/)

<br>
읽어주셔서 감사합니다. 😊
