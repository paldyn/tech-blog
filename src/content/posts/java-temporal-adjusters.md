---
title: "TemporalAdjusters — 상대 날짜 계산의 도구상자"
description: "이번 달 마지막 날, 다음 금요일 같은 상대 날짜 계산을 담당하는 TemporalAdjuster의 동작 원리, 내장 adjuster 카탈로그, 람다 기반 커스텀 adjuster(다음 영업일 등) 작성법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 7
type: "knowledge"
category: "Java"
tags: ["Java", "java.time", "TemporalAdjusters", "TemporalAdjuster", "날짜 계산", "함수형 인터페이스"]
featured: false
draft: false
---

[지난 글](/posts/java-datetimeformatter/)에서 날짜를 문자열로 다루는 법을 정리했습니다. 이번 글은 날짜 *계산* 쪽의 마지막 퍼즐 조각입니다. `plusDays(7)` 같은 단순 증감으로는 표현하기 어려운 요구사항 — "이번 달 마지막 날", "다음 금요일", "둘째 주 일요일", "다음 영업일" — 을 처리하는 도구가 **`TemporalAdjuster`**입니다. 정산일 계산, 반복 일정, 마감일 산출처럼 실무 비중이 높은 영역이라 패턴을 익혀두면 바로 써먹을 수 있습니다.

## 동작 원리 — with()에 전략을 넘긴다

핵심은 `Temporal.with(TemporalAdjuster)` 한 줄입니다. 날짜 객체가 "나를 어떻게 보정할지"를 인자로 받은 adjuster에게 위임하는 구조입니다.

![with(adjuster)의 위임 구조](/assets/posts/java-temporal-adjusters-mechanism.svg)

`TemporalAdjuster`는 메서드가 하나뿐인 함수형 인터페이스입니다.

```java
@FunctionalInterface
public interface TemporalAdjuster {
    Temporal adjustInto(Temporal temporal);
}
```

`Temporal`을 받아 `Temporal`을 돌려주는 함수, 그 이상도 이하도 아닙니다. 그래서 내장 구현을 가져다 쓸 수도, 람다로 직접 만들 수도 있습니다. 전형적인 전략 패턴이 함수형 인터페이스로 표현된 사례죠. 물론 java.time의 다른 모든 연산과 마찬가지로 **원본은 변하지 않고 새 객체가 반환**됩니다.

```java
LocalDate date = LocalDate.of(2026, 6, 12);

LocalDate lastDay = date.with(
    TemporalAdjusters.lastDayOfMonth()); // 2026-06-30
```

## 내장 adjuster 카탈로그

`TemporalAdjusters` 유틸리티 클래스(끝에 s가 붙은 쪽)가 자주 쓰는 구현을 static 팩토리로 제공합니다. 기준 날짜 2026-06-12(금요일)에 대한 결과와 함께 보면 직관적입니다.

![내장 TemporalAdjusters 동작 예시](/assets/posts/java-temporal-adjusters-builtin.svg)

```java
import static java.time.temporal.TemporalAdjusters.*;
import static java.time.DayOfWeek.*;

LocalDate date = LocalDate.of(2026, 6, 12); // 금요일

date.with(firstDayOfMonth());       // 2026-06-01
date.with(lastDayOfMonth());        // 2026-06-30
date.with(firstDayOfNextMonth());   // 2026-07-01
date.with(firstDayOfYear());        // 2026-01-01

date.with(next(MONDAY));            // 2026-06-15
date.with(nextOrSame(FRIDAY));      // 2026-06-12 (그대로)
date.with(previous(MONDAY));        // 2026-06-08
date.with(lastInMonth(FRIDAY));     // 2026-06-26
date.with(dayOfWeekInMonth(2, SUNDAY)); // 2026-06-14
```

`next`와 `nextOrSame`의 차이에 주의하세요. 오늘이 금요일일 때 `next(FRIDAY)`는 **다음 주** 금요일(6/19)이고, `nextOrSame(FRIDAY)`는 오늘(6/12)입니다. "이번 주 금요일 마감" 로직에 `next`를 쓰면 오늘이 금요일인 날에만 일주일이 밀리는 미묘한 버그가 됩니다.

실무 활용 예를 몇 가지 더 보면:

