---
title: "제네릭 클래스 — 타입 매개변수를 가진 클래스 설계"
description: "제네릭 클래스 선언 문법, 단일·다중 타입 파라미터, 제네릭 인터페이스, 상속 관계에서의 타입 인자 전달, 그리고 Pair<K,V>와 Stack<E> 예제로 배우는 실전 설계"
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "제네릭", "Generic Class", "타입 파라미터", "다중 파라미터"]
featured: false
draft: false
---

[지난 글](/posts/java-generics-basics/)에서 제네릭의 기본 개념과 `Box<T>` 예제를 살펴봤다. 이번에는 **제네릭 클래스**를 직접 설계하는 방법을 깊이 있게 다룬다.

## 제네릭 클래스 선언 문법

클래스 이름 뒤에 `<T>` 형식으로 타입 파라미터를 선언한다. 클래스 본문 어디서나 `T`를 타입처럼 사용할 수 있다.

```java
// 기본 구조
class ClassName<T> {
    private T field;

    public ClassName(T field) {
        this.field = field;
    }

    public T getField() {
        return field;
    }
}
```

타입 파라미터는 **필드 타입**, **메서드 파라미터 타입**, **반환 타입** 모두에 사용할 수 있다.

## 단일 타입 파라미터 — Stack\<E\>

컬렉션 원소 타입을 나타낼 때는 관례적으로 `E`(Element)를 사용한다.

```java
class Stack<E> {
    private List<E> elements = new ArrayList<>();

    public void push(E e) {
        elements.add(e);
    }

    public E pop() {
        if (elements.isEmpty()) throw new EmptyStackException();
        return elements.remove(elements.size() - 1);
    }

    public E peek() {
        if (elements.isEmpty()) throw new EmptyStackException();
        return elements.get(elements.size() - 1);
    }

    public boolean isEmpty() {
        return elements.isEmpty();
    }
}
```

```java
// 사용 — T = String
Stack<String> stack = new Stack<>();
stack.push("first");
stack.push("second");
String top = stack.pop(); // "second", 캐스팅 없음
```

## 다중 타입 파라미터 — Pair\<K, V\>

두 가지 다른 타입을 함께 다룰 때는 타입 파라미터를 콤마로 구분해 여러 개 선언한다.

```java
class Pair<K, V> {
    private final K key;
    private final V value;

    public Pair(K key, V value) {
        this.key   = key;
        this.value = value;
    }

    public K getKey()   { return key; }
    public V getValue() { return value; }

    @Override
    public String toString() {
        return "(" + key + ", " + value + ")";
    }
}
```

```java
// K = String, V = Integer
Pair<String, Integer> age = new Pair<>("Alice", 30);
System.out.println(age.getKey());   // "Alice"
System.out.println(age.getValue()); // 30

// K = Long, V = Boolean
Pair<Long, Boolean> flag = new Pair<>(100L, true);
```

![Pair<K,V> 클래스 구조 다이어그램](/assets/posts/java-generic-class-diagram.svg)

![제네릭 클래스 코드 예제](/assets/posts/java-generic-class-code.svg)

## 제네릭 인터페이스

인터페이스도 클래스와 동일한 방식으로 타입 파라미터를 선언한다.

```java
interface Repository<T, ID> {
    T findById(ID id);
    List<T> findAll();
    void save(T entity);
    void delete(ID id);
}

// 구현 클래스 — 구체 타입 지정
class UserRepository implements Repository<User, Long> {
    @Override
    public User findById(Long id) { /* ... */ }

    @Override
    public List<User> findAll() { /* ... */ }
    // ...
}
```

구현 클래스가 타입 인자를 지정하지 않고 타입 파라미터를 유지할 수도 있다.

```java
// T를 유지하는 구현
class InMemoryRepository<T, ID> implements Repository<T, ID> {
    private final Map<ID, T> store = new HashMap<>();

    @Override
    public T findById(ID id) { return store.get(id); }
    // ...
}
```

## 상속과 타입 인자

제네릭 클래스를 상속할 때 타입 인자를 지정하거나, 부모의 타입 파라미터를 그대로 넘길 수 있다.

```java
// 부모 타입 고정
class StringBox extends Box<String> {
    public StringBox(String v) { super(v); }
    public int length() { return getValue().length(); }
}

// 타입 파라미터 전달
class NumberBox<N extends Number> extends Box<N> {
    public NumberBox(N v) { super(v); }
    public double asDouble() { return getValue().doubleValue(); }
}
```

```java
StringBox sb = new StringBox("hello");
int len = sb.length(); // 5

NumberBox<Integer> nb = new NumberBox<>(42);
double d = nb.asDouble(); // 42.0
```

## 주의사항: static 멤버에 타입 파라미터 불가

인스턴스 타입 파라미터는 `static` 필드나 `static` 메서드에 사용할 수 없다. 인스턴스마다 다른 타입을 가질 수 있는데, `static` 멤버는 클래스 수준에서 하나만 존재하기 때문이다.

```java
class Box<T> {
    // 컴파일 오류 — static 필드에 T 사용 불가
    // private static T sharedValue;

    // static 메서드에서 T 사용 불가 (클래스의 T)
    // public static T createDefault() { ... }

    // OK — static 제네릭 메서드는 별도 타입 파라미터 선언
    public static <E> Box<E> of(E value) {
        return new Box<>(value);
    }
}
```

---

**지난 글:** [Java 제네릭 완전 정복 — 타입 매개변수의 기초](/posts/java-generics-basics/)

**다음 글:** [제네릭 메서드 — 메서드 수준의 타입 매개변수](/posts/java-generic-method/)

<br>
읽어주셔서 감사합니다. 😊
