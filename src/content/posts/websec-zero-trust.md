---
title: "제로 트러스트(Zero Trust): '아무도 믿지 마라'"
description: "경계 기반 보안의 한계를 극복하는 제로 트러스트 보안 모델을 설명합니다. Never Trust Always Verify 원칙, 정책 엔진 구조, 실제 구현 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 3
type: "knowledge"
category: "Security"
tags: ["제로트러스트", "ZeroTrust", "보안모델", "네트워크보안", "ZTNA"]
featured: false
draft: false
---

[지난 글](/posts/websec-least-privilege/)에서 최소 권한 원칙으로 권한을 줄이는 방법을 알아봤다. 하지만 권한을 아무리 줄여도 "내부망에 있으면 신뢰한다"는 전제가 남아 있으면 한계가 있다. 내부 네트워크에 한 번 침입한 공격자는 내부에서 자유롭게 횡이동(lateral movement)할 수 있기 때문이다. **제로 트러스트(Zero Trust)**는 이 전제 자체를 버린다.

## 기존 경계 보안의 문제

전통적인 보안 모델은 성곽과 해자(Castle and Moat) 구조다. 방화벽이라는 단단한 외벽으로 내부를 보호하고, 내부에 있으면 신뢰한다. 이 모델은 클라우드, 원격 근무, BYOD 환경에서는 동작하지 않는다.

2020년 SolarWinds 공격이 대표적이다. 공격자는 신뢰받는 내부 소프트웨어 업데이트를 통해 침투한 뒤, 내부망에서 수개월간 감지 없이 횡이동했다.

![제로 트러스트 아키텍처](/assets/posts/websec-zero-trust-architecture.svg)

## Never Trust, Always Verify

제로 트러스트의 핵심 원칙은 세 가지다.

**1. 명시적 검증 (Verify Explicitly)**: 신원, 디바이스, 위치, 시간, 행동 패턴 등 모든 데이터를 사용해서 검증한다.

**2. 최소 권한 접근 (Use Least Privilege)**: JIT(Just-In-Time) 접근과 JEA(Just-Enough-Access)를 적용한다.

**3. 침해 가정 (Assume Breach)**: 이미 침해되었다고 가정하고 행동한다.

![전통 보안 vs 제로 트러스트](/assets/posts/websec-zero-trust-comparison.svg)

## 정책 엔진 구현

```python
from dataclasses import dataclass
from enum import Enum
from datetime import datetime

class AccessDecision(Enum):
    ALLOW = "allow"
    DENY = "deny"
    CHALLENGE = "challenge"

@dataclass
class AccessRequest:
    user_id: str
    device_id: str
    resource: str
    ip_address: str
    timestamp: datetime

class PolicyEngine:
    def evaluate(self, req: AccessRequest) -> AccessDecision:
        if not self._verify_identity(req.user_id):
            return AccessDecision.DENY
        device_trust = self._check_device_trust(req.device_id)
        if device_trust < 0.5:
            return AccessDecision.DENY
        risk_score = self._calculate_risk(req)
        if risk_score > 0.8:
            return AccessDecision.DENY
        elif risk_score > 0.5:
            return AccessDecision.CHALLENGE
        return AccessDecision.ALLOW
```

## 네트워크 마이크로세그멘테이션

```yaml
# Kubernetes NetworkPolicy: 서비스 간 통신 명시적 허용
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: order-service-policy
spec:
  podSelector:
    matchLabels:
      app: order-service
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: api-gateway
      ports:
        - port: 8080
```

제로 트러스트는 한 번에 전환하는 게 아니라 MFA 전면 도입 → 디바이스 관리 → 마이크로세그멘테이션 순으로 점진적으로 도입한다.

---

**지난 글:** [최소 권한 원칙(PoLP): 권한을 최소화하는 이유](/posts/websec-least-privilege/)

**다음 글:** [HTTP 보안 헤더 총정리](/posts/websec-security-headers-overview/)

<br>
읽어주셔서 감사합니다. 😊
