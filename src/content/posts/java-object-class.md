---
title: "Java Object 클래스 — 모든 클래스의 공통 조상"
description: "java.lang.Object가 모든 클래스의 최상위 부모인 이유, Object가 제공하는 11가지 메서드의 목적과 기본 동작, equals·hashCode·toString·clone·wait·notify의 올바른 사용법과 오버라이드 가이드를 실전 코드로 정리한다"
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 4
type: "knowledge"
category: "Java"
tags: ["Java", "Object 클래스", "equals", "hashCode", "toString", "clone", "wait", "notify"]
featured: false
draft: false
---

[지난 글](/posts/java-record-patterns/)에서 record 패턴으로 중첩 구조를 분해하는 방법을 살펴봤다. 이번에는 Java 모든 클래스의 최상위 조상인 **`java.lang.Object`**를 다룬다. `extends` 절 없는 모든 클래스는 컴파일러가 암묵적으로 `extends Object`를 추가한다.

## Object가 루트인 이유

Java는 단일 루트 계층을 선택했다. 모든 클래스가 `Object`를 최상위로 공유하면, 타입이 무엇이든 `Object` 참조로 다룰 수 있다. 컬렉션 프레임워크, 리플렉션, equals/hashCode 규약, wait/notify 프로토콜 모두 이 단일 루트에 의존한다.

```java
// 명시적 extends 없는 클래스
class Point {
    int x, y;
}

// 컴파일러가 변환
class Point extends Object {
    int x, y;
}

// 어떤 객체든 Object로 참조 가능
Object obj = new Point();  // 합법적
Object str = "hello";      // 합법적
Object num = 42;           // 합법적 (오토박싱)
```

![모든 클래스는 Object를 암묵적 상속](/assets/posts/java-object-class-hierarchy.svg)

## Object의 11가지 메서드

`Object`가 선언하는 메서드를 기능별로 구분한다.

```java
// 동등성·해시
public boolean equals(Object obj)
public int     hashCode()

// 문자열 표현
public String  toString()

// 복사
protected Object clone() throws CloneNotSupportedException

// 런타임 타입
public final Class<?> getClass()

// 동시성 — wait/notify (모니터 락 필요)
public final void wait() throws InterruptedException
public final void wait(long timeout) throws InterruptedException
public final void wait(long timeout, int nanos) throws InterruptedException
public final void notify()
public final void notifyAll()

// GC (Deprecated)
protected void finalize() throws Throwable  // Java 9부터 deprecated
```

`getClass()`, `wait()`, `notify()`, `notifyAll()`은 `final`이어서 오버라이드할 수 없다.

![java.lang.Object의 11가지 메서드 분류](/assets/posts/java-object-class-methods.svg)

## equals() 기본 동작

`Object.equals()`의 기본 구현은 **참조 동등성(reference equality)**이다. 같은 객체를 가리키는지만 확인한다.

```java
String a = new String("hello");
String b = new String("hello");

System.out.println(a == b);        // false — 다른 객체
System.out.println(a.equals(b));   // true  — String이 오버라이드

Object obj1 = new Object();
Object obj2 = new Object();
System.out.println(obj1.equals(obj2)); // false — 참조 비교
```

커스텀 클래스에서 값 동등성을 원한다면 반드시 `equals()`를 오버라이드해야 한다. 오버라이드 시 `hashCode()`도 반드시 함께 오버라이드한다.

## toString() 기본 동작

오버라이드하지 않으면 `ClassName@헥사해시코드` 형식을 반환한다.

```java
class Point {
    int x, y;
    Point(int x, int y) { this.x = x; this.y = y; }
}

Point p = new Point(3, 4);
System.out.println(p);  // Point@1b6d3586 — 의미 없음

// toString() 오버라이드
@Override
public String toString() {
    return "Point{x=" + x + ", y=" + y + "}";
}
System.out.println(p);  // Point{x=3, y=4}
```

문자열 연결 `"" + obj`, `System.out.println(obj)`, 로거 출력 시 자동으로 `toString()`이 호출된다.

## getClass()

런타임에 객체의 실제 클래스를 `Class<?>` 객체로 반환한다.

```java
Object obj = "hello";
Class<?> clazz = obj.getClass();

System.out.println(clazz.getName());        // java.lang.String
System.out.println(clazz.getSimpleName()); // String
System.out.println(clazz.isInterface());   // false
```

`equals()`를 오버라이드할 때 타입 비교에 `getClass()`와 `instanceof` 중 어느 것을 쓸지 선택해야 한다. `getClass()` 비교는 엄격한 동일 타입만, `instanceof`는 서브타입도 허용한다.

## wait() / notify()

`Object`의 모니터(monitor) 기반 동기화 메커니즘이다. 반드시 `synchronized` 블록 안에서 호출해야 한다.

```java
class SharedBuffer {
    private final List<Integer> buffer = new ArrayList<>();
    private final int capacity = 10;

    public synchronized void produce(int item) throws InterruptedException {
        while (buffer.size() == capacity) {
            wait();  // 가득 찼으면 대기 (락 반납)
        }
        buffer.add(item);
        notifyAll();  // 소비자 깨우기
    }

    public synchronized int consume() throws InterruptedException {
        while (buffer.isEmpty()) {
            wait();  // 비었으면 대기
        }
        int item = buffer.remove(0);
        notifyAll();  // 생산자 깨우기
        return item;
    }
}
```

현대 Java 코드에서는 `wait/notify` 대신 `java.util.concurrent` 패키지의 `Lock`, `Condition`, `BlockingQueue`를 선호한다.

## 오버라이드 가이드 요약

| 메서드 | 오버라이드? | 주의사항 |
|---|---|---|
| `equals()` | 값 동등성 필요 시 | `hashCode()`와 반드시 쌍으로 |
| `hashCode()` | `equals()` 오버라이드 시 필수 | equals가 true이면 hashCode도 같아야 |
| `toString()` | 권장 | 로그, 디버깅에 유용 |
| `clone()` | 신중히 | `Cloneable` 구현 + protected → public |
| `finalize()` | 하지 말 것 | Deprecated, 예측 불가 |

`equals()`와 `hashCode()`는 계약(contract)이 매우 엄격하다. 다음 두 글에서 각각 상세히 다룬다. 다음 글에서는 **equals()와 hashCode() 계약**을 자세히 살펴본다.

---

**지난 글:** [Java Record 패턴 — 중첩 구조 분해와 패턴 매칭](/posts/java-record-patterns/)

**다음 글:** [Java equals()와 hashCode() — 계약과 올바른 구현](/posts/java-equals-hashcode/)

<br>
읽어주셔서 감사합니다. 😊
