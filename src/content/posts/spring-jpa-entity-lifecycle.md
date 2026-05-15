---
title: "Spring JPA 엔티티 생명주기 완전 정복"
description: "JPA 엔티티의 네 가지 상태(비영속·영속·준영속·삭제)와 각 상태 간 전이를 완전히 이해합니다. persist·detach·merge·remove가 각각 어떤 상태 전이를 일으키는지, 준영속 상태가 발생하는 시점과 영속 상태에서만 Dirty Checking이 작동하는 이유를 실제 코드와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 2
type: "knowledge"
category: "Spring"
tags: ["Spring", "JPA", "엔티티생명주기", "비영속", "영속", "준영속", "삭제", "persist", "detach", "merge", "remove", "Hibernate"]
featured: false
draft: false
---

[지난 글](/posts/spring-jpa-entitymanager-context/)에서 EntityManager와 영속성 컨텍스트의 역할을 정리했습니다. 이 글에서는 영속성 컨텍스트 안에서 엔티티가 어떤 상태를 거치며 관리되는지, **엔티티 생명주기 4단계**를 집중적으로 다룹니다. 상태를 정확히 이해하지 못하면 "왜 UPDATE가 안 되지?" 또는 "왜 LazyInitializationException이 발생하지?" 같은 당황스러운 버그를 마주하게 됩니다.

## 4가지 엔티티 상태

JPA 엔티티는 항상 다음 네 가지 상태 중 하나에 있습니다.

![JPA 엔티티 생명주기 4단계](/assets/posts/spring-jpa-entity-lifecycle-states.svg)

### 1. 비영속(New / Transient)

Java 객체를 `new`로 생성했지만 아직 EntityManager에 등록하지 않은 상태입니다. JPA는 이 객체의 존재를 전혀 모릅니다.

```java
// 비영속 상태 — JPA와 무관한 일반 자바 객체
Member member = new Member();
member.setName("홍길동");
// member.getId() == null
// DB에 아무런 영향 없음
```

### 2. 영속(Managed)

`em.persist()`나 `em.find()`, JPQL 조회 등을 통해 영속성 컨텍스트에 등록된 상태입니다. JPA가 이 엔티티를 추적하며, 필드 변경 시 트랜잭션 커밋 때 자동으로 `UPDATE`가 실행됩니다.

```java
// persist — 새 엔티티를 영속 상태로
em.persist(member);  // 영속성 컨텍스트에 등록

// find — DB에서 조회하여 영속 상태로
Member found = em.find(Member.class, 1L);  // SELECT 후 1차 캐시 등록

// 영속 상태이므로 변경 감지 작동
found.setName("새 이름");
// 커밋 시 UPDATE member SET name='새 이름' WHERE id=1 자동 실행
```

### 3. 준영속(Detached)

한 번 영속 상태였다가 영속성 컨텍스트에서 분리된 상태입니다. 엔티티 데이터는 그대로지만 JPA의 관리 대상에서 빠집니다. 필드를 변경해도 DB에 반영되지 않습니다.

```java
em.detach(member);    // 특정 엔티티만 분리
em.clear();           // 영속성 컨텍스트 전체 초기화 → 모두 준영속
em.close();           // EntityManager 종료 → 모두 준영속

// 준영속 상태에서 변경
member.setName("무시됨");
// UPDATE 실행 안 됨 — JPA가 관리하지 않음
```

트랜잭션 밖에서 엔티티를 사용하면 자동으로 준영속 상태가 됩니다. `@Transactional`로 감싼 서비스 메서드가 반환한 엔티티는 트랜잭션 종료 후 준영속 상태입니다.

### 4. 삭제(Removed)

영속 상태의 엔티티에 `em.remove()`를 호출한 상태입니다. 트랜잭션 커밋 시 `DELETE` 쿼리가 실행됩니다.

```java
Member member = em.find(Member.class, 1L);  // 영속
em.remove(member);  // 삭제 예약
// 아직 DB에서 지워지지 않음 — 커밋 시 DELETE 실행
// 삭제 취소하려면 em.persist(member)로 재영속화 가능
```

## 상태 전이 상세

![엔티티 상태 전이 코드](/assets/posts/spring-jpa-entity-lifecycle-code.svg)

### persist() — 비영속 → 영속

```java
@Transactional
public Member register(String name) {
    Member member = new Member(name);  // 비영속
    em.persist(member);                // 영속
    // IDENTITY 전략: 즉시 INSERT 실행 (PK 알아야 함)
    // SEQUENCE 전략: nextval 호출 후 INSERT는 flush 시
    return member;  // member.getId() 사용 가능
}
```

`persist()` 이후 같은 트랜잭션 내에서 `find()`로 같은 ID를 조회하면 DB 쿼리 없이 1차 캐시에서 반환합니다.

### detach() / clear() — 영속 → 준영속

