---
title: "[Nexacro N] 스크립트 단위 테스트 전략"
description: "Nexacro N 스크립트의 비즈니스 로직을 단위 테스트하는 방법을 설명합니다. 테스트 가능한 순수 함수 분리, Test Form 패턴, assert 헬퍼 구현, Node.js를 활용한 자동화 테스트 구성을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 10
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "단위테스트", "테스트전략", "순수함수", "TestForm", "품질보증"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-runtime-debug/)에서 런타임 오류 처리 전략을 살펴보았다. 오류가 발생한 후 처리하는 것도 중요하지만, 코드 변경 후 기존 기능이 깨지지 않았는지 미리 확인하는 것이 더 중요하다. Nexacro N 프로젝트에서 단위 테스트는 낯선 영역이다. UI와 비즈니스 로직이 뒤섞여 있고, Transaction이 서버 의존성을 갖고 있어 테스트 환경을 만들기 까다롭다. 하지만 올바른 설계를 적용하면 핵심 로직만큼은 자동화 테스트가 가능하다.

## 무엇을 테스트할 수 있는가

Nexacro N 스크립트에서 단위 테스트하기 어려운 부분과 쉬운 부분이 있다. 경계를 명확히 알면 테스트 전략이 분명해진다.

![Nexacro N 스크립트 단위 테스트 구조](/assets/posts/nexacro-n-script-unit-test-structure.svg)

**테스트 가능한 영역**:
- 날짜 포맷, 금액 포맷 같은 변환 함수
- 이메일, 전화번호 등 입력 유효성 검증 함수
- Dataset 필터링·집계 계산 로직
- 비즈니스 규칙 (조건 충족 여부 판단)

**테스트하기 어려운 영역**:
- Transaction 호출 (서버 의존성)
- 컴포넌트 이벤트 핸들러 (UI 의존성)
- 팝업 열기/닫기
- 세션/권한 처리

전략은 단순하다: 테스트 가능한 영역을 공통 라이브러리 파일(순수 함수)로 최대한 분리하고, 나머지는 시나리오 테스트나 E2E 테스트로 커버한다.

## 순수 함수 분리 패턴

비즈니스 로직을 `this` (컴포넌트 참조) 없이 동작하는 순수 함수로 작성한다.

```javascript
// common.js — 순수 함수 모음 (UI 의존성 없음)

// 날짜 포맷 변환
function gfn_formatDate(sDate, sSep) {
    if (!sDate || sDate.length !== 8) return "";
    var sep = sSep || "-";
    return sDate.substr(0, 4) + sep
         + sDate.substr(4, 2) + sep
         + sDate.substr(6, 2);
}

// 금액 포맷 (천 단위 쉼표)
function gfn_formatAmt(nAmt) {
    if (isNaN(nAmt)) return "0";
    return Number(nAmt).toLocaleString();
}

// 이메일 유효성 검증
function gfn_validateEmail(sEmail) {
    if (!sEmail) return false;
    var pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(sEmail);
}

// 사업자등록번호 유효성 검증
function gfn_validateBizNo(sBizNo) {
    if (!sBizNo || sBizNo.length !== 10) return false;
    var aKeys = [1, 3, 7, 1, 3, 7, 1, 3, 5];
    var nSum = 0;
    for (var i = 0; i < 9; i++) {
        nSum += aKeys[i] * parseInt(sBizNo.charAt(i));
    }
    nSum += Math.floor((aKeys[8] * parseInt(sBizNo.charAt(8))) / 10);
    return (10 - (nSum % 10)) % 10 === parseInt(sBizNo.charAt(9));
}

// 날짜 범위 유효성 검증
function gfn_isValidDateRange(sStartDate, sEndDate) {
    if (!sStartDate || !sEndDate) return false;
    return sStartDate <= sEndDate;
}
```

이 함수들은 `this`를 사용하지 않고 입력값만 받아 결과를 반환한다. Node.js나 Nexacro Form 어디서든 호출할 수 있다.

## Test Form 패턴

Nexacro Studio에서 별도 테스트 폼(TestRunner.xfdl)을 만들어 공통 함수를 직접 검증한다.

![Test Form 기반 단위 테스트 패턴](/assets/posts/nexacro-n-script-unit-test-code.svg)

```javascript
// TestRunner.xfdl 스크립트

var nPass = 0;
var nFail = 0;

function assert(sTestName, actual, expected) {
    if (actual === expected) {
        trace("✓ PASS | " + sTestName);
        nPass++;
    } else {
        trace("✗ FAIL | " + sTestName
              + " | expected: [" + expected + "]"
              + " | actual:   [" + actual   + "]");
        nFail++;
    }
}

function assertBoolean(sTestName, actual, expected) {
    assert(sTestName, Boolean(actual), Boolean(expected));
}

function runAll() {
    nPass = 0;
    nFail = 0;
    trace("=== 단위 테스트 시작 ===");

    // gfn_formatDate 테스트
    assert("formatDate 정상",     gfn_formatDate("20260101"),       "2026-01-01");
    assert("formatDate 빈값",     gfn_formatDate(""),               "");
    assert("formatDate 길이오류", gfn_formatDate("202601"),         "");
    assert("formatDate 구분자",   gfn_formatDate("20260101", "."),  "2026.01.01");

    // gfn_formatAmt 테스트
    assert("formatAmt 기본",      gfn_formatAmt(1234567),   "1,234,567");
    assert("formatAmt 0",         gfn_formatAmt(0),         "0");
    assert("formatAmt NaN",       gfn_formatAmt("abc"),     "0");

    // gfn_validateEmail 테스트
    assertBoolean("email 정상",   gfn_validateEmail("user@example.com"),  true);
    assertBoolean("email 도메인없음", gfn_validateEmail("user@"),         false);
    assertBoolean("email 빈값",   gfn_validateEmail(""),                  false);

    // gfn_isValidDateRange 테스트
    assertBoolean("날짜범위 정상",   gfn_isValidDateRange("20260101", "20261231"),  true);
    assertBoolean("날짜범위 역순",   gfn_isValidDateRange("20261231", "20260101"),  false);
    assertBoolean("날짜범위 동일",   gfn_isValidDateRange("20260101", "20260101"),  true);

    trace("=== 결과: " + nPass + " 통과 / " + nFail + " 실패 ===");
}

function btnRunTest_onclick(obj, e) {
    runAll();
}
```

