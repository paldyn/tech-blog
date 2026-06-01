---
title: "TypeScript 완전 정복 ⑦: 첫 TypeScript 프로그램 작성"
description: "할 일 관리 앱을 TypeScript로 처음부터 작성하며 interface, class, 타입 어노테이션, 컴파일 오류를 직접 경험합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 7
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "첫프로그램", "interface", "class", "타입어노테이션", "실습"]
featured: false
draft: false
---

[지난 글](/posts/ts-playground-repl/)에서 Playground를 통해 TypeScript를 실험해봤다. 이제 직접 TypeScript 프로젝트를 만들어보자. 할 일(Todo) 관리 앱을 처음부터 작성하면서 TypeScript의 핵심 기능을 자연스럽게 익힌다.

## 프로젝트 준비

```bash
mkdir ts-todo
cd ts-todo
npm init -y
npm install --save-dev typescript
npx tsc --init
mkdir src
```

`tsconfig.json`에서 다음 옵션을 설정한다.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true
  }
}
```

## interface로 데이터 구조 정의

TypeScript를 처음 쓸 때 가장 먼저 배우는 것이 `interface`다. 데이터의 형태를 미리 선언해두면 TypeScript가 그 계약을 지키는지 검사한다.

```typescript
// src/todo.ts
interface Todo {
  id: number;
  title: string;
  done: boolean;
  createdAt: Date;
}

interface CreateTodoInput {
  title: string;
}
```

`interface`는 컴파일 후 완전히 사라진다. 순수한 타입 계약 도구다.

## class로 로직 구현

![첫 TypeScript 프로그램: 할 일 관리 앱](/assets/posts/ts-first-program-flow.svg)

```typescript
// src/todo.ts (계속)
class TodoList {
  private todos: Todo[] = [];
  private nextId = 1;  // number로 자동 추론

  add(input: CreateTodoInput): Todo {
    const todo: Todo = {
      id: this.nextId++,
      title: input.title,
      done: false,
      createdAt: new Date(),
    };
    this.todos.push(todo);
    return todo;
  }

  complete(id: number): boolean {
    const todo = this.todos.find(t => t.id === id);
    if (todo === undefined) return false;
    todo.done = true;
    return true;
  }

  delete(id: number): boolean {
    const index = this.todos.findIndex(t => t.id === id);
    if (index === -1) return false;
    this.todos.splice(index, 1);
    return true;
  }

  getAll(): Todo[] {
    return [...this.todos];
  }

  getPending(): Todo[] {
    return this.todos.filter(t => !t.done);
  }

  getCompleted(): Todo[] {
    return this.todos.filter(t => t.done);
  }
}

export { TodoList };
export type { Todo };
```

`private` 접근 제한자를 쓰면 클래스 외부에서 `todos`와 `nextId`에 직접 접근할 수 없다. JavaScript의 프라이버시 관례(`_todos`)와 달리 TypeScript는 컴파일 타임에 이를 강제한다.

## 진입점 작성

```typescript
// src/index.ts
import { TodoList } from "./todo";

const list = new TodoList();

// 할 일 추가
const todo1 = list.add({ title: "TypeScript 배우기" });
const todo2 = list.add({ title: "첫 프로그램 작성" });
const todo3 = list.add({ title: "타입 시스템 이해하기" });

console.log("전체 할 일:", list.getAll());

// 완료 처리
list.complete(todo1.id);
list.complete(todo2.id);

console.log("미완료:", list.getPending());
console.log("완료:", list.getCompleted());

// 삭제
list.delete(todo3.id);
console.log("삭제 후:", list.getAll());
```

## TypeScript가 잡아주는 실수들

![TypeScript가 잡아주는 일반적인 실수들](/assets/posts/ts-first-program-errors.svg)

이 예시에서 발생하는 오류들을 직접 실험해보자.

```typescript
// 오류 1: id를 문자열로 전달
list.complete("1"); // 오류: Argument of type 'string' is not assignable to parameter of type 'number'

// 오류 2: 존재하지 않는 메서드
list.remove(1); // 오류: Property 'remove' does not exist on type 'TodoList'

// 오류 3: find()는 undefined를 반환할 수 있음
const found: Todo = list.getAll().find(t => t.id === 1); // 오류!
// find()의 반환 타입은 Todo | undefined
// 올바른 방법:
const found2 = list.getAll().find(t => t.id === 1);
if (found2 !== undefined) {
  console.log(found2.title); // 안전하게 접근
}

// 오류 4: 읽기 전용 스냅샷 오용
const all = list.getAll(); // [...this.todos] 복사본
// all을 변경해도 원본에 영향 없음 (의도된 설계)
```

## 컴파일하고 실행

```bash
# 컴파일
npx tsc

# 실행
node dist/index.js
```

출력:

```
전체 할 일: [
  { id: 1, title: 'TypeScript 배우기', done: false, createdAt: 2026-06-02T... },
  { id: 2, title: '첫 프로그램 작성', done: false, createdAt: 2026-06-02T... },
  { id: 3, title: '타입 시스템 이해하기', done: false, createdAt: 2026-06-02T... }
]
미완료: [ { id: 3, title: '타입 시스템 이해하기', done: false, ... } ]
완료: [ { id: 1, title: 'TypeScript 배우기', done: true, ... }, ... ]
삭제 후: [ { id: 1, ... }, { id: 2, ... } ]
```

## 타입 추론의 힘

이 예제에서 명시적 타입 어노테이션 없이도 TypeScript가 타입을 추론하는 경우가 여럿 있다.

```typescript
const list = new TodoList();  // list: TodoList
const todo1 = list.add({ title: "TypeScript 배우기" });  // todo1: Todo
const all = list.getAll();  // all: Todo[]
const pending = all.filter(t => !t.done);  // pending: Todo[]
```

TypeScript는 할당 표현식, 함수 반환값, 배열 메서드 결과 등 대부분의 경우에서 타입을 자동으로 추론한다. 모든 변수에 타입을 직접 써야 한다는 것은 오해다.

## 정리

첫 TypeScript 프로그램을 통해 `interface`, `class`, 접근 제한자, 반환 타입, 타입 추론의 기본을 경험했다. TypeScript는 잘못된 인수 타입, 존재하지 않는 메서드 호출, `undefined` 처리 누락 같은 실수를 코딩 중에 잡아준다. 다음 글에서는 TypeScript 개발 경험을 극대화하는 에디터 설정을 다룬다.

---

**지난 글:** [TypeScript Playground 활용](/posts/ts-playground-repl/)

**다음 글:** [에디터 설정: VS Code + TypeScript](/posts/ts-editor-setup/)

<br>
읽어주셔서 감사합니다. 😊
