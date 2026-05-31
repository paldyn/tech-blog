---
title: "심층 방어(Defense in Depth): 다층 보안 전략"
description: "단일 보안 통제의 한계를 극복하는 심층 방어 원칙을 5계층 구조로 설명합니다. 경계·네트워크·호스트·애플리케이션·데이터 각 계층의 역할과 실제 구현 방법을 코드와 함께 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 1
type: "knowledge"
category: "Security"
tags: ["심층방어", "DefenseInDepth", "보안계층", "웹보안", "다층보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-attack-surface/)에서 공격 표면을 줄이는 전략을 살펴봤다. 하지만 공격 표면이 아무리 작아도 100% 차단은 불가능하다. 공격자가 기어코 한 계층을 통과했을 때 무슨 일이 벌어지는가? 심층 방어(Defense in Depth, DiD)는 이 질문에서 출발한다.

## 단일 방어선의 함정

성을 지킬 때 성벽 하나만 믿는 왕은 없다. 해자, 성벽, 망루, 내성, 보물 창고 잠금장치—모든 방어선을 차례로 통과해야 한다. 보안도 마찬가지다. 방화벽 하나만 믿는 시스템은 방화벽 규칙 하나가 잘못되는 순간 모든 데이터가 노출된다. **심층 방어는 단일 실패점(SPOF)을 제거하기 위해 여러 독립적인 보안 계층을 겹쳐 쌓는 전략이다.**

![심층 방어 5계층 구조](/assets/posts/websec-defense-in-depth-layers.svg)

## 5계층 보안 모델

### ① 경계 보안 (Perimeter Security)

가장 바깥쪽 계층이다. 인터넷과 내부 시스템 사이의 첫 번째 관문으로, 여기서 명백한 악성 트래픽을 차단한다.

- **방화벽**: 허용 목록(allowlist) 기반으로 불필요한 포트/프로토콜 차단
- **WAF (Web Application Firewall)**: SQL Injection, XSS 등 알려진 공격 패턴 필터링
- **DDoS 방어**: 비정상적인 트래픽 폭주 감지 및 차단
- **IDS/IPS**: 침입 탐지 및 방지 시스템

```nginx
# Nginx 속도 제한 설정
http {
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
}
server {
    location /api/login {
        limit_req zone=login burst=3 nodelay;
    }
}
```

### ② 네트워크 보안 (Network Security)

경계를 통과한 트래픽이 내부 네트워크에서 자유롭게 이동하지 못하도록 제한한다.

```bash
# iptables: DB 서버는 앱 서버에서만 접근 허용
iptables -A INPUT -p tcp --dport 5432 \
  -s 10.0.1.0/24 -j ACCEPT
iptables -A INPUT -p tcp --dport 5432 -j DROP
```

### ③ 호스트 보안 (Host Security)

불필요한 서비스를 비활성화하고 OS를 최소화한다.

```bash
# 불필요한 서비스 비활성화
systemctl disable avahi-daemon bluetooth
# SSH 루트 로그인 차단
sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
```

### ④ 애플리케이션 보안 (Application Security)

코드 수준의 방어선이다. 개발자가 직접 통제할 수 있는 가장 중요한 계층이기도 하다.

```python
# FastAPI: Pydantic으로 입력 자동 검증
from pydantic import BaseModel, field_validator
import re

class UserInput(BaseModel):
    username: str

    @field_validator('username')
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        if not re.match(r'^[a-zA-Z0-9_]{3,20}$', v):
            raise ValueError('invalid username')
        return v
```

### ⑤ 데이터 보안 (Data Security)

가장 안쪽 계층으로, 모든 위 계층이 뚫려도 데이터 암호화가 피해를 최소화한다.

```python
import bcrypt

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode(), salt).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())
```

![심층 방어 코드 패턴](/assets/posts/websec-defense-in-depth-code.svg)

## 계층 간 독립성의 중요성

각 계층은 **다른 계층이 실패했다는 가정** 하에 설계해야 한다. "방화벽이 있으니 입력 검증은 필요 없다"는 생각이 가장 위험하다.

| 계층 | 대표 기술 | 방어 대상 |
|------|-----------|-----------|
| 경계 | WAF, 방화벽, IPS | 알려진 공격 패턴, DDoS |
| 네트워크 | VLAN, ACL, VPN | 내부 횡이동 |
| 호스트 | 패치관리, EDR | 시스템 취약점 |
| 애플리케이션 | 입력검증, 인증 | SQL Injection, XSS |
| 데이터 | 암호화, 해싱 | 데이터 유출 |

---

**지난 글:** [공격 표면 이해하기](/posts/websec-attack-surface/)

**다음 글:** [최소 권한 원칙(PoLP): 권한을 최소화하는 이유](/posts/websec-least-privilege/)

<br>
읽어주셔서 감사합니다. 😊
