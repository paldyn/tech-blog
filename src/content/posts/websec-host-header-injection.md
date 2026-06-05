---
title: "Host 헤더 인젝션: 신뢰할 수 없는 호스트 값"
description: "HTTP Host 헤더를 조작해 비밀번호 재설정 링크 탈취, 캐시 포이즈닝, SSRF를 유발하는 Host Header Injection의 원리와 서버 설정·코드 수준 방어 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 2
type: "knowledge"
category: "Security"
tags: ["웹보안", "Host헤더", "인젝션", "SSRF", "비밀번호재설정"]
featured: false
draft: false
---

[지난 글](/posts/websec-web-cache-poisoning/)에서 캐시를 오염시켜 전체 사용자에게 악성 응답을 전파하는 웹 캐시 포이즈닝을 살펴봤다. Host 헤더 인젝션은 그 공격의 핵심 원료 중 하나다. 브라우저가 자동으로 설정하는 `Host` 헤더를 공격자가 직접 조작하면, 서버가 이 값을 신뢰하는 방식에 따라 다양한 취약점이 연쇄 발생한다.

## Host 헤더란?

HTTP/1.1 이후 클라이언트는 모든 요청에 `Host` 헤더를 포함해야 한다. 하나의 IP에 여러 도메인을 운영하는 가상 호스팅 환경에서 서버가 어느 사이트로 요청을 라우팅할지 판단하는 기준이 된다:

```http
GET /reset-password HTTP/1.1
Host: app.example.com
```

문제는 이 헤더를 브라우저만 보내는 것이 아니라 공격자도 curl, Burp Suite 등으로 임의의 값을 설정할 수 있다는 점이다.

## 공격 벡터

### 1. 비밀번호 재설정 링크 탈취

비밀번호 재설정 기능은 서버가 Host 헤더를 참조해 링크를 생성하는 경우가 많다:

```python
# 취약한 Django 뷰
def reset_password(request):
    token = generate_token(request.POST['email'])
    link = f"http://{request.META['HTTP_HOST']}/reset?token={token}"
    send_email(request.POST['email'], link)
```

공격자가 `Host: evil.attacker.com`으로 요청을 보내면 피해자에게 발송되는 이메일의 링크가 `evil.attacker.com`을 가리키게 된다. 피해자가 링크를 클릭하면 토큰이 공격자 서버로 전달된다.

![Host 헤더 인젝션 공격 시나리오](/assets/posts/websec-host-header-injection-flow.svg)

### 2. 캐시 포이즈닝과 결합

서버가 Host 헤더 값을 응답 HTML에 반영하고 해당 응답이 캐시되면, 캐시 포이즈닝으로 이어진다. 예를 들어 JS 파일 경로를 `Host` 기반으로 생성하는 경우:

```html
<!-- 서버 응답 -->
<script src="//evil.attacker.com/static/app.js"></script>
```

이 응답이 CDN에 캐시되면 이후 모든 방문자가 악성 스크립트를 로드한다.

### 3. SSRF 유발

가상 호스팅 설정이 잘못됐거나 내부 라우팅 로직이 Host 헤더를 따를 경우, 내부 서비스로 접근이 가능하다:

```http
GET /api/data HTTP/1.1
Host: internal-service.corp:8080
```

방화벽은 외부에서 `internal-service.corp`로의 직접 접근은 차단하지만, 외부 서버를 경유한 이런 요청은 통과할 수 있다.

### 4. X-Forwarded-Host와 우선순위 혼동

일부 서버는 `X-Forwarded-Host` 헤더를 `Host`보다 우선시한다:

```http
GET / HTTP/1.1
Host: legitimate.com
X-Forwarded-Host: evil.com
```

리버스 프록시가 `X-Forwarded-Host`를 전달하고 애플리케이션이 이를 참조하면 공격자가 값을 제어한다.

## 방어 방법

![Host 헤더 인젝션 방어 방법](/assets/posts/websec-host-header-injection-defense.svg)

### 1. 서버 프레임워크의 허용 호스트 설정

대부분의 프레임워크는 허용 호스트 목록을 명시적으로 설정하는 기능을 제공한다. Django의 `ALLOWED_HOSTS`, Rails의 `config.hosts`, Laravel의 `TrustedProxy` 미들웨어 등이 이에 해당한다:

```python
# Django
ALLOWED_HOSTS = ['app.example.com', 'www.example.com']

# Rails (config/application.rb)
config.hosts << 'app.example.com'
```

### 2. 링크 생성 시 설정값 사용

비밀번호 재설정, 이메일 인증 등 링크를 생성할 때는 절대로 요청 헤더에서 호스트를 읽지 않는다. 환경변수나 설정 파일의 고정값을 사용한다:

```javascript
// 취약
const resetLink = `https://${req.headers.host}/reset?token=${token}`;

// 안전
const BASE_URL = process.env.APP_BASE_URL; // 'https://app.example.com'
const resetLink = `${BASE_URL}/reset?token=${token}`;
```

### 3. Nginx/Apache에서 잘못된 Host 차단

기본 서버 블록에서 알 수 없는 Host 헤더를 가진 요청을 즉시 종료한다:

```nginx
# Nginx: 허용 도메인이 아닌 모든 요청 차단
server {
    listen 80 default_server;
    server_name _;
    return 444;  # 응답 없이 연결 종료
}

server {
    listen 80;
    server_name app.example.com www.example.com;
    # 실제 로직
}
```

### 4. 프록시 체인에서 신뢰할 수 없는 헤더 제거

리버스 프록시가 `X-Forwarded-Host` 등의 헤더를 전달할 때는 클라이언트가 설정한 값을 덮어쓰거나 제거한다:

```nginx
# 업스트림 전달 전 헤더 정규화
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host "";
proxy_set_header X-Original-URL "";
```

### 5. 애플리케이션 레벨 미들웨어

요청 처리 초반에 Host를 검증하는 미들웨어를 두면 방어 계층을 추가할 수 있다:

```typescript
const ALLOWED_HOSTS = new Set(['app.example.com', 'www.example.com']);

function hostValidationMiddleware(
  req: Request, res: Response, next: NextFunction
) {
  const host = req.headers.host?.split(':')[0]; // 포트 제거
  if (!host || !ALLOWED_HOSTS.has(host)) {
    return res.status(400).json({ error: 'Invalid host' });
  }
  next();
}
```

## 탐지 방법

Burp Suite의 **Intruder**나 **Repeater**로 Host 헤더를 변경해 응답이 달라지는지 확인한다. `ffuf`와 같은 퍼저로 자동화도 가능하다:

```bash
ffuf -w domains.txt -u https://target.com/ \
  -H "Host: FUZZ" -mc 200
```

응답 크기나 내용이 달라지는 도메인이 있으면 Host 헤더가 응답에 영향을 준다는 신호다.

---

**지난 글:** [웹 캐시 포이즈닝: CDN을 무기로 바꾸는 공격](/posts/websec-web-cache-poisoning/)

**다음 글:** [오픈 리다이렉트](/posts/websec-open-redirect/)

<br>
읽어주셔서 감사합니다. 😊
