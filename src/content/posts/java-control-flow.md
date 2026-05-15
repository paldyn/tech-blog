---
title: "Java 제어 흐름(Control Flow) 완전 정리"
description: "if·else, for, while, do-while, for-each, break, continue, return, labeled break까지 Java의 모든 제어 흐름 구조를 예제 중심으로 완전히 정리하고, 가드 클로즈·무한 루프 탈출 등 실무 패턴까지 해설한다"
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "control flow", "제어흐름", "if", "else", "for", "while", "do-while", "for-each", "break", "continue", "return", "labeled break", "가드클로즈"]
featured: false
draft: false
---

[지난 글](/posts/java-operators/)에서 다양한 연산자를 살펴봤다. 이번에는 그 연산자들을 활용해 프로그램의 실행 흐름을 결정하는 **제어 흐름(Control Flow)** 구조를 완전히 정리한다. if/else, 세 가지 루프, break/continue/return, 그리고 실무에서 코드 품질을 높이는 패턴까지 다룬다.

## if / else if / else

가장 기본적인 조건 분기다.

```java
int score = 78;

if (score >= 90) {
    System.out.println("A");
} else if (score >= 80) {
    System.out.println("B");
} else if (score >= 70) {
    System.out.println("C");
} else {
    System.out.println("F");
}
// 출력: C
```

중괄호 `{}`는 한 줄짜리 블록이라도 생략하지 않는 것이 권장된다. 나중에 줄이 추가될 때 버그로 이어질 수 있다.

### 가드 클로즈 패턴 (Guard Clause)

중첩 if를 피하고 조기 반환으로 코드를 평탄하게 만든다.

```java
// 중첩 if (나쁜 예)
void process(String input) {
    if (input != null) {
        if (!input.isEmpty()) {
            // 실제 로직...
        }
    }
}

// 가드 클로즈 (좋은 예)
void process(String input) {
    if (input == null) return;
    if (input.isEmpty()) return;
    // 실제 로직만 남음
}
```

## for 루프

초기화 → 조건 검사 → 본문 실행 → 업데이트를 반복한다.

```java
// 기본 형태
for (int i = 0; i < 5; i++) {
    System.out.print(i + " ");  // 0 1 2 3 4
}

// 역방향
for (int i = 4; i >= 0; i--) {
    System.out.print(i + " ");  // 4 3 2 1 0
}

// 여러 변수 (쉼표로 구분)
for (int i = 0, j = 10; i < j; i++, j--) {
    System.out.println(i + " " + j);
}
```

세 구성 요소(초기화·조건·업데이트)는 각각 생략 가능하다. 조건을 생략하면 무한 루프가 된다.

## while 루프

조건이 참인 동안 반복한다. **조건을 먼저 검사**하므로 한 번도 실행되지 않을 수 있다.

```java
int n = 1;
while (n < 1000) {
    n *= 2;
}
System.out.println(n);  // 1024

// 무한 루프 패턴 — 내부에서 break로 탈출
while (true) {
    String line = scanner.nextLine();
    if ("quit".equals(line)) break;
    process(line);
}
```

## do-while 루프

본문을 먼저 실행한 뒤 조건을 검사하므로 **최소 한 번은 반드시 실행**된다.

```java
int attempt = 0;
do {
    attempt++;
    System.out.println("시도 #" + attempt);
} while (attempt < 3);
// 시도 #1, 시도 #2, 시도 #3 출력

// 사용자 입력 유효성 검사에 유용
String input;
do {
    input = readInput();
} while (!isValid(input));
```

## Enhanced for (for-each)

배열이나 `Iterable`을 순회할 때 인덱스가 필요 없다면 가장 간결하다.

```java
int[] primes = {2, 3, 5, 7, 11, 13};
int sum = 0;
for (int p : primes) {
    sum += p;
}
System.out.println(sum);  // 41

List<String> names = List.of("Alice", "Bob", "Carol");
for (String name : names) {
    System.out.println("Hello, " + name);
}
```