```java
// 월말 정산일
LocalDate settlement = today.with(lastDayOfMonth());

// 매월 둘째 화요일 점검일
LocalDate maintenance = today
    .with(firstDayOfMonth())
    .with(dayOfWeekInMonth(2, TUESDAY));

// 급여일이 다음 달로 넘어갔는지 판단할 기준일
LocalDate nextMonth = today.with(firstDayOfNextMonth());
```

## 커스텀 adjuster — 람다 한 줄이면 된다

내장 구현에 없는 규칙은 람다로 만듭니다. 대표 사례가 **다음 영업일**(주말 건너뛰기)입니다.

```java
TemporalAdjuster nextBusinessDay = temporal -> {
    LocalDate date = LocalDate.from(temporal);
    LocalDate next = date.plusDays(1);

    return switch (next.getDayOfWeek()) {
        case SATURDAY -> next.plusDays(2);
        case SUNDAY -> next.plusDays(1);
        default -> next;
    };
};

LocalDate friday = LocalDate.of(2026, 6, 12);
friday.with(nextBusinessDay); // 2026-06-15 (월요일)
```

자주 쓰는 adjuster는 상수로 모아두면 도메인 어휘가 코드에 그대로 드러납니다.

```java
public final class BusinessDates {
    /** 매월 25일 급여일. 주말이면 직전 금요일로 당김 */
    public static final TemporalAdjuster PAYDAY = temporal -> {
        LocalDate d = LocalDate.from(temporal).withDayOfMonth(25);
        return switch (d.getDayOfWeek()) {
            case SATURDAY -> d.minusDays(1);
            case SUNDAY -> d.minusDays(2);
            default -> d;
        };
    };
}

LocalDate payday = today.with(BusinessDates.PAYDAY);
```

공휴일까지 고려해야 한다면 휴일 셋을 주입받는 형태로 확장합니다.

```java
public static TemporalAdjuster nextWorkday(Set<LocalDate> holidays) {
    return temporal -> {
        LocalDate d = LocalDate.from(temporal).plusDays(1);
        while (d.getDayOfWeek() == DayOfWeek.SATURDAY
            || d.getDayOfWeek() == DayOfWeek.SUNDAY
            || holidays.contains(d)) {
            d = d.plusDays(1);
        }
        return d;
    };
}
```

## TemporalQuery — 반대 방향의 짝꿍

`TemporalAdjuster`가 "날짜를 바꾸는" 함수라면, 같은 패키지의 `TemporalQuery<R>`는 "날짜에서 무언가를 **읽어내는**" 함수입니다.

```java
// 분기(Quarter)를 읽어내는 쿼리
TemporalQuery<Integer> quarter =
    t -> (t.get(ChronoField.MONTH_OF_YEAR) - 1) / 3 + 1;

LocalDate.of(2026, 6, 12).query(quarter); // 2
```

`with(adjuster)`는 같은 타입을 돌려주고 `query(query)`는 임의 타입 `R`을 돌려준다는 차이만 기억하면 됩니다. 두 인터페이스 모두 java.time이 함수형 설계를 적극 수용했음을 보여주는 부분입니다.

## 정리

- `TemporalAdjuster`는 `Temporal → Temporal` 함수형 인터페이스 — `date.with(adjuster)`로 위임 호출한다
- `TemporalAdjusters`(복수형)가 `lastDayOfMonth`, `next(요일)`, `dayOfWeekInMonth` 등 내장 구현을 제공한다
- `next`는 오늘을 제외, `nextOrSame`은 오늘을 포함 — 마감일 로직의 단골 함정이다
- 영업일·급여일 같은 도메인 규칙은 람다 커스텀 adjuster를 상수로 만들어 어휘화한다
- 값을 읽어내는 쪽 짝꿍으로 `TemporalQuery`가 있다

다음 글에서는 java.time 챕터를 마무리하며, 아직도 레거시 코드에 남아 있는 `Date`·`Calendar`의 함정들과 마이그레이션 전략을 다룹니다.

---

**지난 글:** [DateTimeFormatter — 날짜·시간 포맷팅과 파싱](/posts/java-datetimeformatter/)

**다음 글:** [레거시 Date·Calendar의 함정과 마이그레이션](/posts/java-old-date-pitfalls/)

<br>
읽어주셔서 감사합니다. 😊
