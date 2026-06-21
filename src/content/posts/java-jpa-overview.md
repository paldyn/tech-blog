---
title: "JPA 개요 — 객체와 관계형 데이터베이스의 다리"
description: "JPA는 자바 객체와 관계형 테이블을 매핑하는 ORM 표준입니다. 객체-관계 임피던스 불일치 문제, 명세와 구현(Hibernate)의 관계, 엔티티와 영속성 컨텍스트, 그리고 JPA가 주는 이득과 대가를 균형 있게 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-22"
archiveOrder: 7
type: "knowledge"
category: "Java"
tags: ["Java", "JPA", "ORM", "Hibernate", "영속성"]
featured: false
draft: false
---

[지난 글](/posts/java-connection-pool/)에서 커넥션 풀까지 다루며 JDBC를 직접 사용하는 저수준 데이터 접근의 기초를 마무리했습니다. JDBC는 강력하지만 한 가지 불편이 있습니다. 객체 지향으로 작성한 코드와 테이블 기반의 데이터 사이를 매번 손으로 변환해야 한다는 점입니다. `ResultSet`에서 컬럼을 하나하나 꺼내 객체에 채우고, 객체의 필드를 다시 `?`에 바인딩하는 반복 작업은 지루하고 오류가 잦습니다. 이 간극을 메우는 표준이 **JPA(Jakarta Persistence API)** 입니다.

## 객체-관계 임피던스 불일치

JPA가 푸는 근본 문제는 **객체 모델과 관계형 모델의 구조적 차이** 입니다. 자바는 객체와 참조, 상속, 컬렉션으로 세상을 표현하지만, 관계형 DB는 테이블과 행, 외래 키로 표현합니다. 이 둘은 사고방식이 달라서, 객체를 테이블에 저장하려면 늘 변환이 필요합니다. 이 구조적 간극을 **객체-관계 임피던스 불일치(impedance mismatch)** 라고 부릅니다.

![ORM — 객체와 테이블을 매핑한다](/assets/posts/java-jpa-overview-orm.svg)

JPA는 **ORM(Object-Relational Mapping)** 기술로 이 변환을 자동화합니다. 클래스에 `@Entity`를, 식별자 필드에 `@Id`를 붙이면, JPA가 그 객체를 테이블의 한 행과 매핑해 줍니다. 개발자는 객체를 저장하라고 명령할 뿐이고, 그것을 `INSERT` SQL로 바꾸는 일은 JPA가 대신합니다. 조회도 마찬가지로, 행을 객체로 되살려 돌려줍니다.

## 명세와 구현 — JPA와 Hibernate

여기서 자주 헷갈리는 개념을 정리해야 합니다. **JPA는 명세(인터페이스)이고, Hibernate는 그 명세를 구현한 엔진** 입니다. JDBC가 표준 인터페이스와 벤더 드라이버로 나뉘었던 것과 똑같은 구조입니다.

![JPA의 위치 — 명세와 구현, 그 아래 JDBC](/assets/posts/java-jpa-overview-layers.svg)

JPA 명세는 `jakarta.persistence` 패키지의 `@Entity`, `@Id`, `EntityManager` 같은 표준 요소를 정의합니다. 실제로 SQL을 생성하고 DB와 통신하는 일은 **Hibernate**(가장 널리 쓰이는 구현체)나 EclipseLink 같은 구현체가 담당합니다. 그리고 그 구현체는 내부에서 결국 우리가 앞서 배운 JDBC를 호출합니다. 즉 JPA는 JDBC를 없앤 것이 아니라, 그 위에 객체 중심의 추상화를 한 겹 올린 것입니다.

## 엔티티와 EntityManager

JPA에서 영속성의 단위는 **엔티티(Entity)** 이고, 엔티티를 다루는 창구는 **`EntityManager`** 입니다. 저장은 `persist`, 식별자로 조회는 `find`, 삭제는 `remove`로 합니다.

```java
@Entity
public class Member {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private int age;
    // 생성자·getter 생략
}
```

