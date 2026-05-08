---
title: "[Nexacro N] Dataset copyData·mergeData 완전 정복"
description: "Nexacro N Dataset의 copyData, appendData, mergeData API를 비교하고, 팝업 결과 반영·두 조회 결과 병합·선택 행 이동 등 실전 시나리오와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 10
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "dataset", "copyData", "appendData", "mergeData", "dataset-copy", "dataset-merge"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-dataset-group/)에서 그룹 집계 기능을 살펴봤습니다. 실무에서는 두 Dataset의 데이터를 합치거나, 팝업에서 선택한 결과를 메인 화면의 Dataset으로 옮기는 상황이 자주 발생합니다. Nexacro N이 제공하는 `copyData()`, `appendData()`, `mergeData()` 세 API를 정확히 구분하면 이런 상황을 간결하게 처리할 수 있습니다.

## 세 가지 API 비교

| API | 동작 | 기존 데이터 |
|-----|------|------------|
| `copyData(src)` | src 내용으로 완전 대체 | 삭제됨 |
| `appendData(src)` | src 행을 뒤에 추가 | 유지됨 |
| `mergeData(src, keyCol)` | 키 기준 업서트 | 유지됨 |

![Dataset 복사·병합 API 비교](/assets/posts/nexacro-n-dataset-copy-merge-flow.svg)

## copyData — 완전 덮어쓰기

대상 Dataset의 모든 행을 삭제하고 소스 Dataset의 내용으로 채웁니다. 컬럼 구조까지 복사합니다.

```javascript
// dsA의 내용을 dsB로 완전 복사
this.dsB.copyData(this.dsA);
// 이후 dsB는 dsA의 완전한 사본
```

주로 조회 결과를 임시 Dataset에 백업하거나, 팝업에서 부모로 단순히 결과를 전달할 때 씁니다.

## appendData — 뒤에 이어 붙이기

기존 행은 그대로 두고 소스 Dataset의 행을 마지막에 추가합니다. 추가된 행의 rowType은 **INSERT(2)**가 됩니다.

```javascript
// dsA 행을 dsB 뒤에 이어 붙임
this.dsB.appendData(this.dsA);
// dsB.rowcount = 기존 + dsA.rowcount
```

여러 조회 결과를 하나의 Dataset으로 합쳐서 그리드에 표시할 때 유용합니다.

![copyData · appendData · mergeData 코드](/assets/posts/nexacro-n-dataset-copy-merge-code.svg)

## mergeData — 키 기준 업서트

키 컬럼을 기준으로 소스 Dataset을 대상 Dataset에 병합합니다. 키가 일치하는 행은 UPDATE(4), 없는 행은 INSERT(2)로 추가됩니다.

```javascript
// CODE 컬럼을 키로 병합
this.dsB.mergeData(this.dsA, "CODE");
```

이후 `transaction()`을 호출하면 UPDATE·INSERT 행이 서버로 전송됩니다.

## 실전 시나리오 1 — 팝업 결과를 메인에 반영

```javascript
// 팝업에서 선택 확인 시
function btn_confirm_onclick(obj, e) {
    var selRow = this.dsResult.currentrow;
    if (selRow < 0) { alert("항목을 선택하세요."); return; }
    // 선택 행 1건을 임시 Dataset으로 복사
    var dsTemp = new Dataset();
    dsTemp.copyData(this.dsResult);
    dsTemp.setFilter("rowno == " + selRow);
    // 부모 Dataset에 전달
    opener.dsMain.appendData(dsTemp);
    dsTemp = null;
    this.close();
}
```

## 실전 시나리오 2 — 두 기간 조회 결과 합치기

```javascript
function fn_loadBothPeriods() {
    // 상반기 조회
    this.transaction("fn_q1", "SVC/query",
        "dsQ1=dsPeriod", "dsResult=dsQ1Result", "", "fn_q1_cb");
}

function fn_q1_cb(e) {
    if (e.errorCode != 0) return;
    // 하반기 조회 — appendData로 이어 붙임
    this.transaction("fn_q2", "SVC/query",
        "dsQ2=dsPeriod", "dsResult=dsQ2Result", "", "fn_q2_cb");
}

function fn_q2_cb(e) {
    if (e.errorCode != 0) return;
    // 상반기 결과에 하반기 결과 이어 붙임
    this.dsQ1Result.appendData(this.dsQ2Result);
    // 이제 dsQ1Result에 전체 데이터
}
```

## 실전 시나리오 3 — 서버 증분 갱신

```javascript
// 폴링으로 신규 데이터를 mergeData로 반영
function fn_refresh_cb(e) {
    if (e.errorCode != 0) return;
    // CODE 기준으로 기존 데이터에 병합
    this.dsMain.mergeData(this.dsNew, "CODE");
}
```

## copyData vs clearData + appendData

두 방법은 결과가 비슷해 보이지만 차이가 있습니다.

```javascript
// 방법 1: copyData (컬럼 구조까지 복사)
dsB.copyData(dsA);

// 방법 2: clearData + appendData (컬럼 구조 유지)
dsB.clearData();
dsB.appendData(dsA);
```

`dsB`에 이미 필요한 컬럼이 선언되어 있을 때는 방법 2가 안전합니다. `copyData()`는 컬럼 구조까지 덮어쓰므로 `dsB`에 `dsA`에 없는 ConstColumn이 있다면 사라질 수 있습니다.

---

**지난 글:** [[Nexacro N] Dataset 그룹 집계 기능](/posts/nexacro-n-dataset-group/)

<br>
읽어주셔서 감사합니다. 😊
