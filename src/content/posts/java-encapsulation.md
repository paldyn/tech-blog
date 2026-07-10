---
title: "Java 캡슐화 완전 정복 — 정보 은닉과 불변식 보호"
description: "캡슐화(Encapsulation)의 핵심 원리인 정보 은닉과 불변식 보호를 이해하고, private 필드·공개 메서드 패턴으로 객체가 항상 유효한 상태를 유지하도록 설계하는 방법을 완전 정복한다"
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "캡슐화", "Encapsulation", "정보 은닉", "불변식", "OOP", "객체지향", "private", "getter", "setter"]
featured: false
draft: false
---

[지난 글](/posts/java-access-modifiers/)에서 `public`, `protected`, `private` 네 가지 접근 제어자가 어떤 범위를 열고 닫는지를 살펴봤다. 이번에는 그 접근 제어자를 어떻게 조합해야 **객체지향의 핵심 원칙인 캡슐화(Encapsulation)** 를 제대로 구현할 수 있는지를 다룬다. 단순히 `private`을 붙이는 것과 진짜 캡슐화는 다르다.

## 캡슐화란 무엇인가

캡슐화는 객체의 **데이터(필드)와 그 데이터를 다루는 로직(메서드)을 하나의 단위로 묶고, 내부 상태는 외부에서 직접 접근하지 못하도록 숨기는** 설계 원칙이다. 의약품의 캡슐처럼, 내부의 성분(구현)을 보호하면서 외부에는 표준화된 인터페이스(메서드)만 드러낸다.

캡슐화가 제공하는 핵심 가치는 세 가지다.

- **정보 은닉**: 내부 구현 세부사항이 외부로 새어나가지 않는다
- **불변식(Invariant) 보호**: 객체가 항상 유효한 상태를 유지하도록 보장한다
- **구현 자유**: 외부 인터페이스를 유지하면서 내부 구현을 자유롭게 바꿀 수 있다

![캡슐화 개념 — 정보 은닉과 캡슐화 없는 경우 비교](/assets/posts/java-encapsulation-concept.svg)

## 캡슐화의 가장 흔한 위반

캡슐화를 설명할 때 항상 등장하는 반례(anti-pattern)가 있다.

```java
// 캡슐화 위반 — 절대 하지 말 것
public class BankAccount {
    public long balance;         // public 필드 → 외부에서 직접 수정 가능
    public String accountNumber;
}

// 외부에서 아무 제약 없이 수정
BankAccount acc = new BankAccount();
acc.balance = -9_999_999;    // 음수 잔액 → 불변식 파괴
acc.accountNumber = "";      // 빈 계좌번호 → 불변식 파괴
```

`public` 필드는 객체의 상태를 완전히 노출한다. 외부 코드가 `balance`를 직접 `-9,999,999`로 설정해도 막을 방법이 없다. 객체는 **항상 유효한 상태여야 한다**는 불변식이 깨진다.

더 심각한 문제는 나중에 구현을 바꾸기 어렵다는 것이다. 잔액 단위를 원(long)에서 원/전(BigDecimal)으로 바꾸려면, `acc.balance`에 의존하는 외부 코드가 전부 깨진다. **내부 구현 변경이 외부 코드에 파급효과를 일으키는 구조**다.

## 올바른 캡슐화 패턴

```java
public class BankAccount {
    private long balance;             // 외부에서 직접 접근 불가
    private final String accountNumber;

    public BankAccount(String accountNumber, long initialBalance) {
        if (accountNumber == null || accountNumber.isBlank())
            throw new IllegalArgumentException("계좌번호는 필수입니다.");
        if (initialBalance < 0)
            throw new IllegalArgumentException("초기 잔액은 음수일 수 없습니다.");
        this.accountNumber = accountNumber;
        this.balance = initialBalance;
    }

    public void deposit(long amount) {
        if (amount <= 0)
            throw new IllegalArgumentException("입금액은 양수여야 합니다.");
        balance += amount;            // 유효성 검사 통과 후 상태 변경
    }

    public void withdraw(long amount) {
        if (amount <= 0)
            throw new IllegalArgumentException("출금액은 양수여야 합니다.");
        if (amount > balance)
            throw new IllegalStateException("잔액이 부족합니다.");
        balance -= amount;
    }

    public long getBalance() { return balance; }
    public String getAccountNumber() { return accountNumber; }
}
```

