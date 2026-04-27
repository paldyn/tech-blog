---
title: "[Nexacro N] Nexacro란 무엇인가 (RIA 시대부터 N까지)"
description: "투비소프트 Nexacro N의 본질을 이해한다. Flash 시대 RIA부터 HTML5 기반 엔터프라이즈 UI 프레임워크로의 진화, 그리고 Nexacro N이 선택받는 이유를 정리한다."
author: "PALDYN Team"
pubDate: "2026-04-27"
archiveOrder: 1
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "ria", "enterprise-ui", "tobesoft"]
featured: false
draft: false
---

이 글은 **Nexacro N 기준**으로 작성되었습니다.

Nexacro를 처음 접하는 개발자라면 "이게 React나 Vue와 뭐가 다른가?" 라는 의문이 먼저 들 것이다.
답을 한 문장으로 내리면: **Nexacro는 대규모 엔터프라이즈 업무 화면을 위해 설계된, Grid·Dataset·Transaction이 내장된 완성형 RIA 프레임워크**다.
이 글에서는 Nexacro가 왜 탄생했고, 어떤 문제를 해결하며, 내부 구조가 어떻게 생겼는지 차근차근 살펴본다.

---

## 1. RIA란 무엇인가 — Nexacro가 태어난 맥락

2000년대 초반 웹은 단순한 문서 열람 수준이었다. 기업 업무 화면(ERP, 물류, 금융)은 데이터 테이블, 검색 조건, 대량 입력 폼으로 가득 찬 복잡한 화면을 필요로 했는데, 당시 HTML/JavaScript로는 구현이 사실상 불가능했다.

이 공백을 채운 것이 **RIA(Rich Internet Application)** 기술이었다.

- **Adobe Flash / Flex**: 브라우저 플러그인으로 독립적인 UI 런타임을 실행. 화려한 애니메이션과 풍부한 컴포넌트를 제공했지만, 플러그인 설치 의무, 보안 취약점, 업데이트 부담이 따랐다.
- **Microsoft Silverlight**: Flash의 대항마로 등장. .NET 기반 개발 경험을 웹으로 확장했으나 크로스 플랫폼 지원이 약했다.
- **ActiveX**: 국내 금융·공공 분야에서 오랫동안 사용. IE 전용이라는 심각한 제약이 있었다.

![RIA 기술의 진화와 Nexacro N의 탄생](/assets/posts/nexacro-n-what-is-nexacro-ria-evolution.svg)

2012년 HTML5가 정식 표준으로 자리잡고, 2013년 Adobe가 Flash 개발 종료를 예고하면서 RIA 시장은 급변했다. 플러그인 없이도 브라우저 자체에서 복잡한 UI를 구현할 수 있는 시대가 열린 것이다.

투비소프트(Tobesoft)는 이 전환점에서 기존 ActiveX 기반 제품을 HTML5로 전환하며 **Nexacro 14**를 출시(2013년)했고, 이후 **Nexacro Platform → Nexacro N → V24**로 발전해왔다.

---

## 2. Nexacro N이 일반 웹 프레임워크와 다른 이유

React, Vue, Angular는 '범용 웹 프레임워크'다. 이들은 어떤 종류의 웹 앱이든 만들 수 있지만, 엔터프라이즈 업무 화면에 필요한 기능(Grid, Dataset, 서버 통신 프로토콜 등)은 직접 구현해야 한다.

Nexacro N은 다르다. 엔터프라이즈 업무 화면에서 **매번 반복되는 패턴을 프레임워크 레벨에서 이미 제공**한다.

| 기능 | React/Vue | Nexacro N |
|------|-----------|-----------|
| 데이터 그리드 | 별도 라이브러리 필요 | Grid 컴포넌트 내장 |
| 데이터 모델 | Redux/Pinia 등 별도 | Dataset 내장 (Row/Column/RowStatus) |
| 서버 통신 | fetch/axios 별도 구현 | transaction() 함수 내장 |
| Form 유효성 | 직접 구현 | MaskEdit·형식 체크 내장 |
| 엑셀 내보내기 | 라이브러리 조합 | exportData() 내장 |

이 덕분에 수십 개의 조회·등록·수정 화면이 있는 대형 업무 시스템을 **일관된 패턴으로 빠르게 개발**할 수 있다.

---

## 3. Nexacro N 아키텍처 개요

Nexacro N은 브라우저 위에서 동작하는 **5계층 구조**를 가진다.

![Nexacro N 런타임 아키텍처](/assets/posts/nexacro-n-what-is-nexacro-architecture.svg)

### 계층별 역할

