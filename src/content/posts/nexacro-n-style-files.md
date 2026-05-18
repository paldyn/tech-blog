---
title: "[Nexacro N] 스타일 파일 관리"
description: "Nexacro N 프로젝트의 ESS 스타일 파일을 체계적으로 관리하는 방법을 설명합니다. common/theme/module 계층 구조, TypeDefinition 등록 순서에 따른 우선순위, 스타일 재정의 규칙, 대규모 프로젝트 스타일 가이드를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 9
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "ESS", "스타일파일", "테마", "TypeDefinition", "cssclass", "스타일관리"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-dynamic-style/)에서 동적 스타일 적용을 살펴보았다. 이번에는 프로젝트 전체의 ESS 스타일 파일을 어떻게 구조화하고 관리할지 다룬다. 스타일 파일이 체계적이지 않으면 테마 전환이 불완전하거나, 같은 스타일을 여러 파일에 중복 정의하는 문제가 발생한다.

## ESS 파일 계층 구조

권장 구조는 공통(common)→테마별(light/dark)→모듈별(module) 세 계층이다.

![ESS 파일 구성 전략](/assets/posts/nexacro-n-style-files-structure.svg)

- **common/**: 테마에 무관하게 동일한 컴포넌트 구조 스타일. 크기, 여백, 폰트, 상태별 레이아웃을 정의하되 색상은 쓰지 않는다
- **light/ / dark/**: 색상 토큰만 재정의. common에서 정한 클래스를 같은 이름으로 오버라이드해 색상만 바꾼다
- **modules/**: 업무 도메인별 특수 컴포넌트 스타일. 기간계·급여·회계 등 화면에서만 쓰는 클래스

## 공통 ESS 작성 원칙

```css
/* common/button.ess — 색상 없이 구조만 */
Button {
  padding  : "4 16";
  font     : "normal 13px Malgun Gothic";
  border   : "1px solid";
  /* background / color / border-color는 여기서 쓰지 않음 */
}

Button.btn_primary {
  font     : "bold 13px Malgun Gothic";
  padding  : "4 20";
}

Button.btn_sm {
  padding  : "2 10";
  font     : "normal 11px Malgun Gothic";
}

Button.btn_lg {
  padding  : "8 24";
  font     : "bold 15px Malgun Gothic";
}
```

```css
/* light/colors.ess — 색상만 재정의 */
Button {
  background : "#4a90e2";
  color      : "#ffffff";
  border     : "1px solid #2a70c2";
}

Button.btn_primary {
  background : "#4a90e2";
  color      : "#ffffff";
}

/* dark/colors.ess */
Button {
  background : "#2d5a8e";
  color      : "#e8e8e8";
  border     : "1px solid #1a4070";
}
```

## TypeDefinition 등록 순서와 우선순위

TypeDefinition에서 `<StyleSheet>`을 등록하는 순서가 곧 적용 우선순위다. **나중에 등록된 파일이 이전 파일을 덮어쓴다.**

```xml
<Theme id="light" default="true">
  <!-- 1. 공통 기본 스타일 (가장 먼저, 낮은 우선순위) -->
  <StyleSheet src="styles/common/reset.ess"/>
  <StyleSheet src="styles/common/button.ess"/>
  <StyleSheet src="styles/common/edit.ess"/>
  <StyleSheet src="styles/common/grid.ess"/>
  <StyleSheet src="styles/common/layout.ess"/>

  <!-- 2. 테마 색상 오버라이드 (공통보다 나중, 색상 재정의) -->
  <StyleSheet src="styles/light/colors.ess"/>
  <StyleSheet src="styles/light/override.ess"/>

  <!-- 3. 모듈별 특수 스타일 (선택적 로드) -->
  <StyleSheet src="styles/modules/finance.ess"/>
