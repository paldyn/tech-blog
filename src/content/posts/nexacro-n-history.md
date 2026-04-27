---
title: "[Nexacro N] Nexacro 14 → Platform → N · V24 진화"
description: "Nexacro 14부터 Platform, N, V24까지 각 버전이 무엇을 바꿨는지 개발자 관점에서 정리한다. 마이그레이션 포인트와 코드 변화를 함께 다룬다."
author: "PALDYN Team"
pubDate: "2026-04-27"
archiveOrder: 2
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "nexacro-platform", "migration", "v24", "tobesoft"]
featured: false
draft: false
---

이 글은 **Nexacro N 기준**으로 작성되었습니다.

투비소프트 Nexacro는 10년 넘는 시간 동안 여러 차례 큰 전환점을 거쳤다.
플러그인 기반 Nexacro 14에서 시작해 HTML5 전환기인 Nexacro Platform, 그리고 ES6+·TypeScript를 품은 Nexacro N과 V24까지 — 각 버전이 왜 등장했는지, 무엇을 바꿨는지 개발자 관점에서 정리한다.
기존 Nexacro Platform 프로젝트를 유지보수하거나 N으로 마이그레이션을 고려하는 개발자에게 특히 유용하다.

---

## 1. Nexacro 14 — 플러그인 기반 RIA의 완성 (2013)

Nexacro 14는 투비소프트가 ActiveX·NPAPI 플러그인 기반으로 만든 첫 번째 통합 엔터프라이즈 RIA 프레임워크다.

### 핵심 특성

- **런타임**: 브라우저 플러그인(ActiveX/NPAPI) 설치 필수
- **언어**: JavaScript ES3 수준, `var` 선언만 가능
- **브라우저**: Internet Explorer 위주
- **파일 포맷**: `.xfdl` (XML 기반 폼 정의 파일) — 이 포맷은 이후 버전에도 계속 사용

### Nexacro 14의 코드 특징

```javascript
// Nexacro 14 스타일 — ES3 기반, var만 사용
// 함수 내부에서 var를 반복 선언해도 오류 없음 (함수 스코프)
function fn_search() {
    var sFromDate = this.edtFromDate.value;
    var sToDate   = this.edtToDate.value;
    var sEmpName  = this.edtEmpName.value;

    // 조건 Dataset 설정
    var dsSearch = this.dsSearch;
    dsSearch.clearData();
    dsSearch.addRow();
    dsSearch.setColumn(0, "from_date", sFromDate);
    dsSearch.setColumn(0, "to_date",   sToDate);
    dsSearch.setColumn(0, "emp_name",  sEmpName);

    this.transaction(
        "searchEmployee",
        "SVC_EMP::selectList",
        "dsSearch=dsSearch:U",
        "dsEmployee=dsEmployee:A",
        "",
        "fn_searchCallback"
    );
}

function fn_searchCallback(svcId, errCode, errMsg) {
    if (errCode !== 0) {
        this.alert(errMsg);
        return;
    }
}
```

Nexacro 14는 국내 금융·공공·제조 업종을 중심으로 대규모 채택이 이루어졌고, 지금도 이 버전 기반의 레거시 시스템이 많이 운영 중이다.

### 한계

2015년 이후 Chrome이 NPAPI 플러그인을 지원 중단하고, Microsoft가 Edge에서 ActiveX를 제거하면서 Nexacro 14 기반 시스템은 브라우저 전쟁의 최전선에 서게 됐다. IE가 사라지면 시스템 자체가 작동하지 않는 구조였다.

---

## 2. Nexacro Platform — HTML5 전환 완료 (2018)

2018년 출시된 Nexacro Platform은 플러그인을 완전히 제거하고 HTML5·CSS3·Canvas를 활용한 순수 웹 런타임으로 전환했다. 이것이 현재 레거시 프로젝트 대부분이 사용하는 버전이다.

### 주요 변화

