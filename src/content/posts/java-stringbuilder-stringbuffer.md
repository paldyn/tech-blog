---
title: "Java StringBuilder · StringBuffer 완전 정복 — 가변 문자열의 모든 것"
description: "String 연결이 느린 이유, StringBuilder와 StringBuffer의 내부 구조·차이, 핵심 API 사용법, 성능 최적화 전략까지 가변 문자열을 완전 정복한다"
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "StringBuilder", "StringBuffer", "가변 문자열", "성능", "메서드 체이닝"]
featured: false
draft: false
---

[지난 글](/posts/java-string-pool/)에서 String Pool의 구조와 intern() 동작 원리를 살펴봤다. String이 불변(Immutable)이라는 사실 덕분에 Pool 공유가 가능하지만, 그 불변성은 문자열을 반복해서 이어 붙이는 상황에서 심각한 성능 문제를 일으킨다. 이번 글에서는 이 문제를 해결하기 위해 등장한 **StringBuilder**와 **StringBuffer**의 내부 구조, API, 그리고 실전 사용 전략을 완전히 파고든다.

## String 연결이 느린 이유

String은 불변이기 때문에 `+` 연산을 수행할 때마다 새로운 String 객체를 힙에 생성한다.

```java
String s = "";
for (int i = 0; i < 10_000; i++) {
    s = s + i;  // 매번 새 String 객체 생성
}
```

이 루프는 10,000번의 반복마다 점점 길어지는 문자열을 통째로 복사해 새 객체를 만든다. 복사량은 0+1+2+…+9999 = 약 5천만 자(character)에 달한다. O(n²) 복잡도다.

Java 컴파일러는 단순한 리터럴 연결(`"Hello" + " " + "World"`)은 컴파일 타임에 하나의 문자열로 합쳐 주지만, **루프 안의 연결은 최적화하지 않는다**. 이때 필요한 도구가 `StringBuilder`다.

## StringBuilder — 가변 문자열의 기본

`StringBuilder`는 내부에 `char[]` 배열(Java 9+에서는 `byte[]`)을 두고, 데이터를 추가할 때 새 객체를 만들지 않고 배열을 직접 수정한다. 참조 변수는 그대로이므로 불변성 없이 빠른 조작이 가능하다.

```java
StringBuilder sb = new StringBuilder(32); // 초기 capacity 지정

sb.append("Hello")
  .append(", ")
  .append("World");   // Hello, World

sb.insert(5, "!");    // Hello!, World
sb.delete(6, 7);      // Hello!World
sb.replace(6, 11, "Java"); // Hello!Java

String result = sb.toString(); // 불변 String으로 변환
```

`append()`는 `StringBuilder` 자신을 반환하므로 체이닝(`.append().append()…`)이 가능하다. 위의 루프를 `StringBuilder`로 바꾸면:

```java
StringBuilder sb = new StringBuilder();
for (int i = 0; i < 10_000; i++) {
    sb.append(i);
}
String s = sb.toString(); // O(n)
```

O(n²)이 O(n)으로 바뀐다.

![String · StringBuilder · StringBuffer 비교](/assets/posts/java-stringbuilder-stringbuffer-comparison.svg)

## 내부 버퍼 구조 — capacity와 length

`StringBuilder` 내부 배열의 크기를 **capacity**, 실제 저장된 문자 수를 **length**라고 부른다.

```java
StringBuilder sb = new StringBuilder(16); // capacity=16, length=0
sb.append("Hello");                        // capacity=16, length=5

sb.ensureCapacity(100); // 최소 100 보장 (필요 시 확장)
System.out.println(sb.capacity()); // 실제 capacity 확인
System.out.println(sb.length());   // 5
```

`capacity`가 부족할 때 JVM은 내부 배열을 `2 × old + 2` 크기로 자동 확장하고 기존 내용을 복사한다. 자주 확장이 일어나면 복사 비용이 누적된다. 루프 횟수나 예상 데이터 크기를 알고 있다면 **생성자에 capacity를 미리 지정**하는 것이 좋다.

```java
// 예상 크기가 ~1000자라면 미리 확보
StringBuilder sb = new StringBuilder(1024);
```

기본 capacity는 **16**이다. 초기값을 `new StringBuilder("Hello")`처럼 문자열로 주면 `"Hello".length() + 16 = 21`이 초기 capacity가 된다.

## 핵심 API 정리

![StringBuilder 핵심 API](/assets/posts/java-stringbuilder-stringbuffer-api.svg)

| 메서드 | 설명 |
|---|---|
| `append(x)` | 끝에 추가. 거의 모든 타입 오버로드 지원 |
| `insert(i, x)` | 인덱스 `i` 위치에 삽입 |
| `delete(s, e)` | `[s, e)` 구간 삭제 |
| `deleteCharAt(i)` | 인덱스 `i`의 문자 하나 삭제 |
| `replace(s, e, str)` | `[s, e)` 구간을 `str`로 교체 |
| `reverse()` | 전체 문자열 역순 변환 |
| `charAt(i)` | 인덱스 `i`의 문자 반환 |
| `setCharAt(i, c)` | 인덱스 `i`의 문자를 `c`로 변경 |
| `indexOf(str)` | 부분 문자열 검색 |
| `substring(s, e)` | `[s, e)` 구간 String으로 추출 |
| `length()` | 실제 문자 수 |
| `capacity()` | 내부 버퍼 크기 |
| `toString()` | 불변 `String`으로 변환 |

