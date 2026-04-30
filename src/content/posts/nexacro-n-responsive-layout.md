---
title: "[Nexacro N] 반응형 레이아웃 — 화면 크기 변화에 유연하게 대응하기"
description: "Nexacro N에서 폼 크기 변화에 반응하는 레이아웃을 구현하는 세 가지 전략 — Anchor 기반, onsize 이벤트, 브레이크포인트 전환 — 과 실전 코드 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 9
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "반응형", "onsize", "브레이크포인트", "레이아웃", "resize", "move"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-anchor-margin-padding/)에서 Anchor·Margin·Padding의 작동 원리를 살펴봤습니다. Anchor만으로도 기본적인 크기 변화 대응은 가능하지만, 실무에서는 보다 정교한 비율 제어나 특정 해상도에서의 레이아웃 전환이 필요한 경우가 많습니다. 이번 글에서는 Nexacro N의 반응형 레이아웃을 구현하는 세 가지 전략을 비교하고 실전 패턴을 소개합니다.

## 전략 1 — Anchor 기반 (권장 기본)

가장 간단한 방법입니다. 앞 글에서 다룬 `anchors` 속성으로 컴포넌트가 어느 변에 고정될지 선언하면 런타임 엔진이 자동으로 크기를 조정합니다.

```xml
<!-- 전체 너비를 채우는 헤더 -->
<Div id="divHeader"
     left="0" top="0"
     right="0" height="60"
     anchors="left right" />

<!-- 남은 공간 전체를 채우는 Grid -->
<Grid id="grdMain"
      left="0" top="100"
      right="0" bottom="0"
      anchors="left right top bottom" />
```

이 방식은 Studio N에서 속성만 설정하면 되므로 코드가 없고 유지보수가 쉽습니다. 단일 컬럼 레이아웃이나 단순 전체화면 폼에 적합합니다.

**한계**: 좌우 두 컬럼을 3:7 비율로 나누거나, 상하 분할을 고정 픽셀 + 나머지 비율 조합으로 하고 싶을 때는 Anchor만으로는 어렵습니다.

![Nexacro N 반응형 레이아웃 전략](/assets/posts/nexacro-n-responsive-layout-strategy.svg)

## 전략 2 — onsize 이벤트 (정밀 제어)

Form의 `onsize` 이벤트는 폼 크기가 변할 때마다 발생합니다. 이 이벤트 핸들러에서 스크립트로 컴포넌트 위치와 크기를 직접 계산해서 재배치합니다.

```javascript
// Form 크기가 변할 때마다 레이아웃 재계산
function Form_onsize(obj, e) {
    this.fn_relayout();
}

function fn_relayout() {
    var w = this.form.width;
    var h = this.form.height;
    var HEADER_H = 40;
    var SPLIT_GAP = 4;

    // 좌우 컬럼: 40% / 60% 비율 분할
    var leftW  = Math.floor(w * 0.4);
    var rightW = w - leftW - SPLIT_GAP;

    this.cfList.resize(leftW, h - HEADER_H);
    this.cfDetail.move(leftW + SPLIT_GAP, HEADER_H);
    this.cfDetail.resize(rightW, h - HEADER_H);
}
```

`fn_relayout()`을 `onload`에서도 호출해야 초기 화면 로드 시에도 레이아웃이 올바르게 잡힙니다.

```javascript
function Form_onload(obj, e) {
    this.gfn_init(this);
    this.fn_relayout(); // 초기 레이아웃 적용
    this.fn_search();
}
```

**성능 주의**: `onsize`는 리사이즈 중에 연속적으로 발생합니다. 무거운 연산(트랜잭션 호출 등)을 여기에 넣으면 성능에 문제가 생깁니다. `move()`·`resize()` 같은 단순 위치 조정만 수행해야 합니다.

## 전략 3 — 브레이크포인트 전환

특정 너비 기준으로 레이아웃 자체를 바꾸는 방식입니다. 동일한 화면을 데스크톱(사이드바 포함)과 컴팩트(사이드바 숨김) 두 가지 모드로 운영할 때 씁니다.

