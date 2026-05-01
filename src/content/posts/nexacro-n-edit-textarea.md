---
title: "[Nexacro N] Edit / Textarea — 텍스트 입력 컴포넌트 완전 분석"
description: "Nexacro N의 Edit과 Textarea 컴포넌트 — 속성·이벤트·유효성 검사·IME 대응·포커스 제어·패스워드 모드까지 실무 패턴을 상세히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 2
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "edit", "textarea", "입력", "이벤트", "onchanged", "onkeyup", "validating"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-div-grouping/)에서 Div로 화면을 논리 단위로 묶는 방법을 살펴봤습니다. 이번에는 화면에서 가장 자주 사용되는 두 컴포넌트인 **Edit**과 **Textarea**를 깊이 있게 분석합니다. 단순히 텍스트를 입력받는 용도처럼 보이지만, 이 두 컴포넌트에는 실무 개발에서 반드시 알아야 할 속성과 이벤트가 다양하게 내장되어 있습니다.

## Edit과 Textarea의 차이

`Edit`은 **단일 행** 텍스트 입력에 최적화된 컴포넌트입니다. 이름, 전화번호, 검색어처럼 한 줄로 처리되는 입력에 사용합니다. 반면 `Textarea`는 **다중 행** 입력을 지원하며 내용이 영역을 벗어나면 자동 스크롤 바가 나타납니다. 메모, 비고, 주소처럼 길거나 여러 줄에 걸친 내용 입력에 적합합니다.

두 컴포넌트는 `value` 속성과 `onchanged` 이벤트를 공통으로 갖지만, Textarea는 줄바꿈 문자(`\n`)를 그대로 보존합니다. 서버에 전송할 때 이 점을 감안해 처리해야 합니다.

![Edit / Textarea — 주요 속성 비교](/assets/posts/nexacro-n-edit-textarea-props.svg)

## Edit 주요 속성

### value와 text

`value`는 Edit의 현재 입력값입니다. 스크립트에서 `obj.value` 또는 `this.edtName.value`로 읽고, `set_value("내용")`으로 씁니다. `text` 속성은 초기 표시 텍스트 설정 시 사용하지만, 런타임에서는 `value`를 사용합니다.

```javascript
// 값 읽기
var sName = this.edtName.value;

// 값 쓰기
this.edtName.set_value("홍길동");

// 입력값 비우기
this.edtName.set_value("");
```

### edittype

`edittype` 속성으로 Edit의 입력 모드를 지정합니다.

| edittype | 동작 |
|----------|------|
| `normal` | 기본 텍스트 입력 |
| `password` | 입력 내용을 ●로 마스킹 |
| `readonly` | 읽기 전용, 값 복사는 가능 |

```javascript
// 비밀번호 모드 전환
this.edtPassword.set_edittype("password");

// 읽기 전용 전환
this.edtName.set_edittype("readonly");
```

### maxlength

최대 입력 글자 수를 제한합니다. DB 컬럼 길이에 맞춰 설정하면 서버 오류를 사전에 방지할 수 있습니다.

```javascript
// 최대 50자 제한
this.edtName.set_maxlength(50);
```

### placeholder

입력 전 회색 힌트 텍스트를 표시합니다. 사용자가 입력을 시작하면 사라집니다.

```xml
<Edit id="edtSearch" placeholder="검색어를 입력하세요" .../>
```

## Textarea 전용 속성

### wordwrap

`wordwrap` 속성으로 긴 줄의 자동 줄바꿈을 제어합니다. `true`이면 영역 너비를 초과할 때 자동 줄바꿈이 됩니다. `false`면 가로 스크롤이 생깁니다.

```javascript
this.txaComment.set_wordwrap(true);
```

### scrollbars

`scrollbars` 속성으로 스크롤바 표시를 제어합니다. `autoboth` (기본), `vertical`, `horizontal`, `none` 중 선택합니다.

```javascript
this.txaComment.set_scrollbars("vertical");
```

## 핵심 이벤트

### onchanged

값이 변경될 때마다 발생합니다. 폼이 변경되었는지 추적하거나, 실시간 검증에 사용합니다.

```javascript
function edtName_onchanged(obj, e) {
    // 이름 필드가 비어있으면 저장 버튼 비활성화
    var bEmpty = (obj.value.length === 0);
    this.btnSave.set_enable(!bEmpty);
}
```

### onkeyup

키를 뗄 때마다 발생합니다. Enter 키 감지, 실시간 검색 등에 활용합니다.

```javascript
function edtSearch_onkeyup(obj, e) {
    if (e.keycode === 13) {         // Enter = 13
        this.fn_search();
    }
}
```

