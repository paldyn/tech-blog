---
title: "ABAC: 속성 기반 접근 제어의 원리와 구현"
description: "ABAC(Attribute-Based Access Control)의 구조와 RBAC 대비 장점을 설명하고, 주체·객체·환경·행동 속성을 조합한 동적 정책 평가 엔진을 Python 코드와 함께 구현합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 1
type: "knowledge"
category: "Security"
tags: ["ABAC", "접근제어", "인가", "OPA", "정책엔진", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-rbac/)에서 역할(Role) 기반으로 권한을 부여하는 RBAC을 살펴봤다. RBAC은 단순하고 관리하기 쉽지만, "재무팀 직원이 업무 시간에 사내 네트워크에서만 기밀 보고서를 열람할 수 있다"처럼 복잡한 조건을 표현하기 어렵다. 이 한계를 극복하기 위해 등장한 것이 **ABAC(Attribute-Based Access Control)**이다.

## ABAC이란

ABAC는 **주체(Subject), 객체(Object), 행동(Action), 환경(Environment)**의 네 가지 속성을 조합해 접근 허가 여부를 동적으로 결정하는 접근 제어 모델이다.

| 속성 | 설명 | 예시 |
|---|---|---|
| Subject | 요청자의 속성 | role=admin, dept=finance, clearance=secret |
| Object | 접근 대상 자원의 속성 | type=report, classification=confidential |
| Action | 수행하려는 행동 | read, write, delete |
| Environment | 요청 맥락 속성 | time=09:00~18:00, ip=192.168.x.x |

정책 결정 포인트(PDP)는 이 속성들을 수집해 정책 저장소의 규칙과 대조한 뒤 `Permit` 또는 `Deny`를 반환한다.

![ABAC 구조 다이어그램](/assets/posts/websec-abac-structure.svg)

## RBAC vs ABAC 비교

RBAC은 역할 하나에 권한을 묶으므로 정책이 단순하지만, 세밀한 조건을 반영하려면 역할이 기하급수적으로 늘어난다. 반면 ABAC은 정책을 속성 표현식으로 작성하므로 역할 수 증가 없이 매우 정교한 접근 제어가 가능하다.

```
# RBAC: "재무-관리자-사내-주간" 역할이 필요
if user.role == "finance_admin_intranet_daytime":
    allow()

# ABAC: 속성 조건식 하나로 동일 의미 표현
if (user.dept == resource.owner_dept
    and user.role == "admin"
    and 9 <= env.hour < 18
    and env.network == "intranet"):
    allow()
```

## 정책 엔진 구현

실제 서비스에서는 OPA(Open Policy Agent)나 자체 정책 엔진을 사용한다. 아래는 Python으로 작성한 간단한 ABAC 평가기다.

![ABAC 코드 예제](/assets/posts/websec-abac-code.svg)

```python
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

@dataclass
class AccessRequest:
    subject: dict[str, Any]
    resource: dict[str, Any]
    action: str
    env: dict[str, Any] = field(default_factory=dict)

def abac_policy(req: AccessRequest) -> bool:
    """
    정책: 재무팀 관리자가 같은 부서 소유 기밀 보고서를
    업무 시간(09~18시) 중에만 읽을 수 있다.
    """
    hour = req.env.get("hour", datetime.now().hour)

    if not (9 <= hour < 18):
        return False  # 시간 외 차단

    if req.action not in ("read",):
        return False  # 읽기만 허용

    if req.resource.get("classification") != "confidential":
        return True   # 비기밀 자원은 통과

    # 기밀 자원: 부서 일치 + admin 역할
    return (
        req.subject.get("dept") == req.resource.get("owner_dept")
        and req.subject.get("role") == "admin"
    )


# 사용 예
req = AccessRequest(
    subject={"role": "admin", "dept": "finance"},
    resource={"type": "report", "classification": "confidential",
               "owner_dept": "finance"},
    action="read",
    env={"hour": 10}
)
print(abac_policy(req))  # True
```

## OPA(Open Policy Agent) 통합

실무에서는 Rego 언어로 정책을 선언적으로 작성하고 OPA 서버가 평가를 담당한다.

```rego
# policy.rego
package authz

default allow = false

allow {
    input.action == "read"
    input.subject.dept == input.resource.owner_dept
    input.subject.role == "admin"
    hour := time.clock(time.now_ns())[0]
    hour >= 9
    hour < 18
}
```

```bash
# OPA 서버에 정책 쿼리
curl -X POST http://localhost:8181/v1/data/authz/allow \
  -d '{"input": {"subject": {"role":"admin","dept":"finance"},
                  "resource": {"owner_dept":"finance","classification":"confidential"},
                  "action": "read"}}'
# {"result": true}
```

## ABAC 설계 주의사항

**속성 신뢰성 확보**: ABAC 정책이 효과를 발휘하려면 속성값이 위·변조되지 않아야 한다. JWT에 포함된 클레임이나 세션 데이터는 서버에서 검증해야 한다.

**정책 복잡도 관리**: 속성 조합이 많아지면 정책 충돌이 발생하기 쉽다. 정책을 모듈화하고 충돌 해결 전략(permit-overrides, deny-overrides)을 명시적으로 정해야 한다.

**성능**: 요청마다 다수의 속성을 평가하므로, 자주 쓰이는 정책은 캐시를 적용하거나 사이드카(OPA) 패턴으로 분리한다.

```python
import functools

@functools.lru_cache(maxsize=1024)
def cached_policy_evaluate(subject_frozen, resource_frozen, action, hour):
    """불변 속성은 캐시해 반복 평가 비용 절감"""
    req = AccessRequest(
        subject=dict(subject_frozen),
        resource=dict(resource_frozen),
        action=action,
        env={"hour": hour}
    )
    return abac_policy(req)
```

## RBAC과 ABAC 혼합 사용

대부분의 실제 시스템은 RBAC과 ABAC을 혼합해 쓴다. 기본 권한은 RBAC으로 단순하게 관리하고, 세밀한 조건이 필요한 일부 자원에만 ABAC 정책을 추가 적용한다.

```python
def hybrid_authorize(user, resource, action, env):
    # 1단계: RBAC으로 기본 역할 확인
    if not rbac_check(user.role, resource.type, action):
        return False
    # 2단계: 민감 자원이면 ABAC 추가 평가
    if resource.classification in ("confidential", "secret"):
        return abac_policy(AccessRequest(
            subject=vars(user), resource=vars(resource),
            action=action, env=env
        ))
    return True
```

ABAC은 클라우드 멀티테넌트, 의료·금융 규제 환경처럼 세밀하고 동적인 접근 제어가 필요한 곳에 특히 효과적이다. 다음 글에서는 크리덴셜 스터핑 공격과 방어 전략을 살펴본다.

---

**지난 글:** [RBAC: 역할 기반 접근 제어 설계와 구현](/posts/websec-rbac/)

**다음 글:** [크리덴셜 스터핑: 공격 원리와 방어 전략](/posts/websec-credential-stuffing/)

<br>
읽어주셔서 감사합니다. 😊