```javascript
// 브레이크포인트 기반 레이아웃 전환
function fn_applyBreakpoint(w) {
    var BREAKPOINT = 1280;

    if (w < BREAKPOINT) {
        // 컴팩트 모드: 사이드바 숨김
        this.divNav.set_visible(false);
        this.cfContent.move(0, 60);
        this.cfContent.resize(w, this.form.height - 60);
    } else {
        // 풀 모드: 사이드바 표시
        var NAV_W = 200;
        this.divNav.set_visible(true);
        this.cfContent.move(NAV_W, 60);
        this.cfContent.resize(w - NAV_W, this.form.height - 60);
    }
}

function Form_onsize(obj, e) {
    this.fn_applyBreakpoint(this.form.width);
}

function Form_onload(obj, e) {
    this.fn_applyBreakpoint(this.form.width);
    this.fn_search();
}
```

![반응형 레이아웃 구현 코드](/assets/posts/nexacro-n-responsive-layout-code.svg)

## 좌우 분할 화면 패턴

목록 + 상세를 좌우로 나누는 분할 화면은 실무에서 자주 쓰이는 패턴입니다.

```xml
<!-- MainFrame 내 분할 레이아웃 -->
<ChildFrame id="cfList"
            left="0" top="40"
            width="600" height="980" />
<Div id="divSplitter"
     left="600" top="40"
     width="4" height="980"
     style="background:#333;" />
<ChildFrame id="cfDetail"
            left="604" top="40"
            width="1116" height="980" />
```

이 구조에 `fn_relayout()`을 결합하면 창 크기 변화에 따라 두 ChildFrame이 적절한 비율을 유지합니다.

```javascript
function fn_relayout() {
    var w    = this.form.width;
    var h    = this.form.height - 40; // 헤더 높이 제외
    var SPLIT = 4;                     // 스플리터 너비

    // 목록: 전체 너비의 35%
    var listW = Math.max(300, Math.floor(w * 0.35));
    var detailW = w - listW - SPLIT;

    this.cfList.resize(listW, h);
    this.divSplitter.move(listW, 40);
    this.divSplitter.resize(SPLIT, h);
    this.cfDetail.move(listW + SPLIT, 40);
    this.cfDetail.resize(detailW, h);
}
```

## 스플리터 드래그 구현

사용자가 직접 드래그해서 분할 비율을 조정하는 스플리터도 구현할 수 있습니다.

```javascript
// 스플리터 드래그로 분할 비율 조정
var g_nSplitX = -1;

function divSplitter_onmousedown(obj, e) {
    g_nSplitX = e.clientX;
    obj.captureMouse(); // 마우스 캡처
}

function divSplitter_onmousemove(obj, e) {
    if (g_nSplitX < 0) return;
    var delta = e.clientX - g_nSplitX;
    g_nSplitX = e.clientX;

    var newListW = this.cfList.width + delta;
    newListW = Math.max(200, Math.min(newListW,
                                     this.form.width - 300));
    this.cfList.resize(newListW, this.cfList.height);
    this.fn_relayout(); // 나머지 컴포넌트 재배치
}

function divSplitter_onmouseup(obj, e) {
    g_nSplitX = -1;
    obj.releaseMouse();
}
```

## 전략 선택 가이드

| 상황 | 권장 전략 |
|------|-----------|
| 단일 컬럼, 전체 너비 채우기 | Anchor만으로 충분 |
| 두 컬럼 비율 분할 | onsize + fn_relayout() |
| 태블릿·PC 레이아웃 분기 | 브레이크포인트 전환 |
| 사용자 드래그 분할 | 스플리터 마우스 이벤트 |

실무 대부분은 Anchor + onsize 조합으로 해결됩니다. 브레이크포인트는 모바일이나 태블릿 접근까지 지원해야 하는 경우에 추가합니다.

---

**지난 글:** [Anchor·Margin·Padding — 컴포넌트 위치와 여백 완전 정복](/posts/nexacro-n-anchor-margin-padding/)

**다음 글:** [다중 해상도 지원 — DPI·해상도별 화면 최적화 전략](/posts/nexacro-n-multi-resolution/)

<br>
읽어주셔서 감사합니다. 😊
