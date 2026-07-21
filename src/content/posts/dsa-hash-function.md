---
title: "해시 함수 (Hash Function)"
description: "좋은 해시 함수의 조건, 다항식 해싱, 암호학적 해시(SHA-256)와 비암호학적 해시(MurmurHash)의 차이, Python hash() 내부 동작을 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 10
type: "knowledge"
category: "Algorithm"
tags: ["해시함수", "hash function", "SipHash", "MurmurHash", "SHA-256"]
featured: false
draft: false
---

[지난 글](/posts/dsa-hash-table/)에서 해시 테이블의 구조와 충돌 해결 전략을 다뤘습니다. 이번에는 해시 테이블의 성능을 결정하는 핵심 부품인 **해시 함수(Hash Function)**를 깊이 살펴봅니다. 해시 함수가 어떤 조건을 갖춰야 하는지, 문자열 해싱은 어떻게 동작하는지, 그리고 Python이 왜 SipHash를 사용하는지 이해하면 해시 테이블 관련 성능 이슈를 훨씬 명확하게 파악할 수 있습니다.

## 해시 함수의 역할

해시 함수 h는 임의 크기의 데이터(키)를 고정 크기 정수(해시값)로 변환합니다.

```text
h: key → integer
```

해시 테이블에서는 `인덱스 = h(key) % capacity`로 저장 위치를 결정합니다.

## 좋은 해시 함수의 조건

![좋은 해시 함수의 조건](/assets/posts/dsa-hash-function-properties.svg)

1. **결정론적**: 같은 입력은 항상 같은 출력
2. **균등 분포**: 해시값이 버킷에 고르게 분포해 충돌 최소화
3. **빠른 계산**: 해시 계산 자체가 병목이 되면 안 됨
4. **눈사태 효과**: 입력 1비트 변화로 출력 비트의 ~50%가 변해야 유사한 키의 충돌 방지

## 문자열 해시 함수 — 다항식 해싱

가장 흔한 방법입니다. 각 문자의 ASCII 값에 가중치를 곱해 합산합니다.

![다항식 해싱](/assets/posts/dsa-hash-function-poly.svg)

```python
def poly_hash(s: str, p: int = 31, M: int = 10**9 + 7) -> int:
    """호너의 방법으로 O(n) 다항식 해싱"""
    h = 0
    for c in s:
        h = (h * p + ord(c)) % M
    return h

print(poly_hash("hello"))   # 안정적인 정수
print(poly_hash("hellp"))   # 완전히 다른 값 (눈사태 효과)
```

### 소수 p의 선택

- 소수를 사용하면 해시값이 더 고르게 분포됩니다.
- `p = 31`: 소문자 영문자 (26개)보다 큰 소수
- `p = 53`: 대소문자 영문자 (52개)보다 큰 소수

### 롤링 해시 (Rolling Hash)

슬라이딩 윈도우에서 창을 한 칸 이동할 때 O(1)에 해시를 재계산합니다.

```python
def rolling_hash(s: str, k: int, p: int = 31, M: int = 10**9 + 7):
    """길이 k의 윈도우를 이동하며 해시값 생성"""
    h = 0
    p_k = pow(p, k, M)   # p^k mod M

    # 첫 번째 창
    for c in s[:k]:
        h = (h * p + ord(c)) % M
    yield h

    for i in range(k, len(s)):
        # 새 문자 추가, 오래된 문자 제거
        h = (h * p - ord(s[i - k]) * p_k + ord(s[i])) % M
        yield h
```

## 비암호학적 해시 함수

빠른 속도가 목적이며 보안이 필요 없는 경우에 사용합니다.

### FNV-1a

```python
def fnv1a_32(data: bytes) -> int:
    FNV_PRIME = 0x01000193
    FNV_OFFSET = 0x811c9dc5
    h = FNV_OFFSET
    for byte in data:
        h ^= byte
        h = (h * FNV_PRIME) & 0xFFFFFFFF
    return h

print(fnv1a_32(b"hello"))  # 0x4f9f2cab
```

### MurmurHash3 (개념)

```python
# 실제 사용 시 mmh3 라이브러리 활용
import mmh3
print(mmh3.hash("hello", seed=42))   # 빠른 128-bit 해시
```

## 암호학적 해시 함수

**역산 불가능**, **충돌 저항**이 핵심입니다. 보안 목적(패스워드, 전자서명, 무결성 검증)에 사용합니다.

```python
import hashlib

# SHA-256 — 256비트 해시
sha = hashlib.sha256(b"hello").hexdigest()
print(sha)  # 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824

# bcrypt — 패스워드 해싱 (해시 시간을 의도적으로 느리게)
import bcrypt
pw = b"my_secret_password"
hashed = bcrypt.hashpw(pw, bcrypt.gensalt(rounds=12))
print(bcrypt.checkpw(pw, hashed))   # True
```

## Python hash()와 HashDoS 방어

Python 3.3+에서 `hash()`는 **SipHash-1-3**을 사용합니다.

```python
# PYTHONHASHSEED: 프로세스마다 다른 랜덤 시드 (기본값 = 무작위)
# 같은 키도 실행마다 해시값이 다름 → HashDoS 공격 방어
print(hash("hello"))   # 실행마다 다름

# 불변 타입만 해시 가능
print(hash(42))        # 42 (정수 해시 = 값 자체)
print(hash(3.14))      # 고정값
print(hash((1, 2)))    # 튜플 해시
# hash([1, 2])         # TypeError — 가변 타입 불가
```

**HashDoS 공격**: 해시 함수가 고정 시드라면 공격자가 의도적으로 같은 버킷에 충돌하는 키를 대량 삽입해 O(1) 해시 테이블을 O(n²)으로 만들 수 있습니다. 무작위 시드가 이를 방어합니다.

## 커스텀 객체의 해시

Python에서 커스텀 클래스를 dict 키로 사용하려면 `__hash__`와 `__eq__`를 함께 정의해야 합니다.

```python
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __eq__(self, other):
        return self.x == other.x and self.y == other.y

    def __hash__(self):
        # 불변 값의 튜플로 해시 위임 — 안전하고 간단
        return hash((self.x, self.y))

p1 = Point(1, 2)
p2 = Point(1, 2)
print(p1 == p2)              # True
print(hash(p1) == hash(p2))  # True (같은 해시값)

d = {p1: "origin"}
print(d[p2])                  # "origin" — 동일 키로 인식
```

## 정리

- 좋은 해시 함수는 결정론적, 균등 분포, 빠른 계산, 눈사태 효과를 갖춰야 합니다.
- 문자열 해싱에는 다항식 해싱(p=31, M=10⁹+7)이 실용적입니다.
- 보안 목적에는 SHA-256 등 암호학적 해시, 성능 목적에는 MurmurHash/FNV를 사용합니다.
- Python `hash()`는 SipHash로 HashDoS를 방어하며, 가변 타입은 해시 불가입니다.

---

**지난 글:** [해시 테이블](/posts/dsa-hash-table/)

**다음 글:** [충돌 해결 — 분리 체이닝 (Collision Resolution: Separate Chaining)](/posts/dsa-collision-resolution/)

<br>
읽어주셔서 감사합니다. 😊
