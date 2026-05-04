---
title: "커스텀 Error 클래스 — 도메인 에러 설계"
description: "AppError를 루트로 계층적인 커스텀 Error 클래스를 설계하는 방법을 알아봅니다. name 자동 설정, 추가 프로퍼티, captureStackTrace, instanceof 포착 전략을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "커스텀에러", "Error", "class", "extends", "instanceof", "에러설계"]
featured: false
draft: false
---

[지난 글](/posts/js-error-object-stack/)에서 Error 객체의 구조와 스택 트레이스 활용법을 살펴봤습니다. 이번에는 내장 `Error` 클래스를 상속해 도메인에 맞는 커스텀 에러 계층을 설계하는 방법을 다룹니다.

## 왜 커스텀 Error가 필요한가

`new Error('사용자를 찾을 수 없습니다')` 하나로는 에러 유형을 구분하기 어렵습니다. 같은 문자열 비교로 분기하면 오타가 나도 런타임에서야 알게 됩니다.

```js
// 안 좋은 방법 — 문자열 비교
catch (e) {
  if (e.message === '사용자를 찾을 수 없습니다') { ... }
}

// 좋은 방법 — 커스텀 클래스 + instanceof
catch (e) {
  if (e instanceof NotFoundError) { ... }
}
```

커스텀 에러 클래스를 사용하면 타입으로 구분하고, 추가 데이터(HTTP 상태 코드, 필드 이름 등)를 함께 전달할 수 있습니다.

## AppError 베이스 클래스

모든 애플리케이션 에러의 공통 베이스 클래스를 만들어 계층의 루트로 사용합니다.

```js
class AppError extends Error {
  constructor(message, options = {}) {
    super(message, options); // options.cause 전달 (ES2022)
    // this.constructor.name으로 서브클래스 이름 자동 할당
    this.name = this.constructor.name;
    // V8: 스택에서 생성자 프레임 제거
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
```

`this.name = this.constructor.name`이 핵심입니다. `ValidationError extends AppError`를 만들면 `this.constructor.name`이 자동으로 `'ValidationError'`가 됩니다. 베이스 클래스에 한 줄만 써두면 모든 서브클래스에서 동작합니다.

![도메인 Error 클래스 계층 구조](/assets/posts/js-custom-error-hierarchy.svg)

## 도메인 에러 설계

`AppError`를 상속해 레이어별 에러를 정의합니다.

```js
// 네트워크 계층
class NetworkError extends AppError {
  constructor(message, { statusCode, cause } = {}) {
    super(message, { cause });
    this.statusCode = statusCode;
  }
}

class TimeoutError extends NetworkError {
  constructor(url, ms) {
    super(`${url} 요청 타임아웃 (${ms}ms)`, { statusCode: 408 });
    this.url = url;
    this.ms = ms;
  }
}

// 검증 계층
class ValidationError extends AppError {
  constructor(message, field) {
    super(message);
    this.field = field;
  }
}

// 인증 계층
class AuthError extends AppError {
  constructor(message, { required } = {}) {
    super(message);
    this.required = required; // 필요한 권한
  }
}
```

각 에러 클래스는 자신의 도메인에 맞는 추가 프로퍼티를 가집니다. `TimeoutError`에는 URL과 타임아웃 시간, `ValidationError`에는 문제가 된 필드 이름이 포함됩니다.

![커스텀 Error 클래스 구현 패턴](/assets/posts/js-custom-error-pattern.svg)

## instanceof 포착 전략

계층 구조에서는 **구체적인 클래스를 먼저** catch해야 합니다. `instanceof`는 프로토타입 체인을 검사하므로, `TimeoutError`는 `NetworkError`와 `AppError`의 `instanceof`도 `true`입니다.

```js
try {
  await fetchUser(id);
} catch (e) {
  if (e instanceof TimeoutError) {
    // 타임아웃 전용 처리 (재시도 등)
    return retry(id, e.ms * 2);
  }
  if (e instanceof NetworkError) {
    // 일반 네트워크 오류 (오프라인 안내 등)
    return showNetworkError(e.statusCode);
  }
  if (e instanceof AppError) {
    // 모든 앱 에러의 폴백
    return showGenericError(e.message);
  }
  throw e; // 예상치 못한 에러는 반드시 재통
}
```

## HTTP 상태 코드를 포함한 에러 설계

API 서버에서는 HTTP 상태 코드를 에러에 포함하면 미들웨어에서 자동으로 응답을 생성할 수 있습니다.

```js
class HttpError extends AppError {
  constructor(statusCode, message, cause) {
    super(message, { cause });
    this.statusCode = statusCode;
  }

  static notFound(message = 'Not Found') {
    return new HttpError(404, message);
  }

  static unauthorized(message = 'Unauthorized') {
    return new HttpError(401, message);
  }

  static badRequest(message) {
    return new HttpError(400, message);
  }
}

// Express 에러 미들웨어
app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
    });
  }
  res.status(500).json({ error: 'InternalServerError' });
});
```

`HttpError.notFound()` 같은 정적 팩토리 메서드를 사용하면 에러 생성 코드가 간결해집니다.

## 에러 직렬화 — toJSON

에러를 API 응답이나 로그로 보낼 때 `toJSON` 메서드를 정의해 두면 편리합니다.

```js
class AppError extends Error {
  // ...

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      ...(this.cause && { cause: this.cause }),
    };
  }
}
```

이제 `JSON.stringify(new ValidationError('이메일 오류', 'email'))`이 의미 있는 객체를 반환합니다.

## 정리

- `extends Error` + `super(message, options)` + `this.name = this.constructor.name`
- `Error.captureStackTrace`로 내부 프레임 제거 (V8)
- 계층 설계: `AppError → NetworkError → TimeoutError` 등
- `instanceof`로 포착 시 구체적인 클래스를 먼저 확인
- 도메인 데이터(statusCode, field 등)를 에러 프로퍼티로 전달
- 처리하지 못하는 에러는 반드시 `throw e`로 재통

---

**지난 글:** [Error 객체와 스택 트레이스 — 구조와 활용](/posts/js-error-object-stack/)

**다음 글:** [Error cause (ES2022) — 에러 원인 연결](/posts/js-error-cause-2022/)

<br>
읽어주셔서 감사합니다. 😊