이 구조에서 외부 코드는 `deposit()`, `withdraw()`, `getBalance()` 세 가지 공개 메서드만 사용할 수 있다. `balance`를 직접 수정하는 경로가 없으므로, `balance >= 0`이라는 불변식은 객체 생애 전체에 걸쳐 보장된다.

나중에 `balance`의 타입을 `long`에서 `BigDecimal`로 바꿔도, 외부 코드는 `deposit()`, `withdraw()`, `getBalance()`를 그대로 쓸 수 있다. **인터페이스와 구현이 분리**된 덕분이다.

## 불변식을 코드로 표현하기

불변식(Invariant)이란 **객체가 존재하는 동안 항상 참이어야 하는 조건**이다. 캡슐화의 목적은 이 불변식이 어떤 경우에도 깨지지 않도록 보장하는 것이다.

![불변식 보호 흐름 — 유효성 검사와 상태 변경](/assets/posts/java-encapsulation-invariant.svg)

좋은 캡슐화 설계는 불변식을 메서드 안에서 명시적으로 검사한다. 생성자에서는 초기 불변식을, 상태 변경 메서드에서는 사후 불변식을 검사한다.

```java
public class Range {
    private final int min;
    private final int max;

    // 불변식: min <= max
    public Range(int min, int max) {
        if (min > max)
            throw new IllegalArgumentException(
                "min(%d) > max(%d)".formatted(min, max));
        this.min = min;
        this.max = max;
    }

    public boolean contains(int value) {
        return min <= value && value <= max;
    }

    // 불변식 유지: 새 Range 객체를 반환, 기존 객체는 불변
    public Range expand(int delta) {
        return new Range(min - delta, max + delta);
    }
}
```

`Range`는 `min <= max`라는 불변식을 생성자에서 강제한다. 필드가 모두 `private final`이라 생성 이후 상태가 변하지 않는다. 불변 객체(Immutable Object)는 캡슐화의 가장 강력한 형태다.

## 컬렉션 필드의 캡슐화

컬렉션을 필드로 가질 때 흔히 저지르는 실수가 있다.

```java
// 위험한 패턴
public class Team {
    private List<String> members = new ArrayList<>();

    // 내부 리스트를 그대로 반환 → 외부에서 수정 가능
    public List<String> getMembers() {
        return members;    // ← 캡슐화 누출
    }
}

Team team = new Team();
team.getMembers().add("무단 추가");  // 불변식 파괴
team.getMembers().clear();          // 모든 멤버 삭제
```

`getMembers()`가 내부 리스트를 그대로 반환하면, 호출자가 `add()`, `remove()`, `clear()`로 팀 상태를 마음대로 바꿀 수 있다. 방어적 복사(Defensive Copy)나 불변 뷰를 반환해야 한다.

```java
public class Team {
    private final List<String> members = new ArrayList<>();

    public void addMember(String name) {
        if (name == null || name.isBlank())
            throw new IllegalArgumentException("이름이 필요합니다.");
        members.add(name);
    }

    // 불변 뷰 반환 — 외부에서 수정 불가
    public List<String> getMembers() {
        return Collections.unmodifiableList(members);
    }

    // 또는 방어적 복사
    public List<String> getMembersCopy() {
        return new ArrayList<>(members);
    }
}
```

`unmodifiableList()`로 감싸면 반환된 리스트를 수정하려 할 때 `UnsupportedOperationException`이 발생한다. 내부 `members`는 안전하게 보호된다.

