---
title: "레거시 Date·Calendar의 함정과 마이그레이션"
description: "java.util.Date와 Calendar에 숨어 있는 0-base 월, 가변성, SimpleDateFormat 스레드 불안전, getYear() 오프셋 같은 함정을 정리하고, 레거시 코드를 java.time으로 점진 마이그레이션하는 전략을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 8
type: "knowledge"
category: "Java"
tags: ["Java", "java.util.Date", "Calendar", "SimpleDateFormat", "java.time", "마이그레이션", "레거시"]
featured: false
draft: false
---

[지난 글](/posts/java-temporal-adjusters/)까지 java.time의 주요 도구를 모두 살펴봤습니다. 날짜·시간 챕터의 마지막 글인 이번 편은 다시 과거로 갑니다. `java.time`이 나온 지 10년이 넘었지만, 오래된 코드베이스와 레거시 라이브러리 인터페이스에는 여전히 `Date`와 `Calendar`가 살아 있습니다. 이 글은 그 코드를 **유지보수하거나 마이그레이션해야 하는 사람**을 위해, 레거시 API의 함정을 구체적으로 정리하고 안전한 전환 전략을 다룹니다.

## 4대 함정 — 왜 버그가 끊이지 않았나

![레거시 날짜 API의 4대 함정](/assets/posts/java-old-date-pitfalls-traps.svg)

### ① 월은 0부터

```java
Calendar cal = Calendar.getInstance();
cal.set(2026, 6, 12); // 6월이 아니라 7월 12일!
cal.set(2026, Calendar.JUNE, 12); // 상수를 써야 안전
```

`Calendar`의 월은 0(1월)~11(12월)입니다. 숫자 리터럴을 쓴 코드는 의도보다 한 달 뒤를 가리키고, 이 버그는 테스트 데이터까지 같은 실수로 만들면 검출조차 되지 않습니다.

게다가 `set`은 유효 범위를 벗어난 값을 예외 없이 **이월**시킵니다. `cal.set(2026, 11, 32)`는 조용히 2027년 1월 1일이 됩니다(lenient 모드 기본). 잘못된 입력이 그대로 그럴듯한 날짜로 둔갑하는 것입니다.

### ② 가변 객체

```java
public class Order {
    private final Date createdAt;

    public Date getCreatedAt() {
        return createdAt; // 위험 — 내부 상태 유출
    }
}

// 호출부에서...
order.getCreatedAt().setTime(0); // Order의 생성일이 1970년으로!
```

`Date`는 가변이라 getter가 내부 참조를 그대로 돌려주면 외부에서 상태를 바꿀 수 있습니다. 올바른 레거시 코드는 `return new Date(createdAt.getTime())`처럼 방어적 복사를 해야 했고, 이를 빠뜨린 코드가 무수한 버그를 만들었습니다. `java.time` 타입은 불변이라 이 문제 자체가 존재하지 않습니다.

### ③ SimpleDateFormat의 스레드 불안전

```java
// 흔했던 위험 패턴
private static final SimpleDateFormat FMT =
    new SimpleDateFormat("yyyy-MM-dd");

// 두 스레드가 동시에 FMT.format()/parse() 호출 시
// 내부 Calendar 상태가 섞여 잘못된 결과 또는 예외
```

`SimpleDateFormat`은 내부에 가변 `Calendar`를 들고 있어 동시 호출 시 상태가 충돌합니다. 무서운 점은 예외가 아니라 **그럴듯한 잘못된 값**이 반환될 수 있다는 것입니다. 날짜가 뒤섞인 채 DB에 저장되고 한참 뒤에 발견되는 시나리오죠. 레거시를 유지해야 한다면 `ThreadLocal<SimpleDateFormat>`이 표준 우회책이었지만, 지금은 스레드 안전한 `DateTimeFormatter`로 바꾸는 것이 정답입니다.

### ④ 1900 오프셋과 타임존 착시

```java
Date date = new Date(); // 2026-06-12 기준

date.getYear();  // 126 (1900을 뺀 값)
date.getMonth(); // 5 (0부터 시작)
System.out.println(date);
// "Fri Jun 12 14:30:00 KST 2026" — KST는 어디서?
```

`getYear()`는 1900을 뺀 값을 반환합니다(그래서 진작에 deprecated). 더 미묘한 것은 `toString()`입니다. `Date`는 타임존 정보가 없는 밀리초 값인데, 출력할 때 **JVM 기본 타임존**으로 변환해 보여줍니다. 타임존이 있는 것처럼 보이는 착시 때문에 "Date에 KST가 저장되어 있다"는 오해가 퍼졌고, 서버 타임존이 다른 환경으로 배포되면 "날짜가 바뀌었다"는 장애 신고로 이어지곤 했습니다.

