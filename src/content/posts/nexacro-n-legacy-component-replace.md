---
title: "[Nexacro N] 레거시 컴포넌트 교체 전략"
description: "Nexacro N 프로젝트에서 오래된 컴포넌트와 폐기 API를 체계적으로 교체하는 전략을 설명합니다. 레거시 현황 파악, 우선순위 설정, 단계별 교체 접근법, 자동화 도구 활용, 회귀 방지 테스트까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 10
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "레거시", "컴포넌트교체", "리팩터링", "기술부채", "마이그레이션"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-migration-v24-changes/)에서 v24 버전의 주요 변경 사항을 정리했다. 버전 업그레이드가 끝났더라도 코드베이스에는 오래된 패턴과 폐기 예정 컴포넌트가 남아 있는 경우가 많다. 레거시 컴포넌트를 방치하면 다음 버전 업그레이드 때 더 큰 비용이 발생하고, 새로운 개발자가 코드를 이해하기 어렵다. 하지만 한꺼번에 전체를 교체하려 하면 위험하다. 우선순위를 정하고 단계적으로 교체하는 전략이 현실적이다.

## 레거시 컴포넌트란

Nexacro N 프로젝트에서 레거시 컴포넌트는 다음을 포함한다:

- **폐기(deprecated) API**: 공식 문서에서 폐기 예정으로 표시된 메서드
- **구버전 방식**: 새로운 API가 나왔지만 예전 방식이 여전히 사용 중
- **비표준 패턴**: 프로젝트 초기에 잘못 설계된 공통 함수 구조
- **미지원 컴포넌트**: 특정 버전에서 제거된 컴포넌트

이 중 가장 리스크가 큰 것은 폐기 API다. 다음 메이저 버전에서 제거되면 앱이 동작하지 않을 수 있다.

## 레거시 현황 파악

![레거시 컴포넌트 교체 전략](/assets/posts/nexacro-n-legacy-component-replace-strategy.svg)

교체를 시작하기 전에 무엇이 얼마나 있는지 파악한다.

```bash
# 폼 파일에서 폐기 API 검색

echo "=== setURL 사용 현황 ==="
grep -rn "\.setURL(" src/ --include="*.xfdl" | wc -l

echo "=== getFormRef 사용 현황 ==="
grep -rn "\.getFormRef(" src/ --include="*.xfdl" | wc -l

echo "=== createComponent 사용 현황 ==="
grep -rn "\.createComponent(" src/ --include="*.xfdl" | wc -l

echo "=== 구버전 이벤트 핸들러 ==="
grep -rn "XComp_oncreate" src/ --include="*.xfdl" | wc -l

# 전체 목록 파일로 저장
grep -rn "\.setURL\|\.getFormRef\|\.createComponent\|XComp_oncreate" \
  src/ --include="*.xfdl" > /tmp/legacy-report.txt

echo "상세 리포트: /tmp/legacy-report.txt"
wc -l /tmp/legacy-report.txt
```

파일 수와 위치를 파악하면 교체 작업의 규모를 산정할 수 있다.

## 우선순위 결정

모든 레거시를 동시에 교체할 수는 없다. 다음 기준으로 우선순위를 정한다.

| 우선순위 | 대상 | 이유 |
|---|---|---|
| 1순위 | 제거 예정 API | 다음 버전에서 동작 안 함 |
| 2순위 | 보안 관련 패턴 | XSS, 인증 취약점 위험 |
| 3순위 | 성능에 영향 | 대용량 처리, 메모리 누수 |
| 4순위 | 가독성/유지보수 | 신규 팀원 이해 어려움 |

1순위부터 처리하되, 2순위와 3순위는 관련 화면을 수정할 때 함께 정리한다.

## 자동화 교체 스크립트

단순 메서드명 변경은 스크립트로 일괄 처리한다.

![레거시 API 일괄 교체 스크립트](/assets/posts/nexacro-n-legacy-component-replace-code.svg)

```javascript
// scripts/replace-legacy.js
// 레거시 API 일괄 교체 (반드시 git commit 후 실행)

const fs   = require("fs");
const path = require("path");
const glob = require("glob");

const REPLACEMENTS = [
  // setURL → setServiceURL
  {
    from: /\.setURL\s*\(/g,
    to:   ".setServiceURL("
  },
  // getFormRef → getForm
  {
    from: /\.getFormRef\s*\(/g,
    to:   ".getForm("
  },
  // XComp_oncreate 이벤트명
  {
    from: /\bXComp_oncreate\b/g,
    to:   "onload"
  },
];

// 건드리지 않을 파일 패턴
const EXCLUDE = [
  "node_modules/**",
  "dist/**",
  "backup/**",
];

const files = glob.sync("**/*.xfdl", { ignore: EXCLUDE });

let changedFiles = 0;
let totalReplacements = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, "utf8");
  let fileChanged = false;

  REPLACEMENTS.forEach(({ from, to }) => {
    const matches = content.match(from);
    if (matches) {
      content = content.replace(from, to);
      totalReplacements += matches.length;
      fileChanged = true;
    }
  });

  if (fileChanged) {
    fs.writeFileSync(file, content, "utf8");
    console.log("수정:", file);
    changedFiles++;
  }
});

console.log(`\n처리 완료: ${changedFiles}개 파일, ${totalReplacements}건 교체`);
```

일괄 교체 후 반드시 `git diff`로 변경 내용을 검토하고, 의도하지 않은 변경이 없는지 확인한다.

