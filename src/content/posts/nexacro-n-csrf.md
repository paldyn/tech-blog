---
title: "[Nexacro N] CSRF 방어"
description: "Nexacro N 애플리케이션의 CSRF(Cross-Site Request Forgery) 공격 원리와 방어 전략을 다룹니다. CSRF 토큰 발급·검증, SameSite 쿠키 설정, Referer 검증, addServiceHeader를 활용한 토큰 전송 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 1
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "CSRF", "보안", "addServiceHeader", "SameSite", "토큰", "OWASP"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-xss-defense/)에서 XSS 방어를 살펴보았다. 이번에는 CSRF(Cross-Site Request Forgery, 사이트 간 요청 위조) 공격과 Nexacro N에서의 방어 전략을 살펴본다. CSRF는 피해자가 인증된 상태에서 공격자가 의도한 요청을 피해자 브라우저가 자동으로 전송하게 만드는 공격이다. Nexacro N은 `this.transaction()`으로 서버와 통신하므로, 해당 요청에 대한 위조 방지 설계가 필요하다.

## CSRF 공격 원리

CSRF 공격이 성립하려면 세 가지 조건이 충족되어야 한다.

1. **세션 쿠키 기반 인증** — 브라우저가 자동으로 쿠키를 전송한다
2. **예측 가능한 요청 파라미터** — 공격자가 요청 구조를 미리 알 수 있다
3. **피해자가 로그인 상태** — 유효한 세션이 존재한다

Nexacro N 앱이 브라우저에서 실행될 때, 피해자가 공격자의 악성 페이지를 방문하면 그 페이지의 스크립트가 Nexacro 서버로 위조 요청을 전송할 수 있다. 서버는 세션 쿠키만 보고 정상 요청으로 처리한다.

![CSRF 공격 흐름](/assets/posts/nexacro-n-csrf-attack-flow.svg)

## Nexacro N에서의 CSRF 위험 지점

Nexacro N의 `transaction()` 요청은 기본적으로 HTTP POST 방식이다. 브라우저의 동일 출처 정책(SOP)은 폼 POST 요청을 차단하지 않으므로, 악성 사이트에서 숨겨진 폼이나 fetch 요청으로 위조할 수 있다.

```javascript
// nexacro 트랜잭션 — 기본 세션 쿠키 의존
this.transaction(
  "deleteUser",
  "/service/UserService.do",
  "ds_input=ds_input",
  "ds_output=ds_output",
  "",
  "fn_callback"
);
// 위: CSRF 토큰 없으면 외부에서 위조 가능
```

특히 회원 정보 변경, 권한 부여, 데이터 삭제 같은 상태 변경 작업이 위험하다.

## Anti-CSRF 토큰 방어

가장 강력한 방어 수단은 **서버에서 발급한 무작위 토큰을 매 요청마다 검증**하는 방식이다.

### 1단계: 서버 토큰 발급

서버(Spring 예시)에서 로그인 시 또는 Form 로드 시 CSRF 토큰을 발급해 세션에 저장한다.

```java
// Spring Security CSRF 설정
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http.csrf(csrf -> csrf
        .csrfTokenRepository(
            CookieCsrfTokenRepository.withHttpOnlyFalse()
        )
    );
    return http.build();
}
```

### 2단계: Nexacro에서 토큰 수신 및 저장

Form 로드 시 토큰을 서버에서 조회해 전역 변수에 저장한다.

```javascript
// BaseForm.xfdl — 공통 베이스 폼
function Form_Load(obj, e) {
  this.transaction(
    "getCsrfToken",
    "/auth/csrf-token",
    "",
    "ds_csrf=ds_csrf",
    "",
    "fn_csrfCallback"
  );
}

function fn_csrfCallback(sId, nErrCode, sErrMsg) {
  if (nErrCode == 0) {
    gv_csrfToken = this.ds_csrf.getColumn(0, "token");
  }
}
```

### 3단계: 트랜잭션 헤더에 토큰 첨부

`addServiceHeader()`를 사용해 모든 상태 변경 요청에 토큰을 포함한다.

```javascript
// 공통 라이브러리 — gfn_transaction
function gfn_transaction(svcId, svcUrl, dsIn, dsOut, args, cb) {
  // CSRF 토큰을 요청 헤더에 추가
  this.addServiceHeader("X-CSRF-Token", gv_csrfToken);
  this.transaction(svcId, svcUrl, dsIn, dsOut, args, cb);
}
```

