---
title: "Spring JPA와 ORM 개념 정복: 패러다임 불일치와 JPA가 해결하는 방법"
description: "JPA(Java Persistence API)와 ORM(Object-Relational Mapping)의 핵심 개념을 처음부터 정리합니다. 객체 지향과 관계형 DB의 패러다임 불일치 4가지, JPA 명세와 Hibernate 구현체의 관계, Spring Data JPA의 위치, 그리고 JDBC 직접 사용 대비 JPA를 선택하는 이유와 tradeoff를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["Spring", "JPA", "ORM", "Hibernate", "패러다임불일치", "EntityManager", "SpringDataJPA", "JPQL", "영속성", "객체매핑"]
featured: false
draft: false
---

[지난 글](/posts/spring-transaction-declarative-vs-programmatic/)에서 트랜잭션 관리 방식을 완전히 정리했습니다. 이제 Spring 데이터 접근 기술의 핵심인 JPA 파트로 넘어갑니다. JPA를 제대로 사용하려면 "왜 ORM이 필요한가"라는 근본 질문부터 이해해야 합니다. 이 글에서는 ORM의 존재 이유, JPA 명세와 Hibernate 구현체의 관계, Spring Data JPA의 역할을 개념적으로 정리합니다.

## 패러다임 불일치 — ORM이 필요한 이유

애플리케이션은 **객체 지향** 언어(Java)로 작성하고, 데이터는 **관계형 데이터베이스**에 저장합니다. 두 세계는 데이터를 표현하고 다루는 방식이 근본적으로 달라 항상 **임피던스 불일치(Impedance Mismatch)** 가 발생합니다.

![ORM이 해결하는 패러다임 불일치](/assets/posts/spring-jpa-orm-intro-paradigm.svg)

### 불일치 1: 상속

Java에서는 `Animal`을 상속한 `Dog`, `Cat`이 자연스럽지만, 관계형 DB는 상속 개념이 없습니다. 이를 테이블로 표현하려면 단일 테이블(`dtype` 컬럼 구분), 조인 전략(부모/자식 테이블 분리), 구체 테이블 전략 중 하나를 선택해야 합니다.

```java
// JPA가 없다면 직접 해결해야 하는 문제
String sql = """
    SELECT a.name, d.breed
    FROM animal a
    JOIN dog d ON d.animal_id = a.id
    WHERE a.id = ?
    """;
// Animal → Dog 변환 코드를 수동으로 작성
Animal animal = new Dog();
animal.setName(rs.getString("name"));
((Dog) animal).setBreed(rs.getString("breed"));
```

### 불일치 2: 연관 관계

Java 객체는 참조로 양방향 탐색이 가능합니다. DB는 외래 키로 단방향 관계를 표현하며, 반대 방향 탐색에는 JOIN이 필요합니다.

```java
// 객체: 자연스러운 그래프 탐색
Order order = orderRepository.find(orderId);
String memberName = order.getMember().getName();  // 객체 참조

// JDBC: JOIN SQL 직접 작성
String sql = "SELECT o.*, m.name FROM orders o " +
             "JOIN member m ON m.id = o.member_id WHERE o.id = ?";
```

### 불일치 3: 동일성

Java 객체는 `==`(참조 동일성)과 `equals()`(값 동등성) 두 가지 동일성 개념이 있습니다. DB는 기본 키(PK)로만 행을 식별합니다. ORM 없이는 같은 PK의 데이터를 두 번 조회하면 `==` 비교가 `false`가 됩니다.

```java
// JDBC: 두 번 조회 — 다른 객체
Member m1 = memberDao.findById(1L);
Member m2 = memberDao.findById(1L);
System.out.println(m1 == m2);  // false — 서로 다른 인스턴스

// JPA: 영속성 컨텍스트(1차 캐시)가 동일성 보장
Member m1 = em.find(Member.class, 1L);
Member m2 = em.find(Member.class, 1L);  // 캐시에서 반환
System.out.println(m1 == m2);  // true — 동일 인스턴스
```

### 불일치 4: 세분성

Java에서 `Member` 객체가 `Address`(도시·우편번호·도로명) 객체를 포함하는 것은 자연스럽습니다. DB는 이를 `member` 테이블의 여러 컬럼이나 별도 테이블로 저장해야 합니다.

```java
// Java: 세분화된 객체 구조
class Member {
    String name;
    Address homeAddress;  // 임베디드 값 타입
}

class Address {
    String city;
    String street;
    String zipcode;
}
```

## ORM이란

**ORM(Object-Relational Mapping)** 은 객체와 관계형 DB 사이의 불일치를 자동으로 해결하는 기술입니다. 개발자는 매핑 설정(어노테이션 또는 XML)만 제공하고, ORM 프레임워크가 SQL 생성·실행·결과 매핑을 처리합니다.

```java
// ORM 적용 후: SQL 없이 객체 중심 개발
@Entity
@Table(name = "member")
public class Member {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    @Embedded
    private Address homeAddress;  // 불일치 4 해결: @Embeddable

    @OneToMany(mappedBy = "member")
    private List<Order> orders = new ArrayList<>();  // 불일치 2 해결
}

// 저장
Member member = new Member();
member.setName("홍길동");
em.persist(member);  // INSERT INTO member ... 자동 생성

// 조회
Member found = em.find(Member.class, 1L);
found.getName();  // SELECT 자동 생성
```

## JPA 명세와 Hibernate

**JPA(Jakarta Persistence API)** 는 Java EE 표준 ORM 명세입니다. 인터페이스(`EntityManager`, `Query` 등)만 정의하고, 실제 구현은 제공하지 않습니다.

