---
title: "Spring JPA EntityManager와 영속성 컨텍스트 완전 정복"
description: "JPA의 핵심인 EntityManager와 영속성 컨텍스트(Persistence Context)를 깊이 이해합니다. EntityManagerFactory와 EntityManager의 관계, 영속성 컨텍스트가 제공하는 4가지 이점(1차 캐시·동일성 보장·변경 감지·지연 쓰기), persist/find/merge/remove/flush API를 실제 코드와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["Spring", "JPA", "EntityManager", "영속성컨텍스트", "PersistenceContext", "1차캐시", "변경감지", "DirtyChecking", "flush", "Hibernate"]
featured: false
draft: false
---

[지난 글](/posts/spring-jpa-orm-intro/)에서 ORM과 JPA의 개념, Hibernate와 Spring Data JPA의 관계를 정리했습니다. 이 글에서는 JPA 내부 동작의 핵심인 **EntityManager**와 **영속성 컨텍스트(Persistence Context)**를 깊이 파고듭니다. JPA를 단순히 "SQL을 대신 써주는 도구"로 쓰는 것과 영속성 컨텍스트를 이해하고 쓰는 것은 실제 성능·버그 측면에서 완전히 다른 결과를 낳습니다.

## EntityManagerFactory와 EntityManager

JPA는 두 가지 핵심 객체를 중심으로 동작합니다.

**EntityManagerFactory(EMF)** 는 애플리케이션 시작 시 DataSource를 기반으로 단 한 번 생성됩니다. 생성 비용이 크고 쓰레드 세이프(thread-safe)합니다. Spring Boot 환경에서는 `LocalContainerEntityManagerFactoryBean`이 자동으로 설정됩니다.

**EntityManager(EM)** 는 EMF에서 요청/트랜잭션 단위로 생성됩니다. 쓰레드 세이프가 아니기 때문에 스프링이 트랜잭션 범위 안에서 각 쓰레드에 독립된 EM을 제공합니다.

```java
// Spring에서 EntityManager 주입
@Repository
public class MemberRepository {

    @PersistenceContext   // 트랜잭션 범위의 EM 프록시 주입
    private EntityManager em;

    public Member save(Member member) {
        em.persist(member);
        return member;
    }

    public Member findById(Long id) {
        return em.find(Member.class, id);
    }
}
```

`@PersistenceContext`로 주입받는 `EntityManager`는 실제 EM이 아닌 **프록시**입니다. 메서드 호출 시 현재 트랜잭션에 바인딩된 실제 EM으로 위임합니다. 덕분에 싱글톤 빈이 EM을 필드로 가져도 쓰레드 안전성이 유지됩니다.

![EntityManager & 영속성 컨텍스트 구조](/assets/posts/spring-jpa-entitymanager-context-architecture.svg)

## 영속성 컨텍스트란

**영속성 컨텍스트(Persistence Context)** 는 엔티티를 영구 저장하는 환경입니다. EntityManager가 생성될 때 함께 만들어지며, EM이 관리하는 엔티티들의 집합이자 1차 캐시 역할을 합니다. 논리적으로 "애플리케이션과 DB 사이의 중간 계층"으로 이해하면 됩니다.

영속성 컨텍스트가 제공하는 이점은 크게 네 가지입니다.

### 1. 1차 캐시(First-Level Cache)

엔티티를 처음 조회하면 영속성 컨텍스트의 1차 캐시에 저장됩니다. 같은 트랜잭션 안에서 동일 PK로 재조회하면 **DB에 쿼리를 보내지 않고** 캐시에서 반환합니다.

```java
@Transactional
public void cacheDemo(Long id) {
    Member m1 = em.find(Member.class, id);  // SELECT 실행
    Member m2 = em.find(Member.class, id);  // 캐시 반환, SQL 없음

    System.out.println(m1 == m2);  // true — 동일 인스턴스
}
```

### 2. 동일성(Identity) 보장

위 코드에서 `m1 == m2`가 `true`인 것처럼, 같은 트랜잭션 안에서는 동일 PK에 대해 항상 같은 인스턴스가 반환됩니다. 애플리케이션 레벨의 동일성을 보장합니다.

