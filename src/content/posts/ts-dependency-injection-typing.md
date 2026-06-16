---
title: "의존성 주입 타이핑 — 토큰과 컨테이너 설계"
description: "의존성 주입(DI) 컨테이너를 TypeScript로 타입 안전하게 설계합니다. 타입을 실은 InjectionToken, resolve의 타입 추론, 인터페이스 기반 느슨한 결합, 생성자 주입과 팩토리 등록까지 프레임워크 없이 핵심 원리를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-17"
archiveOrder: 4
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "의존성주입", "DI", "제네릭", "토큰", "아키텍처"]
featured: false
draft: false
---

[지난 글](/posts/ts-state-machine-typing/)에서 상태를 타입으로 닫아 모순을 없앴다. 이번 글은 객체들 사이의 **연결**을 타입으로 다룬다. 의존성 주입(DI)은 객체가 자신의 의존성을 직접 만들지 않고 외부에서 받도록 하는 설계 원칙이다. 문제는 컨테이너에서 의존성을 꺼낼 때 흔히 타입 정보가 사라진다는 것이다. 이번 글은 프레임워크 없이, 타입을 실은 토큰으로 `resolve`의 반환 타입을 정확히 추론시키는 방법을 본다.

## 직접 생성의 문제

객체가 자기 의존성을 직접 `new`로 만들면, 강하게 결합되어 교체와 테스트가 어렵다.

```typescript
class UserService {
  private repo = new PostgresUserRepo(); // 구현에 직접 묶임
  // 테스트에서 가짜 repo로 바꿀 수 없다
}
```

`UserService`가 `PostgresUserRepo`를 직접 생성하므로, 테스트에서 인메모리 구현으로 바꾸거나 다른 DB로 교체하려면 클래스 본문을 고쳐야 한다. 의존성을 **밖에서 받도록** 뒤집어야 한다.

## 인터페이스로 느슨하게 결합

먼저 의존성을 인터페이스로 추상화하고, 구현이 아니라 인터페이스에 의존하게 만든다.

```typescript
interface UserRepo {
  findById(id: string): Promise<User | null>;
}

class UserService {
  constructor(private repo: UserRepo) {} // 인터페이스에만 의존
}

// 운영: new UserService(new PostgresUserRepo())
// 테스트: new UserService(new InMemoryUserRepo())
```

생성자 주입으로 바꾸자 `UserService`는 `UserRepo`라는 계약만 알면 된다. 구현 교체가 호출부의 한 줄로 끝난다. 이제 이 연결을 손으로 일일이 하지 않도록 컨테이너를 만든다.

![DI 컨테이너 타이핑](/assets/posts/ts-dependency-injection-typing-flow.svg)

## 타입을 실은 토큰

컨테이너의 핵심 난관은 "문자열 키로 등록하면 타입이 사라진다"는 점이다. 해법은 토큰 객체에 제네릭으로 타입을 실어 두는 것이다.

```typescript
class Token<T> {
  // phantom 타입: 런타임 값은 id뿐이지만 타입 T를 보유한다
  declare readonly _type: T;
  constructor(public readonly id: string) {}
}

const RepoToken = new Token<UserRepo>("UserRepo");
const LoggerToken = new Token<ILogger>("Logger");
```

`Token<T>`는 런타임에는 그냥 `id` 문자열을 가진 객체지만, 타입 수준에서는 `T`를 품고 있다. `_type` 필드는 실제로 값을 갖지 않는 phantom 필드로, 컴파일러가 토큰마다 다른 타입을 구별하게 해 준다.

![토큰에 타입을 실어 추론시키기](/assets/posts/ts-dependency-injection-typing-code.svg)

## resolve가 타입을 되돌려준다

이제 컨테이너의 `register`와 `resolve`를 토큰의 `T`에 묶으면, 꺼낼 때 정확한 타입이 추론된다.

```typescript
class Container {
  private factories = new Map<string, () => unknown>();

  register<T>(token: Token<T>, factory: () => T): void {
    this.factories.set(token.id, factory);
  }

  resolve<T>(token: Token<T>): T {
    const factory = this.factories.get(token.id);
    if (!factory) throw new Error(`미등록: ${token.id}`);
    return factory() as T;
  }
}

const c = new Container();
c.register(RepoToken, () => new PostgresUserRepo());

const repo = c.resolve(RepoToken); // 타입: UserRepo — 추론됨!
```

`resolve(RepoToken)`의 반환 타입이 `UserRepo`로 정확히 추론된다. 토큰의 제네릭 `T`가 `register`의 팩토리 반환 타입과 `resolve`의 결과 타입을 동시에 고정하므로, 등록과 사용 사이에 타입 불일치가 끼어들 수 없다.

## 팩토리에서 다른 의존성 끌어오기

실무에서는 한 의존성이 또 다른 의존성을 필요로 한다. 팩토리 안에서 컨테이너를 다시 `resolve`하면 그래프가 자연스럽게 조립된다.

```typescript
const ServiceToken = new Token<UserService>("UserService");

c.register(ServiceToken, () => new UserService(c.resolve(RepoToken)));

const service = c.resolve(ServiceToken); // UserService, repo 주입 완료
```

`UserService`를 만들 때 필요한 `UserRepo`를 팩토리 안에서 다시 꺼내 주입한다. 각 단계가 타입 검사를 받으므로, 엉뚱한 의존성을 끼워 넣으면 컴파일에서 걸린다.

정리하면, 타입 안전 DI의 핵심은 ① 인터페이스로 느슨하게 결합하고 ② 타입을 실은 토큰으로 키와 타입을 묶으며 ③ `resolve`가 그 타입을 그대로 되돌려주게 하는 것이다. NestJS·tsyringe 같은 프레임워크도 결국 이 원리 위에 데코레이터와 메타데이터를 얹은 것이다. 다음 글에서는 애플리케이션 경계의 또 다른 외부 입력, 환경 변수를 타입 안전하게 다루는 법을 본다.

---

**지난 글:** [상태 머신 타이핑 — 불가능한 상태를 제거하기](/posts/ts-state-machine-typing/)

**다음 글:** [환경 변수 타이핑 — process.env 안전하게 다루기](/posts/ts-typed-env-vars/)

<br>
읽어주셔서 감사합니다. 😊
