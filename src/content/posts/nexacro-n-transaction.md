---
title: "[Nexacro N] 트랜잭션(Transaction) 개요 — 서버 통신의 기본 단위"
description: "Nexacro N의 핵심 서버 통신 메서드인 transaction()의 동작 원리, 파라미터 구조, 콜백 패턴을 단계별로 설명합니다. PL 프로토콜 흐름부터 실전 코드까지 한 번에 이해합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 2
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "transaction", "서버통신", "PL프로토콜", "callback", "dataset"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-debugging/)에서 디버깅 도구 체계를 살펴봤습니다. 이번 글부터는 Nexacro N 개발에서 가장 핵심적인 영역인 **서버 통신**을 다룹니다. Nexacro N의 서버 통신은 `transaction()` 메서드 하나를 중심으로 이루어집니다. Dataset을 서버에 보내고, 서버가 처리한 결과 Dataset을 받아 화면에 표시하는 이 흐름을 정확히 이해하는 것이 Nexacro N 개발의 출발점입니다.

## transaction()이란 무엇인가

`transaction()`은 Nexacro N Form의 메서드로, 클라이언트의 Dataset을 서버로 전송하고 서버의 응답 Dataset을 받는 **모든 서버 통신을 담당**합니다. REST API처럼 직접 HTTP 요청을 작성하지 않아도 되며, Dataset 직렬화·역직렬화, 오류 코드 처리가 자동으로 이루어집니다.

![Nexacro N 트랜잭션 처리 흐름](/assets/posts/nexacro-n-transaction-flow.svg)

`transaction()`을 호출하면 다음 순서로 처리됩니다:
1. 지정한 입력 Dataset을 **PL(Protocol Language) 포맷**으로 직렬화
2. 서비스 URL로 **HTTP POST** 전송
3. 서버 어댑터가 Dataset을 복원, 비즈니스 로직 실행
4. 결과 Dataset을 PL로 직렬화해 응답
5. 클라이언트가 출력 Dataset에 데이터를 채우고 **콜백 함수 호출**

## transaction() 파라미터 구조

![transaction() 파라미터 구조](/assets/posts/nexacro-n-transaction-syntax.svg)

6개의 파라미터를 순서대로 전달합니다.

```javascript
this.transaction(
    svcID,       // ① 서비스 식별자 문자열
    url,         // ② 서비스 URL 또는 서비스명::메서드
    inDatasets,  // ③ 입력 Dataset 매핑 ("서버명=클라이언트DS ...")
    outDatasets, // ④ 출력 Dataset 매핑 ("서버DS=클라이언트DS ...")
    args,        // ⑤ 추가 파라미터 ("key=value ...")
    callback     // ⑥ 콜백 함수명 문자열
);
```

### ① svcID — 서비스 식별자

콜백 함수에서 어떤 트랜잭션이 응답했는지 구분하는 문자열입니다. 여러 트랜잭션을 하나의 콜백 함수로 처리할 때 `svcID`로 분기합니다.

```javascript
function fn_commonCb(svcId, errCode, errMsg) {
    if (svcId === "SVC_SEARCH") { /* ... */ }
    else if (svcId === "SVC_SAVE") { /* ... */ }
}
```

### ② url — 서비스 URL

두 가지 형식이 있습니다.

| 형식 | 설명 | 예 |
|------|------|----|
| `서비스명::메서드` | TypeDefinition에 등록된 서비스 사용 | `"SVC_SEARCH::selectList"` |
| 절대 URL | HTTP URL 직접 지정 | `"http://host/api/search"` |

실무에서는 TypeDefinition에 서비스 URL을 등록해두고 `서비스명::메서드` 형식을 쓰는 것이 일반적입니다. URL을 한 곳에서 관리할 수 있어 유지보수가 쉽습니다.

### ③ inDatasets — 입력 Dataset

`"서버변수명=클라이언트Dataset"` 형식으로 지정합니다. 공백으로 여러 개를 연결합니다.

```javascript
// 단일 입력
"dsCond=dsSearch"

// 복수 입력
"dsCond=dsSearch dsMaster=dsMasterInput"
```

서버에서는 `dsCond`라는 이름으로 Dataset을 받습니다.

### ④ outDatasets — 출력 Dataset

```javascript
// 단일 출력
"dsResult=dsMain"

// 복수 출력
"dsHeader=dsHeader dsDetail=dsDetail"
```

서버가 `dsResult`라는 이름으로 반환한 Dataset이 클라이언트의 `dsMain`에 채워집니다.

### ⑤ args — 추가 파라미터

Dataset 없이 단순 값을 파라미터로 전달할 때 사용합니다.

```javascript
"pageNo=1 pageSize=20 sortColumn=REG_DATE"
```

서버에서는 request 파라미터로 받을 수 있습니다.

### ⑥ callback — 콜백 함수

```javascript
// 콜백 함수 서명
function fn_searchCb(svcId, errCode, errMsg) {
    if (errCode !== 0) {
        alert("오류: " + errMsg);
        return;
    }
    // 정상 처리
    this.grdMain.setReadOnly(false);
}
```

`errCode`가 `0`이면 성공, `0`이 아니면 오류입니다. 콜백에서 반드시 `errCode` 확인을 먼저 합니다.

## 완전한 예제: 목록 조회

```javascript
function fn_search() {
    // 조건 Dataset에 현재 입력값 설정
    this.dsSearch.clearData();
    this.dsSearch.addRow();
    this.dsSearch.setColumn(0, "DEPT_CD", this.edtDeptCd.value);
    this.dsSearch.setColumn(0, "SRCH_NM", this.edtSrchNm.value);

    this.transaction(
        "SVC_SEARCH",
        "SVC_EMP::getList",
        "dsCond=dsSearch",
        "dsResult=dsMain",
        "",
        "fn_searchCb"
    );
}

function fn_searchCb(svcId, errCode, errMsg) {
    if (errCode !== 0) {
        alert("[조회 실패] " + errMsg);
        return;
    }
    // dsMain에 결과가 자동으로 채워짐
    this.grdMain.setReadOnly(true);
    trace("조회 완료: " + this.dsMain.rowcount + "건");
}
```

## 트랜잭션 호출 규칙

실무에서 지켜야 할 기본 규칙입니다.

1. **콜백에서 항상 errCode 확인** — 조건 없이 성공 로직을 실행하면 오류 시 화면이 비정상 동작
2. **콜백 함수명은 명확하게** — `fn_검색명Cb` 형태로 어떤 트랜잭션인지 명확히
3. **transaction() 이후 dsMain 바로 읽지 않기** — 비동기이므로 콜백에서만 결과 접근
4. **중복 호출 방지** — 버튼 클릭 직후 버튼을 disable 처리하고 콜백에서 enable

---

**지난 글:** [디버깅 완전 가이드](/posts/nexacro-n-debugging/)

**다음 글:** [서비스 URL 설정과 TypeDefinition](/posts/nexacro-n-service-url/)

<br>
읽어주셔서 감사합니다. 😊