### 3. 변경 감지(Dirty Checking)

영속 상태의 엔티티 필드를 수정하면 JPA가 자동으로 변경을 감지하여 트랜잭션 커밋 시 `UPDATE` 쿼리를 실행합니다. 개발자가 명시적으로 `save()`나 `update()`를 호출할 필요가 없습니다.

```java
@Transactional
public void updateName(Long id, String newName) {
    Member member = em.find(Member.class, id);
    member.setName(newName);   // 수정만 해도 충분
    // em.update(member) 같은 호출 불필요
    // 트랜잭션 종료 시 UPDATE member SET name=? WHERE id=? 자동 실행
}
```

JPA는 엔티티가 1차 캐시에 처음 저장될 때 **스냅샷**을 함께 보관합니다. 트랜잭션 종료 직전 flush 시점에 현재 상태와 스냅샷을 비교하여 변경된 필드만 UPDATE합니다.

### 4. 지연 쓰기(Write-Behind / Transactional Write-Behind)

`persist()`나 `remove()`를 호출해도 즉시 SQL이 실행되지 않습니다. 영속성 컨텍스트의 **쓰기 지연 저장소**에 SQL을 모아 두었다가, `flush()` 시점에 한꺼번에 DB로 보냅니다.

```java
@Transactional
public void bulkInsert() {
    for (int i = 0; i < 100; i++) {
        em.persist(new Member("user" + i));
        // SQL은 아직 실행 안 됨 — 내부 큐에 누적
    }
    // 트랜잭션 커밋 직전 flush → 100개 INSERT 일괄 전송
}
```

## EntityManager 핵심 API

![EntityManager 핵심 API](/assets/posts/spring-jpa-entitymanager-context-api.svg)

### persist — 비영속 → 영속

새로 생성한 엔티티를 영속성 컨텍스트에 등록합니다. `@GeneratedValue` 전략에 따라 ID 할당 방식이 달라집니다.

```java
Member member = new Member("홍길동");  // 비영속
em.persist(member);                    // 영속
// member.getId() — IDENTITY 전략이면 즉시 INSERT 후 ID 반환
// SEQUENCE 전략이면 nextval 호출 후 ID 할당, INSERT는 flush 시
```

`IDENTITY` 전략(`auto_increment`)은 INSERT 없이는 PK를 알 수 없기 때문에 `persist()` 시점에 즉시 INSERT를 실행합니다. 이는 지연 쓰기가 적용되지 않는 유일한 예외입니다.

### find — 조회

```java
Member member = em.find(Member.class, 1L);
// 영속성 컨텍스트에 있으면 캐시 반환
// 없으면 SELECT * FROM member WHERE id=1

if (member == null) {
    // 존재하지 않는 ID → null 반환 (예외 아님)
}
```

`getReference()`는 실제 쿼리를 즉시 실행하지 않고 프록시를 반환합니다. 프록시의 필드에 처음 접근할 때 SELECT가 실행됩니다(지연 로딩).

### merge — 준영속/비영속 → 영속으로 복사

영속성 컨텍스트 밖에서 수정한 엔티티를 다시 영속 상태로 만들 때 사용합니다. **주의: 원본 객체가 영속 상태가 되는 것이 아니라, 새로운 영속 엔티티를 반환합니다.**

```java
// detached 상태의 member를 수정 후 병합
Member detached = new Member();
detached.setId(1L);
detached.setName("수정된 이름");

Member managed = em.merge(detached);   // DB에서 1을 찾아 상태 복사
// detached != managed (참조가 다름)
// managed만 영속 상태
```

### remove — 삭제

영속 상태의 엔티티만 삭제할 수 있습니다. 준영속 엔티티를 삭제하려면 먼저 `merge()`나 `find()`로 영속 상태로 만들어야 합니다.

```java
Member member = em.find(Member.class, 1L);  // 영속
em.remove(member);                           // 삭제 예약
// 트랜잭션 커밋 시 DELETE FROM member WHERE id=1
```

