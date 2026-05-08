---
title: "JSON — 직렬화 옵션과 활용"
description: "JSON.stringify의 replacer·space 옵션, JSON.parse의 reviver, toJSON 메서드, 직렬화 제한값 처리, 안전한 JSON 파싱 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "JSON", "stringify", "parse", "replacer", "reviver", "직렬화"]
featured: false
draft: false
---

[지난 글](/posts/js-regexp-advanced/)에서 정규식 심화 기능을 살펴봤습니다. 이번에는 JavaScript에서 가장 많이 사용하는 데이터 포맷인 JSON의 `stringify`와 `parse`를 깊이 파고듭니다. 기본 사용법을 넘어 replacer, reviver, toJSON 같은 고급 옵션을 정리합니다.

---

## JSON 기본

JSON(JavaScript Object Notation)은 JavaScript 값의 텍스트 표현이지만, 일부 값은 표현할 수 없습니다.

```javascript
// JSON으로 표현 가능한 타입
JSON.stringify(42);           // '42'
JSON.stringify('hello');      // '"hello"'
JSON.stringify(true);         // 'true'
JSON.stringify(null);         // 'null'
JSON.stringify([1, 2, 3]);    // '[1,2,3]'
JSON.stringify({ a: 1 });     // '{"a":1}'

// JSON.parse — 문자열을 JavaScript 값으로
JSON.parse('{"a":1,"b":2}'); // { a: 1, b: 2 }
JSON.parse('[1,2,3]');        // [1, 2, 3]
JSON.parse('"hello"');        // 'hello'
```

---

## 직렬화 제한

일부 값은 JSON으로 직렬화할 수 없습니다. 알고 있어야 예기치 않은 데이터 손실을 피할 수 있습니다.

```javascript
// undefined — 객체 속성에서 제외
JSON.stringify({ a: undefined, b: 2 }); // '{"b":2}'
// 배열에서는 null로 대체
JSON.stringify([undefined, 2]);          // '[null,2]'

// Function, Symbol — 제외됨
JSON.stringify({ fn: () => {}, sym: Symbol() }); // '{}'

// NaN, Infinity, -Infinity — null로 변환
JSON.stringify({ n: NaN, i: Infinity }); // '{"n":null,"i":null}'

// 순환 참조 — TypeError
const a = {};
a.self = a;
JSON.stringify(a); // TypeError: Converting circular structure to JSON
```

---

## JSON.stringify 옵션: replacer

![JSON.stringify 옵션](/assets/posts/js-json-options-stringify.svg)

`replacer`는 직렬화 과정을 제어합니다. 배열 또는 함수로 지정할 수 있습니다.

```javascript
const data = {
  id: 1,
  password: 'secret',
  createdAt: new Date('2026-05-07'),
  callback: () => {},
};

// 배열 replacer — 허용할 키 화이트리스트
JSON.stringify(data, ['id', 'createdAt']);
// '{"id":1,"createdAt":"2026-05-07T00:00:00.000Z"}'

// 함수 replacer — (key, value) 쌍을 받아 변환·필터링
JSON.stringify(data, (key, val) => {
  if (key === 'password') return undefined; // 제외
  if (val instanceof Date) return val.toISOString(); // 명시적 변환
  return val;
});
// '{"id":1,"createdAt":"2026-05-07T00:00:00.000Z"}'
```

함수 replacer의 첫 호출은 `key`가 빈 문자열(`''`)이고 `val`이 최상위 값입니다.

---

## JSON.stringify 옵션: space

`space`는 가독성을 위한 들여쓰기를 지정합니다. 로그나 파일 출력에 유용합니다.

```javascript
const obj = { name: 'Alice', scores: [90, 85, 95] };

// 숫자 — 스페이스 개수 (최대 10)
JSON.stringify(obj, null, 2);
// {
//   "name": "Alice",
//   "scores": [
//     90,
//     85,
//     95
//   ]
// }

// 문자열 — 커스텀 들여쓰기 문자
JSON.stringify(obj, null, '\t'); // 탭 들여쓰기
JSON.stringify(obj, null, '|');  // 파이프 들여쓰기 (희귀하지만 가능)
```

---

## JSON.parse reviver

![JSON.parse reviver와 직렬화 제한](/assets/posts/js-json-options-parse.svg)

`reviver`는 파싱 결과를 후처리합니다. ISO 날짜 문자열을 `Date` 객체로 복원하는 것이 가장 흔한 사용 사례입니다.

```javascript
const json = '{"name":"Alice","createdAt":"2026-05-07T00:00:00.000Z"}';

const isoDateRe = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

const parsed = JSON.parse(json, (key, val) => {
  if (typeof val === 'string' && isoDateRe.test(val)) {
    return new Date(val);
  }
  return val;
});

parsed.createdAt instanceof Date; // true
```

reviver는 리프(leaf) 노드부터 루트까지 Bottom-up 순서로 호출됩니다.

---

## toJSON — 커스텀 직렬화

객체에 `toJSON` 메서드가 있으면 `JSON.stringify`가 이를 호출하고 반환값을 직렬화합니다.

```javascript
class Temperature {
  constructor(celsius) {
    this.celsius = celsius;
  }

  get fahrenheit() {
    return this.celsius * 9 / 5 + 32;
  }

  toJSON() {
    return {
      celsius: this.celsius,
      fahrenheit: this.fahrenheit,
    };
  }
}

const t = new Temperature(100);
JSON.stringify(t); // '{"celsius":100,"fahrenheit":212}'

// Date.prototype.toJSON은 toISOString()을 반환
new Date('2026-05-07').toJSON(); // '2026-05-07T00:00:00.000Z'
```

---

## 안전한 파싱

외부 소스의 JSON은 유효하지 않을 수 있으므로 항상 `try/catch`로 감쌉니다.

```javascript
function safeParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

safeParse('{"a":1}');  // { a: 1 }
safeParse('invalid');  // null
safeParse(undefined);  // null
```

---

## 깊은 복사와 JSON

`JSON.stringify` + `JSON.parse` 조합은 간단한 깊은 복사에 사용되지만, 앞서 살펴본 직렬화 제한이 있습니다.

```javascript
// 간단한 깊은 복사 (함수, undefined, Date 주의)
const deep = JSON.parse(JSON.stringify(obj));

// 권장: structuredClone (ES2022)
const deep2 = structuredClone(obj); // 더 많은 타입 지원
// Date → Date 유지, 하지만 함수는 지원 안 함
```

`structuredClone`은 `Date`, `Map`, `Set`, `ArrayBuffer`, `RegExp` 등을 올바르게 복사합니다. JSON 방식보다 권장됩니다.

---

## JSON 파싱 성능

대용량 JSON을 파싱할 때는 파싱 비용을 고려합니다.

```javascript
// 큰 JSON 파일 — 필요한 부분만 추출
// streaming JSON parsers (웹 스트림 + Fetch)
const response = await fetch('/api/large-data.json');
// Response.json() 내부적으로 JSON.parse와 동일

// 서버사이드: fast-json-stringify, simdjson 같은 고성능 파서 활용
```

---

**지난 글:** [정규식 심화 — 그룹·후방탐색·플래그](/posts/js-regexp-advanced/)

**다음 글:** [Intl.NumberFormat · DateTimeFormat — 국제화 포맷팅](/posts/js-intl-numberformat-datetimeformat/)

<br>
읽어주셔서 감사합니다. 😊
