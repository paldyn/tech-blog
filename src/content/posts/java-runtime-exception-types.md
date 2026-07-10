---
title: "RuntimeException 종류 — 주요 비검사 예외 완전 정리"
description: "Java RuntimeException 종류 완전 정리 — NullPointerException Helpful NPE, IllegalArgumentException, IllegalStateException, IndexOutOfBoundsException, ClassCastException, ConcurrentModificationException 발생 원인과 방어 패턴"
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 5
type: "knowledge"
category: "Java"
tags: ["Java", "RuntimeException", "NullPointerException", "IllegalArgumentException", "예외", "비검사예외"]
featured: false
draft: false
---

[지난 글](/posts/java-exception-chaining/)에서 예외 체이닝으로 원인 예외를 보존하는 방법을 살펴봤다. 이번에는 일상적으로 가장 자주 마주치는 **`RuntimeException` 하위 예외들**의 발생 원인과 방어 방법을 정리한다.

## RuntimeException의 특성

`RuntimeException`과 그 하위 클래스들은 **비검사 예외(Unchecked Exception)**다. 컴파일러가 `throws` 선언이나 `try-catch`를 강제하지 않는다. 대부분 **프로그래밍 오류**에서 발생하므로 예외를 잡아서 복구하기보다는 오류를 수정하는 것이 올바른 접근이다.

![주요 RuntimeException 분류](/assets/posts/java-runtime-exception-types-map.svg)

## NullPointerException (NPE)

Java에서 가장 악명 높은 예외. `null` 참조에 메서드를 호출하거나 필드에 접근할 때 발생한다.

```java
// NPE 발생 상황들
String s = null;
s.length();           // NPE: null 객체 메서드 호출

Integer n = null;
int i = n;            // NPE: null 오토언박싱

String[] arr = new String[3]; // arr[0]은 null
arr[0].toUpperCase(); // NPE: null 배열 원소 메서드 호출

// 체인 중 null
user.getAddress().getCity().toUpperCase(); // 어느 단계든 null이면 NPE
```

### Java 14+ Helpful NPE

Java 14부터 NPE 메시지가 **어떤 변수가 null인지** 명시한다.

```text
NullPointerException: Cannot invoke "String.length()" because "s" is null
NullPointerException: Cannot invoke "Address.getCity()" because the return
  value of "User.getAddress()" is null
```

`-XX:+ShowCodeDetailsInExceptionMessages` 플래그로 활성화(Java 14-16), Java 17부터 기본 활성화.

### NPE 방어

```java
// Objects.requireNonNull — 파라미터 검증
public void setName(String name) {
    this.name = Objects.requireNonNull(name, "name must not be null");
}

// Optional — null 대신 Optional 반환
public Optional<User> findByEmail(String email) {
    return Optional.ofNullable(userMap.get(email));
}

// 체인 중 null 방어
String city = Optional.ofNullable(user)
    .map(User::getAddress)
    .map(Address::getCity)
    .orElse("알 수 없음");
```

## IllegalArgumentException

메서드에 전달된 인수가 유효하지 않을 때 던진다.

```java
public static int factorial(int n) {
    if (n < 0) {
        throw new IllegalArgumentException("n must be >= 0, but was: " + n);
    }
    // ...
}

// API 계약 위반
public void setAge(int age) {
    if (age < 0 || age > 150) {
        throw new IllegalArgumentException("Invalid age: " + age);
    }
    this.age = age;
}
```

`IllegalArgumentException`은 **호출자의 실수**를 알릴 때 사용한다. 메시지에 잘못된 값을 포함해야 디버깅이 쉽다.

## IllegalStateException

메서드가 올바른 인수를 받았지만 **객체의 현재 상태에서는 호출이 허용되지 않을 때** 던진다.

```java
public class Connection {
    private boolean open = false;

    public void open() {
        open = true;
    }

    public void query(String sql) {
        if (!open) {
            throw new IllegalStateException("Connection is not open");
        }
        // ...
    }
}

// Iterator에서도 발생
Iterator<String> it = list.iterator();
it.remove(); // next() 호출 전 remove() → IllegalStateException
```

`IAE`는 잘못된 인수, `ISE`는 잘못된 호출 순서(상태)를 나타낸다.

## IndexOutOfBoundsException

