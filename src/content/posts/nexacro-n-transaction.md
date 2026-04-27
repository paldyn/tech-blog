---
title: "[Nexacro N] Transaction — 서버 통신의 모든 것"
description: "Nexacro N의 transaction() 메서드 구조와 인자를 완전 분해하고, 조회·저장·다중 서비스 호출·오류 처리·취소까지 실전 패턴으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-25"
archiveOrder: 7
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "transaction", "http", "dataset"]
featured: false
draft: false
---

지난 [\[Nexacro N\] 데이터바인딩 — Dataset과 컴포넌트를 연결하는 핵심 메커니즘](/posts/nexacro-n-databinding/) 글에서 이어집니다.

이 글은 **Nexacro N** 기준으로 작성되었습니다.

Nexacro N 애플리케이션은 서버와 통신할 때 표준 HTTP를 사용하지만, 그 위에 **Dataset 직렬화 프로토콜**이라는 자체 규약을 얹습니다. 개발자가 직접 XMLHttpRequest를 다루는 대신 `this.transaction()` 한 메서드로 "요청 Dataset 전송 → 서버 처리 → 응답 Dataset 수신 → 콜백 실행"을 모두 처리합니다. 이 글에서는 그 메커니즘을 낱낱이 분해하고, 실무에서 반드시 필요한 패턴들을 코드와 함께 정리합니다.

---

## transaction() 메서드 전체 구조

![Nexacro N Transaction 요청/응답 흐름](/assets/posts/nexacro-n-transaction-flow.svg)

`transaction()`의 전체 시그니처는 다음과 같습니다.

```javascript
// transaction() 전체 시그니처
this.transaction(
    svcid,        // 서비스 식별자 (문자열, 콜백에서 어떤 요청인지 구분)
    url,          // 서버 URL (상대/절대 경로)
    inDatasets,   // 요청 Dataset 매핑 ("서버명=클라이언트명 ...")
    outDatasets,  // 응답 Dataset 매핑 ("서버명=클라이언트명 ...")
    args,         // 추가 파라미터 ("key=val key2=val2")
    callbackFn,   // 완료 콜백 함수명 (문자열)
    async,        // 비동기 여부 (기본 true)
    timeout       // 타임아웃(ms), 0이면 무제한
);
```

각 인자의 역할을 하나씩 살펴봅니다.

---

## 인자 상세 분해

![Nexacro N transaction() 메서드 구조](/assets/posts/nexacro-n-transaction-structure.svg)

### svcid — 서비스 식별자

콜백 함수에서 어떤 요청이 돌아왔는지 구분하는 레이블입니다. 하나의 폼에서 여러 transaction을 보낼 때 단일 콜백 함수에서 분기 처리하는 데 사용합니다.

```javascript
// 여러 서비스를 한 콜백에서 처리
function fn_commonCallback(svcid, errorCode, errorMsg) {
    if (errorCode != 0) {
        this.alert("[" + svcid + "] 오류: " + errorMsg);
        return;
    }

    // svcid로 분기
    switch (svcid) {
        case "svcSearch":
            fn_afterSearch();
            break;
        case "svcSave":
            this.alert("저장되었습니다.");
            fn_search(); // 저장 후 재조회
            break;
        case "svcDelete":
            this.alert("삭제되었습니다.");
            fn_search();
            break;
    }
}
```

### inDatasets / outDatasets — Dataset 매핑

`"서버명=클라이언트명"` 형식으로 지정합니다. 공백으로 여러 Dataset을 나열할 수 있습니다.

```javascript
// 단일 Dataset 입출력
this.transaction(
    "svcSearch",
    "USER/search.do",
    "input=dsParam",          // 서버에서 "input"이라는 이름으로 수신
    "output=dsResult",        // 서버에서 "output"이라는 이름으로 전송
    "",
    "fn_searchCallback"
);

// 복수 Dataset 입출력
this.transaction(
    "svcSave",
    "USER/save.do",
    "inParam=dsParam inData=dsUser",          // 요청 Dataset 2개
    "outResult=dsResult outCode=dsCodeList",  // 응답 Dataset 2개
    "",
    "fn_saveCallback"
);
```

