---
title: "BOLA와 BFLA 심층 분석: 객체·기능 수준 권한 실패 완전 해부"
description: "BOLA(IDOR) 4가지 공격 유형과 UUID·소유자 검증·응답 필터링 방어, BFLA 권한 매트릭스 설계, 자동화 권한 테스트(Pytest/Autorize), 실제 침해 사례를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 7
type: "knowledge"
category: "Security"
tags: ["BOLA", "BFLA", "IDOR", "권한부여", "인가", "APITop10", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-owasp-api-top10/)에서 OWASP API Security Top 10 전체를 훑었다. BOLA(API1)와 BFLA(API5)는 침투 테스트에서 가장 자주 발견되는 취약점이면서, 적절히 방어하면 구조적으로 제거 가능한 취약점이기도 하다. 이 글에서는 두 취약점을 실제 공격 시나리오와 함께 철저히 해부한다.

## BOLA (Broken Object Level Authorization) — IDOR의 현대적 이름

BOLA는 예전에 IDOR(Insecure Direct Object Reference)로 불리던 취약점의 API 시대 명칭이다. 인증된 사용자가 **본인이 소유하지 않은 자원**에 접근하는 것을 막지 못하는 취약점이다.

실제 침해 사례로는 2021년 Instagram API 취약점이 있다. 개인 계정의 공개되지 않은 게시물을 타인이 API로 열람할 수 있었다. 2019년 Venmo는 거래 내역 API에서 인증 없이 다른 사용자 거래를 조회할 수 있었다.

![BOLA 공격 유형과 방어 전략](/assets/posts/websec-bola-attack-types.svg)

### BOLA 탐지 패턴

```python
# 취약한 패턴 1: 단순 ID 조회
user_data = db.get_user(request_user_id)

# 취약한 패턴 2: 권한 확인 후 다른 쿼리
if current_user.is_authenticated:
    order = Order.objects.get(pk=order_id)  # 소유자 확인 없음

# 취약한 패턴 3: 응답에 타인 ID 노출
return {"order_id": 1234, "customer_id": 5678, "details": ...}
# customer_id: 5678을 추출해서 다른 요청에 활용 가능
```

### 체계적 방어: 소유권 강제

```python
# Spring Security 예시: @PreAuthorize로 소유자 강제
@GetMapping("/api/documents/{docId}")
@PreAuthorize("@docSecurity.isOwner(#docId, authentication.name)")
public ResponseEntity<Document> getDocument(@PathVariable Long docId) {
    return ResponseEntity.ok(documentService.findById(docId));
}

// docSecurity Bean
@Component
public class DocumentSecurity {
    public boolean isOwner(Long docId, String username) {
        return documentRepo.existsByIdAndOwnerUsername(docId, username);
    }
}
```

응답에서 **타인의 ID나 참조 정보를 제거**하는 것도 중요하다. 다른 사용자의 `user_id`가 응답에 포함되면 공격자가 이를 수집해 추가 공격에 활용할 수 있다.

## BFLA (Broken Function Level Authorization)

BOLA가 "데이터 접근" 권한 실패라면, BFLA는 "기능 실행" 권한 실패다. 관리자만 쓸 수 있는 기능을 일반 사용자가 호출할 수 있는 경우다.

```python
# 취약: HTTP 메서드로만 구분, 역할 검증 없음
@app.route("/api/users/<int:uid>", methods=["DELETE"])
@login_required  # 로그인만 확인, 역할 미확인
def delete_user(uid):
    User.query.filter_by(id=uid).delete()
    return "", 204

# 안전: 역할 기반 인가
@app.route("/api/users/<int:uid>", methods=["DELETE"])
@requires_roles("admin", "superadmin")
def delete_user(uid):
    User.query.filter_by(id=uid).delete()
    return "", 204
```

![BFLA 방어: 권한 매트릭스 설계](/assets/posts/websec-bfla-matrix.svg)

### 권한 매트릭스 기반 설계

권한 매트릭스를 코드로 표현하면 실수를 줄이고 테스트 자동화가 쉬워진다.

```python
# Python: 역할 기반 접근 제어 데코레이터
from functools import wraps
from flask_login import current_user

ROLE_HIERARCHY = {"guest": 0, "user": 1, "manager": 2, "admin": 3}

def requires_min_role(min_role: str):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if not current_user.is_authenticated:
                return {"error": "Unauthorized"}, 401
            user_level = ROLE_HIERARCHY.get(current_user.role, -1)
            required_level = ROLE_HIERARCHY.get(min_role, 999)
            if user_level < required_level:
                return {"error": "Forbidden"}, 403
            return f(*args, **kwargs)
        return wrapper
    return decorator

@app.delete("/api/admin/users/<int:uid>")
@requires_min_role("admin")
def admin_delete_user(uid):
    ...
```

### 자동화 권한 테스트

수동 테스트는 신규 엔드포인트가 추가될 때마다 놓치기 쉽다. CI에 권한 매트릭스 테스트를 포함해 자동화한다.

```python
# Pytest 권한 매트릭스 테스트
import pytest

PERMISSION_MATRIX = [
    # (endpoint, method, role, expected_status)
    ("/api/products", "GET", "guest", 200),
    ("/api/orders/1", "GET", "guest", 401),
    ("/api/orders/1", "GET", "user", 200),     # 자신 주문
    ("/api/admin/users", "POST", "user", 403),
    ("/api/admin/users", "POST", "admin", 201),
]

@pytest.mark.parametrize("endpoint,method,role,expected", PERMISSION_MATRIX)
def test_permissions(client, endpoint, method, role, expected):
    token = get_token_for_role(role)
    headers = {"Authorization": f"Bearer {token}"}
    response = getattr(client, method.lower())(endpoint, headers=headers)
    assert response.status_code == expected, \
        f"{role} on {method} {endpoint}: got {response.status_code}, expected {expected}"
```

### Burp Suite Autorize 플러그인

침투 테스트에서 BOLA/BFLA를 자동으로 탐지하는 데 가장 효과적인 도구다. 관리자 토큰으로 요청을 보내면서 동시에 일반 사용자 토큰으로 같은 요청을 재전송해 응답을 비교한다. 상태 코드가 같고 응답 본문이 유사하면 BOLA/BFLA 취약점으로 표시된다.

BOLA와 BFLA는 "버그"가 아니라 **설계 실수**다. 처음 API를 설계할 때 권한 매트릭스를 명시하고, 모든 비즈니스 로직 계층에서 독립적으로 소유자와 역할을 검증하는 구조를 만드는 것이 유일한 근본 해결책이다.

---

**지난 글:** [OWASP API Security Top 10: 현실 공격 시나리오와 방어 코드](/posts/websec-owasp-api-top10/)

**다음 글:** [GraphQL 보안: 인트로스펙션·깊이 제한·배치 공격·인가 취약점 방어](/posts/websec-graphql-security/)

<br>
읽어주셔서 감사합니다. 😊
