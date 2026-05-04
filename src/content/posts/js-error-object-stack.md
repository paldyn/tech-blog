---
title: "Error 객체와 스택 트레이스 — 구조와 활용"
description: "JavaScript Error 객체의 프로퍼티(name, message, stack, cause)와 스택 트레이스를 읽고 활용하는 방법, 직렬화 주의사항을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Error", "스택트레이스", "stack", "cause", "에러처리", "로깅"]
featured: false
draft: false
---

[지난 글](/posts/js-throw-try-catch/)에서 `throw`와 `try/catch/finally`의 동작 원리를 살펴봤습니다. 이번에는 실제로 던져지는 `Error` 객체의 내부 구조와 스택 트레이스를 효과적으로 활용하는 방법을 알아봅니다.

## Error 객체의 표준 프로퍼티

`new Error('메시지')`로 생성되는 객체에는 여러 프로퍼티가 있습니다.

```js
const e = new Error('사용자 로드 실패');

console.log(e.name);    // "Error"
console.log(e.message); // "사용자 로드 실패"
console.log(e.stack);   // "Error: 사용자 로드 실패\n    at ..."
console.log(e.cause);   // undefined (ES2022 옵션)
console.log(e.toString()); // "Error: 사용자 로드 실패"
```

![Error 객체 구조 — 표준 프로퍼티](/assets/posts/js-error-object-properties.svg)

### 내장 Error 서브클래스

JavaScript에는 목적에 따라 구분된 내장 Error 타입이 있습니다.

```js
new TypeError('string expected');    // 타입 불일치
new RangeError('index out of range'); // 범위 초과
new SyntaxError('invalid syntax');   // 구문 오류
new ReferenceError('x is not defined'); // 미선언 변수
new URIError('malformed URI');       // URI 인코딩 오류
new EvalError('...');                // eval 관련 (드물게)
```

`instanceof`로 에러 유형을 구분하면 에러 처리 코드를 더 정확하게 작성할 수 있습니다.

## 스택 트레이스 읽기

`e.stack`은 에러 발생 위치부터 최초 호출 지점까지의 함수 호출 경로를 담은 문자열입니다.

```
Error: 사용자 로드 실패
    at fetchUser (api.js:12:5)
    at loadDashboard (ui.js:34:20)
    at init (app.js:8:3)
    at <anonymous>:1:1
```

- 첫 줄: `name: message`
- 이후 줄: `at 함수명 (파일명:줄:열)`

**중요**: `e.stack`의 형식은 표준이 아닙니다. V8(Node.js, Chrome)과 SpiderMonkey(Firefox)가 다른 형식을 사용합니다. 파싱 코드를 작성할 때는 이 점을 고려해야 합니다.

## JSON 직렬화 주의

```js
const e = new Error('테스트');
console.log(JSON.stringify(e)); // "{}" — name, message, stack이 없음!
```

`Error`의 `name`, `message`, `stack`은 열거 불가능(non-enumerable) 프로퍼티이기 때문에 `JSON.stringify`가 무시합니다. 에러를 로그나 API 응답으로 보낼 때는 명시적으로 직렬화해야 합니다.

```js
function serializeError(e) {
  return {
    name: e.name,
    message: e.message,
    stack: e.stack,
    cause: e.cause ? serializeError(e.cause) : undefined,
  };
}

logger.error(serializeError(err));
```

![스택 트레이스 활용 — 로깅·직렬화·필터링](/assets/posts/js-error-stack-trace.svg)

## Error.captureStackTrace — V8 전용

Node.js(V8 엔진)에서는 커스텀 에러 클래스를 만들 때 불필요한 내부 프레임을 스택에서 제거할 수 있습니다.

```js
class AppError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AppError';
    if (Error.captureStackTrace) {
      // AppError 생성자 프레임을 스택에서 제외
      Error.captureStackTrace(this, AppError);
    }
  }
}
```

`captureStackTrace(obj, constructorOpt)`는 두 번째 인자로 전달한 함수 위의 프레임만 스택에 포함시킵니다. 결과적으로 `AppError`를 `throw`했을 때 스택의 첫 프레임이 에러 클래스 생성자가 아니라 실제 에러 발생 위치가 됩니다.

## Error.prepareStackTrace — V8 구조화

V8에서는 스택 트레이스를 구조화된 객체로 받을 수 있습니다.

```js
Error.prepareStackTrace = (err, frames) =>
  frames.map(f => ({
    fn: f.getFunctionName(),
    file: f.getFileName(),
    line: f.getLineNumber(),
    col: f.getColumnNumber(),
  }));

const e = new Error('test');
// e.stack은 이제 배열
console.log(e.stack[0]); // { fn: 'main', file: 'app.js', line: 5, col: 3 }
```

이를 활용하면 에러 위치를 소스맵과 연결하거나 로그 시스템에 구조화된 데이터를 전송할 수 있습니다.

## 에러 비교 — instanceof vs name

```js
// instanceof: 프로토타입 체인 기반 (권장)
catch (e) {
  if (e instanceof TypeError) { ... }
}

// name 비교: 다른 realm에서 온 에러에도 동작
catch (e) {
  if (e.name === 'TypeError') { ... }
}
```

서로 다른 iframe이나 Node.js 모듈 간에 에러를 전달하면 `instanceof`가 실패할 수 있습니다. 라이브러리를 만들 때는 `e.name` 비교도 고려하세요.

## 실전 에러 로깅 패턴

```js
class Logger {
  error(message, error) {
    const log = {
      level: 'error',
      message,
      error: error instanceof Error
        ? serializeError(error)
        : { value: String(error) },
      timestamp: new Date().toISOString(),
    };
    // Sentry, Datadog 등으로 전송
    this.#transport.send(log);
  }
}

// 사용
try {
  await processData(input);
} catch (e) {
  logger.error('데이터 처리 실패', e);
  throw e; // 재통해서 상위 에러 핸들러도 실행
}
```

## 정리

- `name`, `message`, `stack`, `cause` — 에러의 네 가지 핵심 프로퍼티
- `stack`은 비표준이지만 사실상 모든 런타임이 지원
- `JSON.stringify(error)`는 `{}`를 반환 — 항상 명시적으로 직렬화
- `Error.captureStackTrace`로 내부 프레임 제거 (V8 전용)
- 에러 유형 비교: `instanceof` 우선, 크로스-realm은 `.name` 비교

---

**지난 글:** [throw와 try/catch/finally — 에러 전파의 기초](/posts/js-throw-try-catch/)

**다음 글:** [커스텀 Error 클래스 — 도메인 에러 설계](/posts/js-custom-error-class/)

<br>
읽어주셔서 감사합니다. 😊
