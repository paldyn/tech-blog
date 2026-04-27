---
title: "모던 문법 — ES2018 이후 필수 문법 정리"
description: "옵셔널 체이닝, 널 병합 연산자, 논리 할당, 구조 분해 고급 패턴까지. ES2018부터 ES2023까지 실무에서 가장 많이 쓰이는 모던 JavaScript 문법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-25"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "모던문법", "옵셔널체이닝", "널병합", "구조분해", "ES2020", "ES2021", "ES2023"]
featured: false
draft: false
---

[지난 글](/posts/js-async-patterns/)에서 ES6가 JavaScript의 판도를 어떻게 바꿨는지 살펴봤습니다. 하지만 혁신은 거기서 끝나지 않았습니다. TC39는 ES6 이후 매년 업데이트를 배포하겠다고 약속했고, 실제로 그 약속을 지켰습니다. ES2017의 `async/await`, ES2018의 객체 스프레드, ES2020의 옵셔널 체이닝… 매년 크고 작은 편의 문법이 추가되었습니다.

이 글에서는 그 중에서도 **실무 코드에서 가장 자주 마주치는 문법**들을 추려 정리합니다. "이게 뭔가?" 하고 멈추게 만들었던 `?.`, `??`, `&&=`, `??=` 같은 연산자들의 정확한 의미와 차이를 짚어봅니다.

---

## 왜 이 문법들이 필요했나

JavaScript 코드를 쓰다 보면 반복적으로 나타나는 패턴이 있었습니다. 가장 흔한 것이 **방어적 프로퍼티 접근**입니다.

```js
// 이 코드를 몇 번이나 써봤을까
const city = user && user.address && user.address.city && user.address.city.name;
```

`null`이나 `undefined`일 수 있는 값의 프로퍼티에 접근할 때마다 `&&`로 이어 붙이는 패턴입니다. 실수로 하나라도 빠뜨리면 `TypeError: Cannot read properties of null`이 발생합니다. 또 다른 흔한 패턴은 **기본값 할당**입니다.

```js
const timeout = config.timeout || 5000;
```

이 코드는 `config.timeout`이 `0`이면 의도치 않게 `5000`을 사용합니다. `0`은 유효한 값인데, `||`가 모든 falsy 값을 걸러버리기 때문입니다.

이런 불편함들이 쌓이면서 언어 차원의 해결책이 요구되었습니다.

---

## 옵셔널 체이닝 `?.` — ES2020

옵셔널 체이닝은 프로퍼티 접근 체인 중간에 `null` 또는 `undefined`가 있을 때, 오류를 던지는 대신 `undefined`를 반환하고 평가를 중단합니다.

![ES2020–2023 핵심 모던 연산자](/assets/posts/js-modern-syntax-operators.svg)

세 가지 형태가 있습니다.

```js
user?.address?.city          // 프로퍼티 접근
user?.getAddress?.()         // 메서드 호출
user?.['address']            // 동적 키 접근
```

메서드 호출 형태가 특히 유용합니다. `user.getAddress`가 없을 때 `user.getAddress()`를 호출하면 TypeError가 발생하지만, `user?.getAddress?.()`는 조용히 `undefined`를 반환합니다.

주의할 점은 `?.`의 위치입니다. `a?.b.c`는 `a`가 null이면 멈추지만, `b`가 null이면 멈추지 않습니다. 체인의 각 접점마다 불확실하다면 `a?.b?.c`로 써야 합니다.

옵셔널 체이닝은 단독으로도 쓸모 있지만, 다음에 나올 `??`와 결합할 때 진가를 발휘합니다.

---

## 널 병합 연산자 `??` — ES2020

`??`는 왼쪽 값이 `null` 또는 `undefined`일 때만 오른쪽 값을 반환합니다. 이것이 `||`와의 결정적인 차이입니다.

