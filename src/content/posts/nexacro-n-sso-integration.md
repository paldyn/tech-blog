---
title: "[Nexacro N] SSO 연동"
description: "Nexacro N 애플리케이션에 SAML 또는 OIDC 기반 SSO를 연동하는 방법을 설명합니다. 앱 서버가 SP 역할을 담당하고 Nexacro 클라이언트는 세션 확인만 수행하는 구조, 리다이렉트 처리, 토큰 전달 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 8
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "SSO", "SAML", "OIDC", "OAuth2", "단일로그인", "인증"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-permission-check/)에서 화면 단위 권한 체크 패턴을 살펴보았다. 이번에는 기업 환경에서 많이 요구되는 SSO(Single Sign-On) 연동 방법을 다룬다. Nexacro N 자체는 SAML이나 OIDC 프로토콜을 직접 처리하지 않는다. SSO 인증은 서버(SP)가 담당하고, 클라이언트는 세션 확인과 리다이렉트만 처리한다.

## 구조 개요

Nexacro 클라이언트는 SAML 어설션이나 OIDC 토큰을 직접 다루지 않는다. 인증은 서버 레벨에서 완결되며, 클라이언트는 서버 세션만 신뢰한다.

![SAML/OIDC SSO 연동 흐름](/assets/posts/nexacro-n-sso-integration-flow.svg)

- **Nexacro 클라이언트**: 세션 확인 API 호출 → 성공이면 메인, 실패면 리다이렉트
- **앱 서버 (SP)**: Spring Security SAML2 또는 OAuth2 Client로 IdP 연동
- **IdP**: 사내 LDAP 기반 Keycloak, Azure AD, Okta 등

## Nexacro 초기화 시 세션 확인

애플리케이션이 시작될 때 서버에 세션 유효성을 확인한다. SSO로 이미 인증된 사용자는 서버에 유효한 세션이 있으므로 곧바로 메인 화면으로 진입한다.

![SSO 세션 확인 패턴](/assets/posts/nexacro-n-sso-integration-code.svg)

`nexacro.navigateTo()`는 현재 Nexacro 앱을 종료하고 브라우저를 지정 URL로 이동시킨다. 서버의 `/api/auth/sso-redirect` 엔드포인트는 IdP 로그인 URL로 302 리다이렉트를 수행한다. IdP 인증이 완료되면 콜백 URL로 돌아와 서버 세션이 생성된다. 이후 Nexacro 앱이 다시 로드되면 세션이 유효하므로 메인 화면으로 진입한다.

## 서버 측 OIDC 설정 (Spring Boot)

```yaml
# application.yml
spring:
  security:
    oauth2:
      client:
        registration:
          keycloak:
            client-id: nexacro-app
            client-secret: ${SSO_CLIENT_SECRET}
            authorization-grant-type: authorization_code
            redirect-uri: "{baseUrl}/login/oauth2/code/keycloak"
            scope: openid, profile, email
        provider:
          keycloak:
            issuer-uri: https://keycloak.example.com/realms/company
```

Spring Security의 OAuth2 Client 자동 설정을 사용하면 코드를 최소화할 수 있다. 세션 확인 API와 리다이렉트 엔드포인트만 추가로 구현한다.

```java
@RestController
@RequestMapping("/api")
public class AuthController {

    @GetMapping("/session/check")
    public ResponseEntity<?> checkSession(Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }
        OidcUser oidcUser = (OidcUser) auth.getPrincipal();
        Map<String, Object> userInfo = new HashMap<>();
        userInfo.put("USER_ID", oidcUser.getPreferredUsername());
        userInfo.put("USER_NM", oidcUser.getFullName());
        // NexacroUtil.toDataset()으로 PL 포맷 응답
        return ResponseEntity.ok(NexacroUtil.toDataset("USERINFO", userInfo));
    }

    @GetMapping("/auth/sso-redirect")
    public void ssoRedirect(HttpServletResponse response) throws IOException {
        response.sendRedirect("/oauth2/authorization/keycloak");
    }
}
```

## 토큰 기반 API 호출

SSO 환경에서 Nexacro 트랜잭션이 발행될 때 서버 세션 쿠키가 자동으로 포함되므로, 추가적인 토큰 처리가 필요하지 않은 경우가 많다. 다만 API Gateway나 마이크로서비스 환경에서 Bearer 토큰이 필요하다면, 서버가 OIDC access_token을 세션에 저장하고 Nexacro 응답 헤더나 Dataset에 포함해 클라이언트에 전달하는 방법을 사용한다.

```nexacro
// 서버가 응답 Dataset에 access_token을 포함한 경우
function fn_ssoCheckCallback(sId, nErrorCode, sErrorMsg) {
    if (nErrorCode >= 0 && ds_ssoUser.rowcount > 0) {
        application.gv_userId   = ds_ssoUser.getColumn(0, "USER_ID");
        application.gv_token    = ds_ssoUser.getColumn(0, "ACCESS_TOKEN");
        application.mainframe.changeForm("FrmMain::main/FrmMain.xfdl");
    }
}

// 이후 트랜잭션에서 헤더로 첨부
function fn_transaction(svcId, url, input, output, args, callback) {
    this.addServiceGroup(svcId, "http",
        "Authorization=Bearer " + application.gv_token
    );
    this.transaction(svcId, url, input, output, args, callback);
}
```

## 세션 만료 후 SSO 재인증

서버 세션이 만료된 상태에서 트랜잭션을 보내면 401 응답이 돌아온다. 이를 공통 에러 처리에서 감지해 SSO 재인증 흐름을 시작한다.

```nexacro
function fn_commonErrorCallback(sId, nErrorCode, sErrorMsg) {
    if (nErrorCode === -401 || sErrorMsg.indexOf("401") >= 0) {
        // 세션 만료 → SSO 재인증
        nexacro.navigateTo("/api/auth/sso-redirect");
        return;
    }
    alert("서비스 오류: " + sErrorMsg);
}
```

## 주의사항

- Nexacro 앱이 `<iframe>` 안에서 로드되는 경우 `nexacro.navigateTo()`가 iframe 내에서만 동작할 수 있다. 최상위 프레임 이동이 필요하면 `window.top.location.href`를 사용한다.
- IdP 로그인 페이지는 Nexacro 앱 화면이 아닌 브라우저 기본 리다이렉트로 처리된다. 별도 팝업이나 iframe에서 SSO를 처리하면 쿠키 SameSite 정책에 막힐 수 있다.
- SAML은 POST 바인딩을 사용하므로 서버 콜백 URL의 CSRF 예외 처리가 필요하다.

---

**지난 글:** [권한 체크](/posts/nexacro-n-permission-check/)

**다음 글:** [토큰 인증](/posts/nexacro-n-token-auth/)

<br>
읽어주셔서 감사합니다. 😊
