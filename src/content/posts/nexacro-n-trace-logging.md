---
title: "[Nexacro N] trace() 로깅 활용 가이드"
description: "Nexacro N의 trace() 함수를 체계적으로 활용하는 방법을 설명합니다. 로그 레벨 관리, 공통 로깅 함수 설계, 환경별 출력 제어, 운영 환경 로그 비활성화 패턴을 실무 코드와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 6
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "trace", "로깅", "디버깅", "로그레벨", "개발환경"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-form-reuse/)에서 폼 재사용 전략을 살펴보았다. 이번 글에서는 Nexacro N 개발의 필수 도구인 `trace()` 함수를 중심으로 로깅 전략을 정리한다. 많은 프로젝트에서 `trace()`를 ad-hoc으로 추가하고, 운영 배포 직전에 수작업으로 제거한다. 이 방식은 로그 제거를 빠뜨리기 쉽고, 다음 디버깅 때 또 추가해야 하는 반복이 생긴다. 처음부터 레벨 기반 로깅 구조를 갖추면 이 낭비를 없앨 수 있다.

## trace() 기본 동작

Nexacro N의 `trace()`는 Studio의 출력 창(Output Window) 또는 브라우저 콘솔에 문자열을 출력하는 함수다. 인자로 어떤 타입의 값이든 전달할 수 있으며, 자동으로 문자열로 변환된다.

```javascript
trace("조회 시작");                          // 단순 문자열
trace("rowcount: " + dsList.rowcount);      // 변수 포함
trace("Dataset: " + dsList.saveXML());      // XML 덤프

// 객체, 배열은 + 로 연결 시 [object Object]로 나오므로
// JSON.stringify 활용
trace("args: " + JSON.stringify(oArgs));
```

`trace()`는 개발 환경에서만 의미 있다. 운영 환경에서는 출력창도 없고, 콘솔 출력이 성능에 미미하지만 쌓이면 무의미한 부하가 된다.

## 로그 레벨 기반 관리

`trace()`를 직접 호출하는 대신, 레벨 기반 래퍼 함수를 공통 라이브러리에 만든다.

![trace() 로그 레벨 관리 전략](/assets/posts/nexacro-n-trace-logging-levels.svg)

레벨 정의:
- **ERROR (1)**: 예외 상황, 즉시 대응 필요. 운영 포함 모든 환경에서 출력
- **WARN (2)**: 비정상이나 복구 가능한 상황. QA + 개발에서 출력
- **INFO (3)**: 중요 비즈니스 이벤트. 개발 + QA에서 출력
- **DEBUG (4)**: 상세 변수 값, 루프 상태. 개발 환경에서만 출력

![공통 로깅 함수 구현](/assets/posts/nexacro-n-trace-logging-code.svg)

```javascript
// common.xfdl 또는 application 스크립트에 위치
// 0: 로그 없음, 1: ERROR, 2: WARN, 3: INFO, 4: DEBUG
var LOG_LEVEL = 4; // 개발: 4, QA: 3, 운영: 1

function gfn_error(sMsg) {
    if (LOG_LEVEL >= 1) trace("[ERROR] " + sMsg);
}

function gfn_warn(sMsg) {
    if (LOG_LEVEL >= 2) trace("[WARN]  " + sMsg);
}

function gfn_info(sMsg) {
    if (LOG_LEVEL >= 3) trace("[INFO]  " + sMsg);
}

function gfn_debug(sMsg) {
    if (LOG_LEVEL >= 4) trace("[DEBUG] " + sMsg);
}
```

운영 환경 배포 시 `LOG_LEVEL = 1`로 바꾸면 `gfn_warn`, `gfn_info`, `gfn_debug` 호출이 모두 무시된다. 로그 코드를 제거할 필요가 없다.

## 환경별 LOG_LEVEL 자동 설정

서버에서 환경 정보를 내려받아 LOG_LEVEL을 설정하면 배포 시 수작업이 줄어든다.

```javascript
// Application 초기화 시 서버에서 환경 정보 조회
function application_onload(obj, e) {
    this.transaction("ENV_INFO", "/api/env", "", "dsEnv=dsEnv:G", "", "cbEnvInfo");
}

function cbEnvInfo(sId, nErrorCode, sErrorMsg) {
    if (nErrorCode != 0) return;
    var sEnv = this.dsEnv.getColumn(0, "ENV");
    if (sEnv === "PROD") {
        LOG_LEVEL = 1;
    } else if (sEnv === "QA") {
        LOG_LEVEL = 3;
    } else {
        LOG_LEVEL = 4; // DEV
    }
    gfn_info("환경: " + sEnv + " / LOG_LEVEL: " + LOG_LEVEL);
}
```

## 실용적인 로그 패턴

**Transaction 경계 로그**: 요청 시작과 완료를 기록하면 네트워크 지연을 측정할 수 있다.