1. **플러그인 없음**: 브라우저에서 바로 실행. Chrome·Edge·Safari 지원.
2. **IE11 지원**: 레거시 환경을 위해 IE11도 지원(ES5 폴리필 포함).
3. **동일한 `.xfdl` 포맷 유지**: Nexacro 14에서 Platform으로의 마이그레이션이 비교적 쉬웠다.
4. **JavaScript ES5**: `Array.prototype.forEach`, `Object.keys` 등 ES5 메서드 사용 가능.

### Platform에서 사용 가능해진 패턴

```javascript
// Nexacro Platform — ES5 스타일
function fn_validateGrid() {
    var ds = this.dsOrder;
    var arrErrors = [];

    // ES5 forEach로 행 순회 (Nexacro 14에서는 for 루프만 가능)
    // 주의: ds 자체에 forEach는 없음 — 배열을 만들어서 사용
    var rowCount = ds.getRowCount();
    var i;
    for (i = 0; i < rowCount; i++) {
        var orderId  = ds.getColumn(i, "order_id");
        var qty      = ds.getColumn(i, "qty");
        var unitPrice = ds.getColumn(i, "unit_price");

        if (nexacro.isNull(orderId)) {
            arrErrors.push("행 " + (i + 1) + ": 주문번호 누락");
        }
        if (qty <= 0) {
            arrErrors.push("행 " + (i + 1) + ": 수량은 1 이상이어야 합니다");
        }
        if (unitPrice <= 0) {
            arrErrors.push("행 " + (i + 1) + ": 단가는 0보다 커야 합니다");
        }
    }

    if (arrErrors.length > 0) {
        this.alert(arrErrors.join("\n"));
        return false;
    }
    return true;
}
```

```javascript
// Platform에서 Object.keys를 활용한 매핑
function fn_applyCodeMap(dsTarget, codeMap) {
    // codeMap = { "01": "일반", "02": "긴급", "03": "반품" }
    var keys = Object.keys(codeMap);
    var i, row, code;

    for (row = 0; row < dsTarget.getRowCount(); row++) {
        code = dsTarget.getColumn(row, "order_type");
        for (i = 0; i < keys.length; i++) {
            if (keys[i] === code) {
                dsTarget.setColumn(row, "order_type_nm", codeMap[code]);
                break;
            }
        }
    }
}
```

### Platform의 한계

- **TypeScript 미지원**: 대형 프로젝트에서 타입 오류를 런타임에서야 발견
- **ES5 제약**: 화살표 함수, `const`/`let`, 템플릿 리터럴 사용 불가
- **IE 호환 부담**: IE11을 지원해야 해서 모던 API 사용에 제약

---

## 3. Nexacro N — 모던 JavaScript 시대 (2022)

Nexacro N은 IE 지원을 과감히 종료하고 모던 브라우저만을 타겟으로 재설계됐다.

![Nexacro 버전 진화 타임라인](/assets/posts/nexacro-n-history-version-timeline.svg)

### 핵심 변화

- **ES6+ 문법 전면 허용**: `const`, `let`, 화살표 함수, 템플릿 리터럴, 구조 분해 할당
- **IE 지원 종료**: IE11 폴리필 제거로 번들 크기·성능 개선
- **Studio N 새 IDE**: 자동완성 및 인텔리센스 강화
- **렌더링 엔진 개선**: 대량 데이터 Grid 성능 향상

### Nexacro N에서 달라진 코드 스타일

```javascript
// Nexacro N — ES6+ 스타일
function fn_search() {
    // const/let 사용 가능
    const ds     = this.dsSearch;
    const fromDt = this.edtFromDate.value;
    const toDt   = this.edtToDate.value;

    // 템플릿 리터럴
    const logMsg = `조회 요청: ${fromDt} ~ ${toDt}`;
    nexacro.trace(logMsg);

    // 유효성 검사를 화살표 함수로
    const isEmpty = (val) => nexacro.isNull(val) || val.trim() === "";

    if (isEmpty(fromDt) || isEmpty(toDt)) {
        this.alert("조회 기간을 모두 입력해주세요.");
        return;
    }

    ds.setColumn(0, "from_date", fromDt);
    ds.setColumn(0, "to_date",   toDt);

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
        this.alert(`조회 실패 [${errCode}]: ${errMsg}`);
        return;
    }

    const rowCnt = this.dsOrder.getRowCount();
    this.staticInfo.set_text(`총 ${rowCnt}건 조회됨`);
}
```

