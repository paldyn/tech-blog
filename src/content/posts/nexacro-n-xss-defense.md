---
title: "[Nexacro N] XSS 방어"
description: "Nexacro N 애플리케이션에서 발생할 수 있는 XSS 취약점 벡터와 방어 방법을 설명합니다. WebBrowser execScript 인젝션, eval 남용, innerHTML 직접 삽입 등의 위험 패턴과 안전한 대안을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 10
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "XSS", "보안", "execScript", "CSP", "입력검증", "OWASP"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-token-auth/)에서 JWT 토큰 인증을 살펴보았다. 이번에는 Nexacro N 애플리케이션의 XSS(Cross-Site Scripting) 취약점과 방어 방법을 다룬다. Nexacro N의 컴포넌트 자체는 HTML을 파싱하지 않아 일반적인 DOM 기반 XSS가 발생하지 않는다. 하지만 WebBrowser 컴포넌트와 `execScript()`를 사용하는 지점에서 주의가 필요하다.

## Nexacro N에서의 XSS 취약점 벡터

Nexacro의 `Static`, `Edit`, `Grid` 등 일반 컴포넌트는 HTML 렌더러가 아니다. 표시 값을 HTML로 해석하지 않으므로 전통적인 `<script>alert()</script>` 삽입 XSS는 발생하지 않는다. 하지만 세 가지 경로에서 위험이 존재한다.

![XSS 취약점 벡터와 방어](/assets/posts/nexacro-n-xss-defense-vectors.svg)

## WebBrowser + execScript() 인젝션

가장 흔한 위험 경로다. 서버에서 받은 데이터를 문자열 연결로 `execScript()`에 전달하면 스크립트 인젝션이 가능하다.

```nexacro
// 위험 - 서버 데이터를 문자열 연결로 직접 삽입
var userInput = ds_search.getColumn(0, "KEYWORD");
WebBrowser00.execScript("search('" + userInput + "')");
// userInput = "'); maliciousCode(); //" 이면 악성 코드 실행

// 안전 - JSON.stringify로 직렬화
var safeInput = JSON.stringify(userInput);
WebBrowser00.execScript("search(" + safeInput + ")");
// safeInput = '"값"' → 항상 따옴표로 감싸진 안전한 문자열
```

`JSON.stringify()`를 사용하면 문자열 내의 작은따옴표, 큰따옴표, 역슬래시 등이 이스케이프되어 스크립트 문맥을 탈출할 수 없다.

## HTML 내부에서의 안전한 데이터 표시

![안전한 데이터 출력 패턴 비교](/assets/posts/nexacro-n-xss-defense-code.svg)

WebBrowser 내부 HTML에서 데이터를 표시할 때는 `textContent`를 사용한다. `innerHTML`은 HTML을 파싱하기 때문에 XSS 취약점이 발생한다.

```javascript
// HTML 내부 JavaScript (chart.html)
function displayTitle(title) {
    // 위험
    document.getElementById("title").innerHTML = title;

    // 안전
    document.getElementById("title").textContent = title;
}

// 서버 HTML 응답을 렌더링해야 할 때는 DOMPurify로 sanitize
// import DOMPurify from 'dompurify';
// element.innerHTML = DOMPurify.sanitize(serverHtml);
```

## eval() 사용 금지

`eval()`은 문자열을 JavaScript 코드로 실행한다. 서버에서 받은 문자열을 `eval()`로 처리하면 임의 코드 실행이 가능하다.

```nexacro
// 위험
var responseText = ds_result.getColumn(0, "SCRIPT");
eval(responseText);  // 절대 금지

// 안전 - JSON 파싱은 JSON.parse 사용
var jsonText = ds_result.getColumn(0, "JSON_DATA");
var data = JSON.parse(jsonText);
```

Nexacro Script 자체에서는 `eval()`이 드물지만, WebBrowser 내부 JavaScript에서 서버 응답을 `eval()`로 처리하는 실수가 종종 발생한다.

## 입력값 검증 (서버 우선)

클라이언트 검증은 사용자 경험을 위한 것이고, 보안은 서버에서 담당한다. 서버에서 모든 입력값을 화이트리스트 기반으로 검증하고, 응답 시 HTML 이스케이프를 적용한다.

```java
// Spring Boot - OWASP Java Encoder 사용
import org.owasp.encoder.Encode;

@RestController
public class SearchController {
    @GetMapping("/api/search")
    public ResponseEntity<?> search(@RequestParam String keyword) {
        // 입력값 검증
        if (keyword.length() > 100 || !keyword.matches("[\\w가-힣\\s]+")) {
            return ResponseEntity.badRequest().build();
        }

        // 응답 시 HTML 이스케이프
        String safeKeyword = Encode.forHtml(keyword);
        List<Item> items = itemService.search(safeKeyword);
        return ResponseEntity.ok(NexacroUtil.toDataset("LIST", items));
    }
}
```

## CSP(Content Security Policy) 헤더 설정

WebBrowser 내부 HTML 페이지에 CSP를 적용해 인라인 스크립트와 외부 스크립트 로딩을 제한한다.

```java
// Spring Boot SecurityConfig
http.headers(headers -> headers
    .contentSecurityPolicy(csp -> csp
        .policyDirectives(
            "default-src 'self'; " +
            "script-src 'self' 'nonce-{RANDOM}'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data:; " +
            "connect-src 'self'"
        )
    )
    .frameOptions(frame -> frame.sameOrigin())
    .xssProtection(xss -> xss.headerValue(XXssProtectionHeaderWriter.HeaderValue.ENABLED_MODE_BLOCK))
);
```

CSP 설정은 WebBrowser 내부 HTML에서 임의 외부 스크립트가 로드되는 것을 차단하는 강력한 방어막이다.

## 보안 헤더 체크리스트

| 헤더 | 설정 | 목적 |
|------|------|------|
| X-Content-Type-Options | `nosniff` | MIME 스니핑 방지 |
| X-XSS-Protection | `1; mode=block` | 브라우저 내장 XSS 필터 |
| X-Frame-Options | `SAMEORIGIN` | 클릭재킹 방지 |
| Content-Security-Policy | 스크립트 소스 제한 | XSS 인라인 실행 차단 |
| Referrer-Policy | `strict-origin-when-cross-origin` | 리퍼러 정보 노출 제한 |

Nexacro 앱이 웹 브라우저에서 실행되는 이상, 서버 응답 헤더를 통한 보안 강화는 필수다. 클라이언트 측 방어와 서버 측 방어를 조합해 방어 깊이(Defense in Depth)를 확보해야 한다.

---

**지난 글:** [토큰 인증](/posts/nexacro-n-token-auth/)

<br>
읽어주셔서 감사합니다. 😊
