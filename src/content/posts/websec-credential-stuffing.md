---
title: "크리덴셜 스터핑: 공격 원리와 방어 전략"
description: "크리덴셜 스터핑의 공격 흐름과 비밀번호 재사용 위험성을 설명하고, 속도 제한·유출 비밀번호 탐지·위험 기반 인증을 결합한 다층 방어 전략을 Python 코드와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 2
type: "knowledge"
category: "Security"
tags: ["크리덴셜스터핑", "계정탈취", "ATO", "인증보안", "봇방어", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-abac/)에서 속성 기반 접근 제어로 정교한 권한 정책을 구현하는 방법을 살펴봤다. 아무리 정교한 인가 시스템을 갖춰도 공격자가 정상 계정으로 로그인에 성공하면 무용지물이 된다. **크리덴셜 스터핑(Credential Stuffing)**은 다른 서비스에서 유출된 계정 정보로 자동화 로그인을 시도하는 공격으로, 현재 계정 탈취의 가장 흔한 경로다.

## 크리덴셜 스터핑이란

브루트포스가 가능한 모든 비밀번호 조합을 시도하는 것과 달리, 크리덴셜 스터핑은 **실제로 유출된 사용자명:비밀번호 쌍(콤보 리스트)**을 사용한다. 다크웹에는 수십억 건의 유출 계정 정보가 거래된다.

공격 성공의 핵심 전제는 **비밀번호 재사용**이다. 사람들이 여러 서비스에 동일한 비밀번호를 쓰기 때문에, 서비스 A에서 유출된 계정이 서비스 B 로그인에 그대로 통한다.

![크리덴셜 스터핑 공격 흐름](/assets/posts/websec-credential-stuffing-flow.svg)

## 공격 성공률과 규모

크리덴셜 스터핑의 성공률은 0.1~2% 수준이다. 낮아 보이지만 수백만 건의 콤보 리스트를 사용하면 수천~수만 건의 계정 탈취가 가능하다. 공격자는 탈취된 계정으로 금융 사기, 개인정보 판매, 포인트·마일리지 현금화 등 다양한 수익을 취한다.

현대 크리덴셜 스터핑 공격의 특징:

- **분산 IP**: 수천 개의 주거용 프록시를 사용해 IP 차단을 우회한다
- **저속 공격**: 속도를 낮춰 이상 탐지 임계값을 피한다
- **User-Agent 위장**: 정상 브라우저처럼 보이도록 헤더를 조작한다
- **상태 관리**: 쿠키, CSRF 토큰 등을 자동으로 처리하는 봇을 사용한다

## 방어 계층

단일 방어로는 충분하지 않다. 여러 방어를 중첩해야 한다.

### 1. 속도 제한(Rate Limiting)

로그인 엔드포인트에 IP·계정 단위 속도 제한을 적용한다. Redis 슬라이딩 윈도우가 가장 일반적이다.

```python
import redis
import time

r = redis.Redis()

def rate_limit_exceeded(key: str, limit: int, window: int) -> bool:
    now = time.time()
    pipe = r.pipeline()
    pipe.zremrangebyscore(key, 0, now - window)
    pipe.zadd(key, {str(now): now})
    pipe.zcard(key)
    pipe.expire(key, window)
    results = pipe.execute()
    return results[2] > limit

# 사용: IP당 10회/분, 계정당 5회/분 제한
def check_login_rate(ip: str, username: str) -> bool:
    if rate_limit_exceeded(f"rate:ip:{ip}", limit=10, window=60):
        return False
    if rate_limit_exceeded(f"rate:user:{username}", limit=5, window=60):
        return False
    return True
```

### 2. 유출 비밀번호 탐지

HaveIBeenPwned API는 k-익명성(k-anonymity) 모델로 비밀번호의 처음 5자리 SHA-1 해시만 전송해 개인정보 노출 없이 유출 여부를 확인한다.

