---
title: "[Nexacro N] 회귀 테스트 도구와 자동화 전략"
description: "Nexacro N 프로젝트에서 코드 변경 후 기존 기능이 깨지지 않았는지 확인하는 회귀 테스트 전략을 설명합니다. 자동화 가능한 영역과 수동 테스트 영역 구분, CI 파이프라인 연동, 스모크 테스트 자동화까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 2
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "회귀테스트", "자동화", "CI", "스모크테스트", "품질보증"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-scenario-test/)에서 사용자 관점의 시나리오 테스트를 설계하는 방법을 살펴보았다. 시나리오 테스트를 정의했다면 이제 이를 지속적으로 실행하는 체계가 필요하다. 회귀 테스트는 코드를 변경할 때마다 기존 기능이 깨지지 않았는지 확인하는 안전망이다. Nexacro N 프로젝트에서는 UI 자동화의 한계 때문에 전 범위 자동화가 어렵지만, 영역을 구분하고 우선순위를 정하면 충분히 실용적인 회귀 테스트 체계를 만들 수 있다.

## 자동화 가능 영역과 수동 영역

회귀 테스트 전략의 첫 번째 단계는 자동화할 영역과 수동으로 검증할 영역을 명확히 구분하는 것이다.

![회귀 테스트 전략 구조](/assets/posts/nexacro-n-regression-tools-strategy.svg)

**자동화 가능 영역**:
- 공통 라이브러리 함수 (순수 함수 → Node.js + Jest)
- 빌드 결과물 유효성 (파일 존재 여부, 크기 이상 여부)
- API 응답 Schema 검증 (JSON 구조 일치 여부)
- 환경 설정 파일 파싱 (TypeDef.xml 문법 오류 검출)

**수동 테스트가 필요한 영역**:
- UI 렌더링 (그리드 컬럼 표시, 스타일 적용)
- 복잡한 팝업 흐름 (팝업 내 팝업, 콜백 데이터 확인)
- 반응형 레이아웃 (해상도별 컴포넌트 배치)
- 인쇄/엑셀 내보내기 결과물

수동 테스트 항목을 **회귀 체크리스트**로 문서화하고, 릴리스마다 반드시 실행하도록 프로세스에 포함시킨다.

## 공통 함수 회귀 테스트

공통 라이브러리의 모든 함수는 단위 테스트로 커버한다. Jest를 사용하면 코드 변경 시 자동으로 회귀 여부를 확인할 수 있다.

```javascript
// test/regression/common-lib.test.js
const lib = require("../../src/common/common.js");

describe("gfn_formatDate 회귀 테스트", () => {
  // 정상 케이스
  test("8자리 날짜 포맷 변환", () => {
    expect(lib.gfn_formatDate("20260520")).toBe("2026-05-20");
  });

  // 경계값
  test("빈 문자열 처리", () => {
    expect(lib.gfn_formatDate("")).toBe("");
  });
  test("잘못된 길이 처리", () => {
    expect(lib.gfn_formatDate("202605")).toBe("");
  });

  // 구분자 옵션
  test("구분자 변경", () => {
    expect(lib.gfn_formatDate("20260520", ".")).toBe("2026.05.20");
  });
});

describe("gfn_formatAmt 회귀 테스트", () => {
  test("천 단위 구분", () => {
    expect(lib.gfn_formatAmt(1234567)).toBe("1,234,567");
  });
  test("0 처리", () => {
    expect(lib.gfn_formatAmt(0)).toBe("0");
  });
  test("음수 처리", () => {
    expect(lib.gfn_formatAmt(-5000)).toBe("-5,000");
  });
});
```

이 테스트는 `npm test`로 로컬에서도 실행되고, CI 파이프라인에서도 자동으로 돌아간다. 공통 함수를 수정했을 때 기존 동작이 깨지면 즉시 알 수 있다.

## API 응답 Schema 회귀 테스트

Nexacro Transaction이 받는 서버 응답 Schema가 바뀌면 화면이 깨진다. Schema를 코드로 정의하고 실제 응답과 비교한다.

```javascript
// test/regression/api-schema.test.js
const axios = require("axios");

const BASE = process.env.API_URL || "http://stg.example.com";

// 기대 Schema 정의
const ORDER_LIST_SCHEMA = {
  ErrorCode:    "number",
  ErrorMsg:     "string",
  ds_list:      "array",
  "ds_list[0]": {
    ORDER_ID:   "string",
    ORDER_DT:   "string",
    CUST_NM:    "string",
    AMT:        "number",
    STATUS:     "string",
  }
};

test("주문 조회 API 스키마 회귀", async () => {
  const res = await axios.post(BASE + "/order/list", {
    ds_search: [{ START_DT: "20260101", END_DT: "20261231" }]
  });

  const data = res.data;
  expect(typeof data.ErrorCode).toBe("number");
  expect(typeof data.ErrorMsg).toBe("string");
  expect(Array.isArray(data.ds_list)).toBe(true);

  if (data.ds_list.length > 0) {
    const row = data.ds_list[0];
    expect(typeof row.ORDER_ID).toBe("string");
    expect(typeof row.AMT).toBe("number");
  }
});
```

