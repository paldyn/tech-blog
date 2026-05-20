---
title: "hashlib: 해시 함수와 암호화 기초"
description: "Python hashlib 모듈로 SHA-256, Blake2b 등 해시 함수를 사용하는 방법을 정리합니다. update/hexdigest/digest, 알고리즘별 특성 비교, 파일 체크섬, HMAC, hashlib.scrypt, 비밀번호 저장 주의사항까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 10
type: "knowledge"
category: "Python"
tags: ["Python", "hashlib", "해시", "SHA256", "HMAC", "체크섬", "암호화", "표준라이브러리"]
featured: false
draft: false
---

[지난 글](/posts/python-uuid/)에서 UUID로 유일 식별자를 생성하는 방법을 살펴봤습니다. 이번 글에서는 파일 무결성 검증, API 서명, 데이터 지문(fingerprint) 생성 등에 쓰이는 `hashlib` 모듈을 다룹니다. 해시 함수의 원리를 이해하고, 상황에 맞는 알고리즘을 고르는 방법을 정리합니다.

## hashlib 기본 사용

```python
import hashlib

# SHA-256 해시 생성
h = hashlib.sha256()
h.update(b'hello')
h.update(b' world')   # 청크별 업데이트
print(h.hexdigest())  # 64자 hex 문자열
print(h.digest())     # 32바이트 bytes
print(h.digest_size)  # 32

# 한 번에 처리
result = hashlib.sha256(b'hello world').hexdigest()
```

**주의**: `update()`는 문자열이 아닌 **bytes**를 받습니다. 문자열이면 `.encode('utf-8')`로 변환하세요.

```python
text = "안녕하세요"
digest = hashlib.sha256(text.encode('utf-8')).hexdigest()
```

![hashlib 알고리즘 비교](/assets/posts/python-hashlib-overview.svg)

## 주요 알고리즘

```python
import hashlib

# MD5 — 무결성 체크섬용 (보안 목적 사용 금지)
hashlib.md5(b'data').hexdigest()

# SHA-1 — 레거시 (Git에서 사용)
hashlib.sha1(b'data').hexdigest()

# SHA-256 — 범용 보안 해시 (권장)
hashlib.sha256(b'data').hexdigest()

# SHA-512 — 더 긴 다이제스트
hashlib.sha512(b'data').hexdigest()

# Blake2b — 빠르고 안전, Python 공식 권장
hashlib.blake2b(b'data', digest_size=32).hexdigest()
hashlib.blake2s(b'data', digest_size=16).hexdigest()  # 32비트 플랫폼 최적화

# 사용 가능한 알고리즘 확인
print(hashlib.algorithms_available)    # 플랫폼 의존
print(hashlib.algorithms_guaranteed)   # 모든 플랫폼에서 보장
```

## usedforsecurity 옵션 (Python 3.9+)

FIPS 모드 환경에서 MD5/SHA-1을 보안 목적이 아닌 용도(체크섬, 해시 테이블 등)로 쓸 때 필요합니다.

```python
# FIPS 모드에서도 동작
h = hashlib.md5(usedforsecurity=False)
```

## 대용량 파일 해시

파일 전체를 한 번에 메모리에 올리지 않고 청크 단위로 해시합니다.

```python
import hashlib

def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        while chunk := f.read(65536):   # 64KB 청크
            h.update(chunk)
    return h.hexdigest()

checksum = sha256_file('large_file.iso')
print(f"SHA-256: {checksum}")
```

다운로드한 파일의 무결성을 공식 체크섬과 비교할 때 쓰는 패턴입니다.

![hashlib 코드 예제](/assets/posts/python-hashlib-code.svg)

## HMAC — 메시지 인증 코드

HMAC(Hash-based Message Authentication Code)는 공유 비밀 키와 해시를 결합해 메시지 위변조를 감지합니다. API 웹훅 서명 검증에 자주 씁니다.

```python
import hmac
import hashlib

key = b'shared-secret-key'
message = b'{"event": "payment", "amount": 9900}'

# 서명 생성
signature = hmac.new(key, message, hashlib.sha256).hexdigest()

# 서명 검증 (타이밍 안전 비교 — 반드시 compare_digest 사용)
expected = '...'   # 수신된 서명
is_valid = hmac.compare_digest(signature, expected)
```

**`==` 대신 `hmac.compare_digest()`를 반드시 사용하세요.** 일반 `==`는 앞 글자부터 비교해 불일치하는 순간 반환하므로 타이밍 공격에 취약합니다. `compare_digest()`는 항상 전체 길이를 비교합니다.

## 키 유도 함수 — hashlib.scrypt

`hashlib.scrypt()`는 비밀번호를 안전하게 해싱하는 키 유도 함수입니다. 메모리 집약적으로 설계되어 브루트 포스 공격에 강합니다.

```python
import hashlib
import os

password = "my_password".encode('utf-8')
salt = os.urandom(16)   # 랜덤 솔트 생성

key = hashlib.scrypt(
    password,
    salt=salt,
    n=16384,    # CPU/메모리 비용 (2의 거듭제곱)
    r=8,        # 블록 크기
    p=1,        # 병렬화 인수
    dklen=32    # 출력 길이
)

# salt와 key를 함께 저장해야 나중에 검증 가능
stored = salt + key
```

**비밀번호 저장의 올바른 방법**: 일반 해시 함수(SHA-256 등)는 절대 사용하지 마세요. `bcrypt`, `argon2`, `hashlib.scrypt` 중 하나를 선택합니다.

## 콘텐츠 주소 저장소 패턴

해시를 파일명이나 키로 사용해 같은 내용의 파일을 한 번만 저장합니다.

```python
import hashlib
from pathlib import Path

def content_address_store(data: bytes, store_dir: str = 'store') -> str:
    digest = hashlib.sha256(data).hexdigest()
    path = Path(store_dir) / digest[:2] / digest[2:]
    path.parent.mkdir(parents=True, exist_ok=True)
    
    if not path.exists():
        path.write_bytes(data)
    
    return digest

# 같은 내용이면 같은 해시 → 중복 저장 없음
sha1 = content_address_store(b'hello world')
sha2 = content_address_store(b'hello world')
assert sha1 == sha2
```

Git의 오브젝트 저장소가 이 방식으로 동작합니다.

## hashlib.new로 동적 알고리즘 선택

```python
import hashlib

def hash_data(data: bytes, algorithm: str = 'sha256') -> str:
    h = hashlib.new(algorithm, data)
    return h.hexdigest()

hash_data(b'test', 'sha256')
hash_data(b'test', 'blake2b')
hash_data(b'test', 'md5')   # 체크섬 목적
```

알고리즘 이름이 유효하지 않으면 `ValueError`가 발생합니다.

---

**지난 글:** [uuid: 유일 식별자 생성](/posts/python-uuid/)

**다음 글:** [파일 열기 모드: open() 완전 정리](/posts/python-open-modes/)

<br>
읽어주셔서 감사합니다. 😊
