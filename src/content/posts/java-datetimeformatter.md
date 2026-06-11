---
title: "DateTimeFormatter — 날짜·시간 포맷팅과 파싱"
description: "DateTimeFormatter의 내장 포맷터와 ofPattern 사용법, 패턴 문자 치트시트, 로케일 처리, YYYY·hh 같은 단골 패턴 버그, SimpleDateFormat 대비 스레드 안전성까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 6
type: "knowledge"
category: "Java"
tags: ["Java", "java.time", "DateTimeFormatter", "포맷팅", "파싱", "패턴 문자"]
featured: false
draft: false
---

[지난 글](/posts/java-instant-duration/)까지 java.time의 주요 타입을 모두 살펴봤습니다. 이번 글은 그 타입들을 문자열로 내보내고, 문자열에서 다시 읽어 들이는 **`DateTimeFormatter`**입니다. 화면 표시, 로그 출력, API 응답, 파일명 생성 — 날짜가 문자열과 만나는 모든 지점에서 쓰이는 도구이고, 동시에 `YYYY` 같은 한 글자 실수가 연말마다 장애를 일으키는 지점이기도 합니다.

## 양방향 변환의 중심

`DateTimeFormatter`는 객체→문자열(`format`)과 문자열→객체(`parse`) 양쪽을 모두 담당합니다.

![format과 parse 양방향 변환](/assets/posts/java-datetimeformatter-flow.svg)

```java
DateTimeFormatter fmt =
    DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

LocalDateTime dt = LocalDateTime.of(2026, 6, 12, 14, 30);

// 객체 → 문자열
String s1 = dt.format(fmt);            // "2026-06-12 14:30"
String s2 = fmt.format(dt);            // 동일 (방향만 다른 표현)

// 문자열 → 객체
LocalDateTime parsed =
    LocalDateTime.parse("2026-06-12 14:30", fmt);
```

`SimpleDateFormat`과의 결정적 차이는 **불변·스레드 안전**이라는 점입니다. static final 상수로 만들어 애플리케이션 전체에서 공유해도 안전하며, 오히려 그렇게 쓰는 것이 권장 패턴입니다.

```java
public final class Formats {
    public static final DateTimeFormatter KOREAN_DATE =
        DateTimeFormatter.ofPattern("yyyy년 M월 d일");

    public static final DateTimeFormatter LOG_TIMESTAMP =
        DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.SSS");
}
```

## 내장 포맷터부터 확인

패턴을 직접 만들기 전에, ISO-8601 계열은 이미 상수로 준비되어 있습니다.

```java
DateTimeFormatter.ISO_LOCAL_DATE;      // 2026-06-12
DateTimeFormatter.ISO_LOCAL_DATE_TIME; // 2026-06-12T14:30:00
DateTimeFormatter.ISO_INSTANT;         // 2026-06-12T05:30:00Z
DateTimeFormatter.ISO_OFFSET_DATE_TIME;// 2026-06-12T14:30+09:00
```

각 타입의 `toString()`과 인자 없는 `parse()`가 바로 이 ISO 포맷터들을 사용합니다. **시스템 간 데이터 교환은 ISO-8601이 표준**이므로, API 응답이나 로그라면 커스텀 패턴보다 내장 포맷터를 먼저 고려하세요. 커스텀 패턴은 "사람에게 보여주는 문자열"을 만들 때 쓰는 것이 원칙입니다.

## 패턴 문자 치트시트

`ofPattern`에 쓰는 패턴 문자 중 실무 빈도가 높은 것들입니다.

![자주 쓰는 패턴 문자](/assets/posts/java-datetimeformatter-patterns.svg)

```java
LocalDateTime dt = LocalDateTime.of(2026, 6, 12, 14, 30, 15);

// 자주 쓰는 조합들
DateTimeFormatter.ofPattern("yyyy-MM-dd").format(dt);
// "2026-06-12"

DateTimeFormatter.ofPattern("yyyy년 M월 d일 (E)")
    .withLocale(Locale.KOREAN).format(dt);
// "2026년 6월 12일 (금)"

DateTimeFormatter.ofPattern("a h:mm")
    .withLocale(Locale.KOREAN).format(dt);
// "오후 2:30"
```

