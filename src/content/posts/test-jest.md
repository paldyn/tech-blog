---
title: "Jest — JavaScript 테스트 프레임워크 완전 정복"
description: "Jest의 격리된 병렬 실행 아키텍처, jest.config.ts 설정, describe/test/expect, 생명주기 훅, jest.fn()·spyOn·모듈 모킹, 비동기 테스트, 커버리지 리포트, TypeScript·SWC 통합까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 10
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Jest", "테스트", "단위테스트", "Mock", "TDD", "테스트프레임워크", "TypeScript"]
featured: false
draft: false
---

[지난 글](/posts/build-code-splitting/)에서 코드 스플리팅의 청킹 전략을 살펴봤습니다. 이번부터는 **테스트** 시리즈를 시작합니다. 첫 주제는 JavaScript 생태계에서 가장 널리 쓰이는 테스트 프레임워크 **Jest**입니다. Jest는 메타(구 Facebook)가 만들고 오픈소스로 관리합니다. 설정 없이 바로 쓸 수 있는 올인원 설계(Test Runner + Assertion + Mock + Coverage)가 장점입니다.

## Jest 아키텍처

Jest는 테스트 파일마다 **독립된 Node.js vm 컨텍스트**에서 실행합니다. 전역 상태 오염이 없고, CPU 코어 수만큼 병렬 실행합니다.

![Jest 아키텍처 — 격리된 병렬 실행](/assets/posts/test-jest-architecture.svg)

```bash
npm install --save-dev jest @types/jest
```

## jest.config.ts 기본 설정

```ts
// jest.config.ts
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',                  // TypeScript 변환
  testEnvironment: 'node',            // 또는 'jsdom' (브라우저 API)
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',   // 경로 별칭
  },
  clearMocks: true,                   // 각 테스트 전 mock 초기화
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
};

export default config;
```

### SWC로 빠른 변환 (권장)

```bash
npm install --save-dev @swc/core @swc/jest
```

```ts
// jest.config.ts — SWC 사용
transform: {
  '^.+\\.(t|j)sx?$': ['@swc/jest'],
},
```

## 기본 테스트 구조

```ts
// src/__tests__/math.test.ts
import { add, subtract } from '../math';

describe('수학 함수', () => {
  test('add: 두 수를 더한다', () => {
    expect(add(2, 3)).toBe(5);
    expect(add(-1, 1)).toBe(0);
  });

  test('subtract: 두 수를 뺀다', () => {
    expect(subtract(5, 3)).toBe(2);
  });

  test.todo('곱하기 테스트 추가 예정');
  test.skip('이 테스트는 현재 건너뜀', () => { /* ... */ });
});
```

## Matcher와 Mock API

![Jest 핵심 Matcher & Mock API](/assets/posts/test-jest-matchers.svg)

### 자주 쓰는 Matcher

```ts
// 깊은 비교 (객체, 배열)
expect({ a: 1, b: [1, 2] }).toEqual({ a: 1, b: [1, 2] });

// 부분 일치
expect({ a: 1, b: 2 }).toMatchObject({ a: 1 });
expect(['a', 'b', 'c']).toEqual(expect.arrayContaining(['b', 'c']));

// 숫자 근사값
expect(0.1 + 0.2).toBeCloseTo(0.3, 5);

// 에러 타입
expect(() => JSON.parse('invalid')).toThrow(SyntaxError);
```

## 비동기 테스트

```ts
// 1. async/await — 권장
test('사용자 조회', async () => {
  const user = await fetchUser(1);
  expect(user.name).toBe('Alice');
});

// 2. resolves / rejects matcher
test('Promise 성공', async () => {
  await expect(fetchUser(1)).resolves.toEqual({ id: 1, name: 'Alice' });
});

test('Promise 실패', async () => {
  await expect(fetchUser(-1)).rejects.toThrow('User not found');
});

// 3. done 콜백 (레거시, 권장하지 않음)
test('콜백 스타일', (done) => {
  fetchUserCallback(1, (err, user) => {
    expect(user.name).toBe('Alice');
    done();
  });
});
```

