---
title: "동일 출처 정책(SOP): 웹 보안의 가장 중요한 경계선"
description: "웹 브라우저가 교차 출처 요청의 응답 읽기를 차단하는 동일 출처 정책의 정의, 출처 비교 규칙, SOP가 막는 것과 막지 않는 것, CORS·postMessage 등 합법적 우회 메커니즘을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 6
type: "knowledge"
category: "Security"
tags: ["웹보안", "SOP", "동일출처정책", "CORS", "브라우저보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-business-logic-flaws/)에서 비즈니스 로직 취약점을 살펴봤다. 이번에는 웹 보안의 가장 근본적인 보안 경계선인 **동일 출처 정책(Same-Origin Policy, SOP)**이다. 브라우저 보안 모델의 핵심이며, CORS·CSRF·XSS 등 수많은 웹 취약점의 배경을 이해하려면 SOP부터 알아야 한다.

## 동일 출처 정책이란?

브라우저가 스크립트가 서로 다른 **출처(Origin)**의 문서나 리소스에 접근하는 것을 제한하는 보안 메커니즘이다. 1995년 Netscape가 도입한 이후 모든 브라우저가 구현하고 있는 기본 보안 정책이다.

**출처(Origin)**는 세 요소의 조합으로 정의된다:
- **프로토콜**: `http://` vs `https://`
- **호스트**: `example.com` vs `sub.example.com`
- **포트**: `:80` vs `:8080`

세 요소 중 하나라도 다르면 다른 출처다.

![동일 출처 정책(SOP) 동작 원리](/assets/posts/websec-same-origin-policy-explained.svg)

## SOP가 보호하는 것

`https://bank.com`에서 로그인한 사용자가 악성 사이트 `https://evil.com`을 방문한다고 가정하자. SOP가 없다면:

```javascript
// evil.com의 스크립트 (SOP 없을 경우 시나리오)
fetch('https://bank.com/api/balance', {
  credentials: 'include'  // bank.com의 쿠키 포함
})
.then(res => res.json())
.then(data => {
  // 은행 잔액 탈취!
  exfiltrate(data);
});
```

브라우저가 `bank.com`의 세션 쿠키를 자동으로 포함해 요청을 보내고, 응답까지 `evil.com` 스크립트가 읽을 수 있게 된다. SOP는 바로 이 **응답 읽기**를 차단한다.

## SOP가 막지 않는 것

중요한 오해가 있다. SOP는 교차 출처 **요청 전송**은 막지 않는다. **응답 읽기**만 막는다:

```javascript
// 이것은 전송된다 (요청은 서버에 도달함)
fetch('https://other-site.com/api/data', { credentials: 'include' });
// 하지만 브라우저에서 응답 내용을 읽을 수 없다

// 이것도 전송된다 (CSRF의 원인!)
<form action="https://bank.com/transfer" method="POST">
  <input name="amount" value="1000000">
  <input type="submit">
</form>
```

`<img>`, `<script>`, `<link>`, `<video>` 같은 태그를 통한 리소스 로드도 허용된다. CSS, 이미지, 스크립트 파일은 교차 출처에서 로드할 수 있다. 그래서 CDN이 작동하는 것이다.

## 합법적 우회 메커니즘

SOP가 너무 엄격하면 현대 웹의 마이크로서비스 아키텍처와 서드파티 API 연동이 불가능하다. 이를 위해 몇 가지 공식 우회 메커니즘이 존재한다.

![SOP 우회 메커니즘과 보안 고려사항](/assets/posts/websec-same-origin-policy-bypass.svg)

### CORS (Cross-Origin Resource Sharing)

서버가 응답 헤더로 특정 출처의 접근을 명시적으로 허용하는 방식이다:

```http
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Credentials: true
```

브라우저는 이 헤더를 보고 해당 출처의 스크립트에만 응답을 노출한다. `*`로 설정하면 모든 출처가 읽을 수 있어 위험하다. 다음 글에서 상세히 다룬다.

### postMessage

다른 창이나 iframe과 명시적 메시지 채널을 통해 통신한다:

```javascript
// 발신 (부모 창)
childFrame.contentWindow.postMessage({ type: 'data', value: 42 }, 'https://child.com');

// 수신 (자식 프레임) - origin 검증 필수
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://parent.com') return; // 검증!
  console.log(event.data);
});
```

수신 측에서 `event.origin`을 검증하지 않으면 임의 출처에서 메시지를 보낼 수 있어 XSS로 이어진다.

### document.domain (비권장)

같은 부모 도메인을 공유하는 서브도메인 간에 DOM을 공유하기 위해 둘 다 `document.domain = 'example.com'`으로 설정하면 상호 접근이 가능하다. 보안 위험(서브도메인 XSS로 상위 도메인 접근 가능)으로 Chrome에서 폐지 예정이다.

## SOP와 CSRF의 관계

SOP가 응답 읽기를 막지만 요청 전송은 막지 않기 때문에 **CSRF(Cross-Site Request Forgery)**가 존재한다. 공격자는 응답을 읽지 않아도 상태 변경 요청(송금, 비밀번호 변경)을 서버에 보낼 수 있다. SOP만으로는 CSRF를 막을 수 없고 CSRF 토큰, `SameSite` 쿠키 등 추가 방어가 필요한 이유다.

## 핵심 정리

| 행위 | SOP 통과 여부 |
|------|-------------|
| 교차 출처 `fetch` 전송 | 허용 (응답 읽기는 차단) |
| `<img src="https://other.com/x.png">` | 허용 |
| `<script src="https://cdn.com/lib.js">` | 허용 |
| `fetch` 응답 본문 읽기 (CORS 없이) | 차단 |
| 다른 출처 `iframe`의 DOM 접근 | 차단 |
| `<form>` POST 전송 | 허용 (CSRF의 원인) |

---

**지난 글:** [비즈니스 로직 취약점: 규칙의 허점을 노리다](/posts/websec-business-logic-flaws/)

**다음 글:** [CORS 보안 설정](/posts/websec-cors-security/)

<br>
읽어주셔서 감사합니다. 😊
