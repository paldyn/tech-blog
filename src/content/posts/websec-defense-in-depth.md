---
title: "심층 방어(Defense in Depth): 다층 보안 전략"
description: "Defense in Depth의 개념과 웹 보안 적용 방법을 설명합니다. 경계·네트워크·애플리케이션·데이터 계층별 보안 통제와 예방·탐지·대응 통제의 균형 잡힌 설계를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 5
type: "knowledge"
category: "Security"
tags: ["심층방어", "Defense in Depth", "보안계층", "보안아키텍처", "다층보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-attack-surface/)에서 공격 표면을 줄이는 방법을 배웠다. 그러나 공격 표면을 아무리 줄여도 취약점이 완전히 사라지진 않는다. 현실적인 보안 전략은 "완벽한 방어" 대신 "여러 겹의 방어막"을 쌓는 것이다. 이것이 **심층 방어(Defense in Depth)**의 핵심 철학이다. 군사 전략에서 온 개념으로, 중세 성의 해자·성벽·내성처럼 공격자가 하나를 돌파해도 다음 장벽에 가로막히도록 설계한다.

## 심층 방어의 핵심 원칙

**No Single Point of Failure** — 단 하나의 보안 통제에만 의존하지 않는다. HTTPS만 믿고 인증을 허술하게 하거나, 방화벽만 믿고 입력 검증을 생략하면 안 된다. 각 계층은 다른 계층이 실패했을 때의 백업이다.

```text
심층 방어 원칙
├── 다양성 (Diversity): 서로 다른 기술·벤더 사용
│   → 동일 취약점이 모든 계층을 동시에 뚫지 못함
├── 독립성 (Independence): 각 계층이 독립적으로 작동
│   → 한 계층의 침해가 다른 계층에 영향 없음
└── 최소화 (Minimization): 각 계층은 필요한 것만
    → 공격 표면 최소화와 시너지
```

## 보안 계층 구조

![심층 방어 계층 구조](/assets/posts/websec-defense-in-depth-layers.svg)

### 계층 1: 외부 경계 (Perimeter)

```nginx
# TLS 최신 버전만 허용
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256';

# HTTP → HTTPS 리다이렉트
server {
    listen 80;
    return 301 https://$host$request_uri;
}

# 속도 제한
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req zone=api burst=20 nodelay;
```

### 계층 2: 네트워크

WAF(Web Application Firewall)는 HTTP 레벨에서 알려진 공격 패턴을 탐지·차단한다.

```text
WAF 탐지 규칙 예시
├── SQL Injection: ' OR '1'='1, UNION SELECT 등
├── XSS: <script>, javascript:, onerror= 등
├── Path Traversal: ../../../etc/passwd
└── Bot Detection: 비정상 User-Agent, 비정상 속도
```

### 계층 3: 애플리케이션

```python
# 다층 입력 검증 예시
from pydantic import BaseModel, validator
import re

class UserInput(BaseModel):
    username: str
    email: str

    @validator('username')
    def username_valid(cls, v):
        # 1차: 형식 검증
        if not re.match(r'^[a-zA-Z0-9_]{3,30}$', v):
            raise ValueError('유효하지 않은 사용자명')
        # 2차: 화이트리스트 검증 (허용된 것만 통과)
        return v

    @validator('email')
    def email_valid(cls, v):
        # 라이브러리 검증 + 직접 검증 병행
        if '@' not in v or len(v) > 254:
            raise ValueError('유효하지 않은 이메일')
        return v.lower().strip()
```

### 계층 4: 데이터

```sql
-- 최소 권한 원칙: 애플리케이션 DB 사용자는 읽기/쓰기만
CREATE USER 'app_user'@'app-server' 
  IDENTIFIED BY 'strong_password';

GRANT SELECT, INSERT, UPDATE ON mydb.users TO 'app_user'@'app-server';
-- DELETE 권한 없음 (소프트 삭제 사용)
-- DROP, ALTER 권한 없음

-- 관리 작업용 별도 계정
CREATE USER 'admin_user'@'bastion-host' 
  IDENTIFIED BY 'different_strong_password';
GRANT ALL ON mydb.* TO 'admin_user'@'bastion-host';
```

## 보안 통제 유형

![보안 통제 유형](/assets/posts/websec-defense-in-depth-controls.svg)

심층 방어는 세 가지 통제 유형의 균형이다.

| 유형 | 목적 | 실패 시 영향 |
|---|---|---|
| 예방 (Preventive) | 공격 자체를 차단 | 공격이 내부로 진입 |
| 탐지 (Detective) | 공격 발생을 인지 | 침해를 모르고 지남 |
| 대응 (Corrective) | 피해 최소화·복구 | 피해가 지속 확대 |

예방에만 집중해서 탐지를 소홀히 하면, 침해가 발생해도 수개월 동안 모를 수 있다. IBM의 2023 Cost of a Data Breach 보고서에 따르면 평균 침해 감지 시간은 **204일**이다.

## 심층 방어 실패 사례 분석

```text
2013 Target 해킹 사건 (4000만 신용카드 유출)
침해 경로
  1. HVAC 협력업체 이메일 피싱 → 협력업체 자격증명 탈취
  2. 협력업체 → Target 내부망 접근 (네트워크 분리 부재)
  3. POS 시스템 → 고객 카드 정보 수집 (애플리케이션 통제 부재)
  4. 내부 서버 → 외부로 데이터 유출 (DLP 부재)

교훈:
  ✗ 협력업체 접근을 POS 망과 분리하지 않음
  ✗ 이상 트래픽 탐지 실패 (경고 무시)
  ✗ 최소 권한 미적용
  → 어떤 한 계층만 제대로 작동했어도 피해를 막거나 줄일 수 있었다
```

## 실전 적용: 웹 앱 심층 방어 체크리스트

```text
경계 계층
☑ HTTPS 전용, TLS 1.2+, HSTS 적용
☑ DDoS 방어 (CDN/WAF)
☑ 불필요한 포트 차단

네트워크 계층
☑ DMZ 구성, 내부망 분리
☑ WAF 규칙 최신 상태
☑ IDS/IPS 활성화

애플리케이션 계층
☑ 모든 입력 검증 및 인코딩
☑ 강력한 인증 (MFA)
☑ 세션 관리 강화

데이터 계층
☑ 저장 암호화 (At Rest)
☑ 전송 암호화 (In Transit)
☑ 최소 권한 DB 계정

모니터링
☑ 중앙화된 로그 수집
☑ 이상 탐지 알림
☑ 주기적 침투 테스트
```

심층 방어는 보안 투자 우선순위 결정에도 도움이 된다. 어떤 계층이 가장 취약한지 파악하고, 가장 낮은 계층부터 보강하는 것이 현명한 전략이다.

---

**지난 글:** [공격 표면(Attack Surface) 분석과 축소 전략](/posts/websec-attack-surface/)

**다음 글:** [최소 권한 원칙(Least Privilege): 접근 권한 최소화](/posts/websec-least-privilege/)

<br>
읽어주셔서 감사합니다. 😊
