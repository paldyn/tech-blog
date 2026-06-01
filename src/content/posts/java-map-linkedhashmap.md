---
title: "LinkedHashMap — 순서를 기억하는 맵"
description: "LinkedHashMap의 삽입 순서·접근 순서 두 가지 모드, removeEldestEntry를 활용한 LRU 캐시 구현, HashMap 대비 성능·메모리 트레이드오프, 그리고 실전 활용 패턴"
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 7
type: "knowledge"
category: "Java"
tags: ["Java", "컬렉션", "Map", "LinkedHashMap", "LRU 캐시", "삽입 순서", "접근 순서"]
featured: false
draft: false
---

[지난 글](/posts/java-map-hashmap/)에서 HashMap의 내부 구조와 Java 8+ API를 살펴봤다. 이번에는 **`LinkedHashMap`**을 다룬다. HashMap의 O(1) 성능을 유지하면서 **삽입 순서 또는 접근 순서**를 보존하는 맵 구현체다.

## 두 가지 순서 모드

`LinkedHashMap`은 `accessOrder` 파라미터로 두 가지 모드 중 하나를 선택한다.

```java
// 삽입 순서 (기본값): accessOrder = false
LinkedHashMap<String, Integer> insert = new LinkedHashMap<>();

// 접근 순서 (LRU용): accessOrder = true
LinkedHashMap<String, Integer> access =
    new LinkedHashMap<>(16, 0.75f, true);
```

![LinkedHashMap — HashMap + 삽입/접근 순서 연결 리스트](/assets/posts/java-map-linkedhashmap-structure.svg)

![LinkedHashMap 두 가지 모드](/assets/posts/java-map-linkedhashmap-modes.svg)

## 삽입 순서 모드

기본 모드다. 원소를 `put`한 순서대로 순회된다. 동일 키를 다시 `put`해도 순서는 변경되지 않는다.

```java
LinkedHashMap<String, Integer> map = new LinkedHashMap<>();
map.put("banana", 2);
map.put("apple", 1);
map.put("cherry", 3);
map.put("banana", 99); // 키 banana의 값 갱신 — 순서 불변

System.out.println(map);
// {banana=99, apple=1, cherry=3} — 최초 삽입 순서 유지
```

## 접근 순서 모드와 LRU 캐시

`accessOrder = true`로 설정하면 `get` 또는 `put` 호출 시 해당 항목이 리스트 **tail**(가장 최근 접근)로 이동한다. **head**는 가장 오래 접근하지 않은 항목이 된다.

이 동작에 `removeEldestEntry` 오버라이드를 결합하면 **LRU(Least Recently Used) 캐시**를 단 몇 줄로 구현할 수 있다.

```java
import java.util.LinkedHashMap;
import java.util.Map;

public class LRUCache<K, V> extends LinkedHashMap<K, V> {
    private final int capacity;

    public LRUCache(int capacity) {
        super(capacity, 0.75f, true); // accessOrder = true
        this.capacity = capacity;
    }

    @Override
    protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
        return size() > capacity; // 크기 초과 시 head(LRU) 제거
    }
}

LRUCache<String, String> cache = new LRUCache<>(3);
cache.put("a", "Alice");
cache.put("b", "Bob");
cache.put("c", "Carol");

cache.get("a"); // a를 최근 접근으로 표시 (tail로 이동)
cache.put("d", "Dave"); // 크기 초과 → b(LRU) 제거

System.out.println(cache); // {c=Carol, a=Alice, d=Dave}
```

## 내부 구조

`LinkedHashMap`은 `HashMap`을 상속하고 Entry 클래스에 `before`와 `after` 두 포인터를 추가한다.

```java
// LinkedHashMap.Entry (간략화)
static class Entry<K, V> extends HashMap.Node<K, V> {
    Entry<K, V> before, after; // 순서 연결 리스트 포인터
}
```

해시 버킷은 HashMap과 동일하게 빠른 키 검색에 사용하고, 이중 연결 리스트는 순서 유지와 순회에 사용된다.

## 성능 및 메모리

HashMap과 동일한 O(1) 평균 성능이지만, 각 Entry에 `before`/`after` 포인터 2개가 추가되므로 메모리를 더 사용한다. 접근 순서 모드에서는 `get` 시마다 연결 리스트 포인터를 갱신하는 비용이 추가된다.

## 실전 사용 사례

**JSON 직렬화 순서 유지**: Jackson 등 직렬화 라이브러리에서 Map을 JSON으로 변환할 때 `LinkedHashMap`을 사용하면 삽입 순서대로 필드가 출력된다.

```java
// 응답 JSON 필드 순서 제어
Map<String, Object> response = new LinkedHashMap<>();
response.put("status", "ok");
response.put("code", 200);
response.put("data", payload);
// JSON: {"status":"ok","code":200,"data":...}
```

**중복 제거 + 순서 유지**: `LinkedHashSet` 대신 키만 사용하는 `LinkedHashMap`을 `Set`으로 사용할 수 있다.

---

**지난 글:** [HashMap — 해시 맵의 내부 구조와 성능](/posts/java-map-hashmap/)

**다음 글:** [TreeMap — 정렬과 범위 쿼리를 지원하는 맵](/posts/java-map-treemap/)

<br>
읽어주셔서 감사합니다. 😊
