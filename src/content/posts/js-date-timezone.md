---
title: "Date와 타임존 — 날짜 다루기의 모든 것"
description: "JavaScript Date 객체의 UTC 기반 내부 구조, 타임존 처리의 함정, Intl.DateTimeFormat을 이용한 다국어 날짜 포맷팅, 날짜 계산 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 7
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Date", "타임존", "UTC", "Intl", "날짜포맷", "DateTimeFormat"]
featured: false
draft: false
---

[지난 글](/posts/js-number-math/)에서 Number와 Math의 수치 연산을 살펴봤습니다. 이번에는 JavaScript에서 날짜와 시간을 다루는 `Date` 객체를 파고듭니다. 타임존 처리는 특히 한국처럼 UTC+9 환경에서 자주 혼란을 일으킵니다.

---

## Date의 내부 구조

`Date` 객체는 내부적으로 **1970-01-01T00:00:00Z(Unix epoch)로부터 경과한 밀리초**를 저장합니다. 시각 표시 방식(로컬/UTC)은 어디서 렌더링하느냐에 따라 달라지지만, 저장된 값 자체는 하나입니다.

![Date 객체 구조와 타임존](/assets/posts/js-date-timezone-structure.svg)

```javascript
// Date 생성 방법
new Date();                    // 현재 시각
new Date(0);                   // 1970-01-01T00:00:00.000Z
new Date(1746604800000);       // 타임스탬프 ms
new Date('2026-05-07T09:00:00Z'); // ISO 8601 (UTC 명시)
new Date(2026, 4, 7);          // 로컬 기준 (월은 0-11!)

Date.now(); // 현재 타임스탬프 (ms)
```

---

## 월 인덱스의 함정

`Date` 생성자에서 월은 **0부터 시작**합니다. 1월이 0, 12월이 11입니다. 이는 오래된 설계 결정으로, 현재까지 하위 호환을 위해 유지됩니다.

```javascript
new Date(2026, 0, 1);  // 2026년 1월 1일
new Date(2026, 11, 31); // 2026년 12월 31일

const d = new Date();
d.getMonth() + 1; // 현재 월 (0-11 → +1로 1-12로 변환)
d.getDay();       // 0=일, 1=월, ..., 6=토
d.getDate();      // 1-31 (일)
```

---

## 로컬 vs UTC

`Date`의 `get*` 메서드는 런타임의 **로컬 타임존**을 기준으로 반환합니다. UTC 기준으로 읽으려면 `getUTC*` 메서드를 씁니다.

```javascript
const d = new Date('2026-05-07T00:00:00Z'); // UTC 자정

// KST (UTC+9) 환경에서 실행 시
d.getHours();     // 9  (로컬 KST 기준)
d.getUTCHours();  // 0  (UTC 기준)
d.getDate();      // 7  (KST 기준)
d.getUTCDate();   // 7  (UTC 기준, 이 경우 동일)
```

---

## 날짜 문자열 파싱의 함정

`'2026-05-07'` (날짜만, T 없음) 형식은 UTC 자정으로 파싱됩니다. KST(UTC+9) 환경에서는 로컬 날짜가 `2026-05-06 09:00:00 KST`가 됩니다.

```javascript
// ⚠ 함정: 날짜만 있는 문자열은 UTC로 파싱됨
new Date('2026-05-07').toLocaleDateString('ko-KR');
// → '2026. 5. 7.' (UTC+9 환경) — OK 보임
// → '2026. 5. 6.' (UTC-5 환경) — 하루 전!

// 안전한 방법: 타임존 명시
new Date('2026-05-07T00:00:00+09:00'); // KST 기준 자정
// 또는 T를 포함해 로컬 시각으로 파싱
new Date('2026-05-07T00:00:00');       // 로컬 기준 자정
```

---

## Intl.DateTimeFormat으로 포맷팅

![Intl.DateTimeFormat으로 날짜 포맷팅](/assets/posts/js-date-timezone-intl.svg)

```javascript
const d = new Date('2026-05-07T09:00:00Z');

// 간단한 포맷
d.toISOString();       // '2026-05-07T09:00:00.000Z'
d.toLocaleDateString('ko-KR'); // '2026. 5. 7.'
d.toLocaleTimeString('ko-KR'); // '오후 6:00:00' (KST)

// Intl.DateTimeFormat — 상세 제어
const fmt = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
fmt.format(d); // '2026. 05. 07. 18:00'

// formatToParts — 각 부분을 개별 접근
fmt.formatToParts(d);
// [{ type:'year', value:'2026' }, { type:'month', value:'05' }, ...]
```

---

## 날짜 계산

```javascript
const d = new Date('2026-05-07');

// N일 후
const after7 = new Date(d);
after7.setDate(d.getDate() + 7);
// 또는
const after7b = new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000);

// 두 날짜 차이 (ms → 일)
const diff = (a, b) =>
  Math.round((b - a) / (1000 * 60 * 60 * 24));

diff(new Date('2026-01-01'), new Date('2026-05-07')); // 126

// 월말 계산 — setDate(0) 트릭
const lastDayOfMonth = (year, month) =>
  new Date(year, month + 1, 0).getDate(); // 해당 월의 마지막 날

lastDayOfMonth(2026, 1); // 28 (2월)
lastDayOfMonth(2026, 0); // 31 (1월)

// ISO 주 번호
const getWeekNumber = (d) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
};
```

---

## 실무 권장사항

복잡한 날짜 연산, 타임존 변환, 파싱이 필요하다면 네이티브 `Date`보다 라이브러리를 쓰는 것이 안전합니다.

```javascript
// date-fns (트리쉐이킹 가능, 불변)
import { addDays, format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const d = parseISO('2026-05-07T09:00:00Z');
const kst = toZonedTime(d, 'Asia/Seoul');
format(kst, 'yyyy-MM-dd HH:mm:ss'); // '2026-05-07 18:00:00'

// Temporal API (Stage 3 제안 — 미래 표준)
// Temporal.ZonedDateTime.from('2026-05-07T09:00:00+09:00[Asia/Seoul]')
```

`date-fns`는 번들 크기가 중요한 프론트엔드에 적합하고, `Day.js`는 `moment.js`의 가벼운 대안입니다. Temporal API는 현재 폴리필로 사용 가능하며, 네이티브 `Date`의 문제를 모두 해결한 새 표준입니다.

---

**지난 글:** [Number와 Math — 수치 연산 완전 정복](/posts/js-number-math/)

**다음 글:** [정규식 심화 — 그룹·후방탐색·플래그](/posts/js-regexp-advanced/)

<br>
읽어주셔서 감사합니다. 😊
