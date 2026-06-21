---
title: "Hibernate — JPA를 구현한 가장 널리 쓰이는 ORM 엔진"
description: "Hibernate는 JPA 명세를 가장 널리 구현한 ORM 엔진입니다. 엔티티의 네 가지 생명주기 상태, 지연 로딩과 N+1 문제, 더티 체킹과 플러시, 그리고 Hibernate를 실무에서 잘 쓰기 위한 핵심 감각을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-22"
archiveOrder: 8
type: "knowledge"
category: "Java"
tags: ["Java", "Hibernate", "JPA", "ORM", "N+1"]
featured: false
draft: false
---

[지난 글](/posts/java-jpa-overview/)에서 JPA가 객체와 테이블을 잇는 ORM 표준이며, Hibernate가 그 명세를 구현한 엔진이라는 점을 짚었습니다. 이번 글에서는 그 Hibernate를 한 걸음 더 들여다봅니다. Hibernate는 JPA가 등장하기 전부터 존재했던 ORM 프레임워크로, 사실상 JPA 표준의 모태가 되었고 지금도 가장 널리 쓰이는 구현체입니다. JPA 명세만으로는 보이지 않던 동작 원리를 Hibernate의 관점에서 보면, 왜 그렇게 동작하는지가 훨씬 선명해집니다.

## 엔티티의 네 가지 생명주기 상태

Hibernate를 제대로 다루려면 엔티티가 거치는 **상태(state)** 를 알아야 합니다. 같은 객체라도 어느 상태에 있느냐에 따라 변경이 DB에 반영되기도 하고 무시되기도 하기 때문입니다.

![엔티티 생명주기 — 네 가지 상태](/assets/posts/java-hibernate-entity-states.svg)

- **비영속(transient)**: `new`로 막 만든 객체. 아직 영속성 컨텍스트가 모르는 순수 자바 객체입니다.
- **영속(persistent)**: `persist`나 `find`로 영속성 컨텍스트가 관리하는 상태. 변경 감지의 대상입니다.
- **준영속(detached)**: 한때 영속이었지만 `detach`되거나 `EntityManager`가 닫혀 관리에서 분리된 상태.
- **삭제(removed)**: `remove`로 삭제 예약된 상태. 커밋 시 `DELETE`가 실행됩니다.

여기서 가장 중요한 사실은 **변경 감지가 오직 '영속' 상태에서만 동작한다**는 점입니다. 준영속 엔티티의 필드를 바꿔도 DB에는 아무 일도 일어나지 않습니다. "분명히 setter를 호출했는데 값이 안 바뀐다"는 흔한 혼란이 바로 이 상태 차이에서 비롯됩니다.

## 지연 로딩과 N+1 문제

Hibernate에서 가장 자주 마주치는 함정이 **N+1 문제** 입니다. 이는 연관 엔티티를 **지연 로딩(LAZY)** 으로 설정했을 때, 연관을 순회하면서 쿼리가 폭증하는 현상입니다.

![N+1 문제 — 가장 흔한 성능 함정](/assets/posts/java-hibernate-nplus1.svg)

팀 목록을 조회하는 쿼리 한 번(`1`)을 날린 뒤, 각 팀의 멤버를 순회하면 팀마다 멤버를 조회하는 쿼리가 추가로 나갑니다. 팀이 N개면 추가로 N번, 합쳐서 `1 + N`번의 쿼리가 DB로 날아갑니다. 팀이 100개면 101번의 쿼리가 나가는 셈입니다. 코드만 보면 단순한 반복문인데, JPA가 SQL을 감추기 때문에 이 폭증이 눈에 띄지 않는 것이 무서운 점입니다.

해법은 연관을 미리 함께 조회하는 **fetch join** 입니다. JPQL에 `join fetch`를 쓰면 팀과 멤버를 한 번의 쿼리로 가져옵니다.

```java
List<Team> teams = em.createQuery(
        "select t from Team t join fetch t.members", Team.class)
    .getResultList();   // 연관까지 한 쿼리로 — 1번
```

`@BatchSize`나 엔티티 그래프 같은 다른 해법도 있지만, 핵심은 "지연 로딩을 무심코 순회하지 말고, 나가는 쿼리를 항상 의식하라"는 것입니다. Hibernate를 잘 쓰는 사람은 SQL 로그를 켜두고 자신의 코드가 만드는 쿼리를 늘 확인합니다.

