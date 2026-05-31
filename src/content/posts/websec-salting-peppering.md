---
title: "솔트와 페퍼로 해시 강화하기"
description: "솔트(Salt)와 페퍼(Pepper)가 무엇인지, 왜 필요한지, bcrypt·argon2에서 솔트를 처리하는 방식과 페퍼를 추가로 적용하는 구현 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 10
type: "knowledge"
category: "Security"
tags: ["솔트", "페퍼", "Salt", "Pepper", "비밀번호보안", "레인보우테이블"]
featured: false
draft: false
---

[지난 글](/posts/websec-password-hashing/)에서 bcrypt와 Argon2가 왜 비밀번호 해싱에 적합한지 살펴봤다. 이번 글에서는 그 해시를 더욱 강화하는 두 기법, **솔트(Salt)**와 **페퍼(Pepper)**를 다룬다. 솔트는 bcrypt·Argon2에 이미 내장돼 있지만 그 원리를 이해해야 하고, 페퍼는 추가적인 방어 계층을 제공한다.

## 솔트가 없으면 무슨 일이 생기는가

2012년 LinkedIn 유출 사건을 살펴보자. 약 1억 7천만 개의 계정이 노출됐는데, 솔트 없이 SHA-1로 해싱된 비밀번호였다. 유출 후 며칠 만에 수천만 개의 비밀번호가 크랙됐다. 이유는 두 가지다.

**레인보우 테이블**: 흔한 비밀번호의 해시를 미리 계산해둔 테이블. `sha1("password") = 5baa61e...`를 미리 알고 있으면 DB에서 같은 해시를 즉시 역산할 수 있다.

**중복 해시 문제**: 100만 사용자 중 "password123"을 쓰는 사람이 1만 명이라면, 해시도 동일하게 1만 개가 있다. 하나를 크랙하면 1만 명의 비밀번호를 한 번에 알 수 있다.

솔트는 이 두 가지를 모두 해결한다.

## 솔트란

솔트는 각 비밀번호에 더해지는 **랜덤한 값**이다. 같은 비밀번호라도 솔트가 다르면 완전히 다른 해시가 만들어진다.

```python
import hashlib, secrets

# 솔트 없음: 같은 비밀번호 = 같은 해시 (위험)
pw = "password123"
h1 = hashlib.sha256(pw.encode()).hexdigest()
h2 = hashlib.sha256(pw.encode()).hexdigest()
assert h1 == h2  # 동일 → 레인보우 테이블 공격 가능

# 솔트 있음: 같은 비밀번호라도 다른 해시
salt1 = secrets.token_hex(16)
salt2 = secrets.token_hex(16)
h1 = hashlib.sha256((salt1 + pw).encode()).hexdigest()
h2 = hashlib.sha256((salt2 + pw).encode()).hexdigest()
assert h1 != h2  # 다름 → 레인보우 테이블 무력화

# 하지만 SHA-256 + 솔트도 충분하지 않다!
# 솔트는 DB에 함께 저장되므로 유출 시 공격자가 알 수 있다.
# 여전히 빠른 해시이므로 개인별 브루트 포스 가능.
# → bcrypt/Argon2의 느린 해시가 필요한 이유
```

**bcrypt와 Argon2는 솔트를 자동으로 생성하고 해시에 내장한다.** 개발자가 별도로 솔트를 관리할 필요가 없다. `$2b$12$xK9mP2qR...`에서 `xK9mP2qR`이 솔트다. 검증 시 해시에서 솔트를 추출해 자동으로 사용한다.

![솔트와 페퍼 메커니즘](/assets/posts/websec-salting-peppering-diagram.svg)

## 페퍼란

솔트가 DB에 저장된다면, DB가 유출됐을 때 솔트도 노출된다. 이 경우 공격자는 솔트를 알고 있는 상태에서 개별 계정을 brute-force할 수 있다. bcrypt/Argon2의 느린 속도 덕분에 매우 어렵지만, 충분한 자원이 있는 공격자에게는 가능하다.

**페퍼(Pepper)**는 이에 대한 추가 방어다. DB가 아닌 **환경변수나 시크릿 관리 시스템**에 저장되는 서버 측 비밀 값이다. 페퍼 없이는 올바른 해시를 계산할 수 없으므로, DB만 유출된 경우 크랙이 불가능해진다.

```python
import os
# 페퍼는 반드시 환경변수에서, 애플리케이션 시작 시 로드
# 절대로 코드에 하드코딩하거나 DB에 저장하지 않는다
PEPPER = os.environ["APP_PEPPER"]  # 최소 32바이트 랜덤 값
```

솔트와 페퍼의 핵심 차이를 정리하면 이렇다.

| 구분 | 솔트 | 페퍼 |
|------|------|------|
| 저장 위치 | DB (해시에 포함) | 환경변수 / HSM |
| 사용자별 고유 | O | X (전역 공유) |
| 방어 대상 | 레인보우 테이블, 중복 해시 | DB 단독 유출 시 크랙 |
| bcrypt/argon2 기본 제공 | O | X (직접 구현) |

![솔트 + 페퍼 완전 구현 코드](/assets/posts/websec-salting-peppering-code.svg)

## 페퍼 구현의 실제

페퍼를 적용하는 방법은 단순 문자열 연결보다 HMAC을 사용하는 것이 더 안전하다. 단순 연결(`password + pepper`)은 길이 확장 공격에 취약할 수 있다.

```python
import os, hmac, hashlib
from argon2 import PasswordHasher, exceptions

PEPPER = os.environ["APP_PEPPER"].encode()
ph = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)

def _peppered(password: str) -> str:
    """비밀번호에 페퍼를 HMAC-SHA256으로 적용"""
    return hmac.new(PEPPER, password.encode(), hashlib.sha256).hexdigest()

def hash_password(password: str) -> str:
    """저장용 해시 생성 (솔트는 argon2가 자동 처리)"""
    if not 8 <= len(password) <= 256:
        raise ValueError("비밀번호 길이 오류")
    return ph.hash(_peppered(password))

def verify_password(stored_hash: str, password: str) -> bool:
    """로그인 시 검증"""
    try:
        ph.verify(stored_hash, _peppered(password))
        return True
    except exceptions.VerifyMismatchError:
        return False

# 페퍼 교체 시: 모든 사용자의 다음 로그인 시 자동 재해싱
# 구버전 페퍼와 새 페퍼를 동시에 유지하다가 이전
```

## 페퍼 교체 전략

페퍼가 유출됐거나 정기 교체가 필요할 때 전략이 필요하다.

1. 새 페퍼를 환경변수에 추가 (기존 페퍼는 `OLD_PEPPER`로 유지)
2. 로그인 성공 시 새 페퍼로 재해싱해 저장
3. 모든 사용자가 로그인하면 구 페퍼 제거

모든 사용자가 로그인하지 않을 가능성이 있다면, 배치 작업으로 구 페퍼로 검증 후 새 페퍼로 재해싱하는 방법도 있다.

## 정리: 비밀번호 저장 최선 사례

1. **Argon2id** (또는 bcrypt rounds≥12) 사용
2. 솔트는 bcrypt/Argon2가 자동 처리 — 직접 관리 불필요
3. 페퍼를 추가해 DB 유출 시 2차 방어
4. 비밀번호 최대 길이 256자 제한 (DoS 방지)
5. 로그인 시 rehash 필요 여부 확인 (파라미터 자동 업그레이드)

---

**지난 글:** [비밀번호 해싱(bcrypt·argon2)](/posts/websec-password-hashing/)

<br>
읽어주셔서 감사합니다. 😊
