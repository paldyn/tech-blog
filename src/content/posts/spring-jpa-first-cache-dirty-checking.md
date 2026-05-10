---
title: "Spring JPA 1차 캐시와 변경 감지(Dirty Checking) 완전 정복"
description: "JPA 영속성 컨텍스트의 두 핵심 메커니즘인 1차 캐시(First-Level Cache)와 변경 감지(Dirty Checking)를 깊이 이해합니다. 스냅샷 기반 변경 감지 원리, 쓰기 지연(Write-Behind) 저장소, @DynamicUpdate, JDBC 배치, 그리고 실무에서 자주 틀리는 패턴을 코드와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["Spring", "JPA", "1차캐시", "DirtyChecking", "변경감지", "WriteBehind", "flush", "스냅샷", "DynamicUpdate", "영속성컨텍스트"]
featured: false
draft: false
---

[지난 글](/posts/spring-jpa-entity-lifecycle/)에서 엔티티 생명주기 4단계를 정리했습니다. 영속성 컨텍스트가 제공하는 이점 중 가장 실용적이고 동시에 가장 많은 오해를 낳는 두 가지—**1차 캐시**와 **변경 감지(Dirty Checking)**—를 이 글에서 집중적으로 다룹니다. "왜 `save()`를 안 불렀는데 UPDATE가 됐지?" 또는 "캐시가 있는데 왜 SELECT가 나가지?" 같은 질문의 답을 찾을 수 있습니다.

## 1차 캐시(First-Level Cache)

### 동작 원리

영속성 컨텍스트는 내부적으로 엔티티를 `Map<(Class, id), Entity>` 구조로 보관합니다. `find()`를 호출하면 먼저 이 맵을 확인하고, 없을 때만 DB에 SELECT를 실행합니다.

```java
@Transactional
public void cacheDemo(Long id) {
    // 첫 번째 조회 — SELECT 실행, 캐시에 저장
    Member m1 = em.find(Member.class, id);

    // 두 번째 조회 — 캐시 히트, SQL 없음
    Member m2 = em.find(Member.class, id);

    System.out.println(m1 == m2);  // true — 동일 인스턴스
}
```

1차 캐시는 **트랜잭션 범위**입니다. 다른 트랜잭션이 DB를 수정해도 현재 트랜잭션의 1차 캐시에는 반영되지 않습니다. 이는 읽기 일관성 보장과 관련이 있습니다.

### JPQL은 1차 캐시를 우회

`find()`는 1차 캐시를 먼저 조회하지만, **JPQL이나 네이티브 쿼리는 항상 DB에 SQL을 실행합니다.** 결과 엔티티를 1차 캐시와 병합할 때 이미 캐시에 있는 엔티티가 우선됩니다.

```java
@Transactional
public void jpqlCache(Long id) {
    Member m1 = em.find(Member.class, id);   // 캐시에 저장
    m1.setName("Cached");

    // JPQL은 항상 DB 조회 (flush 먼저 실행)
    Member m2 = em.createQuery(
        "SELECT m FROM Member m WHERE m.id = :id", Member.class
    ).setParameter("id", id).getSingleResult();

    // 1차 캐시 병합: DB 결과를 무시하고 기존 캐시 객체 반환
    System.out.println(m1 == m2);         // true
    System.out.println(m2.getName());     // "Cached" (DB값 아님)
}
```

이 동작은 **반복 가능한 읽기(Repeatable Read)** 를 애플리케이션 수준에서 보장합니다. 같은 트랜잭션 내에서 같은 엔티티는 항상 동일한 인스턴스를 반환합니다.

### 1차 캐시의 한계

1차 캐시는 트랜잭션마다 독립적으로 존재하고, 트랜잭션 종료 시 사라집니다. 서비스 재시작 시 캐시가 사라지는 문제나 다른 서버 인스턴스의 캐시와 공유가 안 되는 문제는 **2차 캐시(Second-Level Cache)** 로 해결합니다. 2차 캐시는 Ehcache, Caffeine, Redis 등을 사용합니다.

