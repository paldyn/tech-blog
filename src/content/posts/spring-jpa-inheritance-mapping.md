---
title: "JPA 상속 매핑 전략 완전 정복 — SINGLE_TABLE · JOINED · TABLE_PER_CLASS"
description: "JPA에서 객체의 상속 계층을 관계형 테이블에 매핑하는 세 가지 전략을 완전히 이해합니다. SINGLE_TABLE·JOINED·TABLE_PER_CLASS의 DB 스키마 구조, @Inheritance·@DiscriminatorColumn·@DiscriminatorValue 어노테이션 사용법, 각 전략의 성능과 장단점, 실무에서 @MappedSuperclass를 활용하는 패턴을 코드 예제와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["Spring", "JPA", "상속매핑", "Inheritance", "SINGLE_TABLE", "JOINED", "TABLE_PER_CLASS", "MappedSuperclass", "DiscriminatorColumn", "Hibernate"]
featured: false
draft: false
---

[지난 글](/posts/spring-jpa-cascade-orphan/)에서 cascade와 orphanRemoval을 다뤘습니다. 이번에는 JPA의 **상속 매핑 전략**을 다룹니다. 객체 지향에서는 상속이 자연스럽지만, 관계형 DB에는 상속 개념이 없습니다. JPA는 이 불일치를 해결하기 위해 세 가지 전략을 제공합니다.

## 왜 상속 매핑이 필요한가

쇼핑몰에서 `Item`이라는 추상 클래스가 있고, `Book`, `Movie`, `Album` 등이 이를 상속한다고 가정합니다. 객체 세계에서는 `List<Item>`으로 다양한 상품을 다룰 수 있지만, DB에서는 이를 어떻게 저장할지 전략을 선택해야 합니다.

```java
// 객체 계층 구조
abstract class Item { Long id; String name; int price; }
class Book extends Item { String author; String isbn; }
class Movie extends Item { String director; int runtime; }
class Album extends Item { String artist; }
```

JPA는 이 계층을 DB에 저장하는 방식으로 3가지 전략을 제공합니다.

![JPA 상속 매핑 전략 3가지 비교](/assets/posts/spring-jpa-inheritance-mapping-strategies.svg)

## SINGLE_TABLE 전략

모든 클래스를 **하나의 테이블**에 저장합니다. `DTYPE`(Discriminator) 컬럼으로 어떤 자식 클래스인지 구분합니다.

```java
@Entity
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "dtype")
public abstract class Item {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private int price;
}

@Entity
@DiscriminatorValue("BOOK")
public class Book extends Item {
    private String author;
    private String isbn;
}

@Entity
@DiscriminatorValue("MOVIE")
public class Movie extends Item {
    private String director;
    private int runtime;
}
```

생성되는 테이블과 쿼리:

```sql
-- 단일 테이블
CREATE TABLE item (
    dtype   VARCHAR(31) NOT NULL,
    id      BIGINT PRIMARY KEY,
    name    VARCHAR(255),
    price   INT,
    author  VARCHAR(255),  -- Book 전용, Movie면 NULL
    isbn    VARCHAR(255),  -- Book 전용
    director VARCHAR(255), -- Movie 전용
    runtime INT,           -- Movie 전용
    artist  VARCHAR(255)   -- Album 전용
);

-- 조회 시 JOIN 없음 (성능 우수)
SELECT * FROM item WHERE dtype = 'BOOK';
```

**장점**: 조회 성능 우수, 쿼리 단순  
**단점**: 자식 전용 컬럼에 `NOT NULL` 제약 불가, 테이블이 넓어짐

## JOINED 전략

부모 클래스와 자식 클래스 각각 **별도의 테이블**을 갖습니다. 자식 테이블은 부모 테이블의 PK를 FK로 참조합니다.

```java
@Entity
@Inheritance(strategy = InheritanceType.JOINED)
@DiscriminatorColumn(name = "dtype")
public abstract class Item {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String name;
    private int price;
}

@Entity
@DiscriminatorValue("BOOK")
public class Book extends Item {
    private String author;
    private String isbn;
}
```

생성되는 테이블과 쿼리:

```sql
-- 테이블 정규화
CREATE TABLE item   (dtype VARCHAR(31), id BIGINT PK, name, price);
CREATE TABLE book   (id BIGINT PK REFERENCES item(id), author, isbn);
CREATE TABLE movie  (id BIGINT PK REFERENCES item(id), director, runtime);

-- Book 조회 시 JOIN 필요
SELECT i.*, b.author, b.isbn
FROM item i
INNER JOIN book b ON i.id = b.id
WHERE i.dtype = 'BOOK';
```

