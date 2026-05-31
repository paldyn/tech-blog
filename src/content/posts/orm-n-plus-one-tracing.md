---
title: "N+1 문제 — 추적, 원인, 해결"
description: "ORM을 사용할 때 가장 흔한 성능 함정인 N+1 쿼리 문제의 발생 원인을 이해하고, Django·JPA·Prisma·SQLAlchemy별 탐지 방법과 Eager Loading, DataLoader 패턴으로 해결하는 전략을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["ORM", "N+1", "성능", "Eager Loading", "SQLAlchemy", "JPA", "Prisma", "Django"]
featured: false
draft: false
---

[지난 글](/posts/orm-sqlalchemy-python/)에서 SQLAlchemy의 Session과 쿼리 방식을 살펴봤습니다. ORM은 편리하지만 잘못 쓰면 심각한 성능 문제를 만들 수 있습니다. 그 중 가장 흔하고 눈에 잘 띄지 않는 것이 **N+1 문제**입니다. "목록을 조회하니 DB에 쿼리가 101번 나갔다"는 신고가 들어오는 많은 경우의 범인이 바로 이 패턴입니다.

## N+1이란 무엇인가

N+1 문제는 **한 번에 가져와야 할 데이터를 N번의 추가 쿼리로 나눠 가져오는 현상**입니다. 이름은 "1번의 목록 쿼리 + N번의 개별 쿼리"에서 유래합니다.

가장 전형적인 시나리오입니다.

```python
# Python (SQLAlchemy) — N+1 발생 예시
users = session.scalars(select(User).limit(100)).all()
for user in users:
    # user.orders에 접근할 때마다 Lazy Load → DB 쿼리 1번
    print(user.orders)  # 100번 반복 → 총 101번 쿼리
```

첫 번째 `select(User)` 실행 시에는 `orders`를 로딩하지 않습니다. `user.orders`에 처음 접근하는 순간 SQLAlchemy가 `SELECT * FROM orders WHERE user_id = ?` 쿼리를 실행합니다. 루프를 100번 돌면 100번 실행됩니다.

로그를 켜 보면 이렇게 보입니다.

```sql
-- 1번
SELECT users.id, users.name FROM users LIMIT 100;
-- 2~101번 (user.id = 1, 2, 3 ... 100)
SELECT orders.id, orders.amount FROM orders WHERE orders.user_id = 1;
SELECT orders.id, orders.amount FROM orders WHERE orders.user_id = 2;
...
```

![N+1 문제 발생과 해결 비교](/assets/posts/orm-n-plus-one-tracing-problem.svg)

## 왜 ORM에서 자주 발생하는가

ORM은 관계를 **지연 로딩(Lazy Loading)**으로 구현하는 경우가 많습니다. 처음 객체를 가져올 때는 연관된 레코드를 함께 로드하지 않고, 실제 접근 시점에 DB를 조회합니다. 이는 "불필요한 데이터는 로드하지 않는다"는 원칙에 따른 것이지만, 루프 안에서 관계를 접근하면 성능 재앙이 됩니다.

JPA Hibernate도 동일한 문제가 발생합니다.

```java
// JPA — N+1 발생
List<User> users = em.createQuery("SELECT u FROM User u").getResultList();
for (User user : users) {
    user.getOrders().size(); // 100번 추가 쿼리
}
```

## 탐지 방법

N+1을 조기에 발견하는 것이 중요합니다. 개발 환경에서 SQL 로깅을 활성화하는 것이 가장 기본입니다.

```python
# SQLAlchemy — Echo 모드로 SQL 로깅
engine = create_engine("postgresql://...", echo=True)

# 또는 Python 로깅 설정
import logging
logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)
```

로그에서 패턴이 반복된다면 N+1을 의심해야 합니다. 더 체계적인 탐지 도구도 있습니다.

- **Django**: django-debug-toolbar, nplusone 라이브러리
- **Rails**: bullet gem
- **Node.js**: prisma.$on('query', ...), TypeORM logging: true
- **APM**: Datadog APM, New Relic, Elastic APM (N+1을 자동 감지)

![N+1 탐지 방법 — 프레임워크별](/assets/posts/orm-n-plus-one-tracing-detection.svg)

## 해결 방법 1: Eager Loading

가장 직접적인 해결책은 처음부터 연관 데이터를 함께 로드하는 것입니다.