## createComponent → addChild 수동 교체

`createComponent`는 사용법이 달라 자동 교체가 어렵다. 패턴을 이해하고 수동으로 교체한다.

```javascript
// BEFORE: createComponent 방식
function fnAddButton(sId, sText) {
  // 1. 컴포넌트 생성
  var oBtn = this.createComponent("Button", sId);
  // 2. 속성 설정
  oBtn.set_text(sText);
  oBtn.set_width(100);
  oBtn.set_height(30);
  // 3. 부모에 추가
  this.divToolbar.addChild(oBtn);
  oBtn.show();
}

// AFTER: addChild 방식
function fnAddButton(sId, sText) {
  // 생성과 추가를 함께
  var oBtn = new Button(sId, {
    text:   sText,
    width:  100,
    height: 30,
  });
  this.divToolbar.addChild(sId, oBtn);
  oBtn.show();
}
```

`createComponent`에서 동적으로 설정하던 속성들을 생성자 옵션 객체로 옮기는 것이 핵심 변화다.

## 단계별 교체 접근법

레거시가 많은 프로젝트에서 화면별 점진적 교체 전략:

```
Phase 1: 자동화 교체 (1주)
─────────────────────────────
- 스크립트로 단순 메서드명 교체
- git으로 변경 이력 관리
- 자동화 테스트 회귀 확인

Phase 2: 공통 라이브러리 정리 (2주)
─────────────────────────────
- common.js의 폐기 패턴 교체
- gfn_ 함수 시그니처 정리
- 단위 테스트 업데이트

Phase 3: 화면별 순차 교체 (8주)
─────────────────────────────
- 사용 빈도 높은 화면부터
- 수정 완료 후 스모크 테스트
- 체크리스트 관리

Phase 4: 검증 및 마무리 (2주)
─────────────────────────────
- 전체 회귀 테스트
- 남은 레거시 리포트 확인
- 다음 교체 계획 수립
```

## 회귀 방지

교체 후 기존 기능이 깨지지 않았는지 확인하는 것이 가장 중요하다.

```javascript
// TestRunner.xfdl — 교체 후 회귀 테스트

function runRegressionAfterReplace() {
  trace("=== 레거시 교체 후 회귀 테스트 ===");

  // 1. setServiceURL 동작 확인
  try {
    this.setServiceURL("SVC", gv_server_url + "/nexacro/");
    trace("✓ setServiceURL 동작 OK");
  } catch(e) {
    trace("✗ setServiceURL 실패: " + e.message);
  }

  // 2. getForm 동작 확인
  var oMain = this.getForm("frmMain");
  if (oMain) {
    trace("✓ getForm 동작 OK");
  } else {
    trace("✗ getForm 반환값 null");
  }

  // 3. addChild 동작 확인
  var oTestDiv = new Div("divTest", { width: 100, height: 50 });
  this.divWork.addChild("divTest", oTestDiv);
  oTestDiv.show();
  if (this.divWork.getChild("divTest")) {
    trace("✓ addChild 동작 OK");
    this.divWork.removeChild("divTest");
  } else {
    trace("✗ addChild 실패");
  }

  trace("=== 회귀 테스트 완료 ===");
}
```

## 기술 부채 관리

레거시 교체는 일회성 작업이 아니다. 새 코드가 추가될 때마다 레거시 패턴이 다시 생길 수 있다. 이를 막는 방법:

1. **코드 리뷰 체크리스트**: PR 리뷰 시 폐기 API 사용 확인
2. **린터 규칙**: 가능하면 폐기 API 사용 시 경고 출력
3. **팀 가이드라인 문서**: 공식 API와 권장 패턴 목록 유지
4. **정기 점검**: 분기마다 `grep`으로 레거시 현황 재확인

```bash
# 분기별 레거시 현황 점검 스크립트
# cron에 등록: 0 9 1 */3 * (분기 첫날 9시)

echo "[$(date +%Y-%m-%d)] 레거시 현황 점검" >> /var/log/nexacro-legacy.log

DEPRECATED_COUNT=$(grep -rn \
  "\.setURL\|\.getFormRef\|\.createComponent" \
  /deploy/src/ --include="*.xfdl" | wc -l)

echo "폐기 API 사용: ${DEPRECATED_COUNT}건" >> /var/log/nexacro-legacy.log

if [ "$DEPRECATED_COUNT" -gt 10 ]; then
  # 10건 초과 시 팀 슬랙 알림
  curl -X POST "$SLACK_WEBHOOK" \
    -d "{\"text\": \"⚠️ 레거시 API ${DEPRECATED_COUNT}건 발견 — 점검 필요\"}"
fi
```

## 정리

레거시 컴포넌트 교체는 한 번에 끝내는 것이 아니라 지속적으로 관리하는 활동이다. 자동화 스크립트로 단순 메서드명 변경을 처리하고, 패턴이 다른 변경은 수동으로 화면 단위로 교체한다. 교체 후 반드시 회귀 테스트를 실행하고, 분기마다 레거시 현황을 점검해 새로운 부채가 쌓이지 않도록 관리한다. 이 시리즈를 통해 다룬 배포 전략, 캐시 관리, 마이그레이션, 레거시 교체가 모두 맞물려 있을 때 Nexacro N 프로젝트는 안정적으로 성장할 수 있다.

---

**지난 글:** [\[Nexacro N\] v24 주요 변경 사항 총정리](/posts/nexacro-n-migration-v24-changes/)

<br>
읽어주셔서 감사합니다. 😊
