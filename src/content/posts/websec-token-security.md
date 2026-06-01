---
title: "토큰 보안 모범 사례: 저장·전송·폐기"
description: "Access Token과 Refresh Token을 안전하게 저장하고 전송하는 방법, localStorage 위험성, HttpOnly 쿠키 설정, 토큰 폐기 전략을 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 2
type: "knowledge"
category: "Security"
tags: ["토큰보안", "JWT", "AccessToken", "RefreshToken", "HttpOnly", "XSS방어"]
featured: false
draft: false
---

[지난 글](/posts/websec-jwt-algorithm-confusion/)에서 JWT 알고리즘 혼동 공격을 살펴봤다. 올바른 토큰을 발급하더라도 **어디에 저장하고 어떻게 전송하느냐**에 따라 보안이 크게 달라진다. 이번 글은 토큰의 생명주기 전반을 다룬다.

## 토큰 저장 위치의 선택

웹 브라우저에서 토큰을 저장하는 방법은 크게 세 가지다: `localStorage`, `sessionStorage`, `HttpOnly Cookie`. 어떤 선택을 하느냐에 따라 노출되는 공격 표면이 달라진다.

![토큰 저장 방식별 위협 비교](/assets/posts/websec-token-security-threats.svg)

### localStorage — 절대 사용하지 말 것

`localStorage`는 같은 오리진의 모든 자바스크립트에서 접근 가능하다. 페이지 어딘가에 XSS 취약점이 한 군데라도 있으면 `localStorage.getItem('access_token')`으로 즉시 탈취된다. CDN으로 로드하는 서드파티 스크립트도 포함된다.

```javascript
// 위험 — 절대 하지 말 것
localStorage.setItem('access_token', token);

// XSS 발생 시 공격자가 즉시 읽을 수 있음
const stolen = localStorage.getItem('access_token');
```

### HttpOnly Cookie — 권장 패턴

`HttpOnly` 속성이 붙은 쿠키는 자바스크립트에서 읽을 수 없다. XSS 공격자가 `document.cookie`로 훔칠 수 없다. `Secure` 속성으로 HTTPS 전송만 허용하고, `SameSite=Strict`로 CSRF도 방어한다.

```javascript
// Express.js 서버 측 쿠키 설정
res.cookie('refresh_token', refreshToken, {
  httpOnly: true,      // JS 접근 불가
  secure: true,        // HTTPS만
  sameSite: 'strict',  // CSRF 방어
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
  path: '/auth/refresh', // 경로 한정
});
```

### 권장 아키텍처: Access = 메모리, Refresh = HttpOnly Cookie

```javascript
// 클라이언트: Access Token을 메모리(변수)에만 보관
let accessToken = null;  // 탭 닫으면 소멸, XSS로 접근 어려움

async function login(credentials) {
  const res = await fetch('/auth/login', {
    method: 'POST',
    credentials: 'include', // 쿠키 포함
    body: JSON.stringify(credentials),
  });
  const data = await res.json();
  // Access Token만 응답 바디로, Refresh는 서버가 쿠키로 설정
  accessToken = data.access_token;
}

async function callApi(endpoint) {
  const res = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: 'include',
  });
  if (res.status === 401) {
    await refreshTokens(); // 만료 시 자동 갱신
  }
  return res.json();
}
```

![토큰 저장 구현 코드](/assets/posts/websec-token-security-storage.svg)

## 토큰 전송 보안

### Authorization 헤더

Access Token은 `Authorization: Bearer <token>` 헤더로 전송한다. URL 쿼리 파라미터(`?token=xxx`)는 절대 사용하지 않는다. URL은 서버 로그, 브라우저 히스토리, Referer 헤더에 남는다.

```bash
# 올바른 방법
curl -H "Authorization: Bearer eyJ..." https://api.example.com/data

# 잘못된 방법 — URL에 토큰 노출
curl "https://api.example.com/data?token=eyJ..."
```

### 토큰 바인딩 (선택적 강화)

토큰을 특정 클라이언트에 바인딩하면 탈취해도 사용할 수 없다.

```python
import hashlib

def create_bound_token(user_id: str, client_fingerprint: str) -> str:
    """클라이언트 지문을 페이로드에 포함"""
    fp_hash = hashlib.sha256(client_fingerprint.encode()).hexdigest()
    payload = {
        "sub": user_id,
        "cfp": fp_hash,  # 클라이언트 지문 해시
        "exp": time.time() + 900,
    }
    return jwt.encode(payload, PRIVATE_KEY, algorithm="RS256")

def verify_bound_token(token: str, client_fingerprint: str):
    payload = jwt.decode(token, PUBLIC_KEY, algorithms=["RS256"])
    expected = hashlib.sha256(client_fingerprint.encode()).hexdigest()
    if payload["cfp"] != expected:
        raise ValueError("토큰 바인딩 검증 실패")
    return payload
```

## 토큰 폐기 전략

JWT는 기본적으로 Stateless다. 만료 전에 강제 폐기하려면 추가 메커니즘이 필요하다.

### 블랙리스트 (즉시 폐기)

```python
import redis

r = redis.Redis()

def revoke_token(jti: str, exp: int):
    """토큰 ID(jti)를 블랙리스트에 추가"""
    ttl = exp - int(time.time())
    if ttl > 0:
        r.setex(f"revoked:{jti}", ttl, "1")

def is_revoked(jti: str) -> bool:
    return r.exists(f"revoked:{jti}") > 0

def verify_token(token: str):
    payload = jwt.decode(token, PUBLIC_KEY, algorithms=["RS256"])
    if "jti" not in payload:
        raise ValueError("jti 클레임 없음")
    if is_revoked(payload["jti"]):
        raise ValueError("폐기된 토큰")
    return payload
```

### 토큰 버전 관리 (전체 무효화)

```python
def create_token(user_id: str) -> str:
    # DB에서 현재 토큰 버전 조회
    version = db.get_token_version(user_id)
    payload = {
        "sub": user_id,
        "ver": version,   # 버전 포함
        "exp": time.time() + 900,
    }
    return jwt.encode(payload, PRIVATE_KEY, algorithm="RS256")

def verify_token(token: str):
    payload = jwt.decode(token, PUBLIC_KEY, algorithms=["RS256"])
    current_version = db.get_token_version(payload["sub"])
    if payload["ver"] != current_version:
        raise ValueError("버전 불일치 — 재로그인 필요")
    return payload

def logout_all_devices(user_id: str):
    """모든 기기 로그아웃: 버전 증가"""
    db.increment_token_version(user_id)
```

## 보안 체크리스트

- [ ] Access Token 만료: 15분 이하
- [ ] Refresh Token: HttpOnly + Secure + SameSite=Strict Cookie
- [ ] 토큰을 URL 파라미터로 전달 금지
- [ ] localStorage 저장 금지
- [ ] `jti` 클레임 포함 및 블랙리스트 구현
- [ ] 로그아웃 시 서버에서 토큰 폐기
- [ ] Refresh Token Rotation 구현

---

**지난 글:** [JWT 알고리즘 혼동 공격](/posts/websec-jwt-algorithm-confusion/)

**다음 글:** [Refresh Token Rotation 전략](/posts/websec-refresh-token-rotation/)

<br>
읽어주셔서 감사합니다. 😊
