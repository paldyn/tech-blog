---
title: "[Nexacro N] 레이아웃과 스타일 기초 — Nexacro N의 화면 배치 원리"
description: "Nexacro N에서 컴포넌트를 배치하는 좌표 모델(left/top/width/height), Anchor 속성, margin·padding, 그리고 style과 cssclass로 외관을 제어하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 6
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "레이아웃", "style", "anchor", "left", "top", "width", "cssclass", "배치"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-form-include/)에서 Include로 공통 UI 조각을 재사용하는 방법을 살펴봤습니다. 공통 조각을 만들든, 업무 화면을 설계하든, 컴포넌트를 화면에 배치하는 원리를 먼저 이해해야 합니다. Nexacro N은 HTML/CSS의 플렉스 박스나 그리드 레이아웃과 전혀 다른 방식을 씁니다. 웹 표준 방식에 익숙한 개발자라면 처음에 낯설게 느껴질 수 있지만, 규칙은 단순합니다.

## 절대 좌표 배치 모델

Nexacro N의 기본 배치 방식은 **절대 좌표(Absolute Positioning)**입니다. 모든 컴포넌트는 부모 컨테이너의 좌상단을 원점(0, 0)으로 하는 픽셀 좌표로 위치를 지정합니다.

```xml
<!-- 절대 좌표로 컴포넌트 배치 -->
<Static id="stcLabel"
        left="10" top="20"
        width="100" height="24"
        text="이름" />

<Edit id="edtName"
     left="120" top="20"
     width="200" height="24" />

<Button id="btnSearch"
        left="330" top="16"
        width="80" height="32"
        text="조회" />
```

`left`·`top`은 부모 컨테이너의 좌상단 모서리로부터의 거리이고, `width`·`height`는 컴포넌트 자체의 크기입니다. 단위는 픽셀(px)이며 숫자만 씁니다.

![Nexacro N 레이아웃 모델](/assets/posts/nexacro-n-layout-and-style-model.svg)

## right·bottom으로 우하단 기준 배치

`right`와 `bottom` 속성을 사용하면 부모 컨테이너의 **우측 또는 하단 기준** 거리로 위치를 지정할 수 있습니다. `anchors` 속성과 함께 사용하면 폼 크기가 변해도 위치가 유지됩니다.

```xml
<!-- 화면 우하단 모서리에서 10px 안쪽에 버튼 배치 -->
<Button id="btnClose"
        right="10" bottom="10"
        width="80" height="32"
        anchors="right bottom"
        text="닫기" />
```

`anchors="right bottom"`은 이 컴포넌트가 우측과 하단 기준으로 고정되어 있다는 선언입니다. 폼 크기가 변경되면 컴포넌트는 우하단으로부터의 거리를 유지하며 자동으로 이동합니다.

## width·height를 % 비율로 지정

픽셀 고정값 대신 부모 컨테이너 대비 비율(%)로 크기를 지정할 수도 있습니다.

```xml
<!-- 부모 너비의 50%를 차지하는 Grid -->
<Grid id="grdLeft"
      left="0" top="40"
      width="50%" height="calc(100% - 40)"
      anchors="left right top bottom" />
```

`calc()` 함수를 이용하면 고정값과 비율을 혼합할 수 있습니다. 예시의 `height="calc(100% - 40)"`은 부모 높이에서 40픽셀을 뺀 값입니다.

## Anchor — 크기 변화에 반응하는 배치

`anchors` 속성은 컴포넌트가 부모 컨테이너의 어느 변에 "고정"될지 지정합니다. `anchors`를 지정한 쪽의 가장자리로부터의 거리가 유지됩니다.

| anchors 값 | 동작 |
|------------|------|
| `"left"` | 좌측 고정 (기본) |
| `"right"` | 우측 고정 |
| `"top"` | 상단 고정 (기본) |
| `"bottom"` | 하단 고정 |
| `"left right"` | 좌우 모두 고정 → 폼 넓이 변화에 따라 width 자동 조정 |
| `"left right top bottom"` | 사방 고정 → 폼 크기 변화에 따라 컴포넌트도 함께 늘어남 |

```xml
<!-- 폼 크기가 변할 때 Grid가 사방으로 함께 늘어남 -->
<Grid id="grdMain"
      left="0" top="40"
      right="0" bottom="0"
      anchors="left right top bottom" />
```