```javascript
// 구조 분해 할당과 기본값
function fn_buildSearchParam() {
    // Dataset에서 값을 꺼내 객체로 구성
    const row = 0;
    const ds  = this.dsSearch;

    const {
        fromDate = "",
        toDate   = "",
        deptCd   = "ALL"
    } = {
        fromDate: ds.getColumn(row, "from_date"),
        toDate:   ds.getColumn(row, "to_date"),
        deptCd:   ds.getColumn(row, "dept_cd")
    };

    return { fromDate, toDate, deptCd };
}
```

---

## 4. Nexacro N V24 — TypeScript 완성 (2024)

V24는 Nexacro N의 TypeScript 지원을 실용적인 수준으로 끌어올린 버전이다.

![Nexacro Platform vs Nexacro N 핵심 차이점](/assets/posts/nexacro-n-history-platform-comparison.svg)

### V24 주요 특징

#### TypeScript 타입 선언

```javascript
// V24 — TypeScript 인터페이스 활용
interface IEmployee {
    emp_id:   string;
    emp_name: string;
    dept_cd:  string;
    salary:   number;
}

// 타입이 있으면 IDE 자동완성 + 컴파일 타임 오류 검출
function fn_getEmployeeInfo(row: number): IEmployee {
    const ds = this.dsEmployee;

    return {
        emp_id:   ds.getColumn(row, "emp_id")   as string,
        emp_name: ds.getColumn(row, "emp_name") as string,
        dept_cd:  ds.getColumn(row, "dept_cd")  as string,
        salary:   ds.getColumn(row, "salary")   as number
    };
}

function fn_processEmployee(row: number): void {
    const emp = fn_getEmployeeInfo(row);

    // TypeScript 덕분에 emp.salary는 number 타입 보장
    const annualSalary = emp.salary * 12;
    const taxAmount    = annualSalary * 0.035;

    this.edtAnnualSalary.set_value(annualSalary.toString());
    this.edtTax.set_value(taxAmount.toFixed(0));
}
```

#### 제네릭 유틸리티 함수

```javascript
// V24 — 제네릭을 활용한 공통 Dataset 변환 함수
function datasetToArray<T extends Record<string, unknown>>(
    ds: Dataset,
    columns: (keyof T)[]
): T[] {
    const result: T[] = [];
    const rowCount = ds.getRowCount();

    for (let i = 0; i < rowCount; i++) {
        const row = {} as T;
        for (const col of columns) {
            row[col] = ds.getColumn(i, col as string) as T[typeof col];
        }
        result.push(row);
    }

    return result;
}

// 사용 예
function fn_exportToArray(): IEmployee[] {
    return datasetToArray<IEmployee>(
        this.dsEmployee,
        ["emp_id", "emp_name", "dept_cd", "salary"]
    );
}
```

---

## 5. 버전별 API 호환성과 마이그레이션 포인트

세 버전 모두 핵심 API(transaction, Dataset, Grid 이벤트)는 동일하게 유지된다. 주요 마이그레이션 포인트는 다음과 같다.

### Nexacro 14 → Platform

```javascript
// 변경 없음 — 대부분의 코드가 그대로 동작
// 단, 아래는 확인 필요:

// 1. window.open 대신 Nexacro 팝업 API 사용 권장
//    (14에서는 window.open이 플러그인 환경에서 허용)
// 변경 전 (Nexacro 14)
// window.open("popup.html", "_blank", "width=800,height=600");

// 변경 후 (Platform)
this.openPopup(
    "popEmployee",
    "Emp::popEmployee.xfdl",
    "modaless=false&width=800&height=600",
    "fn_popupCallback"
);

// 2. ActiveX 직접 호출 코드 제거 필요
// 변경 전 (14에서 ActiveX 직접 호출)
// var obj = new ActiveXObject("Excel.Application");
// → Platform에서는 완전히 제거, 엑셀은 exportData() 활용
```