## 가변 객체 필드의 방어적 복사

`Date`, 배열처럼 내용이 바뀔 수 있는 객체를 필드로 가질 때도 주의가 필요하다.

```java
// 취약한 설계
public class Period {
    private final Date start;
    private final Date end;

    public Period(Date start, Date end) {
        this.start = start;    // 참조를 그대로 저장 → 외부에서 start.setTime()으로 변경 가능
        this.end = end;
    }

    public Date getStart() { return start; }   // 내부 Date 노출 → 수정 가능
}

// Java 8+에서는 LocalDate/LocalDateTime 사용 — 자체적으로 불변
public class Period {
    private final LocalDate start;
    private final LocalDate end;

    public Period(LocalDate start, LocalDate end) {
        if (start.isAfter(end))
            throw new IllegalArgumentException("시작일이 종료일보다 늦을 수 없습니다.");
        this.start = start;
        this.end = end;
    }

    public LocalDate getStart() { return start; }  // LocalDate는 불변이므로 안전
    public LocalDate getEnd()   { return end; }
}
```

Java 8 이후 날짜/시간 API(`LocalDate`, `LocalDateTime`, `Instant`)는 불변으로 설계되어 있어 방어적 복사 없이도 안전하게 반환할 수 있다.

## 캡슐화와 상속

상속은 캡슐화를 약화시킬 수 있다. 서브클래스가 `protected` 멤버를 통해 부모 클래스의 내부 상태에 접근하거나 수정할 수 있기 때문이다.

```java
public class Counter {
    private int count;

    public void increment() { count++; }
    public int getCount()   { return count; }
}

// 상속으로 캡슐화 우회 시도 — 하지만 private이므로 불가
class EvilCounter extends Counter {
    public void reset() {
        // count = 0;  // 컴파일 에러 — private 접근 불가
    }
}
```

`private` 필드는 상속으로도 접근할 수 없으므로 캡슐화가 유지된다. 반면 `protected` 필드를 노출하면 서브클래스가 우회 경로를 통해 불변식을 파괴할 수 있다. **필드는 기본적으로 `private`으로 유지하고, 상속보다 컴포지션(Composition)을 선호하라**는 원칙의 배경이기도 하다.

## 캡슐화 설계 체크리스트

캡슐화를 올바르게 적용했는지 확인하는 기준이다.

```text
1. 모든 필드가 private인가?
   → 예외는 불변 record 정도

2. 공개 메서드가 호출 전에 인자를 검증하는가?
   → null, 범위, 일관성 조건 확인

3. 컬렉션/배열/가변 객체를 반환할 때 unmodifiable 또는 복사본인가?
   → 내부 컬렉션을 그대로 반환하지 않는가

4. 생성자에서 불변식 초기값을 검증하는가?
   → 생성된 객체는 항상 유효한 상태여야 한다

5. 내부 구현 변경이 공개 인터페이스를 바꾸지 않는가?
   → 필드 타입 변경, 내부 자료구조 교체가 외부에 영향을 주면 캡슐화 실패
```

## 정리

캡슐화는 `private`을 붙이는 문법적 행위가 아니라, **객체의 불변식을 보호하고 구현과 인터페이스를 분리하는 설계 철학**이다. 모든 필드를 `private`으로 숨기고, 상태 변경은 반드시 유효성 검사를 통과한 메서드를 통해서만 일어나게 하면, 객체는 생애 전체에 걸쳐 유효한 상태를 유지한다. 내부 구현을 자유롭게 바꿀 수 있는 유연한 설계가 따라온다.

---

**지난 글:** [Java 접근 제어자 완전 정복 — public, protected, default, private](/posts/java-access-modifiers/)

**다음 글:** [Java getter와 setter 완전 정복 — 올바른 설계와 안티패턴](/posts/java-getter-setter/)

<br>
읽어주셔서 감사합니다. 😊
