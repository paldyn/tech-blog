---
title: "SQLAlchemy ORM: 파이썬으로 SQL 다루기"
description: "Python에서 가장 널리 쓰이는 데이터베이스 툴킷 SQLAlchemy. Core와 ORM 두 층, 모델 매핑, 그리고 변경을 모았다 한 번에 반영하는 Session과 트랜잭션까지 핵심을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 10
type: "knowledge"
category: "Python"
tags: ["SQLAlchemy", "ORM", "데이터베이스", "Session", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-celery-tasks/)에서 무거운 작업을 백그라운드로 떼어 내는 법을 봤다면, 이 묶음의 마지막인 이번 글에서는 거의 모든 백엔드의 심장인 데이터베이스로 다시 돌아온다. 앞서 Django ORM을 봤지만, Django 밖에서 — 예컨대 FastAPI나 Flask에서 — 데이터베이스를 다룰 때 사실상 표준으로 쓰이는 것이 SQLAlchemy다. 단순한 ORM을 넘어, SQL을 세밀하게 다루는 저수준 도구까지 한 패키지에 담은 강력한 툴킷이다.

## 두 개의 층: Core와 ORM

SQLAlchemy의 특징은 서로 다른 추상화 수준의 두 층을 함께 제공한다는 점이다. 객체로 데이터를 다루는 **ORM** 층과, SQL을 표현식으로 조립하는 **Core** 층이다.

![SQLAlchemy의 두 층](/assets/posts/python-sqlalchemy-orm-layers.svg)

대부분의 애플리케이션 코드는 객체 중심의 ORM 층에서 작성한다. 하지만 복잡한 집계 쿼리나 성능이 중요한 부분에서는 Core 층으로 내려가 SQL을 더 직접 제어할 수 있다. 두 층 모두 같은 엔진(Engine)을 통해 데이터베이스와 연결되므로, 한 프로젝트 안에서 필요에 따라 자유롭게 오갈 수 있다. "쉬울 땐 ORM, 까다로울 땐 Core"라는 유연함이 SQLAlchemy를 오래 사랑받게 한 이유다.

## 엔진과 모델 정의

시작은 데이터베이스로 가는 통로인 엔진을 만들고, 테이블에 대응하는 모델 클래스를 선언하는 것이다. 최신(2.0) 스타일은 타입 힌트를 활용한다.

```python
from sqlalchemy import create_engine, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

engine = create_engine("sqlite:///app.db", echo=True)

class Base(DeclarativeBase):
    pass

class Book(Base):
    __tablename__ = "books"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    price: Mapped[int]

Base.metadata.create_all(engine)   # 테이블 생성
```

`create_engine`의 인자는 연결 문자열이고, `sqlite://`를 `postgresql://`이나 `mysql://`로 바꾸면 같은 코드가 다른 DB에서 돈다. `echo=True`는 실행되는 SQL을 콘솔에 찍어 줘서 학습과 디버깅에 유용하다. 모델은 `Base`를 상속하고 `Mapped[...]` 타입으로 컬럼을 선언한다.

## Session: 변경을 모았다가 한 번에

SQLAlchemy ORM의 심장은 **Session**이다. 객체의 추가·수정·삭제를 곧바로 DB에 보내지 않고 세션에 모아 두었다가, `commit()` 시점에 하나의 트랜잭션으로 반영한다. 이 방식을 작업 단위(unit of work) 패턴이라 부른다.

![Session: 변경을 모았다가 한 번에](/assets/posts/python-sqlalchemy-orm-session.svg)

```python
from sqlalchemy.orm import Session

with Session(engine) as session:
    book = Book(title="SQLAlchemy 입문", price=22000)
    session.add(book)        # 세션에 담기 (아직 DB 반영 X)
    session.commit()         # 이때 한 트랜잭션으로 INSERT 실행
```

`add`로 변경을 쌓아 두고 `commit`으로 한 번에 내보내므로, 여러 작업이 **모두 성공하거나 모두 되돌아가는** 원자성이 보장된다. 중간에 오류가 나면 `session.rollback()`으로 깔끔하게 되돌릴 수 있다. `with Session(...)` 블록을 쓰면 세션이 자동으로 닫혀 자원 누수를 막는다.

## 조회: select로 데이터를 읽는다

2.0 스타일의 조회는 `select()` 표현식과 `session.scalars()`/`execute()`를 함께 쓴다.

```python
from sqlalchemy import select

with Session(engine) as session:
    # 단건
    book = session.get(Book, 1)              # 기본 키로 한 건

    # 조건 조회
    stmt = select(Book).where(Book.price < 20000).order_by(Book.title)
    cheap = session.scalars(stmt).all()       # 결과를 객체 리스트로

    for b in cheap:
        print(b.title, b.price)
```

`select(Book).where(...)`처럼 파이썬 코드로 SQL을 조립하면, SQLAlchemy가 이를 실제 SQL로 번역해 실행한다. `where`, `order_by`, `limit` 같은 메서드를 이어 붙여 조건을 표현하고, `scalars(...).all()`로 모델 객체의 리스트를 받는다. SQL 문자열을 직접 쓰지 않아도 되고, 그러면서도 만들어지는 SQL을 `echo`로 확인하며 다듬을 수 있다.

SQLAlchemy의 힘은 추상화의 폭에 있다. 객체로 편하게 다루는 ORM과, SQL을 직접 제어하는 Core를 한 도구 안에서 골라 쓰고, Session으로 트랜잭션을 안전하게 묶는다. 특정 웹 프레임워크에 묶이지 않아 어디서든 같은 방식으로 데이터를 다룰 수 있다는 점도 큰 장점이다. 이렇게 Flask부터 SQLAlchemy까지, 파이썬으로 웹 서비스를 떠받치는 핵심 도구들을 한 바퀴 돌아봤다. 각각은 작은 한 조각이지만, 이들을 엮으면 요청을 받아 데이터를 다루고 응답을 내보내는 온전한 서비스가 완성된다.

---

**지난 글:** [Celery: 무거운 작업을 백그라운드로](/posts/python-celery-tasks/)

<br>
읽어주셔서 감사합니다. 😊