## 즉시 로딩의 함정 — 그래서 LAZY가 기본

그렇다면 모든 연관을 즉시 로딩(EAGER)으로 바꾸면 N+1이 사라질까요? 그렇지 않습니다. 즉시 로딩은 연관을 항상 함께 가져오므로, 정작 필요 없는 상황에서도 불필요한 조인이 발생하고 예측하기 어려운 쿼리가 나갑니다. 그래서 실무 권장은 **모든 연관을 LAZY로 두고, 필요한 곳에서만 fetch join으로 명시적으로 함께 조회** 하는 것입니다. `@ManyToOne`의 기본값이 EAGER인 것은 오래된 설계라, 명시적으로 `fetch = FetchType.LAZY`로 바꾸는 것이 보편적인 관례입니다.

```java
@Entity
public class Member {
    @ManyToOne(fetch = FetchType.LAZY)   // EAGER 기본을 LAZY로 명시
    private Team team;
}
```

## 더티 체킹과 플러시

지난 글에서 본 변경 감지(더티 체킹)는 Hibernate의 강력한 기능이지만, 동작 시점을 알아야 합니다. 영속 엔티티의 변경은 즉시 DB로 가지 않고, **플러시(flush)** 시점에 `UPDATE` SQL로 변환됩니다. 플러시는 보통 트랜잭션 커밋 직전, 또는 JPQL 실행 직전에 자동으로 일어납니다.

```java
tx.begin();
Member member = em.find(Member.class, 77L);  // 영속 상태
member.setName("이코딩");                      // 변경 감지 대상
// em.update() 같은 메서드는 없다 — 호출 불필요
tx.commit();                                  // 이 시점에 flush → UPDATE
```

`update` 같은 메서드를 호출하지 않아도 커밋 시점에 변경이 반영되는 이유가 이것입니다. 다만 이 편리함의 이면에는, 의도치 않게 영속 엔티티를 수정하면 원하지 않는 `UPDATE`가 나갈 수 있다는 위험도 있습니다.

## Hibernate를 잘 쓰는 감각

Hibernate는 생산성을 크게 높여 주지만, 추상화 뒤에서 무슨 일이 벌어지는지 보지 못하면 성능과 정합성 양쪽에서 곤란을 겪습니다. 실무에서 통하는 몇 가지 감각을 정리하면 다음과 같습니다.

- **SQL 로그를 켜두라**: `show_sql`이나 로깅 설정으로 실제 나가는 쿼리를 항상 확인합니다.
- **연관은 LAZY, 조회는 fetch join**: 기본은 지연, 필요할 때만 명시적으로 함께 가져옵니다.
- **상태를 의식하라**: 영속/준영속을 구분해야 변경 감지가 언제 동작하는지 예측할 수 있습니다.
- **영속성 컨텍스트의 범위를 이해하라**: 트랜잭션과 컨텍스트의 생애가 어긋나면 `LazyInitializationException` 같은 문제가 생깁니다.

## 정리

Hibernate는 JPA 명세를 가장 널리 구현한 ORM 엔진으로, 엔티티의 비영속·영속·준영속·삭제 상태에 따라 변경 반영 여부가 달라집니다. 변경 감지는 영속 상태에서만 동작하고, 지연 로딩을 무심코 순회하면 N+1 쿼리 폭증이 일어나며, 그 해법은 fetch join입니다. 더티 체킹과 플러시 덕분에 `update` 호출 없이 변경이 반영되지만, 그만큼 나가는 SQL을 의식하는 습관이 필수입니다. JPA·Hibernate가 객체 중심의 자동화를 추구한다면, 정반대로 SQL을 그대로 다루되 타입 안전성을 더하려는 접근도 있습니다. 다음 글에서는 그 대표 주자인 jOOQ를 살펴봅니다.

---

**지난 글:** [JPA 개요 — 객체와 관계형 데이터베이스의 다리](/posts/java-jpa-overview/)

**다음 글:** [jOOQ — 타입 안전한 SQL을 자바로 작성하기](/posts/java-jooq/)

<br>
읽어주셔서 감사합니다. 😊
