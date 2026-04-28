---
title: "var, let, const — 변수 선언의 세 가지 방법"
description: "var의 함수 스코프와 호이스팅 문제, let과 const의 블록 스코프와 TDZ, const 바인딩 불변의 의미를 코드 예시와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["var", "let", "const", "스코프", "호이스팅", "TDZ"]
featured: false
draft: false
---

[지난 글](/posts/js-strict-mode/)에서 strict mode가 언어의 위험한 기본 동작을 막아준다는 것을 살펴봤습니다. 변수 선언 방식은 그 위험한 기본 동작과 직결됩니다. JavaScript에는 `var`, `let`, `const` 세 가지 변수 선언 키워드가 있고, 각각 스코프·호이스팅·재할당 가능 여부가 다릅니다. ES2015 이전엔 `var`만 있었고, 이것이 수많은 버그의 원인이었습니다.

## var — 함수 스코프와 그 문제점

![var · let · const 스코프 비교](/assets/posts/js-var-let-const-scope.svg)

`var`는 **함수 스코프(function scope)**를 가집니다. 블록(`{ }`)이 아닌 함수 경계만을 스코프로 인식합니다.

```javascript
function example() {
  if (true) {
    var x = 10; // if 블록 안에서 선언
  }
  console.log(x); // 10 — 블록 밖에서도 접근 가능!
}
```

`for` 루프에서 이 문제가 특히 두드러집니다.

```javascript
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100);
}
// 출력: 3, 3, 3 (예상: 0, 1, 2)
// 루프 종료 후 i가 3이 된 상태에서 콜백이 실행됨
```

`var`의 또 다른 문제는 **전역 스코프 오염**입니다. 함수 바깥에서 선언하면 전역 객체(`window`, `global`)의 속성이 됩니다. 또한 같은 이름으로 재선언해도 오류가 없어 버그 추적이 어렵습니다.

## let — 블록 스코프와 TDZ

`let`은 ES2015에 도입된 **블록 스코프(block scope)** 선언입니다. `{ }` 블록 안에서만 유효합니다.

```javascript
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 100);
}
// 출력: 0, 1, 2 — 각 반복마다 새로운 i 바인딩 생성
```

`let`은 같은 스코프에서 재선언이 불가합니다.

```javascript
let count = 0;
let count = 1; // SyntaxError: Identifier 'count' has already been declared
```

`let`은 **호이스팅은 되지만 초기화 전까지 TDZ(Temporal Dead Zone)**에 놓입니다. 선언 전에 접근하면 `ReferenceError`가 발생합니다. 이에 대한 자세한 내용은 다음 글에서 다룹니다.

## const — 바인딩 불변

`const`는 `let`과 같은 블록 스코프를 갖지만, **선언 시 반드시 초기화**해야 하고 이후 **재할당이 불가**합니다.

![const는 불변이 아니다 — 바인딩 불변](/assets/posts/js-var-let-const-const-detail.svg)

중요한 점은 `const`가 **바인딩(binding)을 불변으로** 만들 뿐, **값(value) 자체를 불변으로** 만들지 않는다는 것입니다. 객체나 배열을 `const`로 선언해도 내용은 변경할 수 있습니다.

```javascript
const config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
};

config.timeout = 3000;     // OK — 속성 변경 가능
config.retries = 3;        // OK — 속성 추가 가능
config = { apiUrl: '…' }; // TypeError — 바인딩 변경 불가

const numbers = [1, 2, 3];
numbers.push(4);           // OK — 배열 내용 변경 가능
numbers = [1, 2, 3, 4];   // TypeError — 바인딩 변경 불가
```

완전한 불변을 원한다면 `Object.freeze()`를 사용합니다. 단, `freeze`는 얕은(shallow) 불변만 적용됩니다 — 중첩 객체의 속성은 여전히 변경 가능합니다.

```javascript
const deepObj = Object.freeze({
  settings: { darkMode: false }, // 이 중첩 객체는 freeze되지 않음!
});
deepObj.settings.darkMode = true; // OK (shallow freeze의 한계)
```

## 실무 가이드 — 무엇을 써야 할까

현대 JavaScript 스타일 가이드는 대부분 다음 원칙을 따릅니다.

1. **기본은 `const`** — 재할당이 필요한지 불분명하다면 `const`로 시작합니다.
2. **재할당이 필요하면 `let`** — 루프 카운터, 누적 변수 등.
3. **`var`는 사용하지 않는다** — 레거시 코드를 제외하면 이유가 없습니다.

```javascript
// 권장 패턴
const PI = 3.14159;
const user = { name: 'Alice' }; // 객체 자체를 재할당하지 않으면 const

let score = 0;
for (let i = 0; i < 10; i++) {
  score += i;
}

// ESLint 규칙으로 강제 가능
// "prefer-const": "error"
// "no-var": "error"
```

TypeScript를 사용하면 `const`로 선언된 원시 값은 리터럴 타입으로 좁혀지는 추가 혜택도 있습니다.

```typescript
const role = 'admin';    // 타입: "admin" (리터럴)
let   mode = 'dark';     // 타입: string
```

---

**지난 글:** [strict mode — 안전한 JavaScript의 시작](/posts/js-strict-mode/)

**다음 글:** [호이스팅 — var와 함수 선언이 끌어올려지는 원리](/posts/js-hoisting/)

<br>
읽어주셔서 감사합니다. 😊
