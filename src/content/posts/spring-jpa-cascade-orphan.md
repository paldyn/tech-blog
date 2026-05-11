---
title: "JPA Cascade와 orphanRemoval 완전 정복"
description: "JPA의 cascade 설정과 orphanRemoval 옵션을 완전히 이해합니다. CascadeType 6가지(PERSIST·MERGE·REMOVE·REFRESH·DETACH·ALL)의 역할과 전파 원리, orphanRemoval과 CascadeType.REMOVE의 차이, 부모-자식 완전 소유 관계에서만 사용해야 하는 이유, 공유 엔티티에 cascade를 잘못 적용했을 때 발생하는 위험을 코드 예제와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["Spring", "JPA", "Cascade", "CascadeType", "orphanRemoval", "부모자식", "생명주기", "Hibernate", "영속성전파"]
featured: false
draft: false
---

[지난 글](/posts/spring-jpa-n-plus-one/)에서 N+1 문제와 해결 전략을 다뤘습니다. 이번에는 JPA의 **cascade(영속성 전파)**와 **orphanRemoval(고아 제거)** 설정을 깊이 살펴봅니다. 이 두 옵션은 부모 엔티티의 연산을 자식 엔티티에 자동으로 전파하는 강력한 기능이지만, 잘못 사용하면 의도하지 않은 데이터 삭제·변경이 발생할 수 있습니다.

## Cascade란

`cascade` 설정은 부모 엔티티에 수행하는 JPA 연산(persist, merge, remove 등)을 자식 엔티티에도 자동으로 전파합니다. `@OneToMany`, `@OneToOne`, `@ManyToMany` 등 모든 연관 관계 어노테이션에 설정할 수 있습니다.

```java
// cascade 없는 경우 — 자식도 따로 저장해야 함
Post post = new Post("제목");
Comment comment = new Comment("댓글 내용");
post.getComments().add(comment);
comment.setPost(post);

em.persist(post);     // post 저장
em.persist(comment);  // comment 별도 저장 필요

// cascade = ALL이 있는 경우 — 자식 자동 저장
em.persist(post);     // post와 comment 함께 INSERT
```

![JPA CascadeType 전파 개요](/assets/posts/spring-jpa-cascade-orphan-cascade.svg)

## CascadeType 종류

### CascadeType.PERSIST

부모를 `em.persist()` 할 때 자식도 함께 영속화합니다. 부모와 자식을 한 번의 `save()`로 처리할 수 있어 가장 많이 사용합니다.

```java
Post post = new Post("Spring JPA");
post.addComment(new Comment("좋은 글이네요"));
post.addComment(new Comment("도움됐습니다"));

postRepository.save(post);
// INSERT INTO post ...
// INSERT INTO comment ... (2번)
```

### CascadeType.MERGE

부모를 `em.merge()` 할 때 자식도 함께 병합합니다. 준영속 상태의 엔티티를 다시 영속화할 때 사용됩니다.

### CascadeType.REMOVE

부모를 `em.remove()` 할 때 자식도 함께 삭제합니다. `orphanRemoval = true`와 동작이 비슷하지만 차이가 있습니다(아래 설명 참고).

```java
Post post = postRepository.findById(1L).orElseThrow();
postRepository.delete(post);
// DELETE FROM comment WHERE post_id = 1
// DELETE FROM post WHERE id = 1
```

### CascadeType.ALL

위 5가지(PERSIST, MERGE, REMOVE, REFRESH, DETACH) 모두 적용합니다. 부모-자식 생명주기가 완전히 일치하는 경우 `CascadeType.ALL`을 사용합니다.

## orphanRemoval이란

**컬렉션에서 제거된 자식 엔티티**를 자동으로 DELETE하는 옵션입니다. 부모-자식 관계에서 자식이 부모 컬렉션과 분리되면 더 이상 의미 없는 "고아(orphan)"로 판단하여 DB에서 삭제합니다.

```java
@Entity
public class Post {

    @OneToMany(mappedBy = "post",
               cascade = CascadeType.ALL,
               orphanRemoval = true)
    private List<Comment> comments = new ArrayList<>();

    // 연관 편의 메서드
    public void addComment(Comment comment) {
        comments.add(comment);
        comment.setPost(this);
    }

    public void removeComment(Comment comment) {
        comments.remove(comment);
        comment.setPost(null);
    }
}
```

```java
// orphanRemoval 동작 예시
@Transactional
public void removeFirstComment(Long postId) {
    Post post = postRepository.findById(postId).orElseThrow();
    Comment first = post.getComments().get(0);

    post.removeComment(first);
    // 트랜잭션 종료 시: DELETE FROM comment WHERE id = ?
    // commentRepository.delete() 호출 없이 자동 삭제
}
```

