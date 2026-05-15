---
title: "[Nexacro N] 유효성 검사 개요"
description: "Nexacro N에서 클라이언트 3단계(입력 즉시·저장 직전·서버 응답)로 구성된 유효성 검사 계층과 검증 시점별 책임 범위를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 3
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "유효성검사", "validation", "필수값", "형식검사", "서버검증"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-transaction-unit/)에서 트랜잭션 단위 설계를 다뤘다. 이번 글부터는 **유효성 검사(Validation)** 시리즈를 시작한다. 데이터를 저장하기 전에 잘못된 값을 걸러내는 일은 UX와 데이터 무결성 양쪽에 영향을 미친다. Nexacro N에서는 "언제" 검증하느냐에 따라 사용하는 이벤트와 방법이 달라진다.

## 유효성 검사가 필요한 이유

서버는 빈값이나 형식이 맞지 않는 데이터를 받으면 예외를 던지거나 잘못된 결과를 저장한다. 클라이언트에서 미리 잡아야 서버 요청 자체를 아낄 수 있고, 사용자는 정확히 어디를 고쳐야 하는지 즉시 알 수 있다.

유효성 검사를 구현할 때 첫 번째로 결정해야 할 것은 **언제 검증하는가**다. 너무 이른 검증(입력 중 매 글자)은 사용자를 방해하고, 너무 늦은 검증(서버 응답)은 UX를 해친다.

## 유효성 검사 계층 구조

![유효성 검사 계층](/assets/posts/nexacro-n-validation-layers.svg)

Nexacro N 프로젝트에서 유효성 검사는 세 계층으로 나뉜다.

**1단계 — 입력 즉시**: `onchanged` 이벤트에서 글자 수 제한·숫자 타입 강제·자동 포맷 교정을 수행한다. 사용자가 입력하는 동안 실시간으로 피드백을 준다.

**2단계 — 저장 직전**: `fn_save()` 내부에서 `gfn_validate()`를 호출해 전체 필드의 필수값·형식·범위를 한 번에 검증한다. 하나라도 실패하면 `transaction()`을 호출하지 않는다.

**3단계 — 서버 응답**: 콜백에서 `nEC`(에러 코드)를 확인한다. 중복값·참조 무결성·권한 체크 등 DB나 비즈니스 룰이 개입해야 하는 항목이 여기에 해당한다.

## 검증 시점별 책임 매핑

![검증 시점과 검증 항목](/assets/posts/nexacro-n-validation-timing.svg)

## 검증 유형 4가지

이후 글에서 각각을 상세히 다루며, 여기서는 분류만 정의한다.

| 검증 유형 | 설명 | 관련 글 |
|---|---|---|
| 필수값 검사 | null·빈 문자열·공백만 있는 값 차단 | nexacro-n-required-check |
| 형식 검사 | 날짜·숫자·이메일·전화번호 형식 | nexacro-n-format-check |
| 범위 검사 | 숫자 범위, 날짜 범위, 문자열 길이 | nexacro-n-range-check |
| 서버 검증 | 중복·권한·비즈니스 룰 | nexacro-n-server-validation |

## gfn_validate() 공통 함수 패턴

저장 직전 검증은 공통 라이브러리에 `gfn_validate()` 함수로 추출하는 것이 표준 패턴이다. 검증 규칙을 배열로 선언하고, 함수는 순서대로 검사 후 첫 번째 실패 항목에서 포커스를 이동하고 `false`를 반환한다.

```javascript
function fn_save() {
    // gfn_validate가 false면 전송 중단
    if (!gfn_validate(this.ds_input, [
        { col: "user_nm", label: "사용자명", required: true },
        { col: "email",   label: "이메일",   format: "email" },
        { col: "age",     label: "나이",     min: 0, max: 150 }
    ])) return;

    this.transaction("save", "svc/save.do",
        "in:ds_input=ds_input", "", "fn_saveCb");
}
```

규칙 배열은 선언적으로 작성되어 검증 항목 추가·수정이 쉽다. 구체적인 구현은 `nexacro-n-validation-common-fn` 글에서 다룬다.

## 검증 실패 시 UX 원칙

1. **첫 번째 실패 항목으로 포커스 이동** — 사용자가 어디를 고쳐야 하는지 즉시 알 수 있게
2. **구체적인 에러 메시지** — "입력 오류"가 아닌 "사용자명은 필수 입력값입니다."
3. **시각적 강조** — 실패한 컨트롤의 배경색·테두리 변경
4. **비파괴적 피드백** — 입력한 값을 지우지 않고 어디가 잘못됐는지만 알림

---

**지난 글:** [[Nexacro N] 트랜잭션 단위 설계](/posts/nexacro-n-transaction-unit/)

**다음 글:** [[Nexacro N] 필수값 검사](/posts/nexacro-n-required-check/)

<br>
읽어주셔서 감사합니다. 😊