**주의:** outDatasets에 지정된 Dataset은 콜백 호출 시점에 이미 서버 응답으로 교체된 상태입니다. 콜백 진입 즉시 접근해도 안전합니다.

---

## 기본 패턴 — 조회(Search)

가장 흔한 사용 패턴입니다.

```javascript
// 조회 버튼 클릭
function btn_search_onclick(obj, e) {
    // 파라미터 Dataset 초기화 후 검색 조건 설정
    this.dsParam.clearData();
    this.dsParam.addRow();
    this.dsParam.setColumn(0, "USER_NM", this.edtSearchNm.value);
    this.dsParam.setColumn(0, "DEPT_CD", this.cmbDept.value);
    this.dsParam.setColumn(0, "USE_YN",  this.cmbUseYn.value);

    // 결과 Dataset 초기화
    this.dsResult.clearData();

    // 트랜잭션 실행
    this.transaction(
        "svcSearch",
        "USER/getList.do",
        "in:dsParam",      // "in:" 접두어 방식도 동일하게 동작
        "out:dsResult",
        "",
        "fn_searchCallback"
    );
}

function fn_searchCallback(svcid, errorCode, errorMsg) {
    if (errorCode != 0) {
        this.alert("조회 실패: " + errorMsg);
        return;
    }

    // dsResult에 데이터가 채워진 상태 — Grid는 자동 갱신됨
    var nCount = this.dsResult.rowcount;

    if (nCount == 0) {
        this.alert("조회 결과가 없습니다.");
    } else {
        // 첫 행을 현재 행으로 — 바인딩된 단일 값 컴포넌트도 갱신됨
        this.dsResult.set_rowposition(0);
    }
}
```

---

## 저장 패턴 — 변경 행만 전송

Dataset은 각 행의 상태(rowstatus)를 추적합니다. `I`(삽입), `U`(수정), `D`(삭제) 상태의 행만 서버로 전송하고 싶을 때 `copyData` 또는 서버 측 XPlatformManager가 rowstatus를 활용합니다.

```javascript
// 저장 버튼 클릭
function btn_save_onclick(obj, e) {
    // 변경 내역이 있는지 확인
    var bChanged = false;
    for (var i = 0; i < this.dsUser.rowcount; i++) {
        var sStatus = this.dsUser.getRowType(i);
        // getRowType: 0=normal, 1=insert, 2=update, 4=delete
        if (sStatus != Dataset.ROWTYPE_NORMAL) {
            bChanged = true;
            break;
        }
    }

    if (!bChanged) {
        this.alert("변경된 데이터가 없습니다.");
        return;
    }

    // 저장 전 유효성 검사
    if (!fn_validate()) return;

    this.transaction(
        "svcSave",
        "USER/save.do",
        "inData=dsUser",   // rowstatus 포함 전체 Dataset 전송
        "outResult=dsResult",
        "",
        "fn_saveCallback"
    );
}

function fn_saveCallback(svcid, errorCode, errorMsg) {
    if (errorCode != 0) {
        this.alert("저장 실패: " + errorMsg);
        return;
    }

    this.alert("저장되었습니다.");

    // 저장 성공 후 재조회하여 rowstatus 초기화
    fn_search();
}

// 간단한 유효성 검사 예시
function fn_validate() {
    for (var i = 0; i < this.dsUser.rowcount; i++) {
        if (this.dsUser.getRowType(i) == Dataset.ROWTYPE_NORMAL) continue;

        var sUserId = this.dsUser.getColumn(i, "USER_ID");
        if (nexacro.isNull(sUserId) || sUserId == "") {
            this.alert((i + 1) + "번째 행: 사용자 ID는 필수입니다.");
            this.grdUser.set_rowposition(i);
            return false;
        }
    }
    return true;
}
```

---

## args 파라미터 활용

Dataset이 아닌 단순 키-값 파라미터를 서버에 전달할 때 `args`를 씁니다. 서버에서는 일반 HTTP 파라미터처럼 수신합니다.

