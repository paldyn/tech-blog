---
title: "Java equals()와 hashCode() — 계약과 올바른 구현"
description: "Object.equals()와 hashCode()의 5가지 계약(반사성·대칭성·추이성·일관성·null 비교), equals 오버라이드 시 hashCode를 반드시 쌍으로 구현해야 하는 이유, HashMap에서 계약 위반 시 발생하는 버그, 그리고 Objects.hash()를 활용한 올바른 구현 패턴"
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 5
type: "knowledge"
category: "Java"
tags: ["Java", "equals", "hashCode", "Object", "HashMap", "계약", "동등성"]
featured: false
draft: false
---

[지난 글](/posts/java-object-class/)에서 `java.lang.Object`가 제공하는 11가지 메서드를 살펴봤다. 이번에는 그 중 가장 중요하고 가장 자주 잘못 구현되는 **`equals()`와 `hashCode()`**를 상세히 다룬다. 이 두 메서드는 독립적으로 존재하지 않고 엄격한 **계약(contract)**으로 묶여 있다.

## equals()의 기본 동작과 한계

`Object.equals()`는 참조 동등성(reference equality), 즉 `==`과 동일하다.

```java
String a = new String("hello");
String b = new String("hello");

System.out.println(a == b);        // false — 다른 객체 주소
System.out.println(a.equals(b));   // true  — String이 값 비교로 오버라이드

class Point {
    final int x, y;
    Point(int x, int y) { this.x = x; this.y = y; }
}

Point p1 = new Point(1, 2);
Point p2 = new Point(1, 2);
System.out.println(p1.equals(p2)); // false — Object 기본 구현 (참조 비교)
```

커스텀 클래스에서 값 동등성이 필요하면 `equals()`를 오버라이드해야 한다.

## equals() 5가지 계약

Java 명세서(JLS)는 `equals()`가 반드시 만족해야 하는 다섯 가지 성질을 정의한다.

```java
// 1. 반사성(Reflexive): x.equals(x)는 항상 true
Point p = new Point(1, 2);
assert p.equals(p);

// 2. 대칭성(Symmetric): x.equals(y) == y.equals(x)
Point p1 = new Point(1, 2), p2 = new Point(1, 2);
assert p1.equals(p2) == p2.equals(p1);

// 3. 추이성(Transitive): a=b, b=c → a=c
// 4. 일관성(Consistent): 값 변경 없으면 동일 결과
// 5. null 비교: x.equals(null)은 항상 false (NPE 없음)
```

이 중 **대칭성**과 **추이성**은 상속 관계에서 깨지기 쉽다. 서브클래스가 상위 클래스의 필드에 새 필드를 추가해 equals를 오버라이드하면 추이성이 위반된다.

## hashCode()의 계약

`hashCode()`는 세 가지 규칙을 따라야 한다.

| 규칙 | 설명 |
|---|---|
| 일관성 | 같은 실행 내에서 항상 동일한 값 반환 |
| **equals=true → hashCode 동일** | **황금 규칙 — 위반 시 HashMap 버그** |
| hashCode 동일 → equals는 달라도 됨 | 해시 충돌(collision), 성능 이슈지만 허용됨 |

두 번째 규칙이 핵심이다. `equals()`가 `true`를 반환하는 두 객체는 반드시 같은 `hashCode`를 가져야 한다.

![equals()와 hashCode() 계약 — 5가지 규칙과 황금 원칙](/assets/posts/java-equals-hashcode-contract.svg)

## 계약 위반 시 HashMap 버그

`equals()`만 오버라이드하고 `hashCode()`를 생략하면 어떻게 될까?

```java
class BadPoint {
    int x, y;
    BadPoint(int x, int y) { this.x = x; this.y = y; }

    @Override
    public boolean equals(Object o) {
        if (!(o instanceof BadPoint p)) return false;
        return x == p.x && y == p.y;
    }
    // hashCode() 미오버라이드 — Object 기본값(참조 기반) 사용
}

var map = new HashMap<BadPoint, String>();
var key = new BadPoint(1, 2);
map.put(key, "A");

// 값은 같지만 hashCode가 다른 새 객체로 조회
var lookup = new BadPoint(1, 2);
System.out.println(lookup.equals(key));  // true
System.out.println(map.get(lookup));     // null ← 버그!
```

