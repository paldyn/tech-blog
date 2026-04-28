---
title: "null과 undefined의 차이"
description: "JavaScript의 두 가지 '없음' 값인 null과 undefined의 의미론적 차이, typeof null 버그의 역사, 산술/문자열 변환 차이, JSON 직렬화 동작, 그리고 실전 구분 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "null", "undefined", "nullish", "타입검사", "원시타입"]
featured: false
draft: false
---

[지난 글](/posts/js-symbol-well-known/)에서 Symbol과 Well-Known Symbol로 언어 동작을 확장하는 방법을 살펴봤습니다. 이번에는 "값이 없음"을 표현하는 두 원시 타입 `null`과 `undefined`를 다룹니다. 언뜻 비슷해 보이지만, 의미론적 역할과 동작 방식이 분명히 다릅니다.

## 의미론적 차이

`undefined`는 **엔진이 "아직 값이 없다"고 알리는 신호**입니다. 변수를 선언만 하고 초기화하지 않으면, 함수 파라미터를 생략하면, 없는 프로퍼티에 접근하면, 반환문 없이 함수가 끝나면 — 이 모든 상황에서 엔진이 자동으로 `undefined`를 할당합니다.

`null`은 **개발자가 명시적으로 "빈 값"을 지정할 때 쓰는 값**입니다. "여기에 참조될 객체가 없다"는 의도적인 선언입니다.

```javascript
let declared;       // undefined (엔진이 자동 할당)
let explicit = null; // null (개발자가 의도적으로 지정)

function greet(name) {
  console.log(name); // undefined (파라미터 생략)
}
greet();
```

![null vs undefined 비교](/assets/posts/js-null-vs-undefined-compare.svg)

## typeof의 역사적 버그

```javascript
typeof null;      // "object" ← 버그!
typeof undefined; // "undefined"
```

`typeof null === "object"`는 JavaScript 초기 구현의 버그입니다. 1995년 Brendan Eich가 구현할 때 값의 타입을 하위 3비트 태그로 인코딩했는데, 객체 태그가 `000`이었고 `null`은 C언어의 NULL 포인터(0x00000000)였으므로 태그 비트가 `000`으로 읽혀 "object"를 반환했습니다. 호환성 때문에 수정하지 못한 채 지금까지 남아 있습니다.

**이 때문에 `null` 검사는 반드시 `=== null`로 해야 합니다.**

```javascript
// ❌ 잘못된 null 검사
typeof value === 'object'; // null도 통과해버림

// ✓ 올바른 null 검사
value === null;

// null 또는 undefined 둘 다 검사
value == null; // null이나 undefined에만 true (느슨한 동등의 유일한 관용적 사용)
```

## 산술 변환 차이

숫자 컨텍스트에서 `null`은 `0`으로, `undefined`는 `NaN`으로 변환됩니다.

```javascript
null + 1;      // 1  (null → 0)
undefined + 1; // NaN (undefined → NaN)

Number(null);      // 0
Number(undefined); // NaN
```

이 차이는 예상치 못한 버그의 원천입니다. API에서 숫자를 기대하는 필드에 `undefined`가 들어오면 `NaN`이 전파되고, `null`이 들어오면 `0`으로 계산되어 조용히 틀린 값이 나올 수 있습니다.

## JSON 직렬화 차이

```javascript
JSON.stringify({ a: null });      // '{"a":null}'
JSON.stringify({ a: undefined }); // '{}'  ← 키가 사라짐!

JSON.stringify([null, undefined]); // '[null,null]'
// 배열에서는 undefined가 null로 대체됨
```

API 응답을 JSON으로 직렬화할 때 `undefined` 값을 가진 프로퍼티는 응답에서 사라집니다. 이는 "프로퍼티가 없음"과 "값이 없음"을 구분하기 어렵게 만들어 클라이언트 사이드 버그로 이어질 수 있습니다.

![null/undefined 처리 패턴과 typeof null 버그](/assets/posts/js-null-vs-undefined-patterns.svg)

## 함수 파라미터와 기본값

기본값 문법(`=`)은 `undefined`에만 적용됩니다. `null`이 전달되면 기본값이 사용되지 않습니다.

```javascript
function connect(host, port = 3000) {
  console.log(host, port);
}

connect('localhost');       // 'localhost' 3000 (기본값 적용)
connect('localhost', null); // 'localhost' null (기본값 미적용!)
connect('localhost', undefined); // 'localhost' 3000 (기본값 적용)
```

이 동작은 의도적 설계입니다. `null`은 "명시적으로 비운 값"이므로 기본값을 덮어쓰지 않습니다.

## 실전 가이드라인

1. **`undefined`를 직접 할당하지 않는다**: `obj.prop = undefined`보다 `delete obj.prop`이 낫습니다. 의도적인 "없음"은 `null`을 씁니다.

2. **`null` vs `undefined` 구분이 필요할 때**: API 응답에서 "키가 있지만 값이 없음"(`null`)과 "키 자체가 없음"(`undefined`)을 다르게 처리해야 하면 `=== null`과 `=== undefined`를 명시적으로 구분합니다.

3. **둘 다 처리할 때는 `?? ` 사용**: nullish 병합 연산자(`??`)는 `null`과 `undefined` 모두를 "없음"으로 처리합니다.

```javascript
const port = config.port ?? 3000; // null/undefined 이면 3000
const port2 = config.port || 3000; // falsy(0, '' 포함)이면 3000 — 다름!
```

`0`이나 빈 문자열도 유효한 값인 상황에서 `||` 대신 `??`를 쓰는 이유가 바로 여기에 있습니다.

---

**지난 글:** [Symbol과 Well-Known Symbol](/posts/js-symbol-well-known/)

**다음 글:** [참조와 메모리 — 값 복사 vs 참조 복사](/posts/js-reference-and-memory/)

<br>
읽어주셔서 감사합니다. 😊
