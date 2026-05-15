---
title: "[Nexacro N] 트랜잭션 커스텀 HTTP 헤더 추가"
description: "Nexacro N에서 transaction()에 커스텀 HTTP 헤더를 추가하는 방법, setHttpHeader() API, JWT Authorization·CSRF 토큰 전달 패턴, 서버 수신 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 10
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "transaction", "http-header", "JWT", "CSRF", "인증", "setHttpHeader"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-multi-dataset/)에서 복수 Dataset 동시 처리를 배웠습니다. 트랜잭션 시리즈의 마지막인 이번 글에서는 `transaction()` 호출 시 **커스텀 HTTP 헤더를 추가하는 방법**을 다룹니다. JWT 토큰 인증, CSRF 방어, 언어 설정 전달이 대표적인 활용 사례입니다.

## 커스텀 HTTP 헤더가 필요한 이유

Nexacro N의 `transaction()`은 내부적으로 HTTP POST 요청을 보냅니다. 기본적으로 Content-Type, Nexacro 관련 헤더가 자동으로 추가됩니다. 그러나 현대적인 API 서버는 추가 헤더를 요구하는 경우가 많습니다:

- **JWT 인증**: `Authorization: Bearer {token}`
- **CSRF 방어**: `X-CSRF-Token: {token}`
- **언어 설정**: `Accept-Language: ko`
- **세션 식별**: `X-Session-ID: {id}`

![트랜잭션 커스텀 HTTP 헤더 추가 방법](/assets/posts/nexacro-n-transaction-headers-overview.svg)

## setHttpHeader() 사용법

`nexacro.getApplication().setHttpHeader()`로 Application 레벨에서 전역 헤더를 설정합니다. 한번 설정하면 이후 모든 트랜잭션에 자동으로 포함됩니다.

```javascript
// 기본 형식
nexacro.getApplication().setHttpHeader("헤더명", "값");

// 예: CSRF 토큰 설정
nexacro.getApplication().setHttpHeader("X-CSRF-Token", this.sCsrfToken);

// 예: JWT Authorization 헤더
nexacro.getApplication().setHttpHeader("Authorization", "Bearer " + sJwtToken);

// 예: 언어 헤더
nexacro.getApplication().setHttpHeader("Accept-Language", "ko-KR");
```

## 로그인 후 JWT 헤더 설정 패턴

로그인 성공 후 JWT 토큰을 헤더에 등록하고, 이후 모든 트랜잭션에 자동으로 포함시킵니다.

```javascript
// 로그인 콜백
function fn_loginCb(svcId, errCode, errMsg) {
    if (errCode !== 0) {
        alert("[로그인 실패] " + errMsg);
        return;
    }

    // 서버가 반환한 JWT 토큰 수신
    var sToken = this.dsLoginResult.getColumn(0, "ACCESS_TOKEN");

    // 전역 헤더 등록 — 이후 모든 transaction()에 자동 포함
    gfn_setAuthHeader(sToken);

    // 메인 화면으로 이동
    nexacro.getApplication().gotoUrl("main.xfdl");
}

// 공통 라이브러리
function gfn_setAuthHeader(sToken) {
    nexacro.getApplication().setHttpHeader("Authorization", "Bearer " + sToken);
    nexacro.getApplication().setHttpHeader("X-Client-Type", "NEXACRO");
}
```

## CSRF 토큰 처리

서버에서 CSRF 토큰을 발급받고, 이후 요청에 포함시키는 패턴입니다.

```javascript
function Form_onload(obj, e) {
    // 1. CSRF 토큰 발급 요청
    this.transaction(
        "SVC_CSRF",
        "SVC_AUTH::getCsrfToken",
        "",
        "dsToken=dsToken",
        "",
        "fn_csrfCb"
    );
}

function fn_csrfCb(svcId, errCode, errMsg) {
    if (errCode !== 0) { alert(errMsg); return; }

    var sCsrfToken = this.dsToken.getColumn(0, "CSRF_TOKEN");

    // 전역 헤더에 등록
    nexacro.getApplication().setHttpHeader("X-CSRF-Token", sCsrfToken);

    trace("CSRF 토큰 등록 완료");
}
```

## 서버에서 커스텀 헤더 수신

![서버에서 커스텀 헤더 수신 및 검증](/assets/posts/nexacro-n-transaction-headers-server.svg)

서버에서는 일반 HTTP 헤더와 동일하게 `request.getHeader()`로 수신합니다.

```java
// Spring Controller에서 수신
@RequestMapping("/emp/empService.do")
public void empService(HttpServletRequest request,
                       NexacroRequest req, NexacroResponse res)
        throws Exception {

    // 커스텀 헤더 수신
    String authHeader  = request.getHeader("Authorization");
    String csrfToken   = request.getHeader("X-CSRF-Token");
    String clientType  = request.getHeader("X-Client-Type");

    // JWT 토큰 파싱
    if (authHeader != null && authHeader.startsWith("Bearer ")) {
        String token = authHeader.substring(7);
        jwtUtil.validateToken(token); // 검증
    }

    // 이하 비즈니스 로직
}
```

## 헤더 제거 방법

설정한 헤더를 제거하려면 `null` 값으로 다시 호출합니다.

```javascript
// 헤더 제거 (예: 로그아웃 시)
function gfn_clearAuthHeader() {
    nexacro.getApplication().setHttpHeader("Authorization", null);
    nexacro.getApplication().setHttpHeader("X-CSRF-Token", null);
}

function fn_logout() {
    gfn_clearAuthHeader();
    // 로그인 화면으로 이동
    nexacro.getApplication().gotoUrl("login.xfdl");
}
```

## 토큰 갱신(Refresh) 패턴

JWT 액세스 토큰이 만료되면 리프레시 토큰으로 새 토큰을 받아 헤더를 갱신합니다.

```javascript
// 트랜잭션 오류에서 401(토큰 만료) 감지
function fn_anyServiceCb(svcId, errCode, errMsg) {
    if (errCode === -401) {
        // 토큰 갱신 후 재시도
        this.fn_refreshToken(svcId);
        return;
    }
    if (errCode !== 0) { alert(errMsg); return; }
    // 성공 처리
}

function fn_refreshToken(sOriginalSvcId) {
    this.transaction(
        "SVC_REFRESH",
        "SVC_AUTH::refreshToken",
        "",
        "dsNewToken=dsToken",
        "",
        "fn_refreshCb"
    );
    this.sOriginalSvcId = sOriginalSvcId; // 재시도할 서비스 기억
}

function fn_refreshCb(svcId, errCode, errMsg) {
    if (errCode !== 0) {
        // 리프레시 실패 → 세션 만료 처리
        gfn_sessionExpired();
        return;
    }
    var sNewToken = this.dsToken.getColumn(0, "ACCESS_TOKEN");
    gfn_setAuthHeader(sNewToken); // 헤더 갱신
    // 원래 요청 재시도는 별도 구현 필요
}
```

## 주의사항

- `setHttpHeader()`는 **누적 설정**이므로 같은 헤더명으로 다시 호출하면 값이 덮어씌워집니다.
- 보안 민감한 토큰은 메모리에만 보관하고, LocalStorage·쿠키 사용 시 XSS 위험을 고려합니다.
- 개발 환경에서 브라우저 개발자 도구 Network 탭으로 헤더가 실제로 전송되는지 확인할 수 있습니다.

---

**지난 글:** [복수 Dataset 동시 처리](/posts/nexacro-n-multi-dataset/)

<br>
읽어주셔서 감사합니다. 😊
