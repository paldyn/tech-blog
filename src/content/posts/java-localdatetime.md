---
title: "LocalDateTime — 날짜와 시각의 결합"
description: "LocalDateTime의 생성과 분해, 연산 API를 정리하고, 타임존이 없는 LocalDateTime이 타임라인 위의 한 점이 아니라는 핵심 개념과 실무에서 써도 되는 경우·안 되는 경우를 구분합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 3
type: "knowledge"
category: "Java"
tags: ["Java", "java.time", "LocalDateTime", "타임존", "날짜시간 API"]
featured: false
draft: false
---

[지난 글](/posts/java-localdate-localtime/)에서 `LocalDate`와 `LocalTime`을 익혔습니다. 이번 글의 주인공 `LocalDateTime`은 이름 그대로 두 타입을 합친 것으로, "2026년 6월 12일 14시 30분"처럼 **날짜와 시각을 함께** 표현합니다. API는 두 부모 타입의 메서드를 거의 그대로 합쳐 놓아 새로 외울 것이 적지만, 대신 이 글에서는 많은 개발자가 놓치는 핵심 — `LocalDateTime`에는 타임존이 없으며 따라서 **타임라인 위의 한 점이 아니다** — 를 비중 있게 다룹니다.

## 생성과 분해

`LocalDateTime`은 결합과 분해가 모두 자유롭습니다.

```java
// 직접 생성
LocalDateTime dt1 = LocalDateTime.of(2026, 6, 12, 14, 30);
LocalDateTime dt2 = LocalDateTime.of(2026, 6, 12, 14, 30, 15);
LocalDateTime dt3 = LocalDateTime.parse("2026-06-12T14:30:00");
LocalDateTime now = LocalDateTime.now();

// LocalDate + LocalTime 결합
LocalDate date = LocalDate.of(2026, 6, 12);
LocalTime time = LocalTime.of(14, 30);
LocalDateTime dt4 = LocalDateTime.of(date, time);
LocalDateTime dt5 = date.atTime(time);
LocalDateTime dt6 = time.atDate(date);

// 다시 분해
LocalDate datePart = dt4.toLocalDate(); // 2026-06-12
LocalTime timePart = dt4.toLocalTime(); // 14:30
```

ISO-8601 문자열 표기에서 날짜와 시각 사이에 `T`가 들어간다는 점(`2026-06-12T14:30:00`)도 기억해 두세요. `parse`가 받아들이는 기본 형식이자 `toString()`의 출력 형식입니다.

![LocalDateTime의 결합과 분해](/assets/posts/java-localdatetime-composition.svg)

## 연산 API — 부모 타입의 합집합

연산 메서드는 `LocalDate`와 `LocalTime`의 합집합입니다. 날짜 단위와 시간 단위를 모두 다룰 수 있습니다.

```java
LocalDateTime dt = LocalDateTime.of(2026, 6, 12, 14, 30);

// 날짜 단위 연산
dt.plusDays(1);      // 2026-06-13T14:30
dt.plusMonths(3);    // 2026-09-12T14:30

// 시간 단위 연산
dt.plusHours(10);    // 2026-06-13T00:30 (날짜가 자동 이월!)
dt.minusMinutes(45); // 2026-06-12T13:45

// 필드 교체
dt.withHour(0).withMinute(0); // 2026-06-12T00:00

// 비교
dt.isBefore(LocalDateTime.now());
dt.isAfter(dt.minusDays(1)); // true
```

주목할 점은 **자동 이월**입니다. `14:30`에 10시간을 더하면 다음 날 `00:30`이 되는데, 날짜 부분이 함께 넘어갑니다. `LocalTime`만 단독으로 쓸 때는 자정을 넘으면 그냥 한 바퀴 돌지만(`23:00.plusHours(2)` → `01:00`, 날짜 개념 없음), `LocalDateTime`은 날짜까지 정확하게 이월시킵니다. 시각만 다루다가 날짜 경계를 넘는 로직이 생기면 `LocalDateTime`으로 올려야 하는 이유입니다.

날짜·시각을 한 번에 절삭하는 `truncatedTo`도 자주 씁니다.

```java
LocalDateTime dt = LocalDateTime.of(2026, 6, 12, 14, 37, 42);

dt.truncatedTo(ChronoUnit.HOURS);   // 2026-06-12T14:00
dt.truncatedTo(ChronoUnit.MINUTES); // 2026-06-12T14:37
```

