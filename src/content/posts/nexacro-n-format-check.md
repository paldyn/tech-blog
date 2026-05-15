---
title: "[Nexacro N] 형식 검사 구현"
description: "Nexacro N에서 날짜·숫자·이메일·전화번호 등 입력값의 형식을 정규식으로 검사하는 gfn_checkFormat() 공통 함수 구현과 활용 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 5
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "형식검사", "정규식", "gfn_checkFormat", "날짜검사", "이메일검사"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-required-check/)에서 필수값 검사를 구현했다. 이번에는 **형식 검사**를 다룬다. 값이 존재하더라도 날짜 형식이 맞지 않거나 이메일 구조가 틀리면 서버에서 오류가 발생한다. 정규식 기반의 공통 함수로 형식 검사를 체계화하는 방법을 정리한다.

## 형식 검사가 필요한 상황

- 날짜 컬럼에 `"2026/99/99"` 같은 잘못된 값 입력
- 이메일 컬럼에 `"not-an-email"` 입력
- 숫자 컬럼에 `"abc"` 입력
- 전화번호에 하이픈 없이 입력

이런 값이 서버에 넘어가면 DB INSERT/UPDATE 실패, SQL 에러, 또는 잘못된 데이터 저장으로 이어진다. 클라이언트에서 미리 잡아야 한다.

## 형식 유형별 정규식 패턴

![형식 유형별 정규식](/assets/posts/nexacro-n-format-check-types.svg)

실무에서 자주 사용하는 형식 유형과 정규식을 정리하면 위와 같다. 날짜는 구분자 유무에 따라 두 가지 패턴이 필요하다.

## gfn_checkFormat() 구현

![형식 검사 공통 함수](/assets/posts/nexacro-n-format-check-code.svg)

```javascript
// 공통 라이브러리
function gfn_checkFormat(vVal, sType) {
    var reMap = {
        date8  : /^\d{4}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/,
        date10 : /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
        int    : /^-?\d+$/,
        float  : /^\d+(\.\d+)?$/,
        email  : /^[\w.+-]+@[\w-]+\.[a-z]{2,}$/i,
        phone  : /^0\d{1,2}-\d{3,4}-\d{4}$/
    };
    var re = reMap[sType];
    if (!re) return true; // 알 수 없는 타입은 통과
    return re.test(String(vVal));
}
```

`sType` 문자열로 어떤 형식을 검사할지 선택한다. 알 수 없는 타입을 전달하면 `true`를 반환해 저장을 막지 않는다. 새로운 형식은 `reMap`에 추가하기만 하면 된다.

## 저장 전 형식 검사 적용

필수값 검사 통과 후 형식 검사를 수행한다.

```javascript
function fn_save() {
    var ds = this.ds_input;

    // 1. 필수값 검사
    if (gfn_isNull(ds.getColumn(0, "reg_dt"))) {
        alert("등록일은 필수입니다."); return;
    }

    // 2. 형식 검사
    if (!gfn_checkFormat(ds.getColumn(0, "reg_dt"), "date8")) {
        alert("등록일 형식이 올바르지 않습니다. (YYYYMMDD)");
        this.edt_reg_dt.setFocus();
        return;
    }
    if (!gfn_checkFormat(ds.getColumn(0, "email"), "email")) {
        alert("이메일 형식이 올바르지 않습니다.");
        this.edt_email.setFocus();
        return;
    }

    this.transaction("save", "svc/save.do",
        "in:ds_input=ds_input", "", "fn_saveCb");
}
```

검사 순서는 필수값 → 형식 → 범위 순서가 자연스럽다. 값이 없는데 형식을 검사하면 빈 문자열이 정규식에 매칭되지 않아 형식 오류가 먼저 표시될 수 있다.

## 날짜 유효성 심화: 실제 날짜 존재 여부

정규식은 `20261399`처럼 월이 13, 일이 99인 문자열을 통과시키지 못하지만, 더 정확한 날짜 유효성(예: 2월에 30일이 입력되는 경우)은 정규식만으로 검사하기 어렵다.

```javascript
function gfn_isValidDate(sDate8) {
    // YYYYMMDD 형식 기준
    if (!gfn_checkFormat(sDate8, "date8")) return false;
    var y = parseInt(sDate8.substr(0, 4));
    var m = parseInt(sDate8.substr(4, 2)) - 1;
    var d = parseInt(sDate8.substr(6, 2));
    var dt = new Date(y, m, d);
    return dt.getFullYear() == y &&
           dt.getMonth() == m &&
           dt.getDate() == d;
}
```

`new Date(y, m, d)`를 생성한 뒤 다시 각 필드를 비교하면 JavaScript가 날짜를 자동으로 보정한 경우(예: 2월 30일 → 3월 2일)를 잡아낼 수 있다.

## 입력 중 자동 포맷 교정

날짜 입력 Edit에서 8자리 숫자를 입력하면 자동으로 구분자(`-`)를 삽입하는 UX를 제공할 수 있다.

```javascript
function edt_reg_dt_onchanged(obj, e) {
    var sVal = obj.value.replace(/-/g, "");
    if (sVal.length == 8 && /^\d{8}$/.test(sVal)) {
        obj.set_value(
            sVal.substr(0, 4) + "-" +
            sVal.substr(4, 2) + "-" +
            sVal.substr(6, 2)
        );
    }
}
```

단, `onchanged`에서 `set_value()`를 호출하면 다시 `onchanged`가 트리거될 수 있으므로, 이미 포맷이 맞는 값에는 다시 처리하지 않도록 분기한다.

## MaskEdit 컴포넌트 활용

형식이 고정된 입력(전화번호, 사업자번호, 우편번호)은 MaskEdit 컴포넌트를 사용하면 정규식 검사가 불필요하다. Mask 속성 자체가 입력을 제어하기 때문이다.

```
MaskEdit.mask = "000-0000-0000"   // 전화번호
MaskEdit.mask = "000-00-00000"    // 사업자번호
```

MaskEdit는 사용자가 마스크 패턴 외의 문자를 입력하지 못하도록 막아주므로, 저장 직전 형식 검사가 이중으로 필요 없다.

---

**지난 글:** [[Nexacro N] 필수값 검사 구현](/posts/nexacro-n-required-check/)

**다음 글:** [[Nexacro N] 범위 검사 구현](/posts/nexacro-n-range-check/)

<br>
읽어주셔서 감사합니다. 😊
