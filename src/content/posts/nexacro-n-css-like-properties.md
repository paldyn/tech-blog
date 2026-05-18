---
title: "[Nexacro N] CSS 유사 속성"
description: "Nexacro N의 ESS(Extended Style Sheet)에서 사용하는 CSS 유사 속성 문법과 적용 방법을 설명합니다. background, color, border, font, padding 속성, 상태별 스타일(:mouseover, :disable, :focus), cssclass 활용 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 7
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "ESS", "CSS", "스타일", "cssclass", "테마", "상태스타일"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-theme-system/)에서 테마 시스템을 살펴보았다. 이번에는 Nexacro N의 스타일 정의에 사용하는 ESS 파일의 CSS 유사 속성을 자세히 다룬다. CSS를 알고 있다면 친숙하게 느껴지겠지만, 문법과 지원 범위에서 몇 가지 중요한 차이가 있다.

## ESS와 CSS의 관계

ESS(Extended Style Sheet)는 Nexacro N 전용 스타일 시트 형식이다. 속성명 대부분은 CSS와 동일하지만, 값 표기 방식과 지원되는 속성 범위가 다르다. 특히 **레이아웃 관련 CSS 속성(`display`, `position`, `flex`)은 지원하지 않는다**. Nexacro N의 레이아웃은 절대 좌표(x, y, width, height)로만 제어한다.

![CSS 유사 속성 개요](/assets/posts/nexacro-n-css-like-properties-overview.svg)

## 주요 속성 문법

### 배경(background)

```css
/* 단색 배경 */
Button { background: "#4a90e2"; }

/* 이미지 배경 */
Button { background: "url('images/btn.png') stretch"; }

/* 그라데이션 (Nexacro 지원 여부 버전에 따라 다름) */
Button { background: "gradient:0,#4a90e2,#2a70c2"; }
```

### 글꼴(font)

CSS처럼 개별 속성이 아니라 `font` 하나로 속기 표기한다.

```css
/* font: style weight size family */
Static {
  font: "normal 13px Malgun Gothic";
}

/* 굵게, 이탤릭 */
Static.title {
  font: "bold italic 16px Malgun Gothic";
}
```

### 테두리(border)

```css
/* 전체 테두리 */
Edit { border: "1px solid #cccccc"; }

/* 각 방향별 */
Grid { border-bottom: "2px solid #4a90e2"; }
```

### 여백(padding)

```css
/* 상하좌우 동일 */
Button { padding: "4"; }

/* 상하, 좌우 */
Button { padding: "4 8"; }

/* 상 우 하 좌 (시계 방향) */
Static { padding: "4 8 4 8"; }
```

## 상태별 스타일

ESS의 핵심 기능이다. CSS 의사 클래스(pseudo-class)처럼 컴포넌트 상태마다 다른 스타일을 정의한다.

![ESS 파일 구조 및 상태별 스타일](/assets/posts/nexacro-n-css-like-properties-ess.svg)

```css
/* Edit 컴포넌트 상태별 스타일 */
Edit {
  background : "#ffffff";
  color      : "#333333";
  border     : "1px solid #cccccc";
}

Edit:focus {
  border     : "2px solid #4a90e2";
  background : "#f0f8ff";
}

Edit:readonly {
  background : "#f5f5f5";
  color      : "#666666";
}

Edit:required {
  background : "#fff8e1";
  border     : "1px solid #ffb300";
}

Edit:error {
  border     : "1px solid #e05555";
  background : "#fff0f0";
}

Edit:disable {
  background : "#eeeeee";
  color      : "#aaaaaa";
  opacity    : 0.7;
}
```

## 그리드 전용 상태

그리드는 행 단위 상태 스타일을 풍부하게 지원한다.

