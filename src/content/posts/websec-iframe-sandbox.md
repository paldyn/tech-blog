---
title: "iframe sandbox: 안전한 임베드를 위한 격리"
description: "iframe sandbox 속성으로 임베드 콘텐츠의 JS 실행·쿠키 접근·폼 제출을 격리하는 원리, 각 토큰의 보안 의미, sandbox 우회 취약점 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 1
type: "knowledge"
category: "Security"
tags: ["iframe", "sandbox", "브라우저보안", "XSS", "CSP", "임베드"]
featured: false
draft: false
---

[지난 글](/posts/websec-trusted-types/)에서 Trusted Types로 DOM XSS 싱크에 문자열 할당을 브라우저 레벨에서 막는 방법을 살펴봤다. 이번 글에서는 외부 콘텐츠를 임베드할 때 사용하는 `<iframe>`의 `sandbox` 속성을 깊이 파고든다. 서드파티 위젯, 광고, 사용자 생성 HTML을 안전하게 렌더링하려면 sandbox를 정확히 이해해야 한다.

## iframe이 왜 보안 위협인가

`<iframe>`은 한 페이지 안에 다른 오리진의 문서를 임베드한다. 기본 설정에서 임베드 콘텐츠는 상당한 권한을 가진다.

```html
<!-- sandbox 없이 임베드하면... -->
<iframe src="https://third-party.example/widget.html"></iframe>
```

이 경우 `widget.html`이 실행할 수 있는 것들:

- `window.opener`를 통해 부모 페이지 참조
- 자바스크립트 실행 후 피싱 팝업 열기
- 클릭재킹 레이아웃 구성
- 서드파티 추적 스크립트 실행

## sandbox 속성: 기본 차단부터 허용 추가

`sandbox` 속성은 **화이트리스트 방식**으로 동작한다. 속성을 빈 값으로 지정하면 모든 것을 차단하고, 필요한 토큰만 추가해 선택적으로 허용한다.

```html
<!-- 가장 강력한 격리: 아무것도 허용하지 않음 -->
<iframe sandbox="" src="https://third-party.example/content"></iframe>

<!-- 스크립트와 폼만 허용 -->
<iframe sandbox="allow-scripts allow-forms"
        src="https://third-party.example/widget"></iframe>
```

![iframe sandbox 속성 참조표](/assets/posts/websec-iframe-sandbox-attrs.svg)

## 각 토큰의 보안 의미

### allow-scripts: 가장 위험한 토큰

자바스크립트 실행을 허용한다. 단독으로 사용하면 JS는 실행되지만 다른 제약은 유지된다. 그러나 **`allow-scripts`와 `allow-same-origin`을 동시에 허용하면 sandbox를 완전히 우회할 수 있다.**

```javascript
// allow-scripts + allow-same-origin 조합 시 iframe 내부에서 실행 가능:
window.frameElement.removeAttribute('sandbox'); // sandbox 제거!
```

이 조합은 sandbox 자체를 무력화하므로 절대 함께 쓰지 말아야 한다.

### allow-same-origin: 동일 오리진 처우

sandbox 없이 임베드된 same-origin iframe은 부모의 쿠키와 localStorage에 접근할 수 있다. `allow-same-origin` 없이 sandbox를 적용하면 cross-origin으로 취급되어 이 접근이 차단된다.

### allow-forms: 데이터 외부 유출 경로

폼 제출을 허용한다. 악성 iframe이 사용자 행동을 포착해 외부로 전송하는 데 활용될 수 있다. 정말 필요한 경우에만 추가한다.

### allow-top-navigation: 피싱의 문

부모 페이지의 URL을 변경할 수 있게 한다. 악성 iframe이 사용자를 피싱 사이트로 리다이렉트하는 데 사용된다.

```javascript
// allow-top-navigation이 있으면 iframe에서 실행 가능:
top.location.href = 'https://phishing.example/fake-login';
```

사용자에게 허용하되 악용을 방지하려면 `allow-top-navigation-by-user-activation`을 대신 사용한다.

## 격리 메커니즘 전체 흐름

![iframe sandbox 격리 메커니즘](/assets/posts/websec-iframe-sandbox-flow.svg)

sandbox가 적용된 iframe은 브라우저의 보안 경계(Security Boundary)로 부모와 격리된다. 유일하게 허용되는 통신 경로는 `postMessage` API이며, 이 역시 origin 검증이 필요하다.

## 실전 패턴

### 사용자 생성 HTML 안전하게 렌더링

```html
<!-- 사용자가 작성한 HTML을 안전하게 표시 -->
<iframe
  sandbox="allow-same-origin"
  srcdoc="${sanitizedHtml}"
  title="사용자 콘텐츠"
  referrerpolicy="no-referrer">
</iframe>
```

`srcdoc`을 사용하면 별도 URL 없이 HTML 문자열을 직접 렌더링한다. `allow-same-origin`은 부모와 같은 오리진으로 취급해 CSS 스타일시트를 공유할 수 있지만, JS는 여전히 차단된다.

### 결제 위젯 (외부 서비스)

```html
<iframe
  sandbox="allow-scripts allow-forms allow-same-origin"
  src="https://payment.provider/widget"
  allow="payment"
  referrerpolicy="strict-origin-when-cross-origin">
</iframe>
```

결제 위젯은 폼 제출과 스크립트가 필요하다. `allow-same-origin`은 결제 Provider가 자체 쿠키를 쓰기 위해 필요할 수 있다. 이 조합에서는 Provider의 iframe이 Provider 자신의 쿠키에만 접근하므로 부모 사이트 쿠키는 보호된다.

### 광고 iframe

```html
<iframe
  sandbox="allow-scripts allow-popups"
  src="https://ad.network/banner"
  loading="lazy">
</iframe>
```

광고는 클릭 시 새 창을 열어야 하므로 `allow-popups`가 필요하다. `allow-forms`와 `allow-same-origin`은 제거한다.

## CSP의 frame-ancestors와 함께 사용

sandbox는 임베드하는 쪽(부모)이 설정한다. 반대로 **임베드 당하는 쪽(자식)**이 자신이 어디에 임베드될 수 있는지 제어하려면 CSP `frame-ancestors`를 사용한다.

```http
Content-Security-Policy: frame-ancestors 'self' https://trusted.example
```

이 헤더가 있으면 지정된 오리진 외에서 이 페이지를 `<iframe>`으로 임베드할 수 없다. 클릭재킹 방어에서 핵심 역할을 한다.

## 체크리스트

| 시나리오 | 권장 sandbox 값 |
|---|---|
| 정적 HTML 표시 | `sandbox=""` |
| 사용자 작성 HTML | `sandbox="allow-same-origin"` |
| 외부 위젯 (JS 필요) | `sandbox="allow-scripts"` |
| 결제/폼 위젯 | `sandbox="allow-scripts allow-forms"` |
| 광고 | `sandbox="allow-scripts allow-popups"` |
| ❌ 절대 금지 | `allow-scripts + allow-same-origin` 동시 사용 |

---

**지난 글:** [Trusted Types: DOM XSS 방어의 새로운 표준](/posts/websec-trusted-types/)

**다음 글:** [postMessage 보안: 크로스 오리진 통신 안전하게](/posts/websec-postmessage-security/)

<br>
읽어주셔서 감사합니다. 😊
