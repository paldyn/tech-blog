---
title: "비밀번호 해싱(bcrypt·argon2)"
description: "왜 비밀번호를 암호화가 아닌 해싱으로 저장해야 하는지, bcrypt와 Argon2id의 동작 원리와 파라미터 선택 기준, OWASP 권고사항을 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 9
type: "knowledge"
category: "Security"
tags: ["비밀번호해싱", "bcrypt", "argon2", "단방향해시", "비밀번호보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-authentication-vs-authorization/)에서 인증과 인가의 차이를 다뤘다. 인증의 핵심인 비밀번호를 어떻게 저장해야 안전한가? 이 질문의 답이 단순하지 않아서 지금도 수많은 서비스가 잘못된 방식으로 비밀번호를 저장하고 있다. 2019년 Facebook은 수억 개 계정의 비밀번호를 평문으로 저장했다는 사실이 밝혀졌다. 2016년 LinkedIn 유출에서는 솔트 없는 SHA-1로 저장된 비밀번호 1억 개가 며칠 만에 크랙됐다.

## 왜 해싱인가? 암호화가 아닌가?

비밀번호는 **복호화할 필요가 없다**. 로그인 시 필요한 것은 "입력한 비밀번호가 저장된 것과 같은가?"라는 비교뿐이다.

암호화(Encryption)는 복호화가 가능하다. DB가 유출되면 암호화 키도 언젠가 노출되고, 그 순간 모든 비밀번호가 드러난다.

해싱(Hashing)은 단방향이다. 해시에서 원본 비밀번호를 복원할 수 없다. 로그인 시 입력된 비밀번호를 같은 방식으로 해싱해 저장된 해시와 비교할 뿐이다.

```
비교:
암호화: password → AES → 저장 → (키로 복호화) → password  [위험]
해싱:   password → bcrypt → 저장                          [안전]
로그인 검증: bcrypt.verify(입력, 저장된_해시)
```

![비밀번호 저장 방식 비교](/assets/posts/websec-password-hashing-comparison.svg)

## 왜 MD5·SHA-256으로는 안 되는가

범용 해시 함수(MD5, SHA-1, SHA-256)는 **빠른 것이 목적**이다. SHA-256은 현대 GPU에서 초당 수십억 번 연산이 가능하다. 이것이 문제다.

공격자는 DB를 탈취하면 크랙 시도를 한다. 빠른 해시일수록 짧은 시간에 더 많은 비밀번호를 시도할 수 있다. SHA-256으로 해싱된 8자리 영숫자 비밀번호는 현대 하드웨어로 몇 시간 안에 크랙된다.

비밀번호 해싱 전용 함수는 **느린 것이 목적**이다. 합법적인 사용자의 로그인은 0.1~1초로 충분하지만, 공격자의 크랙 속도를 수천만 배 낮춘다.

```python
import hashlib
import time

# SHA-256: 빠름 = 위험
start = time.time()
for _ in range(1_000_000):
    hashlib.sha256(b"password123").hexdigest()
print(f"SHA-256: {time.time()-start:.2f}s per million")  # ~0.3초

# bcrypt: 느림 = 안전
import bcrypt
start = time.time()
bcrypt.hashpw(b"password123", bcrypt.gensalt(rounds=12))
print(f"bcrypt: {time.time()-start:.2f}s per one")  # ~0.25초

# 결론: bcrypt로 1회 = SHA-256으로 100만 번
```

## bcrypt 이해하기

bcrypt는 1999년 Blowfish 암호를 기반으로 설계된 비밀번호 해싱 함수다. 세 가지 특징이 있다.

**솔트 내장**: 각 해시에 랜덤 솔트가 자동으로 포함된다. 같은 비밀번호라도 다른 해시가 생성된다. 레인보우 테이블 공격을 무력화한다.

**cost factor (work factor)**: 연산 비용을 조절하는 파라미터다. `rounds=12`는 2^12번의 반복을 의미한다. 하드웨어가 빨라질수록 rounds를 올릴 수 있다.

**72바이트 제한**: bcrypt는 처음 72바이트만 처리한다. 72자를 초과하는 비밀번호는 72자에서 잘린다. 이를 우회하려면 SHA-512로 먼저 해싱 후 bcrypt를 적용하는 패턴을 쓰기도 하지만, 대부분의 서비스에서는 72자 제한을 그대로 유지하고 최대 길이를 72자로 설정한다.

![bcrypt와 Argon2 구현 코드](/assets/posts/websec-password-hashing-code.svg)

## Argon2id: 현대의 표준

Argon2는 2015년 Password Hashing Competition에서 우승한 알고리즘이다. OWASP는 2023년 기준 Argon2id를 1순위로 권고한다.

Argon2id는 세 파라미터로 동작한다.

**memory_cost (m)**: 메모리 사용량(KiB). 높을수록 GPU 병렬 공격이 어려워진다. OWASP 최소 19456 KiB (19 MiB).

**time_cost (t)**: 반복 횟수. 높을수록 연산 시간이 길어진다. 최소 2.

**parallelism (p)**: 병렬 스레드 수. 하드웨어에 맞게 조정한다.

```python
from argon2 import PasswordHasher, exceptions

# OWASP 권고 최소 파라미터
ph = PasswordHasher(
    time_cost=2,
    memory_cost=19456,  # 19 MiB
    parallelism=1,
    hash_len=32,
    salt_len=16,
)

def register_user(username: str, password: str):
    # 비밀번호 길이 검증 (너무 길면 DoS 가능)
    if len(password) > 256:
        raise ValueError("비밀번호는 256자 이하여야 합니다")
    hashed = ph.hash(password)
    db.save_user(username=username, password_hash=hashed)

def login_user(username: str, password: str) -> bool:
    user = db.get_user(username)
    if not user:
        # 타이밍 공격 방지: 사용자 존재 여부와 무관하게 동일한 시간 소비
        ph.hash("dummy")
        return False
    try:
        ph.verify(user.password_hash, password)
        # 파라미터 업그레이드 필요 여부 확인
        if ph.check_needs_rehash(user.password_hash):
            db.update_user(username, ph.hash(password))
        return True
    except exceptions.VerifyMismatchError:
        return False
```

## 실무 주의사항

**비밀번호 최대 길이 제한**: bcrypt의 72바이트 제한 외에도, 비밀번호가 매우 길면 해싱 자체가 DoS 벡터가 된다. 실제 공격 사례도 있다. 최대 256자 제한이 일반적으로 안전하다.

**cost factor 조정**: 서버 하드웨어가 개선될수록 cost를 높여야 한다. bcrypt rounds=10이 2010년에는 충분했지만 지금은 12~13을 권장한다.

**해시 재계산(rehash)**: 기존 사용자가 로그인할 때 파라미터가 구버전이면 자동으로 새 파라미터로 재해싱한다. argon2-cffi 라이브러리의 `check_needs_rehash()`가 이를 지원한다.

**타이밍 공격**: 사용자가 존재하지 않을 때와 비밀번호가 틀렸을 때의 응답 시간이 다르면 공격자가 사용자 열거에 활용할 수 있다. 위 코드처럼 더미 해싱으로 응답 시간을 맞춘다.

다음 글에서는 솔트와 페퍼를 추가해 해시 강도를 더 높이는 방법을 살펴본다.

---

**지난 글:** [인증과 인가의 차이](/posts/websec-authentication-vs-authorization/)

**다음 글:** [솔트와 페퍼로 해시 강화하기](/posts/websec-salting-peppering/)

<br>
읽어주셔서 감사합니다. 😊
