---
title: "Intl.Collator — 로케일 인식 문자열 정렬"
description: "Intl.Collator로 한국어·스웨덴어·독일어 등 로케일별 문자열을 올바르게 정렬하는 방법, sensitivity·numeric·caseFirst 옵션, 실무 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Intl", "Collator", "정렬", "로케일", "국제화", "i18n"]
featured: false
draft: false
---

[지난 글](/posts/js-intl-numberformat-datetimeformat/)에서 `Intl.NumberFormat`과 `Intl.DateTimeFormat`으로 숫자·날짜를 포맷하는 방법을 살펴봤습니다. 이번에는 문자열 비교와 정렬을 담당하는 `Intl.Collator`를 깊이 파헤칩니다.

---

## 왜 Intl.Collator인가

JavaScript의 기본 `<` / `>` 연산자는 유니코드 코드 포인트를 단순 비교합니다. `'사'.charCodeAt(0)`은 `'가'.charCodeAt(0)`보다 크지만, 한글 사전 순서는 `가 < 나 < 다 ... 사`입니다. 언어별 정렬 규칙(UCA — Unicode Collation Algorithm)을 적용하려면 `Intl.Collator`가 필요합니다.

```javascript
// 잘못된 방식 — 코드 포인트 단순 비교
['다', '가', '나'].sort(); // 브라우저/엔진마다 다름

// 올바른 방식 — UCA 기반
const col = new Intl.Collator('ko-KR');
['다', '가', '나'].sort(col.compare); // ['가', '나', '다']
```

---

## 기본 사용법

```javascript
// 생성자: Intl.Collator(locales?, options?)
const col = new Intl.Collator('ko-KR', {
  sensitivity: 'base',
  numeric: true,
  caseFirst: 'upper',
});

// compare(a, b) → -1 | 0 | 1
col.compare('가', '나');  // -1
col.compare('나', '가');  // 1
col.compare('나', '나');  // 0

// Array.sort에 직접 전달
const words = ['item10', '사과', 'item2', '가방'];
words.sort(col.compare);
// ['item2', 'item10', '가방', '사과']
```

`compare`는 Array.sort 콜백에 바로 넘길 수 있습니다. `col.compare.bind(col)` 필요 없이 메서드 자체가 독립적으로 동작합니다.

---

## 주요 옵션

![Intl.Collator 옵션 비교](/assets/posts/js-intl-collator-options.svg)

### sensitivity

대소문자·악센트를 어떻게 처리할지 결정합니다.

| 값 | 효과 |
|---|---|
| `'base'` | a=á=A (기본 문자만 구분) |
| `'accent'` | a=A, a≠á (악센트 구분, 대소문자 무시) |
| `'case'` | a≠A, a=á (대소문자 구분, 악센트 무시) |
| `'variant'` | a≠á≠A (기본값, 모두 구분) |

검색 기능에서는 `'base'`를 사용해 사용자가 `apple`을 입력해도 `Apple`, `APPLE`이 모두 매칭되게 합니다.

```javascript
const searchCol = new Intl.Collator('en', { sensitivity: 'base', usage: 'search' });

// 검색 필터
function matches(text, query) {
  return searchCol.compare(text, query) === 0;
}
matches('Apple', 'apple'); // true
matches('CAFÉ', 'cafe');   // true
```

### numeric

```javascript
const numericCol = new Intl.Collator('en', { numeric: true });

// numeric: false (기본) — 사전식
['item10', 'item2', 'item1'].sort();
// ['item1', 'item10', 'item2']  ← 잘못된 순서

// numeric: true — 자연 정렬
['item10', 'item2', 'item1'].sort(numericCol.compare);
// ['item1', 'item2', 'item10']  ← 올바른 순서
```

### caseFirst

```javascript
const upperFirst = new Intl.Collator('en', { caseFirst: 'upper' });
['b', 'A', 'a', 'B'].sort(upperFirst.compare);
// ['A', 'B', 'a', 'b']

const lowerFirst = new Intl.Collator('en', { caseFirst: 'lower' });
['b', 'A', 'a', 'B'].sort(lowerFirst.compare);
// ['a', 'b', 'A', 'B']
```

