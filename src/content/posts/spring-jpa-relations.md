---
title: "Spring JPA 연관 관계 매핑 완전 정복"
description: "JPA의 @ManyToOne, @OneToMany, @OneToOne, @ManyToMany 연관 관계 매핑을 완전히 이해합니다. 연관관계 주인(FK 주인) 개념, 단방향/양방향 차이, 연관 편의 메서드 작성법, @ManyToMany 대신 중간 엔티티를 사용해야 하는 이유, 실무에서 자주 발생하는 매핑 오류를 코드와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["Spring", "JPA", "연관관계", "ManyToOne", "OneToMany", "OneToOne", "ManyToMany", "연관관계주인", "mappedBy", "JoinColumn", "Hibernate"]
featured: false
draft: false
---

[지난 글](/posts/spring-jpa-first-cache-dirty-checking/)에서 1차 캐시와 변경 감지의 내부 동작을 정리했습니다. 이제 JPA에서 가장 많은 시간을 투자해야 하는 주제인 **연관 관계 매핑**을 다룹니다. 객체의 참조와 테이블의 외래 키(FK)를 어떻게 연결하는지, 연관관계의 주인은 누구인지, 양방향 관계에서 어떻게 양쪽을 일관되게 유지하는지를 코드 중심으로 살펴봅니다.

## 연관 관계 매핑의 핵심 개념

객체는 **참조**로 관계를 표현하고, 테이블은 **외래 키(FK)**로 관계를 표현합니다. 이 차이 때문에 JPA는 어느 쪽이 FK를 관리하는지 명확히 지정하도록 요구합니다.

### 연관관계 주인

**연관관계 주인**은 FK를 실제로 보유하는 쪽입니다. 주인만이 DB에 FK 값을 반영할 수 있습니다. 주인이 아닌 쪽은 `mappedBy`를 사용하여 읽기 전용임을 명시합니다.

```java
// 연관관계 주인: Order (member_id FK 보유)
@Entity
public class Order {
    @Id @GeneratedValue
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)   // FK 주인
    @JoinColumn(name = "member_id")       // FK 컬럼명 지정
    private Member member;
}

// 주인이 아닌 쪽: Member (mappedBy로 읽기 전용 선언)
@Entity
public class Member {
    @Id @GeneratedValue
    private Long id;

    @OneToMany(mappedBy = "member")  // "member"는 Order.member 필드명
    private List<Order> orders = new ArrayList<>();
}
```

**규칙:** `@ManyToOne` 쪽이 항상 연관관계의 주인입니다. `@OneToMany` 쪽은 항상 `mappedBy`를 가집니다.

## @ManyToOne / @OneToMany

가장 흔한 연관 관계입니다. 회원(1)과 주문(N), 게시글(1)과 댓글(N) 등이 해당합니다.

![JPA 연관 관계 매핑 개요](/assets/posts/spring-jpa-relations-overview.svg)

### 단방향 @ManyToOne (권장)

단방향으로 충분한 경우 `@ManyToOne`만 설정합니다. 쿼리가 단순하고 관계 관리가 명확합니다.

```java
@Entity
public class Order {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private int amount;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    // 생성자로 관계 설정 (setter 최소화)
    public Order(Member member, int amount) {
        this.member = member;
        this.amount = amount;
    }
}
```

```java
@Transactional
public Order placeOrder(Long memberId, int amount) {
    Member member = memberRepository.findById(memberId).orElseThrow();
    Order order = new Order(member, amount);
    return orderRepository.save(order);
    // INSERT INTO orders (member_id, amount) VALUES (?, ?)
}
```

### 양방향 @OneToMany (필요시만)

`Member`에서 `orders`를 직접 탐색해야 할 때 `@OneToMany`를 추가합니다. 하지만 편의를 위해 무조건 양방향으로 만드는 것은 피해야 합니다. 양방향 관계는 관리 포인트가 두 배가 됩니다.

```java
@Entity
public class Member {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String name;

    @OneToMany(mappedBy = "member", cascade = CascadeType.ALL,
               orphanRemoval = true)
    private List<Order> orders = new ArrayList<>();

    // 연관 편의 메서드: 양쪽을 동시에 세팅
    public void addOrder(Order order) {
        orders.add(order);
        order.setMember(this);
    }

    public void removeOrder(Order order) {
        orders.remove(order);
        order.setMember(null);
    }
}
```

### 양방향 매핑의 핵심 — 연관 편의 메서드

![양방향 연관 관계 주의사항](/assets/posts/spring-jpa-relations-bidirectional.svg)

양방향 관계에서 한쪽만 세팅하면 **같은 트랜잭션 내 1차 캐시에서 불일치**가 발생합니다. DB 커밋 후에는 정상이지만, 커밋 전에 컬렉션을 조회하면 방금 추가한 엔티티가 보이지 않습니다.

```java
// 잘못된 예 — FK 주인만 세팅
order.setMember(member);
// member.getOrders()에 order가 없음 → 트랜잭션 내 불일치

// 올바른 예 — 편의 메서드 사용
member.addOrder(order);  // 내부에서 양쪽 동시 세팅
```

## @OneToOne

두 엔티티가 1:1 관계일 때 사용합니다. FK를 어느 테이블에 둘지 결정해야 합니다. 주로 덜 접근되는 쪽에 FK를 둡니다.

```java
@Entity
public class User {
    @Id @GeneratedValue
    private Long id;
    private String username;

    // mappedBy → FK 없음, 읽기 전용
    @OneToOne(mappedBy = "user", cascade = CascadeType.ALL,
              fetch = FetchType.LAZY)
    private UserProfile profile;
}

@Entity
public class UserProfile {
    @Id @GeneratedValue
    private Long id;
    private String bio;
    private String avatarUrl;

    // FK 주인 — user_id FK를 user_profile 테이블에 보유
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", unique = true)
    private User user;
}
```

