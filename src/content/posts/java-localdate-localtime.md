---
title: "LocalDate와 LocalTime — 날짜와 시각 다루기"
description: "java.time의 가장 기본 타입인 LocalDate와 LocalTime의 생성, 조회, 연산, 비교 메서드를 실무 예제와 함께 정리하고, 불변 객체 연산에서 주의할 점을 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "java.time", "LocalDate", "LocalTime", "불변 객체", "날짜 연산"]
featured: false
draft: false
---

[지난 글](/posts/java-date-time-overview/)에서 `java.time`의 전체 지도를 그렸습니다. 이번 글은 그 지도에서 가장 많이 쓰이는 두 타입, **`LocalDate`**(날짜)와 **`LocalTime`**(시각)을 깊이 들어갑니다. 두 클래스는 타임존 개념이 전혀 없는 "로컬" 값이라는 공통점이 있고, API 패턴도 거의 동일해서 한쪽을 익히면 다른 쪽은 자연스럽게 따라옵니다.

## 두 클래스가 표현하는 것

`LocalDate`는 **달력 위의 날짜**만 표현합니다. 연·월·일 세 필드가 전부이고, 시각도 타임존도 없습니다. 생일, 입사일, 공휴일처럼 "몇 시인지"가 무의미한 값에 적합합니다.

`LocalTime`은 반대로 **시계 위의 시각**만 표현합니다. 시·분·초·나노초로 구성되며, 자정(`00:00`)부터 `23:59:59.999999999`까지 나노초 정밀도를 갖습니다. 매장 오픈 시각, 알람 시각처럼 "어느 날짜인지"가 무의미한 값에 씁니다.

![LocalDate와 LocalTime의 구성](/assets/posts/java-localdate-localtime-anatomy.svg)

## 생성 — of, parse, now

생성 경로는 세 가지입니다.

```java
// 1) of — 값을 직접 지정
LocalDate d1 = LocalDate.of(2026, 6, 12);
LocalDate d2 = LocalDate.of(2026, Month.JUNE, 12); // enum도 가능
LocalTime t1 = LocalTime.of(14, 30);        // 14:30
LocalTime t2 = LocalTime.of(14, 30, 15);    // 14:30:15

// 2) parse — ISO-8601 문자열에서
LocalDate d3 = LocalDate.parse("2026-06-12");
LocalTime t3 = LocalTime.parse("14:30:15");

// 3) now — 현재 시각에서
LocalDate today = LocalDate.now();
LocalTime nowTime = LocalTime.now();
```

몇 가지 주의점이 있습니다.

- `of`에 유효하지 않은 값(예: 2월 30일)을 넣으면 즉시 `DateTimeException`이 발생합니다. `Calendar`처럼 조용히 3월 2일로 넘어가는 일이 없습니다.
- `parse`는 기본적으로 ISO-8601 형식만 받습니다. `"2026/06/12"` 같은 형식은 `DateTimeFormatter`를 함께 넘겨야 합니다(별도 글에서 다룹니다).
- `now()`는 시스템 시계와 기본 타임존을 사용합니다. 비즈니스 로직에서는 `now(Clock)` 오버로드로 `Clock`을 주입받아야 테스트가 가능해집니다.

유용한 상수도 준비되어 있습니다.

```java
LocalTime.MIDNIGHT;  // 00:00
LocalTime.NOON;      // 12:00
LocalTime.MIN;       // 00:00
LocalTime.MAX;       // 23:59:59.999999999
LocalDate.EPOCH;     // 1970-01-01
```

## 조회 — get 계열

```java
LocalDate date = LocalDate.of(2026, 6, 12);

date.getYear();        // 2026
date.getMonth();       // Month.JUNE (enum)
date.getMonthValue();  // 6 (1부터 시작!)
date.getDayOfMonth();  // 12
date.getDayOfWeek();   // DayOfWeek.FRIDAY (enum)
date.getDayOfYear();   // 163
date.lengthOfMonth();  // 30
date.isLeapYear();     // true (2026은 평년이므로 false)
```

`getMonthValue()`가 **1부터 시작**한다는 점이 레거시 `Calendar`와의 결정적 차이입니다. 요일과 월이 int 상수가 아니라 `DayOfWeek`, `Month` enum으로 반환되므로 switch 문과 결합해도 타입 안전합니다.

## 연산 — plus, minus, with

연산 메서드는 이름 규칙이 일관됩니다. `plusXxx`/`minusXxx`는 더하고 빼기, `withXxx`는 특정 필드 교체입니다.

