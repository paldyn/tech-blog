---
title: "Result / Either 타입 — 예외 없는 에러 처리"
description: "예외를 던지는 대신 성공과 실패를 값으로 표현하는 Result(Either) 타입을 TypeScript로 설계합니다. 판별 유니온 기반 정의, ok 분기 강제, map·flatMap 같은 콤비네이터, async와의 결합까지 실무 관점에서 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-17"
archiveOrder: 1
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "Result", "Either", "에러처리", "판별유니온", "함수형"]
featured: false
draft: false
---

[지난 글](/posts/ts-json-parse-typing/)에서 `JSON.parse`의 실패를 `Result`로 감싸 호출자가 분기를 강제로 처리하게 만드는 패턴을 잠깐 봤다. 이번 글은 그 `Result` 타입 자체를 본격적으로 다룬다. 예외를 던지는 대신 성공과 실패를 **값**으로 표현하면, 컴파일러가 에러 처리 누락을 잡아 줄 수 있다. 함수형 언어에서 `Either`라 부르는 이 패턴을 TypeScript의 판별 유니온으로 어떻게 안전하게 구현하는지 살펴본다.

## 예외의 한계: 타입에 드러나지 않는다

`throw`로 던지는 예외는 함수 시그니처 어디에도 나타나지 않는다. 호출하는 쪽은 이 함수가 실패할 수 있는지, 무엇을 던지는지 타입만 봐서는 알 수 없다.

```typescript
function parseAge(s: string): number {
  const n = Number(s);
  if (Number.isNaN(n)) throw new Error("숫자가 아닙니다");
  return n;
}

const age = parseAge(input); // 반환 타입은 그냥 number
// try/catch를 잊어도 컴파일러는 아무 말도 하지 않는다
```

`parseAge`의 타입은 `(s: string) => number`다. 실패 가능성이 타입에서 사라졌으므로, 호출부에서 `try/catch`를 빠뜨려도 컴파일러는 통과시킨다. 게다가 `catch (e)`로 잡은 `e`의 타입은 `unknown`이라, 어떤 에러인지도 보장되지 않는다.

![Result 타입의 흐름](/assets/posts/ts-result-either-type-flow.svg)

## Result 타입 정의하기

핵심 아이디어는 "성공 또는 실패"를 하나의 값으로 묶는 것이다. 판별 유니온을 쓰면 `ok` 필드 하나로 두 경우를 구분할 수 있다.

```typescript
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
```

`ok`와 `err` 헬퍼는 각각 성공·실패 값을 만든다. 이제 `parseAge`를 예외 없이 다시 써 보자. 실패 가능성이 반환 타입 `Result<number, string>`에 그대로 드러난다.

```typescript
function parseAge(s: string): Result<number, string> {
  const n = Number(s);
  if (Number.isNaN(n)) return err("숫자가 아닙니다");
  return ok(n);
}
```

## ok 필드가 강제하는 분기

`Result`의 진짜 가치는 호출부에서 드러난다. `value`에 접근하려면 먼저 `ok`를 확인해야 한다. 그러지 않으면 컴파일 에러다.

```typescript
const r = parseAge(input);

// r.value; // ❌ ok가 false일 때는 value가 없으므로 접근 불가

if (r.ok) {
  console.log(r.value + 1); // ✅ 여기서만 value: number 로 좁혀짐
} else {
  console.error(r.error);   // 실패 처리를 잊을 수 없다
}
```

판별 유니온의 좁히기 덕분에, `r.ok`가 `true`인 블록에서만 `value`가 보이고 `false`인 블록에서만 `error`가 보인다. **에러 처리를 건너뛰는 코드 경로 자체가 타입 시스템에 의해 사라진다.**

## 콤비네이터로 연결하기

`Result`를 매번 `if`로 풀어 쓰면 장황하다. `map`(성공 값 변환)과 `flatMap`(또 다른 `Result`를 반환하는 연산 연결)을 정의하면 실패를 자동으로 전파하면서 성공 경로만 이어 붙일 수 있다.

```typescript
function map<T, U, E>(r: Result<T, E>, f: (v: T) => U): Result<U, E> {
  return r.ok ? ok(f(r.value)) : r;
}

function flatMap<T, U, E>(
  r: Result<T, E>,
  f: (v: T) => Result<U, E>,
): Result<U, E> {
  return r.ok ? f(r.value) : r;
}

const doubled = map(parseAge(input), (n) => n * 2); // Result<number, string>
```

중간 어느 단계에서 실패하면 그 `error`가 그대로 끝까지 흘러간다. 성공일 때만 다음 변환이 적용되므로, 행복 경로(happy path)와 실패 처리가 깔끔하게 분리된다.

![예외 vs Result](/assets/posts/ts-result-either-type-code.svg)

## 비동기와 결합하기

실무에서 실패는 대부분 비동기 작업에서 발생한다. `Promise<Result<T, E>>`로 감싸면, 절대 reject되지 않고 항상 resolve되는 약속이 된다. 호출부는 `try/catch` 없이 `ok`만 확인하면 된다.

```typescript
async function fetchUser(id: string): Promise<Result<User, string>> {
  try {
    const res = await fetch(`/users/${id}`);
    if (!res.ok) return err(`HTTP ${res.status}`);
    return ok((await res.json()) as User);
  } catch {
    return err("네트워크 오류");
  }
}

const r = await fetchUser("1");
if (r.ok) render(r.value);
else toast(r.error);
```

`fetchUser`의 시그니처만 봐도 "이 함수는 `string` 에러로 실패할 수 있다"는 사실이 명확하다. 예외와 달리 실패가 타입에 박혀 있으니, 호출부가 이를 무시할 방법이 없다.

정리하면, `Result`는 ① 실패를 타입에 드러내고 ② `ok` 분기를 강제하며 ③ 콤비네이터로 실패를 자동 전파한다. 모든 곳에 도입할 필요는 없지만, 외부 입력·네트워크·파싱처럼 실패가 일상인 경계에서는 예외보다 훨씬 견고한 계약을 만들어 준다. 다음 글에서는 또 다른 객체 생성 패턴인 빌더를 타입으로 안전하게 강제하는 법을 본다.

---

**지난 글:** [JSON.parse 타이핑 — unknown 기반 안전한 파싱](/posts/ts-json-parse-typing/)

**다음 글:** [빌더 패턴 타이핑 — 타입으로 단계 강제하기](/posts/ts-builder-pattern-typing/)

<br>
읽어주셔서 감사합니다. 😊
