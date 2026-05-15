---
title: "데코레이터 — 클래스와 멤버에 메타데이터 주입"
description: "TypeScript 데코레이터의 종류(클래스·메서드·속성·매개변수), 실행 순서, 데코레이터 팩토리, 로깅·캐시·DI 실전 패턴, Stage 3 표준과 레거시 API 차이를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "데코레이터", "메타데이터", "DI", "AOP", "experimentalDecorators"]
featured: false
draft: false
---

[지난 글](/posts/ts-modules-namespace/)에서 TypeScript 모듈 시스템과 네임스페이스를 살펴봤다. 이번에는 **데코레이터(Decorator)**를 다룬다. 데코레이터는 클래스, 메서드, 속성, 매개변수에 `@expression` 형태로 붙여 추가 동작이나 메타데이터를 주입하는 기능이다. NestJS, Angular, TypeORM 등 주요 프레임워크가 이 패턴을 핵심으로 사용한다.

## 데코레이터 활성화

현재 TypeScript에는 두 가지 데코레이터 API가 공존한다.

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,   // 레거시 (TS < 5.0 기준)
    "emitDecoratorMetadata": true     // reflect-metadata와 함께 사용
  }
}
```

TypeScript 5.0에서는 TC39 Stage 3 표준 데코레이터를 별도 옵션 없이 지원하기 시작했다. NestJS 등 기존 프레임워크는 아직 `experimentalDecorators` 방식을 사용하므로, 사용하는 라이브러리의 문서를 확인해야 한다.

## 클래스 데코레이터

클래스 전체에 적용되며, 생성자 함수를 인수로 받는다.

```typescript
function sealed(constructor: Function) {
  Object.seal(constructor);
  Object.seal(constructor.prototype);
}

function singleton<T extends { new(...args: any[]): {} }>(Base: T) {
  let instance: T;
  return class extends Base {
    constructor(...args: any[]) {
      if (instance) return instance;
      super(...args);
      instance = this as any;
    }
  };
}

@sealed
@singleton
class AppService {
  greet() { return "hello"; }
}
```

![데코레이터 종류](/assets/posts/ts-decorators-types.svg)

## 데코레이터 팩토리

매개변수를 받는 데코레이터는 팩토리 패턴을 사용한다.

```typescript
function log(prefix: string) {
  return function (target: any, key: string, desc: PropertyDescriptor) {
    const original = desc.value;
    desc.value = function (...args: unknown[]) {
      console.log(`[${prefix}] ${key}(${args.join(",")})`);
      const result = original.apply(this, args);
      console.log(`[${prefix}] ${key} => ${result}`);
      return result;
    };
  };
}

class Calculator {
  @log("Calc")
  add(a: number, b: number) { return a + b; }
}
```

## 메서드 데코레이터

`PropertyDescriptor`를 받아 메서드를 래핑한다.

```typescript
function debounce(delay: number) {
  return function (target: any, key: string, desc: PropertyDescriptor) {
    const original = desc.value;
    let timer: ReturnType<typeof setTimeout>;
    desc.value = function (...args: unknown[]) {
      clearTimeout(timer);
      timer = setTimeout(() => original.apply(this, args), delay);
    };
  };
}

class SearchInput {
  @debounce(300)
  handleInput(value: string) {
    this.search(value);
  }
}
```

## 캐시(메모이제이션) 데코레이터

```typescript
function memoize(target: any, key: string, desc: PropertyDescriptor) {
  const cache = new Map<string, unknown>();
  const original = desc.value;
  desc.value = function (arg: string) {
    if (!cache.has(arg)) {
      cache.set(arg, original.call(this, arg));
    }
    return cache.get(arg);
  };
}

class UserService {
  @memoize
  async getUser(id: string): Promise<User> {
    return await fetch(`/users/${id}`).then(r => r.json());
  }
}
```

![실전 데코레이터 패턴](/assets/posts/ts-decorators-class.svg)

## 속성 데코레이터

속성에 적용되며, 유효성 검사 메타데이터를 등록할 때 자주 사용한다.

```typescript
const requiredFields: string[] = [];

function required(target: any, propertyKey: string) {
  requiredFields.push(propertyKey);
}

class CreateUserDto {
  @required name: string = "";
  @required email: string = "";
  age?: number;
}

function validate(obj: any) {
  for (const field of requiredFields) {
    if (!obj[field]) throw new Error(`${field} is required`);
  }
}
```

## 실행 순서

데코레이터가 여러 개일 때 실행 순서는 다음과 같다.

1. 속성·메서드 데코레이터: 위에서 아래로 **평가**, 아래에서 위로 **적용**
2. 클래스 데코레이터: 마지막에 적용

```typescript
@A  // 4. 적용
@B  // 3. 적용
class Example {
  @C  // 1. 속성 먼저 평가·적용
  x = 0;

  @D  // 2. 메서드 평가·적용
  @E
  method() {}
}
// 평가 순서: A → B → C → D → E
// 적용 순서: C → E → D → B → A
```

## TC39 Stage 3 표준 vs 레거시

TypeScript 5.0+에서는 표준 데코레이터 시그니처가 다르다.

```typescript
// 표준 (Stage 3) — experimentalDecorators 없이 동작
function logged<T, Args extends unknown[], Return>(
  target: (this: T, ...args: Args) => Return,
  context: ClassMethodDecoratorContext
) {
  return function (this: T, ...args: Args): Return {
    console.log(`Calling ${String(context.name)}`);
    return target.call(this, ...args);
  };
}
```

기존 NestJS/TypeORM 등은 레거시 API를 사용하므로 혼용에 주의한다. `experimentalDecorators: true`와 표준 데코레이터는 동시에 사용할 수 없다. 다음 글에서는 TypeScript 컴파일러 옵션(`tsconfig.json`)을 체계적으로 살펴본다.

---

**지난 글:** [모듈과 네임스페이스 — TypeScript 코드 구조화](/posts/ts-modules-namespace/)

**다음 글:** [tsconfig 완전 정복 — 컴파일러 옵션 가이드](/posts/ts-tsconfig-options/)

<br>
읽어주셔서 감사합니다. 😊
