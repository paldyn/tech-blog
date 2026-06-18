---
title: "JSDoc으로 타입 작성하기"
description: "TypeScript 문법을 쓰지 않고 자바스크립트 파일에 JSDoc 주석만으로 타입을 입히는 법을 다룬다. @param·@returns·@type·@typedef·@template의 사용법, import 타입과 캐스팅, @satisfies, 그리고 JSDoc과 .ts 중 무엇을 언제 선택할지까지 정리한다."
author: "PALDYN Team"
pubDate: "2026-06-19"
archiveOrder: 8
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "JSDoc", "JavaScript", "마이그레이션", "타입"]
featured: false
draft: false
---

[지난 글](/posts/ts-allowjs-checkjs/)에서 `checkJs`를 켜면 자바스크립트도 타입 검사를 받는다고 했다. 그 검사의 근거가 되는 것이 바로 JSDoc이다. JSDoc은 원래 문서화용 주석 규약이지만, TypeScript는 이를 타입 주석으로 해석한다. 즉 `.ts`로 파일을 바꾸지 않고, 빌드 단계를 추가하지 않고도, 순수 자바스크립트에 상당한 수준의 타입 안전성을 입힐 수 있다. 이번 글은 JSDoc으로 타입을 작성하는 법을 본격적으로 다룬다.

## TypeScript 문법과 일대일 대응

JSDoc 타입 주석의 핵심은, `.ts`에서 쓰던 타입 표현이 거의 그대로 JSDoc 태그로 옮겨진다는 점이다. 중괄호 `{}` 안에 들어가는 것이 곧 TypeScript의 타입이다.

![JSDoc 태그와 TypeScript 대응](/assets/posts/ts-jsdoc-typing-mapping.svg)

가장 기본인 함수부터 보자. 매개변수는 `@param`, 반환값은 `@returns`로 표기한다.

```javascript
// @ts-check

/**
 * @param {string} name
 * @param {number} [age]   // 대괄호 = 선택적 매개변수
 * @returns {string}
 */
function greet(name, age) {
  return age ? `${name} (${age})` : name;
}
```

매개변수 이름을 대괄호로 감싸면 선택적(`?`) 매개변수가 되고, `[age=18]`처럼 쓰면 기본값까지 표현된다. 변수에는 `@type`을 쓴다.

```javascript
/** @type {string[]} */
const names = [];

/** @type {Map<string, number>} */
const counts = new Map();
```

## 타입 정의: @typedef

객체 타입이나 재사용할 타입은 `@typedef`로 정의한다. `.ts`의 `type` 별칭에 해당한다.

```javascript
/**
 * @typedef {Object} User
 * @property {number} id
 * @property {string} name
 * @property {boolean} [active]
 */

/** @param {User} user */
function printUser(user) {
  console.log(user.name); // user.name이 string으로 잡힌다
}
```

인라인 객체 리터럴 문법도 된다. `@typedef {{ id: number, name: string }} User`처럼 한 줄로 적을 수 있어, 작은 타입은 더 간결하다.

## 제네릭과 import 타입

JSDoc은 제네릭과 다른 파일의 타입 import까지 표현할 수 있다. 이 둘이 가능하다는 점이, "JSDoc은 간단한 것만 된다"는 오해를 깨는 지점이다.

![JSDoc으로 제네릭과 import](/assets/posts/ts-jsdoc-typing-advanced.svg)

제네릭은 `@template`으로 타입 매개변수를 선언한다.

```javascript
/**
 * @template T
 * @param {T[]} arr
 * @returns {T | undefined}
 */
function first(arr) {
  return arr[0];
}

const n = first([1, 2, 3]); // n: number | undefined
```

다른 파일의 타입은 `import(...)` 구문으로 가져온다. 값 import와 달리 런타임에 아무 코드도 만들지 않고, 타입만 끌어온다.

```javascript
/** @typedef {import('./models').User} User */

/** @param {import('./models').Config} config */
function setup(config) { /* ... */ }
```

## 캐스팅과 @satisfies

타입 단언(캐스팅)은 `/** @type {X} */` 주석을 **괄호로 감싼 표현식 앞**에 붙여서 한다. `.ts`의 `as`에 해당한다.

```javascript
const raw = JSON.parse(text);
const user = /** @type {User} */ (raw); // raw as User
```

괄호가 필수다. 괄호 없이 쓰면 단언이 아니라 변수 선언의 타입 주석으로 해석되니 주의한다. 또 `@satisfies`도 JSDoc에서 쓸 수 있어, 값이 어떤 타입을 만족하는지 검사하되 좁은 추론 타입은 그대로 유지하는 패턴이 가능하다.

```javascript
/**
 * @satisfies {Record<string, number>}
 */
const config = { width: 100, height: 200 };
// config.width는 number로 좁게 유지되면서, 형태는 검사됨
```

## JSDoc과 .ts, 무엇을 언제

JSDoc 타이핑이 빛나는 곳은 분명하다. **빌드 단계를 추가하기 어려운 환경**(브라우저에서 바로 도는 스크립트, 빌드 없는 Node 도구), **마이그레이션 중간 단계**, **소규모 라이브러리**가 그렇다. JSDoc은 변환 없이 그대로 실행되는 유효한 자바스크립트라는 점이 가장 큰 장점이다.

반면 한계도 있다. 복잡한 조건부 타입, 매핑된 타입, 정교한 타입 레벨 프로그래밍은 JSDoc으로 표현하면 매우 장황하거나 불가능하다. 타입이 코드의 중심이 되는 본격적인 프로젝트라면 `.ts`가 훨씬 읽기 쉽고 강력하다. 실무에서는 "빌드 도구를 들이기 전까지는 JSDoc으로 버티다가, 규모가 커지면 `.ts`로 전환"하는 흐름이 자연스럽다.

## 정리

JSDoc은 자바스크립트를 떠나지 않고도 타입을 입히는 길이다. **`@param`·`@returns`·`@type`으로 기본을, `@typedef`로 타입 정의를, `@template`과 `import(...)`로 제네릭과 외부 타입을, `/** @type {X} */ (expr)`로 캐스팅을 표현한다.** 빌드 없는 환경이나 마이그레이션 중간 단계에서 특히 유용하지만, 복잡한 타입 프로그래밍이 필요해지면 `.ts`로 옮기는 편이 낫다. 다음 글에서는 `.ts`로 옮긴 뒤 strict 플래그를 하나씩 켜며 타입을 단단히 하는 점진적 strictness 강화를 다룬다.

---

**지난 글:** [allowJs와 checkJs](/posts/ts-allowjs-checkjs/)

**다음 글:** [점진적으로 strict 강화하기](/posts/ts-gradual-strictness/)

<br>
읽어주셔서 감사합니다. 😊