Schema 테스트는 서버팀과 클라이언트팀의 계약(Contract)을 자동으로 검증한다. 서버 응답이 바뀌었을 때 배포 전에 알 수 있다.

## 빌드 결과물 검증

빌드가 완료된 후 배포 전에 결과물을 자동으로 점검한다.

![회귀 테스트 자동화 스크립트](/assets/posts/nexacro-n-regression-tools-code.svg)

```javascript
// scripts/verify-build.js
const fs   = require("fs");
const path = require("path");

const DIST = path.resolve(__dirname, "../dist");

const REQUIRED_FILES = [
  "TypeDef.xml",
  "nexacro.js",
  "nexacro.css",
  "index.html",
];

const MAX_SIZE_MB = 20;  // 번들 최대 크기

let errors = 0;

// 필수 파일 존재 여부
REQUIRED_FILES.forEach(file => {
  const filePath = path.join(DIST, file);
  if (!fs.existsSync(filePath)) {
    console.error("✗ 파일 없음:", file);
    errors++;
  } else {
    console.log("✓", file);
  }
});

// 번들 크기 검사
const jsFiles = fs.readdirSync(DIST).filter(f => f.endsWith(".js"));
jsFiles.forEach(file => {
  const size = fs.statSync(path.join(DIST, file)).size;
  const mb   = size / 1024 / 1024;
  if (mb > MAX_SIZE_MB) {
    console.error(`✗ 번들 크기 초과: ${file} (${mb.toFixed(1)}MB)`);
    errors++;
  }
});

process.exit(errors > 0 ? 1 : 0);
```

## CI 파이프라인 통합

GitHub Actions 예시로 PR마다 회귀 테스트를 자동 실행한다.

```yaml
# .github/workflows/regression.yml
name: Regression Test

on:
  pull_request:
    branches: [main, develop]

jobs:
  regression:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Unit & regression tests
        run: npm test -- --coverage

      - name: Build
        run: npm run build

      - name: Verify build output
        run: node scripts/verify-build.js

      - name: API schema check (staging)
        run: node test/regression/api-schema.test.js
        env:
          API_URL: ${{ secrets.STAGING_API_URL }}
```

이 파이프라인이 있으면 PR을 올릴 때마다 단위 테스트, 빌드 검증, API Schema 검증이 자동으로 돌아간다. 실패한 PR은 머지할 수 없도록 branch protection rule을 설정한다.

## 수동 회귀 체크리스트

자동화 범위 밖의 항목은 릴리스 전 체크리스트로 관리한다.

```markdown
## 릴리스 회귀 체크리스트 (v{버전})

### 로그인/인증
- [ ] 일반 로그인 정상 동작
- [ ] 세션 만료 후 재로그인
- [ ] 권한 없는 메뉴 접근 차단

### 공통 기능
- [ ] 메뉴 트리 전체 항목 렌더링
- [ ] 공통 팝업 (alert, confirm, msg) 정상 표시
- [ ] 엑셀 내보내기 (그리드 데이터 정확성)
- [ ] 파일 업로드 (크기 제한, 확장자 제한)

### 핵심 업무 화면
- [ ] 주문 조회 (조건 검색, 그리드 표시)
- [ ] 주문 등록 (입력 → 저장 → 조회 반영)
- [ ] 주문 승인 (상태 변경 → 이력 기록)
```

체크리스트를 Jira나 Confluence에 템플릿으로 등록해 두면 릴리스마다 복사해서 사용할 수 있다. 항목마다 담당자와 확인 날짜를 기록하면 추적이 가능하다.

## 회귀 테스트 실패 대응

회귀 테스트가 실패했을 때 대응 순서:

1. **CI 실패 시**: PR 머지를 중단하고 원인 분석
2. **원인 파악**: 의도된 변경(스펙 변경)인지, 사이드 이펙트인지 구분
3. **의도된 변경이면**: 테스트 케이스를 새 스펙에 맞게 수정
4. **사이드 이펙트이면**: 코드를 수정하고 테스트 재실행
5. **배포 후 실패 시**: 스모크 테스트 실패 → 즉시 롤백 검토

회귀 테스트의 진짜 가치는 "실패를 발견하는 것"이 아니라 "실패를 빠르게 발견해 배포 전에 수정하는 것"이다. 파이프라인이 길어질수록 보수적으로 운영하고, 실패 알림은 즉시 팀에 전달되도록 Slack이나 이메일로 연결해 둔다.

## 정리

Nexacro N 프로젝트의 회귀 테스트는 완전 자동화가 목표가 아니다. 자동화 가능한 영역(공통 함수, API Schema, 빌드 검증)을 CI에 포함시키고, 나머지는 체크리스트로 체계화하는 것이 현실적이다. 작은 범위부터 시작해 릴리스마다 체크리스트 실패 원인을 분석하면 점진적으로 자동화 커버리지를 높일 수 있다.

---

**지난 글:** [\[Nexacro N\] 시나리오 테스트와 UI 자동화](/posts/nexacro-n-scenario-test/)

**다음 글:** [\[Nexacro N\] 빌드 옵션과 배포 설정](/posts/nexacro-n-build-options/)

<br>
읽어주셔서 감사합니다. 😊