### Platform → Nexacro N

```javascript
// 1. IE 전용 폴리필 코드 제거
// 변경 전 (Platform — IE11 대응)
var arrKeys = [];
for (var key in myObj) {
    if (myObj.hasOwnProperty(key)) {
        arrKeys.push(key);
    }
}

// 변경 후 (Nexacro N)
const arrKeys = Object.keys(myObj);

// 2. var → const/let 전환 (선택 사항이지만 권장)
// 변경 전
var rowCount = ds.getRowCount();
var result   = [];

// 변경 후
const rowCount = ds.getRowCount();
const result   = [];

// 3. 문자열 연결 → 템플릿 리터럴
// 변경 전
var msg = "조회 결과: " + rowCnt + "건 (부서: " + deptNm + ")";

// 변경 후
const msg = `조회 결과: ${rowCnt}건 (부서: ${deptNm})`;
```

### Nexacro N → V24

```javascript
// TypeScript 타입 어노테이션 추가 (선택적 점진 적용)
// 기존 코드는 그대로 동작 — TypeScript는 점진적으로 적용 가능

// 변경 전 (Nexacro N)
function fn_calcBonus(salary, rate) {
    return salary * rate;
}

// 변경 후 (V24 TypeScript)
function fn_calcBonus(salary: number, rate: number): number {
    return salary * rate;
}
```

---

## 6. 어느 버전에 있는지 확인하는 법

현재 프로젝트가 어느 버전인지는 `environment.xml` 또는 Studio N의 프로젝트 속성에서 확인할 수 있다.

```xml
<!-- environment.xml에서 버전 확인 -->
<environment>
    <!-- Nexacro N V24인 경우 -->
    <nexacro-version>nexacro_n_v24</nexacro-version>
    ...
</environment>
```

```javascript
// 스크립트에서 런타임 버전 확인
function fn_checkVersion() {
    // nexacro.version: 현재 Nexacro 런타임 버전 문자열
    const ver = nexacro.version;
    nexacro.trace("현재 버전: " + ver);

    // V24 여부 판별
    const isV24 = ver.indexOf("24") >= 0;
    if (isV24) {
        nexacro.trace("V24 기능 사용 가능");
    }
}
```

---

## 7. 마이그레이션 전략 요약

| 현재 버전 | 목표 | 예상 공수 | 핵심 작업 |
|----------|------|----------|---------|
| Nexacro 14 | Platform | 중간 | ActiveX 코드 제거, 팝업 API 변환 |
| Platform | Nexacro N | 낮음 | var→const 리팩터링 (선택), IE 코드 제거 |
| Nexacro N | V24 | 매우 낮음 | TypeScript 점진 적용 |
| Nexacro 14 | N/V24 | 높음 | 단계적 버전업 권장 |

가장 중요한 원칙은 **핵심 비즈니스 API(transaction, Dataset, Grid)는 버전에 관계없이 동일**하다는 점이다. 언어 문법과 런타임 환경이 달라질 뿐, 로직의 구조는 그대로 재사용된다.

---

## 마무리

Nexacro의 진화는 웹 표준의 역사와 맞닿아 있다. 플러그인 의존을 끊고(Platform), 모던 JS를 도입하며(N), 타입 시스템을 갖추는(V24) 여정은 레거시 엔터프라이즈 프레임워크가 웹 표준을 흡수해온 과정이기도 하다.

앞으로 이 시리즈에서는 Nexacro N 기준으로 각 기능을 깊이 다루며, 필요한 경우 Platform과의 차이점도 병행 설명한다.

**다음 글:** Nexacro N 아키텍처 개요 — 브라우저·런타임·서버 구조 심층 분석

<br>

읽어주셔서 감사합니다 😊
