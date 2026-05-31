---
title: "TypeScript로 첫 번째 프로그램 작성하기"
description: "할 일 관리 앱을 예시로 TypeScript로 첫 번째 실용적인 프로그램을 단계별로 작성합니다. interface, 타입 애너테이션, 오류 메시지 읽기까지 실습 중심으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 7
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "첫프로그램", "interface", "실습", "타입애너테이션"]
featured: false
draft: false
---

[지난 글](/posts/ts-playground-repl/)에서 TypeScript Playground로 코드를 실험하는 법을 배웠다. 이번에는 로컬 환경에서 TypeScript로 실제 프로그램을 처음부터 작성해 본다. 간단한 할 일 관리 앱을 예제로 삼아 TypeScript의 기본 개념을 모두 체험한다.

## 프로젝트 초기화

먼저 프로젝트를 만들고 TypeScript를 설치한다.

```bash
mkdir todo-ts && cd todo-ts
npm init -y
npm install --save-dev typescript
npx tsc --init
mkdir src
```

`tsconfig.json` 을 다음과 같이 편집한다.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true
  },
  "include": ["src"]
}
```

## 첫 번째 TypeScript 파일

`src/index.ts` 를 만들고 할 일 앱의 핵심 로직을 작성한다.

```typescript
// Task 데이터 구조 정의
interface Task {
  id: number;
  title: string;
  done: boolean;
  createdAt: Date;
}

// 할 일 목록 상태 (순수 함수로 관리)
function addTask(tasks: Task[], title: string): Task[] {
  const newTask: Task = {
    id: tasks.length + 1,
    title,
    done: false,
    createdAt: new Date(),
  };
  return [...tasks, newTask];
}

function completeTask(tasks: Task[], id: number): Task[] {
  return tasks.map(task =>
    task.id === id ? { ...task, done: true } : task
  );
}

function getPending(tasks: Task[]): Task[] {
  return tasks.filter(task => !task.done);
}

// 실행
let tasks: Task[] = [];
tasks = addTask(tasks, "TypeScript 설치하기");
tasks = addTask(tasks, "첫 번째 프로그램 작성하기");
tasks = completeTask(tasks, 1);

console.log("미완료 할 일:");
getPending(tasks).forEach(task => {
  console.log(`  [${task.id}] ${task.title}`);
});
```

![첫 번째 TypeScript 프로그램 구조](/assets/posts/ts-first-program-structure.svg)

## 컴파일과 실행

```bash
npx tsc            # TypeScript → JavaScript 컴파일
node dist/index.js  # 실행
```

출력:
```
미완료 할 일:
  [2] 첫 번째 프로그램 작성하기
```

## 타입이 없으면 어떤 오류가 나오나

`addTask` 함수의 `title` 매개변수에서 타입을 제거해 보자.

```typescript
// strict 모드에서 타입 없는 매개변수는 오류
function addTask(tasks: Task[], title) { // ← title에 빨간 밑줄
```

```
error TS7006: Parameter 'title' implicitly has an 'any' type.
```

이것이 `strict: true` 가 켜졌을 때 TypeScript가 강제하는 규칙이다. 매개변수에 타입을 명시하지 않으면 컴파일을 거부한다.

## 잘못된 타입 사용 실험

`completeTask` 를 잘못 호출해 보자.

```typescript
tasks = completeTask(tasks, "1"); // id는 number인데 string 전달
```

```
error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
```

JavaScript라면 이 코드가 아무 오류 없이 실행되다가 나중에 `id === 1` 비교에서 `"1" === 1` 이 `false` 로 평가되어 완료 처리가 안 되는 조용한 버그가 생긴다. TypeScript는 이를 컴파일 시점에 잡아 준다.

## 오류 메시지 읽는 법

TypeScript 오류 메시지는 처음에 낯설어 보이지만 패턴이 있다.

![TypeScript 오류 메시지 읽는 법](/assets/posts/ts-first-program-errors.svg)

- **TS 오류 코드** (예: `TS2322`) — 어떤 종류의 오류인지 분류
- **파일과 줄 번호** — 어디에서 오류가 났는지
- **오류 메시지** — 무엇이 문제인지 설명

처음에는 메시지가 길어 보이지만 핵심은 항상 "어떤 타입을 기대했는데 다른 타입이 들어왔다"는 내용이다.

## interface vs 단순 객체

JavaScript에서는 데이터 구조를 그냥 객체로 쓰는 경우가 많다. TypeScript에서는 `interface` 로 구조를 명시적으로 정의하는 것이 표준이다.

```typescript
// JavaScript 방식 — 구조 파악이 어려움
function process(task) {
  return task.done ? "완료" : task.title;
}

// TypeScript 방식 — 구조가 명확
function process(task: Task): string {
  return task.done ? "완료" : task.title;
}
```

`interface` 로 정의된 `Task` 가 있으면 IDE가 `task.` 를 입력하는 순간 `id`, `title`, `done`, `createdAt` 을 자동 완성으로 제안한다.

## package.json 스크립트 추가

자주 쓰는 명령을 `package.json` 에 추가하면 편하다.

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsc && node dist/index.js"
  }
}
```

```bash
npm run dev  # 컴파일 후 바로 실행
```

첫 번째 TypeScript 프로그램이 완성됐다. 다음 글에서는 VS Code를 중심으로 TypeScript 개발에 최적화된 에디터 환경을 구성한다.

---

**지난 글:** [TypeScript Playground — 브라우저에서 바로 실험하기](/posts/ts-playground-repl/)

**다음 글:** [TypeScript 에디터 환경 최적화 — VS Code 설정](/posts/ts-editor-setup/)

<br>
읽어주셔서 감사합니다. 😊
