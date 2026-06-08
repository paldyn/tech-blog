---
title: "제로 트러스트(Zero Trust): 아무도 믿지 않는 보안 모델"
description: "Zero Trust 보안 모델의 개념, NIST SP 800-207 원칙, 기존 경계 보안과의 차이를 설명합니다. ID 검증, 기기 신뢰, 마이크로세그멘테이션, mTLS까지 실전 구현을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 7
type: "knowledge"
category: "Security"
tags: ["Zero Trust", "제로트러스트", "ZTNA", "마이크로세그멘테이션", "mTLS"]
featured: false
draft: false
---

[지난 글](/posts/websec-least-privilege/)에서 최소 권한 원칙으로 권한을 제어하는 방법을 배웠다. 그런데 원격 근무가 보편화되고 클라우드가 기본 인프라가 된 지금, 기존의 "내부망은 안전하다"는 가정이 더 이상 유효하지 않다. **제로 트러스트(Zero Trust)**는 이 변화에 대응하는 현대적 보안 패러다임이다. 핵심 원칙은 하나다. "절대 신뢰하지 말고, 항상 검증하라(Never Trust, Always Verify)."

## 왜 Zero Trust가 필요한가?

전통적 경계 보안은 "내부망에 들어온 것은 믿는다"는 가정에 기반한다. VPN 연결에 성공하면 내부 리소스에 광범위하게 접근할 수 있다. 이 모델은 세 가지 현실과 충돌한다.

```text
기존 경계 보안의 한계
1. 원격 근무: 직원이 어디에서든 접근 → 경계가 모호
2. 클라우드: 데이터가 온프레미스 밖 → 방화벽 밖에 있음
3. 내부자 위협: 내부망 진입 후 래터럴 무브
   예) APT 공격자: 피싱 → 내부망 진입 → 수개월간 이동
```

2020년 SolarWinds 공격은 이 위험을 적나라하게 보여줬다. 공격자는 소프트웨어 업데이트를 통해 수천 개 기업·정부 내부망에 진입한 후, 경계 보안만 믿고 내부 이동을 탐지하지 못한 기관들을 수개월간 침해했다.

![Zero Trust vs 기존 경계 보안](/assets/posts/websec-zero-trust-model.svg)

## NIST SP 800-207: Zero Trust 아키텍처

NIST(미국 국립표준기술연구소)는 2020년 Zero Trust의 공식 가이드라인을 발표했다. 핵심 원칙 7가지를 다음과 같이 정의한다.

```text
NIST Zero Trust 원칙
1. 모든 데이터 소스와 서비스를 리소스로 간주
2. 모든 통신을 네트워크 위치와 무관하게 보안화
3. 개별 기업 리소스에 세션 단위로 접근 허가
4. 리소스 접근은 클라이언트 신원·앱·상태 기반으로 동적 정책 적용
5. 모든 자산의 무결성과 보안 상태 모니터링 및 측정
6. 모든 리소스 인증과 인가는 동적이고 엄격히 강제
7. 네트워크 인프라와 통신 상태를 수집하고 보안 상태 개선에 활용
```

## Zero Trust 5대 원칙

![Zero Trust 5대 원칙](/assets/posts/websec-zero-trust-pillars.svg)

### 1. 강력한 신원 검증 (Identity)

```python
# 조건부 접근 정책 예시 (Azure AD / Entra ID 방식)
def evaluate_access_request(user, resource, context):
    policy = {
        "require_mfa": True,
        "allowed_locations": ["KR", "US"],
        "allowed_device_compliance": True,
        "session_timeout_minutes": 60,
    }

    # MFA 검증
    if not user.mfa_verified:
        return AccessDecision.REQUIRE_MFA

    # 위치 검증
    if context.country_code not in policy["allowed_locations"]:
        return AccessDecision.DENY

    # 기기 컴플라이언스 검증
    if policy["allowed_device_compliance"] and not context.device.is_compliant:
        return AccessDecision.DENY

    # 세션 만료 검증
    if context.session_age_minutes > policy["session_timeout_minutes"]:
        return AccessDecision.REQUIRE_REAUTH

    return AccessDecision.ALLOW
```

### 2. 기기 신뢰 검증 (Device Trust)

```text
기기 신뢰 기준
☑ MDM(Mobile Device Management) 등록 완료
☑ 최신 OS 패치 적용
☑ EDR(Endpoint Detection and Response) 설치
☑ 디스크 암호화 활성화 (BitLocker / FileVault)
☑ 기기 인증서 발급 (Certificate-based auth)
☑ 루팅/탈옥 기기 차단
```

### 3. 마이크로세그멘테이션 (Network)

```bash
# Kubernetes NetworkPolicy: 서비스 간 통신 세밀하게 제어
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: payment-isolation
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: payment-service
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: order-service
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: payment-db
    ports:
    - protocol: TCP
      port: 5432
EOF
```

### 4. mTLS — 서비스 간 상호 인증

```python
# 서비스 메시(Istio)를 통한 mTLS 자동 설정
# istio PeerAuthentication — 네임스페이스 전체 mTLS 강제
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: production
spec:
  mtls:
    mode: STRICT  # 인증서 없는 연결은 모두 거부
```

## Zero Trust 도입 로드맵

Zero Trust는 한 번에 구축하는 것이 아니라 단계적으로 성숙시키는 여정이다.

```text
Zero Trust 성숙도 단계 (CISA 모델)

1단계 — 전통적 (Traditional)
  정적 보안 정책, 위치 기반 신뢰

2단계 — 초기 (Initial)
  일부 워크로드에 ID 기반 접근 시작

3단계 — 고급 (Advanced)
  대부분의 리소스에 동적 정책 적용
  자동화된 모니터링·대응

4단계 — 최적화 (Optimal)
  모든 리소스에 ZT 원칙 적용
  AI 기반 이상 탐지
  지속적 정책 개선
```

Zero Trust는 단순한 기술 솔루션이 아닌 조직 문화와 프로세스의 변화다. 관리자 계정 하나에 과도한 권한을 주던 습관에서 벗어나, 모든 접근을 검증하고 기록하는 문화를 만드는 것이 핵심이다.

---

**지난 글:** [최소 권한 원칙(Least Privilege): 접근 권한 최소화](/posts/websec-least-privilege/)

**다음 글:** [보안 마인드셋: 개발자가 가져야 할 보안 사고방식](/posts/websec-security-mindset/)

<br>
읽어주셔서 감사합니다. 😊
