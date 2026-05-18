---
title: "[Nexacro N] 테마 시스템"
description: "Nexacro N의 테마 시스템 구조와 ESS 파일 작성 방법을 설명합니다. TypeDefinition 테마 등록, nexacro.setTheme() API, 라이트/다크 테마 전환 구현, 사용자별 테마 유지 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 6
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "테마", "ESS", "setTheme", "다크모드", "라이트모드", "스타일"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-language-switching/)에서 언어 전환을 살펴보았다. 이번에는 Nexacro N의 테마 시스템을 다룬다. Nexacro N은 ESS(Extended Style Sheet) 파일을 기반으로 앱 전체 컴포넌트의 스타일을 테마로 관리한다. 라이트/다크 테마 전환, 기업 브랜드 테마, 사용자별 테마 유지까지 구조적으로 지원한다.

## ESS 파일과 테마 개념

Nexacro N의 스타일은 CSS와 유사한 **ESS(Extended Style Sheet)** 파일에 정의한다. 테마는 이 ESS 파일의 묶음이다. 하나의 테마 = 컴포넌트별 스타일 집합이며, `nexacro.setTheme()`으로 테마를 전환하면 앱 전체 컴포넌트가 즉시 해당 테마 스타일로 적용된다.

```
styles/
  light/
    button.ess
    edit.ess
    grid.ess
    form.ess
  dark/
    button.ess
    edit.ess
    grid.ess
    form.ess
```

![테마 시스템 구조](/assets/posts/nexacro-n-theme-system-structure.svg)

## TypeDefinition에 테마 등록

`TypeDefinition.xadl`에서 테마를 등록하고 기본 테마를 지정한다.

```xml
<!-- TypeDefinition.xadl -->
<TypeDefinition>
  <Themes>
    <Theme id="light" default="true">
      <StyleSheet src="styles/light/button.ess"/>
      <StyleSheet src="styles/light/edit.ess"/>
      <StyleSheet src="styles/light/grid.ess"/>
      <StyleSheet src="styles/light/form.ess"/>
    </Theme>
    <Theme id="dark">
      <StyleSheet src="styles/dark/button.ess"/>
      <StyleSheet src="styles/dark/edit.ess"/>
      <StyleSheet src="styles/dark/grid.ess"/>
      <StyleSheet src="styles/dark/form.ess"/>
    </Theme>
  </Themes>
</TypeDefinition>
```

## ESS 파일 작성

ESS 문법은 CSS와 유사하지만 Nexacro 전용 속성명을 사용한다. 컴포넌트 타입별로 스타일을 정의한다.

```css
/* styles/light/button.ess */
Button {
  background         : "url('images/btn_normal.png') stretch";
  color              : "#333333";
  border             : "1px solid #cccccc";
  font               : "normal 13px Malgun Gothic";
}

Button:mouseover {
  background         : "url('images/btn_hover.png') stretch";
  color              : "#000000";
}

Button:press {
  background         : "url('images/btn_press.png') stretch";
}
```

```css
/* styles/dark/button.ess */
Button {
  background         : "#2d2d2d";
  color              : "#e8e8e8";
  border             : "1px solid #555555";
  font               : "normal 13px Malgun Gothic";
}

Button:mouseover {
  background         : "#3d3d3d";
  color              : "#ffffff";
}
```

## nexacro.setTheme() API

```javascript
// 테마 전환
nexacro.setTheme("dark");   // 다크 테마
nexacro.setTheme("light");  // 라이트 테마

// 현재 테마 조회
var sCurrent = nexacro.getCurrentTheme(); // "light" | "dark"
```

![테마 전환 구현 패턴](/assets/posts/nexacro-n-theme-system-switch.svg)

## 공통 테마 전환 함수

언어 전환과 동일하게, 테마 전환도 쿠키 저장과 함께 공통 함수로 래핑한다.

