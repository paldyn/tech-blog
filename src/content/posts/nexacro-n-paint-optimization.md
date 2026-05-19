---
title: "[Nexacro N] 화면 렌더링(Paint) 최적화"
description: "Nexacro N 애플리케이션에서 불필요한 화면 재렌더링을 줄이는 방법을 설명합니다. beginUpdate/endUpdate, set_visible 제어, Grid 갱신 최소화 패턴을 실무 코드와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 2
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "paint최적화", "렌더링", "beginUpdate", "endUpdate", "성능"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-large-dataset-handling/)에서 대용량 데이터 처리 전략을 살펴보았다. 데이터를 효율적으로 불러왔더라도 화면을 그리는 과정에서 병목이 생기면 사용자 경험은 나빠진다. 이번 글에서는 Nexacro N에서 화면 렌더링(Paint)이 불필요하게 반복되는 원인을 파악하고, 이를 줄이는 실무 패턴을 정리한다.

## Repaint가 왜 문제인가

Nexacro N의 UI 컴포넌트는 HTML5 Canvas 또는 DOM 위에서 렌더링된다. 속성이 변경될 때마다 해당 영역을 다시 계산하고 화면에 그린다(Repaint). 변경이 한두 건이라면 문제가 없지만, 루프 안에서 수백 건의 속성을 변경하거나, 짧은 시간에 show/hide를 반복하면 렌더링이 누적되어 UI가 버벅인다.

![화면 Repaint 원인과 최적화 전략](/assets/posts/nexacro-n-paint-optimization-causes.svg)

문제의 핵심은 "변경 횟수"가 아니라 "렌더링 횟수"다. 1,000건의 Dataset을 수정하더라도 렌더링이 단 한 번만 일어나도록 만들 수 있다. 바로 이것이 최적화의 목표다.

## beginUpdate / endUpdate

Dataset과 Grid 모두 `beginUpdate()`와 `endUpdate()`를 지원한다. `beginUpdate()`를 호출하면 이후의 데이터 변경이 화면에 즉시 반영되지 않고 내부 버퍼에 쌓인다. `endUpdate()`를 호출하는 순간 한 번에 렌더링된다.

![beginUpdate / endUpdate 패턴](/assets/posts/nexacro-n-paint-optimization-code.svg)

```javascript
// Dataset 배치 처리
function fnApplyTax() {
    var ds = this.dsList;
    ds.beginUpdate();
    for (var i = 0; i < ds.rowcount; i++) {
        var amt = ds.getColumn(i, "AMT");
        ds.setColumn(i, "CALC_AMT", amt * 1.1);
    }
    ds.endUpdate();
    // endUpdate() 이후 Grid가 한 번에 갱신됨
}
```

Grid에 직접 `beginUpdate`를 호출할 수도 있다. Dataset에 bind된 Grid라면 Dataset의 `beginUpdate`만으로 충분하지만, Grid 자체에 셀 스타일을 직접 변경하는 경우에는 Grid에도 적용한다.

```javascript
function fnColorize() {
    var grd = this.grdList;
    grd.beginUpdate();
    for (var i = 0; i < this.dsList.rowcount; i++) {
        var status = this.dsList.getColumn(i, "STATUS");
        if (status === "ERR") {
            grd.setCellProperty("body", i, 0, "color", "#e05555");
        }
    }
    grd.endUpdate();
}
```

try/catch와 함께 사용할 때는 예외가 발생해도 `endUpdate`가 반드시 호출되도록 작성한다. `endUpdate` 없이 `beginUpdate`만 호출되면 이후 화면이 갱신되지 않는 심각한 버그가 발생한다.

```javascript
function fnBatchProcess() {
    this.dsList.beginUpdate();
    try {
        for (var i = 0; i < this.dsList.rowcount; i++) {
            // ... 처리 로직
        }
    } catch (e) {
        trace("배치 처리 오류: " + e.message);
    } finally {
        this.dsList.endUpdate(); // 예외 발생 시에도 반드시 호출
    }
}
```

## set_visible 제어 패턴

컴포넌트를 숨겼다가 보여주는 과정에서도 레이아웃 재계산이 발생한다. 이를 줄이려면 처리가 완료된 이후에 한 번만 `set_visible(true)`를 호출한다.

```javascript
// 나쁜 패턴: visible 토글을 루프 안에서 반복
for (var i = 0; i < 10; i++) {
    this["edtField" + i].set_visible(condition[i]);
}

// 좋은 패턴: 먼저 숨기고, 다 처리한 뒤 한 번에 표시
this.divContainer.set_visible(false);
for (var i = 0; i < 10; i++) {
    this["edtField" + i].set_visible(condition[i]);
}
this.divContainer.set_visible(true);
```

부모 컨테이너(Div)를 숨기면 자식 컴포넌트의 변경이 화면에 즉시 반영되지 않는다. 모든 처리가 끝나고 컨테이너를 다시 보이게 하면 한 번의 레이아웃 계산으로 마무리된다.