</Theme>
```

![스타일 우선순위 & 재정의 규칙](/assets/posts/nexacro-n-style-files-override.svg)

## 스타일 우선순위 요약

```
인라인 스타일 > cssclass > 테마 ESS > 공통 ESS
```

인라인 스타일은 항상 이기므로, 테마 대응이 필요한 곳에는 절대 인라인 스타일을 쓰면 안 된다. 색상·배경을 XFDL에서 직접 지정하면 다크 테마로 전환해도 그 컴포넌트만 밝은 색으로 남는다.

## cssclass 네이밍 컨벤션

프로젝트 전체가 공유하는 클래스명을 일관되게 관리해야 한다.

| 접두사 | 용도 | 예시 |
|--------|------|------|
| `btn_` | 버튼 클래스 | `btn_primary`, `btn_danger`, `btn_sm` |
| `edt_` | Edit 클래스 | `edt_normal`, `edt_error`, `edt_readonly` |
| `lbl_` | Static/레이블 | `lbl_title`, `lbl_required`, `lbl_muted` |
| `grd_` | 그리드 | `grd_default`, `grd_compact` |
| `tab_` | 탭 | `tab_default`, `tab_colored` |
| `cell_` | 그리드 셀 | `cell_highlight`, `cell_error` |
| `form_` | Form 배경 | `form_content`, `form_popup` |

```css
/* 예: 공통 레이블 클래스 */
Static.lbl_required {
  color : "#e05555";
  font  : "bold 13px Malgun Gothic";
}

Static.lbl_muted {
  opacity : 0.6;
}

Static.lbl_title {
  font   : "bold 16px Malgun Gothic";
}
```

## 모듈별 ESS 분리

업무 시스템에서 특정 모듈에만 존재하는 화면 스타일은 별도 ESS 파일로 분리한다.

```css
/* styles/modules/finance.ess */
/* 회계 모듈 전용 - 금액 색상 클래스 */
Static.amt_positive {
  color  : "#55c555";
  font   : "bold 13px Malgun Gothic";
}

Static.amt_negative {
  color  : "#e05555";
  font   : "bold 13px Malgun Gothic";
}

Static.amt_zero {
  color  : "#888888";
}

/* 재무 그리드 셀 */
Grid.grd_finance > body {
  font : "normal 12px Malgun Gothic";
}

Grid.grd_finance > head {
  background : "#f0f4f8";
  font       : "bold 12px Malgun Gothic";
}
```

모듈 ESS는 해당 모듈 화면을 로드할 때만 포함되도록 TypeDefinition의 테마에 선택적으로 등록하거나, `<Screen>` 레벨에서 추가 스타일시트를 지정한다.

## 스타일 파일 관리 팁

**1. 색상 변수 파일 분리**

ESS는 CSS 변수를 지원하지 않지만, 색상 값을 한 파일에 모아두는 규칙을 팀에서 약속한다.

```css
/* styles/light/colors.ess — 이 파일에만 색상 값 작성 */
Button      { background: "#4a90e2"; color: "#fff"; }
Edit:focus  { border: "2px solid #4a90e2"; }
/* 다른 ESS에서는 색상 값 직접 쓰지 않음 */
```

**2. 스타일 검토 절차**

신규 화면 개발 시 인라인 스타일 사용 여부를 코드 리뷰에서 체크한다. 다음 grep 패턴으로 확인할 수 있다.

```bash
# XFDL에서 인라인 배경색/글자색 사용 탐지
grep -rn 'background="#\|color="#' src/
```

**3. 스타일 정의 중복 방지**

같은 클래스를 두 ESS 파일에 정의하면 등록 순서에 따라 하나가 무시된다. ESS 파일마다 담당 컴포넌트를 명확히 분리하고, 팀 공유 문서에 클래스 목록을 관리한다.

**4. 테마 전환 후 시각 테스트**

신규 화면 추가 후 반드시 라이트·다크 테마 양쪽에서 스타일이 올바른지 확인한다. 특히 새로 추가한 컴포넌트에 인라인 색상이 없는지 점검한다.

ESS 파일 구조가 잘 정의된 프로젝트는 신규 테마 추가가 `light/` 폴더를 복사해 색상만 수정하는 수준으로 간단해진다. 초기 구조 설계에 시간을 투자하면 장기적으로 유지보수 비용이 크게 줄어든다.

---

**지난 글:** [동적 스타일 적용](/posts/nexacro-n-dynamic-style/)

**다음 글:** [성능 최적화 개요](/posts/nexacro-n-performance-optimization/)

<br>
읽어주셔서 감사합니다. 😊