배열이나 리스트의 유효 범위를 벗어난 인덱스에 접근할 때 발생한다.

```java
int[] arr = new int[3]; // 인덱스 0, 1, 2
arr[3] = 10; // ArrayIndexOutOfBoundsException: Index 3 out of bounds for length 3

List<String> list = List.of("a", "b");
list.get(5); // IndexOutOfBoundsException: Index: 5, Size: 2

String s = "hello";
s.charAt(10); // StringIndexOutOfBoundsException: String index out of range: 10
```

방어: `index >= 0 && index < arr.length` 검사, 또는 `Objects.checkIndex(index, length)` (Java 9+).

## ClassCastException

객체를 실제 타입과 맞지 않는 타입으로 캐스팅할 때 발생한다.

```java
Object obj = "hello";
Integer n = (Integer) obj; // ClassCastException: String cannot be cast to Integer
```

**방어: `instanceof` 먼저 확인** (또는 Java 16+ pattern matching)

```java
if (obj instanceof Integer n) {
    System.out.println(n * 2); // 안전한 사용
}

// Java 16 이전
if (obj instanceof Integer) {
    Integer n = (Integer) obj;
}
```

제네릭 코드에서 raw 타입을 사용하면 힙 오염(Heap Pollution)으로 CCE가 예측하지 못한 곳에서 발생할 수 있다.

## ConcurrentModificationException

컬렉션을 `for-each`나 `Iterator`로 순회하는 도중 구조를 변경(추가/삭제)하면 발생한다.

```java
List<String> list = new ArrayList<>(List.of("a", "b", "c"));

// ❌ CME 발생
for (String s : list) {
    if (s.equals("b")) {
        list.remove(s); // ConcurrentModificationException!
    }
}

// ✅ Iterator.remove() 사용
Iterator<String> it = list.iterator();
while (it.hasNext()) {
    if (it.next().equals("b")) {
        it.remove(); // 안전
    }
}

// ✅ removeIf() (Java 8+)
list.removeIf(s -> s.equals("b"));
```

멀티스레드 환경에서는 `CopyOnWriteArrayList` 또는 동기화된 컬렉션을 사용한다.

## ArithmeticException

```java
int result = 10 / 0; // ArithmeticException: / by zero

// float/double은 NPE 안 던짐 — 특수값 반환
double d = 10.0 / 0.0; // Infinity
double nan = 0.0 / 0.0; // NaN
```

## NumberFormatException

```java
int n = Integer.parseInt("abc"); // NumberFormatException
int m = Integer.parseInt("999999999999"); // NumberFormatException (int 범위 초과)

// 방어: try-catch 또는 사전 검증
try {
    int val = Integer.parseInt(input);
} catch (NumberFormatException e) {
    // 사용자 입력 오류 처리
}
```

## StackOverflowError

`RuntimeException`이 아니라 `Error`지만 자주 만나는 예외다. 재귀 종료 조건 없이 무한 재귀 호출될 때 발생한다.

```java
public int infinite(int n) {
    return infinite(n + 1); // 종료 조건 없음 → StackOverflowError
}
```

![NullPointerException 발생 케이스와 방어](/assets/posts/java-runtime-exception-npe-cases.svg)

## 요약 — RuntimeException 대응 원칙

| 예외 | 발생 원인 | 대응 |
|------|-----------|------|
| NPE | null 참조 역참조 | requireNonNull, Optional |
| IAE | 잘못된 인수 | 파라미터 검증 후 던지기 |
| ISE | 잘못된 호출 순서 | 상태 검증 |
| IOOBE | 인덱스 범위 초과 | 범위 검사 |
| CCE | 잘못된 타입 캐스팅 | instanceof 확인 |
| CME | 순회 중 컬렉션 수정 | Iterator.remove(), removeIf() |

RuntimeException은 잡아서 복구하려 하기보다 **발생하지 않도록 코드를 수정**하는 것이 원칙이다.

---

**지난 글:** [예외 체이닝 — 원인 예외를 보존하는 방법](/posts/java-exception-chaining/)

**다음 글:** [예외 처리 베스트 프랙티스 — 올바른 예외 설계 원칙](/posts/java-exception-best-practices/)

<br>
읽어주셔서 감사합니다. 😊
