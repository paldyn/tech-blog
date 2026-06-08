---
title: "위협 모델링: 체계적으로 공격을 예측하는 방법"
description: "STRIDE, DREAD, 공격 트리를 활용한 위협 모델링 실전 가이드. DFD 작성부터 위험 우선순위화까지 보안 설계의 핵심을 체계적으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 3
type: "knowledge"
category: "Security"
tags: ["위협모델링", "STRIDE", "DREAD", "보안설계", "DFD"]
featured: false
draft: false
---

[지난 글](/posts/websec-cia-triad/)에서 CIA Triad로 보안의 목표를 정의했다. 그런데 목표를 알아도 "어디부터 어떻게 방어해야 하는가?"라는 질문에는 답하기 어렵다. **위협 모델링(Threat Modeling)**은 이 질문에 체계적으로 답하는 방법론이다. 시스템을 공격자의 시각으로 분석하고, 가장 심각한 위협부터 대응 계획을 세운다.

## 위협 모델링이란?

위협 모델링은 시스템에서 **무엇이 잘못될 수 있는지**를 구조적으로 파악하는 프로세스다. Adam Shostack의 고전적 정의는 "보안 리뷰를 코드가 아닌 설계 단계에서 수행하는 것"이다. 코드가 완성된 후에 취약점을 패치하는 것보다 설계 단계에서 위협을 제거하는 비용이 훨씬 저렴하다.

### 언제 수행하는가?

```text
위협 모델링 시점
├── 설계 단계 (권장) — 아키텍처 결정 전
├── 스프린트 중 — 새 기능 추가 시
├── 코드 리뷰 — PR 검토와 병행
└── 주기적 검토 — 인프라 변경 후
```

위협 모델링은 일회성 작업이 아니다. 시스템이 변화할 때마다 모델도 업데이트되어야 한다.

## 4단계 위협 모델링 프로세스

![위협 모델링 프로세스](/assets/posts/websec-threat-modeling-process.svg)

### 1단계: 시스템 정의 — DFD 작성

데이터 흐름 다이어그램(DFD)은 위협 모델링의 지도다. 다음 요소를 식별한다.

| 요소 | 표기 | 설명 |
|---|---|---|
| 외부 개체 | 직사각형 | 사용자, 외부 API, 브라우저 |
| 프로세스 | 원 | 앱 서버, 마이크로서비스 |
| 데이터 저장소 | 평행선 | DB, 캐시, 파일 시스템 |
| 데이터 흐름 | 화살표 | 요청, 응답, 이벤트 |
| 신뢰 경계 | 점선 | 네트워크 경계, 컨테이너 격리 |

```text
[사용자 브라우저] ──HTTPS──> [Web Server] ──TCP──> [App Server]
                                                        |
                                              신뢰 경계 (내부망)
                                                        |
                                                   [Database]
                                                   [Redis Cache]
```

### 2단계: 위협 식별 — STRIDE 활용

각 DFD 요소에 STRIDE 체크리스트를 적용한다.

```python
# 자동화된 위협 식별 예시 (개념 코드)
STRIDE_CHECKS = {
    "external_entity": ["Spoofing"],
    "process":         ["Tampering", "Repudiation", "Elevation"],
    "data_store":      ["Info_Disclosure", "Tampering"],
    "data_flow":       ["Info_Disclosure", "Tampering"],
    "trust_boundary":  ["Spoofing", "Elevation"]
}

def check_threats(element_type, element_name):
    threats = STRIDE_CHECKS.get(element_type, [])
    return [f"{element_name}: {t}" for t in threats]

# 예: 사용자 로그인 API 분석
print(check_threats("data_flow", "POST /login"))
# ['POST /login: Info_Disclosure', 'POST /login: Tampering']
```

### 3단계: 위험 평가 — DREAD 점수화

![DREAD 위험 점수 모델](/assets/posts/websec-threat-modeling-dread.svg)

DREAD 모델로 각 위협에 점수를 매긴다.