## CascadeType.REMOVE vs orphanRemoval 차이

두 옵션 모두 자식을 삭제하지만, 트리거가 다릅니다.

| 옵션 | 트리거 | 설명 |
|---|---|---|
| `CascadeType.REMOVE` | 부모 엔티티 자체 삭제 | `em.remove(parent)` 시 자식 전파 삭제 |
| `orphanRemoval = true` | 컬렉션에서 제거 | 부모 컬렉션에서 자식 제거 시 자동 DELETE |

두 옵션을 함께 쓰면(`cascade = ALL + orphanRemoval = true`) 부모 삭제뿐 아니라 컬렉션에서 제거하는 것만으로도 자식이 삭제됩니다. **부모 없이 자식이 존재해선 안 되는 완전한 소유 관계**에서 이 조합을 사용합니다.

## 올바른 사용 vs 잘못된 사용

![cascade와 orphanRemoval 코드 패턴](/assets/posts/spring-jpa-cascade-orphan-code.svg)

**올바른 사용: 완전한 부모-자식 소유 관계**

```java
// ✓ Post → Comment: Comment는 Post 없이 존재 불가
@Entity
public class Post {
    @OneToMany(mappedBy = "post",
               cascade = CascadeType.ALL,
               orphanRemoval = true)
    private List<Comment> comments = new ArrayList<>();
}

// ✓ Order → OrderItem: OrderItem은 Order 없이 의미 없음
@Entity
public class Order {
    @OneToMany(mappedBy = "order",
               cascade = CascadeType.ALL,
               orphanRemoval = true)
    private List<OrderItem> orderItems = new ArrayList<>();
}
```

**잘못된 사용: 공유 자원에 cascade 적용**

```java
// ✗ Tag는 여러 Post가 공유 — cascade 사용 금지
@Entity
public class Post {
    @ManyToMany(cascade = CascadeType.ALL) // ← 위험!
    private List<Tag> tags;
}
// post 삭제 시 다른 Post도 참조하던 Tag가 같이 삭제됨

// ✗ Member는 공유 자원 — Order에서 cascade 금지
@Entity
public class Order {
    @ManyToOne(cascade = CascadeType.REMOVE) // ← 위험!
    private Member member;
}
// order 삭제 시 member가 삭제됨 (다른 order도 연결 끊김)
```

## 실무 설계 체크리스트

cascade 적용 전 다음 질문에 답합니다.

```java
// 1. 자식이 부모 없이 존재할 수 있는가?
//    → NO  : cascade ALL + orphanRemoval = true 적합
//    → YES : cascade 사용 지양, 별도 처리

// 2. 자식이 다른 부모와도 연관될 수 있는가?
//    → YES : cascade 사용 금지 (공유 자원)
//    → NO  : cascade 사용 가능

// 3. cascade 적용 범위 — PERSIST만 필요한 경우
@OneToMany(mappedBy = "post",
           cascade = CascadeType.PERSIST)  // PERSIST만
private List<Comment> comments;
// 자식 자동 저장은 허용, 삭제는 명시적으로만
```

## cascade 없이 직접 관리하는 패턴

cascade가 부담스럽거나 정밀 제어가 필요할 때는 직접 저장하는 방식을 사용합니다.

```java
@Transactional
public Post createPost(CreatePostRequest req) {
    Post post = Post.of(req.title(), req.content());
    postRepository.save(post);  // post 먼저 저장

    List<Comment> comments = req.comments().stream()
        .map(c -> Comment.of(post, c.content()))
        .toList();
    commentRepository.saveAll(comments);  // 자식 별도 저장

    return post;
}
```

저장 순서를 명시적으로 제어할 수 있고, 복잡한 비즈니스 로직이 있을 때 더 명확합니다.

## 정리

- `CascadeType.PERSIST`: 부모 저장 시 자식도 함께 INSERT
- `CascadeType.REMOVE`: 부모 삭제 시 자식도 함께 DELETE
- `CascadeType.ALL`: 모든 연산 전파 — 완전한 부모-자식에서만
- `orphanRemoval = true`: 컬렉션에서 제거된 자식 자동 DELETE
- `cascade = ALL + orphanRemoval = true`: 자식이 부모 없이 존재 불가한 완전 소유 관계에서 사용
- **공유 자원(`Tag`, `Category`, `Member`)에는 cascade 절대 금지**

---

**지난 글:** [JPA N+1 문제 완전 정복 — 원인과 해결 전략](/posts/spring-jpa-n-plus-one/)

**다음 글:** [JPA 상속 매핑 전략 완전 정복](/posts/spring-jpa-inheritance-mapping/)

<br>
읽어주셔서 감사합니다. 😊