## Mock 완전 이해

### jest.fn() — 함수 대역

```ts
const sendEmail = jest.fn();

// 반환값 설정
sendEmail.mockReturnValue(true);
sendEmail.mockReturnValueOnce(false); // 첫 호출만 false

// 비동기 반환
sendEmail.mockResolvedValue({ sent: true });

// 구현 대체
sendEmail.mockImplementation((to) => {
  if (!to.includes('@')) throw new Error('Invalid email');
  return true;
});

// 호출 검증
expect(sendEmail).toHaveBeenCalledTimes(1);
expect(sendEmail).toHaveBeenCalledWith('user@example.com');
expect(sendEmail).toHaveBeenLastCalledWith('admin@example.com');
```

### jest.spyOn() — 실제 구현 유지 + 감시

```ts
import * as fs from 'fs';

test('파일 읽기 감시', () => {
  const spy = jest.spyOn(fs, 'readFileSync')
    .mockReturnValue('mocked content');

  const result = readConfig('./config.json');
  expect(result).toBe('mocked content');
  expect(spy).toHaveBeenCalledWith('./config.json');

  spy.mockRestore(); // 원본 복원
});
```

### 모듈 모킹

```ts
// 모듈 전체 모킹 (파일 최상위에 위치해야 함)
jest.mock('../api/userService');

import { fetchUser } from '../api/userService';
// fetchUser는 자동으로 jest.fn()이 됨

test('컴포넌트가 사용자를 표시한다', async () => {
  (fetchUser as jest.Mock).mockResolvedValue({ id: 1, name: 'Alice' });

  // 테스트 코드...
  expect(fetchUser).toHaveBeenCalledWith(1);
});
```

### 타이머 모킹

```ts
test('debounce 함수 테스트', () => {
  jest.useFakeTimers();
  const fn = jest.fn();
  const debounced = debounce(fn, 500);

  debounced();
  debounced();
  expect(fn).not.toHaveBeenCalled();

  jest.advanceTimersByTime(500);
  expect(fn).toHaveBeenCalledTimes(1);

  jest.useRealTimers();
});
```

## 생명주기 훅

```ts
describe('DB 테스트', () => {
  let db: Database;

  beforeAll(async () => {
    db = await Database.connect(':memory:');
    await db.runMigrations();
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    await db.clear();           // 각 테스트 전 상태 초기화
    await db.seed(testData);
  });

  test('사용자 생성', async () => {
    const user = await db.users.create({ name: 'Alice' });
    expect(user.id).toBeDefined();
  });
});
```

## 스냅샷 테스트

```ts
test('컴포넌트 렌더링 스냅샷', () => {
  const component = renderToString(<Button label="Click me" />);
  expect(component).toMatchSnapshot();
  // → __snapshots__/Button.test.ts.snap 파일 생성
});
```

스냅샷이 바뀌면 `jest --updateSnapshot` 또는 `jest -u`로 갱신합니다.

## 커버리지 리포트

```bash
jest --coverage

# 출력
# PASS src/math.test.ts
# ----------|---------|----------|---------|---------|
# File      | % Stmts | % Branch | % Funcs | % Lines |
# ----------|---------|----------|---------|---------|
# math.ts   |   100   |    100   |   100   |   100   |
```

```bash
# HTML 리포트 생성
jest --coverage --coverageReporters=html
open coverage/lcov-report/index.html
```

## 자주 쓰는 CLI 옵션

```bash
jest                          # 전체 실행
jest --watch                  # 변경 감지 실행
jest src/user                 # 파일 필터
jest -t "사용자 조회"          # 테스트 이름 필터
jest --runInBand               # 직렬 실행 (디버깅)
jest --maxWorkers=2            # 워커 수 제한
jest --verbose                 # 각 테스트 결과 출력
jest --bail                    # 첫 실패 시 중단
```

---

**지난 글:** [코드 스플리팅 심층 분석 — 최적 청킹 전략](/posts/build-code-splitting/)

<br>
읽어주셔서 감사합니다. 😊