```javascript
function fnSearch() {
    gfn_debug("fnSearch() 시작 - 조건: " + this.edtKeyword.value);
    var nStart = (new Date()).getTime();
    this._nSearchStart = nStart;
    this.transaction("LIST", svcUrl, args, output, "", "cbSearch");
}

function cbSearch(sId, nErrorCode, sErrorMsg) {
    var nElapsed = (new Date()).getTime() - this._nSearchStart;
    if (nErrorCode != 0) {
        gfn_error("LIST 조회 실패 [" + nElapsed + "ms]: " + sErrorMsg);
        return;
    }
    gfn_info("LIST 조회 완료 [" + nElapsed + "ms] / " + this.dsList.rowcount + "건");
}
```

**Dataset 상태 로그**: 저장 전 Dataset 상태를 출력하면 데이터 흐름 문제를 빠르게 찾는다.

```javascript
function fnSave() {
    gfn_debug("저장 전 dsList 상태:");
    gfn_debug("  - rowcount: " + this.dsList.rowcount);
    gfn_debug("  - changedcount: " + this.dsList.getDataQS("U").length);
    gfn_debug("  - addedcount: " + this.dsList.getDataQS("I").length);
    gfn_debug("  - deletedcount: " + this.dsList.getDataQS("D").length);
    this.transaction("SAVE", svcUrl, args, output, "", "cbSave");
}
```

**이벤트 흐름 로그**: 이벤트가 예상대로 발생하는지 추적한다.

```javascript
function form_onload(obj, e) {
    gfn_debug("[LIFECYCLE] form_onload: " + this.id);
}

function form_onshow(obj, e) {
    gfn_debug("[LIFECYCLE] form_onshow: " + this.id);
}

function form_onunload(obj, e) {
    gfn_debug("[LIFECYCLE] form_onunload: " + this.id);
}
```

## Dataset XML 덤프

Dataset 내용 전체를 확인하고 싶을 때 `saveXML()`로 XML을 출력한다.

```javascript
function fnDumpDataset(ds) {
    gfn_debug("=== Dataset Dump: " + ds.id + " ===");
    gfn_debug(ds.saveXML());
    gfn_debug("=================================");
}

// 사용
fnDumpDataset(this.dsList);
```

출력된 XML에서 컬럼값, 행 상태(status), 저장된 값(orgvalue)을 모두 확인할 수 있다. 단, 대용량 Dataset에 사용하면 출력 창이 폭발하므로 행 범위를 제한한다.

```javascript
function fnDumpRows(ds, nFrom, nTo) {
    for (var i = nFrom; i <= Math.min(nTo, ds.rowcount - 1); i++) {
        var sLine = "row[" + i + "]: ";
        for (var j = 0; j < ds.colcount; j++) {
            sLine += ds.getColID(j) + "=" + ds.getColumn(i, j) + " ";
        }
        gfn_debug(sLine);
    }
}
```

## trace() 출력 창 활용

Studio의 Output Window(출력 창)는 F5로 열 수 있다. 여기에 `trace()` 출력이 표시된다. 출력 창에서 오른쪽 클릭하면 Clear, Copy 기능을 사용할 수 있다. 긴 로그를 파일로 저장하려면 전체 선택(Ctrl+A) 후 복사해 텍스트 에디터에 붙여넣는다.

브라우저에서 실행 중이라면 F12 개발자 도구의 Console 탭에서도 `trace()` 출력을 확인할 수 있다.

## 로그 태그 규칙

로그 메시지에 일관된 태그를 붙이면 검색과 필터링이 쉬워진다.

```javascript
// [화면ID:함수명] 형식 권장
function fnSearch() {
    gfn_debug("[UserList:fnSearch] keyword=" + this.edtKeyword.value);
}

function cbSearch(sId, nErrorCode, sErrorMsg) {
    if (nErrorCode != 0) {
        gfn_error("[UserList:cbSearch] err=" + nErrorCode + " msg=" + sErrorMsg);
        return;
    }
    gfn_info("[UserList:cbSearch] rows=" + this.dsList.rowcount);
}
```

출력 창에서 "UserList"로 검색하면 해당 화면의 로그만 필터링할 수 있다.

## 정리

`trace()`를 ad-hoc으로 추가하고 제거하는 방식은 개발 효율을 낮춘다. 레벨 기반 래퍼 함수(`gfn_error`, `gfn_warn`, `gfn_info`, `gfn_debug`)를 공통 라이브러리에 구현하고, `LOG_LEVEL` 변수 하나로 환경별 출력을 제어하면 로그 코드를 삭제하지 않아도 운영 배포가 가능하다. Transaction 경계, Dataset 상태, 이벤트 흐름에 로그를 남기면 문제 발생 시 원인을 빠르게 좁힐 수 있다.

---

**지난 글:** [\[Nexacro N\] 폼 재사용 전략과 공통 컴포넌트](/posts/nexacro-n-form-reuse/)

**다음 글:** [\[Nexacro N\] 네트워크 트레이스 분석](/posts/nexacro-n-network-trace/)

<br>
읽어주셔서 감사합니다. 😊
