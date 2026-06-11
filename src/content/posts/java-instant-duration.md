---
title: "Instant와 Duration — 기계의 시간과 시간의 양"
description: "에포크 기반 타임스탬프 Instant의 구조와 활용, 시간량을 표현하는 Duration과 Period의 차이, DST 경계에서 '하루'의 두 가지 의미, 실행 시간 측정 패턴까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 5
type: "knowledge"
category: "Java"
tags: ["Java", "java.time", "Instant", "Duration", "Period", "에포크", "타임스탬프"]
featured: false
draft: false
---

[지난 글](/posts/java-zoneddatetime/)에서 사람의 시간 쪽 끝판왕인 `ZonedDateTime`을 다뤘습니다. 이번 글은 반대편, **기계의 시간**을 담당하는 `Instant`와, 시간의 *양*을 표현하는 `Duration`·`Period`입니다. 서버 개발에서 가장 많이 저장되고 비교되는 타입이 `Instant`이고, "이틀 뒤", "30분 타임아웃" 같은 개념을 코드로 옮길 때 필요한 것이 `Duration`과 `Period`입니다.

## Instant — UTC 타임라인 위의 한 점

`Instant`는 1970-01-01T00:00:00Z(에포크)부터 흐른 시간만으로 한 순간을 표현합니다. 내부는 단 두 필드입니다.

- `long epochSecond`: 에포크부터의 초
- `int nano`: 그 초 안에서의 나노초

연·월·일·시 같은 달력 개념이 전혀 없고, 타임존 개념도 없습니다(항상 UTC). 그래서 어느 서버에서 만들어도, 어느 타임존의 사용자가 만들어도 **같은 순간이면 같은 값**입니다. 이벤트 발생 시각의 기록과 비교에 가장 적합한 이유입니다.

![Instant는 UTC 타임라인 위의 한 점](/assets/posts/java-instant-duration-timeline.svg)

```java
// 생성
Instant now = Instant.now();                       // 항상 UTC 기준
Instant t1 = Instant.ofEpochSecond(1_781_242_200L);
Instant t2 = Instant.ofEpochMilli(System.currentTimeMillis());
Instant t3 = Instant.parse("2026-06-12T05:30:00Z"); // 끝의 Z 필수

// 레거시와의 변환
Date legacy = Date.from(now);
Instant back = legacy.toInstant();

// 에포크 값으로
long ms = now.toEpochMilli();
```

`Instant.now()`는 타임존 설정과 무관하게 항상 같은 순간을 반환합니다. JVM이 서울에 있든 뉴욕에 있든 결과가 같으므로, `LocalDateTime.now()`와 달리 컨테이너 타임존 설정 사고에서 자유롭습니다.

표시할 때만 타임존을 입힙니다.

```java
ZonedDateTime forUser = now.atZone(ZoneId.of("Asia/Seoul"));
```

한 가지 주의: `Instant`에는 달력 개념이 없으므로 `plusDays` 같은 일부 메서드는 있지만(86400초 고정) `plusMonths`는 없습니다. "한 달 뒤"는 달력이 필요한 연산이라 `atZone`으로 사람의 시간으로 올린 뒤 계산해야 합니다.

## Duration — 시간 기반의 양

`Duration`은 초·나노초로 저장되는 **물리적 시간 길이**입니다.

```java
Duration d1 = Duration.ofHours(2);          // PT2H
Duration d2 = Duration.ofMinutes(150);      // PT2H30M
Duration d3 = Duration.parse("PT2H30M");    // ISO-8601 표기

// 두 순간 사이의 간격
Instant start = Instant.now();
// ... 작업 ...
Instant end = Instant.now();
Duration elapsed = Duration.between(start, end);

elapsed.toMillis();    // 밀리초로
elapsed.toSeconds();   // 초로
elapsed.toMinutes();   // 분으로 (절삭)

// Java 9+: 사람이 읽기 좋은 분해
elapsed.toHoursPart();   // 시 부분만
elapsed.toMinutesPart(); // 분 부분만
elapsed.toSecondsPart(); // 초 부분만
```

타임아웃, 캐시 TTL, 폴링 주기 같은 설정값에 `long timeoutMillis` 대신 `Duration`을 쓰면 단위 실수가 사라집니다. Spring을 비롯한 주요 프레임워크 설정 API들이 `Duration`을 받는 것도 같은 이유입니다.

