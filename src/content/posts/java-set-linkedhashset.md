---
title: "LinkedHashSet — 삽입 순서를 유지하는 Set"
description: "LinkedHashSet의 LinkedHashMap 기반 구조, 해시 버킷과 이중 연결 리스트의 결합, HashSet 대비 메모리·성능 트레이드오프, 그리고 삽입 순서 보존이 필요한 실전 사용 사례"
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 4
type: "knowledge"
category: "Java"
tags: ["Java", "컬렉션", "Set", "LinkedHashSet", "삽입 순서", "LinkedHashMap"]
featured: false
draft: false
---

[지난 글](/posts/java-set-hashset/)에서 HashSet의 내부 구조와 equals/hashCode 계약을 살펴봤다. 이번에는 **`LinkedHashSet`**을 다룬다. HashSet의 O(1) 성능은 유지하면서 **삽입 순서를 보장**해야 할 때 사용한다.

## LinkedHashSet이 필요한 이유

`HashSet`은 원소를 삽입한 순서와 무관하게 해시 버킷 순서로 반환한다. 출력 순서가 예측 불가능하므로 로그 재현, 순차 처리, UI 표시 등에서 혼란을 줄 수 있다.

```java
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Set;

Set<String> hash = new HashSet<>(List.of("cherry", "apple", "banana"));
Set<String> linked = new LinkedHashSet<>(List.of("cherry", "apple", "banana"));

System.out.println(hash);    // [banana, cherry, apple] — 예측 불가
System.out.println(linked);  // [cherry, apple, banana] — 삽입 순서 보장
```

## 내부 구조: LinkedHashMap 기반

`LinkedHashSet`은 `HashSet`을 상속하지만 내부적으로 `LinkedHashMap`(HashSet은 HashMap)을 사용한다.

```java
// LinkedHashSet 내부 (간략화)
// HashSet 생성자 중 package-private 버전을 호출
HashSet(int initialCapacity, float loadFactor, boolean dummy) {
    map = new LinkedHashMap<>(initialCapacity, loadFactor);
}
```

`LinkedHashMap`은 HashMap에 **이중 연결 리스트를 추가**한다. 각 엔트리는 해시 버킷에 저장되는 동시에 삽입 순서 연결 리스트에도 연결된다. 이 연결 리스트를 순회하면 삽입 순서대로 원소가 반환된다.

![LinkedHashSet 구조 — 삽입 순서 유지](/assets/posts/java-set-linkedhashset-structure.svg)

## Set 비교

![HashSet · LinkedHashSet · TreeSet 비교](/assets/posts/java-set-linkedhashset-comparison.svg)

`LinkedHashSet`은 `HashSet`과 동일한 O(1) 평균 성능을 제공하지만, 이중 연결 리스트 포인터(before/after)를 각 엔트리마다 추가로 저장하므로 메모리를 더 사용한다.

## 주요 API

`LinkedHashSet`은 `HashSet`에서 메서드를 추가하지 않는다. `Set` 인터페이스의 표준 메서드를 통해 순서 보장을 체험할 수 있다.

```java
import java.util.LinkedHashSet;
import java.util.Set;

Set<String> visited = new LinkedHashSet<>();
visited.add("/home");
visited.add("/about");
visited.add("/contact");
visited.add("/home");   // 중복 — 무시됨, 순서 변경 없음

// 삽입 순서: /home, /about, /contact
for (String page : visited) {
    System.out.println(page);
}

// 중복 제거 후 순서 유지 변환 패턴
List<String> raw = List.of("b", "a", "c", "a", "b");
List<String> deduped = new ArrayList<>(new LinkedHashSet<>(raw));
System.out.println(deduped); // [b, a, c]
```

## 실전 사용 사례

**중복 제거 + 순서 유지**: 가장 전형적인 패턴이다. `Stream.distinct()`는 내부적으로 `LinkedHashSet`과 동일한 원리로 작동한다.

```java
// 방문 이력에서 중복 URL 제거 (순서 유지)
List<String> history = List.of(
    "/a", "/b", "/a", "/c", "/b", "/d"
);
Set<String> uniqueOrdered = new LinkedHashSet<>(history);
// uniqueOrdered: /a, /b, /c, /d
```

**설정 키 집합**: API 응답 필드를 삽입된 순서대로 표시해야 할 때.

```java
Set<String> fields = new LinkedHashSet<>();
fields.add("id");
fields.add("name");
fields.add("email");
// JSON 직렬화 순서: id → name → email
```

## 성능 고려

| 항목 | HashSet | LinkedHashSet |
|---|---|---|
| `add` / `contains` | O(1) 평균 | O(1) 평균 |
| 순회 | O(capacity + n) | O(n) (연결 리스트 순회) |
| 메모리 오버헤드 | 낮음 | 높음 (before/after 포인터 추가) |

순회 성능이 `HashSet`보다 오히려 낫다. `HashSet` 순회는 빈 버킷도 건너뛰어야 하므로 `capacity`에 비례하지만, `LinkedHashSet`은 삽입 순서 연결 리스트를 따라가므로 실제 원소 수에만 비례한다.

---

**지난 글:** [HashSet — 해시 기반 중복 없는 컬렉션](/posts/java-set-hashset/)

**다음 글:** [TreeSet — 정렬과 범위 쿼리를 지원하는 Set](/posts/java-set-treeset/)

<br>
읽어주셔서 감사합니다. 😊
