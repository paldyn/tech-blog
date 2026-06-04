---
title: "ReDoS: 정규표현식을 이용한 서비스 거부 공격"
description: "재앙적 백트래킹(Catastrophic Backtracking)을 유발하는 정규표현식이 어떻게 서버를 마비시키는지, 취약한 패턴 식별법과 타임아웃·RE2 엔진으로 방어하는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 9
type: "knowledge"
category: "Security"
tags: ["ReDoS", "정규표현식", "서비스거부", "백트래킹", "입력검증", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-prototype-pollution/)에서 프로토타입 오염 공격을 살펴봤다. 이번에는 의외의 공격 벡터인 **ReDoS(Regular Expression Denial of Service)** 를 다룬다. 정규표현식 하나가 서버를 수 분간 멈출 수 있다.

## ReDoS란?

ReDoS는 악의적으로 설계된 입력 문자열이 정규표현식 엔진에 **재앙적 백트래킹(Catastrophic Backtracking)** 을 유발해 CPU를 100%로 고갈시키는 공격이다.

## 백트래킹의 원리

```javascript
// ❌ 취약한 정규식: (a+)+
const re = /^(a+)+$/

// 입력: "aaaaaaaaab" (a 9개 + b 1개)
// 엔진의 백트래킹 시도 횟수: 2^9 = 512회 이상!
// 입력: "aaaaaaaaaaaaaab" (a 14개 + b)
// → 2^14 = 16,384회 — 수 초 걸림

re.test("aaaaaaaaab")  // 오래 걸림...
```

왜 이런 일이 발생하는가? `(a+)+` 는 외부 그룹과 내부 그룹이 모두 `a`를 탐욕적으로 소비하려 한다. `aaab` 에서 매칭이 실패하면 엔진은 다음 조합을 모두 시도한다: `(a)(a)(a)`, `(aa)(a)`, `(a)(aa)`, `(aaa)`, ... 조합의 수가 지수적으로 증가한다.

![ReDoS 재앙적 백트래킹](/assets/posts/websec-redos-catastrophic.svg)

## 취약한 패턴 유형

```javascript
// 유형 1: 중첩된 수량자 (Nested Quantifiers)
/(a+)+/           // ❌
/([a-zA-Z]+)*/    // ❌
/(a|a)+/          // ❌

// 유형 2: 교대와 중첩 (Alternation with Overlap)
/(a|aa)+/         // ❌ — a와 aa가 겹침
/(a+|ab)+c/       // ❌

// 유형 3: 실제 서비스에서 발견된 취약 패턴
// 이메일 검증 (2019년 npm 패키지 취약점)
/^([a-zA-Z0-9])(([\-.]|[_]+)?([a-zA-Z0-9]+))*(@){1}[a-z0-9]+[.]{1}(([a-z]{2,3})|([a-z]{2,3}[.]{1}[a-z]{2,3}))$/

// URL 검증 (실제 사용된 취약 패턴)
/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/
```

## 실제 피해 사례

2016년 Stack Overflow는 ReDoS로 34분간 서비스 중단을 겪었다. 원인은 마크다운 파서의 취약한 정규식이었다.

```
# Stack Overflow 사고를 일으킨 패턴 (단순화)
/\s+$/  → 무해해 보이지만...

# 실제 취약 패턴
/^[\s‌]+|[\s‌]+$/
# 입력: " " * 많은 공백 + 비공백 문자
```

## 방어 전략

![안전한 정규식 패턴](/assets/posts/websec-redos-safe.svg)

### 1. 안전한 패턴으로 교체

```javascript
// ❌ 취약한 패턴 → ✅ 안전한 패턴

// 이메일 검증
const badEmail = /^([a-zA-Z0-9])(([\-.]|[_]+)?([a-zA-Z0-9]+))*@.../
const goodEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/  // 단순하고 안전

// URL 검증
const badUrl = /^(https?:\/\/)?([\da-z\.-]+)\.([\/\w \.-]*)*\/?$/
const goodUrl = /^https?:\/\/[^\s/$.?#].[^\s]*$/i

// 공백 트림
const badTrim = /^\s+|\s+$/g
const goodTrim = (s) => s.trim()  // 내장 함수 사용
```

### 2. 실행 타임아웃 적용

```javascript
// Node.js: vm 모듈로 타임아웃 감싸기
const vm = require('vm')

function safeRegexTest(pattern, input, timeoutMs = 100) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Regex timeout — possible ReDoS'))
    }, timeoutMs)

    try {
      const result = pattern.test(input)
      clearTimeout(timeout)
      resolve(result)
    } catch (e) {
      clearTimeout(timeout)
      reject(e)
    }
  })
}

// 사용
try {
  const isValid = await safeRegexTest(/^(a+)+$/, userInput, 100)
} catch (e) {
  console.warn('Regex timed out for input:', userInput.substring(0, 50))
  return false
}
```

### 3. RE2 엔진 사용 (선형 시간 보장)

```javascript
// node-re2: Google RE2 엔진 (역참조 제외하고 선형 시간 O(n) 보장)
const RE2 = require('re2')

// RE2는 백트래킹이 없어 ReDoS 불가능
const re = new RE2('^(a+)+$')
re.test('aaaaaaaaab')  // 빠르게 반환

// 단, 역참조(\1, \2)는 지원 안 함
// npm install re2
```

### 4. 정적 분석 도구

```bash
# safe-regex: 취약한 정규식 탐지
npm install -g safe-regex
safe-regex '(a+)+'
# → false (취약!)

safe-regex 'a+'
# → true (안전)

# vuln-regex-detector: 더 정교한 분석
npm install -g @makenowjust-lre/lre
```

## CI에 정규식 검사 통합

```yaml
# GitHub Actions
- name: Check for ReDoS vulnerabilities
  run: |
    npx safe-regex-cli --check src/**/*.js src/**/*.ts

# pre-commit hook
- id: redos-check
  name: ReDoS vulnerability check
  entry: npx safe-regex-cli --check
  language: node
  files: \.(js|ts)$
```

## 입력 길이 제한

가장 간단한 첫 번째 방어선은 입력 길이를 제한하는 것이다.

```javascript
function validateEmail(email) {
  if (email.length > 254) {  // RFC 5321 최대 길이
    throw new Error('이메일이 너무 깁니다')
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validateInput(input) {
  const MAX_LENGTH = 1000
  if (input.length > MAX_LENGTH) {
    throw new Error(`입력이 너무 깁니다 (최대 ${MAX_LENGTH}자)`)
  }
  return validateRegex(input)
}
```

## 핵심 원칙

정규표현식을 작성할 때는 항상 "공격자가 최악의 입력을 넣으면 어떻게 될까?"를 생각해야 한다. 중첩된 수량자는 피하고, 취약한 패턴은 `safe-regex` 도구로 검사하며, 외부 입력에 대한 정규식 실행에는 항상 타임아웃을 설정한다.

---

**지난 글:** [프로토타입 오염: JavaScript 공격 심층 분석](/posts/websec-prototype-pollution/)

**다음 글:** [HTTP 요청 스머글링: 프록시 간 불일치 악용](/posts/websec-http-request-smuggling/)

<br>
읽어주셔서 감사합니다. 😊
