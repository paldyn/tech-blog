---
title: "[Nexacro N] 콜백(Callback) 패턴 완전 정리"
description: "Nexacro N transaction() 콜백 함수의 서명, 전용 콜백·공통 콜백·체이닝 패턴, errCode 처리 원칙, 콜백에서 흔히 발생하는 실수까지 실전 기준으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 6
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "callback", "transaction", "errCode", "비동기", "콜백체이닝"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-transaction-args/)에서 args 파라미터 활용을 배웠습니다. `transaction()`은 비동기로 동작하며, 서버 응답이 오면 **콜백 함수**가 호출됩니다. 콜백을 어떻게 설계하느냐가 화면 동작의 안정성을 좌우합니다. 이번 글에서는 콜백 패턴의 모든 것을 정리합니다.

## 콜백 함수 서명

콜백 함수는 세 개의 파라미터를 받습니다.

```javascript
function fn_searchCb(svcId, errCode, errMsg) {
    // svcId  : transaction() 첫 번째 파라미터와 동일한 서비스 식별자
    // errCode: 0이면 성공, 0이 아니면 오류
    // errMsg : 오류 메시지 (성공 시 빈 문자열)
}
```

| 파라미터 | 타입 | 설명 |
|----------|------|------|
| svcId | String | 트랜잭션 식별자 (transaction 1번 인자와 동일) |
| errCode | Number | 0=성공, 음수=서버/네트워크 오류, 양수=비즈니스 오류 |
| errMsg | String | 오류 메시지, 성공 시 "" |

## 콜백의 첫 번째 규칙: errCode 확인

콜백의 **가장 첫 번째 코드**는 반드시 errCode 확인이어야 합니다. 이걸 빠뜨리면 오류 상황에서도 성공 로직이 실행됩니다.

```javascript
function fn_searchCb(svcId, errCode, errMsg) {
    // 반드시 첫 번째로 오류 확인
    if (errCode !== 0) {
        alert("[조회 실패] " + errMsg);
        return; // 이후 로직 실행 중단
    }

    // 여기서부터가 정상 처리
    trace("조회 완료: " + this.dsMain.rowcount + "건");
    this.grdMain.setReadOnly(true);
}
```

`return`을 빠뜨리면 오류 상황에서도 아래 로직이 실행됩니다.

## 두 가지 콜백 패턴

![트랜잭션 콜백 패턴 구조](/assets/posts/nexacro-n-callback-pattern-structure.svg)

### 패턴 A: 전용 콜백 (권장)

트랜잭션마다 별도 콜백 함수를 만드는 방식입니다.

```javascript
// 조회
this.transaction("SVC_SRCH", "SVC_EMP::getList",
    "dsCond=dsSearch", "dsResult=dsMain", "", "fn_searchCb");

// 저장
this.transaction("SVC_SAVE", "SVC_EMP::save",
    "dsInput=dsMain", "", "", "fn_saveCb");

function fn_searchCb(svcId, errCode, errMsg) {
    if (errCode !== 0) { alert(errMsg); return; }
    // 조회 전용 처리
}

function fn_saveCb(svcId, errCode, errMsg) {
    if (errCode !== 0) { alert(errMsg); return; }
    // 저장 전용 처리
    this.fn_search(); // 저장 후 재조회
}
```

장점: 각 콜백이 독립적이어서 가독성이 높고 수정 시 영향 범위가 명확합니다.

### 패턴 B: 공통 콜백 (svcId 분기)

유사한 처리를 묶어 하나의 콜백으로 처리하는 방식입니다.

```javascript
function fn_commonCb(svcId, errCode, errMsg) {
    if (errCode !== 0) {
        alert("[오류] " + errMsg);
        return;
    }
    switch (svcId) {
        case "SVC_SRCH":
            // 조회 처리
            break;
        case "SVC_SAVE":
            alert("저장되었습니다.");
            this.fn_search();
            break;
        case "SVC_DEL":
            alert("삭제되었습니다.");
            this.fn_search();
            break;
    }
}
```