```javascript
// CommonLib/theme.xjs
var gv_theme = "light";

function gfn_setTheme(sTheme) {
  if (gv_theme === sTheme) return;

  nexacro.setTheme(sTheme);
  gv_theme = sTheme;

  // 쿠키에 저장
  gfn_setCookie("NEXACRO_THEME", sTheme, 365);

  // 테마 토글 버튼 아이콘 갱신
  fn_updateThemeButton(sTheme);
}

function gfn_restoreTheme() {
  var savedTheme = gfn_getCookie("NEXACRO_THEME");
  if (savedTheme) {
    nexacro.setTheme(savedTheme);
    gv_theme = savedTheme;
  }
}

function fn_updateThemeButton(sTheme) {
  var icon = sTheme === "dark" ? "ic_sun.png" : "ic_moon.png";
  // Header Form의 테마 버튼 아이콘 변경
  application.mainFrame.head.btn_theme.set_image(icon);
}
```

## 테마 토글 버튼 구현

헤더 영역에 라이트/다크 전환 버튼을 배치한다.

```javascript
// HeaderForm.xfdl
function btn_theme_onclick(obj, e) {
  var sNew = gv_theme === "light" ? "dark" : "light";
  gfn_setTheme(sNew);
}
```

```xml
<!-- 헤더 폼 XFDL -->
<Button id="btn_theme"
        image="images/ic_moon.png"
        width="32" height="32"
        tooltip="$TIP_THEME_SWITCH"/>
```

## 그리드 스타일 테마 적용

그리드는 헤더·본문·선택·홀수행 스타일을 별도로 정의한다.

```css
/* styles/dark/grid.ess */
Grid {
  background         : "#1e1e1e";
  color              : "#e0e0e0";
  border             : "1px solid #444444";
}

Grid > head {
  background         : "#2a2a2a";
  color              : "#aaaaaa";
  border-bottom      : "1px solid #555555";
}

Grid > body:odd {
  background         : "#252525";
}

Grid > body:select {
  background         : "#1a3a5a";
  color              : "#ffffff";
}
```

## 브랜드 테마 커스터마이징

기업 고객마다 고유한 색상 체계를 가진 브랜드 테마를 제공할 때 활용한다.

```xml
<!-- TypeDefinition.xadl -->
<Theme id="brand-a">
  <StyleSheet src="styles/brand-a/all.ess"/>
</Theme>
<Theme id="brand-b">
  <StyleSheet src="styles/brand-b/all.ess"/>
</Theme>
```

로그인 후 서버에서 고객사 코드를 받아 해당 브랜드 테마를 적용한다.

```javascript
function fn_loginCallback(sId, nErrCode, sErrMsg) {
  if (nErrCode == 0) {
    var sBrand = this.ds_session.getColumn(0, "BRAND_CD") || "light";
    gfn_setTheme(sBrand);
  }
}
```

## 테마 설계 주의 사항

**1. 이미지 테마 의존 최소화**

ESS에서 배경 이미지를 많이 사용하면 테마 파일 용량이 커지고 전환 시 깜박임이 생긴다. 가능하면 색상 값 기반으로 스타일을 정의한다.

**2. 폰트 크기는 테마 외부로**

폰트 크기는 테마가 아닌 CSS 변수 또는 별도 공통 스타일로 관리한다. 테마가 바뀌어도 폰트 크기는 일정해야 한다.

**3. 컴포넌트 인라인 스타일 자제**

XFDL에서 컴포넌트에 직접 `background="#ffffff"`를 지정하면 테마 ESS가 덮이지 않는다. 가능한 한 스타일은 ESS에서 관리하고 컴포넌트에는 클래스만 지정한다.

```xml
<!-- 권장: cssclass로 테마 적용 -->
<Button id="btn_save" cssclass="btn_primary"/>

<!-- 비권장: 인라인 스타일 (테마 무력화) -->
<Button id="btn_save" background="#4a90e2" color="#ffffff"/>
```

**4. 접근성 고려**

다크 테마에서 텍스트 대비율이 WCAG 4.5:1 이상인지 확인한다. 어두운 배경에 어두운 글자를 쓰는 실수를 ESS 검토 단계에서 발견해야 한다.

테마 시스템을 처음 구성할 때는 라이트 테마를 완성한 뒤 ESS 파일을 복사해 다크 테마로 수정하는 방식이 효율적이다. 두 테마의 파일 구조를 동일하게 유지하면 신규 컴포넌트 추가 시 두 테마에 동시에 스타일을 반영하기 쉽다.

---

**지난 글:** [언어 전환](/posts/nexacro-n-language-switching/)

**다음 글:** [CSS 유사 속성](/posts/nexacro-n-css-like-properties/)

<br>
읽어주셔서 감사합니다. 😊