`HashMap`은 먼저 `hashCode()`로 버킷(bucket)을 찾고, 그 안에서 `equals()`로 키를 비교한다. `hashCode`가 다르면 다른 버킷을 보므로 `equals`가 `true`여도 절대 찾지 못한다.

## 올바른 equals() 구현 템플릿

```java
class Point {
    final int x;
    final int y;
    final String label;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;                  // 1. 참조 동일성
        if (!(o instanceof Point p)) return false;   // 2. null 체크 + 타입 체크
        return x == p.x
            && y == p.y
            && Objects.equals(label, p.label);       // 3. 필드 비교
    }

    @Override
    public int hashCode() {
        return Objects.hash(x, y, label);            // 같은 필드 사용
    }
}
```

`instanceof` 패턴 매칭(Java 16+)을 사용하면 캐스팅을 생략할 수 있다. `Objects.equals(a, b)`는 `null-safe` 비교다.

## hashCode() 구현 방법

```java
// 방법 1: Objects.hash() — 가장 간결, 대부분 충분
@Override
public int hashCode() {
    return Objects.hash(x, y, label);
}

// 방법 2: 수동 구현 — 박싱 오버헤드 없어 성능 크리티컬 시
@Override
public int hashCode() {
    int result = 31 + x;
    result = 31 * result + y;
    result = 31 * result + (label == null ? 0 : label.hashCode());
    return result;
}
```

소수 `31`을 사용하는 이유는 `31 * n = (32 - 1) * n = n << 5 - n`으로 JVM이 시프트 연산으로 최적화하기 때문이다. 또한 홀수 소수라 해시 분포가 좋다.

![equals() + hashCode() 올바른 구현 패턴](/assets/posts/java-equals-hashcode-impl.svg)

## record의 자동 구현

Java 16+ record는 모든 컴포넌트를 사용한 `equals()`와 `hashCode()`를 자동 생성한다.

```java
record Point(int x, int y, String label) { }

var p1 = new Point(1, 2, "A");
var p2 = new Point(1, 2, "A");

System.out.println(p1.equals(p2)); // true — 자동 구현
System.out.println(p1.hashCode() == p2.hashCode()); // true
```

값 동등성이 필요한 불변 데이터 클래스는 record로 선언하면 실수를 원천 차단한다.

## 성능 최적화 — 지연 해시 캐싱

객체가 불변이고 `hashCode()`를 자주 호출한다면 캐싱이 유효하다. `String`이 이 패턴을 사용한다.

```java
class ImmutableKey {
    private final String value;
    private int cachedHash;  // 초기값 0 (미계산)

    @Override
    public int hashCode() {
        int h = cachedHash;
        if (h == 0 && !value.isEmpty()) {
            cachedHash = h = Objects.hash(value);
        }
        return h;
    }
}
```

## 자주 저지르는 실수

**equals() 시그니처 오류**: `equals(Point other)`로 선언하면 오버라이드가 아닌 오버로딩이다. `@Override`를 붙이면 컴파일 에러로 잡힌다.

```java
// 잘못된 오버로딩 — Object.equals()를 오버라이드하지 않음
public boolean equals(Point other) { ... }  // 주의!

// 올바른 오버라이드
@Override
public boolean equals(Object o) { ... }     // Object 타입
```

**가변 필드 포함**: equals/hashCode에 가변(mutable) 필드를 포함하면 HashMap에 넣은 후 필드가 바뀌었을 때 찾을 수 없게 된다. 핵심 식별자(ID) 같은 불변 필드만 포함하라.

`equals()`와 `hashCode()`를 올바르게 구현하는 것은 Java 컬렉션과 올바른 객체 동등성 모델의 기초다. 다음 글에서는 **`toString()` 메서드**를 다룬다. 효과적인 문자열 표현을 작성하는 방법과 다양한 구현 패턴을 살펴볼 것이다.

---

**지난 글:** [Java Object 클래스 — 모든 클래스의 공통 조상](/posts/java-object-class/)

**다음 글:** [Java toString() — 의미 있는 문자열 표현 만들기](/posts/java-tostring/)

<br>
읽어주셔서 감사합니다. 😊