적합한 상황: CRUD 중 저장·삭제처럼 성공 후 동일하게 재조회가 필요한 경우.

## 콜백 체이닝 패턴

콜백 안에서 새 `transaction()`을 호출할 수 있습니다. 저장 후 재조회가 가장 흔한 패턴입니다.

![저장 후 재조회 — 콜백 체이닝 패턴](/assets/posts/nexacro-n-callback-pattern-chain.svg)

```javascript
function fn_save() {
    if (!this.fn_validate()) return;

    this.transaction(
        "SVC_SAVE",
        "SVC_EMP::save",
        "dsInput=dsMain",
        "",
        "",
        "fn_saveCb"
    );
}

function fn_saveCb(svcId, errCode, errMsg) {
    if (errCode !== 0) {
        alert("[저장 실패] " + errMsg);
        return;
    }

    alert("저장되었습니다.");
    this.fn_search(); // 저장 성공 → 재조회 트랜잭션 발생
}

function fn_searchCb(svcId, errCode, errMsg) {
    if (errCode !== 0) { alert(errMsg); return; }
    // 목록 갱신 처리
}
```

콜백 안에서 다시 `transaction()`을 호출하는 것은 완전히 유효합니다. 이것이 Nexacro N에서 **순차 비동기 처리**를 구현하는 기본 방법입니다.

## 콜백에서 this 참조

콜백 함수 내에서 `this`는 현재 Form을 가리킵니다. Form의 Dataset, 컴포넌트, 메서드에 자유롭게 접근할 수 있습니다.

```javascript
function fn_searchCb(svcId, errCode, errMsg) {
    if (errCode !== 0) return;

    // this = 현재 Form
    this.dsMain.rowposition = 0;          // Dataset 현재 행 이동
    this.grdMain.setReadOnly(true);       // Grid 읽기 전용
    this.btnSave.enable = true;           // 버튼 활성화
    this.fn_setTotalCount();              // 다른 메서드 호출
}
```

## 자주 발생하는 콜백 실수

### 실수 1: return 빠뜨리기

```javascript
// 잘못된 패턴
function fn_saveCb(svcId, errCode, errMsg) {
    if (errCode !== 0) {
        alert(errMsg);
        // return이 없어서 오류 시에도 아래 코드 실행!
    }
    this.fn_search(); // 오류 상황에서도 재조회 발생
}
```

### 실수 2: 콜백 후 즉시 Dataset 읽기

`transaction()`은 비동기이므로 호출 직후 Dataset을 읽으면 응답 전 상태입니다.

```javascript
function fn_search() {
    this.transaction("SVC_SRCH", ..., "dsResult=dsMain", "", "fn_searchCb");
    var count = this.dsMain.rowcount; // ← 아직 응답 전! 항상 이전 값
}

// 올바른 방법: 콜백에서 읽기
function fn_searchCb(svcId, errCode, errMsg) {
    if (errCode !== 0) return;
    var count = this.dsMain.rowcount; // ← 응답 완료 후 정확한 값
}
```

### 실수 3: 중복 호출 방지 누락

버튼 더블클릭으로 트랜잭션이 중복 발생하는 것을 방지합니다.

```javascript
function fn_save() {
    this.btnSave.enable = false; // 저장 중 비활성화

    this.transaction("SVC_SAVE", ..., "fn_saveCb");
}

function fn_saveCb(svcId, errCode, errMsg) {
    this.btnSave.enable = true; // 완료 후 재활성화

    if (errCode !== 0) { alert(errMsg); return; }
    alert("저장되었습니다.");
    this.fn_search();
}
```

---

**지난 글:** [transaction() args 파라미터 완전 활용](/posts/nexacro-n-transaction-args/)

**다음 글:** [동기 vs 비동기 트랜잭션](/posts/nexacro-n-sync-vs-async/)

<br>
읽어주셔서 감사합니다. 😊