```python
# SQLAlchemy — selectinload (IN 방식: 2번 쿼리)
from sqlalchemy.orm import selectinload, joinedload

# 방법 A: selectinload (1:N 관계에서 권장)
# 쿼리 1: SELECT * FROM users LIMIT 100
# 쿼리 2: SELECT * FROM orders WHERE user_id IN (1, 2, ..., 100)
users = session.scalars(
    select(User).options(selectinload(User.orders)).limit(100)
).all()

# 방법 B: joinedload (1:1, M:1에서 권장)
# 쿼리 1: SELECT u.*, o.* FROM users u LEFT JOIN orders o ON o.user_id = u.id
orders = session.scalars(
    select(Order).options(joinedload(Order.user))
).all()
```

`selectinload`는 IN 절로 연관 데이터를 한 번에 가져오므로 1:N 관계에서 결과 행이 폭발적으로 늘어나지 않습니다. `joinedload`는 JOIN으로 한 쿼리에 모든 데이터를 담지만, 1:N 관계에서는 결과 집합 크기가 커질 수 있습니다.

Django에서의 해결 방법입니다.

```python
# Django — prefetch_related (IN 방식), select_related (JOIN 방식)
users = User.objects.prefetch_related('orders').all()[:100]
# → SELECT * FROM users LIMIT 100
# → SELECT * FROM orders WHERE user_id IN (1, 2, ..., 100)

# 1:1, M:1 관계
orders = Order.objects.select_related('user').all()
# → SELECT o.*, u.* FROM orders o INNER JOIN users u ON u.id = o.user_id
```

## 해결 방법 2: DataLoader 패턴

GraphQL이나 API 레이어에서 N+1이 발생하는 경우 **DataLoader**가 효과적입니다. DataLoader는 여러 개별 요청을 배치로 묶어 한 번에 DB를 조회합니다.

```javascript
// Node.js — DataLoader 패턴
const DataLoader = require('dataloader');

const orderLoader = new DataLoader(async (userIds) => {
  // 여러 요청을 묶어 한 번에 처리
  const orders = await prisma.order.findMany({
    where: { userId: { in: userIds } }
  });
  // userIds 순서에 맞게 결과 매핑
  return userIds.map(id => orders.filter(o => o.userId === id));
});

// GraphQL resolver
async function resolveUserOrders(user) {
  return orderLoader.load(user.id);  // 자동 배치 처리
}
```

같은 요청 사이클 내에서 `orderLoader.load(1)`, `orderLoader.load(2)` 등이 여러 번 호출되어도 DataLoader는 이를 하나의 배치로 합쳐 `IN (1, 2, ...)` 쿼리를 한 번만 실행합니다.

## 해결 방법 3: 배치 크기 조정

모든 연관 데이터를 한 번에 로드하기 어려울 때는 **배치 크기(batch size)**를 설정합니다. JPA에서는 `@BatchSize`, Hibernate에서는 `hibernate.default_batch_fetch_size`로 제어합니다.

```java
// JPA — @BatchSize로 IN 절 배치 크기 지정
@Entity
class User {
    @OneToMany(fetch = FetchType.LAZY)
    @BatchSize(size = 100)
    private List<Order> orders;
}
// → SELECT * FROM orders WHERE user_id IN (100개씩 나눠서 IN 처리)
```

## 언제 Lazy Loading이 옳은가

N+1이 무조건 나쁜 것은 아닙니다. 단일 레코드 조회 후 조건에 따라 연관 데이터를 로드해야 하는 경우, Lazy Loading이 불필요한 JOIN을 피합니다. 핵심은 **루프 안에서 연관 속성을 접근하는 패턴**을 피하는 것입니다. 코드 리뷰에서 이 패턴을 발견하면 즉시 Eager Loading으로 교체해야 합니다. 다음 글에서는 스키마 변경을 안전하게 관리하는 마이그레이션 도구인 Flyway, Liquibase, Alembic을 비교합니다.

---

**지난 글:** [SQLAlchemy — Python ORM의 표준](/posts/orm-sqlalchemy-python/)

**다음 글:** [Flyway · Liquibase · Alembic — DB 마이그레이션 도구](/posts/orm-migration-flyway-liquibase-alembic/)

<br>
읽어주셔서 감사합니다. 😊