```css
/* Grid 행 상태 스타일 */
Grid > body {
  background : "#ffffff";
  color      : "#333333";
}

Grid > body:odd {
  background : "#f8f8f8";
}

Grid > body:select {
  background : "#d0e8ff";
  color      : "#000000";
}

Grid > body:mouseover {
  background : "#e8f4ff";
}

/* 헤더 스타일 */
Grid > head {
  background : "#f0f0f0";
  color      : "#555555";
  font       : "bold 12px Malgun Gothic";
}
```

## cssclass 활용

컴포넌트에 CSS class처럼 스타일을 지정하는 `cssclass` 속성으로 재사용 가능한 스타일을 만든다.

### ESS에서 클래스 정의

```css
/* Button.ess */
Button.btn_primary {
  background : "#4a90e2";
  color      : "#ffffff";
  border     : "1px solid #2a70c2";
}

Button.btn_primary:mouseover {
  background : "#5aa0f2";
}

Button.btn_danger {
  background : "#e05555";
  color      : "#ffffff";
  border     : "1px solid #b03030";
}

Button.btn_disabled {
  background : "#cccccc";
  color      : "#888888";
}
```

### XFDL에서 클래스 적용

```xml
<Button id="btn_save"   cssclass="btn_primary" text="$SAVE"/>
<Button id="btn_delete" cssclass="btn_danger"  text="$DELETE"/>
```

### 스크립트로 동적 클래스 변경

```javascript
// 버튼 상태에 따라 클래스 전환
function fn_updateButtonState(bValid) {
  if (bValid) {
    this.btn_save.set_cssclass("btn_primary");
    this.btn_save.set_enable(true);
  } else {
    this.btn_save.set_cssclass("btn_disabled");
    this.btn_save.set_enable(false);
  }
}
```

## 인라인 스타일 설정

XFDL이나 스크립트에서 직접 스타일 속성을 설정하면 ESS 스타일보다 우선 적용된다.

```xml
<!-- XFDL 인라인 스타일 -->
<Static id="lbl_required"
        background="#fff8e1"
        color="#e05555"
        font="bold 13px Malgun Gothic"/>
```

```javascript
// 스크립트 동적 스타일 변경
this.lbl_status.set_background("#f0f8ff");
this.lbl_status.set_color("#4a90e2");
```

인라인 스타일은 테마 전환의 영향을 받지 않으므로, 테마 대응이 필요한 요소는 cssclass를 통해 ESS에서 관리하는 것이 원칙이다.

## opacity와 visible의 차이

```javascript
// opacity: 0으로 설정 — 공간을 차지하면서 투명
this.btn_action.set_opacity(0);

// visible: false — 화면에서 완전히 숨김 (공간도 사라짐 X, 숨김만)
this.btn_action.set_visible(false);

// enable: false — 비활성화 (회색 처리, 클릭 불가)
this.btn_action.set_enable(false);
```

ESS에서 `:disable` 상태 스타일은 `set_enable(false)`가 적용된 컴포넌트에 자동으로 사용된다.

## CSS와 ESS의 주요 차이 정리

| 항목 | CSS | ESS |
|------|-----|-----|
| 속성값 표기 | 공백 구분 | 문자열 (`"..."`) |
| 레이아웃 | flex, grid, position | 미지원 — 절대좌표 사용 |
| 상태 | `:hover`, `:active` | `:mouseover`, `:press` |
| 상속 | 부모 → 자식 자동 | 제한적 (컴포넌트별 독립) |
| 미디어쿼리 | 지원 | 미지원 |
| CSS 변수 | `--var-name` | 미지원 (테마 파일로 대체) |

Nexacro N의 ESS는 CSS 개발자에게 익숙하지만, 레이아웃 속성이 없다는 점을 염두에 두어야 한다. 스타일은 ESS·cssclass에 집중하고, 위치 제어는 x·y·width·height 속성으로 분리하는 것이 구조적으로 깔끔하다.

---

**지난 글:** [테마 시스템](/posts/nexacro-n-theme-system/)

**다음 글:** [동적 스타일 적용](/posts/nexacro-n-dynamic-style/)

<br>
읽어주셔서 감사합니다. 😊