```java
@Transactional
public void processLargeData() {
    for (int i = 0; i < 10000; i++) {
        Member m = new Member("user" + i);
        em.persist(m);

        // 1000개마다 flush + clear로 메모리 관리
        if (i % 1000 == 999) {
            em.flush();   // SQL 전송
            em.clear();   // 1차 캐시 비움 → 모두 준영속
        }
    }
}
```

대량 데이터 처리 시 1차 캐시가 메모리에 계속 누적되면 `OutOfMemoryError`가 발생할 수 있습니다. `flush()` + `clear()` 패턴으로 주기적으로 컨텍스트를 비워야 합니다.

### merge() — 준영속/비영속 → 영속으로 복사

`merge()`는 전달받은 엔티티를 **복사**하여 영속 상태의 새 객체를 반환합니다. 원본 객체는 여전히 준영속/비영속 상태입니다.

```java
@Transactional
public Member updateFromDto(MemberUpdateDto dto) {
    // DTO → 엔티티 변환 (비영속)
    Member detached = new Member();
    detached.setId(dto.getId());
    detached.setName(dto.getName());

    // merge: DB에서 id=dto.getId()를 SELECT한 뒤 detached 상태 복사
    Member managed = em.merge(detached);
    // managed만 영속, detached는 여전히 비영속
    return managed;
}
```

실무에서는 `merge()` 대신 `find()` 후 setter로 변경하는 패턴이 더 명확합니다.

```java
@Transactional
public Member update(Long id, String name) {
    Member member = em.find(Member.class, id);  // 영속
    member.setName(name);  // Dirty Checking으로 자동 UPDATE
    return member;
}
```

### remove() — 영속 → 삭제

```java
@Transactional
public void delete(Long id) {
    Member member = em.find(Member.class, id);
    if (member != null) {
        em.remove(member);
        // 커밋 시 DELETE FROM member WHERE id=?
    }
}
```

Spring Data JPA의 `deleteById()`는 내부적으로 `findById()` 후 `remove()`를 호출합니다. 존재하지 않는 ID를 삭제하려 하면 `EmptyResultDataAccessException`이 발생합니다(`delete()`를 직접 사용하면 예외 없이 조용히 넘어갑니다).

## 준영속 상태가 문제가 되는 경우

### LazyInitializationException

준영속 상태의 엔티티에서 지연 로딩(LAZY) 관계를 접근하면 `LazyInitializationException`이 발생합니다.

```java
@Transactional
public Member findMember(Long id) {
    return memberRepository.findById(id).orElseThrow();
}   // 트랜잭션 종료 → 반환된 member는 준영속

// 컨트롤러에서 지연 로딩 접근 → 예외 발생
Member member = memberService.findMember(1L);
member.getOrders().size();  // LazyInitializationException!
```

해결책:
1. 서비스 계층에서 필요한 연관 데이터를 미리 로딩(`JOIN FETCH`)
2. DTO로 변환하여 반환
3. OSIV 활성화(단, 고트래픽에서 커넥션 고갈 위험)

```java
@Transactional
public MemberDto findMemberWithOrders(Long id) {
    Member member = em.createQuery(
        "SELECT m FROM Member m JOIN FETCH m.orders WHERE m.id = :id",
        Member.class
    ).setParameter("id", id).getSingleResult();

    return MemberDto.from(member);  // 트랜잭션 내에서 DTO 변환
}
```

### equals/hashCode와 준영속 상태

`HashSet`이나 `HashMap`에 엔티티를 담을 때, 준영속 상태에서 ID가 변경되면 `equals()`/`hashCode()` 계약이 깨집니다. 엔티티의 `equals()`는 비즈니스 키나 ID 기반으로 구현하되, ID가 `null`인 비영속 상태를 고려해야 합니다.

```java
@Entity
public class Member {
    @Id @GeneratedValue
    private Long id;
    private String email;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Member m)) return false;
        // ID가 null이면(비영속) 동일 참조만 같은 것으로 판단
        return id != null && id.equals(m.id);
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();  // 고정값 사용으로 컬렉션 안전성 확보
    }
}
```

## 정리

- **비영속**: `new`로 생성, JPA 무관, DB 영향 없음
- **영속**: 컨텍스트 관리 중, Dirty Checking 활성, 1차 캐시 등록
- **준영속**: 컨텍스트 분리, 변경해도 DB 미반영, 지연 로딩 불가
- **삭제**: `remove()` 호출, 커밋 시 DELETE 실행
- `detach()/clear()/close()`로 준영속화, `merge()`로 재영속화
- 대량 처리 시 `flush()+clear()` 패턴으로 메모리 관리
- 준영속 상태에서 지연 로딩 접근 시 `LazyInitializationException` 발생

---

**지난 글:** [Spring JPA EntityManager와 영속성 컨텍스트 완전 정복](/posts/spring-jpa-entitymanager-context/)

**다음 글:** [Spring JPA 1차 캐시와 변경 감지(Dirty Checking) 완전 정복](/posts/spring-jpa-first-cache-dirty-checking/)

<br>
읽어주셔서 감사합니다. 😊
