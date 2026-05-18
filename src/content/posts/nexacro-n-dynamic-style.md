---
title: "[Nexacro N] 동적 스타일 적용"
description: "Nexacro N에서 스크립트로 컴포넌트 스타일을 동적으로 변경하는 방법을 설명합니다. set_background/color/cssclass API, 그리드 ongetcellstyle 이벤트, 조건부 스타일 패턴, 성능 고려 사항을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 8
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "동적스타일", "ongetcellstyle", "set_background", "cssclass", "그리드", "스타일"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-css-like-properties/)에서 ESS 파일의 CSS 유사 속성을 살펴보았다. 이번에는 앱이 실행 중인 상태에서 스크립트로 컴포넌트 스타일을 동적으로 바꾸는 방법을 다룬다. 데이터 값에 따라 셀 색상을 변경하거나, 상태에 따라 버튼 스타일을 전환하는 패턴은 업무 시스템에서 빈번하게 사용된다.

## 동적 스타일의 세 가지 방법

Nexacro N에서 런타임 스타일을 변경하는 방법은 크게 세 가지다.

1. **set_xxx() API**: `set_background()`, `set_color()`, `set_cssclass()` 등 직접 속성 변경
2. **cssclass 전환**: ESS에 미리 정의한 클래스를 `set_cssclass()`로 교체
3. **ongetcellstyle 이벤트**: 그리드 셀 렌더링 시 이벤트에서 스타일 반환

![동적 스타일 적용 패턴](/assets/posts/nexacro-n-dynamic-style-patterns.svg)

## set_xxx() API로 직접 변경

가장 직관적인 방법이다. 컴포넌트의 스타일 속성을 직접 설정한다.

```javascript
// 기본 스타일 변경 API
function fn_highlightRow(nRow) {
  var ds = this.ds_main;
  var nStatus = ds.getColumn(nRow, "STATUS_CD");

  if (nStatus === "ERROR") {
    this.lbl_status.set_background("#fff0f0");
    this.lbl_status.set_color("#e05555");
    this.lbl_status.set_font("bold 13px Malgun Gothic");
  } else if (nStatus === "OK") {
    this.lbl_status.set_background("#f0fff0");
    this.lbl_status.set_color("#55c555");
    this.lbl_status.set_font("normal 13px Malgun Gothic");
  } else {
    // 기본 스타일 복원
    this.lbl_status.set_background("");
    this.lbl_status.set_color("");
    this.lbl_status.set_font("");
  }
}
```

빈 문자열(`""`)을 설정하면 인라인 스타일이 제거되고 ESS 정의 스타일로 복원된다.

## cssclass 전환

더 구조적인 방법이다. ESS에 상태별 클래스를 정의하고, 스크립트에서는 클래스 이름만 바꾼다. 테마 전환에도 대응할 수 있다.

```css
/* form.ess */
Static.status_ok {
  background : "#f0fff0";
  color      : "#55c555";
  border     : "1px solid #55c555";
}

Static.status_error {
  background : "#fff0f0";
  color      : "#e05555";
  border     : "1px solid #e05555";
}

Static.status_warning {
  background : "#fff8e1";
  color      : "#f59e0b";
  border     : "1px solid #f59e0b";
}
```

```javascript
// 클래스 전환으로 상태 스타일 변경
function fn_updateStatus(sStatusCd) {
  var classMap = {
    "OK"  : "status_ok",
    "ERR" : "status_error",
    "WRN" : "status_warning"
  };
  var sClass = classMap[sStatusCd] || "status_normal";
  this.lbl_status.set_cssclass(sClass);
}
```

## ongetcellstyle로 그리드 셀 동적 스타일

그리드에서 셀마다 다른 스타일을 적용할 때 사용하는 이벤트다. 그리드가 셀을 렌더링할 때마다 호출되며, 이벤트 객체(`e`)에 스타일을 설정하면 해당 셀에 적용된다.

![동적 스타일 API 레퍼런스](/assets/posts/nexacro-n-dynamic-style-api.svg)

