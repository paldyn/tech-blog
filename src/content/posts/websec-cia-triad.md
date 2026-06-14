---
title: "정보보안 3요소(CIA) 완전 이해"
description: "기밀성·무결성·가용성(CIA Triad)의 개념, 각 요소를 달성하는 기술, 그리고 세 요소 간 트레이드오프를 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 2
type: "knowledge"
category: "Security"
tags: ["CIA", "기밀성", "무결성", "가용성", "보안기초", "암호화"]
featured: false
draft: false
---

[지난 글](/posts/websec-what-is-web-security/)에서 웹 보안의 전체 그림을 살펴봤다. 이번 글에서는 보안의 모든 목표가 수렴하는 세 가지 핵심 속성, **CIA 3요소**를 깊이 파고든다. CIA는 Confidentiality(기밀성), Integrity(무결성), Availability(가용성)의 약자다. 어떤 보안 결정도 이 세 축을 기준으로 평가할 수 있다.

## 기밀성(Confidentiality)

기밀성은 **권한 있는 주체만 데이터에 접근할 수 있어야 한다**는 원칙이다. 침해가 발생하면 "이 데이터를 봐서는 안 되는 사람이 봤다"는 의미가 된다.

기밀성을 달성하는 주요 기술은 다음과 같다.

**암호화(Encryption)**: 데이터를 읽을 수 없는 형태로 변환한다. 전송 중 암호화는 TLS, 저장 시 암호화는 AES-256이 표준이다.

**접근 제어**: 역할 기반 접근 제어(RBAC)나 속성 기반 접근 제어(ABAC)로 "누가 무엇을 볼 수 있는가"를 명시적으로 정의한다.

**최소 권한 원칙(Principle of Least Privilege)**: 각 컴포넌트에 필요한 최소한의 권한만 부여한다. DB 읽기 전용 API는 쓰기 권한이 없어야 한다.

```python
# 기밀성: Fernet으로 민감 데이터 저장 암호화
from cryptography.fernet import Fernet
import os

class SecretStorage:
    def __init__(self):
        # 키는 환경 변수에서 로드, 코드에 하드코딩 금지
        self.cipher = Fernet(os.environ["ENCRYPTION_KEY"].encode())

    def save(self, plaintext: str) -> bytes:
        return self.cipher.encrypt(plaintext.encode())

    def load(self, token: bytes) -> str:
        return self.cipher.decrypt(token).decode()
```

기밀성 위반의 대표 사례는 평문 비밀번호 저장, HTTP로 결제 정보 전송, 과도한 권한을 가진 API 키다.

![CIA 3요소 전체 구조](/assets/posts/websec-cia-triad-diagram.svg)

## 무결성(Integrity)

무결성은 **데이터가 생성 이후 허가 없이 변조되지 않아야 한다**는 원칙이다. 침해가 발생하면 "데이터를 믿을 수 없다"는 의미가 된다.

무결성을 달성하는 기술은 다음과 같다.

**해시(Hash)**: SHA-256 같은 단방향 해시로 데이터의 지문을 만든다. 원본이 1비트라도 바뀌면 해시가 완전히 달라진다.

**HMAC(Hash-based Message Authentication Code)**: 비밀 키를 포함한 해시로 출처와 무결성을 동시에 검증한다. JWT 서명의 기반이다.

**전자 서명**: 비대칭 키로 생성. 공개 키로 검증할 수 있어 신원 증명까지 가능하다.

```python
import hmac
import hashlib
import secrets

def sign_message(message: bytes, key: bytes) -> str:
    """HMAC-SHA256으로 메시지 서명"""
    return hmac.new(key, message, hashlib.sha256).hexdigest()

def verify_message(message: bytes, key: bytes, signature: str) -> bool:
    """타이밍 공격에 안전한 서명 검증"""
    expected = sign_message(message, key)
    # hmac.compare_digest: 상수 시간 비교로 타이밍 공격 방지
    return hmac.compare_digest(expected, signature)

# 사용 예
key = secrets.token_bytes(32)
msg = b'{"user_id": 42, "role": "admin"}'
sig = sign_message(msg, key)
assert verify_message(msg, key, sig)     # True
assert not verify_message(b'tampered', key, sig)  # False
```

