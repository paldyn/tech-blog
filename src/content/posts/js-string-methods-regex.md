---
title: "문자열 메서드와 정규식 활용"
description: "JavaScript 문자열의 주요 메서드를 검색·변환·패딩·정규식으로 분류하고, match/matchAll/replace 함수 활용, 실무 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "String", "정규식", "match", "replace", "matchAll", "문자열메서드"]
featured: false
draft: false
---

[지난 글](/posts/js-array-mutating-vs-non/)에서 배열 메서드의 원본 변경 여부를 살펴봤습니다. 이번에는 문자열(String) 객체가 제공하는 메서드들을 체계적으로 살펴봅니다. 문자열은 불변(immutable)이므로 모든 메서드는 새 문자열을 반환합니다.

---

## 검색과 판별

![문자열 메서드 분류](/assets/posts/js-string-methods-regex-overview.svg)

```javascript
const s = 'Hello, World!';

// 위치 탐색
s.indexOf('o');        // 4
s.lastIndexOf('o');    // 8
s.indexOf('xyz');      // -1

// 포함 여부
s.includes('World');   // true
s.startsWith('Hello'); // true
s.endsWith('!');       // true

// 음수 인덱스 지원 (ES2022)
s.at(-1);              // '!'
s.at(-2);              // '?'  → 실제로는 'd'
```

`includes`, `startsWith`, `endsWith`는 두 번째 인수로 탐색 시작 위치를 지정할 수 있습니다.

---

## 추출과 분리

```javascript
const s = 'Hello, World!';

// 슬라이싱 — 음수 인덱스 지원
s.slice(0, 5);      // 'Hello'
s.slice(-6);        // 'orld!'  → 실제: 'World!'
s.slice(7, -1);     // 'World'

// substring — 음수를 0으로 처리 (slice 선호)
s.substring(7, 12); // 'World'

// 분리
'a,b,c'.split(',');           // ['a', 'b', 'c']
'hello'.split('');            // ['h','e','l','l','o']
'a b  c'.split(/\s+/);       // ['a', 'b', 'c']
'a,b,c'.split(',', 2);       // ['a', 'b'] — 개수 제한
```

`slice`와 `substring`의 차이: `slice`는 음수 인덱스를 뒤에서부터 계산하지만, `substring`은 음수를 0으로 처리하고 두 인수의 순서가 뒤바뀌어도 동작합니다. 실무에서는 `slice`가 더 직관적입니다.

---

## 변환

```javascript
const s = '  Hello, World!  ';

// 공백 제거
s.trim();          // 'Hello, World!'
s.trimStart();     // 'Hello, World!  '
s.trimEnd();       // '  Hello, World!'

// 대소문자
'Hello'.toLowerCase(); // 'hello'
'Hello'.toUpperCase(); // 'HELLO'

// 반복 및 패딩
'ab'.repeat(3);             // 'ababab'
'5'.padStart(3, '0');       // '005'
'5'.padEnd(4, '.');         // '5...'
String(42).padStart(5, '0'); // '00042'
```

`padStart`는 숫자를 고정 폭으로 표시할 때 자주 씁니다. 날짜 포맷(`'2026-05-07'`처럼 월·일을 두 자리로)에도 활용됩니다.

---

## replace와 정규식

`replace`는 첫 번째 일치만 교체하고, `replaceAll`은 모든 일치를 교체합니다. 두 번째 인수로 함수를 넘기면 매치 결과를 가공해 교체 문자열을 동적으로 생성할 수 있습니다.

```javascript
// 문자열로 교체 — 첫 번째만
'aaa'.replace('a', 'b');    // 'baa'

// 전역 플래그로 모두 교체
'aaa'.replace(/a/g, 'b');   // 'bbb'
'aaa'.replaceAll('a', 'b'); // 'bbb' (ES2021)

// 함수로 교체 — 강력한 패턴
'hello world'.replace(/\b\w/g, c => c.toUpperCase());
// 'Hello World'

// 캡처 그룹 활용
'2026-05-07'.replace(/(\d{4})-(\d{2})-(\d{2})/, '$3/$2/$1');
// '07/05/2026'

// 유명한 camelCase→snake_case
const toSnake = s => s.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
toSnake('helloWorldFoo'); // 'hello_world_foo'
```

---

## match와 matchAll

![정규식과 문자열 메서드 조합](/assets/posts/js-string-methods-regex-regex.svg)

```javascript
const html = '<img src="a.png"><img src="b.jpg">';

// match — g 없으면 첫 매치 + 캡처 그룹 상세
html.match(/<img src="([^"]+)">/);
// ['<img src="a.png">', 'a.png', index: 0, ...]

// match — g 있으면 모든 매치 (캡처 그룹 정보 없음)
html.match(/<img src="([^"]+)">/g);
// ['<img src="a.png">', '<img src="b.jpg">']

// matchAll — 모든 매치 + 캡처 그룹 (이터레이터, g 필수)
const imgs = [...html.matchAll(/<img src="([^"]+)">/g)];
imgs.map(m => m[1]); // ['a.png', 'b.jpg']
```

`matchAll`은 반드시 `g` 플래그가 있는 정규식과 함께 써야 합니다. 없으면 `TypeError`가 발생합니다.

---

## 실용 패턴

```javascript
// 이메일 유효성 간단 확인
const isEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
isEmail('foo@bar.com'); // true

// URL에서 쿼리 파라미터 추출 (URLSearchParams가 더 정확하지만)
const getParam = (url, key) => {
  const m = url.match(new RegExp(`[?&]${key}=([^&]*)`));
  return m ? decodeURIComponent(m[1]) : null;
};

// 숫자만 추출
'abc123def456'.match(/\d+/g); // ['123', '456']

// 공백 정규화
'  foo   bar  '.replace(/\s+/g, ' ').trim(); // 'foo bar'

// 문자열 템플릿 채우기
const tmpl = 'Hello, {name}! You have {count} messages.';
const data = { name: 'Alice', count: 3 };
tmpl.replace(/\{(\w+)\}/g, (_, k) => data[k] ?? '');
// 'Hello, Alice! You have 3 messages.'
```

---

## localeCompare와 다국어 정렬

단순한 `>`, `<` 비교는 다국어 문자열 정렬에 적합하지 않습니다. `localeCompare`를 사용합니다.

```javascript
['banana', 'apple', 'cherry'].sort((a, b) => a.localeCompare(b));
// ['apple', 'banana', 'cherry']

// 한국어 정렬
['나', '가', '다'].sort((a, b) => a.localeCompare(b, 'ko'));
// ['가', '나', '다']

// 대소문자 무시
'Foo'.localeCompare('foo', undefined, { sensitivity: 'base' }); // 0
```

---

**지난 글:** [배열 메서드 — 변경 vs 비변경 완전 정복](/posts/js-array-mutating-vs-non/)

**다음 글:** [Object 정적 메서드 총정리](/posts/js-object-static-methods/)

<br>
읽어주셔서 감사합니다. 😊
