---
title: "uuid: 유일 식별자 생성"
description: "Python uuid 모듈의 UUID 버전별 특성과 사용법을 정리합니다. uuid1/uuid3/uuid4/uuid5의 차이, UUID 객체 속성(hex/bytes/int), 이름 기반 UUID, 데이터베이스 기본 키 패턴, 보안 고려사항을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 9
type: "knowledge"
category: "Python"
tags: ["Python", "uuid", "UUID", "식별자", "데이터베이스", "보안", "표준라이브러리"]
featured: false
draft: false
---

[지난 글](/posts/python-sqlite3/)에서 `sqlite3`로 관계형 데이터를 다뤘습니다. 이번 글에서는 데이터베이스 기본 키, 세션 토큰, 멱등 키 등 다양한 곳에서 쓰이는 UUID를 생성하는 `uuid` 모듈을 정리합니다. UUID는 128비트의 숫자로, 중앙 조율 없이도 전 세계적으로 유일한 식별자를 만들 수 있습니다.

## UUID란?

UUID(Universally Unique Identifier)는 RFC 4122로 표준화된 128비트 식별자입니다. 32개의 16진수 숫자와 4개의 하이픈으로 구성됩니다.

```
550e8400-e29b-41d4-a716-446655440000
```

2^128가지(약 3.4 × 10^38)의 가능한 값이 있어, 초당 10억 개를 생성해도 충돌까지 수십억 년이 걸립니다.

![UUID 버전별 특성](/assets/posts/python-uuid-overview.svg)

## UUID 버전별 생성 방법

### UUID v4 — 완전 랜덤 (가장 많이 사용)

```python
import uuid

uid = uuid.uuid4()
print(uid)           # 550e8400-e29b-41d4-a716-446655440000 (매번 다름)
print(str(uid))      # UUID → str 변환
print(uid.hex)       # 하이픈 없는 hex 문자열
print(uid.bytes)     # 16바이트 bytes 객체
print(uid.int)       # 128비트 정수
print(uid.version)   # 4
```

v4는 암호학적으로 안전한 랜덤 값으로 생성됩니다.

### UUID v1 — 타임스탬프 기반

```python
uid1 = uuid.uuid1()
print(uid1.time)   # 100나노초 단위 타임스탬프
print(uid1.node)   # MAC 주소 (48비트)
```

v1은 생성 시각 순으로 정렬 가능하지만 **MAC 주소가 노출**되어 개인정보 문제가 있습니다. 시간순 정렬이 필요하다면 Python 3.14+의 `uuid7()`를 사용하거나, `ulid-py` 같은 라이브러리를 쓰세요.

### UUID v3, v5 — 이름 기반 (재현 가능)

같은 입력에서 항상 같은 UUID를 생성합니다. v3는 MD5, v5는 SHA-1을 사용합니다.

```python
import uuid

# 미리 정의된 namespace 상수
ns = uuid.NAMESPACE_URL
ns_dns = uuid.NAMESPACE_DNS
ns_oid = uuid.NAMESPACE_OID

# v5 (SHA-1, 권장)
uid_a = uuid.uuid5(ns, 'https://paldyn.com')
uid_b = uuid.uuid5(ns, 'https://paldyn.com')
print(uid_a == uid_b)   # True — 항상 동일

# v3 (MD5, 하위호환용)
uid_c = uuid.uuid3(ns, 'https://paldyn.com')
```

같은 리소스에 항상 동일한 ID를 부여하거나, URL을 고정 UUID로 매핑할 때 유용합니다.

![uuid 코드 예제](/assets/posts/python-uuid-code.svg)

## UUID 객체 파싱

```python
import uuid

# 문자열 → UUID 객체
uid = uuid.UUID('550e8400-e29b-41d4-a716-446655440000')
print(uid.version)   # 4 (자동 감지)

# hex 문자열 (하이픈 없음)
uid2 = uuid.UUID('550e8400e29b41d4a716446655440000')

# bytes에서 생성
uid3 = uuid.UUID(bytes=b'\x55\x0e...')

# 잘못된 형식 → ValueError
try:
    uuid.UUID('not-a-uuid')
except ValueError as e:
    print(e)
```

## 데이터베이스 기본 키로 사용

```python
import uuid
from dataclasses import dataclass, field

@dataclass
class Order:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    product: str = ''
    quantity: int = 0

order1 = Order(product='노트북', quantity=1)
order2 = Order(product='마우스', quantity=2)
print(order1.id)   # '6ba7b810-9dad-...'
print(order2.id)   # '6ba7b811-9dad-...'
```

PostgreSQL, MySQL에는 UUID 전용 컬럼 타입이 있습니다. SQLite에서는 TEXT로 저장합니다.

## 멱등(idempotent) 키 패턴

같은 요청이 반복되더라도 한 번만 처리되도록 할 때 UUID를 요청 키로 씁니다.

```python
import uuid
import requests

idempotency_key = str(uuid.uuid4())

response = requests.post(
    'https://api.payment.example/charge',
    json={'amount': 9900, 'currency': 'KRW'},
    headers={'Idempotency-Key': idempotency_key},
)
```

네트워크 오류로 재요청해도 서버는 같은 키를 가진 요청을 중복 처리하지 않습니다.

## 보안 고려사항

- **UUID v4 사용 권장**: v1은 MAC 주소가 포함되어 서버 정보가 노출됩니다.
- **예측 불가**: `uuid4()`는 `os.urandom()`을 기반으로 암호학적으로 안전합니다.
- **비밀번호 초기화 토큰**: UUID를 그대로 쓰지 말고 `secrets.token_urlsafe()`를 씁니다. UUID는 보안 토큰이 아닌 식별자 용도입니다.

```python
import secrets

# 보안 토큰 (더 안전)
token = secrets.token_urlsafe(32)

# 식별자
identifier = str(uuid.uuid4())
```

---

**지난 글:** [sqlite3: 내장 관계형 데이터베이스](/posts/python-sqlite3/)

**다음 글:** [hashlib: 해시 함수와 암호화 기초](/posts/python-hashlib/)

<br>
읽어주셔서 감사합니다. 😊
