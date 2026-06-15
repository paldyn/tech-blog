---
title: "TypeScript 에러 핸들링 — unknown catch와 타입 안전한 예외 처리"
description: "TypeScript의 catch 절이 unknown인 이유, useUnknownInCatchVariables, instanceof와 타입 가드로 에러를 좁히는 법, Error 상속 커스텀 에러, 그리고 throw 대신 결과 타입으로 처리하는 패턴까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 2
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "에러처리", "예외", "unknown", "타입가드", "Error"]
featured: false
draft: false
---

[지난 글](/posts/ts-typing-async/)에서 비동기 코드의 타이핑을 다뤘다. 비동기든 동기든 코드에는 반드시 **실패 경로**가 따른다. 이번 글에서는 TypeScript가 예외를 어떻게 타이핑하는지, 그리고 `try/catch`를 타입 안전하게 다루는 방법을 정리한다. JavaScript는 "무엇이든 throw할 수 있는" 언어라서, 타입 시스템도 이 자유를 어떻게 제약할지가 핵심이 된다.

## catch 절의 변수는 unknown이다

JavaScript에서는 `throw "문자열"`, `throw 42`, `throw { code: 1 }`처럼 **어떤 값이든** 던질 수 있다. 따라서 `catch`로 잡은 값이 `Error`라는 보장이 없다. TypeScript 4.4부터 `useUnknownInCatchVariables`(strict 모드에 포함)가 켜지면 catch 변수의 타입은 `unknown`이다.

```typescript
try {
  riskyOperation();
} catch (e) {
  // e: unknown
  console.log(e.message); // ❌ 오류: unknown에는 message가 없음
}
```

`unknown`이기 때문에 곧바로 `.message`에 접근할 수 없다. 이것은 불편이 아니라 **안전장치**다. 던져진 값이 정말 `Error`인지 확인하기 전에는 그 속성을 믿을 수 없다.

![catch 절의 타입은 unknown](/assets/posts/ts-error-handling-flow.svg)

## instanceof로 좁히기

가장 흔한 방법은 `instanceof Error`로 타입을 좁히는 것이다. 좁혀진 블록 안에서는 `Error`의 속성에 안전하게 접근할 수 있다.

```typescript
try {
  await getUser(1);
} catch (e) {
  if (e instanceof Error) {
    console.error(e.message); // ✅ e: Error
  } else {
    console.error("알 수 없는 오류:", String(e));
  }
}
```

`String(e)`는 어떤 값이든 문자열로 변환하므로, `Error`가 아닌 경우의 안전한 폴백이 된다. 핵심은 **모든 경로를 처리**하는 것이다.

![unknown catch 안전 처리](/assets/posts/ts-error-handling-code.svg)

## 커스텀 에러와 판별

도메인별로 에러를 구분하려면 `Error`를 상속한 클래스를 만든다. `instanceof`로 종류를 구분할 수 있고, `name` 필드로 직렬화 시에도 식별된다.

```typescript
class NotFoundError extends Error {
  constructor(public readonly id: number) {
    super(`리소스 ${id}를 찾을 수 없습니다`);
    this.name = "NotFoundError";
  }
}

try {
  await getUser(1);
} catch (e) {
  if (e instanceof NotFoundError) {
    console.log("없는 사용자 ID:", e.id);
  } else if (e instanceof Error) {
    console.error(e.message);
  }
}
```

`super(...)`로 메시지를 부모에 넘기고, `this.name`을 클래스 이름으로 맞추는 것이 관례다. `id` 같은 추가 정보를 필드로 담으면 잡는 쪽에서 구조적으로 활용할 수 있다.

## 재사용 가능한 에러 변환 헬퍼

`unknown`을 `Error`로 정규화하는 작은 헬퍼를 두면 catch 블록이 깔끔해진다.

```typescript
function toError(e: unknown): Error {
  if (e instanceof Error) return e;
  return new Error(typeof e === "string" ? e : JSON.stringify(e));
}

try {
  doWork();
} catch (e) {
  const err = toError(e);
  logger.error(err.message, { stack: err.stack });
}
```

이제 어디서 잡든 항상 `Error` 인스턴스를 손에 쥘 수 있다. 로깅·모니터링 코드가 단일 타입만 가정하면 되므로 유지보수가 쉬워진다.

## throw 대신 결과 타입으로

예외는 제어 흐름을 끊고, 타입 시그니처에 드러나지 않는다는 단점이 있다. 실패가 "예외적"이 아니라 "정상적인 분기"라면, 던지는 대신 결과를 값으로 반환하는 패턴이 더 명시적이다.

```typescript
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

async function fetchUser(id: number): Promise<Result<User>> {
  try {
    const res = await fetch(`/users/${id}`);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, value: await res.json() };
  } catch (e) {
    return { ok: false, error: toError(e).message };
  }
}

const r = await fetchUser(1);
if (r.ok) console.log(r.value); // 타입이 강제하는 분기 처리
else console.error(r.error);
```

`Result<T>` 같은 판별 유니온은 호출자가 **실패 처리를 잊을 수 없게** 만든다. `r.value`에 접근하려면 먼저 `r.ok`를 확인해야 하기 때문이다. 이 패턴은 시리즈 뒤쪽의 `Result/Either` 타입에서 더 깊이 다룬다.

요약하면, TypeScript의 에러 처리는 "catch는 `unknown`이다"라는 사실에서 출발한다. 좁히기(`instanceof`)와 정규화(헬퍼)로 안전하게 다루고, 실패가 일상적이라면 결과 타입으로 표현하라. 다음 글에서는 코드 품질이 아니라 **빌드 속도** — TypeScript 컴파일 성능을 끌어올리는 방법을 살펴본다.

---

**지난 글:** [async/await와 Promise 타이핑 — 비동기 코드의 타입](/posts/ts-typing-async/)

**다음 글:** [TypeScript 빌드 성능 최적화 — 컴파일 속도 끌어올리기](/posts/ts-build-performance/)

<br>
읽어주셔서 감사합니다. 😊