```javascript
// args로 추가 파라미터 전달
function fn_searchWithArgs(obj, e) {
    this.transaction(
        "svcSearch",
        "USER/search.do",
        "in:dsParam",
        "out:dsResult",
        "pageNo=1 pageSize=20 sortCol=USER_NM sortDir=ASC",  // URL 쿼리스트링으로 전달
        "fn_searchCallback"
    );
}

// 동적으로 args 구성
function fn_buildArgs() {
    var nPage  = this.edtPage.value  || 1;
    var nSize  = this.cmbSize.value  || 20;
    var sSort  = this.cmbSort.value  || "REG_DT";

    return "pageNo=" + nPage + " pageSize=" + nSize + " sortCol=" + sSort;
}
```

---

## 동기(Synchronous) 트랜잭션

기본값은 비동기(`async=true`)이지만, 순서가 보장되어야 하는 초기화 로직에서는 동기 트랜잭션이 필요할 수 있습니다.

```javascript
// 폼 onload에서 공통 코드 Dataset 동기 로드
function Form_onload(obj, e) {
    // 코드 Dataset 먼저 동기 로드
    this.transaction(
        "svcLoadCode",
        "COMMON/getCode.do",
        "",
        "out:dsDeptCode out:dsGradeCode",
        "",
        "fn_loadCodeCallback",
        false   // async=false: 이 transaction이 완료될 때까지 블로킹
    );
    // 동기 트랜잭션이므로 여기는 fn_loadCodeCallback 완료 후 실행됨
}

function fn_loadCodeCallback(svcid, errorCode, errorMsg) {
    if (errorCode != 0) {
        this.alert("공통 코드 로드 실패");
        return;
    }
    // 코드 Dataset 준비 완료 — 이후 비동기 조회 실행
    fn_search();
}
```

**주의:** 동기 트랜잭션(`async=false`)은 UI를 블로킹하므로 초기화처럼 꼭 필요한 경우에만 사용하고, 가능하면 콜백 체인으로 대체하는 것이 좋습니다.

---

## 트랜잭션 취소

진행 중인 트랜잭션을 취소하려면 `cancelTransaction(svcid)`를 사용합니다.

```javascript
// 로딩 인디케이터와 함께 트랜잭션 취소 구현
function btn_search_onclick(obj, e) {
    // 이전 조회가 진행 중이면 취소
    this.cancelTransaction("svcSearch");

    this.divLoading.set_visible(true);

    this.transaction(
        "svcSearch",
        "USER/search.do",
        "in:dsParam",
        "out:dsResult",
        "",
        "fn_searchCallback"
    );
}

function fn_searchCallback(svcid, errorCode, errorMsg) {
    this.divLoading.set_visible(false);

    // errorCode == -1: 사용자 취소 또는 타임아웃
    if (errorCode == -1) {
        trace("트랜잭션 취소 또는 타임아웃: " + svcid);
        return;
    }
    if (errorCode != 0) {
        this.alert("오류: " + errorMsg);
        return;
    }
    // 정상 처리
    this.dsResult.set_rowposition(0);
}

// 취소 버튼
function btn_cancel_onclick(obj, e) {
    this.cancelTransaction("svcSearch");
    this.divLoading.set_visible(false);
}
```

---

## 타임아웃 설정

기본 타임아웃은 애플리케이션 설정에 따르지만, 개별 트랜잭션에 직접 지정할 수도 있습니다.

```javascript
// 타임아웃 30초 설정 (단위: ms)
this.transaction(
    "svcHeavyReport",
    "REPORT/generate.do",
    "in:dsReportParam",
    "out:dsReportData",
    "",
    "fn_reportCallback",
    true,   // async
    30000   // timeout: 30초
);
```

---

## 다중 트랜잭션 순차 실행 — 콜백 체인

여러 서비스를 순서대로 호출해야 할 때는 콜백 체인을 사용합니다.

