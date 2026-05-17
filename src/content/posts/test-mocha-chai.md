---
title: "Mocha + Chai — 유연한 클래식 테스트 스택"
description: "Mocha의 describe/it 구조, 생명주기 훅, 비동기 테스트, Chai의 TDD/BDD 스타일 어서션, Sinon 통합, 플러그인 확장 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Mocha", "Chai", "Sinon", "테스트", "BDD", "TDD", "어서션"]
featured: false
draft: false
---

[지난 글](/posts/test-vitest/)에서 Vite 기반의 Vitest를 살펴봤습니다. 이번에는 JavaScript 테스트 생태계의 역사 깊은 조합인 **Mocha + Chai**를 정리합니다. Jest와 Vitest가 올인원 설계를 채택한 반면, Mocha는 테스트 러너만 담당하고 어서션 라이브러리(Chai), 목 라이브러리(Sinon)를 별도로 조합합니다. 이 모듈화 철학은 각 레이어를 독립적으로 교체할 수 있다는 유연함을 줍니다.

---

## Mocha의 설계 철학

Mocha는 단일 책임 원칙을 테스트 도구 설계에 적용합니다. 테스트 러너는 파일을 수집하고 실행하고 결과를 리포트하는 일만 합니다. "무엇을 검증할 것인가"는 Chai에게, "의존성을 어떻게 대체할 것인가"는 Sinon에게 맡깁니다. 팀이 Chai 대신 `assert` 내장 모듈이나 다른 어서션 라이브러리를 사용해도 Mocha는 개의치 않습니다.

이 유연함은 레거시 프로젝트나 Node.js 서버 코드, 특정 도메인 전용 어서션이 필요한 환경에서 지금도 선택받는 이유입니다.

![Mocha + Chai + Sinon 스택 구조](/assets/posts/test-mocha-chai-stack.svg)

---

## 설치와 기본 실행

```bash
npm install -D mocha chai sinon
# TypeScript 지원
npm install -D ts-node @types/mocha @types/chai @types/sinon
```

`package.json`의 `scripts`에 Mocha를 등록합니다.

```json
{
  "scripts": {
    "test": "mocha --require ts-node/register 'test/**/*.test.ts'",
    "test:watch": "mocha --watch --require ts-node/register 'test/**/*.test.ts'"
  },
  "mocha": {
    "timeout": 5000,
    "reporter": "spec",
    "require": ["ts-node/register"]
  }
}
```

`.mocharc.yml` 또는 `.mocharc.cjs`로 설정 파일을 분리할 수도 있습니다. ESM 환경에서는 `--loader ts-node/esm`과 함께 `--experimental-specifier-resolution=node`가 필요합니다.

---

## describe / it — 테스트 구조

```javascript
const { expect } = require('chai')
const { add, multiply } = require('./math')

describe('수학 함수', () => {
  describe('add', () => {
    it('양수 두 개를 더한다', () => {
      expect(add(1, 2)).to.equal(3)
    })

    it('음수를 포함해도 정확하다', () => {
      expect(add(-1, 1)).to.equal(0)
    })

    it.skip('나중에 작성할 케이스') // 건너뜀
  })

  describe('multiply', () => {
    it('곱셈을 수행한다', () => {
      expect(multiply(3, 4)).to.equal(12)
    })
  })
})
```

`describe`는 중첩 가능하며, `describe.only` / `it.only`로 특정 테스트만 실행할 수 있습니다. CI 환경에서 `.only`를 사용하면 다른 테스트가 모두 무시되므로 커밋 전 제거해야 합니다.

---

## 생명주기 훅

Mocha는 4가지 훅을 제공합니다.

```javascript
describe('DB 연결 테스트', () => {
  let connection

  before(async () => {
    // describe 블록 전체에서 1회 실행
    connection = await db.connect()
  })

  after(async () => {
    await connection.close()
  })

  beforeEach(() => {
    // 각 it 전에 실행
    connection.beginTransaction()
  })

  afterEach(async () => {
    // 각 it 후에 실행 (실패해도 실행됨)
    await connection.rollback()
  })

  it('사용자를 저장한다', async () => {
    const id = await connection.insert({ name: 'Alice' })
    expect(id).to.be.a('number')
  })
})
```

`before`/`after`는 describe 범위 전체에 1회 적용됩니다. 루트 수준(describe 바깥)에 정의하면 전체 테스트 스위트에 적용됩니다. `afterEach`는 테스트가 실패해도 반드시 실행되므로 정리 코드를 여기에 배치합니다.