## 변경 감지(Dirty Checking)

### 스냅샷 기반 원리

JPA는 엔티티를 1차 캐시에 저장할 때 **스냅샷**을 함께 복사해 보관합니다. flush 시점에 현재 엔티티 상태를 스냅샷과 비교하여 변경된 필드가 있으면 자동으로 UPDATE SQL을 생성합니다.

![1차 캐시와 변경 감지 동작 흐름](/assets/posts/spring-jpa-first-cache-dirty-checking-flow.svg)

```java
@Transactional
public void dirtyCheck(Long id) {
    Member member = em.find(Member.class, id);
    // 스냅샷: {id: 1, name: "Alice", age: 30}

    member.setName("Bob");
    member.setAge(31);
    // 현재 상태: {id: 1, name: "Bob", age: 31}

    // 트랜잭션 종료 시 flush:
    // → 스냅샷과 비교 → name, age 변경 감지
    // → UPDATE member SET name='Bob', age=31 WHERE id=1
}
```

변경 감지는 **영속 상태**의 엔티티에만 작동합니다. `detach()`된 준영속 엔티티를 수정해도 UPDATE가 발생하지 않습니다.

### Hibernate의 기본 UPDATE 전략 — 모든 컬럼

Hibernate는 기본적으로 변경된 컬럼만이 아닌 **모든 컬럼을 포함한 UPDATE**를 생성합니다.

```sql
-- Hibernate 기본 (컬럼 2개 변경해도)
UPDATE member SET name=?, age=?, email=?, created_at=? WHERE id=?
--                              ↑ 변경 안 된 컬럼도 포함
```

이유는 **SQL 재사용**입니다. 어떤 컬럼이 바뀌든 항상 동일한 SQL 형태를 사용하므로 PreparedStatement 캐시를 100% 활용할 수 있습니다.

컬럼이 많거나 TEXT/BLOB 컬럼이 포함된 경우 성능 문제가 될 수 있습니다. 이때 `@DynamicUpdate`로 변경된 컬럼만 UPDATE할 수 있지만, SQL 캐시를 무효화하는 tradeoff가 있습니다.

```java
@Entity
@DynamicUpdate  // 변경된 컬럼만 포함한 UPDATE SQL 생성
public class LargeEntity {
    @Id @GeneratedValue
    private Long id;

    private String name;

    @Lob
    private String largeContent;  // 이런 컬럼이 있을 때 유효

    // ... 수십 개 컬럼
}
```

## 쓰기 지연(Write-Behind)

![쓰기 지연 저장소 동작](/assets/posts/spring-jpa-first-cache-dirty-checking-write-behind.svg)

`persist()`, `remove()`, Dirty Checking으로 생성된 UPDATE SQL은 즉시 실행되지 않고 **쓰기 지연 저장소**에 누적됩니다. flush 시점에 한꺼번에 DB로 전송됩니다.

```java
@Transactional
public void writesBehind() {
    // 모두 SQL 큐에 누적 — 아직 DB 전송 없음
    em.persist(new Member("A"));
    em.persist(new Member("B"));
    em.persist(new Member("C"));

    // JPQL 실행 전 JPA가 자동 flush
    long count = em.createQuery("SELECT COUNT(m) FROM Member m", Long.class)
        .getSingleResult();
    // → flush: INSERT A, INSERT B, INSERT C 전송 후 COUNT 실행
}
```

### JDBC 배치와 연동

쓰기 지연은 JDBC 배치와 결합하면 INSERT 성능을 크게 향상시킵니다.

```yaml
# application.yml
spring:
  jpa:
    properties:
      hibernate:
        jdbc:
          batch_size: 50          # 50개씩 배치 INSERT
        order_inserts: true       # INSERT 정렬 (배치 효율 향상)
        order_updates: true       # UPDATE 정렬
```

