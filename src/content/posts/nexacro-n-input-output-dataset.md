---
title: "[Nexacro N] 입력·출력 Dataset 매핑 심화"
description: "Nexacro N transaction()의 inDatasets와 outDatasets 파라미터 매핑 규칙, 복수 Dataset 연결, 서버-클라이언트 이름 매핑, 컬럼 타입 설정까지 실전 예제로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 4
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "transaction", "dataset", "inDatasets", "outDatasets", "매핑"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-service-url/)에서 서비스 URL과 TypeDefinition 관리 방법을 살펴봤습니다. 이번 글은 `transaction()`의 핵심인 **Dataset 매핑**을 깊게 파고듭니다. 입력 Dataset으로 서버에 조건을 보내고, 출력 Dataset으로 결과를 받는 과정에서 이름이 어떻게 연결되는지 정확히 이해하면 예기치 않은 데이터 전송 오류를 예방할 수 있습니다.

## Dataset 매핑 기본 구조

![입력·출력 Dataset 매핑 구조](/assets/posts/nexacro-n-input-output-dataset-mapping.svg)

매핑 문자열 형식은 다음과 같습니다:
- **inDatasets**: `"서버변수명=클라이언트Dataset"`
- **outDatasets**: `"서버Dataset이름=클라이언트Dataset"`

여러 개는 **공백**으로 연결합니다.

```javascript
this.transaction(
    "SVC_SEARCH",
    "SVC_EMP::getList",
    "dsCond=dsSearch",               // 입력: 클라이언트 dsSearch → 서버 dsCond
    "dsResult=dsMain dsPager=dsPager", // 출력: 서버 dsResult→dsMain, dsPager→dsPager
    "",
    "fn_searchCb"
);
```

## 입력 Dataset (inDatasets) 상세

### 서버와 클라이언트 이름이 달라도 됩니다

클라이언트에서 `dsSearch`라는 Dataset을 서버에 `dsCond`라는 이름으로 보낼 수 있습니다.

```javascript
// 클라이언트
"dsCond=dsSearch"  // 서버는 dsCond로 수신, 클라이언트는 dsSearch 사용
```

서버 Java:
```java
NexacroDataSet dsCond = req.getDataset("dsCond"); // "dsCond"로 받음
String deptCd = dsCond.getColumnAsString(0, "DEPT_CD");
```

### 입력 Dataset 준비 패턴

조건 Dataset은 보통 단일 행으로 준비합니다.

```javascript
function fn_search() {
    this.dsSearch.clearData();
    this.dsSearch.addRow();
    this.dsSearch.setColumn(0, "DEPT_CD", this.cboDept.value);
    this.dsSearch.setColumn(0, "SRCH_NM", this.edtName.value);
    this.dsSearch.setColumn(0, "PAGE_NO", "1");
    this.dsSearch.setColumn(0, "PAGE_SIZE", "20");

    this.transaction(
        "SVC_SRCH",
        "SVC_EMP::getList",
        "dsCond=dsSearch",
        "dsResult=dsMain dsPager=dsPager",
        "",
        "fn_searchCb"
    );
}
```

`clearData()` + `addRow()`로 기존 데이터를 지우고 새 행을 추가한 후 컬럼을 채웁니다.

### 저장 시 inDatasets — 변경 행만 전송

저장 트랜잭션에서는 Dataset 전체를 보내는 것이 일반적입니다. 서버 어댑터는 Row Status(추가/수정/삭제)를 보고 처리합니다.

```javascript
function fn_save() {
    this.transaction(
        "SVC_SAVE",
        "SVC_EMP::save",
        "dsInput=dsMain",   // dsMain 전체 (Row Status 포함)
        "",                 // outDatasets 없음
        "",
        "fn_saveCb"
    );
}
```

## 출력 Dataset (outDatasets) 상세

### 복수 출력 Dataset

목록 + 페이징 정보처럼 서버에서 여러 Dataset을 동시에 내려줄 때:

```javascript
"dsResult=dsMain dsPager=dsPager dsCode=dsCombo"
```

서버는 세 Dataset을 각각 `addDataset`으로 응답에 추가합니다:

```java
res.addDataset("dsResult", dsResult);
res.addDataset("dsPager", dsPager);
res.addDataset("dsCode", dsCode);
```

이름이 정확히 일치해야 합니다. `dsResult`를 `dsResults`로 보내면 클라이언트의 `dsMain`에 데이터가 채워지지 않습니다.

### outDatasets가 없는 경우

저장·삭제처럼 결과 데이터 없이 성공/실패만 확인하면 되는 트랜잭션은 빈 문자열로 지정합니다.

```javascript
this.transaction("SVC_DEL", "SVC_EMP::delete",
    "dsInput=dsMain", "", "", "fn_deleteCb");
//                   ↑ outDatasets 없음
```

## 코드 전체 예제

![복수 Dataset 매핑 코드 패턴](/assets/posts/nexacro-n-input-output-dataset-code.svg)

### 클라이언트 전체 조회 패턴

```javascript
function fn_search() {
    this.dsSearch.clearData();
    this.dsSearch.addRow();
    this.dsSearch.setColumn(0, "DEPT_CD", this.cboDept.value);

    this.transaction(
        "SVC_SRCH",
        "SVC_EMP::getList",
        "dsCond=dsSearch",
        "dsResult=dsMain dsPager=dsPager",
        "",
        "fn_searchCb"
    );
}

function fn_searchCb(svcId, errCode, errMsg) {
    if (errCode !== 0) {
        alert("[조회 실패] " + errMsg);
        return;
    }
    // dsMain, dsPager에 자동으로 데이터 채워짐
    var totalCount = this.dsPager.getColumn(0, "TOTAL_CNT");
    trace("조회 " + this.dsMain.rowcount + "건 / 전체 " + totalCount + "건");
}
```

## 자주 발생하는 매핑 오류

| 증상 | 원인 | 해결책 |
|------|------|--------|
| 출력 Dataset이 비어 있음 | outDatasets 이름 불일치 | 서버 addDataset 이름과 정확히 일치 확인 |
| 서버에서 Dataset을 못 찾음 | inDatasets 이름 불일치 | req.getDataset("이름") 확인 |
| 컬럼 값이 null | 컬럼명 오타 또는 서버 컬럼명 차이 | DS 컬럼명과 서버 컬럼명 대소문자 일치 |
| 복수 Dataset 중 일부만 채워짐 | 공백 구분 오타 | "ds1=ds1 ds2=ds2" 공백 확인 |

## 컬럼 타입과 데이터 일관성

Dataset 컬럼 타입이 서버 반환 데이터와 다르면 값이 잘리거나 변환 오류가 납니다.

```javascript
// Form 스크립트 또는 Dataset 편집기에서 컬럼 타입 설정
this.dsMain.addColumn("AMT", "INT", 10);      // 정수
this.dsMain.addColumn("REG_DATE", "DATE");    // 날짜
this.dsMain.addColumn("NOTE", "STRING", 500); // 문자열
```

Studio Dataset 편집기에서 컬럼을 정의해두면 스크립트에서 직접 addColumn 없이도 사용할 수 있습니다.

---

**지난 글:** [서비스 URL 설정과 TypeDefinition 관리](/posts/nexacro-n-service-url/)

**다음 글:** [transaction() args 파라미터 활용](/posts/nexacro-n-transaction-args/)

<br>
읽어주셔서 감사합니다. 😊
