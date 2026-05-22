---
title: "[Nexacro N] 로깅 표준"
description: "Nexacro N 프로젝트에서 일관된 로깅 표준을 수립하는 방법을 설명합니다. 로그 레벨 정의, 공통 로거 유틸리티 설계, 운영/개발 환경별 로그 전략을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 3
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "로깅", "로그레벨", "trace", "디버깅", "공통함수", "운영"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-error-strategy/)에서 에러 처리 전략을 다루었다. 에러 처리와 함께 반드시 갖춰야 할 것이 **로깅 표준**이다. 체계적인 로그 없이는 장애가 발생했을 때 원인을 파악하기 어렵고, 개발 단계에서의 디버깅 효율도 크게 떨어진다.

## 로그 레벨 체계

Nexacro N에서는 `trace()` 함수를 이용해 로그를 출력한다. 하지만 모든 로그를 동일한 방식으로 출력하면 운영 환경에서 불필요한 로그가 넘쳐나거나, 중요한 에러 메시지를 놓치기 쉽다. 로그 레벨 체계를 도입해 이 문제를 해결한다.

![로그 레벨 체계](/assets/posts/nexacro-n-logging-standard-levels.svg)

레벨이 낮을수록 심각도가 높다. 운영 환경에서는 INFO(레벨 3) 이하만 출력하도록 설정하고, 개발 환경에서는 DEBUG(레벨 4) 또는 TRACE(레벨 5)까지 활성화한다.

## 공통 로거 유틸리티 구현

![로거 유틸리티 패턴](/assets/posts/nexacro-n-logging-standard-code.svg)

`gfn_log` 함수는 `LOG_LEVEL` 전역 변수를 기준으로, 현재 레벨보다 높은 로그는 출력하지 않는다. 이 변수 하나만 바꾸면 전체 애플리케이션의 로그 출력 수준을 조절할 수 있다.

```javascript
// TypeDefinition.xfdl의 application 스크립트 또는 공통 XJS에 선언
var LOG_LEVEL = 3; // INFO (운영: 3, 개발: 4 또는 5)

function gfn_log(level, msg) {
    if (level > LOG_LEVEL) return;

    var labels = ["", "[ERROR]", "[WARN]", "[INFO]", "[DEBUG]", "[TRACE]"];
    var timestamp = gfn_getSysDateTime(); // "2026-05-22 14:30:00"
    trace(timestamp + " " + labels[level] + " " + msg);
}

// 단축 함수
function gfn_logError(msg) { gfn_log(1, msg); }
function gfn_logWarn(msg)  { gfn_log(2, msg); }
function gfn_logInfo(msg)  { gfn_log(3, msg); }
function gfn_logDebug(msg) { gfn_log(4, msg); }
function gfn_logTrace(msg) { gfn_log(5, msg); }
```

## 어디서 로그를 남겨야 하는가

모든 곳에 로그를 남기면 로그 노이즈가 심해진다. 다음 기준으로 로그 위치를 선정한다.

**반드시 남겨야 하는 곳**
- 트랜잭션 시작/완료 (INFO): 어떤 서비스가 호출됐는지 추적
- 에러 발생 시 (ERROR): errCode, errMsg, svcId 포함
- 세션 관련 이벤트 (INFO): 로그인, 로그아웃, 세션 만료

**남기면 도움이 되는 곳**
- 중요한 분기 조건 (DEBUG): if-else 선택 이유
- Dataset rowCount 변화 (DEBUG): 조회 결과 건수
- 함수 진입/종료 (TRACE): 성능 병목 추적 시

**남기지 않아도 되는 곳**
- 단순 UI 이벤트 (클릭, 포커스 등)
- 컴포넌트 값 읽기/쓰기

```javascript
function fn_search() {
    gfn_logInfo("fn_search 시작. 검색조건=" + edt_searchCond.value);

    this.transaction(
        "search", "/api/user/search",
        "dsInput=dsSearch", "dsOut=dsResult",
        "", "fn_searchCb"
    );
}

function fn_searchCb(svcId, errCode, errMsg) {
    if (errCode != 0) {
        gfn_logError("검색 실패. svcId=" + svcId + " errCode=" + errCode);
        gfn_alert(errMsg);
        return;
    }
    gfn_logInfo("검색 완료. rowCount=" + dsResult.rowcount);
}
```

## 운영 환경 로그 전략

브라우저 콘솔에 출력되는 로그는 개발자만 볼 수 있다. 운영 환경에서는 중요한 에러 로그를 서버에 전송하는 별도 채널을 마련해야 한다.

```javascript
function gfn_sendLogToServer(level, msg) {
    if (level > 2) return; // ERROR, WARN만 서버 전송

    var dsLog = new nexacro.Dataset("dsLog", this);
    dsLog.addColumn(new nexacro.DSColumn("logLevel", "STRING", 10));
    dsLog.addColumn(new nexacro.DSColumn("logMsg",   "STRING", 2000));
    dsLog.addColumn(new nexacro.DSColumn("userId",   "STRING", 50));
    dsLog.addColumn(new nexacro.DSColumn("formId",   "STRING", 100));
    dsLog.addRow();
    dsLog.setColumn(0, "logLevel", level);
    dsLog.setColumn(0, "logMsg",   msg);
    dsLog.setColumn(0, "userId",   g_userId);
    dsLog.setColumn(0, "formId",   this.name);

    this.transaction("logSend", "/api/common/log",
        "dsInput=dsLog", "", "", "");
}
```

## 환경별 LOG_LEVEL 설정

`TypeDefinition.xfdl`의 Global Variables 또는 `application.xprj`의 환경 설정에서 LOG_LEVEL을 환경별로 다르게 설정한다.

```xml
<!-- application_dev.xml -->
<Variable id="LOG_LEVEL" value="4"/>

<!-- application_prod.xml -->
<Variable id="LOG_LEVEL" value="3"/>
```

이 값을 읽어 공통 XJS에서 초기화하면, 환경에 따라 자동으로 로그 출력 범위가 달라진다.

---

**지난 글:** [에러 전략](/posts/nexacro-n-error-strategy/)

**다음 글:** [코드 컨벤션](/posts/nexacro-n-code-conventions/)

<br>
읽어주셔서 감사합니다. 😊
