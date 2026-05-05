---
title: "다형성 관계(Polymorphic Relationship)"
description: "하나의 테이블이 여러 부모 테이블에 속할 수 있는 다형성 관계의 구현 방법—다형성 FK 안티패턴, Exclusive Arc, 수퍼타입 테이블 패턴—과 각각의 트레이드오프를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["sql", "polymorphic-relationship", "exclusive-arc", "supertype", "foreign-key", "database-design", "referential-integrity", "schema"]
featured: false
draft: false
---

[지난 글](/posts/sql-supertype-subtype/)에서 수퍼타입/서브타입 테이블 설계를 살펴봤다. 이번에는 그 연장선에 있는 **다형성 관계(Polymorphic Relationship)**—하나의 자식 테이블이 여러 부모 테이블과 관계를 맺어야 하는 상황—를 다룬다.

---

## 문제 상황

블로그 플랫폼에서 `댓글(Comment)`은 `글(Post)`에도, `상품(Product)`에도, `동영상(Video)`에도 달릴 수 있다. 이 "댓글의 대상이 여러 종류"라는 상황이 다형성 관계다.

```
Comment ---belongs_to---> Post     (게시글 댓글)
Comment ---belongs_to---> Product  (상품 댓글)
Comment ---belongs_to---> Video    (영상 댓글)
```

---

## 안티패턴: 다형성 FK

Rails 등의 ORM이 기본으로 생성하는 `target_type / target_id` 패턴이다.

![다형성 관계 문제와 해법](/assets/posts/sql-polymorphic-relationships-problem.svg)

```sql
CREATE TABLE comments (
    id          BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    target_type VARCHAR(20) NOT NULL,  -- 'Post', 'Product', 'Video'
    target_id   BIGINT      NOT NULL,  -- 대상의 id
    author_id   BIGINT      NOT NULL REFERENCES users(id),
    body        TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 글에 달린 댓글
SELECT * FROM comments WHERE target_type = 'Post' AND target_id = 42;
```

**문제점**은 `target_id`에 `REFERENCES` 제약을 걸 수 없다는 것이다. `target_type = 'Post'`일 때 `posts.id`를, `target_type = 'Product'`일 때 `products.id`를 가리켜야 하는데, SQL 외래키는 하나의 테이블만 참조할 수 있다.

결과적으로:
- 삭제된 게시글을 참조하는 댓글(고아 레코드)이 생겨도 DB가 감지 못함
- 잘못된 `target_type` 값이 들어가도 DB가 막을 방법 없음
- `target_id`에 인덱스 효율 저하(낮은 선택도)

---

## 해법 1: Exclusive Arc (배타적 FK)

각 부모 테이블에 대응하는 FK 컬럼을 분리하고, 정확히 하나만 NOT NULL이어야 한다는 CHECK 제약을 추가한다.

```sql
CREATE TABLE comments (
    id         BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    author_id  BIGINT REFERENCES users(id),
    body       TEXT   NOT NULL,
    -- 배타적 FK: 하나만 NOT NULL
    post_id    BIGINT REFERENCES posts(id)    ON DELETE CASCADE,
    product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
    video_id   BIGINT REFERENCES videos(id)   ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- 정확히 1개만 SET
    CONSTRAINT ck_exactly_one_target CHECK (
        ( (post_id    IS NOT NULL)::INT
        + (product_id IS NOT NULL)::INT
        + (video_id   IS NOT NULL)::INT ) = 1
    )
);

-- 각 FK에 인덱스
CREATE INDEX ON comments (post_id)    WHERE post_id    IS NOT NULL;
CREATE INDEX ON comments (product_id) WHERE product_id IS NOT NULL;
CREATE INDEX ON comments (video_id)   WHERE video_id   IS NOT NULL;
```

참조 무결성이 보장되지만, 새 부모 타입이 추가될 때마다 컬럼을 추가해야 한다는 단점이 있다.

---

