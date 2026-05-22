---
title: "[Nexacro N] 트러블슈팅: 타임존 문제"
description: "Nexacro N 애플리케이션에서 발생하는 타임존 불일치 문제를 진단하고 해결하는 방법을 설명합니다. 서버-클라이언트 시간대 차이, Date 객체 주의사항, 문자열 기반 날짜 처리 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 10
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "트러블슈팅", "타임존", "날짜처리", "UTC", "KST", "Date객체"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-troubleshoot-memory-leak/)에서 메모리 누수 문제를 다루었다. 이번에는 글로벌 서비스나 서버-클라이언트 시간대가 다른 환경에서 자주 발생하는 **타임존 불일치 문제**를 살펴본다. 날짜·시간 데이터가 9시간 차이나거나, 날짜 계산 결과가 맞지 않는 현상의 원인과 해결법이다.

## 문제 발생 구조

타임존 문제는 서버, 클라이언트, DB가 서로 다른 시간대 기준으로 동작할 때 발생한다.

![타임존 불일치 발생 구조](/assets/posts/nexacro-n-troubleshoot-timezone-flow.svg)

클라이언트는 KST(UTC+9)를 사용하는 PC에서 실행되고, 서버는 UTC 또는 다른 시간대로 운영되는 경우, 같은 시각을 서로 다른 값으로 해석한다.

## 원인 1: JavaScript Date 객체의 자동 변환

`new Date()`는 항상 로컬 시간대를 적용한다. 서버에서 UTC 문자열을 받아 Date 객체로 변환하면, 클라이언트 로컬 시간으로 자동 변환된다.

```javascript
// 서버 응답: "2026-05-22T05:30:00Z" (UTC)
var serverDate = "2026-05-22T05:30:00Z";

// Date 객체 생성 시 KST(UTC+9)로 변환
var d = new Date(serverDate);
trace(d.toLocaleString()); // "2026. 5. 22. 오후 2:30:00" (KST)

// 원래 UTC 시각과 9시간 차이
// 날짜 비교·계산 시 오류 발생
```

## 원인 2: 날짜 연산 중 타임존 개입

Date 객체끼리 뺄셈은 밀리초 단위로 정확하지만, 날짜 경계(자정)에서 오차가 생길 수 있다.

```javascript
// 문제 발생 예
var d1 = new Date("2026-05-21T23:00:00Z"); // UTC 23시 = KST 다음날 8시
var d2 = new Date("2026-05-22T01:00:00Z"); // UTC 01시 = KST 10시

// UTC 기준 차이: 2시간
// KST 기준 날짜: d1이 21일, d2가 22일 → 1일 차이
// 어느 기준을 쓰느냐에 따라 결과가 달라짐
var diffHours = (d2 - d1) / 3600000; // 2시간 (정확)
var diffDays  = (d2 - d1) / 86400000; // 0.083일 (날짜 경계 오류 아님, 시간 차이)
```

## 해결 방향 1: 문자열 기반 날짜 처리

날짜를 `YYYYMMDD` 형식의 문자열로만 다루면 타임존 영향을 받지 않는다.

![타임존 안전한 날짜 처리 패턴](/assets/posts/nexacro-n-troubleshoot-timezone-fix.svg)

```javascript
// 날짜 문자열을 Date 객체로 변환 (로컬 날짜 기준)
function fn_parseDate(dateStr) {
    // "20260522" → Date(2026, 4, 22) — 로컬 TZ, 시간 없음
    var y = parseInt(dateStr.substr(0, 4));
    var m = parseInt(dateStr.substr(4, 2)) - 1;
    var d = parseInt(dateStr.substr(6, 2));
    return new Date(y, m, d);
}

// 두 날짜 문자열 간 일수 차이 계산
function fn_dateDiff(dateStr1, dateStr2) {
    var d1 = fn_parseDate(dateStr1);
    var d2 = fn_parseDate(dateStr2);
    return Math.round((d2 - d1) / 86400000);
}

// 사용
trace(fn_dateDiff("20260501", "20260522")); // 21
```

## 해결 방향 2: 서버에서 KST 문자열로 전달

서버에서 날짜·시간 데이터를 이미 KST 문자열(예: "20260522143000")로 변환해서 전달하면, 클라이언트에서 타임존 변환이 필요 없다.

```java
// Java 서버 예 — KST 포맷으로 변환
LocalDateTime kst = utcTime.atZone(ZoneId.of("UTC"))
    .withZoneSameInstant(ZoneId.of("Asia/Seoul"))
    .toLocalDateTime();
String kstStr = kst.format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
// → "20260522143000"
```

클라이언트는 이 문자열을 그대로 화면에 표시하거나 비교 연산에 활용한다.

## 현재 시각 가져오기

클라이언트에서 현재 시각을 가져올 때도 주의가 필요하다.

```javascript
// 방법 1: 서버 시간 기준 (권장)
// 트랜잭션 응답에 서버 현재 시각 포함
var serverNow = dsCommon.getColumn(0, "serverTime"); // "20260522143000"

// 방법 2: 클라이언트 로컬 시간 (타임존 주의)
function fn_getLocalDateStr() {
    var d   = new Date();
    var y   = d.getFullYear();
    var m   = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return "" + y + m + day; // "20260522"
}
```

서버 기준 시각을 사용하면 클라이언트 PC의 시계가 잘못되어 있어도 문제가 없다.

## 타임존 문제 진단 체크리스트

| 증상 | 가능한 원인 |
|------|-----------|
| 날짜가 1일 틀림 | 자정 경계에서 UTC/KST 변환 오류 |
| 시각이 9시간 차이 | UTC 서버 ↔ KST 클라이언트 불일치 |
| 날짜 계산 결과 오류 | Date 객체 비교 시 TZ 개입 |
| 조회 조건 날짜 불일치 | 클라이언트 날짜를 UTC로 서버에 전달 |

## 핵심 원칙

1. **날짜는 문자열(YYYYMMDD)**로 다룬다. Date 객체 변환은 최소화한다.
2. **서버와 클라이언트의 시간대 기준**을 프로젝트 초기에 명확히 합의한다.
3. **현재 시각**은 서버에서 받아오는 것을 기본으로 한다.

---

**지난 글:** [트러블슈팅: 메모리 누수](/posts/nexacro-n-troubleshoot-memory-leak/)

<br>
읽어주셔서 감사합니다. 😊