```text
SQLi 취약점 예시
D Damage         = 9  (전체 DB 탈취 가능)
R Reproducibility = 10 (매번 재현 가능)
E Exploitability  = 8  (자동화 도구 존재)
A Affected Users  = 10 (전체 사용자)
D Discoverability = 7  (취약점 스캐너로 감지)

DREAD = (9+10+8+10+7) / 5 = 8.8 → 즉시 대응 필요
```

CVSS(Common Vulnerability Scoring System)도 동일한 목적으로 쓰인다. CVE 데이터베이스의 점수 체계가 바로 CVSS다.

### 4단계: 대응 방안 — 4가지 전략

모든 위협을 완벽하게 막을 수는 없다. 우선순위에 따라 전략을 선택한다.

```text
위협 대응 전략 (4T)
├── Treat (처치)   — 직접 기술 통제로 위협 제거
│   예) SQLi → PreparedStatement 사용
├── Transfer (이전) — 보험, 외부 서비스로 위험 이전
│   예) DDoS → CDN/WAF 서비스 이용
├── Terminate (종료) — 위험한 기능 자체를 제거
│   예) 불필요한 외부 API 노출 엔드포인트 삭제
└── Tolerate (허용) — 낮은 위험은 모니터링과 함께 수용
    예) 로우 DREAD 점수 취약점
```

## 실전: 로그인 기능 위협 모델링

실제 웹 애플리케이션의 로그인 기능을 모델링해보자.

```text
자산: 사용자 계정, 세션 토큰, 개인 데이터

위협 목록
T01 Spoofing: 타인의 크리덴셜로 로그인 시도 (DREAD: 8.2)
    → 대응: bcrypt 해싱, 계정 잠금, MFA

T02 Tampering: 세션 토큰 변조 (DREAD: 7.6)
    → 대응: HMAC 서명, HttpOnly 쿠키

T03 Info Disclosure: 비밀번호 로그 노출 (DREAD: 6.0)
    → 대응: 로그에서 민감 필드 제외

T04 DoS: 로그인 엔드포인트 대상 무차별 공격 (DREAD: 5.8)
    → 대응: 속도 제한, reCAPTCHA

T05 Elevation: 관리자 계정 탈취 후 권한 오용 (DREAD: 9.0)
    → 대응: 최소 권한, 관리자 MFA 강제
```

## 도구와 프레임워크

```text
위협 모델링 도구
├── Microsoft Threat Modeling Tool (무료, Windows)
│   STRIDE 기반, DFD 시각화
├── OWASP Threat Dragon (무료, 웹/데스크탑)
│   오픈소스, STRIDE 지원
├── IriusRisk (상용)
│   엔터프라이즈급, 컴플라이언스 연동
└── 수동 방법
    └── Miro/FigJam + 화이트보드 세션
```

## 공격 트리 (Attack Tree)

STRIDE가 "어떤 유형의 공격인가"를 분류한다면, 공격 트리는 "공격자가 어떤 경로로 목표에 도달하는가"를 시각화한다.

```text
목표: 관리자 계정 탈취
├── AND: 비밀번호 획득 + MFA 우회
│   ├── 비밀번호 획득
│   │   ├── 브루트 포스
│   │   ├── 피싱
│   │   └── DB 유출
│   └── MFA 우회
│       ├── SIM 스와핑
│       └── 리커버리 코드 탈취
└── OR: 세션 하이재킹
    ├── XSS로 쿠키 탈취
    └── 네트워크 스니핑
```

위협 모델링은 보안 전문가만의 영역이 아니다. 개발자가 기능을 설계할 때 "이 기능을 공격한다면 어떻게 할까?"라는 질문을 습관적으로 던지는 것 — 그것이 바로 위협 모델링의 핵심이다.

---

**지난 글:** [CIA Triad — 기밀성·무결성·가용성 완전 해설](/posts/websec-cia-triad/)

**다음 글:** [공격 표면(Attack Surface) 분석과 축소 전략](/posts/websec-attack-surface/)

<br>
읽어주셔서 감사합니다. 😊