```python
import hashlib
import httpx

async def is_pwned_password(password: str) -> bool:
    sha1 = hashlib.sha1(password.encode()).hexdigest().upper()
    prefix, suffix = sha1[:5], sha1[5:]
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"https://api.pwnedpasswords.com/range/{prefix}",
            headers={"Add-Padding": "true"}
        )
    for line in r.text.splitlines():
        h, count = line.split(":")
        if h == suffix:
            return True  # 유출된 비밀번호
    return False
```

### 3. 위험 기반 인증(Risk-Based Authentication)

로그인 요청의 다양한 신호를 점수화해 위험도가 높으면 MFA 챌린지를 요구한다.

```python
def compute_risk_score(username: str, ip: str, user_agent: str) -> float:
    score = 0.0

    # 새 IP에서 시도
    if not is_known_ip(username, ip):
        score += 0.3

    # 알려진 데이터센터/VPN IP
    if is_datacenter_ip(ip):
        score += 0.3

    # 헤드리스 브라우저 패턴
    if is_headless_ua(user_agent):
        score += 0.2

    # 최근 다른 계정 실패 기록
    if recent_failures_from_ip(ip) > 3:
        score += 0.2

    return min(score, 1.0)
```

![크리덴셜 스터핑 방어 코드](/assets/posts/websec-credential-stuffing-defense.svg)

## 통합 방어 구현

```python
async def secure_login(
    username: str, password: str, ip: str, user_agent: str
) -> LoginResult:
    # 속도 제한
    if not check_login_rate(ip, username):
        raise TooManyRequests("로그인 시도 횟수 초과")

    # 유출 비밀번호 확인
    if await is_pwned_password(password):
        # 인증 결과와 무관하게 비밀번호 변경 강제
        notify_password_change_required(username)
        return LoginResult.force_reset()

    # 자격증명 검증
    user = verify_credentials(username, password)
    if not user:
        record_failed_attempt(ip, username)
        raise AuthenticationError("인증 실패")

    # 위험 기반 MFA
    risk = compute_risk_score(username, ip, user_agent)
    if risk > 0.5:
        return LoginResult.require_mfa(user)

    # 정상 로그인
    record_successful_login(username, ip)
    return LoginResult.success(create_session(user))
```

## 비밀번호 재사용 감지

자신의 서비스 내 비밀번호 이력을 확인해 재사용을 차단하는 것도 중요하다.

```python
import bcrypt

def is_password_reused(user_id: int, new_password: str, history_count: int = 5) -> bool:
    """최근 N개 비밀번호와 동일하면 재사용으로 판단"""
    history = get_password_history(user_id, limit=history_count)
    return any(
        bcrypt.checkpw(new_password.encode(), old_hash.encode())
        for old_hash in history
    )
```

## 로그인 이상 모니터링

```python
# 계정별 이상 로그인 알림
def check_anomaly_and_alert(user, ip, user_agent):
    last_login = get_last_login(user.id)
    if last_login:
        # 지리적으로 불가능한 이동 감지
        if is_impossible_travel(last_login.ip, ip, last_login.timestamp):
            send_security_alert(user.email, "불가능한 위치에서 로그인 감지")
            block_session_and_require_reverification(user.id)
```

크리덴셜 스터핑 방어의 핵심은 **비밀번호 재사용을 제거하고, 봇 자동화를 방해하고, 이상 행동을 실시간으로 탐지**하는 것이다. 다음 글에서는 OWASP Top 10의 전체 목록을 살펴보며 웹 보안의 가장 중요한 취약점들을 개관한다.

---

**지난 글:** [ABAC: 속성 기반 접근 제어의 원리와 구현](/posts/websec-abac/)

**다음 글:** [OWASP Top 10: 가장 위험한 웹 취약점 개관](/posts/websec-owasp-top10-overview/)

<br>
읽어주셔서 감사합니다. 😊
