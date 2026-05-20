---
title: "[Nexacro N] 시나리오 테스트와 UI 자동화"
description: "Nexacro N 프로젝트에서 시나리오 기반 테스트를 설계하고 실행하는 방법을 설명합니다. 사용자 스토리 기반 시나리오 작성, 테스트 케이스 구조화, Selenium/Playwright를 활용한 UI 자동화, 스모크 테스트 체계까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 1
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "시나리오테스트", "UI자동화", "회귀테스트", "품질보증", "테스트전략"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-script-unit-test/)에서 공통 함수 단위 테스트 전략을 살펴보았다. 단위 테스트는 개별 함수의 정확성을 보장하지만, 화면 전환·팝업·그리드 조작처럼 사용자 관점의 흐름은 커버하지 못한다. 시나리오 테스트는 "사용자가 이 화면에서 무엇을 하는가"를 중심으로 검증한다. Nexacro N 프로젝트에서 시나리오 테스트를 체계화하면 릴리스마다 반복되는 수동 확인 작업을 크게 줄일 수 있다.

## 시나리오 테스트란

시나리오 테스트는 실제 사용자 행동 순서를 재현한다. 단위 테스트가 함수 하나를 검증한다면, 시나리오 테스트는 "조회 조건 입력 → 조회 버튼 클릭 → 결과 그리드 확인 → 상세 팝업 열기 → 저장" 같은 업무 흐름 전체를 검증한다. 발견하기 어려운 화면 간 상태 불일치나 이벤트 충돌 문제를 잡아내는 데 효과적이다.

![시나리오 테스트 흐름](/assets/posts/nexacro-n-scenario-test-flow.svg)

핵심 원칙은 세 가지다. 첫째, **사용자 관점으로 작성**한다. "btnSearch를 클릭한다"가 아니라 "주문 목록을 조회한다"로 기술한다. 둘째, **재현 가능하게** 만든다. 테스트를 실행할 때마다 동일한 결과가 나와야 한다. 초기 데이터 세팅과 초기화 절차를 명확히 정의한다. 셋째, **독립적으로** 설계한다. 시나리오 A의 결과가 시나리오 B에 영향을 주지 않도록 한다.

## 시나리오 케이스 구조화

시나리오를 코드로 구조화하면 팀 간 공유와 자동화가 쉬워진다.

```javascript
// test/scenario/order-search.js
// 주문 조회 시나리오 테스트

var oScenario = {
  name: "주문 조회 - 정상 흐름",
  precondition: "테스트 주문 데이터 10건 이상 존재",
  steps: [
    {
      step: 1,
      desc: "조회 조건 입력",
      action: function() {
        edtStartDate.set_value("20260101");
        edtEndDate.set_value("20261231");
        cboStatus.set_value("ALL");
      }
    },
    {
      step: 2,
      desc: "조회 버튼 클릭 후 결과 확인",
      action: function() {
        btnSearch_onclick(btnSearch, {});
      },
      verify: function() {
        // 그리드에 데이터가 로드되었는지 확인
        return grd_list.rowcount > 0;
      }
    },
    {
      step: 3,
      desc: "첫 행 선택 및 상세 조회",
      action: function() {
        grd_list.selectRow(0);
        btnDetail_onclick(btnDetail, {});
      },
      verify: function() {
        // 팝업이 열렸는지 확인
        return this.popDetail !== null;
      }
    }
  ]
};
```

이 구조는 TestRunner Form에서 실행하거나, Playwright 같은 외부 자동화 도구의 스크립트로 변환하는 기반이 된다.

![시나리오 테스트 케이스 구조](/assets/posts/nexacro-n-scenario-test-code.svg)

## Happy Path와 Edge Case

모든 시나리오는 두 가지 경로를 반드시 포함해야 한다.

**Happy Path** (정상 흐름):
- 올바른 조건으로 조회 → 결과 표시 → 선택 → 저장 → 완료 메시지
- 이 흐름이 기본 릴리스 기준이다

**Edge Case** (예외 상황):
- 조회 결과가 없을 때 "데이터 없음" 메시지 표시
- 필수 입력값 누락 시 유효성 경고
- 서버 오류 발생 시 에러 메시지 처리
- 세션 만료 후 재로그인 처리

```javascript
// edge case: 조회 결과 없음
var oEdgeCaseNoResult = {
  name: "주문 조회 - 결과 없음",
  steps: [
    {
      step: 1,
      desc: "결과 없는 조건 입력",
      action: function() {
        edtStartDate.set_value("19000101");
        edtEndDate.set_value("19001231");
      }
    },
    {
      step: 2,
      desc: "조회 후 빈 상태 확인",
      action: function() { btnSearch_onclick(btnSearch, {}); },
      verify: function() {
        return grd_list.rowcount === 0
            && stcNoData.style.display !== "none";
      }
    }
  ]
};
```

## Selenium/Playwright로 UI 자동화

