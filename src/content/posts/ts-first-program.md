---
title: "첫 TypeScript 프로그램 작성하기"
description: "실제 로컬 환경에서 TypeScript 파일을 만들고, 인터페이스와 함수에 타입을 추가하고, tsc로 컴파일해서 Node.js로 실행하는 전체 흐름을 처음부터 함께 따라합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 7
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "첫프로그램", "interface", "함수", "실습", "Node.js"]
featured: false
draft: false
---

[지난 글](/posts/ts-playground-repl/)에서 TypeScript Playground로 브라우저에서 실험했습니다. 이번 글에서는 로컬 환경에서 첫 TypeScript 프로그램을 처음부터 작성하고 실행해 봅니다.

## 프로젝트 준비

이전 글에서 만든 TypeScript 환경을 사용합니다. 없다면 아래 명령으로 빠르게 준비하세요.

```bash
mkdir my-first-ts && cd my-first-ts
npm init -y
npm install --save-dev typescript @types/node
npx tsc --init
mkdir src
```

`tsconfig.json`의 `strict: true`가 설정되어 있는지 확인합니다.

## 첫 번째 파일: 사용자 관리 모듈

`src/index.ts` 파일을 만들고 아래 코드를 작성합니다.

![첫 TypeScript 프로그램 해부](/assets/posts/ts-first-program-anatomy.svg)

```typescript
// src/index.ts

// ① 인터페이스로 데이터 구조 정의
interface User {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user" | "guest";
}

// ② 함수 타입 주석
function greetUser(user: User): string {
  return `안녕하세요, ${user.name}님! (역할: ${user.role})`;
}

function isAdmin(user: User): boolean {
  return user.role === "admin";
}

// ③ 타입이 있는 변수
const alice: User = {
  id: 1,
  name: "Alice",
  email: "alice@example.com",
  role: "admin",
};

const bob: User = {
  id: 2,
  name: "Bob",
  email: "bob@example.com",
  role: "user",
};

// ④ 배열 타입
const users: User[] = [alice, bob];

// ⑤ 실행
users.forEach((user) => {
  console.log(greetUser(user));
  if (isAdmin(user)) {
    console.log(`  → ${user.name}은(는) 관리자입니다.`);
  }
});
```

## 컴파일 후 실행

![빌드 및 실행 흐름](/assets/posts/ts-first-program-flow.svg)

```bash
# TypeScript → JavaScript 컴파일
npx tsc

# dist/index.js 생성됨
node dist/index.js
```

출력:
```
안녕하세요, Alice님! (역할: admin)
  → Alice은(는) 관리자입니다.
안녕하세요, Bob님! (역할: user)
```

## 타입 오류를 직접 만들어보기

TypeScript의 진가를 느끼려면 의도적으로 오류를 만들어봐야 합니다.

```typescript
// 잘못된 role 값 — 컴파일 타임 오류
const charlie: User = {
  id: 3,
  name: "Charlie",
  email: "charlie@example.com",
  role: "superuser", // TS2322: '"superuser"'는 '"admin" | "user" | "guest"'에 할당 불가
};

// 속성 누락 — 컴파일 타임 오류
const dave: User = {
  id: 4,
  name: "Dave",
  // email 누락: TS2322: Property 'email' is missing in type '...'
  role: "user",
};

// 잘못된 인자 타입 — 컴파일 타임 오류
greetUser("hello");
// TS2345: Argument of type 'string' is not assignable to parameter of type 'User'
```

이 오류들은 모두 코드를 실행하기 전에 발견됩니다.

## ts-node로 빠르게 실행

개발 중에는 컴파일 없이 직접 TypeScript를 실행할 수 있습니다.

```bash
npm install --save-dev ts-node

# 컴파일 없이 바로 실행
npx ts-node src/index.ts
```

또는 `package.json`에 스크립트를 추가합니다.

```json
{
  "scripts": {
    "dev": "ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

## 다음 단계

이제 TypeScript로 코드를 작성하고 실행하는 기본 흐름을 알았습니다. 앞으로 배울 내용들이 이 기반 위에서 쌓입니다. 인터페이스를 더 복잡하게 정의하는 방법, 제네릭으로 재사용성 높이는 방법, 유니온 타입으로 분기 처리하는 방법 등을 하나씩 다뤄갑니다.

---

**지난 글:** [TypeScript Playground로 빠르게 배우기](/posts/ts-playground-repl/)

**다음 글:** [VS Code + TypeScript 에디터 설정](/posts/ts-editor-setup/)

<br>
읽어주셔서 감사합니다. 😊
