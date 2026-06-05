---
title: "bcrypt로 비밀번호 안전하게 저장하기"
description: "비밀번호를 평문이나 단순 해시로 저장하면 안 되는 이유부터, salt와 work factor로 무차별 대입을 막는 bcrypt의 원리와 올바른 사용법까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 2
type: "knowledge"
category: "Python"
tags: ["bcrypt", "비밀번호", "해싱", "보안", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-secrets-vs-random/)에서 안전한 토큰을 만드는 법을 봤다면, 이번에는 그렇게 다루는 비밀번호를 데이터베이스에 어떻게 저장해야 하는지 살펴본다. 결론부터 말하면, 비밀번호는 **절대 원래 값으로 복원할 수 없는 형태**로 저장해야 한다. 데이터베이스가 유출되더라도 비밀번호 자체는 지켜져야 하기 때문이다.

## 왜 평문도, 단순 해시도 안 되는가

평문 저장이 위험하다는 건 직관적이다. DB가 한 번 유출되면 모든 사용자의 비밀번호가 그대로 노출된다. 그렇다고 `hashlib.sha256(password)` 같은 일반 해시로 저장하는 것도 충분하지 않다. 두 가지 이유 때문이다.

첫째, SHA-256 같은 범용 해시는 **너무 빠르다**. 빠르다는 건 공격자도 초당 수십억 개의 후보를 해시해 비교할 수 있다는 뜻이다. 비밀번호처럼 엔트로피가 낮은 값에는 이 속도가 곧 위협이 된다. 둘째, salt가 없으면 같은 비밀번호는 항상 같은 해시가 되어, 미리 계산해 둔 **레인보우 테이블**로 단번에 역추적된다.

![비밀번호 해싱 흐름](/assets/posts/python-bcrypt-passwords-flow.svg)

## bcrypt가 푸는 두 가지 문제

bcrypt는 비밀번호 저장을 위해 설계된 해시 함수로, 위 두 문제를 정면으로 해결한다.

먼저 **salt**를 자동으로 생성해 해시에 포함시킨다. 같은 비밀번호라도 사용자마다 다른 salt가 붙으므로 해시 결과가 전부 달라지고, 레인보우 테이블이 통하지 않는다. 다음으로 **work factor**(cost factor)라는 조절 가능한 비용을 둔다. 이 값을 1 올릴 때마다 해싱에 드는 연산이 2배가 된다. 즉 의도적으로 "느린" 해시다. 정상적인 로그인 1회에는 수십~수백 밀리초로 무시할 만하지만, 수십억 개를 시도하려는 공격자에게는 감당할 수 없는 비용이 된다.

![bcrypt 해시 문자열 구조](/assets/posts/python-bcrypt-passwords-anatomy.svg)

위 그림처럼 bcrypt가 만든 한 줄의 문자열 안에 알고리즘 버전, cost factor, salt, 해시값이 모두 담긴다. 그래서 별도로 salt를 보관할 필요가 없다 — 검증할 때 이 문자열에서 알아서 꺼내 쓴다.

## 실제 사용법

파이썬에서는 `bcrypt` 라이브러리(또는 `passlib`)를 쓴다. bcrypt는 바이트를 다루므로 비밀번호를 인코딩해서 넘긴다.

```python
import bcrypt

# 회원가입 — 해시 생성 (salt는 자동 포함)
def hash_password(plain: str) -> bytes:
    return bcrypt.hashpw(plain.encode("utf-8"),
                         bcrypt.gensalt(rounds=12))

# 로그인 — 입력값을 저장된 해시와 대조
def verify_password(plain: str, hashed: bytes) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed)

stored = hash_password("hunter2")
print(verify_password("hunter2", stored))   # True
print(verify_password("wrong", stored))     # False
```

핵심은 `checkpw`다. 저장된 해시 문자열에서 salt와 cost를 읽어 입력 비밀번호를 같은 방식으로 해시한 뒤, 상수 시간으로 비교해 준다. 우리가 salt를 직접 관리할 필요가 전혀 없다.

## 실무에서 주의할 점

몇 가지 함정이 있다. 첫째, bcrypt는 입력의 **앞 72바이트만** 사용한다. 그보다 긴 비밀번호의 뒷부분은 무시되므로, 매우 긴 입력을 받는다면 미리 SHA-256으로 한 번 줄여 넣는 등의 처리가 필요하다. 둘째, `rounds`(cost) 값은 하드웨어가 빨라질수록 올려야 한다. 보통 10~12에서 시작해, 로그인 처리 시간이 너무 길어지지 않는 선에서 가장 높게 잡는다.

```python
# 비용을 한 곳에서 관리하고, 주기적으로 상향
BCRYPT_ROUNDS = 12

def needs_rehash(hashed: bytes) -> bool:
    # 저장된 해시의 cost가 현재 정책보다 낮으면 재해싱 대상
    cost = int(hashed.split(b"$")[2])
    return cost < BCRYPT_ROUNDS
```

로그인에 성공했을 때 `needs_rehash`로 확인해, 오래된 cost로 저장된 비밀번호를 그 자리에서 더 강한 해시로 갱신하는 패턴을 함께 쓰면 보안 수준을 점진적으로 높일 수 있다.

정리하면, 비밀번호는 bcrypt(또는 argon2, scrypt 같은 동급의 알고리즘)로 salt와 함께 느리게 해시해 저장하고, 검증은 라이브러리가 제공하는 `checkpw`에 맡긴다. 직접 해시를 조립하거나 salt를 관리하려 들지 않는 것이 가장 안전한 길이다. 다음 글에서는 데이터를 다룰 때의 또 다른 위험 — `pickle`의 보안 문제를 들여다본다.

---

**지난 글:** [secrets vs random: 보안에 안전한 난수 만들기](/posts/python-secrets-vs-random/)

**다음 글:** [pickle의 보안 위험](/posts/python-pickle-security/)

<br>
읽어주셔서 감사합니다. 😊
