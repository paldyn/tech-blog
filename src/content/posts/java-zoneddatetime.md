---
title: "ZonedDateTime — 타임존을 품은 날짜와 시간"
description: "ZonedDateTime의 구조(LocalDateTime + ZoneOffset + ZoneId)와 생성·변환 API, DST 경계의 Gap·Overlap 처리, OffsetDateTime과의 차이, 타임존 간 변환 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 4
type: "knowledge"
category: "Java"
tags: ["Java", "java.time", "ZonedDateTime", "ZoneId", "DST", "타임존"]
featured: false
draft: false
---

[지난 글](/posts/java-localdatetime/)에서 `LocalDateTime`이 타임라인 위의 한 점이 아니라는 것을 확인했습니다. 그 모호함을 해소하는 타입이 이번 글의 주제인 **`ZonedDateTime`**입니다. 타임존 정보를 품고 있어 지구상 어디에서 봐도 동일한 "그 순간"을 가리키면서, 동시에 현지 벽시계 표기도 유지합니다. 글로벌 서비스에서 사용자에게 시간을 보여주거나, 서로 다른 타임존의 시각을 변환할 때 중심이 되는 타입입니다.

## 세 부분으로 이루어진 구조

`ZonedDateTime`의 `toString()` 출력을 한 줄 해부해 보면 구조가 그대로 드러납니다.

```text
2026-06-12T14:30 +09:00 [Asia/Seoul]
└ LocalDateTime ┘ └오프셋┘ └─ ZoneId ─┘
```

- **`LocalDateTime` 부분** (`2026-06-12T14:30`): 현지 벽시계로 본 날짜·시각
- **`ZoneOffset`** (`+09:00`): 그 순간 UTC와의 시차
- **`ZoneId`** (`[Asia/Seoul]`): IANA tzdb의 타임존 규칙 식별자. DST를 포함한 역사적 규칙 전체를 참조

![ZonedDateTime 한 줄 해부](/assets/posts/java-zoneddatetime-structure.svg)

오프셋이 따로 있는데 왜 `ZoneId`까지 필요할까요? **오프셋은 순간마다 달라질 수 있기 때문**입니다. 뉴욕은 여름엔 `-04:00`, 겨울엔 `-05:00`입니다. `ZoneId`가 있어야 날짜 연산을 할 때 "그 날짜의 올바른 오프셋"을 자동으로 다시 계산할 수 있습니다.

## 생성과 변환

```java
ZoneId seoul = ZoneId.of("Asia/Seoul");

// 현재 시각
ZonedDateTime now = ZonedDateTime.now(seoul);

// LocalDateTime에 타임존 부여
LocalDateTime ldt = LocalDateTime.of(2026, 6, 12, 14, 30);
ZonedDateTime zdt = ldt.atZone(seoul);
// 2026-06-12T14:30+09:00[Asia/Seoul]

// Instant에 타임존 적용 (DB에서 읽은 타임스탬프 표시)
Instant instant = Instant.parse("2026-06-12T05:30:00Z");
ZonedDateTime fromInstant = instant.atZone(seoul);
// 2026-06-12T14:30+09:00[Asia/Seoul] — 같은 순간
```

`ZoneId.of()`에는 반드시 `"Asia/Seoul"` 같은 **지역 기반 ID**를 쓰세요. `"KST"` 같은 약어는 모호해서(인도의 IST, 이스라엘의 IST처럼 충돌 사례가 많습니다) java.time이 대부분 거부하거나 예상과 다르게 해석합니다.

### 타임존 간 변환 — 핵심 패턴

같은 순간을 다른 타임존의 벽시계로 보는 것이 `withZoneSameInstant`입니다.

```java
ZonedDateTime seoulTime = ZonedDateTime.of(
    2026, 6, 12, 14, 30, 0, 0, ZoneId.of("Asia/Seoul"));

// 서울 14:30 회의는 뉴욕에서 몇 시?
ZonedDateTime nyTime =
    seoulTime.withZoneSameInstant(ZoneId.of("America/New_York"));
// 2026-06-12T01:30-04:00[America/New_York]
```

비슷해 보이는 `withZoneSameLocal`은 **벽시계 표기를 유지한 채 타임존만 바꾸므로 다른 순간**이 됩니다. "서울 14:30 → 뉴욕 14:30"처럼요. 두 메서드를 혼동하면 13시간짜리 버그가 됩니다.