`M`과 `MM`의 차이처럼 글자 반복 횟수는 자릿수를 의미합니다. `M`은 `6`, `MM`은 `06`. 요일(`E`)이나 월 이름(`MMMM`) 같은 텍스트 요소는 로케일을 따르므로, 한국어 출력이 필요하면 `withLocale(Locale.KOREAN)`을 명시해야 합니다. 서버 기본 로케일에 의존하면 배포 환경에 따라 출력이 달라집니다.

## 단골 패턴 버그 3종

대소문자가 다르면 전혀 다른 의미가 됩니다. 컴파일 에러가 나지 않고 평소엔 정상 동작하다가 특정 시점에만 틀리는, 가장 악질적인 부류의 버그입니다.

### YYYY — 연말마다 터지는 버그

`YYYY`는 연도가 아니라 **week-based year**(주 기준 연도)입니다. 12월 마지막 주나 1월 첫 주가 다음 해/전 해의 주에 속하면 연도가 어긋납니다.

```java
LocalDate dec28 = LocalDate.of(2026, 12, 28); // 월요일

DateTimeFormatter.ofPattern("yyyy-MM-dd").format(dec28);
// "2026-12-28" — 정상

DateTimeFormatter.ofPattern("YYYY-MM-dd").format(dec28);
// "2027-12-28" — 그 주가 2027년의 1주차라서!
```

연도는 항상 `yyyy`(또는 엄밀하게는 `uuuu`)입니다. 매년 12월 말이면 이 버그로 인한 장애 보고가 올라올 정도로 흔하니, 코드 리뷰에서 `YYYY`를 보면 무조건 의심하세요.

### hh — 오후가 사라지는 버그

`hh`는 12시간제(01~12)입니다. 오전/오후 표시(`a`) 없이 단독으로 쓰면 14시 30분이 `02:30`으로 출력되어 12시간이 증발합니다. 24시간제는 `HH`입니다.

### DD — 날짜가 아니라 연중 일수

`DD`는 day-of-year(연중 며칠째)입니다. 6월 12일을 `DD`로 출력하면 `163`이 나옵니다. 날짜의 일은 `dd`입니다.

## 파싱 실패와 엄격함 제어

`parse`는 형식이 맞지 않으면 `DateTimeParseException`(unchecked)을 던집니다. 사용자 입력을 파싱한다면 명시적으로 처리하세요.

```java
public static Optional<LocalDate> tryParse(String input) {
    try {
        return Optional.of(LocalDate.parse(input,
            DateTimeFormatter.ofPattern("yyyy-MM-dd")));
    } catch (DateTimeParseException e) {
        return Optional.empty();
    }
}
```

기본 파싱 모드(`ResolverStyle.SMART`)는 2월 31일을 2월 28일로 보정해서 받아들입니다. 입력 검증이 목적이라면 `STRICT` 모드로 바꾸는 것이 안전합니다. 단, STRICT 모드에서 연도는 `yyyy` 대신 `uuuu`를 써야 시대(era) 모호성 문제를 피할 수 있습니다.

```java
DateTimeFormatter strict =
    DateTimeFormatter.ofPattern("uuuu-MM-dd")
        .withResolverStyle(ResolverStyle.STRICT);

LocalDate.parse("2026-02-31", strict);
// DateTimeParseException — 보정 없이 거부
```

## 정리

- `DateTimeFormatter`는 불변·스레드 안전 — `SimpleDateFormat`과 달리 static final 공유가 권장 패턴이다
- 시스템 간 교환은 내장 ISO 포맷터, 사람에게 보여줄 때만 `ofPattern`
- 연도는 `yyyy`(엄격 모드는 `uuuu`) — `YYYY`는 week-based year로 연말·연초에 어긋난다
- `HH`는 24시간제, `hh`는 12시간제(`a` 필수), `dd`는 일, `DD`는 연중 일수
- 텍스트 요소는 `withLocale` 명시, 사용자 입력 검증은 `ResolverStyle.STRICT`

다음 글에서는 "다음 금요일", "이번 달 마지막 날" 같은 상대 날짜 계산을 담당하는 `TemporalAdjusters`를 다룹니다.

---

**지난 글:** [Instant와 Duration — 기계의 시간과 시간의 양](/posts/java-instant-duration/)

**다음 글:** [TemporalAdjusters — 상대 날짜 계산의 도구상자](/posts/java-temporal-adjusters/)

<br>
읽어주셔서 감사합니다. 😊