**1계층 — 브라우저/사용자 영역**

Nexacro N은 순수 HTML5/JavaScript로 동작하므로 플러그인 없이 모든 모던 브라우저에서 실행된다. 별도의 Desktop Runtime을 설치하면 네이티브 앱처럼 구동할 수도 있다.

**2계층 — Nexacro N 런타임 엔진**

폼 파일(`.xfdl`)을 읽어 DOM으로 렌더링하는 **Form Engine**, 200여 개의 UI 컴포넌트를 관리하는 **Component Layer**, 개발자가 작성한 이벤트 핸들러를 실행하는 **Script Engine**으로 구성된다.

**3계층 — Dataset / DataBinding**

Nexacro의 핵심 데이터 모델이다. `Dataset`은 메모리 내 2차원 데이터 구조(열·행)로, 변경 추적(`RowStatus`), 필터, 정렬 기능을 내장한다. UI 컴포넌트와 Dataset을 바인딩하면 데이터가 바뀔 때 UI가 자동으로 갱신된다.

**4계층 — Transaction / Service**

`transaction()` 함수 하나로 Dataset을 서버에 전송하고 응답 Dataset을 받아온다. `services.xml`에 URL을 등록해두면 서비스 이름만으로 호출이 가능하다.

**5계층 — 서버 어댑터**

Java(Spring Boot), .NET, Node.js용 어댑터를 제공한다. 어댑터는 Nexacro 전용 프로토콜(PL)을 파싱해 Dataset 객체로 변환해주는 역할을 한다.

---

## 4. 핵심 개념 3가지 — Dataset, Grid, Transaction

Nexacro를 이해하는 데 가장 중요한 세 가지 개념을 간단히 살펴보자.

### Dataset — 데이터의 중심

```javascript
// Dataset 기본 사용 패턴
// 스크립트에서 직접 Dataset을 조작하는 예
function fn_manipulateData() {
    var ds = this.dsEmployee;   // XFDL에 선언된 Dataset 참조

    // 컬럼 정보 확인
    var colCount = ds.getColCount();    // 컬럼 수
    var rowCount = ds.getRowCount();    // 행 수

    // 특정 셀 값 읽기
    var empName = ds.getColumn(0, "emp_name");

    // 행 추가 후 값 쓰기
    var newRow = ds.addRow();
    ds.setColumn(newRow, "emp_name", "홍길동");
    ds.setColumn(newRow, "dept_cd", "D001");
    ds.setColumn(newRow, "salary", 3500000);

    // 변경 상태 확인 (insert=2, update=4, delete=8, normal=1)
    var status = ds.getRowType(newRow);  // 2 (DatasetRowType.INSERT)
}
```

### Grid — 테이블 UI의 핵심

```javascript
// Grid에서 현재 선택 행 데이터 가져오기
function grdEmployee_oncellclick(obj, e) {
    // e.row: 클릭된 행 인덱스
    // e.col: 클릭된 컬럼 인덱스
    var row = e.row;
    var ds = this.dsEmployee;

    var empId   = ds.getColumn(row, "emp_id");
    var empName = ds.getColumn(row, "emp_name");
    var deptCd  = ds.getColumn(row, "dept_cd");

    // 선택된 직원 정보를 Edit 컴포넌트에 반영
    this.edtEmpId.set_value(empId);
    this.edtEmpName.set_value(empName);
    this.cboDeprt.set_value(deptCd);
}
```

### Transaction — 서버 통신의 일원화

```javascript
// 조회 트랜잭션 — Nexacro의 핵심 통신 패턴
function fn_search() {
    // 검색 조건을 담은 Dataset을 서버로 전송하고
    // 응답 Dataset을 dsEmployee에 자동으로 채움
    this.transaction(
        "searchEmployee",           // 트랜잭션 ID (식별용 문자열)
        "SVC_EMPLOYEE::selectList", // services.xml에 등록된 서비스::액션
        "dsSearch=dsSearch:U",      // 송신 Dataset (조건)
        "dsEmployee=dsEmployee:A",  // 수신 Dataset (결과)
        "",                         // 추가 Arguments
        "fn_searchCallback"         // 콜백 함수명
    );
}

function fn_searchCallback(svcId, errCode, errMsg) {
    if (errCode !== 0) {
        // 오류 처리
        this.alert("조회 오류: " + errMsg);
        return;
    }

    // 성공 시 dsEmployee에 데이터가 자동으로 채워져 있음
    var rowCnt = this.dsEmployee.getRowCount();
    this.staticRowCount.set_text("조회 결과: " + rowCnt + "건");
}
```

