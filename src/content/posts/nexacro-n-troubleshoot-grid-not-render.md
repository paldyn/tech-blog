---
title: "[Nexacro N] 트러블슈팅: Grid가 렌더링되지 않을 때"
description: "Nexacro N에서 Grid 컴포넌트가 데이터를 표시하지 않는 문제를 진단하고 해결하는 방법을 설명합니다. Dataset 연결, binddataset 속성, GridFormat, 렌더 타이밍 문제를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 8
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "트러블슈팅", "Grid", "렌더링", "binddataset", "GridFormat", "setRedraw"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-troubleshoot-empty-dataset/)에서 Dataset이 비어 있는 문제를 다루었다. 이번에는 Dataset에는 데이터가 있는데 **Grid가 아무것도 표시하지 않는 문제**를 살펴본다. `dsResult.rowcount`를 출력했을 때 정상적인 건수가 찍히는데도 Grid가 비어 보일 때의 원인과 해결책이다.

## Grid 렌더링 파이프라인

Grid가 데이터를 표시하기까지는 네 단계를 거친다.

![Grid 렌더링 파이프라인](/assets/posts/nexacro-n-troubleshoot-grid-not-render-pipeline.svg)

이 파이프라인의 각 단계를 하나씩 확인하면 원인을 빠르게 좁힐 수 있다.

## 체크 1: binddataset 속성

Grid의 `binddataset` 속성이 실제 Dataset 이름과 정확히 일치하는지 확인한다.

```javascript
// 코드로 binddataset 확인 및 설정
trace("binddataset: " + grd_result.binddataset);

// binddataset이 비어 있다면 코드로 설정
grd_result.set_binddataset("dsResult");
```

Studio에서는 Grid를 선택하고 Properties 창의 `binddataset` 항목에서 직접 입력한다. Dataset 이름은 대소문자를 구분한다.

## 체크 2: GridFormat 컬럼 정의

GridFormat에 컬럼이 하나도 정의되어 있지 않으면 데이터가 있어도 표시되지 않는다.

```javascript
// 컬럼 수 확인
trace("Grid 컬럼 수: " + grd_result.formats.getCount());
```

Studio에서 Grid를 더블클릭하면 Format Editor가 열린다. Head/Body/Summary에 컬럼이 정의되어 있는지 확인한다. Body 컬럼의 `bindcolumn` 속성도 Dataset 컬럼 이름과 일치해야 한다.

## 체크 3: 렌더 타이밍 (가장 흔한 원인)

Dataset에 데이터가 있는데도 Grid가 비어 보이는 가장 흔한 원인은 **트랜잭션 콜백 전에 Grid 갱신을 시도**하는 것이다.

![Grid 렌더링 수동 갱신 패턴](/assets/posts/nexacro-n-troubleshoot-grid-not-render-fix.svg)

```javascript
// 문제: 응답을 기다리지 않음
function fn_search() {
    this.transaction("search", url,
        "dsInput=dsSearch", "dsOut=dsResult", "", "");

    // ← 이 시점에는 dsResult가 아직 비어 있음
    grd_result.setRedraw(true); // 소용없음
}

// 해결: 콜백에서 처리
function fn_search() {
    this.transaction("search", url,
        "dsInput=dsSearch", "dsOut=dsResult",
        "", "fn_searchCb");
}

function fn_searchCb(svcId, errCode, errMsg) {
    if (errCode != 0) { gfn_alert(errMsg); return; }
    // 이 시점에 dsResult에 데이터가 채워짐
    // binddataset이 설정되어 있으면 자동 갱신됨
    // 수동 갱신이 필요한 경우
    grd_result.setRedraw(true);
}
```

## 체크 4: Grid visible / 크기

Grid 자체의 `visible`, `width`, `height`를 확인한다.

```javascript
trace("grd visible: " + grd_result.visible);
trace("grd width:   " + grd_result.width);
trace("grd height:  " + grd_result.height);
```

부모 컨테이너의 크기가 0이거나 overflow hidden 상태라면 Grid가 표시되지 않는다.

## 체크 5: 필터/정렬 상태

코드에서 `setFilter` 또는 `setSort`를 호출한 경우, 모든 행이 필터링되어 표시되지 않는 것일 수 있다.

```javascript
// 필터 해제
dsResult.clearFilter();

// 정렬 해제
dsResult.clearSort();

// 현재 필터 확인
trace("filter: " + dsResult.filterstr);
```

## 강제 갱신 방법

위 모든 체크 후에도 Grid가 표시되지 않는다면 강제 갱신을 시도한다.

```javascript
function fn_forceRedraw() {
    // binddataset 재연결
    grd_result.set_binddataset("");
    grd_result.set_binddataset("dsResult");

    // 또는 setRedraw 강제 호출
    grd_result.setRedraw(true);

    trace("강제 갱신 후 rowcount: " + dsResult.rowcount);
}
```

## 정리: Grid 렌더링 체크리스트

| 확인 항목 | 확인 방법 |
|----------|----------|
| binddataset 이름 일치 | Properties 창 또는 `trace(grd.binddataset)` |
| GridFormat 컬럼 정의 | Format Editor 열기 |
| 데이터 접근 타이밍 | 콜백 이후에만 접근 |
| Grid visible/크기 | Properties 또는 trace |
| 필터/정렬 상태 | `dsResult.filterstr` 확인 |

---

**지난 글:** [트러블슈팅: 빈 Dataset](/posts/nexacro-n-troubleshoot-empty-dataset/)

**다음 글:** [트러블슈팅: 메모리 누수](/posts/nexacro-n-troubleshoot-memory-leak/)

<br>
읽어주셔서 감사합니다. 😊
