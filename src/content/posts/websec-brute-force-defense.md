---
title: "무차별 대입 공격 방어 전략"
description: "브루트 포스 공격의 유형과 방어 기법을 심층 분석합니다. 속도 제한, 계정 잠금, 지수 백오프, CAPTCHA, 타이밍 공격 방지까지 Redis 기반 실전 구현 코드를 포함합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 6
type: "knowledge"
category: "Security"
tags: ["브루트포스", "BruteForce", "속도제한", "RateLimiting", "계정잠금"]
featured: false
draft: false
---

[지난 글](/posts/websec-password-policies/)에서 강력한 비밀번호 정책을 설계하는 방법을 알아봤다. 하지만 강한 비밀번호를 요구해도 공격자가 자동화 도구로 수천만 번 시도한다면 언젠가는 맞출 수 있다. **무차별 대입 공격(Brute Force Attack)**에 대한 서버 측 방어가 반드시 필요하다.

## 무차별 대입 공격의 종류

- **딕셔너리 공격**: 유출된 비밀번호 목록, 예측 가능한 패턴을 먼저 시도
- **크리덴셜 스터핑**: 다른 사이트에서 유출된 아이디/비밀번호 쌍을 그대로 시도
- **패스워드 스프레이**: 적은 수의 비밀번호를 많은 계정에 시도 (계정 잠금 우회)

![무차별 대입 공격 흐름과 방어 지점](/assets/posts/websec-brute-force-defense-flow.svg)

## 핵심 방어 기법

### 속도 제한과 지수 백오프

```python
import redis.asyncio as redis

async def check_rate_limit(key: str, max_attempts: int = 5):
    r = redis.Redis()
    attempts = await r.incr(key)
    if attempts == 1:
        await r.expire(key, 3600)  # 1시간 TTL
    if attempts > max_attempts:
        wait = min(2 ** (attempts - max_attempts), 3600)
        raise RateLimitError(wait)
```

### IP + 계정 양쪽 제한

```python
async def login_rate_limit(ip: str, username: str):
    r = redis.Redis()
    ip_key = f"ratelimit:ip:{ip}"
    ip_count = await r.incr(ip_key)
    if ip_count == 1:
        await r.expire(ip_key, 60)
    if ip_count > 10:
        raise Exception("IP rate limit exceeded")

    acct_key = f"ratelimit:acct:{username}"
    acct_count = await r.incr(acct_key)
    if acct_count == 1:
        await r.expire(acct_key, 300)
    if acct_count > 5:
        raise Exception("Account rate limit exceeded")
```

![무차별 대입 방어 코드 구현](/assets/posts/websec-brute-force-defense-code.svg)

## 타이밍 공격 방지와 오류 메시지

```python
import bcrypt

def safe_login(username: str, password: str) -> bool:
    user = db.get_user(username)
    # 사용자 없어도 동일 시간 소비 (타이밍 공격 방지)
    if user is None:
        bcrypt.checkpw(password.encode(), DUMMY_HASH)
        return False
    return bcrypt.checkpw(password.encode(), user.password_hash)

# 오류 메시지: 어느 쪽인지 알려주지 말 것
# "아이디 또는 비밀번호가 올바르지 않습니다" (O)
# "비밀번호가 틀렸습니다" (X)
```

MFA를 결합하면 크리덴셜 스터핑을 사실상 무력화할 수 있다.

---

**지난 글:** [강력한 비밀번호 정책 설계하기](/posts/websec-password-policies/)

**다음 글:** [세션 관리의 핵심 원칙](/posts/websec-session-management/)

<br>
읽어주셔서 감사합니다. 😊