## 핵심 개념 — 타임라인 위의 한 점이 아니다

여기서부터가 이 글의 본론입니다. `LocalDateTime`은 "2026-06-12 14:30"이라는 **달력·시계상의 표기**일 뿐, 그것이 실제 우주의 어느 순간인지는 정해져 있지 않습니다. 같은 `2026-06-12T14:30`이라도 서울 기준이면 UTC `05:30`, 뉴욕 기준이면 UTC `18:30`으로, 해석하는 타임존에 따라 **13시간이나 차이 나는 다른 순간**을 가리킵니다.

![LocalDateTime은 타임라인 위의 한 점이 아니다](/assets/posts/java-localdatetime-ambiguity.svg)

그래서 `LocalDateTime`에는 `toInstant()`가 없습니다. 정확히는 **오프셋을 인자로 요구합니다.**

```java
LocalDateTime dt = LocalDateTime.of(2026, 6, 12, 14, 30);

// 타임존을 줘야 비로소 타임라인의 한 점이 된다
ZonedDateTime seoul = dt.atZone(ZoneId.of("Asia/Seoul"));
Instant instant = dt.toInstant(ZoneOffset.of("+09:00"));

// 두 결과 모두 UTC 2026-06-12T05:30:00Z를 가리킨다
```

이 성질 때문에 `LocalDateTime`끼리의 `isBefore` 비교는 **같은 타임존의 값끼리만** 의미가 있습니다. 서울에서 만든 값과 뉴욕에서 만든 값을 비교하면 컴파일은 되지만 결과는 무의미합니다.

## 그래서 언제 써야 하나

`LocalDateTime`이 적합한 경우는 분명히 있습니다.

- **타임존이 문맥상 자명한 국내 서비스**: 모든 사용자와 서버가 KST 단일 타임존이라면 가장 단순한 선택입니다
- **"벽시계 시각" 자체가 의미인 경우**: "매장은 매일 10:00에 연다" 같은 규칙은 특정 순간이 아니라 현지 시각의 표기가 본질입니다
- **미래의 약속 시간**: "2027년 3월 첫 회의는 현지 시각 오전 10시"처럼, 그 사이 타임존 규칙(DST 정책 등)이 바뀌어도 벽시계 기준을 유지해야 하는 값은 `Instant`로 미리 환산해 저장하면 오히려 틀어집니다

반대로 피해야 하는 경우입니다.

- **이벤트 발생 시각 기록**(로그, 주문 시각, 결제 시각): 과거에 실제로 일어난 순간은 `Instant`로
- **타임존이 다른 사용자 간 비교·정렬**: `ZonedDateTime` 또는 `Instant`로
- **서버 타임존에 암묵적으로 의존하는 코드**: `LocalDateTime.now()`는 JVM 기본 타임존을 따르므로, 컨테이너 환경에서 타임존 설정이 다르면 값이 달라집니다

```java
// 안티패턴 — 서버 타임존에 따라 결과가 달라진다
LocalDateTime createdAt = LocalDateTime.now();

// 권장 — 발생 시각은 Instant로 기록
Instant createdAt2 = Instant.now();
```

## 정리

- `LocalDateTime`은 `LocalDate` + `LocalTime`의 결합으로, 결합(`atTime`/`atDate`)과 분해(`toLocalDate`/`toLocalTime`)가 자유롭다
- 시간 연산 시 날짜 경계를 넘으면 날짜가 자동 이월된다
- **타임존이 없으므로 타임라인 위의 한 점이 아니다** — 순간으로 확정하려면 `atZone(ZoneId)`이나 `toInstant(ZoneOffset)`이 필요하다
- 벽시계 시각이 본질인 값(영업시간, 미래 약속)에는 적합하지만, 실제 발생 시각 기록에는 `Instant`를 써야 한다

다음 글에서는 타임존을 품은 `ZonedDateTime`을 다룹니다.

---

**지난 글:** [LocalDate와 LocalTime — 날짜와 시각 다루기](/posts/java-localdate-localtime/)

**다음 글:** [ZonedDateTime — 타임존을 품은 날짜와 시간](/posts/java-zoneddatetime/)

<br>
읽어주셔서 감사합니다. 😊
