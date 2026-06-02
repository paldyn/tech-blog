---
title: "컬렉션 프레임워크 모범 사례 — 선택·초기화·성능·안전"
description: "컬렉션 선택 기준(ArrayList vs LinkedList vs HashMap vs TreeMap), 초기 용량 지정으로 재할당 방지, 인터페이스 타입 선언 원칙, ConcurrentModificationException 회피, null 처리, equals/hashCode 계약, 빈 컬렉션 반환 관행까지"
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 5
type: "knowledge"
category: "Java"
tags: ["Java", "컬렉션", "모범사례", "ArrayList", "HashMap", "성능", "ConcurrentModificationException"]
featured: false
draft: false
---

[지난 글](/posts/java-immutable-collections/)에서 불변 컬렉션 팩토리를 살펴봤다. 이번에는 컬렉션 프레임워크를 올바르고 효율적으로 쓰는 **모범 사례**를 정리한다. 어떤 구현체를 선택하고, 어떻게 초기화하고, 어떤 함정을 피해야 하는지 요약한다.

## 구현체 선택 기준

컬렉션을 고를 때 가장 먼저 따져야 할 것은 **어떤 연산이 주가 되는가**다.

![컬렉션 선택 가이드](/assets/posts/java-collection-best-practices-selection.svg)

**List 계열**
- `ArrayList`: 랜덤 접근(get/set)이 많고 끝에 추가·삭제가 주 패턴일 때. 실무에서 가장 많이 쓴다.
- `LinkedList`: 잦은 중간 삽입·삭제가 있고 랜덤 접근이 드물 때. 단, 현대 CPU는 캐시 지역성 때문에 실제로는 `ArrayList`가 더 빠른 경우가 많다.

**Set 계열**
- `HashSet`: 순서 없이 빠른 contains/add/remove가 필요할 때. O(1) 평균.
- `LinkedHashSet`: 삽입 순서를 유지해야 할 때.
- `TreeSet`: 정렬된 순회나 범위 쿼리(subSet, headSet, tailSet)가 필요할 때. O(log n).

**Map 계열**
- `HashMap`: 일반 키-값 저장. null 키 한 개 허용. O(1) 평균.
- `LinkedHashMap`: 삽입·접근 순서 유지. LRU 캐시 구현에 활용 가능.
- `TreeMap`: 정렬 순서 유지, floorKey/ceilingKey 등 범위 연산. O(log n).
- `ConcurrentHashMap`: 멀티스레드 환경. 세그먼트 단위 잠금.

## 인터페이스 타입으로 선언

변수와 파라미터·반환 타입을 구현체가 아닌 **인터페이스 타입**으로 선언한다.

```java
// 나쁜 예: 구현체 타입 노출
ArrayList<String> list = new ArrayList<>();

// 좋은 예: 인터페이스 타입
List<String> list = new ArrayList<>();
Map<String, Integer> map = new HashMap<>();
```

인터페이스 타입을 쓰면 나중에 `LinkedList`로 바꾸거나 `ConcurrentHashMap`으로 교체할 때 호출 코드를 수정하지 않아도 된다.

## 초기 용량 지정으로 재할당 방지

`ArrayList`의 기본 초기 용량은 10이다. 용량을 초과하면 내부 배열을 약 1.5배 크기로 새로 할당하고 복사한다. 삽입할 원소 수를 예측할 수 있으면 초기에 지정한다.

```java
int expectedSize = 10_000;

// 재할당 없이 10,000개 수용
List<String> list = new ArrayList<>(expectedSize);

// HashMap: loadFactor 0.75 고려
// capacity = expectedSize / 0.75 + 1
Map<String, Integer> map = new HashMap<>((int)(expectedSize / 0.75) + 1);
```

`HashMap`은 원소 수가 `capacity × loadFactor`(기본 0.75)를 초과하면 rehash가 일어나 O(n) 비용이 발생한다.

## ConcurrentModificationException 회피