| 왼쪽 값 | `\|\|` 결과 | `??` 결과 |
|---|---|---|
| `null` | 오른쪽 | 오른쪽 |
| `undefined` | 오른쪽 | 오른쪽 |
| `0` | 오른쪽 ❌ | 왼쪽 ✓ |
| `''` | 오른쪽 ❌ | 왼쪽 ✓ |
| `false` | 오른쪽 ❌ | 왼쪽 ✓ |

`0`, 빈 문자열, `false`가 유효한 값일 수 있는 상황 — 음량 설정, 포트 번호, 토글 상태 — 에서는 반드시 `??`를 써야 합니다.

```js
// 음량 0이 유효한 값
const volume = settings.volume ?? 50;   // 0 → 0 유지 ✓
const volume = settings.volume || 50;   // 0 → 50 ❌

// 옵셔널 체이닝과 결합
const displayName = user?.profile?.nickname ?? user?.name ?? '익명';
```

마지막 줄 패턴이 현장에서 자주 쓰이는 관용구입니다. 여러 단계의 폴백을 깔끔하게 표현합니다.

---

## 논리 할당 연산자 `&&=` `||=` `??=` — ES2021

논리 할당은 "조건이 충족될 때만 할당"을 짧게 쓰는 문법입니다. 각각은 대응하는 논리 연산자의 단락 평가(short-circuit evaluation) 방식으로 동작합니다.

```js
// &&= : 왼쪽이 truthy일 때만 할당
obj.count &&= obj.count + 1;
// 풀어쓰면: obj.count && (obj.count = obj.count + 1)

// ||= : 왼쪽이 falsy일 때만 할당
settings.theme ||= 'dark';
// 풀어쓰면: settings.theme || (settings.theme = 'dark')

// ??= : 왼쪽이 null/undefined일 때만 할당
config.retries ??= 3;
// 풀어쓰면: config.retries ?? (config.retries = 3)
```

셋 중에서 `??=`가 가장 안전한 기본값 패턴입니다. `||=`는 `0`이나 `false`, 빈 문자열도 덮어씁니다. 단순히 "값이 없을 때 채우기"가 목적이라면 `??=`를 쓰는 것이 의도를 정확히 표현합니다.

`&&=`는 주로 "이미 존재하는 값을 조건부로 갱신"할 때 씁니다. 캐시 무효화, 카운터 증가 등에서 유용합니다.

---

## 구조 분해 — 고급 패턴

ES6에서 도입된 구조 분해는 이후 버전에서 더 다양하게 활용됩니다. 기본 문법을 넘어 실무에서 자주 쓰이는 패턴들을 살펴봅니다.

![구조 분해 할당 — 고급 패턴](/assets/posts/js-modern-syntax-destructuring.svg)

**이름 변경 + 기본값 조합**은 처음 보면 약간 생소합니다.

```js
// name 키를 꺼내 userName으로 사용, 없으면 '익명'
const { name: userName = '익명' } = user;
```

콜론은 "새 이름"을 지정하고, 등호는 기본값을 지정합니다.

**함수 매개변수 구조 분해**는 순서에 의존하지 않는 명명 매개변수 패턴을 만들어줍니다.

```js
function createButton({ label, type = 'button', disabled = false, onClick } = {}) {
  // 매개변수 이름이 명확하고, 기본값이 선언에 포함됨
}

createButton({ label: '저장', onClick: handleSave });
```

`= {}`는 함수 호출 시 인자를 아예 넘기지 않을 때를 위한 기본값입니다. 이 패턴 없이는 인자 없이 호출하면 구조 분해 자체가 오류를 냅니다.

**레스트를 이용한 키 제거** 패턴도 유용합니다.

```js
const { password, confirmPassword, ...userData } = formData;
// userData에는 password와 confirmPassword를 제외한 나머지 필드만 남음
sendToServer(userData);
```

---

## 객체 스프레드 — ES2018

배열 스프레드는 ES6에서 나왔지만, 객체 스프레드는 ES2018에서 추가되었습니다. 이 차이를 아는 것이 중요합니다.