### onfocus / onblur

포커스를 얻거나(`onfocus`) 잃을 때(`onblur`) 발생합니다. 필드 진입 시 전체 선택, 이탈 시 유효성 검사에 사용합니다.

```javascript
function edtAmount_onfocus(obj, e) {
    // 포커스 시 전체 선택
    obj.set_selectionstart(0);
    obj.set_selectionend(obj.value.length);
}

function edtAmount_onblur(obj, e) {
    // 포커스 이탈 시 숫자 형식 검증
    if (isNaN(obj.value)) {
        obj.set_value("");
        obj.setFocus();
    }
}
```

![Edit 이벤트 핸들러 패턴](/assets/posts/nexacro-n-edit-textarea-code.svg)

## 포커스 제어

탭 순서와 포커스 이동을 스크립트로 제어하면 키보드 사용 편의성이 높아집니다.

```javascript
// Enter 키로 다음 필드로 이동하는 공통 패턴
function fn_focusNext(oCurrentEdit, oNextEdit) {
    if (oNextEdit) {
        oNextEdit.setFocus();
    }
}

function edtName_onkeyup(obj, e) {
    if (e.keycode === 13) {
        fn_focusNext(obj, this.edtAge);
    }
}

function edtAge_onkeyup(obj, e) {
    if (e.keycode === 13) {
        fn_focusNext(obj, this.edtAddress);
    }
}
```

`setFocus()`는 해당 컴포넌트로 포커스를 이동시킵니다. 탭 인덱스(`taborder` 속성)를 설정하면 Tab 키 이동 순서도 제어할 수 있습니다.

## IME 입력 (한글) 처리

한글 입력 중에는 `onkeyup`이 조합 중인 문자에 대해 예상치 않게 발생할 수 있습니다. IME 조합 완료 후 값을 처리하려면 `onchanged` 이벤트를 사용하거나, `oninputkeyup` 이벤트의 `e.altkey`·`e.ctrlkey` 상태를 확인합니다.

```javascript
// IME 조합 중 실시간 글자 수 카운트
function txaComment_onchanged(obj, e) {
    var nLen = obj.value.length;
    this.stcCount.set_text(nLen + " / 500");
    if (nLen > 500) {
        this.stcCount.set_style("color:#e05555;");
    }
}
```

`onchanged`는 조합이 완료된 후 값이 확정될 때 발생하므로 한글 입력 중 중간값이 들어오는 문제가 없습니다.

## 텍스트 선택 제어

스크립트로 특정 범위를 선택 상태로 만들 수 있습니다.

```javascript
// 전체 선택 (Ctrl+A 효과)
function fn_selectAll(oEdit) {
    oEdit.set_selectionstart(0);
    oEdit.set_selectionend(oEdit.value.length);
}

// 특정 범위 선택
function fn_selectRange(oEdit, nStart, nEnd) {
    oEdit.set_selectionstart(nStart);
    oEdit.set_selectionend(nEnd);
}
```

`selectionstart`와 `selectionend`는 0-기반 인덱스로 선택 시작과 끝 위치를 지정합니다.

## Dataset 바인딩과의 연동

Edit은 Dataset과 바인딩되어 행 이동 시 자동으로 값이 갱신되도록 설정할 수 있습니다.

```xml
<Edit id="edtName"
      binddataset="dsMain"
      bindcolumn="NAME"
      .../>
```

바인딩된 Edit에서 값을 변경하면 `dsMain`의 현재 행 `NAME` 컬럼에 자동으로 반영됩니다. 단, 바인딩된 Edit의 `value`를 직접 `set_value()`로 변경하면 Dataset 데이터도 함께 변경되므로 주의합니다.

## 실무 팁

- **조회 전용 화면**에서는 `edittype="readonly"`를 사용해 사용자가 실수로 값을 변경하지 못하게 합니다
- **금액 필드**는 `onblur`에서 숫자 포맷 적용, `onfocus`에서 전체 선택 패턴이 표준입니다
- **Textarea 줄바꿈**은 서버로 전송할 때 `\n`을 `<br>`이나 `\r\n`으로 변환해야 하는 경우가 있습니다
- **큰 폼**에서 초기화할 때는 개별 `set_value("")` 대신 Dataset `clearData()`를 사용하면 훨씬 효율적입니다

---

**지난 글:** [Div 그루핑 — 복잡한 화면을 논리 단위로 묶는 방법](/posts/nexacro-n-div-grouping/)

**다음 글:** [MaskEdit — 서식 있는 입력 필드의 모든 것](/posts/nexacro-n-maskedit/)

<br>
읽어주셔서 감사합니다. 😊
