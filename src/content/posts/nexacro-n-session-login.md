---
title: "[Nexacro N] 세션과 로그인"
description: "Nexacro N 애플리케이션에서 로그인 화면 구현, 세션 기반 인증 흐름, 사용자 정보 전역 저장 패턴을 설명합니다. transaction 콜백에서 인증 결과를 처리하고 application 변수로 세션 정보를 전파하는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 5
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "로그인", "세션", "인증", "transaction", "application변수"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-dashboard/)에서 대시보드를 구성하는 방법을 살펴보았다. 이번에는 모든 업무 시스템의 시작점인 로그인 화면과 세션 기반 인증 흐름을 다룬다. Nexacro N 자체는 인증 로직을 제공하지 않으므로, 서버의 세션 관리와 클라이언트의 상태 저장을 직접 설계해야 한다.

## 로그인 흐름 전체

Nexacro 클라이언트는 ID/PW를 Dataset에 담아 로그인 서비스로 트랜잭션을 보낸다. 서버는 자격 증명을 검증하고, 성공 시 HttpSession에 사용자 정보를 저장하고 사용자 정보 Dataset을 응답으로 내려준다. 클라이언트는 이 정보를 `application` 전역 변수에 보관하고 메인 화면으로 이동한다.

![Nexacro N 로그인 흐름](/assets/posts/nexacro-n-session-login-flow.svg)

## 로그인 폼 구성

로그인 폼에는 `Edit` 두 개(아이디, 비밀번호)와 로그인 버튼이 있으며, 비밀번호 `Edit`은 `type=password`로 설정한다. `Dataset`(ds_login)에는 `USER_ID`, `PASSWORD` 컬럼을 정의한다.

```nexacro
// 비밀번호 Edit 설정
edt_pw.set_type("password");
edt_pw.set_maxlength(20);

// Enter 키 로그인 처리
function edt_pw_onkeyup(obj, e) {
    if (e.keycode === 13) {  // Enter
        btn_login_onclick(null, null);
    }
}
```

## 로그인 트랜잭션

입력값 검증 후 트랜잭션을 발행한다. 비밀번호는 서버에서 암호화해 비교하므로 클라이언트에서는 평문을 그대로 전송하되, TLS 통신이 전제되어야 한다.

![로그인 트랜잭션 콜백 패턴](/assets/posts/nexacro-n-session-login-code.svg)

```nexacro
function fn_loginCallback(sId, nErrorCode, sErrorMsg) {
    if (nErrorCode < 0) {
        alert("로그인에 실패했습니다: " + sErrorMsg);
        edt_pw.setFocus();
        return;
    }

    if (ds_userInfo.rowcount === 0) {
        alert("아이디 또는 비밀번호가 올바르지 않습니다.");
        edt_pw.setFocus();
        return;
    }

    // 사용자 정보를 application 전역 변수에 저장
    application.gv_userId   = ds_userInfo.getColumn(0, "USER_ID");
    application.gv_userName = ds_userInfo.getColumn(0, "USER_NM");
    application.gv_roleCode = ds_userInfo.getColumn(0, "ROLE_CD");

    // 메인 화면으로 이동
    application.mainframe.changeForm("FrmMain::main/FrmMain.xfdl");
}
```

`nErrorCode < 0`는 네트워크 오류나 서버 500 에러다. `rowcount === 0`은 서버가 정상 응답했지만 인증에 실패한 경우다. 두 경우를 구분해 메시지를 다르게 보여주면 사용자가 원인을 파악하는 데 도움이 된다.

## application 전역 변수 활용

`application` 객체에 세팅한 변수는 모든 폼에서 접근할 수 있다. 사용자 ID, 이름, 권한 코드를 여기에 저장해두면 화면마다 다시 조회할 필요가 없다.

```nexacro
// 어느 폼에서든 접근 가능
var userName = application.gv_userName;
var role = application.gv_roleCode;

// 권한별 버튼 노출 제어
if (role !== "ADMIN") {
    btn_delete.set_visible(false);
}
```

`application` 변수는 세션과 동일한 생명주기를 가진다. 브라우저 새로고침 시 초기화되므로, 새로고침 후 로그인 상태를 복원하려면 쿠키나 서버 세션 확인 로직이 필요하다.

## 서버 세션 확인 (재접속 처리)

애플리케이션이 시작될 때 서버에 세션 유효성을 확인하는 패턴을 사용하면, 이미 로그인된 사용자는 로그인 화면을 건너뛰고 메인으로 바로 진입할 수 있다.

```nexacro
// application.xadl 또는 초기 폼 onload에서
function fn_checkSession() {
    this.transaction(
        "svcCheckSession",
        "/api/session/check",
        "",
        "out:ds_sessionUser=USERINFO",
        "",
        "fn_checkSessionCallback"
    );
}

function fn_checkSessionCallback(sId, nErrorCode, sErrorMsg) {
    if (nErrorCode >= 0 && ds_sessionUser.rowcount > 0) {
        // 세션 유효 → application 변수 복원 후 메인으로
        application.gv_userId = ds_sessionUser.getColumn(0, "USER_ID");
        application.mainframe.changeForm("FrmMain::main/FrmMain.xfdl");
    } else {
        // 세션 없음 → 로그인 화면 표시
        application.mainframe.changeForm("FrmLogin::login/FrmLogin.xfdl");
    }
}
```

## 로그아웃 처리

로그아웃 시 서버 세션을 무효화하고 `application` 변수를 초기화한 뒤 로그인 화면으로 이동한다.

```nexacro
function fn_logout() {
    this.transaction(
        "svcLogout",
        "/api/logout",
        "", "", "",
        "fn_logoutCallback"
    );
}

function fn_logoutCallback(sId, nErrorCode, sErrorMsg) {
    // 에러 여부와 무관하게 클라이언트 정리
    application.gv_userId   = "";
    application.gv_userName = "";
    application.gv_roleCode = "";
    application.mainframe.changeForm("FrmLogin::login/FrmLogin.xfdl");
}
```

서버 로그아웃 요청이 실패하더라도 클라이언트는 로그인 화면으로 이동시켜야 한다. 네트워크 오류로 서버 세션이 남더라도 세션 타임아웃으로 자연 소멸된다.

---

**지난 글:** [대시보드 구성](/posts/nexacro-n-dashboard/)

**다음 글:** [세션 타임아웃 처리](/posts/nexacro-n-session-timeout/)

<br>
읽어주셔서 감사합니다. 😊