## set_enable vs set_visible

`set_visible(false)`는 컴포넌트를 완전히 숨겨 레이아웃을 다시 계산해야 한다. 반면 `set_enable(false)`는 컴포넌트를 비활성화하되 자리를 유지하므로 레이아웃 재계산이 없다. 단순히 사용자 입력을 막고 싶을 때는 `set_enable(false)`가 훨씬 가볍다.

```javascript
// visible 대신 enable로 제어하면 레이아웃 재계산 없음
this.btnSave.set_enable(false);
this.btnDelete.set_enable(false);
// 저장 완료 후
this.btnSave.set_enable(true);
```

단, 화면 레이아웃이 컴포넌트 가시성에 따라 달라지는 경우에는 `set_visible`을 써야 한다. 그럴 때는 앞서 설명한 컨테이너 일괄 제어 패턴을 사용한다.

## Grid 직접 갱신 최소화

Grid에 bind된 Dataset이 변경되면 Grid는 자동으로 갱신된다. 여기에 추가로 `grdList.refresh()`를 호출하면 이중 렌더링이 발생한다.

```javascript
// 나쁜 패턴: Dataset 변경 후 Grid refresh까지 호출
this.dsList.setColumn(0, "NAME", "홍길동");
this.grdList.refresh(); // 이미 Dataset 변경으로 갱신됐는데 중복 호출

// 좋은 패턴: Dataset 변경만 하면 Grid는 자동 갱신
this.dsList.setColumn(0, "NAME", "홍길동");
// grdList.refresh() 불필요
```

`grdList.refresh()`는 Grid의 컬럼 구조나 스타일이 동적으로 바뀐 경우에만 명시적으로 호출한다.

## 조건부 스타일 변경 최적화

행 상태에 따라 색상을 바꾸는 요구는 흔하다. 이를 이벤트 핸들러에서 처리할 때는 변경이 실제로 필요한 경우에만 적용한다.

```javascript
// onchanged 이벤트에서 색상 조건부 변경
function dsList_onchanged(obj, e) {
    var nRow = e.row;
    var status = this.dsList.getColumn(nRow, "STATUS");

    // 이미 같은 색이면 skip (불필요한 repaint 방지)
    var newColor = status === "ERR" ? "#ffe0e0" : "#ffffff";
    var curColor = this.grdList.getCellProperty("body", nRow, 0, "color");
    if (curColor === newColor) return;

    this.grdList.setCellProperty("body", nRow, 0, "color", newColor);
}
```

## 폼 표시 최적화

팝업이나 탭 전환 시 폼이 새로 그려진다. 복잡한 폼은 표시될 때 모든 컴포넌트를 초기화하고 데이터를 세팅하는데, 이 과정에서 불필요한 이벤트가 연쇄적으로 발생할 수 있다.

```javascript
function form_onload(obj, e) {
    // 폼 로드 시 컴포넌트 초기화를 한 번에 배치 처리
    this.dsList.beginUpdate();
    this.fnInitDefaultValues();
    this.fnSetMasterData();
    this.dsList.endUpdate();
    // endUpdate 이후 전체 Grid가 한 번에 렌더링됨
}
```

## 타이머 기반 지연 렌더링

무거운 초기화 작업이 있을 때, `setTimeout(0)` 패턴으로 메인 스레드의 렌더링을 먼저 완료한 후 데이터를 로드하는 방법도 있다.

```javascript
function form_onload(obj, e) {
    // 레이아웃 먼저 그리고, 데이터는 다음 tick에 로드
    setTimeout(this.id + ".fnLoadData()", 0);
}

function fnLoadData() {
    this.transaction("INIT", svcUrl, "", "dsMain=dsMain", "", "cbInit");
}
```

이렇게 하면 사용자에게 빈 폼이라도 먼저 보여주고, 그다음에 데이터가 채워지는 느낌을 줄 수 있다. 체감 성능이 좋아진다.

## 정리

Nexacro N의 렌더링 최적화는 결국 "얼마나 자주 화면을 다시 그릴 것인가"를 제어하는 일이다. `beginUpdate/endUpdate`로 배치 처리하고, 컨테이너 단위로 show/hide를 제어하며, 불필요한 `refresh` 호출을 없애는 것만으로도 체감 속도가 크게 달라진다. 코드를 작성할 때마다 "이 변경이 렌더링을 몇 번 유발하는가"를 의식하는 습관을 들이자.

---

**지난 글:** [\[Nexacro N\] 대용량 데이터 처리 전략](/posts/nexacro-n-large-dataset-handling/)

**다음 글:** [\[Nexacro N\] 이벤트 핸들러 정리와 메모리 관리](/posts/nexacro-n-event-handler-cleanup/)

<br>
읽어주셔서 감사합니다. 😊
