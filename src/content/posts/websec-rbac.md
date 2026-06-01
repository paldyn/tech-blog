---
title: "RBAC: 역할 기반 접근 제어 설계와 구현"
description: "RBAC(Role-Based Access Control)의 구조와 원리를 설명하고, 역할 계층 구조, 권한 검사 미들웨어, Least Privilege 원칙 적용 방법을 Python 코드와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 10
type: "knowledge"
category: "Security"
tags: ["RBAC", "접근제어", "권한관리", "최소권한", "인가", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-single-sign-on/)에서 SSO로 중앙 인증을 구현하는 방법을 살펴봤다. 인증(Authentication)이 "누구인가"를 확인한다면, **인가(Authorization)**는 "무엇을 할 수 있는가"를 결정한다. RBAC은 현대 애플리케이션에서 가장 널리 쓰이는 인가 모델이다.

## RBAC이란

RBAC(Role-Based Access Control)는 권한을 **역할(Role)**에 묶고, 사용자에게 역할을 부여하는 접근 제어 모델이다. 사용자에게 직접 권한을 부여하는 대신 역할을 통해 간접 부여한다.

```
사용자 → 역할 → 권한 → 리소스
Alice  → admin → posts:delete → /posts/{id}
```

핵심 개념:
- **Principal**: 접근 주체 (사용자, 서비스 계정)
- **Role**: 권한의 묶음 (admin, editor, viewer)
- **Permission**: 특정 리소스에 대한 동작 (posts:write)
- **Resource**: 보호 대상 (API 엔드포인트, 파일)

![RBAC 구조와 접근 제어 모델 비교](/assets/posts/websec-rbac-structure.svg)

## 기본 구현

### 권한 정의와 역할 매핑

```python
from enum import Enum
from dataclasses import dataclass

class Permission(str, Enum):
    POSTS_READ   = "posts:read"
    POSTS_WRITE  = "posts:write"
    POSTS_DELETE = "posts:delete"
    USERS_READ   = "users:read"
    USERS_WRITE  = "users:write"
    USERS_DELETE = "users:delete"

ROLE_PERMISSIONS: dict[str, frozenset] = {
    "admin":   frozenset(Permission),       # 모든 권한
    "editor":  frozenset({
        Permission.POSTS_READ,
        Permission.POSTS_WRITE,
    }),
    "viewer":  frozenset({Permission.POSTS_READ}),
    "support": frozenset({
        Permission.POSTS_READ,
        Permission.USERS_READ,
    }),
}

def get_permissions(role: str) -> frozenset:
    return ROLE_PERMISSIONS.get(role, frozenset())

def has_permission(role: str, permission: Permission) -> bool:
    return permission in get_permissions(role)
```

### FastAPI 미들웨어

![RBAC 권한 검사 구현](/assets/posts/websec-rbac-code.svg)

```python
from fastapi import Depends, HTTPException
from typing import Callable

def require_permission(permission: Permission) -> Callable:
    async def dependency(current_user: dict = Depends(get_current_user)):
        if not has_permission(current_user["role"], permission):
            # 403이지 401이 아님: 인증은 됐지만 권한 없음
            raise HTTPException(
                status_code=403,
                detail=f"이 작업에 필요한 권한이 없습니다: {permission}"
            )
        return current_user
    return dependency

# 라우터에 적용
@router.get("/posts", dependencies=[Depends(require_permission(Permission.POSTS_READ))])
async def list_posts():
    ...

@router.delete("/posts/{id}", dependencies=[Depends(require_permission(Permission.POSTS_DELETE))])
async def delete_post(id: int):
    ...
```

## DB 기반 동적 역할 관리

```sql
-- 테이블 설계
CREATE TABLE roles (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(64) UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE permissions (
    id       SERIAL PRIMARY KEY,
    resource VARCHAR(64) NOT NULL,  -- "posts"
    action   VARCHAR(32) NOT NULL,  -- "write"
    UNIQUE (resource, action)
);

CREATE TABLE role_permissions (
    role_id       INT REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INT REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
    user_id    UUID REFERENCES users(id),
    role_id    INT  REFERENCES roles(id),
    granted_by UUID REFERENCES users(id),  -- 감사 추적
    granted_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);
```

```python
# DB에서 권한 로드 (Redis 캐시)
async def get_user_permissions(user_id: str, db, redis) -> set:
    cache_key = f"perms:{user_id}"
    cached = redis.get(cache_key)
    if cached:
        return set(json.loads(cached))
    
    rows = await db.fetch_all("""
        SELECT p.resource || ':' || p.action AS permission
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = $1
    """, user_id)
    
    perms = {row["permission"] for row in rows}
    redis.setex(cache_key, 300, json.dumps(list(perms)))  # 5분 캐시
    return perms
```

## 역할 계층 구조

상위 역할이 하위 역할의 권한을 상속하는 계층형 RBAC:

```python
ROLE_HIERARCHY = {
    "super_admin": ["admin"],
    "admin":       ["editor", "support"],
    "editor":      ["viewer"],
    "support":     ["viewer"],
    "viewer":      [],
}

def get_all_permissions(role: str, visited: set = None) -> frozenset:
    """역할 계층 순회로 모든 권한 수집"""
    if visited is None:
        visited = set()
    if role in visited:
        return frozenset()
    visited.add(role)
    
    perms = ROLE_PERMISSIONS.get(role, frozenset())
    for parent in ROLE_HIERARCHY.get(role, []):
        perms |= get_all_permissions(parent, visited)
    return perms
```

## 흔한 실수

### 1. 역할을 JWT에 포함하고 검증 없이 신뢰

```python
# 위험: 토큰의 role을 그대로 사용
role = jwt_payload["role"]  # 변조 가능?

# 올바름: 서명 검증된 토큰의 user_id로 DB 조회
user_id = jwt_payload["sub"]
role = db.get_user_role(user_id)  # 항상 DB에서 조회
```

### 2. 프론트엔드 권한 체크만 신뢰

```python
# 절대 안 됨: 서버에서 권한 검증 없이 신뢰
# 버튼 숨기기는 UX용, 보안은 서버에서
@router.delete("/posts/{id}")  # 권한 체크 없음!
async def delete_post(id: int):
    ...
```

### 3. 감사 로그 없는 권한 변경

```python
def assign_role(user_id: str, role: str, granted_by: str, db):
    db.execute(
        "INSERT INTO user_roles (user_id, role_id, granted_by) VALUES (...)",
        (user_id, get_role_id(role), granted_by)
    )
    # 감사 로그 필수
    audit_log(
        action="role_assigned",
        target_user=user_id,
        role=role,
        actor=granted_by,
    )
    # 캐시 무효화
    redis.delete(f"perms:{user_id}")
```

## 보안 체크리스트

- [ ] 모든 API 엔드포인트에 서버 측 권한 검사
- [ ] 최소 권한 원칙: 필요한 역할만 부여
- [ ] 역할 변경 시 감사 로그 기록
- [ ] 권한 캐시 무효화 (역할 변경 즉시)
- [ ] 역할 계층 순환 참조 방지
- [ ] 403(Forbidden)과 401(Unauthorized) 정확히 구분

---

**지난 글:** [SSO(Single Sign-On)](/posts/websec-single-sign-on/)

<br>
읽어주셔서 감사합니다. 😊