이 세 가지 패턴만 이해해도 Nexacro 업무 화면의 70%를 읽을 수 있다.

---

## 5. Nexacro N이 적합한 프로젝트

Nexacro N은 모든 프로젝트에 최적은 아니다. 다음 조건이 맞을 때 강력한 선택지가 된다.

**적합한 경우**

- 수십~수백 개의 업무 화면이 있는 **대형 ERP/MES/금융 시스템**
- Grid 기반 데이터 조회·수정이 화면의 80% 이상을 차지하는 시스템
- 기존 Nexacro 14/Platform 프로젝트를 **유지보수·마이그레이션**하는 경우
- 개발팀이 이미 Nexacro 경험이 있는 경우

**부적합한 경우**

- 단순 콘텐츠 사이트나 B2C 서비스
- 개발자가 최신 웹 생태계(npm, 번들러)에만 익숙한 팀
- SEO가 필요한 공개 웹 서비스

---

## 6. Nexacro N의 개발 흐름 요약

실제 Nexacro N 프로젝트에서 화면 하나를 만드는 흐름은 다음과 같다.

```javascript
// 1. Form 로드 완료 시 호출되는 이벤트
function Form_onload(obj, e) {
    // 폼이 브라우저에 표시된 직후 초기화 로직 실행
    this.fn_init();
}

function fn_init() {
    // 2. 콤보박스 공통코드 로드
    this.transaction(
        "loadDeptCode",
        "SVC_COMMON::selectCode",
        "dsCodeParam=dsCodeParam:U",
        "dsDeptCode=dsDeptCode:A",
        "",
        "fn_initCallback"
    );
}

function fn_initCallback(svcId, errCode, errMsg) {
    if (errCode !== 0) return;

    // 3. 초기 조회 실행
    this.fn_search();
}

function fn_search() {
    // 4. 검색 조건 유효성 검사
    var fromDate = this.edtFromDate.value;
    var toDate   = this.edtToDate.value;

    if (nexacro.isNull(fromDate)) {
        this.alert("조회 시작일을 입력하세요.");
        this.edtFromDate.setFocus();
        return;
    }

    // 5. 조건 Dataset에 값 설정
    this.dsSearch.setColumn(0, "from_date", fromDate);
    this.dsSearch.setColumn(0, "to_date",   toDate);

    // 6. 서버 조회 호출
    this.transaction(
        "searchOrder",
        "SVC_ORDER::selectList",
        "dsSearch=dsSearch:U",
        "dsOrder=dsOrder:A",
        "",
        "fn_searchCallback"
    );
}

function fn_searchCallback(svcId, errCode, errMsg) {
    if (errCode !== 0) {
        this.alert("조회 실패: " + errMsg);
        return;
    }
    // Grid는 dsOrder에 바인딩되어 있어 자동으로 갱신됨
}
```

짧은 코드이지만 이 패턴이 Nexacro 업무 화면 개발의 **표준 골격**이다. 앞으로 이 시리즈에서 각 부분을 하나씩 깊이 파고든다.

---

## 7. Nexacro N V24의 최신 변화

V24에서는 다음과 같은 개선이 이루어졌다.

- **TypeScript 지원 강화**: `.xfdl` 스크립트에서 TypeScript 문법 사용 가능
- **ES6+ 문법 지원**: `const`, `let`, 화살표 함수, 템플릿 리터럴 사용 가능
- **모던 브라우저 최적화**: IE 지원 종료, 최신 렌더링 엔진 활용
- **Studio N 개선**: 자동완성·타입 추론 강화

이전 버전(Platform) 대비 개발 경험이 크게 향상되었으며, 특히 TypeScript 도입으로 대형 프로젝트의 유지보수성이 좋아졌다.

---

## 마무리

Nexacro N은 "웹인데 데스크톱 앱처럼 동작해야 하는" 엔터프라이즈 업무 화면의 문제를 풀기 위해 진화해온 프레임워크다. Dataset·Grid·Transaction이라는 세 축을 중심으로 일관된 개발 패턴을 제공하고, V24에서는 최신 웹 표준까지 흡수했다.

다음 글부터는 **Nexacro 14 → Platform → N · V24**의 버전 진화를 세부적으로 다루며, 각 버전에서 무엇이 바뀌었는지 마이그레이션 관점까지 정리한다.

---

**지난 글:** [[Nexacro N] 유효성 검사 — 저장 전 데이터 무결성 보장하기](/posts/nexacro-n-validation/)

**다음 글:** [[Nexacro N] Nexacro 14 → Platform → N · V24 진화](/posts/nexacro-n-history/)

<br>
읽어주셔서 감사합니다. 😊
