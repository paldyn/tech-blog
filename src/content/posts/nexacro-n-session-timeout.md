---
title: "[Nexacro N] 세션 타임아웃 처리"
description: "Nexacro N 애플리케이션에서 세션 타임아웃을 감지하고 처리하는 방법을 설명합니다. 클라이언트 setInterval로 무활동 시간을 추적하고, 경고 팝업과 강제 로그아웃 흐름을 구현하는 실무 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 6
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "세션타임아웃", "setInterval", "강제로그아웃", "보안", "UX"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-session-login/)에서 로그인 흐름과 세션 관리를 살펴보았다. 이번에는 장시간 무활동 사용자를 자동으로 로그아웃시키는 세션 타임아웃 처리를 다룬다. 이 기능은 보안 요건에 자주 등장하는데, 구현을 잘못하면 타이머가 누적되거나 경고 팝업이 반복해서 뜨는 문제가 생긴다.

## 전체 흐름

클라이언트는 마지막 활동 시각을 기록하고, 30초마다 타이머가 경과 시간을 점검한다. 설정된 임계값에 도달하면 경고 팝업을 띄우고, 추가 시간이 지나면 강제 로그아웃한다. 서버의 세션 타임아웃 값과 클라이언트 타임아웃 값을 일치시켜야 한다.

![세션 타임아웃 감지 및 처리 흐름](/assets/posts/nexacro-n-session-timeout-flow.svg)

## 활동 시각 추적

마지막 활동 시각은 사용자가 클릭, 키 입력, 트랜잭션을 발생시킬 때 갱신한다. application 레벨 이벤트 또는 공통 함수에서 처리한다.

```nexacro
var g_lastActivity = new Date();
var g_warnShown    = false;

// 모든 트랜잭션 발행 전 호출하는 공통 함수
function fn_transaction(svcId, url, input, output, args, callback) {
    g_lastActivity = new Date();
    g_warnShown    = false;
    this.transaction(svcId, url, input, output, args, callback);
}
```

사용자 클릭을 추적하려면 application의 `onmousedown` 이벤트를 이용하거나, 공통 베이스 폼에서 폼 레벨 마우스 이벤트를 처리한다.

## 타임아웃 점검 타이머

![타임아웃 타이머 구현 코드](/assets/posts/nexacro-n-session-timeout-code.svg)

```nexacro
var TIMEOUT_MS = 1800000;  // 30분
var WARN_MS    = 1680000;  // 28분 (2분 전 경고)
var g_timerId  = null;

function fn_startTimeoutTimer() {
    g_timerId = application.setInterval(
        "fn_checkTimeout()", 30000  // 30초마다 점검
    );
}

function fn_checkTimeout() {
    var elapsed = new Date() - g_lastActivity;
    if (elapsed >= TIMEOUT_MS) {
        fn_forceLogout();
        return;
    }
    if (elapsed >= WARN_MS && !g_warnShown) {
        g_warnShown = true;
        fn_showTimeoutWarning();
    }
}
```

`g_warnShown` 플래그로 경고 팝업이 한 번만 표시되도록 제어한다. 경고 후 연장을 선택하면 `g_warnShown`을 다시 `false`로 초기화한다.

## 경고 팝업과 세션 연장

```nexacro
function fn_showTimeoutWarning() {
    confirm("세션이 2분 후 만료됩니다. 연장하시겠습니까?",
        "fn_timeoutWarningCallback"
    );
}

function fn_timeoutWarningCallback(result) {
    if (result === "ok") {
        // 서버 세션 연장 요청
        this.transaction(
            "svcExtend",
            "/api/session/extend",
            "", "", "",
            "fn_extendCallback"
        );
    } else {
        fn_forceLogout();
    }
}

function fn_extendCallback(sId, nErrorCode, sErrorMsg) {
    if (nErrorCode >= 0) {
        g_lastActivity = new Date();
        g_warnShown    = false;
    } else {
        fn_forceLogout();
    }
}
```

서버 세션 연장 API(`/api/session/extend`)는 현재 세션이 유효하면 `session.setMaxInactiveInterval()`을 재설정하고 응답을 내려주면 된다.

## 강제 로그아웃

```nexacro
function fn_forceLogout() {
    if (g_timerId != null) {
        application.clearInterval(g_timerId);
        g_timerId = null;
    }
    alert("세션이 만료되었습니다. 다시 로그인해 주세요.");
    application.gv_userId   = "";
    application.gv_userName = "";
    application.gv_roleCode = "";
    application.mainframe.changeForm("FrmLogin::login/FrmLogin.xfdl");
}
```

강제 로그아웃 시 서버에 로그아웃 요청을 보내는 것도 좋지만, 네트워크 오류로 요청이 실패해도 클라이언트는 반드시 로그인 화면으로 이동시켜야 한다.

## 서버 타임아웃과 동기화

Spring Boot 기준으로 서버 세션 타임아웃 설정:

```properties
# application.properties
server.servlet.session.timeout=30m
```

클라이언트의 `TIMEOUT_MS`(30분)와 서버 세션 타임아웃(30분)을 일치시키지 않으면, 클라이언트가 아직 유효하다고 판단하는 동안 서버 세션이 먼저 만료되거나 그 반대 상황이 발생한다. 클라이언트 타임아웃을 서버보다 약간 짧게 설정하는 것이 안전하다.

## 다중 탭 환경 주의

같은 사용자가 여러 탭을 열면 각 탭이 독립적인 타이머를 가진다. 한 탭에서 활동해도 다른 탭의 타이머는 갱신되지 않는다. 이를 해결하려면 `localStorage` 이벤트를 이용해 탭 간 활동 시각을 공유해야 한다. 다만 Nexacro N의 WebBrowser 환경에서 `localStorage` 접근이 제한될 수 있으므로, 프로젝트 환경을 먼저 확인한다.

---

**지난 글:** [세션과 로그인](/posts/nexacro-n-session-login/)

**다음 글:** [권한 체크](/posts/nexacro-n-permission-check/)

<br>
읽어주셔서 감사합니다. 😊
