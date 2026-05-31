---
title: "SQLAlchemy — Python ORM의 표준"
description: "Python 데이터 생태계의 핵심 ORM인 SQLAlchemy의 Core/ORM 이중 레이어, Session과 Unit of Work 패턴, 2.0 스타일 쿼리, async 지원, 그리고 FastAPI·Flask와의 통합을 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["ORM", "SQLAlchemy", "Python", "FastAPI", "Flask", "데이터베이스"]
featured: false
draft: false
---

[지난 글](/posts/orm-sequelize-prisma-typeorm/)에서 Node.js 생태계의 ORM 세 가지를 비교했습니다. Python 진영에서는 **SQLAlchemy**가 사실상 표준입니다. 2005년에 처음 등장한 이래 Django ORM, Peewee, Tortoise-ORM 같은 대안이 등장했지만 복잡한 시스템에서는 SQLAlchemy가 선택받는 이유가 있습니다. 이번 글에서는 SQLAlchemy의 아키텍처와 현대적인 사용 방법을 살펴봅니다.

## SQLAlchemy의 이중 레이어

SQLAlchemy는 두 개의 독립적인 레이어로 구성됩니다.

- **Core**: SQL Expression Language. 테이블과 쿼리를 Python 객체로 표현하지만 ORM 매핑은 없습니다. 성능이 중요한 배치나 Raw SQL에 가까운 제어가 필요할 때 Core만 단독으로 사용합니다.
- **ORM**: Declarative 모델 클래스를 통해 Python 객체와 DB 행을 매핑합니다. Session이 Unit of Work 패턴을 구현해 변경 사항을 추적하고 commit 시 일괄 반영합니다.

이 구조 덕분에 같은 코드베이스에서 간단한 CRUD는 ORM으로, 복잡한 집계·리포팅 쿼리는 Core나 `text()`로 처리할 수 있습니다.

![SQLAlchemy 레이어 구조](/assets/posts/orm-sqlalchemy-python-architecture.svg)

## 모델 정의 (SQLAlchemy 2.0)

SQLAlchemy 2.0은 `DeclarativeBase`와 `mapped_column()`을 도입해 타입 힌트 기반의 선언 방식을 지원합니다.

```python
from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id:         Mapped[int]         = mapped_column(primary_key=True)
    name:       Mapped[str]         = mapped_column(String(100))
    email:      Mapped[str]         = mapped_column(String(200), unique=True)
    is_active:  Mapped[bool]        = mapped_column(default=True)
    orders:     Mapped[list["Order"]] = relationship(back_populates="user")

class Order(Base):
    __tablename__ = "orders"

    id:      Mapped[int]   = mapped_column(primary_key=True)
    user_id: Mapped[int]   = mapped_column(ForeignKey("users.id"))
    amount:  Mapped[float]
    user:    Mapped["User"] = relationship(back_populates="orders")
```

`Mapped[int]`처럼 타입 힌트를 사용하면 mypy나 pyright가 `user.id`의 타입을 `int`로 추론합니다. SQLAlchemy 1.x의 `Column(Integer, ...)` 방식과 달리 에디터 자동완성이 훨씬 잘 동작합니다.

## Session과 Unit of Work

Session은 SQLAlchemy ORM의 핵심입니다. "무엇이 변경되었는지"를 추적하는 **Identity Map**을 내부에 유지하며, `session.commit()` 시점에 변경 사항을 최소한의 SQL로 DB에 반영합니다.

```python
from sqlalchemy.orm import Session

with Session(engine) as session:
    # 신규 레코드 추가
    user = User(name="김철수", email="kim@example.com")
    session.add(user)

    # 기존 레코드 수정 — session이 변경을 감지
    existing = session.get(User, 1)
    existing.name = "김철수(수정)"  # commit 시 UPDATE 자동 발생

    session.commit()  # INSERT + UPDATE 한 번에
```

`session.get(User, 1)`은 Identity Map을 먼저 조회하므로, 같은 트랜잭션 내에서 동일 PK를 두 번 조회해도 DB를 두 번 치지 않습니다.

![SQLAlchemy ORM vs Core 코드 패턴](/assets/posts/orm-sqlalchemy-python-session.svg)

## 2.0 스타일 쿼리

SQLAlchemy 1.x의 `session.query(User)` 방식은 2.0에서 deprecated되고, `select(User)` 방식이 표준이 되었습니다. Core와 ORM이 동일한 `select()` 인터페이스를 공유합니다.

```python
from sqlalchemy import select, and_

# JOIN + 필터링
stmt = (
    select(User, Order)
    .join(Order, User.id == Order.user_id)
    .where(and_(User.is_active == True, Order.amount > 10000))
    .order_by(Order.amount.desc())
    .limit(50)
)

with Session(engine) as session:
    results = session.execute(stmt).all()
    for user, order in results:
        print(user.name, order.amount)
```

집계 쿼리는 Core 표현식을 그대로 사용합니다.

```python
from sqlalchemy import func

stmt = (
    select(User.id, func.count(Order.id).label("order_count"),
           func.sum(Order.amount).label("total"))
    .outerjoin(Order)
    .group_by(User.id)
    .having(func.count(Order.id) >= 3)
)
```

## Async 지원

SQLAlchemy 1.4부터 `AsyncSession`을 지원합니다. FastAPI와 함께 사용하는 표준 패턴입니다.

```python
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

engine = create_async_engine("postgresql+asyncpg://user:pw@host/db")
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# FastAPI 의존성 주입
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

# 라우터
@router.get("/users")
async def list_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.is_active == True))
    return result.scalars().all()
```

`expire_on_commit=False`는 FastAPI에서 중요합니다. 기본 설정이면 commit 후 속성이 만료되어 응답 직렬화 시 추가 쿼리가 발생하기 때문입니다.

## Alembic으로 마이그레이션

SQLAlchemy의 공식 마이그레이션 도구는 **Alembic**입니다. 모델 변경 사항을 감지해 마이그레이션 스크립트를 자동 생성합니다.

```bash
# 마이그레이션 파일 생성 (autogenerate)
alembic revision --autogenerate -m "add_phone_column"

# 마이그레이션 적용
alembic upgrade head

# 이전 버전으로 롤백
alembic downgrade -1
```

생성된 마이그레이션 파일은 `upgrade()`와 `downgrade()` 함수를 가지며, Core 표현식이나 Raw SQL 양쪽으로 작성할 수 있습니다.

## Django ORM과의 차이

| | SQLAlchemy | Django ORM |
|---|---|---|
| 설계 철학 | 유연성·저수준 제어 | 편의성·Rails-like |
| 설정 | 명시적 Engine/Session | settings.py로 자동 |
| Raw SQL | `text()` · `engine.connect()` | `Manager.raw()` |
| 마이그레이션 | Alembic (별도) | `makemigrations` (내장) |
| 복잡한 쿼리 | 매우 강력 | 제한적, `.extra()` |

SQLAlchemy는 Django처럼 한 프레임워크 안에 모든 것이 묶여 있지 않으므로 Flask, FastAPI, Starlette 어디서든 쓸 수 있고, 비동기 엔진 교체도 자유롭습니다. 다음 글에서는 ORM을 사용할 때 반드시 알아야 하는 N+1 문제를 추적하고 해결하는 방법을 살펴봅니다.

---

**지난 글:** [Sequelize · Prisma · TypeORM — Node.js ORM 3파전](/posts/orm-sequelize-prisma-typeorm/)

**다음 글:** [N+1 문제 추적과 해결](/posts/orm-n-plus-one-tracing/)

<br>
읽어주셔서 감사합니다. 😊
