---
title: "옵셔널 체이닝 ?."
description: "ES2020에 도입된 ?. 연산자의 세 가지 형태(프로퍼티, 계산된 프로퍼티, 함수 호출), 단락 평가 동작, ??와의 결합 패턴, 그리고 할당 대상 제한 등 주의사항을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "optional-chaining", "?.", "nullish", "ES2020", "방어적코드"]
featured: false
draft: false
---

[지난 글](/posts/js-short-circuit-nullish/)에서 `&&`와 `??`의 단락 평가 동작을 살펴봤습니다. ES2020에는 이를 더욱 깔끔하게 만드는 `?.` 옵셔널 체이닝 연산자가 함께 도입됐습니다. "Cannot read properties of null" 에러를 없애는 가장 우아한 방법입니다.

## 왜 옵셔널 체이닝이 필요한가

깊이 중첩된 객체 구조에서 프로퍼티에 안전하게 접근하려면 모든 단계를 검사해야 합니다.

```javascript
// ES2020 이전: 장황한 방어 코드
const city =
  user &&
  user.address &&
  user.address.city;

// ES2020 이후: 간결한 체인
const city = user?.address?.city;
```

`?.`는 왼쪽 값이 `null` 또는 `undefined`이면 즉시 `undefined`를 반환하고 나머지 체인 평가를 중단합니다. TypeError가 발생하지 않습니다.

![?. 옵셔널 체이닝 Before/After 비교](/assets/posts/js-optional-chaining-syntax.svg)

## 세 가지 형태

옵셔널 체이닝은 세 가지 접근 패턴에 모두 사용할 수 있습니다.

**프로퍼티 접근**

```javascript
const name = user?.name;       // user가 nullish면 undefined
const city = user?.addr?.city; // 연쇄 체인
```

**계산된 프로퍼티 접근**

```javascript
const first = arr?.[0];              // arr가 nullish면 undefined
const val = map?.[key]?.toString(); // 동적 키
```

**함수/메서드 호출**

```javascript
user?.greet();         // greet가 nullish면 호출 안 함
arr?.forEach(fn);      // arr가 nullish면 건너뜀
callback?.();          // 콜백이 선택적일 때 유용
```

## 단락 평가 동작

`?.`는 왼쪽에서 null/undefined를 만나는 순간 **전체 표현식**이 `undefined`로 단락됩니다. 오른쪽 체인이 길어도 중간에 null을 만나면 더 이상 평가하지 않습니다.

```javascript
null?.a?.b?.c;        // undefined (null에서 단락)
undefined?.foo?.bar;  // undefined

// 메서드 호출도 중단
null?.toString().toUpperCase(); // undefined (TypeError 없음)

// 주의: ?.가 어디에 있느냐에 따라 범위 다름
user.greet?.();  // greet가 null/undefined면 단락, user는 반드시 존재
user?.greet?.(); // user가 null이면 전체 단락
```

## ?? 와 결합 — 기본값 제공

`?.`는 `undefined`를 반환하므로 `??`와 결합하면 기본값 패턴이 완성됩니다.

```javascript
const city = user?.address?.city ?? '알 수 없음';
const len  = arr?.length ?? 0;
const role = user?.roles?.[0] ?? 'guest';
```

`||` 대신 `??`를 쓰는 이유는 앞 글에서 설명한 것처럼, 0이나 빈 문자열도 유효한 값으로 보존하기 위해서입니다.

![?. 실전 패턴과 주의사항](/assets/posts/js-optional-chaining-patterns.svg)

## 실전 활용

**API 응답 중첩 접근**

```javascript
// 여러 단계의 중첩 구조를 안전하게
const avatarUrl = response?.data?.user?.profile?.avatarUrl
  ?? '/images/default-avatar.png';
```

**이벤트 핸들러에서 DOM 안전 접근**

```javascript
document.getElementById('btn')?.addEventListener('click', handler);
// 요소가 없어도 에러 없음
```

**선택적 콜백 패턴**

```javascript
function fetchData(url, { onSuccess, onError } = {}) {
  fetch(url)
    .then(r => r.json())
    .then(data => onSuccess?.(data))
    .catch(err => onError?.(err));
}
```

**Map/WeakMap 안전 접근**

```javascript
const config = configMap?.get(key) ?? defaultConfig;
```

## 주의사항

**할당 대상으로 사용 불가**: `?.`는 값을 읽는 연산이므로 대입의 왼쪽에 올 수 없습니다.

```javascript
user?.name = 'Bob'; // SyntaxError
```

**typeof 와 조합**: `typeof`는 에러 없이 동작하므로 `?.` 없이도 안전합니다.

```javascript
typeof undeclaredVar; // 'undefined' (에러 없음)
// ?.와 함께 쓸 필요 없음
```

**배열 메서드 체인**: 배열 자체가 null일 가능성이 있을 때만 `?.`를 씁니다. 빈 배열(`[]`)은 null이 아니므로 메서드가 정상 실행됩니다.

```javascript
items?.map(fn);  // items가 null/undefined면 undefined
items?.filter(fn)?.length ?? 0; // 배열 길이 안전 접근
```

옵셔널 체이닝은 방어 코드를 극적으로 줄여주는 도구입니다. 단, 모든 접근에 무분별하게 `?.`를 붙이면 실제 오류를 숨길 수 있으니, null/undefined가 실제로 올 수 있는 경우에만 사용하세요.

---

**지난 글:** [단락 평가, Nullish 병합, 논리 대입 연산자](/posts/js-short-circuit-nullish/)

**다음 글:** [비트 연산자 완전 정복](/posts/js-bitwise/)

<br>
읽어주셔서 감사합니다. 😊