```javascript
// 금액 컬럼 색상 조건부 적용
function grd_main_ongetcellstyle(obj, e) {
  // head band는 처리하지 않음
  if (e.band !== "body" || e.datarow < 0) return;

  var ds = obj.getBindDataset();

  // AMT 컬럼만 처리
  if (e.col === 3) { // AMT 컬럼 인덱스
    var nAmt = parseFloat(ds.getColumn(e.datarow, "AMT") || 0);
    if (nAmt > 0) {
      e.color = "#55c555";
    } else if (nAmt < 0) {
      e.color = "#e05555";
    }
  }

  // 상태코드에 따라 행 전체 배경
  var sStatus = ds.getColumn(e.datarow, "STATUS_CD");
  if (sStatus === "CANCEL") {
    e.background = "#f0f0f0";
    e.color      = "#aaaaaa";
  } else if (sStatus === "ERROR") {
    e.background = "#fff0f0";
  }
}
```

`ongetcellstyle`에서 설정할 수 있는 속성:

```javascript
e.color      = "#333333";  // 글자색
e.background = "#ffffff";  // 배경색
e.font       = "bold 13px Malgun Gothic"; // 폰트
e.cssclass   = "cell_highlight"; // ESS 클래스
```

## 버튼 활성/비활성 스타일 패턴

저장 버튼을 필수 입력 완료 전까지 비활성화하고, 완료 시 활성화하는 패턴이다.

```javascript
function fn_checkRequired() {
  var bValid = this.edt_name.value !== "" &&
               this.cmb_dept.value !== "";

  if (bValid) {
    this.btn_save.set_enable(true);
    this.btn_save.set_cssclass("btn_primary");
  } else {
    this.btn_save.set_enable(false);
    this.btn_save.set_cssclass("btn_disabled");
  }
}

// Edit onchanged 이벤트에 연결
function edt_name_onchanged(obj, e) {
  fn_checkRequired.call(this);
}
```

## 입력 오류 시 Edit 스타일 하이라이트

유효성 검사 실패 시 해당 Edit 컴포넌트를 강조한다.

```javascript
function fn_validateAndSave() {
  var bValid = true;

  // 모든 필드 초기화
  this.edt_name.set_cssclass("edt_normal");
  this.edt_email.set_cssclass("edt_normal");

  if (this.edt_name.value === "") {
    this.edt_name.set_cssclass("edt_error");
    this.edt_name.setFocus();
    bValid = false;
  }

  if (!gfn_isEmail(this.edt_email.value)) {
    this.edt_email.set_cssclass("edt_error");
    if (bValid) this.edt_email.setFocus();
    bValid = false;
  }

  if (!bValid) return;

  // 저장 로직
  this.transaction("save", ...);
}
```

## 성능 고려 사항

**ongetcellstyle 주의점**

`ongetcellstyle`은 셀이 화면에 보일 때마다 호출된다. 무거운 로직을 여기에 넣으면 스크롤 시 성능 저하가 발생한다.

```javascript
// 나쁜 예: ongetcellstyle에서 Dataset 조회가 반복됨
function grd_ongetcellstyle(obj, e) {
  // 이 코드는 셀 개수만큼 반복 실행됨
  var result = someHeavyCalculation(e.datarow);
  e.color = result > 0 ? "#55c555" : "#e05555";
}

// 좋은 예: 미리 계산해서 Dataset 컬럼에 저장
function fn_prepareStyleData() {
  var ds = this.ds_main;
  for (var i = 0; i < ds.rowcount; i++) {
    var nAmt = ds.getColumn(i, "AMT");
    ds.setColumn(i, "_COLOR", nAmt > 0 ? "green" : "red");
  }
}

function grd_ongetcellstyle(obj, e) {
  if (e.band !== "body" || e.datarow < 0) return;
  var sColor = obj.getBindDataset().getColumn(e.datarow, "_COLOR");
  e.color = sColor === "green" ? "#55c555" : "#e05555";
}
```

**set_xxx() API 과다 호출 방지**

루프 안에서 `set_background()`를 반복 호출하면 화면이 깜박인다. 루프 전후로 `this.suspendLayout()` / `this.resumeLayout()`을 감싸거나, 변경이 필요한 컴포넌트만 처리한다.

동적 스타일은 사용자 경험을 풍부하게 만들지만, 과도하게 적용하면 오히려 일관성이 떨어지고 유지보수가 어려워진다. ESS 클래스 기반 접근법을 기본으로 하고, 데이터 값 의존 스타일은 `ongetcellstyle`로 분리하는 것이 좋은 설계다.

---

**지난 글:** [CSS 유사 속성](/posts/nexacro-n-css-like-properties/)

**다음 글:** [스타일 파일 관리](/posts/nexacro-n-style-files/)

<br>
읽어주셔서 감사합니다. 😊
