---
title: "[Nexacro N] Anchor·Margin·Padding — 컴포넌트 위치와 여백 완전 정복"
description: "Nexacro N의 anchors 속성으로 컴포넌트를 화면 크기 변화에 유연하게 고정하는 방법, margin과 padding으로 여백을 제어하는 방법, 그리고 런타임 위치 변경 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 8
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "anchors", "margin", "padding", "레이아웃", "컴포넌트 배치", "resize"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-container-vs-form/)에서 Container와 Form의 역할을 구분하는 기준을 살펴봤습니다. 컴포넌트를 배치할 때 단순히 좌표와 크기를 고정하는 것만으로는 부족한 경우가 많습니다. 창 크기가 달라지거나 다른 UI 요소가 열리고 닫힐 때 컴포넌트가 적절하게 반응해야 합니다. `anchors`는 Nexacro N에서 이 문제를 해결하는 핵심 속성이며, `margin`과 `padding`은 여백을 정교하게 제어합니다.

## anchors 속성 이해

`anchors` 속성은 컴포넌트가 부모 컨테이너의 어느 **변(edge)에 고정**될지 선언합니다. 고정된 변으로부터의 거리가 유지되고, 반대쪽은 부모 크기 변화에 따라 자유롭게 움직입니다.

기본값은 `"left top"`이라서 아무것도 지정하지 않으면 부모 좌상단으로부터의 거리가 고정됩니다. 이것이 절대 좌표 배치의 기본 동작입니다.

```xml
<!-- anchors 없음 (기본: left top) -->
<Button id="btnSearch"
        left="10" top="8"
        width="80" height="32"
        text="조회" />
<!-- 부모 크기가 변해도 이 버튼은 left=10, top=8 위치를 유지 -->
```

![Anchor · Margin · Padding 시각화](/assets/posts/nexacro-n-anchor-margin-padding-visual.svg)

## anchors 조합별 동작

### left right — 너비 자동 조정

```xml
<!-- 검색 바: 좌우 고정 → 폼 너비에 따라 너비가 늘어남 -->
<Div id="divSearchBar"
     left="0" top="0"
     right="0" height="40"
     anchors="left right" />
```

`left="0" right="0" anchors="left right"`는 부모의 전체 너비를 채우는 가장 간단한 패턴입니다. 폼 너비가 1280이든 1920이든 Div가 자동으로 가득 찹니다.

### right bottom — 우하단 고정

```xml
<!-- 닫기 버튼: 항상 우하단에 위치 -->
<Button id="btnClose"
        right="16" bottom="16"
        width="80" height="32"
        anchors="right bottom"
        text="닫기" />
```

팝업의 닫기·확인 버튼처럼 항상 우하단에 붙어있어야 하는 컴포넌트에 씁니다.

### left right top bottom — 전체 영역 채우기

```xml
<!-- Grid: 버튼 바 아래 남은 공간 전체 채우기 -->
<Grid id="grdMain"
      left="0" top="40"
      right="0" bottom="0"
      anchors="left right top bottom" />
```

이 선언의 의미: 좌측에서 0px, 위에서 40px, 우측에서 0px, 아래에서 0px 위치가 고정됩니다. 결과적으로 상단 40px를 제외한 나머지 공간 전체를 채웁니다. 폼 크기가 달라지면 Grid도 함께 늘어납니다.

## margin — 바깥 여백

`margin`은 컴포넌트와 인접 컴포넌트 또는 부모 경계 사이의 바깥 여백입니다. CSS의 margin과 같은 개념으로, 상·우·하·좌 순서(시계 방향)로 4개 값을 공백으로 구분해 지정합니다.

```xml
<!-- 버튼에 여백 추가 -->
<Button id="btnSave"
        left="10" top="8"
        width="80" height="32"
        margin="4 8 4 8"
        text="저장" />
<!-- 위아래 4px, 좌우 8px 바깥 여백 -->
```

단일 값으로 지정하면 4방향 모두 같은 값이 적용됩니다.

```xml
<Button margin="8" />
<!-- 상하좌우 모두 8px -->
```

## padding — 안쪽 여백

`padding`은 Div, Form 같은 Container 컴포넌트에서 자식 컴포넌트가 시작되는 안쪽 경계를 안으로 들여보냅니다.

```xml
<!-- Div에 padding 적용 -->
<Div id="divCard"
     left="0" top="0"
     width="400" height="200"
     padding="16 16 16 16"
     style="background:#1a1a2e; border:1px solid #333;">
  <Objects>
    <!-- 자식 컴포넌트는 padding 영역 안에서 배치됨 -->
    <Static id="stcTitle"
            left="0" top="0"
            text="카드 제목" />
  </Objects>
</Div>
```

padding이 적용된 Div 안에서 자식 컴포넌트의 `left="0"`은 Div 경계로부터 16px 안쪽이 됩니다. 단, 이 동작은 컴포넌트에 따라 다를 수 있으므로 Studio N에서 렌더링 결과를 확인하는 것이 좋습니다.

## 런타임 위치·크기 변경

스크립트에서 컴포넌트의 위치와 크기를 동적으로 바꿀 수 있습니다.

```javascript
// move(left, top): 위치 변경
this.grdMain.move(0, 80);

// resize(width, height): 크기 변경
this.grdMain.resize(1720, 940);

// set_left, set_top, set_width, set_height: 개별 변경
this.grdMain.set_top(80);
this.grdMain.set_height(this.form.height - 80);
```

검색 조건 패널이 토글되어 높이가 변할 때 Grid의 top과 height를 재조정하는 패턴에서 자주 씁니다.

```javascript
// 검색 패널 토글 시 Grid 위치 조정
function fn_toggleSearchPanel() {
    var searchH = this.divSearch.visible ? 60 : 0;
    this.divSearch.set_visible(!this.divSearch.visible);

    var newTop = 40 + (this.divSearch.visible ? 60 : 0);
    var newH   = this.form.height - newTop;
    this.grdMain.move(0, newTop);
    this.grdMain.resize(this.form.width, newH);
}
```

![Anchor·Margin·Padding 코드 패턴](/assets/posts/nexacro-n-anchor-margin-padding-code.svg)

## 자주 하는 실수

**right·bottom만 지정하고 anchors 누락**: `right="0" bottom="0"`을 지정해도 `anchors="right bottom"`이 없으면 left/top 기준으로 배치됩니다. `right`·`bottom`은 anchors와 함께 써야 의미가 있습니다.

**절대 좌표와 앵커 혼용 충돌**: `left="100" right="0" anchors="left right"`처럼 쓰면 left와 right 양쪽 거리가 함께 고정되어 width는 `폼너비 - left값 - right값`으로 자동 계산됩니다. 이 경우 `width`를 별도로 지정해봤자 무시됩니다.

**Div padding이 자식 left에 영향**: padding이 있는 Div 안에서 자식의 `left="0"`이 Div 내부 경계 기준인지 패딩 안쪽 기준인지 혼동하는 경우가 있습니다. Studio N 미리보기로 실제 렌더링 위치를 항상 확인하세요.

---

**지난 글:** [Container vs Form — 컴포넌트 배치의 두 가지 방식](/posts/nexacro-n-container-vs-form/)

**다음 글:** [반응형 레이아웃 — 화면 크기 변화에 유연하게 대응하기](/posts/nexacro-n-responsive-layout/)

<br>
읽어주셔서 감사합니다. 😊