```js
// 객체 병합 — 나중에 오는 것이 덮어씀
const config = { ...defaultConfig, ...userConfig };

// 불변 업데이트 — 특정 프로퍼티만 변경
const updatedUser = { ...user, lastLogin: new Date() };

// 프로퍼티 추가 조건부로
const params = {
  page: 1,
  ...(search && { query: search }),
};
```

마지막 패턴 — `&&`와 스프레드를 결합해 조건부로 프로퍼티를 추가하는 기법 — 은 React에서 특히 많이 씁니다.

스프레드는 **얕은 복사**임을 기억해야 합니다. 중첩 객체는 여전히 같은 참조를 공유합니다. 깊은 복사가 필요하면 `structuredClone()`(ES2022)을 씁니다.

---

## 기타 ES2021–2023 편의 문법

짧지만 자주 쓰이는 문법들입니다.

**숫자 구분자(Numeric Separators)** — ES2021

```js
const MILLION = 1_000_000;
const PI = 3.141_592_653;
const bytes = 0xFF_FF_FF_FF;
```

언더스코어는 실제 값에 영향을 주지 않습니다. 큰 숫자의 가독성을 높이는 표기법입니다.

**`at()` 메서드** — ES2022

```js
const last = arr[arr.length - 1];   // 이전
const last = arr.at(-1);             // 이후
const thirdFromLast = arr.at(-3);
```

음수 인덱스로 배열 끝에서부터 접근합니다. 문자열에도 동일하게 씁니다.

**`Object.hasOwn()`** — ES2022

```js
// hasOwnProperty를 직접 호출하는 기존 방식의 문제
obj.hasOwnProperty('key')   // obj가 그 메서드를 오버라이드했다면?

// 안전한 대안
Object.hasOwn(obj, 'key')   // 항상 Object.prototype의 것을 씀
```

**불변 배열 메서드** — ES2023

`sort()`, `reverse()`, `splice()`는 원본 배열을 변경합니다. ES2023에서 원본을 보존하는 대응 메서드가 추가되었습니다.

```js
const sorted = arr.toSorted((a, b) => a - b);     // arr 변경 없음
const reversed = arr.toReversed();                  // arr 변경 없음
const spliced = arr.toSpliced(1, 1, 'new');        // arr 변경 없음
const updated = arr.with(2, 99);                    // 특정 인덱스만 변경
```

React의 상태 관리, Redux, Zustand처럼 불변성이 중요한 환경에서 `.slice()` 복사 후 조작하던 번거로움을 줄여줍니다.

---

## 패턴을 언제 쓸까

이 문법들은 강력하지만, 과용하면 오히려 읽기 어려운 코드가 됩니다. 기준을 잡아두면 좋습니다.

`?.`은 외부에서 오는 데이터(API 응답, 사용자 입력)처럼 구조가 보장되지 않는 경우에 씁니다. 내부 데이터에 남용하면 오류를 숨기는 부작용이 있습니다.

`??`는 `0`, `false`, `''`가 의미 있는 값일 때 `||` 대신 씁니다. 그렇지 않다면 `||`도 충분합니다.

`??=`는 "한 번만 초기화"하는 지연 초기화 패턴에 특히 잘 맞습니다.

---

JavaScript 문법은 계속 진화하고 있습니다. 지금 살펴본 `?.`, `??`, `&&=` 같은 연산자들은 이미 브라우저와 Node.js 최신 버전에서 기본으로 지원됩니다. 구형 환경을 지원해야 한다면 Babel 같은 트랜스파일러가 ES5 호환 코드로 변환해줍니다.

다음 글에서는 코드를 파일 단위로 나누고 결합하는 **모듈 시스템**을 다룹니다. CommonJS와 ES Module의 차이, `import`와 `export`의 다양한 사용법, 그리고 번들러와 트리 쉐이킹까지 살펴봅니다.

---

**지난 글:** [비동기 패턴 — 병렬, 순차, 재시도, 타임아웃](/posts/js-async-patterns/)

**다음 글:** [모듈 시스템 — CommonJS에서 ES Module까지](/posts/js-module-system/)

<br>
읽어주셔서 감사합니다. 😊
