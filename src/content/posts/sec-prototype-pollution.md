---
title: "프로토타입 오염 — Prototype Pollution 공격과 방어"
description: "Prototype Pollution 공격이 __proto__를 통해 Object.prototype을 오염시키는 원리, 권한 우회·DoS·RCE로 이어지는 시나리오, Object.create(null)·freeze·키 검증으로 방어하는 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 10
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "보안", "프로토타입오염", "Prototype Pollution", "__proto__", "Object.create", "보안취약점"]
featured: false
draft: false
---

[지난 글](/posts/sec-eval-function-risk/)에서 `eval()`과 동적 코드 실행의 위험을 살펴봤습니다. 이번에는 JavaScript 특유의 프로토타입 체인을 악용하는 **프로토타입 오염(Prototype Pollution)** 취약점을 다룹니다.

## 프로토타입 체인 복습

JavaScript의 모든 객체는 내부적으로 프로토타입 참조(`[[Prototype]]`)를 가집니다. `{}` 리터럴로 만든 일반 객체는 `Object.prototype`을 프로토타입으로 가집니다.

```js
const obj = {};
obj.__proto__ === Object.prototype; // true

// 프로토타입 속성은 모든 객체에서 보임
Object.prototype.sharedProp = 'hello';
({}).sharedProp; // 'hello' — 어디서나 접근됨
```

이 체인이 프로토타입 오염의 핵심 경로입니다.

## 공격 원리

![프로토타입 오염 공격 원리](/assets/posts/sec-prototype-pollution-attack.svg)

공격자가 `{"__proto__": {"isAdmin": true}}` 형태의 JSON을 서버나 클라이언트에 보내고, 애플리케이션이 이를 깊은 병합(deep merge) 함수로 처리하면 `Object.prototype.isAdmin`이 `true`로 설정됩니다.

이후 코드 어딘가에 `if (user.isAdmin) ...`이 있으면, `user` 객체가 빈 객체여도 프로토타입 체인을 통해 `isAdmin`이 `true`를 반환합니다.

## 취약한 패턴

프로토타입 오염의 전형적인 진입점입니다.

```js
// ❌ 취약한 깊은 병합
function mergeDeep(target, src) {
  for (const key in src) {
    if (typeof src[key] === 'object' && src[key] !== null) {
      if (!target[key]) target[key] = {};
      mergeDeep(target[key], src[key]);  // __proto__ 키도 재귀 처리됨
    } else {
      target[key] = src[key];
    }
  }
}

// 공격: 사용자가 보낸 JSON에 __proto__ 포함
const payload = JSON.parse('{"__proto__":{"isAdmin":true}}');
mergeDeep({}, payload);

// 이제 모든 객체에 isAdmin이 있음
({}).isAdmin; // true
```

`constructor.prototype`을 통한 우회도 있습니다.

```js
// constructor.prototype도 동일한 경로
const payload2 = { constructor: { prototype: { isAdmin: true } } };
mergeDeep({}, payload2);
```

## 실제 취약 라이브러리 사례

lodash의 `merge`, jQuery의 `$.extend(true, ...)` 같은 널리 쓰이는 라이브러리들이 과거에 프로토타입 오염 취약점을 가졌습니다. 현재 버전은 대부분 패치되었지만, 직접 구현한 병합 함수는 여전히 위험합니다.

```js
// 취약한 버전의 lodash.merge (업데이트 전)
_.merge({}, JSON.parse('{"__proto__":{"polluted":true}}'));
```

## 방어 방법

![프로토타입 오염 방어 방법](/assets/posts/sec-prototype-pollution-defense.svg)

### 1. hasOwnProperty로 위험 키 차단

병합 전 키 이름을 검사해 `__proto__`, `constructor`, `prototype`을 거부합니다.

```js
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function safeMerge(target, src) {
  for (const key of Object.keys(src)) {  // for...in 대신 Object.keys
    if (DANGEROUS_KEYS.has(key)) continue;  // ← 위험 키 건너뜀

    if (
      typeof src[key] === 'object' &&
      src[key] !== null &&
      !Array.isArray(src[key])
    ) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = Object.create(null);  // 프로토타입 없는 객체로 초기화
      }
      safeMerge(target[key], src[key]);
    } else {
      target[key] = src[key];
    }
  }
  return target;
}
```

