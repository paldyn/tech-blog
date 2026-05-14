---
title: "[Nexacro N] 전역 함수(gfn) 설계와 활용"
description: "Nexacro N 공통 라이브러리의 핵심인 gfn_ 전역 함수를 도메인별로 분류하고 순수 함수 원칙으로 작성하는 방법, 실무에서 자주 쓰는 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 3
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "gfn", "전역함수", "공통함수", "순수함수", "gfn_isNull", "gfn_today"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-lib-include/)에서 공통 라이브러리 파일을 TypeDefinition에 포함하는 방법을 다루었다. 이번 글에서는 라이브러리 파일 안에 어떤 함수를 어떻게 작성하는지, **`gfn_` 전역 함수 설계 원칙**을 구체적으로 살펴본다.

## gfn_ 접두사 규칙

Nexacro N 실무 프로젝트에서 전역 함수 이름에는 보통 `gfn_` (Global FuNction) 접두사를 붙인다. 이 규칙의 목적은 두 가지다.

1. **이름 충돌 방지**: 폼 스크립트의 로컬 함수, Nexacro 내장 함수와 이름이 겹치지 않는다.
2. **검색 편의성**: `gfn_`으로 시작하는 이름만 찾으면 공통 라이브러리 함수를 쉽게 식별할 수 있다.

접두사 뒤에 도메인을 추가하는 팀도 있다. 예를 들어 `gfn_str_trim()`, `gfn_dt_today()` 처럼 도메인 약어를 넣으면 함수명만 보고 어느 파일에 있는지 알 수 있다. 단, 이름이 길어지는 트레이드오프가 있으므로 팀 관례로 결정한다.

## 함수 분류 체계

![gfn_ 전역 함수 분류 체계](/assets/posts/nexacro-n-global-functions-categories.svg)

## 핵심 함수 구현 패턴

![gfn_ 함수 작성 패턴](/assets/posts/nexacro-n-global-functions-code.svg)

### null 체크 — gfn_isNull

가장 많이 호출되는 함수다. `null`, `undefined`, 공백 문자열을 모두 "비어 있음"으로 취급한다.

```javascript
function gfn_isNull(v) {
    return (v === null || v === undefined || String(v).trim() === "");
}

function gfn_nvl(v, defaultVal) {
    return gfn_isNull(v) ? defaultVal : v;
}
```

### 문자열 처리 — gfn_string.xjs

```javascript
function gfn_trim(str) {
    return gfn_isNull(str) ? "" : String(str).replace(/^\s+|\s+$/g, "");
}

function gfn_lpad(str, len, padChar) {
    str = gfn_nvl(str, "");
    padChar = gfn_nvl(padChar, " ");
    while (str.length < len) str = padChar + str;
    return str;
}

function gfn_rpad(str, len, padChar) {
    str = gfn_nvl(str, "");
    padChar = gfn_nvl(padChar, " ");
    while (str.length < len) str = str + padChar;
    return str;
}
```

### 날짜 처리 — gfn_date.xjs

```javascript
function gfn_today() {
    return nexacro.getSystemDate().substr(0, 8); // YYYYMMDD
}

function gfn_formatDate(d, sep) {
    if (gfn_isNull(d) || d.length < 8) return "";
    sep = gfn_nvl(sep, "-");
    return d.substr(0, 4) + sep + d.substr(4, 2) + sep + d.substr(6, 2);
}

function gfn_addDays(yyyymmdd, days) {
    var dt = new Date(
        parseInt(yyyymmdd.substr(0, 4)),
        parseInt(yyyymmdd.substr(4, 2)) - 1,
        parseInt(yyyymmdd.substr(6, 2)) + days
    );
    return gfn_lpad(String(dt.getFullYear()), 4, "0") +
           gfn_lpad(String(dt.getMonth() + 1), 2, "0") +
           gfn_lpad(String(dt.getDate()), 2, "0");
}
```

### 숫자·금액 처리 — gfn_number.xjs

```javascript
function gfn_comma(n) {
    if (gfn_isNull(n)) return "0";
    return String(parseInt(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function gfn_toNum(str) {
    if (gfn_isNull(str)) return 0;
    var n = parseFloat(String(str).replace(/,/g, ""));
    return isNaN(n) ? 0 : n;
}
```

## 순수 함수 원칙 유지

전역 함수 안에서 `this` 키워드나 특정 컴포넌트를 참조하면 재사용성이 사라진다.

```javascript
// 나쁜 예 — this 참조
function gfn_getOrderAmt_BAD() {
    return this.edt_amt.value; // 특정 폼에 결합
}

// 좋은 예 — 파라미터 수신
function gfn_toNum(str) {
    var n = parseFloat(String(str).replace(/,/g, ""));
    return isNaN(n) ? 0 : n;
}

// 호출부에서 컴포넌트 값 전달
var amt = gfn_toNum(this.edt_amt.value);
```

## 실무 체크리스트

함수를 작성하기 전에 아래 질문에 답하면 설계가 명확해진다.

| 질문 | 확인 |
|---|---|
| 동일한 입력에 항상 동일한 출력인가? | 순수 함수 여부 |
| `this`나 외부 변수를 참조하는가? | 참조 없어야 함 |
| 다른 전역 함수에 의존하는가? | TypeDef 로딩 순서 확인 |
| 이름이 `gfn_` 으로 시작하는가? | 네이밍 컨벤션 |
| 에지 케이스(null, 빈 문자, 0)를 처리하는가? | 방어 코딩 |

---

**지난 글:** [[Nexacro N] 공통 라이브러리 include 방법](/posts/nexacro-n-lib-include/)

**다음 글:** [[Nexacro N] 공유 변수(application 객체) 활용](/posts/nexacro-n-shared-vars/)

<br>
읽어주셔서 감사합니다. 😊