## DST 경계 — Gap과 Overlap

`ZonedDateTime`의 진가는 DST(일광 절약 시간) 경계 처리에서 드러납니다. DST가 있는 타임존에서는 1년에 두 번 특이한 사건이 일어납니다.

- **Gap (봄)**: 시계가 앞으로 점프해 특정 시간대가 **존재하지 않게** 됩니다. 뉴욕에서 2026-03-08 02:00은 곧바로 03:00이 되므로 02:30은 존재하지 않습니다.
- **Overlap (가을)**: 시계가 뒤로 돌아가 특정 시간대가 **두 번 존재**합니다. 2026-11-01에는 01:30이 `-04:00` 기준 한 번, `-05:00` 기준 한 번, 총 두 번 옵니다.

![DST 경계의 Gap과 Overlap](/assets/posts/java-zoneddatetime-dst.svg)

java.time의 처리 규칙은 명확합니다.

```java
ZoneId ny = ZoneId.of("America/New_York");

// Gap: 존재하지 않는 02:30 → 예외 없이 1시간 앞으로 보정
ZonedDateTime gap = LocalDateTime.of(2026, 3, 8, 2, 30).atZone(ny);
// 2026-03-08T03:30-04:00[America/New_York]

// Overlap: 두 번 존재하는 01:30 → 기본은 이른 쪽(-04:00)
ZonedDateTime overlap = LocalDateTime.of(2026, 11, 1, 1, 30).atZone(ny);
// 2026-11-01T01:30-04:00[America/New_York]

// 늦은 쪽을 원하면 명시적으로
ZonedDateTime later = overlap.withLaterOffsetAtOverlap();
// 2026-11-01T01:30-05:00[America/New_York]
```

예외가 발생하지 않고 **조용히 보정**된다는 점이 중요합니다. DST 타임존 사용자를 대상으로 한 스케줄링 기능이라면 이 동작을 테스트 케이스로 박아 두는 것이 좋습니다.

날짜 연산도 DST를 인식합니다. `plusDays(1)`은 "다음 날 같은 벽시계 시각"(DST 경계를 넘으면 실제로는 23시간 또는 25시간 뒤)이고, `plus(Duration.ofHours(24))`는 "정확히 24시간 뒤"입니다. 같은 하루라도 의미가 다릅니다.

## OffsetDateTime과의 선택

`OffsetDateTime`은 `ZoneId` 없이 고정 오프셋만 가진 타입입니다.

```java
OffsetDateTime odt = OffsetDateTime.of(
    2026, 6, 12, 14, 30, 0, 0, ZoneOffset.of("+09:00"));
```

- **`ZonedDateTime`**: DST 규칙을 알아야 하는 모든 곳 — 사용자 표시, 스케줄링, 타임존 변환
- **`OffsetDateTime`**: 규칙 해석이 필요 없는 단순한 값 — DB 컬럼(`TIMESTAMP WITH TIME ZONE`) 매핑, REST API의 ISO-8601 직렬화

저장·교환에는 단순한 `OffsetDateTime`(또는 `Instant`)이, 사람과 만나는 지점에는 `ZonedDateTime`이 적합하다고 기억하면 됩니다. JDBC 표준도 `OffsetDateTime` 매핑을 정의하고 있습니다.

## 정리

- `ZonedDateTime` = `LocalDateTime` + `ZoneOffset` + `ZoneId` — 순간과 벽시계 표기를 동시에 보유한다
- `ZoneId`는 `"Asia/Seoul"` 같은 지역 기반 ID만 사용한다 (약어 금지)
- 타임존 간 변환은 `withZoneSameInstant` — `withZoneSameLocal`과 혼동하지 않는다
- DST 경계에서 Gap은 앞으로 보정, Overlap은 이른 오프셋 기본 선택 — 모두 예외 없이 조용히 일어난다
- 저장·교환은 `Instant`/`OffsetDateTime`, 표시·스케줄링은 `ZonedDateTime`

다음 글에서는 기계의 시간 축을 담당하는 `Instant`와, 시간의 양을 표현하는 `Duration`·`Period`를 다룹니다.

---

**지난 글:** [LocalDateTime — 날짜와 시각의 결합](/posts/java-localdatetime/)

**다음 글:** [Instant와 Duration — 기계의 시간과 시간의 양](/posts/java-instant-duration/)

<br>
읽어주셔서 감사합니다. 😊