`for-each`로 반복하면서 컬렉션을 수정하면 `ConcurrentModificationException`이 발생한다.

```java
// 잘못된 패턴
for (String s : list) {
    if (s.isEmpty()) list.remove(s); // ConcurrentModificationException
}

// 올바른 방법 1: removeIf (Java 8+)
list.removeIf(String::isEmpty);

// 올바른 방법 2: Iterator 직접 사용
Iterator<String> it = list.iterator();
while (it.hasNext()) {
    if (it.next().isEmpty()) it.remove();
}

// 올바른 방법 3: 새 리스트로 필터
list = list.stream().filter(s -> !s.isEmpty()).toList();
```

![컬렉션 모범 사례 코드 패턴](/assets/posts/java-collection-best-practices-tips.svg)

## equals와 hashCode 계약

`HashMap`/`HashSet`의 키로 사용하는 객체는 반드시 `equals()`와 `hashCode()`를 함께 구현해야 한다.

```java
// equals만 구현하면 HashMap에서 다른 버킷에 저장됨
record Point(int x, int y) {} // record는 자동 구현

Map<Point, String> map = new HashMap<>();
map.put(new Point(1, 2), "origin");
map.get(new Point(1, 2)); // record라면 올바르게 반환

// 일반 클래스는 직접 구현 필요
class BadKey {
    int value;
    // equals만 오버라이드 → hashCode는 Object 기본값 → 같은 값이어도 다른 버킷
}
```

mutable 객체를 Map 키로 쓰면 키가 변경될 때 버킷이 바뀌어 값을 찾을 수 없게 된다. 키는 불변 객체로 사용한다.

## null 처리 정책 일관성 유지

컬렉션마다 null 허용 정책이 다르다.

| 컬렉션 | null 키 | null 값 |
|--------|---------|---------|
| `HashMap` | 1개 허용 | 허용 |
| `TreeMap` | 불허 (NPE) | 허용 |
| `HashSet` | 1개 허용 | — |
| `TreeSet` | 불허 | — |
| `ArrayList` | 허용 | — |
| `List.of()` | 불허 | — |
| `ConcurrentHashMap` | 불허 | 불허 |

`ConcurrentHashMap`에서 `null` 키/값을 넣으면 `NullPointerException`이 즉시 발생한다. 이는 `get(null)` 반환값이 "없음"인지 "null 값"인지 구분할 수 없기 때문에 설계 의도적으로 막은 것이다.

## 메서드 반환 시 null 대신 빈 컬렉션

```java
// 나쁜 예: null 반환 → 호출자가 null 체크해야 함
List<String> findByName(String name) {
    if (noResult) return null;
    ...
}

// 좋은 예: 빈 컬렉션 반환
List<String> findByName(String name) {
    if (noResult) return List.of();
    ...
}
```

null 반환은 호출 코드 어디서나 NPE 가능성을 열어 두므로 빈 컬렉션을 반환한다. `List.of()`나 `Collections.emptyList()`는 공유 인스턴스로 메모리 낭비도 없다.

## 요약 체크리스트

- [ ] 변수 타입을 인터페이스(`List`, `Map`, `Set`)로 선언했는가?
- [ ] 예측 가능한 크기면 초기 용량을 지정했는가?
- [ ] `for-each` 반복 중 컬렉션을 직접 수정하지 않는가?
- [ ] HashMap 키 객체에 `equals`와 `hashCode`를 함께 구현했는가?
- [ ] mutable 객체를 Map 키로 쓰지 않는가?
- [ ] null 대신 빈 컬렉션을 반환하는가?
- [ ] 상수 컬렉션은 `List.of()` 계열을 사용하는가?

---

**지난 글:** [불변 컬렉션 — List.of·Map.of·Set.of와 copyOf](/posts/java-immutable-collections/)

**다음 글:** [Stream API 개요 — 파이프라인 구조와 지연 평가](/posts/java-stream-overview/)

<br>
읽어주셔서 감사합니다. 😊
