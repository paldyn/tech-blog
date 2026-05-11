---
title: "[Nexacro N] 동기 vs 비동기 트랜잭션 — 언제 무엇을 써야 하나"
description: "Nexacro N transaction()의 기본 비동기 동작 원리, 동기 트랜잭션의 위험성, 비동기 순차 처리를 위한 콜백 체이닝 패턴, Form 로드 시 초기화 순서 제어 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 7
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "transaction", "async", "sync", "비동기", "동기", "초기화순서"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-callback-pattern/)에서 콜백 패턴을 정리했습니다. 콜백이 필요한 근본 이유는 `transaction()`이 **비동기**이기 때문입니다. 비동기 방식에 익숙하지 않으면 "호출 직후 Dataset이 비어 있다"는 문제를 자주 겪습니다. 이번 글에서는 Nexacro N의 비동기 동작 원리와 동기가 필요한 예외 상황을 다룹니다.

## transaction()은 기본적으로 비동기

`transaction()`을 호출하면 HTTP 요청을 백그라운드에서 보내고, 클라이언트는 **다음 코드를 계속 실행**합니다. 서버 응답이 오면 그때 콜백이 호출됩니다.

![동기(Sync) vs 비동기(Async) 트랜잭션 비교](/assets/posts/nexacro-n-sync-vs-async-comparison.svg)

이것이 비동기의 핵심: **UI가 블록되지 않는다**는 것입니다. 서버 처리 중에도 사용자는 화면을 스크롤하고 다른 탭을 클릭할 수 있습니다.

## 비동기로 인한 흔한 실수

```javascript
function fn_search() {
    this.transaction(
        "SVC_SRCH",
        "SVC_EMP::getList",
        "dsCond=dsSearch",
        "dsResult=dsMain",
        "",
        "fn_searchCb"
    );

    // 잘못된 패턴: transaction() 직후 Dataset 읽기
    var count = this.dsMain.rowcount; // 항상 이전 값! 아직 응답 안 옴
    alert("조회 건수: " + count);    // 잘못된 결과 출력
}
```

올바른 방법은 콜백에서 처리합니다:

```javascript
function fn_searchCb(svcId, errCode, errMsg) {
    if (errCode !== 0) { alert(errMsg); return; }

    var count = this.dsMain.rowcount; // 응답 완료 후 정확한 값
    alert("조회 건수: " + count);
}
```

## 비동기 순차 처리 — 콜백 체이닝

"공통코드 로딩 완료 후 목록 조회"처럼 **순서가 보장되어야 하는 경우**를 콜백 체이닝으로 처리합니다.

![동기 트랜잭션과 비동기 순차 처리 비교](/assets/posts/nexacro-n-sync-vs-async-code.svg)

```javascript
function Form_onload(obj, e) {
    // 1단계: 공통코드 먼저 로딩
    this.fn_initCode();
}

function fn_initCode() {
    this.transaction(
        "SVC_INIT",
        "SVC_CODE::getDeptCode",
        "",
        "dsCombo=dsDeptCombo",
        "",
        "fn_initCb"
    );
}

function fn_initCb(svcId, errCode, errMsg) {
    if (errCode !== 0) {
        alert("[초기화 실패] " + errMsg);
        return;
    }
    // 2단계: 공통코드 로딩 완료 후 목록 조회
    this.fn_search(); // 순서 보장
}

function fn_search() {
    // dsCombo에 이미 데이터가 있음이 보장됨
    this.transaction("SVC_SRCH", "SVC_EMP::getList",
        "dsCond=dsSearch", "dsResult=dsMain", "", "fn_searchCb");
}
```

## 병렬 트랜잭션

순서가 중요하지 않은 경우 두 트랜잭션을 동시에 실행할 수도 있습니다.

```javascript
function Form_onload(obj, e) {
    // 두 트랜잭션 동시 발사 — 서버에서 병렬 처리됨
    this.transaction("SVC_DEPT", "SVC_CODE::getDept",
        "", "dsDept=dsDeptCombo", "", "fn_codeCb");
    this.transaction("SVC_TYPE", "SVC_CODE::getType",
        "", "dsType=dsTypeCombo", "", "fn_codeCb");
}

function fn_codeCb(svcId, errCode, errMsg) {
    if (errCode !== 0) return;
    // 각각의 응답이 올 때마다 호출됨 — svcId로 구분
    if (svcId === "SVC_DEPT") trace("부서코드 로딩 완료");
    if (svcId === "SVC_TYPE") trace("유형코드 로딩 완료");
}
```

두 트랜잭션이 각자 완료될 때마다 콜백이 개별 호출됩니다.

## 동기 트랜잭션이 필요한 경우

Nexacro N은 `async` 파라미터를 통해 동기 트랜잭션을 지원합니다. 그러나 **UI가 블록**되므로 매우 신중하게 사용해야 합니다.

실제로 동기가 필요한 경우는 거의 없습니다. 대부분 콜백 체이닝으로 해결할 수 있습니다.

```javascript
// 동기 설정 (가급적 사용 금지)
// Nexacro N에서는 transaction() 옵션으로 설정
// 프레임워크 버전마다 설정 방식이 다름 — 공식 문서 확인 필요
```

동기 트랜잭션의 문제점:
- 서버 응답 대기 중 **화면 완전 정지** (스크롤, 클릭, 키 입력 불가)
- 서버 응답이 느리면 브라우저가 **"응답 없음"** 처리
- 모바일 환경에서 특히 심각한 UX 저하

## Form 로드 순서 제어 실전 패턴

```javascript
function Form_onload(obj, e) {
    this.fn_step1_loadCombo();
}

function fn_step1_loadCombo() {
    this.transaction("SVC_COMBO",
        "SVC_CODE::getAllCombo", "",
        "dsDept=dsDept dsType=dsType dsStatus=dsStatus",
        "", "fn_step1_cb");
}

function fn_step1_cb(svcId, errCode, errMsg) {
    if (errCode !== 0) {
        alert("공통코드 로딩 실패");
        return;
    }
    this.fn_step2_search(); // 모든 콤보 로딩 후 조회
}

function fn_step2_search() {
    this.transaction("SVC_SRCH",
        "SVC_EMP::getList",
        "dsCond=dsSearch",
        "dsResult=dsMain",
        "pageNo=1 pageSize=20",
        "fn_searchCb");
}
```

`fn_step1_loadCombo` → `fn_step1_cb` → `fn_step2_search` → `fn_searchCb` 순서가 명확하게 보장됩니다.

## 요약

| 상황 | 권장 방식 |
|------|-----------|
| 일반 조회·저장 | 비동기 (기본값) + 콜백 |
| A완료 후 B 실행 | 콜백 체이닝 |
| A와 B를 동시에 | 두 transaction() 연속 호출 |
| 동기 트랜잭션 | 거의 불필요 — 콜백 체이닝으로 대체 |

---

**지난 글:** [콜백(Callback) 패턴 완전 정리](/posts/nexacro-n-callback-pattern/)

**다음 글:** [트랜잭션 오류 처리 전략](/posts/nexacro-n-transaction-error/)

<br>
읽어주셔서 감사합니다. 😊