실행하면 Studio 출력 창에 각 테스트의 통과/실패 여부가 표시된다.

## Dataset 변환 함수 테스트

Dataset 관련 로직도 순수 함수로 분리하면 테스트할 수 있다.

```javascript
// 합계 계산 함수 (Dataset을 인자로 받음)
function gfn_calcSum(ds, sColId) {
    var nSum = 0;
    for (var i = 0; i < ds.rowcount; i++) {
        var val = parseFloat(ds.getColumn(i, sColId));
        if (!isNaN(val)) nSum += val;
    }
    return nSum;
}

// 테스트
function testCalcSum() {
    // Test Form의 Dataset에 데이터 입력
    var ds = this.dsTest;
    ds.clearData();
    ds.addRow(); ds.setColumn(ds.rowcount-1, "AMT", 1000);
    ds.addRow(); ds.setColumn(ds.rowcount-1, "AMT", 2000);
    ds.addRow(); ds.setColumn(ds.rowcount-1, "AMT", 3000);

    assert("calcSum 기본", gfn_calcSum(ds, "AMT"), 6000);

    ds.clearData();
    assert("calcSum 빈 Dataset", gfn_calcSum(ds, "AMT"), 0);
}
```

## Node.js로 자동화 테스트

공통 라이브러리 함수를 Node.js 환경에서도 실행할 수 있도록 작성하면 CI 파이프라인에 단위 테스트를 통합할 수 있다.

```javascript
// common.js를 Node.js 환경에서도 쓸 수 있게 수정
// (Nexacro 전용 API를 사용하지 않는 순수 함수는 수정 불필요)

// test/common.test.js (Jest)
const { gfn_formatDate, gfn_validateEmail } = require("../common.js");

test("formatDate 정상", () => {
    expect(gfn_formatDate("20260101")).toBe("2026-01-01");
});

test("formatDate 빈값", () => {
    expect(gfn_formatDate("")).toBe("");
});

test("validateEmail 정상", () => {
    expect(gfn_validateEmail("user@example.com")).toBe(true);
});

test("validateEmail 잘못된 형식", () => {
    expect(gfn_validateEmail("notanemail")).toBe(false);
});
```

```bash
# CI에서 실행
npm test
```

공통 라이브러리의 모든 함수가 Node.js 환경에서 동작하게 만들면, PR 시마다 자동으로 회귀 테스트를 실행할 수 있다.

## Mock 패턴으로 의존성 제거

Transaction이나 컴포넌트에 의존하는 로직을 테스트하고 싶다면 Mock을 주입한다.

```javascript
// 실제 함수: this.transaction 의존
function fnRealSearch() {
    this.transaction("LIST", svcUrl, args, output, "", "cbSearch");
}

// 테스트 가능한 형태: 데이터 접근을 인자로 주입
function fnProcessSearchResult(aData) {
    var nTotal = 0;
    for (var i = 0; i < aData.length; i++) {
        nTotal += aData[i].AMT || 0;
    }
    return nTotal;
}

// 테스트
function testProcessSearchResult() {
    var mockData = [{ AMT: 100 }, { AMT: 200 }, { AMT: 300 }];
    assert("processResult 합계", fnProcessSearchResult(mockData), 600);
}
```

Transaction을 직접 호출하는 코드는 테스트하기 어렵지만, 결과 처리 로직을 별도 함수로 분리하면 Mock 데이터로 테스트할 수 있다.

## 테스트 자동화 체크리스트

프로젝트에 단위 테스트를 도입할 때 확인할 사항:

1. **공통 라이브러리 분리**: 비즈니스 로직이 `common.js`에 순수 함수로 있는가
2. **TestRunner 폼 구비**: 버튼 하나로 전체 테스트를 실행할 수 있는가
3. **CI 통합 여부**: Node.js 환경에서도 실행 가능한가
4. **경계값 테스트**: 빈값, 최솟값, 최댓값, null 케이스를 커버하는가
5. **회귀 테스트**: 코드 변경 후 반드시 테스트를 실행하는 팀 문화가 있는가

## 정리

Nexacro N에서 단위 테스트는 불가능하지 않다. 핵심은 **비즈니스 로직을 UI에서 분리**하는 것이다. 순수 함수로 작성된 공통 라이브러리는 Test Form에서도, Node.js에서도 실행할 수 있다. 포맷 변환, 유효성 검증, 집계 계산 같은 로직을 테스트 커버리지 아래 두면, 공통 함수를 수정했을 때 어디가 깨지는지 즉시 알 수 있다. 처음에는 작은 범위에서 시작해 점진적으로 커버리지를 넓히는 것이 현실적인 접근이다.

---

**지난 글:** [\[Nexacro N\] 런타임 오류 디버깅 전략](/posts/nexacro-n-runtime-debug/)

**다음 글:** [\[Nexacro N\] 시나리오 테스트와 UI 자동화](/posts/nexacro-n-scenario-test/)

<br>
읽어주셔서 감사합니다. 😊