`for...in` 대신 `Object.keys()`를 써서 상속된 키를 순회에서 제외하는 것도 중요합니다.

### 2. Object.create(null) — 프로토타입 없는 객체

사전(dictionary)처럼 임의 키를 저장하는 객체는 `Object.create(null)`로 만들면 `Object.prototype` 자체가 없으므로 오염이 전파되지 않습니다.

```js
// 프로토타입 없는 순수 사전
const cache = Object.create(null);
cache.__proto__ = 'attack';  // 이 객체 자체의 속성으로 설정될 뿐, 전파 안 됨
({}).polluted; // undefined — 오염 없음
```

### 3. Object.freeze(Object.prototype)

앱 시작 시 `Object.prototype`을 동결하면 이후 프로퍼티 추가가 조용히 무시됩니다.

```js
// 앱 진입점 최상단
Object.freeze(Object.prototype);
Object.freeze(Object);

// 이후 오염 시도
Object.prototype.isAdmin = true;  // strict mode에서 TypeError, 일반에서 조용히 무시
({}).isAdmin; // undefined — 오염 실패
```

기존 코드가 `Object.prototype`에 무언가를 추가하는 폴리필이 있다면 freeze 전에 실행해야 합니다.

### 4. JSON Schema 검증 (입력 단계)

외부에서 들어오는 JSON을 사용하기 전에 스키마로 검증하면, 예상치 못한 키가 있는 입력을 거부할 수 있습니다.

```js
import Ajv from 'ajv';
const ajv = new Ajv({ allowUnionTypes: true });

const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number' },
  },
  additionalProperties: false,  // 스키마 외 키 거부
};

function parseUserInput(data) {
  if (!ajv.validate(schema, data)) {
    throw new Error('Invalid input');
  }
  return data;
}
```

`additionalProperties: false`가 핵심입니다. `__proto__`를 포함한 예상치 못한 키가 있으면 검증이 실패합니다.

### 5. 안전한 라이브러리 사용 및 업데이트

직접 병합 함수를 구현하는 대신 lodash의 최신 버전이나 `structuredClone`을 활용합니다.

```js
// structuredClone — 깊은 복사 (Node 17+, 모던 브라우저)
const safe = structuredClone(userInput);

// 또는 JSON 라운드트립 (함수·특수값 손실 주의)
const safe2 = JSON.parse(JSON.stringify(userInput));
```

## Node.js에서의 RCE 위험

서버 측 Node.js에서는 프로토타입 오염이 더 치명적입니다. 일부 라이브러리가 `{}.someMethod`를 호출하는데, 여기에 임의 코드를 주입하면 원격 코드 실행(RCE)으로 이어질 수 있습니다.

```js
// 취약한 패턴 — 오염된 속성을 함수로 호출
Object.prototype.outputFunctionName = 'x; process.mainModule.require("child_process").execSync("whoami")//';
// pug 등 일부 템플릿 엔진이 이 속성을 eval로 실행한 사례 있음
```

실제로 2019년 pug 템플릿 엔진의 `outputFunctionName` 취약점(CVE-2019-8331)이 이 방식으로 RCE를 허용했습니다.

## 보안 감사 도구

```bash
# npm audit — 알려진 취약점 검사
npm audit

# 프로토타입 오염 패턴 정적 분석
# ESLint 플러그인: eslint-plugin-security
npx eslint --rulesdir ./rules src/
```

## 정리

프로토타입 오염은 JavaScript의 프로토타입 체인 구조를 악용하는 취약점입니다. 방어의 핵심은 외부 데이터를 처리하는 병합·복사 함수에서 `__proto__`·`constructor`·`prototype` 키를 차단하고, 사전 객체는 `Object.create(null)`을 사용하며, 입력 단계에서 JSON 스키마로 검증하는 것입니다. 이번 보안 시리즈를 통해 XSS, CSRF, CSP, CORS, SRI, 쿠키, JWT, OAuth, eval, 프로토타입 오염까지 10가지 핵심 주제를 살펴봤습니다.

---

**지난 글:** [eval과 new Function의 보안 위험](/posts/sec-eval-function-risk/)

<br>
읽어주셔서 감사합니다. 😊