무결성 위반의 대표 사례는 SQL 인젝션으로 DB 레코드 조작, JWT 알고리즘을 `none`으로 변경해 서명 우회, 파일 다운로드 후 체크섬 미검증이다.

## 가용성(Availability)

가용성은 **서비스가 필요할 때 정상 동작해야 한다**는 원칙이다. 침해가 발생하면 서비스가 중단되거나 극단적으로 느려진다.

가용성을 위협하는 공격은 DDoS(분산 서비스 거부 공격), 랜섬웨어(파일 암호화 후 서비스 불능), 리소스 소진 공격(메모리·DB 연결 고갈) 등이다.

가용성을 달성하는 기술은 다음과 같다.

**이중화(Redundancy)**: 서버, DB, 네트워크 경로를 이중화해 단일 장애점(SPOF)을 제거한다.

**레이트 리미팅(Rate Limiting)**: 단위 시간당 요청 수를 제한해 자원 소진을 막는다.

**장애 복구 계획(DR)**: RTO(복구 목표 시간)와 RPO(복구 목표 지점)를 정의하고 정기적으로 훈련한다.

```python
# 레이트 리미팅: Redis 기반 슬라이딩 윈도우
import time
import redis

r = redis.Redis()

def is_rate_limited(user_id: str, limit: int = 100, window: int = 60) -> bool:
    key = f"rate:{user_id}"
    now = time.time()
    pipe = r.pipeline()
    pipe.zremrangebyscore(key, 0, now - window)   # 오래된 항목 제거
    pipe.zadd(key, {str(now): now})               # 현재 요청 추가
    pipe.zcard(key)                               # 윈도우 내 요청 수
    pipe.expire(key, window)
    _, _, count, _ = pipe.execute()
    return count > limit
```

## CIA 간의 트레이드오프

세 요소는 종종 서로 상충한다. 이것이 CIA를 단순 체크리스트가 아닌 **균형의 문제**로 만드는 이유다.

**기밀성 vs 가용성**: 종단간 암호화를 적용하면 CDN이 콘텐츠를 캐시할 수 없어 지연이 커진다. 의료 정보처럼 기밀성이 절대적인 경우에만 가용성을 희생한다.

**무결성 vs 가용성**: 모든 요청에 서명 검증을 추가하면 처리 속도가 느려진다. 내부 서비스 간 통신에서 검증 수준을 조절하는 것이 현실적이다.

**기밀성 vs 무결성**: E2E 암호화 메신저는 서버가 메시지를 볼 수 없어 콘텐츠 무결성 검증이 어렵다. Signal 프로토콜은 수신자 측에서 검증을 수행한다.

![CIA 트레이드오프와 코드 예시](/assets/posts/websec-cia-triad-tradeoffs.svg)

## 확장 모델: CIAA와 Parkerian Hexad

CIA에 **책임 추적성(Accountability)**을 추가한 CIAA 모델도 자주 쓰인다. 누가, 언제, 무엇을 했는지 감사 로그로 추적하는 능력이다. "기밀성이 깨졌을 때 누가 접근했는가"를 사후에 밝히는 데 필수적이다.

Parker의 Hexad 모델은 CIA에 **소유권(Possession)**, **진정성(Authenticity)**, **유용성(Utility)**을 더한다. 랜섬웨어는 무결성·가용성을 침해하면서도 소유권을 빼앗는 공격이다.

실무에서는 CIA가 가장 범용적이고 의사소통에 유용하다. 보안 결정을 내릴 때 "이 변경이 C·I·A 중 무엇에 영향을 주는가?"를 묻는 습관을 들이는 것만으로도 많은 실수를 예방할 수 있다.

---

**지난 글:** [웹 보안이란 무엇인가](/posts/websec-what-is-web-security/)

**다음 글:** [위협 모델링 입문](/posts/websec-threat-modeling/)

<br>
읽어주셔서 감사합니다. 😊