![CSRF 토큰 처리 흐름](/assets/posts/nexacro-n-csrf-token-flow.svg)

### 4단계: 서버 검증

서버는 요청 헤더의 토큰과 세션의 토큰을 비교해 불일치하면 403을 반환한다.

```java
// 인터셉터에서 CSRF 토큰 검증
@Override
public boolean preHandle(HttpServletRequest req,
    HttpServletResponse res, Object handler) {
  String headerToken = req.getHeader("X-CSRF-Token");
  String sessionToken = (String) req.getSession()
                             .getAttribute("CSRF_TOKEN");
  if (!sessionToken.equals(headerToken)) {
    res.sendError(403, "CSRF token mismatch");
    return false;
  }
  return true;
}
```

## SameSite 쿠키 설정

토큰 방식을 보완하는 두 번째 방어선이다. 세션 쿠키에 `SameSite` 속성을 추가하면 크로스사이트 요청 시 브라우저가 쿠키를 자동 전송하지 않는다.

| 설정 | 동작 | 권장 용도 |
|------|------|-----------|
| `Strict` | 타 사이트 요청에 쿠키 전송 안 함 | 내부 시스템 |
| `Lax` | GET 외 메서드에서 크로스사이트 차단 | 일반적인 선택 |
| `None` | 항상 전송 (Secure 필수) | 외부 연동 필요 시 |

```java
// Spring Boot — 세션 쿠키 SameSite 설정
server:
  servlet:
    session:
      cookie:
        same-site: strict
        http-only: true
        secure: true
```

## Referer / Origin 헤더 검증

추가 방어로 서버가 요청의 `Origin` 또는 `Referer` 헤더를 확인해 허용 도메인인지 검사한다.

```java
String origin = request.getHeader("Origin");
if (origin != null && !allowedOrigins.contains(origin)) {
  response.sendError(403, "Forbidden origin");
  return false;
}
```

단, `Referer` 헤더는 브라우저 설정에 따라 생략될 수 있으므로 단독 방어로는 부족하다. CSRF 토큰과 병행해야 한다.

## Double Submit Cookie 패턴

세션 없는 서버(REST API) 환경에서 활용하는 패턴이다. CSRF 토큰을 쿠키와 요청 헤더에 동시에 전송하고, 서버는 두 값이 일치하는지 비교한다.

```javascript
// 쿠키에서 CSRF 토큰 읽어 헤더에도 전송
function fn_readCsrfCookie() {
  var cookies = document.cookie.split(";");
  for (var i = 0; i < cookies.length; i++) {
    var c = cookies[i].trim();
    if (c.startsWith("XSRF-TOKEN=")) {
      return c.substring("XSRF-TOKEN=".length);
    }
  }
  return "";
}
// addServiceHeader에 쿠키 값 적용
this.addServiceHeader("X-XSRF-TOKEN", fn_readCsrfCookie());
```

공격자는 SOP 때문에 타 도메인의 쿠키를 읽을 수 없으므로, 동일한 값을 헤더에 담지 못한다.

## CSRF 방어 체크리스트

| 항목 | 상태 변경 API | 조회 API |
|------|-------------|---------|
| CSRF 토큰 검증 | ✅ 필수 | — |
| SameSite=Strict/Lax | ✅ 필수 | ✅ 필수 |
| HTTPS + Secure 쿠키 | ✅ 필수 | ✅ 필수 |
| Origin 헤더 검증 | ✅ 권장 | — |
| HttpOnly 쿠키 | ✅ 필수 | ✅ 필수 |

Nexacro N 프로젝트에서 보안 요구사항이 높다면, 상태 변경 API 호출마다 CSRF 토큰을 `addServiceHeader()`로 전송하고, 서버 인터셉터에서 일괄 검증하는 구조가 가장 효율적이다. 공통 베이스 폼(`BaseForm.xfdl`)과 공통 트랜잭션 함수(`gfn_transaction`)에 토큰 로직을 집중시키면 개별 화면마다 반복 구현을 피할 수 있다.

---

**지난 글:** [XSS 방어](/posts/nexacro-n-xss-defense/)

**다음 글:** [데이터 암호화](/posts/nexacro-n-data-encryption/)

<br>
읽어주셔서 감사합니다. 😊
