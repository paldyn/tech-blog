---
title: "java.time 개요 — 모던 날짜·시간 API의 설계 철학"
description: "java.util.Date와 Calendar의 고질적인 문제점부터 Java 8 java.time(JSR-310)의 설계 원칙, 핵심 클래스 구성과 선택 기준까지 모던 날짜·시간 API의 전체 그림을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "java.time", "JSR-310", "LocalDate", "Instant", "날짜시간 API"]
featured: false
draft: false
---

[지난 글](/posts/java-lts-migration-roadmap/)에서 Java LTS 버전 여정을 정리하며 버전 챕터를 마무리했습니다. 이번 글부터는 실무에서 매일 마주치는 **날짜·시간 API**를 다룹니다. Java 8에서 도입된 `java.time` 패키지(JSR-310)는 단순한 신규 API가 아니라, 15년 넘게 개발자를 괴롭힌 `java.util.Date`와 `Calendar`의 설계 결함을 처음부터 다시 설계한 결과물입니다. 이 글에서는 레거시 API가 왜 문제였는지, `java.time`이 어떤 철학으로 만들어졌는지, 그리고 어떤 클래스를 언제 선택해야 하는지 전체 지도를 그립니다.

## 레거시 API는 무엇이 문제였나

Java 1.0의 `java.util.Date`와 1.1의 `Calendar`는 오랫동안 표준이었지만, 설계 결함이 많아 버그의 단골 원인이었습니다.

### 가변(mutable) 객체

`Date`와 `Calendar`는 모두 가변 객체입니다. 어딘가에 전달한 날짜 객체가 호출된 쪽에서 변경될 수 있다는 뜻입니다.

```java
Date meetingDate = new Date();
scheduleMeeting(meetingDate);

// scheduleMeeting 내부에서 이렇게 하면...
// date.setTime(date.getTime() + 86400000L);
// 호출자의 meetingDate까지 하루 뒤로 바뀐다!
```

날짜를 필드로 갖는 클래스는 방어적 복사를 하지 않으면 캡슐화가 깨집니다. `Effective Java`가 방어적 복사 예제로 `Date`를 쓰는 이유가 바로 이것입니다.

### 월이 0부터 시작

`Calendar.set(2026, 5, 12)`는 2026년 6월 12일입니다. 월 인자가 0부터 시작하기 때문에(0 = 1월) 코드를 읽는 사람의 직관과 어긋나고, off-by-one 버그가 끊이지 않았습니다.

### SimpleDateFormat의 스레드 불안전

`SimpleDateFormat`은 내부에 가변 상태(`Calendar` 인스턴스)를 가지고 있어 **스레드 안전하지 않습니다**. 이를 모르고 static 필드로 공유하면 동시 요청 환경에서 파싱 결과가 뒤섞이는, 재현하기 매우 어려운 버그가 발생합니다.

```java
// 위험한 코드 — 멀티스레드에서 잘못된 결과 반환 가능
private static final SimpleDateFormat FMT =
    new SimpleDateFormat("yyyy-MM-dd");
```

### 개념의 혼재

`Date`는 이름과 달리 날짜가 아니라 **밀리초 타임스탬프**입니다. 타임존 정보도 없으면서 `toString()`은 JVM 기본 타임존으로 출력하니, "날짜만 필요한데 시간이 끼어 있고, 타임존이 없는데 있는 것처럼 보이는" 모호한 상태가 됩니다.

![레거시 날짜 API vs java.time 비교](/assets/posts/java-date-time-overview-legacy-vs-modern.svg)

## java.time의 설계 철학

JSR-310은 Joda-Time의 창시자 Stephen Colebourne이 주도해 설계했으며, 다음 원칙을 따릅니다.

### 1. 불변성 (Immutability)

모든 `java.time` 클래스는 불변입니다. `plusDays(1)`은 기존 객체를 바꾸지 않고 **새 객체를 반환**합니다.

```java
LocalDate today = LocalDate.of(2026, 6, 12);
LocalDate tomorrow = today.plusDays(1);

System.out.println(today);    // 2026-06-12 (변하지 않음)
System.out.println(tomorrow); // 2026-06-13
```

불변이므로 스레드 안전이 자동으로 보장되고, 방어적 복사도 필요 없습니다. 반환값을 받지 않으면 연산이 무의미해지므로, 흔한 실수인 `date.plusDays(1);`(반환값 버림)만 주의하면 됩니다.

### 2. 사람의 시간과 기계의 시간 분리

`java.time`은 시간을 두 관점으로 나눕니다.

- **사람의 시간(human time)**: 달력과 시계로 표현되는 시간. `LocalDate`, `LocalTime`, `LocalDateTime`, `ZonedDateTime`
- **기계의 시간(machine time)**: 1970-01-01T00:00:00Z(에포크)부터 흐른 시간. `Instant`