### flush — SQL 즉시 전송

```java
em.persist(newMember);
em.flush();   // 쓰기 지연 저장소의 SQL을 즉시 DB로 전송
              // 트랜잭션은 아직 유지 중 (롤백 가능)
// flush 후 JPQL/네이티브 쿼리 결과에 방금 저장한 데이터 포함
```

`flush()`는 트랜잭션 커밋과는 다릅니다. SQL을 전송하지만 트랜잭션을 닫지는 않으므로 예외 발생 시 롤백됩니다. JPQL 실행 전 JPA가 자동으로 `flush()`를 호출하는 경우도 있습니다(`FlushModeType.AUTO`).

## Spring Data JPA에서의 투명한 관리

Spring Data JPA를 사용할 때는 `EntityManager`를 직접 다루지 않아도 됩니다. `@Transactional`과 `JpaRepository`가 내부적으로 EM 생명주기를 관리합니다.

```java
@Service
@Transactional
public class MemberService {

    private final MemberRepository memberRepository;

    public Member updateName(Long id, String name) {
        Member member = memberRepository.findById(id)
            .orElseThrow(EntityNotFoundException::new);
        member.setName(name);   // Dirty Checking 작동
        return member;          // save() 호출 불필요
    }
}
```

`JpaRepository.save()` 내부에서는 `em.persist()` 또는 `em.merge()`를 호출합니다. 엔티티의 ID가 null이면 `persist()`, ID가 있으면 `merge()`를 씁니다. 이미 영속 상태인 엔티티에 `save()`를 호출하면 `merge()`가 실행되지만, 트랜잭션 내에서 이미 영속 상태라면 Dirty Checking이 자동으로 처리하므로 `save()` 호출 자체가 불필요합니다.

## 영속성 컨텍스트의 범위 — 트랜잭션 범위 vs OSIV

기본적으로 영속성 컨텍스트의 생존 범위는 **트랜잭션과 동일**합니다. 트랜잭션이 시작될 때 생성되고, 커밋(또는 롤백)될 때 함께 종료됩니다.

```java
@Transactional
public void transactionScope() {
    Member m = em.find(Member.class, 1L);   // 영속
    // ... 트랜잭션 안에서 m은 영속 상태
}   // 트랜잭션 종료 → flush + commit → 영속성 컨텍스트 소멸
// 여기서 m은 준영속(detached) 상태
```

Spring Boot는 기본적으로 **OSIV(Open Session In View)** 가 활성화되어 있습니다(`spring.jpa.open-in-view=true`). OSIV는 HTTP 요청 전체에 걸쳐 영속성 컨텍스트를 유지하여 View(템플릿)에서도 지연 로딩이 가능하게 합니다. 단, DB 커넥션을 오래 점유하므로 고성능 서비스에서는 비활성화하고 DTO 변환을 서비스 계층에서 처리하는 것이 권장됩니다.

```yaml
# application.yml — OSIV 비활성화 권장 (고트래픽 서비스)
spring:
  jpa:
    open-in-view: false
```

## 정리

- **EntityManagerFactory**: 앱 당 1개, 쓰레드 세이프, 생성 비용 높음
- **EntityManager**: 트랜잭션 당 1개, 쓰레드 비안전, Spring이 프록시로 관리
- **영속성 컨텍스트**: 1차 캐시·동일성 보장·Dirty Checking·지연 쓰기 제공
- `persist()` → 영속 등록, `find()` → 캐시 우선 조회, `merge()` → 준영속 복사, `remove()` → 삭제 예약
- `flush()`는 SQL 전송이지 트랜잭션 커밋이 아님
- OSIV는 편리하지만 커넥션 고갈 위험 → 고트래픽에선 비활성화

---

**지난 글:** [Spring JPA와 ORM 개념 정복: 패러다임 불일치와 JPA가 해결하는 방법](/posts/spring-jpa-orm-intro/)

**다음 글:** [Spring JPA 엔티티 생명주기 완전 정복](/posts/spring-jpa-entity-lifecycle/)

<br>
읽어주셔서 감사합니다. 😊
