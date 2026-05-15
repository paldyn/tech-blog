---
title: "[Nexacro N] 공통 라이브러리 설계 개요"
description: "Nexacro N 프로젝트에서 전역 함수, 공유 변수, 공통 팝업, 기본 폼을 한 곳에 모아 관리하는 공통 라이브러리 계층의 목적과 구성 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 1
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "공통라이브러리", "gfn", "CommonVariables", "BaseForm", "아키텍처"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-validation-ux/)에서 유효성 검사 UX 패턴까지 다루었다. 이제 시리즈의 다음 주제인 **공통 라이브러리** 설계로 넘어간다. 공통 라이브러리는 프로젝트 전반에서 재사용되는 함수, 변수, 팝업, 기본 폼을 하나의 폴더 아래 모아 놓은 구조다. 이것이 잘 설계되면 코드 중복이 줄고 변경이 한 곳에 집중되어 유지보수가 쉬워진다.

## 왜 공통 라이브러리가 필요한가

Nexacro N 프로젝트는 보통 수십~수백 개의 폼으로 구성된다. 폼마다 날짜 포맷 함수, null 체크, 트랜잭션 콜백 패턴을 각자 작성하면 다음 문제가 생긴다.

- **코드 중복**: 같은 로직이 폼마다 복사된다
- **불일치**: 폼마다 구현 방식이 달라진다
- **수정 비용**: 규칙이 바뀌면 모든 폼을 고쳐야 한다

공통 라이브러리는 이 문제를 계층 분리로 해결한다. 업무 화면 폼은 공통 라이브러리의 함수를 호출하기만 하고, 구현은 라이브러리 파일 안에만 존재한다.

![공통 라이브러리 계층 구조](/assets/posts/nexacro-n-common-library-structure.svg)

## 공통 라이브러리의 구성 요소

공통 라이브러리는 크게 네 가지로 나뉜다.

| 구성 요소 | 대표 파일 | 역할 |
|---|---|---|
| 전역 함수 | `gfn_string.xjs`, `gfn_date.xjs`, `gfn_validate.xjs` 등 | 도메인별 유틸리티 함수 |
| 공유 변수 | `CommonVariables.xjs` | 로그인 사용자, 코드 목록 등 전역 상태 |
| 공통 팝업 | `gfn_confirm.xfdl` | alert/confirm 대화상자 표준화 |
| 기본 폼 | `BaseForm.xfdl` | 모든 업무 폼이 상속하는 공통 레이아웃·이벤트 |

### 전역 함수 파일 분리 기준

함수를 하나의 파일에 모으면 파일이 방대해진다. 도메인별로 분리하면 파일을 찾기 쉽고 충돌을 줄일 수 있다.

```javascript
// gfn_string.xjs — 문자열 유틸리티
function gfn_trim(str) {
    if (gfn_isNull(str)) return "";
    return str.replace(/^\s+|\s+$/g, "");
}

function gfn_lpad(str, len, padChar) {
    str = String(str);
    while (str.length < len) str = padChar + str;
    return str;
}

// gfn_date.xjs — 날짜 유틸리티
function gfn_today() {
    return nexacro.getSystemDate().substr(0, 8); // YYYYMMDD
}

function gfn_formatDate(yyyymmdd) {
    if (!yyyymmdd || yyyymmdd.length < 8) return "";
    return yyyymmdd.substr(0, 4) + "-" +
           yyyymmdd.substr(4, 2) + "-" +
           yyyymmdd.substr(6, 2);
}
```

### null / empty 공통 체크

모든 파일에서 가장 자주 호출되는 함수는 null 체크다. `gfn_isNull` 하나로 `null`, `undefined`, 빈 문자열을 모두 처리한다.

```javascript
// gfn_common.xjs — 범용 유틸리티
function gfn_isNull(v) {
    return (v === null || v === undefined || String(v).trim() === "");
}

function gfn_nvl(v, defaultVal) {
    return gfn_isNull(v) ? defaultVal : v;
}
```

업무 폼에서는 아래처럼 짧게 호출한다.

```javascript
if (gfn_isNull(this.ds_user.getColumn(0, "user_nm"))) {
    alert("사용자명을 입력하세요.");
    return;
}
```

## 파일 구성 예시

![공통 라이브러리 파일 구성](/assets/posts/nexacro-n-common-library-pattern.svg)

프로젝트마다 폴더명은 달라질 수 있지만, `common/` 또는 `lib/` 아래에 라이브러리 파일을 모아 두는 패턴이 일반적이다. 이 폴더 안의 파일들은 TypeDefinition의 `<Script>` 태그로 전역 포함되어 모든 폼에서 접근 가능해진다.

## 공통 라이브러리 설계 원칙

좋은 공통 라이브러리를 만들기 위한 원칙은 세 가지다.

1. **순수 함수 우선**: 입력만 받고 출력만 반환하는 함수는 테스트하기 쉽고 부작용이 없다.
2. **`this` 참조 금지**: 라이브러리 함수 안에서 `this.ds_xxx` 같은 폼 컴포넌트를 직접 참조하면 의존성이 생겨 재사용이 불가능해진다. 필요하면 파라미터로 받는다.
3. **접두사 통일**: `gfn_` 접두사를 모든 전역 함수에 붙이면 이름 충돌을 방지하고 코드 검색이 쉬워진다.

```javascript
// 나쁜 예 — this 직접 참조 (재사용 불가)
function gfn_validate_bad() {
    var nm = this.edt_nm.value; // 특정 폼에 결합
    return !gfn_isNull(nm);
}

// 좋은 예 — 파라미터로 받기
function gfn_validate(value, label) {
    if (gfn_isNull(value)) {
        alert(label + "은(는) 필수 입력값입니다.");
        return false;
    }
    return true;
}
```

## 공통 라이브러리 작성 시 흔한 실수

**전역 변수 남용**: 함수 결과를 전역 변수에 담는 것은 공유 변수 오염을 유발한다. 반환값을 활용하는 패턴이 안전하다.

**파일 무한 확장**: 하나의 `common.xjs`에 모든 함수를 넣으면 파일이 거대해지고 관리가 어렵다. 도메인별로 파일을 분리하고 각 파일이 단일 책임을 갖도록 한다.

**버전 관리 미비**: 공통 라이브러리는 여러 팀이 공유하므로 변경 이력이 중요하다. 파일 상단에 변경 로그를 간략히 남기는 관례를 세워 두면 디버깅이 쉬워진다.

---

**지난 글:** [[Nexacro N] 유효성 검사 UX 패턴](/posts/nexacro-n-validation-ux/)

**다음 글:** [[Nexacro N] 공통 라이브러리 include 방법](/posts/nexacro-n-lib-include/)

<br>
읽어주셔서 감사합니다. 😊
