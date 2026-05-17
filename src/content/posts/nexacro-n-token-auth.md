---
title: "[Nexacro N] 토큰 인증"
description: "Nexacro N 애플리케이션에서 JWT 기반 토큰 인증을 구현하는 방법을 설명합니다. addServiceGroup으로 Authorization 헤더를 자동 첨부하고, refresh_token으로 access_token을 자동 갱신하는 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 9
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "JWT", "토큰인증", "Authorization", "refresh_token", "Bearer"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-sso-integration/)에서 SSO 연동 구조를 살펴보았다. 이번에는 JWT(JSON Web Token) 기반 토큰 인증을 Nexacro N 트랜잭션과 통합하는 방법을 다룬다. 세션 쿠키 방식이 아닌 토큰 방식은 서버리스나 마이크로서비스 환경에서 선호된다. Nexacro의 `addServiceGroup()`으로 모든 트랜잭션에 Authorization 헤더를 자동으로 첨부하는 것이 핵심이다.

## JWT 인증 전체 흐름

로그인 시 서버가 access_token(단기)과 refresh_token(장기)을 발급한다. 이후 모든 API 호출에 `Authorization: Bearer {access_token}` 헤더를 포함한다. access_token이 만료되면 refresh_token으로 재발급한다.

![JWT 토큰 인증 흐름](/assets/posts/nexacro-n-token-auth-flow.svg)

## 토큰 저장

토큰은 `application` 전역 변수(메모리)에 저장하는 것이 안전하다. `localStorage`는 XSS 공격으로 탈취될 수 있고, `sessionStorage`는 탭을 닫으면 사라진다. Nexacro 앱은 새로고침 시 다시 시작되므로 메모리 저장으로 충분한 경우가 많다.

```nexacro
function fn_loginCallback(sId, nErrorCode, sErrorMsg) {
    if (nErrorCode < 0 || ds_tokenInfo.rowcount === 0) {
        alert("로그인 실패");
        return;
    }
    // 토큰 저장 (메모리)
    application.gv_accessToken  = ds_tokenInfo.getColumn(0, "ACCESS_TOKEN");
    application.gv_refreshToken = ds_tokenInfo.getColumn(0, "REFRESH_TOKEN");
    application.gv_userId       = ds_tokenInfo.getColumn(0, "USER_ID");

    application.mainframe.changeForm("FrmMain::main/FrmMain.xfdl");
}
```

## Authorization 헤더 자동 첨부

`addServiceGroup()`으로 ServiceID별 HTTP 헤더를 설정한다. 모든 트랜잭션에 적용하려면 공통 트랜잭션 래퍼 함수를 만들어 호출한다.

```nexacro
function fn_tx(svcId, url, input, output, callback) {
    // Authorization 헤더 설정
    this.addServiceGroup(svcId, "http",
        "Authorization=Bearer " + application.gv_accessToken
    );
    this.transaction(svcId, url, input, output, "", callback);
}

// 사용
function fn_search() {
    fn_tx(
        "svcSearch",
        "/api/orders",
        "",
        "out:ds_list=LIST",
        "fn_searchCallback"
    );
}
```

`addServiceGroup()`은 해당 ServiceID로 발행되는 트랜잭션에 헤더를 추가한다. 동일 ServiceID를 재사용하면 이전 설정이 덮어씌워지므로 매번 호출 전 재설정하는 방식이 안전하다.

## 토큰 만료 감지와 자동 갱신

서버가 토큰 만료 시 401을 반환하면, 공통 에러 처리에서 감지하고 refresh_token으로 새 access_token을 요청한 뒤 원래 요청을 재시도한다.

![자동 토큰 갱신 로직](/assets/posts/nexacro-n-token-auth-refresh.svg)

```nexacro
var g_pendingRequest = null;
var g_isRefreshing   = false;

function fn_txCallback_common(sId, nErrorCode, sErrorMsg, origArgs) {
    if (nErrorCode === -401) {
        if (!g_isRefreshing) {
            g_isRefreshing = true;
            g_pendingRequest = origArgs;
            fn_refreshToken();
        }
        return;
    }
    // 일반 에러 처리
}

function fn_refreshToken() {
    ds_refresh.clearData();
    ds_refresh.addRow();
    ds_refresh.setColumn(0, "REFRESH_TOKEN", application.gv_refreshToken);

    this.transaction(
        "svcRefresh", "/api/auth/refresh",
        "in:ds_refresh=REFRESH",
        "out:ds_newToken=TOKEN",
        "",
        "fn_refreshCallback"
    );
}

function fn_refreshCallback(sId, nErrorCode, sErrorMsg) {
    g_isRefreshing = false;
    if (nErrorCode >= 0) {
        application.gv_accessToken = ds_newToken.getColumn(0, "ACCESS_TOKEN");
        // 원래 요청 재시도
        if (g_pendingRequest) {
            fn_tx(
                g_pendingRequest.svcId,
                g_pendingRequest.url,
                g_pendingRequest.input,
                g_pendingRequest.output,
                g_pendingRequest.callback
            );
            g_pendingRequest = null;
        }
    } else {
        // refresh_token도 만료 → 강제 로그아웃
        fn_forceLogout();
    }
}
```

`g_isRefreshing` 플래그로 동시에 여러 요청이 실패했을 때 refresh 요청이 중복 발행되는 것을 막는다.

## 토큰 만료 사전 점검

매번 요청 시 서버 응답을 기다리지 않고, access_token의 만료 시각을 미리 점검해 갱신할 수도 있다. JWT 페이로드의 `exp` 클레임을 파싱한다.

```nexacro
function fn_getTokenExpiry(token) {
    try {
        var parts = token.split(".");
        var payload = JSON.parse(atob(parts[1]));
        return payload.exp * 1000;  // ms
    } catch(e) {
        return 0;
    }
}

function fn_tx(svcId, url, input, output, callback) {
    var expiry = fn_getTokenExpiry(application.gv_accessToken);
    var now = new Date().getTime();

    if (expiry - now < 60000) {  // 만료 1분 전이면 갱신
        g_pendingRequest = { svcId, url, input, output, callback };
        fn_refreshToken();
        return;
    }
    this.addServiceGroup(svcId, "http",
        "Authorization=Bearer " + application.gv_accessToken
    );
    this.transaction(svcId, url, input, output, "", callback);
}
```

## 서버 측 JWT 검증

```java
// Spring Security JWT 필터 (핵심 부분)
@Component
public class JwtAuthFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest req,
            HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String header = req.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            if (jwtUtil.validate(token)) {
                Authentication auth = jwtUtil.getAuthentication(token);
                SecurityContextHolder.getContext().setAuthentication(auth);
            } else {
                res.setStatus(401);
                return;
            }
        }
        chain.doFilter(req, res);
    }
}
```

---

**지난 글:** [SSO 연동](/posts/nexacro-n-sso-integration/)

**다음 글:** [XSS 방어](/posts/nexacro-n-xss-defense/)

<br>
읽어주셔서 감사합니다. 😊