```java
EntityManager em = emf.createEntityManager();
EntityTransaction tx = em.getTransaction();

tx.begin();
Member member = new Member("김자바", 29);
em.persist(member);          // INSERT는 JPA가 생성
tx.commit();

Member found = em.find(Member.class, member.getId());  // SELECT
System.out.println(found.getName());
```

직접 SQL을 쓴 곳이 한 군데도 없다는 점에 주목하세요. `persist`와 `find`라는 객체 중심의 명령만 있고, 그에 해당하는 SQL은 Hibernate가 만들어 실행합니다.

## 영속성 컨텍스트 — JPA의 심장

JPA를 단순한 "SQL 자동 생성기"로만 이해하면 절반만 아는 것입니다. JPA의 핵심에는 **영속성 컨텍스트(Persistence Context)** 라는 1차 캐시가 있습니다. `EntityManager`가 관리하는 이 공간에 엔티티들이 올라가며, 여기서 여러 특별한 동작이 일어납니다.

- **1차 캐시**: 같은 트랜잭션 안에서 같은 엔티티를 다시 `find`하면 DB에 다시 가지 않고 캐시에서 돌려줍니다.
- **변경 감지(Dirty Checking)**: 영속 상태의 엔티티 필드를 바꾸면, 별도의 `update` 호출 없이도 커밋 시점에 JPA가 변경을 감지해 `UPDATE` SQL을 자동 생성합니다.
- **쓰기 지연**: `persist`로 쌓인 SQL을 모았다가 커밋 시점에 한꺼번에 보냅니다.

```java
tx.begin();
Member member = em.find(Member.class, 77L);
member.setName("이코딩");      // setter만 호출 — update 호출 없음
tx.commit();                  // 커밋 시 변경 감지 → UPDATE 자동 실행
```

`setName`만 했는데 DB가 갱신되는 이 동작이 처음에는 마법처럼 보이지만, 영속성 컨텍스트가 엔티티의 처음 상태를 기억해 두었다가 커밋 시점에 현재 상태와 비교하기 때문에 가능한 일입니다.

## JPA의 이득과 대가

JPA는 강력한 만큼 명확한 트레이드오프가 있습니다. 반복적인 매핑 코드를 없애고 객체 중심으로 도메인을 표현하게 해주며, DB 종류에 덜 의존하게 만듭니다. 그러나 그 추상화 뒤에서 어떤 SQL이 나가는지 보이지 않아, 무심코 쓰면 **N+1 문제** 처럼 성능을 갉아먹는 쿼리 폭증이 일어나기 쉽습니다. 또한 영속성 컨텍스트, 지연 로딩, 연관관계 매핑 같은 개념을 제대로 이해하지 못하면 오히려 디버깅이 어려워집니다.

그래서 JPA를 잘 쓰는 사람은 역설적으로 그 아래의 SQL과 JDBC를 잘 아는 사람입니다. 추상화가 무엇을 감추는지 알아야 그 추상화를 통제할 수 있기 때문입니다. 앞선 글들에서 JDBC를 먼저 다룬 이유가 여기에 있습니다.

## 정리

JPA는 자바 객체와 관계형 테이블 사이의 임피던스 불일치를 메우는 ORM 표준으로, `@Entity`·`@Id` 같은 매핑과 `EntityManager`를 통한 객체 중심의 영속성 조작을 제공합니다. JPA는 명세이고 Hibernate가 그 구현체이며, 그 아래에는 여전히 JDBC가 있습니다. 영속성 컨텍스트의 1차 캐시·변경 감지·쓰기 지연이 JPA의 핵심 동작이고, 강력한 추상화인 만큼 그 뒤의 SQL을 의식해야 한다는 대가가 따릅니다. 다음 글에서는 이 JPA 명세를 가장 널리 구현한 엔진, Hibernate를 더 구체적으로 들여다봅니다.

---

**지난 글:** [커넥션 풀 — 연결을 재사용해 비용을 줄이기](/posts/java-connection-pool/)

**다음 글:** [Hibernate — JPA를 구현한 가장 널리 쓰이는 ORM 엔진](/posts/java-hibernate/)

<br>
읽어주셔서 감사합니다. 😊