## 마이그레이션 대응표

레거시 타입과 java.time 타입의 대응 관계입니다.

![레거시에서 java.time으로의 대응표](/assets/posts/java-old-date-pitfalls-migration.svg)

핵심 원칙: `java.util.Date`는 이름과 달리 타임스탬프이므로 **대부분 `Instant`로 대응**됩니다. 날짜만 의미했다면 `LocalDate`로, 타임존 연산이 있었다면 `ZonedDateTime`으로 갑니다.

## 점진 마이그레이션 전략

전체 코드를 한 번에 바꾸는 것은 비현실적입니다. 권장 순서는 다음과 같습니다.

### 1. 경계에서 변환하고, 내부는 java.time으로

레거시 라이브러리가 `Date`를 요구하더라도 비즈니스 로직까지 `Date`를 끌고 다닐 필요는 없습니다. Java 8부터 양방향 브리지 메서드가 내장되어 있습니다.

```java
// 레거시 → 모던 (들어올 때 즉시 변환)
Date legacy = legacyApi.getDate();
Instant instant = legacy.toInstant();
LocalDate date = instant.atZone(ZoneId.systemDefault())
                        .toLocalDate();

// 모던 → 레거시 (나갈 때만 변환)
Date out = Date.from(instant);

// java.sql 계열은 더 직접적
LocalDate fromSql = sqlDate.toLocalDate();
java.sql.Timestamp ts = Timestamp.from(instant);
```

새로 작성하는 메서드 시그니처에는 절대 `Date`를 넣지 않는다는 규칙만 지켜도, 레거시 영역은 시간이 지나며 자연스럽게 고립됩니다.

### 2. SimpleDateFormat부터 제거

4대 함정 중 실제 장애 빈도가 가장 높은 것이 스레드 불안전이므로, `SimpleDateFormat` static 공유 코드를 최우선으로 교체합니다. 패턴 문자열은 대부분 그대로 호환됩니다(단, [지난 글](/posts/java-datetimeformatter/)에서 다룬 `YYYY`/`hh` 함정은 이참에 함께 점검).

### 3. 정적 분석으로 회귀 방지

수동 교체는 새 코드가 다시 레거시를 쓰면 무의미해집니다. Error Prone, SonarQube 등에 `java.util.Date`·`Calendar`·`SimpleDateFormat` 사용 금지 규칙을 걸어 CI에서 차단하세요. ArchUnit으로 패키지 수준 규칙을 정의하는 방법도 있습니다.

```java
// ArchUnit 예시 — 새 코드의 레거시 의존 차단
@ArchTest
static final ArchRule NO_LEGACY_DATE =
    noClasses().that().resideInAPackage("..domain..")
        .should().dependOnClassesThat()
        .haveFullyQualifiedName("java.util.Date");
```

### 4. DB 매핑 정리

JDBC 4.2+와 JPA 2.2+는 java.time을 직접 지원합니다. 엔티티의 `Date`/`Timestamp` 필드는 `LocalDate`/`Instant`(또는 `OffsetDateTime`)로 바꾸고, `TIMESTAMP WITH TIME ZONE` 컬럼 사용을 검토하세요. "DB는 UTC로 저장, 표시 계층에서 변환" 원칙을 세우면 마이그레이션 과정에서 타임존 정책도 함께 정리됩니다.

## 정리

- 레거시 4대 함정: 0-base 월(+조용한 이월), 가변성, `SimpleDateFormat` 스레드 불안전, 1900 오프셋과 `toString()` 타임존 착시
- `Date`는 사실상 타임스탬프 — 마이그레이션 시 대부분 `Instant`로 대응된다
- 한 번에 바꾸지 말고 **경계에서 변환**(`toInstant`/`Date.from`)하며 내부부터 java.time으로 통일한다
- 장애 빈도가 가장 높은 `SimpleDateFormat`부터 교체하고, 정적 분석으로 회귀를 차단한다

이것으로 날짜·시간 챕터를 마칩니다. 다음 글부터는 시리즈의 새 챕터, JVM 메모리와 가비지 컬렉션의 세계로 들어갑니다.

---

**지난 글:** [TemporalAdjusters — 상대 날짜 계산의 도구상자](/posts/java-temporal-adjusters/)

**다음 글:** [JVM 메모리 모델 — GC를 이해하기 위한 지도](/posts/jvm-memory-model/)

<br>
읽어주셔서 감사합니다. 😊