Nexacro N은 HTML5 기반이므로 Playwright나 Selenium으로 자동화할 수 있다. 다만 Nexacro 컴포넌트는 일반 HTML 요소가 아닌 Canvas/Shadow DOM 구조를 사용하므로 셀렉터 전략이 중요하다.

```javascript
// playwright/order-search.spec.js
const { test, expect } = require("@playwright/test");

test("주문 조회 시나리오", async ({ page }) => {
  await page.goto(process.env.APP_URL + "/main.html");

  // Nexacro 앱이 로드될 때까지 대기
  await page.waitForFunction(
    () => window.nexacro && window.nexacro.isReady,
    { timeout: 30000 }
  );

  // Nexacro API를 통해 컴포넌트 직접 조작
  await page.evaluate(() => {
    var oApp = nexacro.getApplication();
    var oForm = oApp.getForm("frmOrderSearch");
    oForm.edtStartDate.set_value("20260101");
    oForm.edtEndDate.set_value("20261231");
    oForm.btnSearch_onclick(null, {});
  });

  // 결과 확인: 그리드 rowcount > 0
  const rowCount = await page.evaluate(() => {
    var oForm = nexacro.getApplication().getForm("frmOrderSearch");
    return oForm.grd_list.rowcount;
  });
  expect(rowCount).toBeGreaterThan(0);
});
```

Playwright는 `evaluate()` 로 브라우저 컨텍스트 안에서 Nexacro API를 직접 호출하므로, DOM 셀렉터 의존성을 줄일 수 있다. 복잡한 그리드 조작은 `evaluate()` 블록 내에서 Nexacro 스크립트로 처리하는 것이 안정적이다.

## 스모크 테스트 체계

배포 후 즉시 실행하는 스모크 테스트는 핵심 기능만 빠르게 확인한다.

```javascript
// smoke/smoke-test.js
// 배포 후 5분 이내 실행하는 핵심 점검

var aSmokeItems = [
  { name: "앱 기동",       check: checkAppLoaded },
  { name: "로그인",        check: checkLogin },
  { name: "메뉴 로드",     check: checkMenuLoad },
  { name: "주문 조회",     check: checkOrderSearch },
  { name: "팝업 열기",     check: checkPopupOpen },
];

async function runSmoke() {
  var nPass = 0;
  for (var i = 0; i < aSmokeItems.length; i++) {
    var item = aSmokeItems[i];
    try {
      var result = await item.check();
      trace("[SMOKE] ✓ " + item.name);
      nPass++;
    } catch(e) {
      trace("[SMOKE] ✗ " + item.name + " : " + e.message);
    }
  }
  trace("[SMOKE] 결과: " + nPass + "/" + aSmokeItems.length);
}
```

스모크 테스트는 완벽한 검증이 목적이 아니라 **"배포 후 앱이 정상적으로 뜨는가"**를 5분 안에 확인하는 것이다. 실패 시 즉시 롤백을 결정할 수 있도록 판단 기준을 명확히 해 둔다.

## 시나리오 문서화

시나리오를 코드로만 관리하면 비개발자가 이해하기 어렵다. 엑셀이나 테스트 관리 도구(Jira Zephyr, TestRail)에 시나리오를 문서화하고, 코드는 그 문서를 구현한 것임을 명확히 한다.

| 시나리오 ID | 시나리오명 | 사전조건 | 예상결과 | 자동화 여부 |
|---|---|---|---|---|
| SC-001 | 주문 조회 정상 흐름 | 테스트 데이터 10건 | 그리드 결과 표시 | ✓ |
| SC-002 | 주문 조회 결과 없음 | 빈 기간 조건 | "없음" 메시지 표시 | ✓ |
| SC-003 | 필수값 누락 경고 | 기간 미입력 | 경고 팝업 표시 | ✓ |
| SC-004 | 상세 팝업 저장 | 상세 팝업 오픈 | 저장 후 그리드 갱신 | 수동 |

문서와 코드를 연결하는 간단한 방법은 시나리오 ID를 코드 주석에 포함하는 것이다. `// SC-001: 주문 조회 정상 흐름` 처럼 달아 두면 코드와 문서 간 추적이 쉬워진다.

## 정리

시나리오 테스트는 Nexacro N 프로젝트의 품질 보증 마지막 방어선이다. 단위 테스트가 함수 수준이라면, 시나리오 테스트는 사용자 경험 수준에서 검증한다. 모든 시나리오를 자동화하기는 어렵지만, Happy Path와 핵심 Edge Case만 자동화해도 릴리스 불안감이 크게 줄어든다. 시나리오를 구조화된 코드로 작성하고, 문서와 연결하며, 배포 파이프라인에 스모크 테스트를 붙이는 것부터 시작하자.

---

**지난 글:** [\[Nexacro N\] 스크립트 단위 테스트 전략](/posts/nexacro-n-script-unit-test/)

**다음 글:** [\[Nexacro N\] 회귀 테스트 도구와 자동화 전략](/posts/nexacro-n-regression-tools/)

<br>
읽어주셔서 감사합니다. 😊
