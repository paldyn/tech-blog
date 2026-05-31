---
title: "최소 권한 원칙(PoLP): 권한을 최소화하는 이유"
description: "최소 권한 원칙(Principle of Least Privilege)을 DB 계정, API 서비스, OS 프로세스 등 실제 사례로 설명합니다. 과도한 권한이 초래하는 보안 위험과 올바른 권한 설계 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 2
type: "knowledge"
category: "Security"
tags: ["최소권한", "PoLP", "RBAC", "접근제어", "보안원칙"]
featured: false
draft: false
---

[지난 글](/posts/websec-defense-in-depth/)에서 여러 계층에 걸쳐 방어를 배치하는 심층 방어 전략을 살펴봤다. 각 계층이 제대로 작동하려면 모든 컴포넌트가 "딱 필요한 만큼만" 권한을 가져야 한다. 이 원칙이 바로 **최소 권한 원칙(Principle of Least Privilege, PoLP)**이다.

## 왜 권한이 넘치면 위험한가

2013년 Target 신용카드 정보 유출 사건을 기억하는가. 공격자는 Target의 HVAC(공조) 협력업체 자격증명을 탈취한 뒤, 그 계정이 POS(결제) 시스템에도 접근할 수 있다는 점을 이용해 4,000만 건의 신용카드 정보를 훔쳤다. HVAC 협력업체가 POS 시스템에 접근할 이유는 전혀 없었다. 과도한 권한이 사고를 키운 전형적인 사례다.

**최소 권한 원칙**: 모든 계정, 서비스, 프로세스는 자신의 임무를 수행하는 데 필요한 최소한의 권한만 가져야 하며, 나머지 권한은 기본적으로 거부되어야 한다.

![최소 권한 적용 전후 비교](/assets/posts/websec-least-privilege-principle.svg)

## 계층별 최소 권한 적용

### 데이터베이스 계정

```sql
-- 나쁜 예: root 계정에 ALL PRIVILEGES
GRANT ALL PRIVILEGES ON *.* TO 'app'@'%';

-- 좋은 예: 필요한 DB, 테이블, 작업만 허용
CREATE USER 'app_read'@'10.0.1.%' IDENTIFIED BY '...';
GRANT SELECT ON mydb.users TO 'app_read'@'10.0.1.%';

CREATE USER 'app_write'@'10.0.1.%' IDENTIFIED BY '...';
GRANT SELECT, INSERT, UPDATE ON mydb.orders TO 'app_write'@'10.0.1.%';
```

### API 서비스 간 통신

```python
# 서비스별 스코프 분리 예시 (OAuth2 기반)
SCOPES = {
    "inventory-service": ["products:read"],
    "order-service": ["orders:write", "products:read"],
    "admin-service": ["orders:read", "orders:write",
                      "users:read", "users:write"],
}

def verify_token_scope(token: str, required_scope: str) -> bool:
    payload = decode_jwt(token)
    service = payload.get("sub")
    allowed = SCOPES.get(service, [])
    return required_scope in allowed
```

### 운영체제 프로세스

```bash
# 전용 서비스 계정 생성 (로그인 불가, 홈 없음)
useradd -r -s /sbin/nologin -M appuser

# 앱 디렉토리만 소유권 부여
chown -R appuser:appuser /opt/myapp
chmod 750 /opt/myapp
```

![최소 권한 코드 구현](/assets/posts/websec-least-privilege-code.svg)

## RBAC와 권한 검토

역할 기반 접근 제어(RBAC)로 권한을 역할에 묶고, 정기적으로 불필요한 권한을 회수한다.

```python
import datetime

def grant_temporary_access(user_id: str, resource: str,
                           hours: int = 4) -> str:
    expiry = datetime.datetime.utcnow() + datetime.timedelta(hours=hours)
    token = create_scoped_token(
        subject=user_id,
        scope=resource,
        expires_at=expiry,
    )
    audit_log(f"Temp access granted: {user_id} -> {resource}, expires {expiry}")
    return token
```

**흔한 실수**: "개발 편의상" 개발 계정에 전체 권한 부여 후 프로덕션 배포 시 수정 안 함 → 환경별로 별도 계정과 권한 관리가 필수다.

---

**지난 글:** [심층 방어(Defense in Depth): 다층 보안 전략](/posts/websec-defense-in-depth/)

**다음 글:** [제로 트러스트(Zero Trust): '아무도 믿지 마라'](/posts/websec-zero-trust/)

<br>
읽어주셔서 감사합니다. 😊
