---
title: "제네릭 함정 — 흔한 실수와 주의사항"
description: "Raw type 사용, 힙 오염 위험, instanceof 검사 불가, 제네릭 배열 생성 불가, T 인스턴스화 불가, 오버로딩 충돌, 브리지 메서드 이해, @SuppressWarnings unchecked 올바른 사용법"
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 8
type: "knowledge"
category: "Java"
tags: ["Java", "제네릭", "함정", "Raw Type", "Heap Pollution", "브리지 메서드", "SuppressWarnings"]
featured: false
draft: false
---

[지난 글](/posts/java-type-erasure/)에서 타입 소거의 작동 방식과 런타임 제약을 살펴봤다. 이번에는 제네릭을 실제로 사용하다 자주 마주치는 **함정(pitfall)**들을 정리한다. 컴파일러 경고를 무시하지 않고 원인을 이해하는 것이 핵심이다.

## ① Raw Type 사용 — 컴파일 경고 무시

제네릭 클래스를 타입 인자 없이 사용하면 **raw type**이 된다. raw type은 하위 호환을 위해 허용되지만, 모든 타입 안전 보장이 사라진다.

```java
// NG — raw type
List list = new ArrayList();
list.add("hello");
list.add(42);
String s = (String) list.get(1); // 런타임 ClassCastException!

// OK — 타입 인자 지정
List<String> list = new ArrayList<>();
// list.add(42); 컴파일 오류로 차단
String s = list.get(0);
```

`@SuppressWarnings("rawtypes")`로 경고를 억제하는 코드는 나중에 발견하기 어려운 버그의 씨앗이 된다.

## ② 힙 오염(Heap Pollution)

raw type과 제네릭 타입을 혼용하면 힙 오염이 발생한다.

```java
List<String> strs = new ArrayList<>();
List raw = strs;            // unchecked 경고 발생
raw.add(42);                // Integer 삽입 가능
String s = strs.get(0);     // ClassCastException!
```

컴파일 경고 `unchecked`가 보이면 무시하지 말고 원인을 제거해야 한다.

![제네릭 함정 모음](/assets/posts/java-generics-pitfalls-grid.svg)

## ③ T 인스턴스 생성 불가

타입 소거로 인해 `new T()`는 런타임에 T가 무엇인지 알 수 없으므로 컴파일 오류가 난다.

```java
class Factory<T> {
    // 컴파일 오류
    // public T create() { return new T(); }

    // 해결 1: Class<T> 토큰
    public T createFromClass(Class<T> clazz) throws Exception {
        return clazz.getDeclaredConstructor().newInstance();
    }

    // 해결 2: Supplier<T> 팩토리 함수
    public T createFromSupplier(Supplier<T> supplier) {
        return supplier.get();
    }
}
```

```java
Factory<User> factory = new Factory<>();
User u1 = factory.createFromClass(User.class);
User u2 = factory.createFromSupplier(User::new);
```

## ④ 제네릭 배열 생성 불가

`new T[n]`은 타입 소거 후 `new Object[n]`이 되는데, 배열 공변성과 결합하면 타입 안전성이 깨진다.

```java
// 컴파일 오류
T[] arr = new T[10];

// 우회 — unchecked 경고 발생, 힙 오염 가능
@SuppressWarnings("unchecked")
T[] arr = (T[]) new Object[10];

// 권장: 배열 대신 List 사용
List<T> list = new ArrayList<>();
```

배열과 제네릭을 섞어야 할 때는 `@SafeVarargs`와 내부 가변 배열을 캡슐화하는 패턴을 활용한다.

## ⑤ 오버로딩 충돌 — 소거 후 같은 시그니처

타입 소거 후 같은 시그니처가 되는 메서드는 오버로딩할 수 없다.

```java
// 컴파일 오류 — 소거 후 둘 다 process(List)
void process(List<String> list)  { }
void process(List<Integer> list) { }

// 해결: 메서드 이름을 다르게
void processStrings(List<String> list)  { }
void processNumbers(List<Integer> list) { }
```

## ⑥ 경계 없는 T 비교 시도

`T`에 경계를 지정하지 않으면 `T`의 메서드를 호출할 수 없다.

```java
// 컴파일 오류 — T에 compareTo 없음
static <T> T max(T a, T b) {
    return a.compareTo(b) > 0 ? a : b; // 오류!
}

// 해결: 경계 지정
static <T extends Comparable<T>> T max(T a, T b) {
    return a.compareTo(b) > 0 ? a : b; // OK
}
```

## ⑦ @SuppressWarnings — 범위를 최소화

`@SuppressWarnings("unchecked")`를 메서드 전체에 붙이면 다른 경고도 함께 숨겨질 수 있다. **경고가 발생하는 줄 또는 지역 변수 선언에만** 붙인다.

```java
// NG — 메서드 전체 억제
@SuppressWarnings("unchecked")
public <T> T[] toArray(Object[] arr) { ... }

// OK — 해당 줄만 억제
public <T> T[] toArray(Object[] arr) {
    @SuppressWarnings("unchecked")
    T[] result = (T[]) Arrays.copyOf(arr, arr.length);
    return result;
}
```

억제하기 전에 반드시 "이 캐스팅이 절대 `ClassCastException`을 유발하지 않는다"고 **직접 증명**해야 한다.

![브리지 메서드와 SuppressWarnings](/assets/posts/java-generics-pitfalls-code.svg)

## ⑧ 브리지 메서드 (참고 지식)

제네릭 인터페이스를 구현할 때 컴파일러는 소거 후 인터페이스 시그니처를 만족하는 **브리지 메서드**를 자동 추가한다. `javap -verbose`로 클래스 파일을 분석하면 `synthetic bridge` 메서드를 확인할 수 있다.

```java
interface Printable<T> {
    void print(T t);
}

class StringPrinter implements Printable<String> {
    public void print(String t) { System.out.println(t); }
    // 컴파일러가 자동 추가: (bridge) void print(Object t) { print((String) t); }
}
```

---

**지난 글:** [타입 소거 — 런타임의 제네릭 타입](/posts/java-type-erasure/)

**다음 글:** [컬렉션 프레임워크 개요 — Java Collections의 전체 구조](/posts/java-collection-framework/)

<br>
읽어주셔서 감사합니다. 😊