---

## 비동기 테스트

Mocha는 세 가지 비동기 패턴을 지원합니다.

```javascript
// 1. done 콜백 (콜백 기반 API)
it('파일을 읽는다', (done) => {
  fs.readFile('test.txt', (err, data) => {
    if (err) return done(err)
    expect(data.toString()).to.include('hello')
    done()
  })
})

// 2. Promise 반환
it('API를 호출한다', () => {
  return fetch('/api/users')
    .then(res => res.json())
    .then(users => expect(users).to.be.an('array'))
})

// 3. async/await (권장)
it('비동기 검증', async () => {
  const users = await fetchUsers()
  expect(users).to.have.lengthOf.above(0)
})
```

`done` 콜백을 사용할 때 `done`을 호출하지 않으면 타임아웃이 발생합니다. 기본 타임아웃은 2000ms이며 `this.timeout(5000)`으로 개별 테스트에서 조정할 수 있습니다(화살표 함수에서는 `this` 사용 불가).

---

## Chai 어서션

Chai는 세 가지 스타일을 지원합니다.

```javascript
const { assert } = require('chai')
// TDD 스타일 — 첫 번째 인수가 실제값
assert.strictEqual(add(1, 2), 3)
assert.isArray(result)
assert.throws(() => invalid(), RangeError)

const { expect } = require('chai')
// BDD 스타일 — 체이닝으로 가독성 향상
expect(user).to.be.an('object')
expect(user.name).to.equal('Alice')
expect(list).to.include('item')
expect(fn).to.throw(/error/)

// should 스타일 — Object.prototype 확장 (null 객체에서 오류 발생 주의)
const { should } = require('chai')
should() // 초기화 필요
user.name.should.equal('Alice')
```

`expect` 스타일이 가장 많이 사용됩니다. `deep.equal`로 객체 깊은 비교, `include`로 배열/문자열 포함 여부, `closeTo(n, delta)`로 부동소수점 근사값 비교 등을 지원합니다.

---

## Sinon — 테스트 더블

```javascript
const sinon = require('sinon')

// Spy: 실제 동작 + 호출 추적
const spy = sinon.spy(console, 'log')
myFunc()
expect(spy.calledOnce).to.be.true
spy.restore()

// Stub: 반환값 제어
const stub = sinon.stub(service, 'fetch')
stub.resolves({ status: 200, data: [] })
stub.withArgs('/users').resolves({ data: [{ id: 1 }] })
// ...
stub.restore()

// Fake Timers
const clock = sinon.useFakeTimers()
setTimeout(() => counter++, 1000)
clock.tick(1000)
expect(counter).to.equal(1)
clock.restore()
```

`sinon.sandbox`를 사용하면 여러 스텁/스파이를 `sandbox.restore()`로 한 번에 복원할 수 있어 `afterEach`에 유용합니다.

---

## chai-as-promised로 Promise 검증

```javascript
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const { expect } = chai

it('프로미스 성공', async () => {
  await expect(Promise.resolve(42)).to.eventually.equal(42)
})

it('프로미스 실패', async () => {
  await expect(Promise.reject(new Error('실패'))).to.be.rejectedWith('실패')
})
```

`chai-as-promised` 플러그인은 `chai.use()`로 등록해 `eventually` 체인을 활성화합니다. 비동기 어서션 앞에 반드시 `await`를 붙여야 실제로 평가됩니다.

---

![Mocha + Chai 코드 패턴](/assets/posts/test-mocha-chai-code.svg)

---

## Mocha vs Jest 선택 기준

| 기준 | Mocha + Chai | Jest / Vitest |
|------|-------------|---------------|
| 설정 복잡도 | 라이브러리 조합 필요 | 설정 없이 시작 |
| 유연성 | 각 레이어 교체 용이 | 일체형 |
| ESM 지원 | 복잡 (설정 필요) | 기본 지원 |
| 속도 | 보통 | HMR(Vitest) 빠름 |
| 생태계 | 성숙, Sinon 플러그인 | 내장 Mock 풍부 |
| 적합 환경 | Node.js 백엔드, 레거시 | 프론트엔드, 모노레포 |

---

**지난 글:** [Vitest — Vite 네이티브 테스트 러너 완전 정복](/posts/test-vitest/)

**다음 글:** [Testing Library — 사용자 관점 UI 컴포넌트 테스트](/posts/test-testing-library/)

<br>
읽어주셔서 감사합니다. 😊