---

## 로케일별 정렬 차이

![로케일별 정렬 비교](/assets/posts/js-intl-collator-locale.svg)

로케일에 따라 같은 문자열도 다르게 정렬됩니다.

```javascript
const words = ['ä', 'z', 'a'];

// 독일어 — ä는 a 바로 다음
new Intl.Collator('de').compare('ä', 'z'); // -1 (ä < z)

// 스웨덴어 — ä는 z 뒤
new Intl.Collator('sv').compare('ä', 'z'); // 1 (ä > z)

// 중국어 — 병음 정렬 vs 획수 정렬
const pinyin = new Intl.Collator('zh-Hans-u-co-pinyin');
const stroke = new Intl.Collator('zh-Hans-u-co-stroke');
```

BCP 47 확장 태그(`-u-co-`)를 이용하면 콜레이션 알고리즘(pinyin, stroke, unihan 등)을 직접 선택할 수 있습니다.

---

## resolvedOptions

```javascript
const col = new Intl.Collator('ko');
col.resolvedOptions();
// {
//   locale: 'ko',
//   usage: 'sort',
//   sensitivity: 'variant',
//   ignorePunctuation: false,
//   collation: 'default',
//   numeric: false,
//   caseFirst: 'false'
// }
```

요청한 로케일이 완전히 지원되지 않을 때 어떤 fallback이 적용됐는지 확인할 수 있습니다.

---

## 실무 패턴

### 테이블 다중 컬럼 정렬

```javascript
function multiSort(rows, keys, locale = 'ko-KR') {
  const col = new Intl.Collator(locale, { numeric: true });
  return [...rows].sort((a, b) => {
    for (const { key, dir = 1 } of keys) {
      const r = col.compare(String(a[key]), String(b[key]));
      if (r !== 0) return r * dir;
    }
    return 0;
  });
}

const users = [
  { name: '홍길동', dept: '개발' },
  { name: '김철수', dept: '개발' },
  { name: '이영희', dept: '기획' },
];

multiSort(users, [
  { key: 'dept', dir: 1 },
  { key: 'name', dir: 1 },
]);
// dept 오름차순 → 이름 오름차순
```

### 지원 로케일 확인

```javascript
Intl.Collator.supportedLocalesOf(['ko', 'ja', 'xx-XX']);
// ['ko', 'ja']  — 지원하는 로케일만 반환
```

### 인스턴스 재사용

포맷터·콜레이터 생성에는 ICU 데이터 로드 비용이 있으므로 모듈 스코프에서 한 번만 생성합니다.

```javascript
// collators.js
export const koCollator = new Intl.Collator('ko-KR', {
  numeric: true,
  sensitivity: 'base',
});

export const enCollator = new Intl.Collator('en-US', {
  numeric: true,
  sensitivity: 'base',
});
```

---

## String.prototype.localeCompare와의 관계

```javascript
// localeCompare는 내부적으로 Intl.Collator를 사용
'가'.localeCompare('나', 'ko-KR'); // -1

// 반복 비교 시 Collator 인스턴스 직접 사용이 더 빠름
const col = new Intl.Collator('ko-KR');
largeArray.sort(col.compare); // localeCompare보다 최대 10배 빠름
```

대규모 배열 정렬에서는 `localeCompare`를 직접 쓰는 것보다 `Intl.Collator` 인스턴스를 미리 만들어두고 `compare`를 전달하는 방식이 훨씬 성능이 좋습니다.

---

**지난 글:** [Intl.NumberFormat · DateTimeFormat — 국제화 포맷팅](/posts/js-intl-numberformat-datetimeformat/)

**다음 글:** [Intl 기타 API — Segmenter, PluralRules, DisplayNames](/posts/js-intl-misc/)

<br>
읽어주셔서 감사합니다. 😊