**Hibernate**는 JPA 명세의 가장 대표적인 구현체입니다. Spring Boot는 기본으로 Hibernate를 사용합니다.

![JPA 기술 스택 구조](/assets/posts/spring-jpa-orm-intro-stack.svg)

```java
// JPA 명세 인터페이스 사용 (Hibernate가 실제 동작)
@PersistenceContext
private EntityManager em;  // jakarta.persistence.EntityManager (JPA 표준)

public Member findById(Long id) {
    return em.find(Member.class, id);  // Hibernate가 SELECT 쿼리 실행
}
```

JPA 표준만 사용하면 구현체를 EclipseLink 등으로 교체할 수 있지만, 실제로는 Hibernate 전용 기능(예: `@BatchSize`, `@Fetch`)을 사용하는 경우가 많습니다.

## Spring Data JPA의 역할

**Spring Data JPA**는 JPA(Hibernate) 위에 편의 추상화를 제공합니다. `JpaRepository` 인터페이스를 상속하면 기본 CRUD, 페이징, 정렬을 구현 없이 사용할 수 있습니다.

```java
// Spring Data JPA: 인터페이스 선언만으로 구현체 자동 생성
public interface MemberRepository extends JpaRepository<Member, Long> {

    // 메서드 이름으로 쿼리 자동 생성
    List<Member> findByNameAndCity(String name, String city);

    // JPQL 직접 작성
    @Query("SELECT m FROM Member m WHERE m.homeAddress.city = :city")
    List<Member> findByCity(@Param("city") String city);

    // 페이징
    Page<Member> findByName(String name, Pageable pageable);
}
```

```java
@Service
public class MemberService {

    private final MemberRepository memberRepository;

    public Member join(MemberRequest req) {
        Member member = Member.of(req.getName(), req.getAddress());
        return memberRepository.save(member);  // INSERT 자동
    }

    public List<Member> findByCity(String city) {
        return memberRepository.findByCity(city);  // SELECT 자동
    }
}
```

## JDBC vs JPA — 언제 무엇을 선택할까

| 항목 | JDBC (JdbcTemplate) | JPA (Spring Data JPA) |
|---|---|---|
| SQL 직접 제어 | 완전 제어 | 생성된 SQL 확인 필요 |
| 복잡한 쿼리 | 자연스러움 | JPQL/QueryDSL 필요 |
| 보일러플레이트 | 많음 (ResultSet 매핑) | 최소 |
| 학습 비용 | 낮음 | 높음 (영속성 컨텍스트, 연관관계) |
| 성능 튜닝 | SQL 레벨 직접 | N+1, Fetch 전략 이해 필요 |
| 도메인 모델 표현 | 별도 매핑 코드 필요 | 객체 그래프로 자연스럽게 |

```java
// JDBC 방식: ResultSet → 객체 수동 매핑
public Member findById(Long id) {
    return jdbcTemplate.queryForObject(
        "SELECT id, name, city FROM member WHERE id = ?",
        (rs, rowNum) -> {
            Member m = new Member();
            m.setId(rs.getLong("id"));
            m.setName(rs.getString("name"));
            Address addr = new Address(rs.getString("city"), null, null);
            m.setHomeAddress(addr);
            return m;
        },
        id
    );
}

// JPA 방식: 매핑 코드 불필요
public Member findById(Long id) {
    return em.find(Member.class, id);
}
```

JPA는 도메인 모델이 복잡하고 객체 그래프 탐색이 많은 서비스에 유리합니다. 반면 복잡한 집계 쿼리나 벌크 연산이 많은 배치·리포트성 애플리케이션은 JDBC 또는 네이티브 SQL과 JPA를 혼용하는 것이 현실적입니다.

## JPA의 핵심 개념 미리보기

JPA를 이해하는 데 필수적인 개념들을 간단히 소개합니다. 각 주제는 이후 글에서 상세히 다룹니다.

```
JPA 핵심 개념 로드맵

영속성 컨텍스트 (Persistence Context)
  ├─ 엔티티 생명주기: 비영속 → 영속 → 준영속 → 삭제
  ├─ 1차 캐시: 동일 TX 내 동일성 보장
  └─ Dirty Checking: 변경 감지 → 자동 UPDATE

연관관계 매핑
  ├─ @OneToMany, @ManyToOne, @ManyToMany
  ├─ 지연 로딩(LAZY) vs 즉시 로딩(EAGER)
  └─ N+1 문제와 Fetch Join 해결

JPQL / QueryDSL
  ├─ 객체 중심 쿼리 언어
  └─ 컴파일 타임 안전성 (QueryDSL)
```

## 정리

- **ORM**은 객체-DB 패러다임 불일치(상속, 연관, 동일성, 세분성)를 자동 해결
- **JPA**는 ORM 표준 명세 (인터페이스), **Hibernate**는 대표 구현체
- **Spring Data JPA**는 JPA 위에 Repository 패턴 등 편의 추상화 제공
- JPA는 도메인 모델 중심 개발에 강력하지만, 영속성 컨텍스트와 지연 로딩 등 학습 비용이 있음
- 복잡한 집계·배치는 네이티브 SQL과 혼용하는 것이 현실적

---

**지난 글:** [Spring 선언적 vs 프로그래밍 방식 트랜잭션: @Transactional과 TransactionTemplate 완전 비교](/posts/spring-transaction-declarative-vs-programmatic/)

**다음 글:** [Spring JPA EntityManager와 영속성 컨텍스트 완전 정복](/posts/spring-jpa-entitymanager-context/)

<br>
읽어주셔서 감사합니다. 😊