서버 로그의 타임스탬프나 이벤트 발생 시각은 `Instant`로, 사용자에게 보여줄 약속 시간은 `ZonedDateTime`으로 — 용도에 맞는 타입을 강제하는 것이 설계의 핵심입니다.

### 3. 명확한 도메인 분리

레거시 `Date` 하나가 떠안았던 역할을 목적별 클래스로 쪼갰습니다.

| 클래스 | 표현하는 것 | 예시 |
|---|---|---|
| `LocalDate` | 날짜만 | `2026-06-12` |
| `LocalTime` | 시각만 | `14:30:00` |
| `LocalDateTime` | 날짜 + 시각 (타임존 없음) | `2026-06-12T14:30` |
| `ZonedDateTime` | 날짜 + 시각 + 타임존 | `2026-06-12T14:30+09:00[Asia/Seoul]` |
| `Instant` | 에포크 기준 타임스탬프 | `2026-06-12T05:30:00Z` |
| `Duration` | 시간 기반 양 | `PT2H30M` (2시간 30분) |
| `Period` | 날짜 기반 양 | `P1Y2M` (1년 2개월) |

![java.time 핵심 클래스 맵](/assets/posts/java-date-time-overview-class-map.svg)

## 클래스 선택 기준

실무에서 어떤 타입을 쓸지 빠르게 판단하는 기준입니다.

```java
// 생일, 기념일, 휴일 — 시각이 무의미한 날짜
LocalDate birthday = LocalDate.of(1995, 3, 14);

// 매장 오픈 시각처럼 날짜가 무의미한 시각
LocalTime openTime = LocalTime.of(9, 0);

// 타임존이 자명한 국내 서비스의 일정
LocalDateTime reservation =
    LocalDateTime.of(2026, 6, 20, 18, 30);

// 글로벌 서비스의 회의 시간 — 타임존 필수
ZonedDateTime meeting = ZonedDateTime.of(
    reservation, ZoneId.of("Asia/Seoul"));

// DB 저장용 타임스탬프, 이벤트 발생 시각
Instant createdAt = Instant.now();
```

핵심 규칙은 두 가지입니다. 첫째, **저장·전송은 `Instant`(UTC), 표시할 때만 타임존 적용**. 둘째, 타임존이 조금이라도 개입할 여지가 있으면 `LocalDateTime` 대신 `ZonedDateTime`이나 `Instant`를 선택합니다.

## 보조 타입들

핵심 클래스 외에도 함께 쓰이는 타입이 있습니다.

- `Year`, `YearMonth`, `MonthDay`: 부분 날짜 표현. 신용카드 만료일(`YearMonth`)이 대표 용례
- `DayOfWeek`, `Month`: 요일·월을 표현하는 enum. `Calendar.MONDAY` 같은 int 상수의 타입 안전 대체물
- `ZoneId`, `ZoneOffset`: 타임존 식별자(`Asia/Seoul`)와 고정 오프셋(`+09:00`)
- `Clock`: 현재 시각의 공급원을 추상화. 테스트에서 시간을 고정할 때 필수

```java
// 테스트에서 시간 고정
Clock fixed = Clock.fixed(
    Instant.parse("2026-06-12T00:00:00Z"),
    ZoneId.of("Asia/Seoul"));

LocalDate today = LocalDate.now(fixed); // 항상 2026-06-12
```

`LocalDate.now()`처럼 인자 없는 `now()`를 비즈니스 로직에 직접 쓰면 테스트하기 어려워집니다. `Clock`을 주입받는 구조를 습관화하면 시간 의존 로직의 테스트가 쉬워집니다.

## 정리

- `java.util.Date`·`Calendar`는 가변성, 0-base 월, 스레드 불안전, 개념 혼재라는 구조적 결함이 있다
- `java.time`(JSR-310)은 **불변 객체**, **사람의 시간/기계의 시간 분리**, **목적별 타입**이라는 원칙으로 설계됐다
- 날짜만은 `LocalDate`, 타임스탬프는 `Instant`, 사용자 표시용은 `ZonedDateTime` — 용도에 맞는 타입 선택이 핵심이다
- `Clock` 주입으로 시간 의존 로직의 테스트 가능성을 확보한다

다음 글부터 각 클래스를 하나씩 깊이 들어갑니다. 먼저 가장 많이 쓰는 `LocalDate`와 `LocalTime`입니다.

---

**지난 글:** [Java LTS 마이그레이션 로드맵](/posts/java-lts-migration-roadmap/)

**다음 글:** [LocalDate와 LocalTime — 날짜와 시각 다루기](/posts/java-localdate-localtime/)

<br>
읽어주셔서 감사합니다. 😊
