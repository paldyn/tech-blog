---
title: "[Nexacro N] MaskEdit — 서식 있는 입력 필드의 모든 것"
description: "Nexacro N MaskEdit 컴포넌트의 마스크 패턴 문자, 전화번호·날짜·주민번호 예시, displayvalue vs value 구분, 붙여넣기 처리, 커스텀 마스크 응용 기법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 3
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "maskedit", "마스크", "서식입력", "전화번호", "날짜형식", "입력제어"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-edit-textarea/)에서 Edit과 Textarea의 기본 사용법과 이벤트를 다뤘습니다. 일반적인 텍스트 입력 외에도, 전화번호·날짜·주민번호처럼 **일정한 서식이 정해진 데이터**를 입력받아야 하는 경우가 많습니다. 이때 일반 Edit에 직접 유효성 로직을 짜는 것보다 `MaskEdit` 컴포넌트를 활용하면 훨씬 간결하고 일관성 있는 입력 UI를 만들 수 있습니다.

## MaskEdit이란

`MaskEdit`은 정해진 **마스크 패턴**에 따라 입력을 제한하는 컴포넌트입니다. 숫자만 입력 가능한 자리, 영문만 입력 가능한 자리를 패턴 문자로 정의하면, 사용자가 그 형식에 맞지 않는 문자를 입력해도 자동으로 무시됩니다. 구분자(-, /, 공백)는 리터럴 문자로 자동 삽입됩니다.

예를 들어 `###-####-####` 마스크를 적용하면, 사용자가 숫자 11자리를 입력할 때 자동으로 `-`가 삽입되어 `010-1234-5678` 형식이 됩니다.

![MaskEdit — 마스크 패턴 레퍼런스](/assets/posts/nexacro-n-maskedit-patterns.svg)

## 패턴 문자 레퍼런스

| 패턴 문자 | 의미 | 허용 입력 |
|-----------|------|-----------|
| `#` | 숫자 1자리 | 0–9 |
| `A` | 대문자 영문 1자리 | A–Z |
| `a` | 소문자 영문 1자리 | a–z |
| `*` | 영문+숫자 1자리 | A–Z, a–z, 0–9 |

그 외 문자(-, /, :, 공백 등)는 **리터럴 문자**로 취급되어 자동으로 표시됩니다. 사용자는 리터럴 자리에 커서를 이동시킬 수 없으며, 자동 건너뜁니다.

## 마스크 설정 방법

Studio에서 `mask` 속성에 직접 입력하거나, 스크립트에서 `set_mask()`로 동적 설정할 수 있습니다.

```javascript
// Form 로드 시 마스크 설정
function Form_onload(obj, e) {
    // 전화번호: 010-1234-5678
    this.mskPhone.set_mask("###-####-####");
    // 날짜: 2026-05-01
    this.mskDate.set_mask("####-##-##");
    // 우편번호: 12345
    this.mskZip.set_mask("#####");
    // 사업자등록번호: 123-45-67890
    this.mskBizNo.set_mask("###-##-#####");
}
```

마스크를 변경하면 현재 입력된 값도 초기화됩니다. 동적으로 마스크를 바꿔야 한다면 현재 `value`를 먼저 저장해 두어야 합니다.

## value vs displayvalue

MaskEdit에는 두 가지 값 속성이 있습니다.

- **`value`**: 리터럴 문자(구분자)를 제외한 순수 입력 데이터만 반환합니다
- **`displayvalue`**: 리터럴 문자를 포함한 화면 표시 값 전체를 반환합니다

```javascript
// 전화번호 MaskEdit (마스크: ###-####-####)
// 사용자 입력 후:
var sPure    = this.mskPhone.value;        // "01012345678" (구분자 없음)
var sDisplay = this.mskPhone.displayvalue; // "010-1234-5678" (구분자 포함)
```

DB 저장 시에는 `value`(순수 숫자)를, 화면 표시나 문서 출력 시에는 `displayvalue`를 사용하는 것이 일반적입니다.

![MaskEdit — 마스크 설정 패턴](/assets/posts/nexacro-n-maskedit-code.svg)

## 입력 완료 여부 확인

마스크가 완성되었는지(모든 자리가 채워졌는지) 확인할 때는 `iscomplete` 속성을 사용합니다.