## 해법 2: 수퍼타입 테이블로 추상화 (권장)

다형성의 대상을 수퍼타입 테이블(`commentable` 등)로 추상화해서 `Comment`가 항상 이 수퍼타입에만 FK를 갖도록 한다.

![수퍼타입으로 다형성 해소](/assets/posts/sql-polymorphic-relationships-supertype.svg)

```sql
-- 수퍼타입: 댓글 달릴 수 있는 모든 객체
CREATE TABLE commentables (
    id          BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    entity_type VARCHAR(20) NOT NULL,  -- 'post' | 'product' | 'video'
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Post는 commentables에 선 삽입 후 FK 보유
CREATE TABLE posts (
    commentable_id BIGINT PRIMARY KEY REFERENCES commentables(id) ON DELETE CASCADE,
    title          VARCHAR(300) NOT NULL,
    content        TEXT         NOT NULL,
    author_id      BIGINT       NOT NULL REFERENCES users(id)
);

CREATE TABLE products (
    commentable_id BIGINT PRIMARY KEY REFERENCES commentables(id) ON DELETE CASCADE,
    name           VARCHAR(200) NOT NULL,
    price          NUMERIC(10,2) NOT NULL
);

-- Comment는 수퍼타입에만 FK
CREATE TABLE comments (
    id             BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    commentable_id BIGINT NOT NULL REFERENCES commentables(id) ON DELETE CASCADE,
    author_id      BIGINT NOT NULL REFERENCES users(id),
    body           TEXT   NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

이제 모든 FK가 정상적인 참조 무결성을 갖는다.

```sql
-- 글에 달린 댓글 조회
SELECT c.id, c.body, c.created_at
  FROM posts p
  JOIN comments c ON c.commentable_id = p.commentable_id
 WHERE p.commentable_id = 42;

-- 특정 댓글의 대상이 무엇인지 확인
SELECT ca.entity_type,
       COALESCE(p.title, pr.name) AS target_name
  FROM comments c
  JOIN commentables ca ON ca.id = c.commentable_id
  LEFT JOIN posts     p  ON p.commentable_id  = c.commentable_id
  LEFT JOIN products  pr ON pr.commentable_id = c.commentable_id
 WHERE c.id = 99;
```

---

## 해법 3: 타입별 교차 테이블

교차 테이블을 타입별로 나누는 방법이다. Exclusive Arc의 대안으로 사용된다.

```sql
-- 게시글-댓글 연결 테이블
CREATE TABLE post_comments (
    comment_id BIGINT PRIMARY KEY REFERENCES comments(id),
    post_id    BIGINT NOT NULL    REFERENCES posts(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 상품-댓글 연결 테이블
CREATE TABLE product_comments (
    comment_id BIGINT PRIMARY KEY REFERENCES comments(id),
    product_id BIGINT NOT NULL    REFERENCES products(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`comments` 테이블은 공통 속성만 갖고, 연결은 별도 테이블이 담당한다. 타입 추가 시 연결 테이블만 추가하면 된다.

---

## 세 가지 해법 비교

| 방법 | 참조 무결성 | 확장성 | 쿼리 복잡도 |
|------|-----------|--------|------------|
| 다형성 FK (안티패턴) | 없음 | 높음 | 낮음 |
| Exclusive Arc | 있음 | 낮음(컬럼 추가) | 보통 |
| 수퍼타입 추상화 | 있음 | 높음 | 보통 |
| 타입별 교차 테이블 | 있음 | 높음(테이블 추가) | 보통 |

참조 무결성이 중요하다면 안티패턴은 피한다. 새 타입이 자주 추가된다면 수퍼타입 추상화가 가장 확장성이 좋다.

---

**지난 글:** [수퍼타입/서브타입 테이블 설계](/posts/sql-supertype-subtype/)

**다음 글:** [풀스캔(Full Scan) 비용 이해](/posts/sql-fullscan-cost/)

<br>
읽어주셔서 감사합니다. 😊