for-each 루프 안에서 컬렉션에 원소를 추가하거나 제거하면 `ConcurrentModificationException`이 발생한다. 순회 중 수정이 필요하면 `Iterator`나 인덱스 기반 for 루프를 써야 한다.

![Java 제어 흐름 구조](/assets/posts/java-control-flow-structures.svg)

## break, continue, return

세 키워드는 루프나 메서드의 흐름을 조기에 변경한다.

```java
// break: 루프 즉시 탈출
for (int i = 0; i < 100; i++) {
    if (i * i > 50) {
        System.out.println("첫 번째 초과: " + i);
        break;  // 루프 종료
    }
}

// continue: 나머지 반복 건너뜀
for (int i = 1; i <= 10; i++) {
    if (i % 2 == 0) continue;  // 짝수 건너뜀
    System.out.print(i + " ");  // 1 3 5 7 9
}

// return: 메서드 즉시 종료
int firstNegative(int[] arr) {
    for (int v : arr) {
        if (v < 0) return v;  // 발견 즉시 반환
    }
    return -1;  // 없으면 -1
}
```

## Labeled break / continue

중첩 루프에서 바깥 루프를 제어할 때 레이블을 사용한다.

```java
outer:
for (int i = 0; i < 5; i++) {
    for (int j = 0; j < 5; j++) {
        if (i + j == 6) {
            System.out.println("found: i=" + i + " j=" + j);
            break outer;  // 바깥 루프까지 탈출
        }
    }
}
// found: i=1 j=5 — 첫 발견에서 완전 탈출
```

레이블은 강력하지만 남용하면 가독성이 크게 떨어진다. 중첩이 깊어진다면 메서드 분리를 먼저 고려한다.

## switch 문 (전통 방식)

여러 값에 따른 분기에 if-else 체인보다 명확할 수 있다.

```java
int day = 3;
String name;
switch (day) {
    case 1: name = "월요일"; break;
    case 2: name = "화요일"; break;
    case 3: name = "수요일"; break;
    default: name = "기타"; break;
}
System.out.println(name);  // 수요일
```

`break`를 빠뜨리면 다음 `case`로 **fall-through**가 발생한다. 의도한 경우가 아니라면 항상 `break`를 넣어야 한다. Java 14+부터는 이를 개선한 `switch` 표현식(arrow switch)이 표준화됐다. 다음 글에서 자세히 다룬다.

## 실용 패턴 요약

![제어 흐름 코드 예제](/assets/posts/java-control-flow-examples.svg)

| 상황 | 권장 구조 |
|------|----------|
| 조건 분기 1~2개 | `if / else` |
| 조건 분기 3개 이상 | `switch` 또는 `switch` 표현식 |
| 횟수가 정해진 반복 | `for` |
| 조건 기반 반복 | `while` |
| 최소 1회 필요 | `do-while` |
| 컬렉션/배열 순회 | `for-each` |
| 중첩 루프 탈출 | `labeled break` (또는 메서드 분리) |

## 정리

Java의 제어 흐름은 크게 **조건 분기(if, switch)**와 **반복(for, while, do-while)**으로 나뉜다. 실무에서는 중첩을 최소화하는 **가드 클로즈** 패턴, `continue`로 불필요한 중첩을 줄이는 방식, 그리고 컬렉션 순회에 for-each를 기본으로 선택하는 습관이 코드 품질을 높인다. 다음 글에서는 Java 14에 정식 도입된 `switch` 표현식과 더 강력해진 패턴 매칭 switch를 살펴본다.

---

**지난 글:** [Java 연산자(Operator) 완전 정리](/posts/java-operators/)

**다음 글:** [Java switch 표현식 완전 정리](/posts/java-switch-expression/)

<br>
읽어주셔서 감사합니다. 😊