**장점**: 정규화, NULL 컬럼 없음, 외래키 제약 가능  
**단점**: 조인 비용, 조회 쿼리 복잡도 증가

## TABLE_PER_CLASS 전략

구체 클래스마다 **독립적인 테이블**을 생성합니다. 부모 클래스의 테이블은 없으며, 공통 컬럼이 각 테이블에 중복 저장됩니다.

```java
@Entity
@Inheritance(strategy = InheritanceType.TABLE_PER_CLASS)
public abstract class Item {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String name;
    private int price;
}
```

```sql
-- 각각 독립 테이블 (공통 컬럼 중복)
CREATE TABLE book  (id, name, price, author, isbn);
CREATE TABLE movie (id, name, price, director, runtime);

-- 부모 타입으로 전체 조회 시 UNION ALL
SELECT id, name, price FROM book
UNION ALL
SELECT id, name, price FROM movie;
```

**JPA 명세에서 비권장**합니다. UNION 쿼리로 성능이 불리하고 공통 컬럼이 중복됩니다. 특수한 이유가 없다면 사용하지 않는 것이 좋습니다.

## 전략 선택 가이드

| 상황 | 권장 전략 |
|---|---|
| 자식 클래스 수가 적고 공통 조회가 많음 | `SINGLE_TABLE` |
| 정규화가 중요하고 각 자식에 제약조건 필요 | `JOINED` |
| 부모 타입으로 조회가 거의 없음 | `TABLE_PER_CLASS` (비권장) |

실무에서는 `SINGLE_TABLE`이 가장 많이 사용됩니다. 서비스 규모가 커지고 자식 클래스가 많아질 때 `JOINED`로 전환을 고려합니다.

## @MappedSuperclass — 상속과 다른 개념

`@MappedSuperclass`는 상속 매핑 전략과 다릅니다. 테이블을 생성하지 않고, **공통 필드만 상속**하는 것이 목적입니다.

![상속 매핑 코드 패턴](/assets/posts/spring-jpa-inheritance-mapping-code.svg)

```java
// 공통 감사(Auditing) 필드 — 테이블 없음
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseEntity {

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    @CreatedBy
    @Column(updatable = false)
    private String createdBy;
}

// BaseEntity를 상속받으면 해당 엔티티 테이블에 공통 컬럼 추가됨
@Entity
public class Post extends BaseEntity {
    @Id @GeneratedValue
    private Long id;
    private String title;
    // created_at, updated_at, created_by 컬럼이 post 테이블에 포함됨
}
```

`@MappedSuperclass`는 Spring Data JPA의 Auditing 기능과 함께 사용하면 생성일시, 수정일시, 작성자를 자동으로 관리할 수 있어 실무에서 매우 유용합니다.

## @Inheritance vs @MappedSuperclass

```java
// @Inheritance: 부모 타입으로 조회 가능 (다형성)
List<Item> items = itemRepository.findAll(); // Book + Movie + Album 모두
Item item = itemRepository.findById(1L).orElseThrow(); // 실제 타입으로 반환

// @MappedSuperclass: 부모 타입으로 조회 불가 (공통 필드 상속만)
// BaseEntityRepository 같은 건 없음 — 각 자식 Repository로만 조회
```

핵심 차이: `@Inheritance`는 **다형적 조회**가 필요할 때, `@MappedSuperclass`는 **코드 중복 제거**가 목적일 때 사용합니다.

## 정리

- **SINGLE_TABLE**: 단일 테이블 + DTYPE 컬럼 — 성능 우선, 자식 컬럼 nullable
- **JOINED**: 테이블 분리 + FK 조인 — 정규화 우선, 성능 일부 희생
- **TABLE_PER_CLASS**: 구체 클래스별 독립 테이블 — 비권장 (UNION 쿼리 성능 불리)
- `@DiscriminatorColumn`: 부모 테이블의 구분 컬럼 지정
- `@DiscriminatorValue`: 자식 클래스의 구분 값 지정
- `@MappedSuperclass`: 테이블 없이 공통 필드 상속 — Auditing, 공통 컬럼에 활용

---

**지난 글:** [JPA Cascade와 orphanRemoval 완전 정복](/posts/spring-jpa-cascade-orphan/)

<br>
읽어주셔서 감사합니다. 😊