```java
LocalDate date = LocalDate.of(2026, 6, 12);

date.plusDays(7);        // 2026-06-19
date.plusMonths(2);      // 2026-08-12
date.minusYears(1);      // 2025-06-12
date.withDayOfMonth(1);  // 2026-06-01 (일만 교체)
date.withMonth(12);      // 2026-12-12 (월만 교체)

// 메서드 체이닝 — "다다음 달 1일"
LocalDate target = date.plusMonths(2).withDayOfMonth(1);
// 2026-08-01
```

여기서 가장 중요한 사실: **모든 연산은 새 객체를 반환하고 원본은 절대 변하지 않습니다.**

![불변 객체의 연산 흐름](/assets/posts/java-localdate-localtime-immutable-ops.svg)

가장 흔한 실수가 반환값을 버리는 것입니다.

```java
LocalDate date = LocalDate.of(2026, 6, 12);

date.plusDays(1);   // 반환값 무시 — date는 그대로!
System.out.println(date); // 여전히 2026-06-12

date = date.plusDays(1);  // 올바른 사용
System.out.println(date); // 2026-06-13
```

월말 보정도 알아두면 좋습니다. 1월 31일에 `plusMonths(1)`을 하면 존재하지 않는 2월 31일 대신 **2월 28일(말일)로 보정**됩니다. 예외가 아니라 조용한 보정이므로, 말일 기준 정산 로직에서는 이 동작을 인지하고 있어야 합니다.

```java
LocalDate jan31 = LocalDate.of(2026, 1, 31);
jan31.plusMonths(1); // 2026-02-28 (2월 31일이 아님)
```

## 비교 — isBefore, isAfter, isEqual

```java
LocalDate deadline = LocalDate.of(2026, 6, 30);
LocalDate today = LocalDate.of(2026, 6, 12);

today.isBefore(deadline); // true
today.isAfter(deadline);  // false
today.isEqual(deadline);  // false

// 기간 내 포함 여부 (경계 포함)
boolean inRange = !today.isBefore(start) && !today.isAfter(end);
```

`LocalDate`와 `LocalTime` 모두 `Comparable`을 구현하므로 정렬과 `Collections.max` 등에 바로 쓸 수 있습니다. `equals` 대신 `isEqual`을 쓰면 의도가 더 분명히 드러납니다.

두 날짜 사이의 간격은 `until`이나 `ChronoUnit`으로 구합니다.

```java
long days = ChronoUnit.DAYS.between(today, deadline); // 18
long months = today.until(deadline, ChronoUnit.MONTHS); // 0
```

## 결합 — atTime과 atDate

날짜와 시각을 합쳐 `LocalDateTime`을 만들 때는 `atTime`/`atDate`를 씁니다.

```java
LocalDate date = LocalDate.of(2026, 6, 12);
LocalTime time = LocalTime.of(14, 30);

LocalDateTime dt1 = date.atTime(time);       // 2026-06-12T14:30
LocalDateTime dt2 = date.atTime(14, 30);     // 동일
LocalDateTime dt3 = time.atDate(date);       // 동일
LocalDateTime dt4 = date.atStartOfDay();     // 2026-06-12T00:00
```

`atStartOfDay()`는 "그 날의 시작"을 구할 때 관용적으로 쓰입니다. 날짜 범위 조회 쿼리의 경계값을 만들 때 특히 유용합니다.

## 정리

- `LocalDate`는 타임존 없는 날짜, `LocalTime`은 타임존 없는 시각 — 둘 다 불변이며 스레드 안전하다
- 생성은 `of`/`parse`/`now` 세 경로, 잘못된 값은 `DateTimeException`으로 즉시 실패한다
- `plus`/`minus`/`with` 연산은 **항상 새 객체를 반환** — 반환값을 변수에 받지 않으면 아무 일도 일어나지 않는다
- 월 연산 시 존재하지 않는 날짜는 말일로 조용히 보정된다
- `atTime`/`atDate`/`atStartOfDay`로 `LocalDateTime`으로 승격할 수 있다

다음 글에서는 두 타입의 결합체인 `LocalDateTime`을 다룹니다.

---

**지난 글:** [java.time 개요 — 모던 날짜·시간 API의 설계 철학](/posts/java-date-time-overview/)

**다음 글:** [LocalDateTime — 날짜와 시각의 결합](/posts/java-localdatetime/)

<br>
읽어주셔서 감사합니다. 😊
