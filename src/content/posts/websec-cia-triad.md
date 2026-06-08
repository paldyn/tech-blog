---
title: "CIA Triad: 기밀성·무결성·가용성 완전 해설"
description: "정보 보안의 세 기둥 CIA Triad(기밀성, 무결성, 가용성)를 깊이 이해합니다. 각 속성의 의미, 침해 사례, 기술적 구현, 그리고 트레이드오프를 체계적으로 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 2
type: "knowledge"
category: "Security"
tags: ["CIA Triad", "기밀성", "무결성", "가용성", "보안기초"]
featured: false
draft: false
---

[지난 글](/posts/websec-what-is-web-security/)에서 웹 보안의 개념과 중요성을 살펴봤다. 보안을 논할 때 가장 먼저 등장하는 프레임워크가 **CIA Triad**다. Confidentiality(기밀성), Integrity(무결성), Availability(가용성) — 세 속성의 첫 글자를 따서 만든 이 모델은 1970년대부터 정보 보안 전략의 핵심 뼈대로 자리잡고 있다. 어떤 보안 통제를 설계하든 이 세 가지 관점으로 검토하면 빠진 부분을 찾아낼 수 있다.

## 기밀성 (Confidentiality)

기밀성은 **권한 없는 자가 정보를 읽거나 접근하지 못하게** 하는 속성이다. 가장 직관적인 개념이지만, 웹 환경에서 구현하는 방법은 복잡하다.

### 기밀성을 보호하는 기술

```text
암호화 계층
├── 전송 중 (In Transit)
│   └── TLS 1.3 — HTTPS, WSS
├── 저장 중 (At Rest)
│   ├── AES-256-GCM (대칭 암호화)
│   └── 데이터베이스 컬럼 암호화
└── 사용 중 (In Use)
    └── 기밀 컴퓨팅 (Confidential Computing)

접근 제어
├── 인증 (Authentication)
│   └── 누구인지 확인
└── 인가 (Authorization)
    └── 무엇을 할 수 있는지 확인
```

### 기밀성 침해 사례

- **LinkedIn 2012**: SHA-1 해시(솔팅 없음)로 저장된 비밀번호 1억 7700만 건 유출
- **Equifax 2017**: 1억 4800만 명 개인정보 유출, Apache Struts 취약점 악용
- **세션 하이재킹**: HttpOnly 없는 쿠키 → XSS로 세션 토큰 탈취

```python
# 기밀성 침해의 전형적 패턴 — 잘못된 예
# 1. 평문 비밀번호 저장
user.password = request.form['password']  # 절대 금지

# 2. 암호화 없는 민감 정보 전송
http://api.example.com/user?token=abc123  # HTTP + 토큰 노출

# 올바른 방법
import bcrypt
hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt())
```

![CIA Triad 구조 다이어그램](/assets/posts/websec-cia-triad-diagram.svg)

## 무결성 (Integrity)

무결성은 **데이터가 권한 없이 변조되지 않았음을 보장**하는 속성이다. 저장된 데이터, 전송 중 데이터, 코드 자체 모두 무결성의 대상이다.

### 무결성을 보호하는 기술

| 기술 | 설명 | 사용 예 |
|---|---|---|
| **암호화 해시** | 데이터 지문 생성 | SHA-256으로 파일 무결성 검증 |
| **HMAC** | 키를 이용한 메시지 인증 | API 요청 서명, JWT |
| **디지털 서명** | 공개키 기반 인증 | 코드 서명, 인증서 |
| **입력 검증** | 악성 데이터 차단 | SQL 파라미터화, XSS 인코딩 |
| **Checksum** | 오류 감지 | 파일 다운로드 검증 |

```python
import hmac
import hashlib

def verify_webhook(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    # 타이밍 공격 방지를 위해 compare_digest 사용
    return hmac.compare_digest(f"sha256={expected}", signature)
```

### 무결성 침해 사례

- **공급망 공격**: npm 패키지 변조로 수천 개 앱에 악성 코드 삽입
- **중간자 변조**: HTTPS 없는 API 응답 변조 → 공격자가 송금 계좌 변경
- **SQLi로 DB 레코드 변조**: 가격, 잔액, 권한 레벨 직접 수정

## 가용성 (Availability)

가용성은 **정당한 사용자가 필요할 때 시스템과 데이터에 접근할 수 있음**을 보장하는 속성이다. 기밀성·무결성과 달리 공격자가 데이터를 **빼앗는** 것이 아니라 **막는** 공격이 주 위협이다.

```text
가용성 위협
├── DDoS (Distributed Denial of Service)
│   ├── 볼류메트릭 공격 (대역폭 소진)
│   ├── 프로토콜 공격 (TCP SYN Flood)
│   └── 애플리케이션 계층 공격 (HTTP Flood)
├── 랜섬웨어 (파일 암호화 후 복구 불가)
├── ReDoS (정규식 DoS — CPU 독점)
└── 리소스 고갈
    ├── 메모리 누수
    └── DB 연결 풀 소진
```

가용성을 높이는 방법:

```text
가용성 향상 기술
├── 이중화 (Redundancy)
│   ├── 로드 밸런서 + 다중 인스턴스
│   └── 멀티 AZ / 멀티 리전 배포
├── 속도 제한 (Rate Limiting)
│   └── IP별, 사용자별 요청 수 제한
├── 캐싱
│   └── CDN, Redis — 원서버 부하 감소
└── 복구 계획 (BCP/DR)
    └── RTO/RPO 목표 설정 및 테스트
```

## CIA Triad 트레이드오프

CIA 세 속성은 서로 긴장 관계에 있다. 실무에서는 이 균형을 의식적으로 관리해야 한다.

![CIA Triad 침해 사례](/assets/posts/websec-cia-triad-examples.svg)

**기밀성 vs 가용성**: MFA는 기밀성을 높이지만 사용자 경험을 저해한다. 너무 강한 접근 제어는 정상 업무를 방해한다.

**무결성 vs 가용성**: 모든 요청에 서명 검증을 추가하면 레이턴시가 증가한다. 엄격한 입력 검증은 일부 정상 요청을 거부할 수 있다.

**기밀성 vs 무결성**: 암호화만으로는 무결성이 보장되지 않는다. AES-CBC는 패딩 오라클 공격에 취약하며 변조 감지를 제공하지 않는다. **인증된 암호화(AE)** — AES-GCM 또는 ChaCha20-Poly1305 — 를 사용해야 두 속성을 동시에 보장한다.

## 확장 모델: STRIDE와 PARKERIAN Hexad

CIA Triad는 간단하지만 완전하지 않다. 두 가지 확장 모델이 자주 쓰인다.

| STRIDE | 대응 CIA |
|---|---|
| **S**poofing (위장) | 기밀성 |
| **T**ampering (변조) | 무결성 |
| **R**epudiation (부인) | — (비부인성) |
| **I**nformation Disclosure (정보 유출) | 기밀성 |
| **D**enial of Service (서비스 거부) | 가용성 |
| **E**levation of Privilege (권한 상승) | — (인가) |

CIA로 포착하기 어려운 **비부인성(Non-repudiation)**과 **책임 추적성(Accountability)**을 보완한 PARKERIAN Hexad도 있다. 하지만 실무에서는 CIA Triad가 여전히 가장 널리 쓰이는 기준점이다.

---

**지난 글:** [웹 보안이란 무엇인가: 개념, 중요성, 학습 로드맵](/posts/websec-what-is-web-security/)

**다음 글:** [위협 모델링: 체계적으로 공격을 예측하는 방법](/posts/websec-threat-modeling/)

<br>
읽어주셔서 감사합니다. 😊