`append()`에 넘길 수 있는 타입은 `boolean`, `char`, `int`, `long`, `float`, `double`, `char[]`, `CharSequence`, `Object` 등 거의 모든 타입이다. `null`을 넘기면 문자열 `"null"`이 추가된다.

## StringBuffer — thread-safe 버전

`StringBuffer`는 `StringBuilder`와 **API가 완전히 동일**하다. 차이는 단 하나: 모든 공개 메서드에 `synchronized` 키워드가 붙어 있다.

```java
// StringBuffer 선언 — API는 StringBuilder와 동일
StringBuffer sbuf = new StringBuffer(32);
sbuf.append("thread-safe");
sbuf.insert(6, "-");
String result = sbuf.toString();
```

`synchronized` 덕분에 여러 스레드가 동시에 같은 `StringBuffer` 인스턴스에 접근해도 데이터 경쟁(race condition)이 발생하지 않는다. 그러나 락 획득·해제 비용 때문에 단일 스레드 환경에서는 `StringBuilder`보다 느리다.

### StringBuffer를 선택해야 하는 경우

```java
// 공유 상태를 여러 스레드가 수정하는 예
class LogCollector {
    private final StringBuffer log = new StringBuffer();

    public void add(String msg) {
        log.append(msg).append('\n'); // 여러 스레드에서 동시 호출 가능
    }

    public String get() {
        return log.toString();
    }
}
```

이처럼 **인스턴스를 여러 스레드가 공유하며 수정**하는 경우에만 `StringBuffer`가 필요하다. 대부분의 현대 코드에서는 스레드 로컬 변수 또는 `StringJoiner`·`Stream`으로 대체하는 편이 더 자연스럽다.

## 세 클래스 선택 기준 정리

```
단순 상수 / 변경 없는 값       → String
단일 스레드 문자열 조작        → StringBuilder  (기본 선택)
여러 스레드가 공유하며 수정    → StringBuffer   (또는 외부 동기화)
```

실무에서 `StringBuffer`를 만날 일은 드물다. JDK 1.5(Java 5)에서 `StringBuilder`가 추가되면서 대부분의 사용처를 대체했기 때문이다. 레거시 코드 리뷰 시 불필요한 `StringBuffer`를 `StringBuilder`로 교체하는 것은 안전하고 간단한 성능 개선이다.

## 컴파일러의 자동 최적화

Java 컴파일러는 **같은 구문 안의** `+` 연결을 자동으로 `StringBuilder`로 변환한다.

```java
// 소스
String s = "Hello" + name + "!";

// 컴파일 후 (javap -c 로 확인)
// new StringBuilder()
// .append("Hello")
// .append(name)
// .append("!")
// .toString()
```

하지만 **루프를 걸쳐 이어 붙이는 경우**는 최적화되지 않는다. `javac`가 루프마다 새 `StringBuilder`를 생성하기 때문이다. 루프 내 반복 연결은 반드시 수동으로 `StringBuilder`를 꺼내 써야 한다.

Java 9+에서는 **`invokedynamic` 기반의 `StringConcatFactory`**가 추가되어 더 유연한 최적화가 가능해졌다. 내부 전략이 바뀌더라도 루프 안에서는 여전히 직접 `StringBuilder`를 쓰는 것이 가장 확실하다.

## 성능 비교 예시

```java
int N = 100_000;

// 방법 1: String + (매우 느림)
long t1 = System.nanoTime();
String s = "";
for (int i = 0; i < N; i++) s += i;
System.out.println("String +: " + (System.nanoTime() - t1) / 1_000_000 + "ms");

// 방법 2: StringBuilder (빠름)
long t2 = System.nanoTime();
StringBuilder sb = new StringBuilder(N * 5);
for (int i = 0; i < N; i++) sb.append(i);
String s2 = sb.toString();
System.out.println("StringBuilder: " + (System.nanoTime() - t2) / 1_000_000 + "ms");
```

일반적인 환경에서 N=100,000 기준으로 `String +`는 수백 ms, `StringBuilder`는 수 ms 수준의 차이가 난다.

## 실전 팁

**capacity 미리 지정**: 예상 크기를 알 때 `new StringBuilder(expectedSize)`로 재할당을 방지한다.

**`trimToSize()`**: 연산 완료 후 남는 버퍼를 줄여 메모리를 절약한다. 결과를 장기간 보관하는 경우에 유용하다.

**`delete(0, sb.length())`로 초기화**: 객체를 재사용할 때 `new StringBuilder()`를 다시 만들지 않고 내용만 비워 쓸 수 있다. 단, 객체 풀이나 루프 재사용 맥락에서만 가치 있고, 대부분의 경우 새 객체를 만드는 게 코드 명확성 면에서 낫다.

**`StringJoiner` / `String.join()`**: 구분자가 필요한 리스트 합치기라면 `StringBuilder`보다 `StringJoiner` 또는 `String.join(delimiter, list)`가 더 간결하다.

```java
// StringJoiner 예시
StringJoiner sj = new StringJoiner(", ", "[", "]");
sj.add("apple");
sj.add("banana");
sj.add("cherry");
System.out.println(sj); // [apple, banana, cherry]
```

---

**지난 글:** [Java String Pool 완전 정복 — intern, 리터럴, 메모리 구조](/posts/java-string-pool/)

**다음 글:** [Java Text Block 완전 정복 — 여러 줄 문자열 처리](/posts/java-text-block/)

<br>
읽어주셔서 감사합니다. 😊
