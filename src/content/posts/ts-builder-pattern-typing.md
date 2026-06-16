---
title: "빌더 패턴 타이핑 — 타입으로 단계 강제하기"
description: "객체를 단계적으로 조립하는 빌더 패턴을 TypeScript로 타입 안전하게 구현합니다. 제네릭으로 채워진 키를 추적해 필수 필드 누락을 컴파일 단계에서 막고, this 타입과 메서드 체이닝으로 build() 호출 가능 시점을 제어하는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-17"
archiveOrder: 2
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "빌더패턴", "제네릭", "메서드체이닝", "디자인패턴"]
featured: false
draft: false
---

[지난 글](/posts/ts-result-either-type/)에서 성공과 실패를 값으로 다루는 `Result` 타입을 만들었다. 이번 글은 객체 **생성** 쪽으로 시선을 옮긴다. 필드가 많고 일부가 필수인 객체를 만들 때 흔히 쓰는 빌더 패턴을, 단순한 편의 도구가 아니라 "필수 필드를 빠뜨리면 컴파일이 안 되는" 안전장치로 끌어올리는 방법을 본다. 핵심은 제네릭으로 **지금까지 채운 키**를 타입 수준에서 추적하는 것이다.

## 평범한 빌더의 구멍

가장 흔한 빌더는 각 `set` 메서드가 `this`를 반환해 체이닝을 가능하게 한다. 편리하지만, 필수 필드를 빠뜨려도 `build()`가 그냥 통과한다.

```typescript
interface Config {
  host: string;
  port: number;
  tls: boolean;
}

class NaiveBuilder {
  private cfg: Partial<Config> = {};
  set<K extends keyof Config>(k: K, v: Config[K]): this {
    this.cfg[k] = v;
    return this;
  }
  build(): Config {
    return this.cfg as Config; // 거짓 단언 — 누락을 숨긴다
  }
}

new NaiveBuilder().set("host", "x").build(); // port·tls 없이 통과
```

`build()` 안의 `as Config`가 모든 안전성을 무너뜨린다. 실제로는 `Partial<Config>`인데 컴파일러에게 완성됐다고 거짓말하는 셈이다. 런타임에서 `port`가 `undefined`로 새어 나간다.

![타입 안전 빌더](/assets/posts/ts-builder-pattern-typing-flow.svg)

## 채워진 키를 제네릭으로 추적

해법은 "지금까지 어떤 키를 채웠는지"를 제네릭 타입 파라미터 `Filled`에 누적하는 것이다. `set`을 호출할 때마다 반환되는 빌더의 타입에 그 키가 더해진다.

```typescript
class Builder<Filled extends keyof Config = never> {
  private cfg: Partial<Config> = {};

  set<K extends keyof Config>(
    k: K,
    v: Config[K],
  ): Builder<Filled | K> {
    this.cfg[k] = v;
    return this as Builder<Filled | K>;
  }
}
```

처음에는 `Filled`가 `never`(채운 키 없음)다. `.set("host", ...)`를 호출하면 반환 타입이 `Builder<"host">`가 되고, 이어서 `.set("port", ...)`를 부르면 `Builder<"host" | "port">`로 누적된다. 타입이 빌더의 진행 상태를 그대로 따라간다.

![제네릭으로 채워진 키 추적](/assets/posts/ts-builder-pattern-typing-code.svg)

## this 타입으로 build()를 잠그기

이제 `build()`를 모든 키가 채워졌을 때만 호출 가능하게 만든다. 메서드의 `this` 파라미터에 "모든 키가 채워진 빌더"라는 조건을 건다.

```typescript
class Builder<Filled extends keyof Config = never> {
  private cfg: Partial<Config> = {};

  set<K extends keyof Config>(k: K, v: Config[K]): Builder<Filled | K> {
    this.cfg[k] = v;
    return this as Builder<Filled | K>;
  }

  build(this: Builder<keyof Config>): Config {
    return this.cfg as Config;
  }
}
```

`build(this: Builder<keyof Config>)`는 "`Filled`가 `Config`의 모든 키를 포함할 때"만 호출을 허용한다. 하나라도 빠지면 `this` 타입이 맞지 않아 컴파일 에러가 난다.

```typescript
new Builder()
  .set("host", "localhost")
  .build(); // ❌ port·tls 누락 — build 호출 불가

new Builder()
  .set("host", "localhost")
  .set("port", 5432)
  .set("tls", true)
  .build(); // ✅ 모든 키 채워짐 — Config 반환
```

이제 빌더는 단순한 편의 문법이 아니라 **계약**이다. 필수 필드를 빠뜨린 채 객체를 완성하려는 시도는 IDE에서 빨간 줄로, 빌드에서 에러로 즉시 막힌다.

## 한 걸음 더: 같은 키 두 번 막기

같은 키를 두 번 설정하는 실수도 타입으로 막을 수 있다. `set`의 키 파라미터를 `Exclude<keyof Config, Filled>`로 제한하면, 이미 채운 키는 자동완성 목록에서 사라진다.

```typescript
set<K extends Exclude<keyof Config, Filled>>(
  k: K,
  v: Config[K],
): Builder<Filled | K> {
  this.cfg[k] = v;
  return this as Builder<Filled | K>;
}
// 이미 host를 채웠다면, 다음 .set()에서 "host"는 제안되지 않는다
```

정리하면, 타입 안전 빌더의 핵심은 ① 채운 키를 제네릭에 누적하고 ② `this` 타입으로 완성 시점을 잠그며 ③ 필요하면 중복 설정까지 차단하는 것이다. 객체의 "조립 중" 상태와 "완성" 상태를 타입으로 구분하는 이 발상은 다음 글에서 다룰 상태 머신 타이핑과 정확히 같은 뿌리를 갖는다.

---

**지난 글:** [Result / Either 타입 — 예외 없는 에러 처리](/posts/ts-result-either-type/)

**다음 글:** [상태 머신 타이핑 — 불가능한 상태를 제거하기](/posts/ts-state-machine-typing/)

<br>
읽어주셔서 감사합니다. 😊