```javascript
// 초기화 순서: 공통코드 → 사용자 정보 → 목록 조회
function Form_onload(obj, e) {
    fn_loadCommonCode();
}

function fn_loadCommonCode() {
    this.transaction(
        "svcCode",
        "COMMON/getCode.do",
        "",
        "out:dsDeptCode out:dsGradeCode",
        "",
        "fn_loadCommonCodeCallback"
    );
}

function fn_loadCommonCodeCallback(svcid, errorCode, errorMsg) {
    if (errorCode != 0) { this.alert("코드 로드 실패"); return; }
    // 코드 로드 완료 → 사용자 정보 로드
    fn_loadUserInfo();
}

function fn_loadUserInfo() {
    this.transaction(
        "svcUserInfo",
        "USER/getMyInfo.do",
        "",
        "out:dsMyInfo",
        "",
        "fn_loadUserInfoCallback"
    );
}

function fn_loadUserInfoCallback(svcid, errorCode, errorMsg) {
    if (errorCode != 0) { this.alert("사용자 정보 로드 실패"); return; }
    // 사용자 정보 로드 완료 → 목록 조회
    fn_search();
}
```

---

## 오류 코드 체계

콜백 함수에서 받는 `errorCode` 값의 의미를 정확히 알아야 합니다.

| errorCode | 의미 | 처리 방법 |
|---|---|---|
| `0` | 정상 완료 | outDatasets 사용 가능 |
| `-1` | 취소 / 타임아웃 | 사용자 안내 또는 무시 |
| `< -1` | 통신 레벨 오류 (네트워크 등) | 재시도 또는 오류 메시지 |
| `> 0` | 서버 비즈니스 오류 | `errorMsg` 내용 표시 |

```javascript
function fn_callback(svcid, errorCode, errorMsg) {
    if (errorCode == 0) {
        // 정상 처리
        return;
    }

    if (errorCode == -1) {
        // 취소/타임아웃 — 로딩 인디케이터만 숨기고 종료
        this.divLoading.set_visible(false);
        return;
    }

    if (errorCode < 0) {
        // 통신 오류 — 네트워크 상태 확인 안내
        this.alert("서버 통신 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.\n[" + errorCode + "] " + errorMsg);
        return;
    }

    // errorCode > 0: 서버 비즈니스 오류
    this.alert(errorMsg); // 서버에서 setError로 설정한 메시지 표시
}
```

---

## 실전 팁

**1. URL은 application.xml의 baseurl 기준 상대 경로로 관리**

하드코딩 대신 `gv_svcUrl` 같은 전역 상수나 application.xml의 baseurl 설정을 활용하면 환경(개발/운영) 전환이 쉽습니다.

```javascript
// 전역 공통 함수로 URL 조합
function fn_transaction(svcid, svcNm, inDs, outDs, args, callbackFn) {
    var sUrl = gv_baseUrl + svcNm; // gv_baseUrl은 폼 로드 시 전역 설정
    this.transaction(svcid, sUrl, inDs, outDs, args, callbackFn);
}
```

**2. 콜백 함수에서 `this` 컨텍스트 확인**

콜백은 트랜잭션을 발생시킨 Form의 컨텍스트에서 실행되므로 `this`는 해당 Form 객체를 가리킵니다.

**3. 대용량 Dataset 전송 시 분할 처리 고려**

수천 건 이상의 Dataset을 한 번에 전송하면 직렬화 비용이 커집니다. 페이지네이션 파라미터(`args`)와 서버 페이징을 함께 사용하는 것을 권장합니다.

---

## 정리

`transaction()`은 Nexacro N 서버 통신의 유일한 공식 통로입니다. Dataset 직렬화·역직렬화를 자동으로 처리해 주기 때문에 개발자는 데이터 흐름 자체에만 집중할 수 있습니다. 핵심은 세 가지입니다.

- **svcid**로 콜백 분기 관리
- **inDatasets / outDatasets** 매핑으로 Dataset 자동 교환
- **errorCode** 체계를 정확히 이해한 오류 처리

다음 글에서는 조회·저장·삭제를 하나의 화면에서 완성하는 **CRUD 패턴**을 실전 예시와 함께 다룹니다.

---

**지난 글:** [[Nexacro N] 데이터바인딩 — Dataset과 컴포넌트를 연결하는 핵심 메커니즘](/posts/nexacro-n-databinding/)

**다음 글:** [[Nexacro N] CRUD 패턴 — 조회·신규·수정·삭제·저장 완전 정리](/posts/nexacro-n-crud-pattern/)

<br>
읽어주셔서 감사합니다. 😊
