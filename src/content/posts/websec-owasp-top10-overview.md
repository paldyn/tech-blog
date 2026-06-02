---
title: "OWASP Top 10: 가장 위험한 웹 취약점 개관"
description: "OWASP Top 10 2021 목록을 소개하고, 2017년 대비 달라진 점과 각 항목의 핵심 개념, 그리고 이 시리즈에서 어떤 순서로 심화 다룰지를 안내합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 3
type: "knowledge"
category: "Security"
tags: ["OWASP", "Top10", "웹취약점", "보안로드맵", "A01", "A03"]
featured: false
draft: false
---

[지난 글](/posts/websec-credential-stuffing/)에서 크리덴셜 스터핑이 어떻게 정상 인증 체계를 우회하는지 살펴봤다. 이번 글에서는 웹 애플리케이션 보안의 가장 권위 있는 기준인 **OWASP Top 10**을 개관한다. 이 목록은 실제 취약점 데이터와 보안 전문가 설문을 결합해 선정되며, 웹 보안 공부와 보안 감사의 출발점으로 널리 활용된다.

## OWASP란

OWASP(Open Web Application Security Project)는 웹 애플리케이션 보안 연구·교육을 위한 비영리 재단이다. 2001년 설립 이후 OWASP Top 10, ASVS, WSTG, SAMM 등 다양한 보안 표준과 도구를 무료로 공개하고 있다.

Top 10은 약 3~4년마다 갱신되며, 가장 최신 버전은 2021년에 발표되었다. CVE 데이터, 버그바운티 보고서, 보안 스캐너 결과 등 수십만 건의 실제 데이터를 분석해 가장 빈번하고 영향도가 높은 10가지 취약점 카테고리를 선정한다.

## OWASP Top 10 2021 목록

![OWASP Top 10 2021](/assets/posts/websec-owasp-top10-overview-list.svg)

### A01: 손상된 접근 제어 (Broken Access Control)

2017년 5위에서 1위로 급등했다. 인증된 사용자가 허가되지 않은 자원에 접근하는 모든 경우를 포함한다. IDOR(직접 객체 참조), 경로 탐색, 권한 우회가 대표 사례다.

```http
# IDOR 예시: 다른 사용자 주문 조회
GET /api/orders/12345        # 내 주문
GET /api/orders/12346        # 타인 주문 — 서버가 소유권을 검증하지 않으면 노출
```

### A02: 암호화 실패 (Cryptographic Failures)

구버전 명칭 "민감 데이터 노출"에서 원인 중심으로 재명명됐다. HTTP 평문 전송, MD5/SHA-1 같은 약한 해시, 하드코딩된 키, 불충분한 TLS 설정이 해당된다.

### A03: 인젝션 (Injection)

2017년 1위에서 3위로 내려왔지만 여전히 가장 치명적이다. SQL, NoSQL, OS 명령, LDAP, Template 인젝션 등 신뢰할 수 없는 데이터가 인터프리터로 전달되는 모든 경우를 포함한다. **XSS도 이 카테고리로 통합**되었다.

```python
# 위험: 직접 문자열 결합
query = f"SELECT * FROM users WHERE name = '{user_input}'"

# 안전: 파라미터 바인딩
query = "SELECT * FROM users WHERE name = %s"
cursor.execute(query, (user_input,))
```

### A04: 안전하지 않은 설계 (Insecure Design) ★신규

2021에 새로 추가된 카테고리로, 구현 버그가 아닌 **설계 단계의 결함**에 초점을 맞춘다. 위협 모델링 미적용, 보안 요구사항 미정의, 비즈니스 로직 취약점이 해당된다.

### A05: 보안 설정 오류 (Security Misconfiguration)

기본 비밀번호, 불필요한 기능 활성화, 과도한 권한, 오류 메시지의 스택 트레이스 노출, 보안 헤더 미설정 등이 포함된다.

### A06: 취약하고 오래된 컴포넌트 (Vulnerable and Outdated Components)

Log4Shell, Spring4Shell처럼 의존성 라이브러리의 취약점이 전체 서비스를 위협한다. SCA(소프트웨어 컴포지션 분석) 도구로 지속적으로 관리해야 한다.

```bash
# 의존성 취약점 스캔
pip-audit                    # Python
npm audit                    # Node.js
mvn dependency-check:check   # Java/Maven
```

### A07: 식별 및 인증 실패 (Identification and Authentication Failures)

약한 비밀번호 허용, 세션 고정, 세션 만료 미적용, 크리덴셜 평문 저장, MFA 미적용 등이 포함된다.

### A08: 소프트웨어·데이터 무결성 실패 (Software and Data Integrity Failures) ★신규

CI/CD 파이프라인 보안, 안전하지 않은 역직렬화, 무결성 검증 없는 소프트웨어 업데이트가 해당된다. Log4Shell처럼 공급망을 통한 공격이 급증하면서 신규 추가되었다.

### A09: 보안 로깅·모니터링 실패 (Security Logging and Monitoring Failures)

로그인 실패, 접근 거부, 입력 검증 실패 등 보안 이벤트가 기록·모니터링되지 않으면 침해 탐지가 늦어진다. 평균 침해 탐지 시간은 197일이다.

### A10: 서버 사이드 요청 위조 (Server-Side Request Forgery) ★신규

서버가 공격자가 지정한 URL로 요청을 보내도록 유도해 내부망 접근이나 클라우드 메타데이터 탈취에 악용된다.

![OWASP Top 10 변화 추이](/assets/posts/websec-owasp-top10-overview-trend.svg)

## 2017 → 2021 핵심 변화

| 변화 | 의미 |
|---|---|
| Broken Access Control → #1 | 권한 우회가 가장 흔한 취약점으로 확인 |
| XSS가 Injection에 통합 | 인젝션 계열 취약점의 공통 원인 강조 |
| Insecure Design 신규 추가 | 보안을 구현이 아닌 설계 단계부터 고려해야 함 |
| SSRF 신규 추가 | 클라우드·마이크로서비스 환경에서 급증 |

## 이 시리즈에서의 학습 순서

이 시리즈는 OWASP Top 10 항목을 포함해 웹 보안의 전 영역을 체계적으로 다룬다.

```
인젝션 계열:     A03 → SQL·Blind SQL → NoSQL → Command → Template → XSS
브라우저 보안:   SOP → CORS → CSP → 쿠키 보안 → 클릭재킹
암호화:          대칭/비대칭 → 해싱 → TLS → 인증서
API 보안:        REST → GraphQL → OAuth → JWT
인프라:          컨테이너 → 클라우드 IAM → 의존성 관리
```

OWASP Top 10은 체크리스트가 아니라 **학습 로드맵**이다. 각 항목의 원리를 이해하고, 왜 그 취약점이 발생하는지, 어떻게 방어하는지를 깊이 이해하는 것이 목표다. 다음 글부터 가장 넓은 범주인 인젝션 취약점을 심화 탐구한다.

---

**지난 글:** [크리덴셜 스터핑: 공격 원리와 방어 전략](/posts/websec-credential-stuffing/)

**다음 글:** [인젝션 취약점 완전 정복: 개요와 공통 원리](/posts/websec-injection-overview/)

<br>
읽어주셔서 감사합니다. 😊