```java
@Transactional
public void batchInsert(List<ProductDto> dtos) {
    for (int i = 0; i < dtos.size(); i++) {
        em.persist(new Product(dtos.get(i)));

        if (i % 50 == 49) {
            em.flush();   // 50개 배치 INSERT 전송
            em.clear();   // 1차 캐시 비워 메모리 절약
        }
    }
}
```

`IDENTITY` PK 전략은 `persist()` 즉시 INSERT를 실행해야 PK를 알 수 있으므로 배치 INSERT가 **비활성화**됩니다. 대량 삽입이 중요한 경우 `SEQUENCE` 전략(`allocationSize` 설정)을 사용하면 배치 INSERT를 활성화할 수 있습니다.

```java
@Entity
public class Product {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE,
                    generator = "product_seq")
    @SequenceGenerator(name = "product_seq",
                       sequenceName = "product_id_seq",
                       allocationSize = 50)   // DB 왕복 50번에 1번
    private Long id;
}
```

## 실무에서 자주 틀리는 패턴

### 패턴 1: 준영속 엔티티를 수정해도 UPDATE 안 됨

```java
@Service
public class MemberService {

    @Transactional
    public Member findMember(Long id) {
        return memberRepository.findById(id).orElseThrow();
    }   // ← 트랜잭션 종료, 반환된 엔티티는 준영속

    public void modifyOutsideTransaction(Long id) {
        Member member = findMember(id);  // 준영속 상태
        member.setName("무시됨");         // UPDATE 안 됨!
        // save()나 merge() 없이는 DB 반영 불가
    }
}
```

### 패턴 2: @Transactional 없는 메서드에서 Dirty Checking 기대

```java
// 잘못된 예: @Transactional 없으면 변경 감지 작동 안 함
public void updateWithoutTx(Long id) {
    Member member = memberRepository.findById(id).orElseThrow();
    // findById 내부에서 트랜잭션 시작·종료 → member는 이미 준영속
    member.setName("Bob");  // UPDATE 안 됨
}

// 올바른 예
@Transactional
public void updateWithTx(Long id) {
    Member member = memberRepository.findById(id).orElseThrow();
    member.setName("Bob");  // 영속 상태, 커밋 시 UPDATE
}
```

### 패턴 3: save() 중복 호출

```java
@Transactional
public void redundantSave(Long id) {
    Member member = memberRepository.findById(id).orElseThrow();
    member.setName("Bob");

    memberRepository.save(member);  // 불필요 — Dirty Checking이 이미 처리
    // save()를 호출하면 내부에서 merge()가 실행 → 추가 SELECT 발생
}
```

같은 트랜잭션 내에서 이미 영속 상태인 엔티티에 `save()`를 호출하면 `isNew()` 검사 후 `merge()`가 실행되어 불필요한 SELECT가 발생할 수 있습니다.

## 정리

- **1차 캐시**: 트랜잭션 범위 캐시, `find()` 시 DB 왕복 절감, 동일 인스턴스 보장
- JPQL/네이티브 쿼리는 항상 DB 조회, 결과는 1차 캐시와 병합(캐시 우선)
- **Dirty Checking**: 스냅샷 비교 → 변경 필드 자동 UPDATE, 영속 상태만 적용
- Hibernate 기본 전략: 모든 컬럼 UPDATE (SQL 재사용) → 컬럼 많으면 `@DynamicUpdate`
- **쓰기 지연**: SQL 큐 → flush 시 일괄 전송 → JDBC 배치와 결합 시 성능 향상
- `IDENTITY` PK는 배치 INSERT 비활성화, `SEQUENCE` 전략 권장
- 준영속 상태에서 변경해도 DB 미반영, `@Transactional` 범위 주의

---

**지난 글:** [Spring JPA 엔티티 생명주기 완전 정복](/posts/spring-jpa-entity-lifecycle/)

**다음 글:** [Spring JPA 연관 관계 매핑 완전 정복](/posts/spring-jpa-relations/)

<br>
읽어주셔서 감사합니다. 😊