```javascript
function fn_validatePhone() {
    if (!this.mskPhone.iscomplete) {
        alert("전화번호를 완전히 입력해 주세요.");
        this.mskPhone.setFocus();
        return false;
    }
    return true;
}
```

`iscomplete`는 `true`/`false`를 반환합니다. 저장 전 필수 필드 검증 시 이 속성을 활용하면 별도의 정규식 검사 없이도 간결하게 유효성을 확인할 수 있습니다.

## 붙여넣기(Paste) 처리

MaskEdit에 값을 붙여넣을 때는 리터럴 문자가 포함된 형태와 순수 데이터만 있는 형태 모두 처리됩니다. 예를 들어 `010-1234-5678`을 붙여넣으면 `-`가 자동으로 리터럴 자리에 맞게 배치됩니다. 단, 붙여넣기 전에 클립보드 데이터에서 불필요한 문자를 제거해야 하는 경우에는 `onkeydown`이나 Context Menu를 사용한 커스텀 붙여넣기 처리가 필요합니다.

```javascript
// 붙여넣기 전 클립보드 데이터 정제 예시
function mskPhone_onkeydown(obj, e) {
    // Ctrl+V 감지 (ctrlkey+keycode 86)
    if (e.ctrlkey && e.keycode === 86) {
        // 기본 붙여넣기 동작은 MaskEdit이 처리
        // 추가 처리가 필요한 경우만 개입
    }
}
```

## 이벤트 활용

### onchanged

마스크 입력이 변경될 때 발생합니다. `iscomplete`와 조합해 즉각적인 피드백을 줄 수 있습니다.

```javascript
function mskPhone_onchanged(obj, e) {
    if (obj.iscomplete) {
        // 입력 완료 → 다음 필드로 이동
        this.edtName.setFocus();
    }
}
```

### onkillfocus

입력 완료 검증을 포커스 이탈 시점에 수행합니다.

```javascript
function mskDate_onkillfocus(obj, e) {
    if (obj.value.length > 0 && !obj.iscomplete) {
        alert("날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)");
        obj.setFocus();
    }
}
```

## 자주 사용하는 마스크 패턴

```javascript
// 주요 마스크 패턴 모음
var MASKS = {
    phone_mobile: "###-####-####",     // 휴대전화
    phone_office: "##-####-####",      // 일반전화 (서울)
    date_full:    "####-##-##",        // 날짜 YYYY-MM-DD
    date_ym:      "####-##",           // 연월 YYYY-MM
    time_hm:      "##:##",             // 시간 HH:MM
    zip:          "#####",             // 우편번호 (5자리)
    biz_no:       "###-##-#####",      // 사업자등록번호
    emp_no:       "AA####"             // 사번 (영문2+숫자4)
};

// 동적으로 마스크 적용
function fn_applyMask(oMask, sType) {
    oMask.set_mask(MASKS[sType] || "");
}
```

이러한 마스크 상수를 공통 라이브러리에 정의해 두면, 화면마다 마스크 문자열을 반복 작성하지 않아도 됩니다.

## 숫자 전용 입력과의 비교

비슷한 역할을 하는 패턴으로 `Edit`에 `onkeyup`에서 숫자 이외의 입력을 제거하는 방법이 있습니다. 그러나 이 방식은 IME 조합 중인 문자 처리, 붙여넣기 처리 등 예외가 많습니다. **고정 서식이 있는 입력**에는 MaskEdit이 훨씬 안정적입니다. 서식 없이 숫자만 제한하는 경우는 일반 Edit에 유효성 로직을 더하거나 별도의 숫자 전용 컴포넌트를 사용하는 편이 낫습니다.

## MaskEdit 초기화

값을 완전히 지우려면 `set_value("")`를 사용합니다. 단, 마스크 구조 자체는 유지됩니다.

```javascript
// 초기화
this.mskPhone.set_value("");
this.mskDate.set_value("");

// 값 확인 (비어있는지)
var bEmpty = (this.mskPhone.value.length === 0);
```

---

**지난 글:** [Edit / Textarea — 텍스트 입력 컴포넌트 완전 분석](/posts/nexacro-n-edit-textarea/)

**다음 글:** [Calendar — 날짜 선택 컴포넌트 활용 가이드](/posts/nexacro-n-calendar/)

<br>
읽어주셔서 감사합니다. 😊