실행 시간 측정의 관용구도 `Instant` + `Duration` 조합입니다. 다만 정밀 벤치마크라면 시계 보정의 영향을 받지 않는 `System.nanoTime()`이 더 적합하다는 것도 알아두세요.

## Period — 날짜 기반의 양

`Period`는 년·월·일로 저장되는 **달력상의 기간**입니다.

```java
Period p1 = Period.ofMonths(3);            // P3M
Period p2 = Period.of(1, 2, 3);            // P1Y2M3D

// 두 날짜 사이 — 나이 계산의 정석
LocalDate birth = LocalDate.of(1995, 3, 14);
LocalDate today = LocalDate.of(2026, 6, 12);

Period age = Period.between(birth, today);
// P31Y2M29D → 31세 2개월 29일
age.getYears();  // 31

// 총 일수가 필요하면 Period가 아니라 ChronoUnit
long totalDays = ChronoUnit.DAYS.between(birth, today);
```

`Period.between`은 "31년 2개월 29일"처럼 **사람이 말하는 방식**으로 분해해 주고, `ChronoUnit.DAYS.between`은 총 일수를 반환합니다. 용도가 다르니 혼동하지 마세요. `getDays()`는 일 *부분*만 반환하지, 총 일수가 아닙니다.

## 같은 "하루"의 두 가지 의미

`Duration.ofDays(1)`과 `Period.ofDays(1)`은 보통 같은 결과를 내지만, **DST 경계를 넘는 `ZonedDateTime` 연산에서 갈라집니다.**

```java
ZoneId ny = ZoneId.of("America/New_York");
ZonedDateTime beforeDst = ZonedDateTime.of(
    2026, 3, 7, 14, 0, 0, 0, ny); // DST 시작 전날 오후 2시

beforeDst.plus(Duration.ofDays(1));
// 2026-03-08T15:00-04:00 — 정확히 24시간 뒤, 벽시계는 15시

beforeDst.plus(Period.ofDays(1));
// 2026-03-08T14:00-04:00 — 다음 날 "같은 시각", 실제로는 23시간 뒤
```

"매일 오후 2시에 알림"이라면 `Period`(벽시계 유지)가 맞고, "결제 후 정확히 24시간 내 취소 가능"이라면 `Duration`(물리적 시간)이 맞습니다. 요구사항이 어느 쪽 하루인지부터 확인하는 습관이 필요합니다.

![Duration vs Period 비교](/assets/posts/java-instant-duration-vs-period.svg)

## 어디에 무엇을 쓸까

- **DB 저장·이벤트 기록**: `Instant` (UTC 고정, 타임존 사고 원천 차단)
- **타임아웃·TTL·측정 간격**: `Duration`
- **나이·구독 기간·"3개월 뒤" 같은 달력 개념**: `Period`
- **사용자 표시**: `Instant`를 읽어와 `atZone`으로 변환

```java
// 전형적인 흐름: 저장은 Instant, 표시는 ZonedDateTime
Instant orderedAt = Instant.now();            // 저장
ZonedDateTime display = orderedAt
    .atZone(ZoneId.of("Asia/Seoul"));         // 표시
```

## 정리

- `Instant`는 에포크 기준 초+나노초만 가진 **기계의 시간** — 타임존 사고가 없는 저장·비교의 표준이다
- `Duration`은 초 기반의 물리적 길이, `Period`는 년·월·일 기반의 달력 기간이다
- DST 경계에서 `Duration.ofDays(1)`(24시간)과 `Period.ofDays(1)`(벽시계 하루)은 다른 결과를 낸다
- 나이 계산은 `Period.between`, 총 일수는 `ChronoUnit.DAYS.between`
- 설정값·API 시그니처에 `long` 대신 `Duration`을 쓰면 단위 버그가 사라진다

다음 글에서는 날짜·시간을 원하는 형식의 문자열로 바꾸고 파싱하는 `DateTimeFormatter`를 다룹니다.

---

**지난 글:** [ZonedDateTime — 타임존을 품은 날짜와 시간](/posts/java-zoneddatetime/)

**다음 글:** [DateTimeFormatter — 날짜·시간 포맷팅과 파싱](/posts/java-datetimeformatter/)

<br>
읽어주셔서 감사합니다. 😊
