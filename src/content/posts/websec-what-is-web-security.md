---
title: "웹 보안이란 무엇인가: 개념, 중요성, 학습 로드맵"
description: "웹 보안의 정의와 핵심 목표, 공격자가 노리는 것들, 방어 계층 구조를 소개합니다. 웹 보안 완전 정복 시리즈의 첫 번째 글로 전체 학습 맵을 제시합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 1
type: "knowledge"
category: "Security"
tags: ["웹보안", "보안기초", "OWASP", "CIA Triad", "보안학습"]
featured: false
draft: false
---

오늘날 인터넷을 통해 제공되는 서비스의 거의 모든 것이 웹 기반이다. 온라인 뱅킹부터 쇼핑, 의료 기록, 정부 서비스까지 — 이 모든 것이 HTTP/HTTPS를 통해 연결된다. 웹 애플리케이션은 수백만 명의 일상과 민감한 데이터를 담고 있기 때문에 공격자들에게 가장 매력적인 표적이다. **웹 보안(Web Security)**은 이러한 시스템을 의도치 않은 접근, 데이터 유출, 서비스 파괴로부터 보호하는 모든 원칙·기술·프로세스의 집합이다.

## 웹 보안이 중요한 이유

2023년 기준 전체 사이버 침해 사고의 43%가 웹 애플리케이션을 통해 발생했다 (Verizon DBIR). 공격 표면이 급격히 넓어진 이유는 여러 가지다.

- **복잡성 증가**: 단순 HTML에서 SPA, 마이크로서비스, 클라우드 네이티브 아키텍처로 진화
- **빠른 배포 사이클**: DevOps/CI-CD 환경에서 보안 검증을 건너뛰기 쉬움
- **서드파티 의존성**: npm, PyPI 등 오픈소스 패키지 체인 전체가 공격 벡터

보안 사고는 금전적 손실, 법적 제재(GDPR 과징금), 브랜드 신뢰도 하락, 심각한 경우 서비스 폐쇄까지 이어진다.

![웹 보안 개념 개요](/assets/posts/websec-what-is-web-security-overview.svg)

## 웹 보안의 세 기둥: CIA Triad

웹 보안의 목표는 세 가지 속성으로 요약된다.

| 속성 | 원문 | 의미 |
|---|---|---|
| **기밀성** | Confidentiality | 권한 없는 자가 데이터를 읽지 못함 |
| **무결성** | Integrity | 권한 없이 데이터를 변조하지 못함 |
| **가용성** | Availability | 정당한 사용자는 항상 서비스를 이용할 수 있음 |

모든 보안 통제는 이 세 속성 중 하나 이상을 보호하기 위해 존재한다. CIA Triad는 다음 글에서 더 깊이 다룬다.

## 공격자는 무엇을 노리나?

공격자의 동기를 이해하면 방어 우선순위를 정하는 데 도움이 된다.

```text
공격자 유형
├── 금전적 동기 (Financially Motivated)
│   ├── 신용카드·개인정보 탈취 후 다크웹 판매
│   └── 랜섬웨어 배포, 서비스 마비 후 협박
├── 정치적·이념적 동기 (Hacktivism)
│   └── 서비스 마비, 정보 유출로 메시지 전달
├── 국가 지원 (Nation-State)
│   └── 스파이 활동, 인프라 파괴
└── 내부자 위협 (Insider Threat)
    └── 접근 권한 있는 직원의 고의적 데이터 유출
```

## 웹 보안 계층 구조

방어는 단일 기술이 아닌 여러 계층의 조합이다.

![웹 보안 계층 구조](/assets/posts/websec-what-is-web-security-layers.svg)

네트워크 계층에서 데이터 계층, 그리고 모니터링까지 각 계층이 독립적으로 방어선을 구성한다. 한 계층이 뚫려도 다음 계층이 공격을 저지한다.

## OWASP: 웹 보안의 표준 참조

OWASP(Open Web Application Security Project)는 웹 애플리케이션 보안의 사실상 표준 기관이다. 가장 중요한 리소스는 다음과 같다.

- **OWASP Top 10**: 가장 심각한 웹 애플리케이션 취약점 목록 (2~3년마다 업데이트)
- **OWASP ASVS**: 애플리케이션 보안 검증 표준
- **OWASP Testing Guide**: 실무 테스트 방법론

```bash
# OWASP Top 10 (2021) 요약
A01 Broken Access Control
A02 Cryptographic Failures
A03 Injection
A04 Insecure Design
A05 Security Misconfiguration
A06 Vulnerable Components
A07 Identification/Authentication Failures
A08 Software Integrity Failures
A09 Security Logging/Monitoring Failures
A10 Server-Side Request Forgery (SSRF)
```

이 시리즈는 위 항목들을 포함해 웹 보안 전반을 체계적으로 다룬다.

## 이 시리즈에서 다룰 내용

**웹 보안 완전 정복** 시리즈는 121편으로 구성된다. 기초 개념부터 시작해 인증·세션, OWASP 취약점, 암호학, API 보안, 클라우드 보안, 컴플라이언스까지 실무에 필요한 모든 영역을 다룬다.

```text
시리즈 구성
1~10   기초 개념 (CIA Triad, 위협 모델링, 보안 사고방식)
11~32  인증 · 인가 · 세션 관리
33~65  OWASP 취약점 (XSS, SQLi, CSRF, SSRF ...)
66~80  브라우저 보안 (SOP, CORS, CSP, 쿠키)
81~95  암호학 기초
96~110 API · 클라우드 · 인프라 보안
111~121 SDLC · 감사 · 컴플라이언스
```

보안을 "나중에" 생각하는 문화가 가장 위험하다. 이 시리즈를 통해 보안을 설계 초기부터 통합하는 **Security by Design** 사고방식을 키워보자.

---

**다음 글:** [CIA Triad — 기밀성·무결성·가용성 완전 해설](/posts/websec-cia-triad/)

<br>
읽어주셔서 감사합니다. 😊
