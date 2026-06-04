---
title: "프로토타입 오염: JavaScript 공격 심층 분석"
description: "JavaScript의 프로토타입 체인을 악용하는 Prototype Pollution 공격의 원리, __proto__·constructor 경로를 통한 전역 오염, RCE까지 이어지는 위험과 방어 기법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 8
type: "knowledge"
category: "Security"
tags: ["프로토타입오염", "PrototypePollution", "JavaScript보안", "Node.js보안", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-logging-monitoring-failures/)에서 로깅과 모니터링 실패를 살펴봤다. 이번에는 JavaScript 특유의 취약점인 **프로토타입 오염(Prototype Pollution)** 을 다룬다. JavaScript의 프로토타입 기반 상속 메커니즘이 어떻게 전체 애플리케이션을 오염시킬 수 있는지 알아보자.

## JavaScript 프로토타입 기초

JavaScript의 모든 객체는 `__proto__` 프로퍼티를 통해 프로토타입 체인에 연결되어 있다. 객체에서 프로퍼티를 찾지 못하면 프로토타입 체인을 올라가며 탐색한다.

```javascript
const obj = {}
console.log(obj.__proto__ === Object.prototype)  // true

// 모든 객체가 공유하는 Object.prototype
Object.prototype.sharedProp = 'hello'
console.log({}.sharedProp)   // 'hello'
console.log([].sharedProp)   // 'hello'
console.log(new Date().sharedProp)  // 'hello'
```

## 프로토타입 오염 공격

![프로토타입 오염 공격](/assets/posts/websec-prototype-pollution-attack.svg)

공격자는 `__proto__` 키를 포함한 JSON 페이로드를 주입해 `Object.prototype`을 오염시킨다.

```javascript
// 취약한 깊은 병합(deep merge) 함수
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (typeof source[key] === 'object' && source[key] !== null) {
      target[key] = target[key] || {}
      deepMerge(target[key], source[key])  // 재귀 병합
    } else {
      target[key] = source[key]
    }
  }
  return target
}

// 공격자 페이로드
const malicious = JSON.parse('{"__proto__":{"isAdmin":true}}')

// target[__proto__][isAdmin] = true
// → Object.prototype.isAdmin = true 가 됨!
deepMerge({}, malicious)

// 이제 모든 객체에 isAdmin: true 가 생긴다
console.log({}.isAdmin)           // true
console.log(new User().isAdmin)   // true ← 권한 상승!
```

### 두 번째 오염 경로: constructor

```javascript
// constructor 경로를 통한 오염
const payload = JSON.parse(
  '{"constructor":{"prototype":{"isAdmin":true}}}'
)
deepMerge({}, payload)
```

### Node.js에서 RCE로 이어지는 경우

```javascript
// child_process.spawn 옵션 오염
const payload = JSON.parse(`{
  "__proto__": {
    "shell": true,
    "env": { "NODE_OPTIONS": "--require /tmp/evil.js" }
  }
}`)
deepMerge({}, payload)

// 이후 spawn이 호출될 때 오염된 옵션이 사용됨
const { exec } = require('child_process')
exec('ls', (err, out) => console.log(out))
// → /tmp/evil.js가 실행됨!
```

## 방어 전략

![프로토타입 오염 방어](/assets/posts/websec-prototype-pollution-defense.svg)

### 1. Object.freeze로 프로토타입 보호

```javascript
// 애플리케이션 시작 시 실행
Object.freeze(Object.prototype)
Object.freeze(Object.freeze)

// 이후 Object.prototype 수정 시도는 silently ignore (strict mode에선 TypeError)
const payload = JSON.parse('{"__proto__":{"isAdmin":true}}')
const obj = {}
Object.assign(obj, payload)
console.log({}.isAdmin)  // undefined — 프로토타입 수정 차단됨
```

### 2. null 프로토타입 객체 사용

```javascript
// Object.create(null)로 프로토타입 체인 없는 객체 생성
const safeMap = Object.create(null)
safeMap.key = 'value'
console.log(safeMap.__proto__)   // undefined
console.log(safeMap.toString)    // undefined (Object.prototype 없음)

// 안전한 깊은 병합
function safeMerge(target, source) {
  const FORBIDDEN_KEYS = ['__proto__', 'constructor', 'prototype']

  for (const key of Object.keys(source)) {
    if (FORBIDDEN_KEYS.includes(key)) {
      continue  // 위험 키 무시
    }

    if (
      typeof source[key] === 'object' &&
      source[key] !== null &&
      !Array.isArray(source[key])
    ) {
      target[key] = target[key] || Object.create(null)
      safeMerge(target[key], source[key])
    } else {
      target[key] = source[key]
    }
  }
  return target
}
```

### 3. hasOwnProperty 안전하게 사용

```javascript
// ❌ 위험: 오염된 경우 hasOwnProperty도 override될 수 있음
if (obj.hasOwnProperty('key')) { ... }

// ✅ 안전: Object.prototype에서 직접 호출
if (Object.prototype.hasOwnProperty.call(obj, 'key')) { ... }

// 또는 in 연산자 대신 Object.hasOwn 사용 (Node.js 16+)
if (Object.hasOwn(obj, 'key')) { ... }
```

### 4. JSON Schema 검증

```javascript
const Ajv = require('ajv')
const ajv = new Ajv()

const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    email: { type: 'string', format: 'email' }
  },
  additionalProperties: false,  // 정의되지 않은 프로퍼티 거부
  required: ['name', 'email']
}

function validateInput(data) {
  const validate = ajv.compile(schema)
  if (!validate(data)) {
    throw new Error(`Validation failed: ${JSON.stringify(validate.errors)}`)
  }
  return data
}
```

### 5. 보안 라이브러리 사용

```javascript
// lodash 4.17.21+ 에서 merge는 __proto__ 오염 방어됨
const _ = require('lodash')
const result = _.merge({}, maliciousPayload)

// 하지만 직접 구현한 merge는 여전히 위험하므로
// 항상 검증된 라이브러리를 사용할 것
```

## 취약 라이브러리 확인

```bash
# npm audit으로 알려진 prototype pollution 취약점 확인
npm audit

# snyk으로 더 상세한 취약점 스캔
npx snyk test

# 특정 CVE 확인
npm audit --json | jq '.vulnerabilities | to_entries[] | select(.value.title | contains("Prototype"))'
```

## 핵심 원칙

프로토타입 오염은 JavaScript의 근본적인 설계에서 비롯된 취약점이다. 방어하는 방법은 세 가지다: **입력을 신뢰하지 말고 검증할 것**, **Object.freeze로 프로토타입을 잠글 것**, **위험 키를 필터링할 것**. 외부 입력을 객체에 병합할 때는 항상 주의해야 한다.

---

**지난 글:** [로깅과 모니터링 실패: 침해를 놓치는 이유](/posts/websec-logging-monitoring-failures/)

**다음 글:** [ReDoS: 정규표현식을 이용한 서비스 거부 공격](/posts/websec-redos/)

<br>
읽어주셔서 감사합니다. 😊