이 패턴은 컨텐츠 영역을 화면 전체에 꽉 채우고 싶을 때 자주 씁니다.

## margin과 padding

`margin`은 컴포넌트 바깥의 여백이고, `padding`은 컴포넌트 내부의 여백입니다. CSS의 box model과 같은 개념입니다.

```xml
<!-- margin: 상 우 하 좌 (시계 방향) -->
<Div id="divPanel"
     left="0" top="0"
     width="400" height="200"
     margin="10 20 10 20"
     padding="16 16 16 16" />
```

`Div`나 `Form`에 `padding`을 주면 자식 컴포넌트들의 시작 좌표가 padding만큼 안쪽으로 밀립니다. 단, 자식 컴포넌트 개별 `left`·`top`은 padding을 고려해서 지정해야 합니다.

## style 속성 — 외관 제어

컴포넌트 외관은 `style` 속성으로 CSS 유사 문법을 사용해 지정합니다.

```xml
<!-- 인라인 style 속성으로 외관 지정 -->
<Static id="stcTitle"
        left="0" top="0"
        width="400" height="40"
        text="주문 목록"
        style="background:#1a2a3a;
               color:#e8e8e8;
               font-size:16px;
               font-weight:bold;
               padding-left:16px;
               valign:center;" />
```

Nexacro N의 style 속성은 CSS와 유사하지만 동일하지 않습니다. 지원 속성은 `background`, `color`, `font-size`, `font-weight`, `font-family`, `border`, `padding`, `valign` 등입니다.

![레이아웃·스타일 xfdl 코드](/assets/posts/nexacro-n-layout-and-style-code.svg)

## cssclass — 스타일 클래스 재사용

인라인 style 대신 `.css` 파일에 클래스를 정의해두고 `cssclass` 속성으로 참조하면 여러 컴포넌트에 일관된 스타일을 적용할 수 있습니다.

```css
/* theme/default.css */
.btn-primary {
    background: #1a4a8a;
    color: #ffffff;
    font-size: 13px;
    font-weight: bold;
    border: 1px solid #2a6ac8;
}

.input-error {
    border: 1px solid #e05555;
    background: #1f0d0d;
    color: #ff8080;
}
```

```xml
<!-- xfdl에서 cssclass 참조 -->
<Button id="btnSave"
        cssclass="btn-primary"
        text="저장" />

<Edit id="edtEmail"
     cssclass="input-error"
     value="" />
```

## 스크립트로 동적 스타일 변경

유효성 검사 실패, 상태 강조 등 런타임에 스타일을 바꿔야 할 때는 `set_style()`을 사용합니다.

```javascript
// 유효성 검사 실패 시 오류 강조
function fn_markError(comp) {
    comp.set_style("border:1px solid #e05555; " +
                   "background:#1f0d0d;");
}

// 오류 해제
function fn_clearError(comp) {
    comp.set_style("border:1px solid #333; " +
                   "background:#111;");
}

// 사용 예
function fn_validate() {
    if (!this.edtName.value) {
        fn_markError(this.edtName);
        return false;
    }
    fn_clearError(this.edtName);
    return true;
}
```

`set_style()`에 전달하는 문자열은 인라인 style 속성과 같은 포맷입니다.

## visible과 enable

컴포넌트 표시 여부와 활성화 여부도 레이아웃의 일부입니다.

```javascript
// 숨기기/보이기
this.divAdvSearch.set_visible(false); // visible="0"과 동일
this.divAdvSearch.set_visible(true);  // visible="1"

// 비활성화/활성화
this.btnSave.set_enable(false); // enable="false"
this.btnSave.set_enable(true);  // enable="true"
```

`visible`을 `false`로 하면 공간도 차지하지 않습니다(CSS의 `display:none`과 같은 효과). 공간을 유지하면서 투명하게 하려면 `set_style("color:transparent")`처럼 opacity를 조정합니다.

---

**지난 글:** [Form Include — 화면 조각을 재사용하는 include 기법](/posts/nexacro-n-form-include/)

**다음 글:** [Container vs Form — 컴포넌트 배치의 두 가지 방식](/posts/nexacro-n-container-vs-form/)

<br>
읽어주셔서 감사합니다. 😊