`@OneToOne`에서 주인이 아닌 쪽(`mappedBy`가 있는 쪽)은 **기본이 즉시 로딩(EAGER)**입니다. 반드시 `fetch = FetchType.LAZY`로 명시하세요. Hibernate는 `@OneToOne(mappedBy)` + LAZY를 지원하지만, 프록시 생성 제약으로 null 가능 여부에 따라 동작이 달라질 수 있습니다. `@OneToOne`은 가능하면 조회 시 항상 두 테이블을 JOIN하는 것으로 설계하는 것이 안전합니다.

## @ManyToMany — 실무에서 직접 사용 금지

`@ManyToMany`는 중간 조인 테이블을 자동으로 생성합니다. 단순 매핑은 쉽지만 중간 테이블에 추가 컬럼(등록일, 상태 등)을 넣을 수 없고, 세밀한 제어가 어렵습니다.

```java
// ❌ 사용하지 말 것
@Entity
public class Student {
    @ManyToMany
    @JoinTable(name = "student_course",
               joinColumns = @JoinColumn(name = "student_id"),
               inverseJoinColumns = @JoinColumn(name = "course_id"))
    private List<Course> courses;
}
```

**실무 대안: 중간 엔티티로 분리**

```java
@Entity
public class StudentCourse {

    @Id @GeneratedValue
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id")
    private Student student;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "course_id")
    private Course course;

    private LocalDateTime enrolledAt;  // 추가 컬럼 자유롭게
    private String grade;
}

@Entity
public class Student {
    @OneToMany(mappedBy = "student")
    private List<StudentCourse> studentCourses = new ArrayList<>();
}

@Entity
public class Course {
    @OneToMany(mappedBy = "course")
    private List<StudentCourse> studentCourses = new ArrayList<>();
}
```

## @JoinColumn 주요 속성

```java
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(
    name = "member_id",         // FK 컬럼명 (기본: 필드명_id)
    referencedColumnName = "id", // 참조하는 PK 컬럼명 (기본: PK)
    nullable = false,            // NOT NULL 제약
    foreignKey = @ForeignKey(name = "fk_order_member")  // FK 이름 지정
)
private Member member;
```

FK 이름을 명시하지 않으면 Hibernate가 자동 생성한 이름을 사용합니다. 마이그레이션 스크립트에서 FK 이름을 참조할 경우 명시적으로 지정하는 것이 좋습니다.

## 임베디드 값 타입 vs 연관 관계

연관 관계를 맺기 전에 `@Embeddable`로 해결할 수 있는지 먼저 검토합니다. 주소처럼 독립적인 생명주기가 없는 값 객체는 별도 엔티티보다 임베디드 타입이 더 적합합니다.

```java
@Embeddable
public class Address {
    private String city;
    private String street;
    private String zipcode;
}

@Entity
public class Member {
    @Embedded
    private Address homeAddress;   // 별도 테이블 없이 member 테이블 컬럼으로 저장

    @Embedded
    @AttributeOverrides({
        @AttributeOverride(name = "city", column = @Column(name = "work_city")),
        @AttributeOverride(name = "street", column = @Column(name = "work_street")),
        @AttributeOverride(name = "zipcode", column = @Column(name = "work_zipcode"))
    })
    private Address workAddress;   // 컬럼명 재정의로 같은 타입 두 번 사용
}
```

## 실무 설계 가이드라인

```java
// 1. 처음에는 단방향으로 설계
// 2. 필요할 때만 양방향 추가 (JPQL에서 역방향 탐색이 꼭 필요한 경우)
// 3. @ManyToOne은 항상 LAZY fetch 명시
// 4. @OneToMany cascade는 논리적 소유 관계(부모-자식)에서만 사용

@Entity
public class Post {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String title;

    // Post가 Comment를 소유 → cascade, orphanRemoval 적절
    @OneToMany(mappedBy = "post",
               cascade = CascadeType.ALL,
               orphanRemoval = true)
    private List<Comment> comments = new ArrayList<>();

    // Tag는 공유 자원 → cascade 사용 금지 (다른 Post도 참조)
    @ManyToMany
    // ❌ 실무에서는 중간 엔티티로 분리
    private List<Tag> tags;
}
```

cascade를 잘못 사용하면 의도치 않게 연관 엔티티까지 삭제될 수 있습니다. 부모-자식 생명주기가 완전히 일치하는 경우(`Post`→`Comment`)에만 `CascadeType.ALL`과 `orphanRemoval = true`를 함께 사용하세요.

## 정리

- **연관관계 주인**: FK 보유 쪽, 항상 `@ManyToOne` · `@OneToOne(FK)` 쪽
- `mappedBy`는 주인이 아닌 쪽에 설정, DB에 영향 없음
- 양방향 관계는 **연관 편의 메서드**로 양쪽 동시 세팅 필수
- `@ManyToMany` 직접 사용 금지 → 중간 엔티티(`@OneToMany + @ManyToOne`)로 분리
- `@OneToOne(mappedBy)` 는 반드시 `fetch = LAZY` 명시
- 처음엔 단방향으로 설계 후 필요시 양방향 추가
- 공유 자원(`Tag`, `Category`)에는 `cascade` 사용 금지

---

**지난 글:** [Spring JPA 1차 캐시와 변경 감지(Dirty Checking) 완전 정복](/posts/spring-jpa-first-cache-dirty-checking/)

<br>
읽어주셔서 감사합니다. 😊
