---
title: "var · let · const 차이 — JavaScript 변수 선언의 모든 것"
description: "var의 함수 스코프와 호이스팅 문제, let의 블록 스코프, const의 바인딩 고정, TDZ까지 세 가지 변수 선언 방식의 차이를 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-27"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "var", "let", "const", "scope", "hoisting", "tdz"]
featured: false
draft: false
---

[지난 글](/posts/js-strict-mode/)에서 strict mode가 미선언 변수 사용 같은 위험한 동작을 에러로 바꿔준다고 했습니다. 그렇다면 변수를 선언하는 세 가지 방법—`var`, `let`, `const`—은 정확히 어떻게 다를까요? 이 차이를 모르면 의도치 않은 버그가 조용히 숨어들 수 있습니다.

## var: 함수 스코프와 호이스팅의 함정

`var`는 ES5까지 유일한 변수 선언 방법이었습니다. 두 가지 특성이 초보자를 자주 혼란스럽게 합니다.

### 함수 스코프

`var`로 선언된 변수는 **함수를 스코프의 경계**로 삼습니다. `if`, `for`, `while` 같은 블록(중괄호)은 `var`의 스코프에 영향을 주지 않습니다.

```javascript
function example() {
  var x = 1;
  if (true) {
    var x = 2; // 새 변수가 아니라 같은 x!
    console.log(x); // 2
  }
  console.log(x); // 2 (의도와 다를 수 있음)
}
```

`if` 블록 안에서 `var x = 2`를 써도 외부의 `x`를 덮어쓸 뿐입니다. 함수 밖에서 선언된 `var`는 전역 변수가 되며, 브라우저에서는 `window` 객체의 프로퍼티가 됩니다.

### 호이스팅과 undefined 초기화

`var` 선언은 해당 함수의 맨 위로 **호이스팅(hoisting)**됩니다. 선언이 실행 전에 `undefined`로 초기화됩니다.

```javascript
console.log(name); // undefined — 에러가 아닙니다
var name = 'Lee';
console.log(name); // 'Lee'

// 실제 실행 순서는 이렇습니다:
// var name; ← 호이스팅
// console.log(name); // undefined
// name = 'Lee';
// console.log(name); // 'Lee'
```

이 동작은 직관에 반합니다. 선언 전에 변수를 사용해도 에러가 나지 않아서 버그를 숨겨버립니다.

## let: 블록 스코프로 문제 해결

ES2015에서 도입된 `let`은 `var`의 문제를 블록 스코프로 해결합니다.

```javascript
function example() {
  let x = 1;
  if (true) {
    let x = 2; // 블록 안의 별개 x
    console.log(x); // 2
  }
  console.log(x); // 1 (바깥 x는 그대로)
}
```

`{}` 안에서 선언된 `let`은 그 블록 안에서만 유효합니다. `for` 루프에서 이 차이가 특히 극적으로 드러납니다.

```javascript
// var의 고전적 버그
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// 출력: 3, 3, 3 (루프 종료 후의 i 값을 모두 참조)

// let으로 해결
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// 출력: 0, 1, 2 (각 반복마다 별도의 i 바인딩)
```

`let`은 반복마다 새로운 바인딩을 만들기 때문에, 클로저가 각자의 `i`를 올바르게 캡처합니다.

### let의 호이스팅과 TDZ

`let`도 호이스팅은 됩니다. 그러나 `undefined`로 초기화되지 않고, 선언 이전 구간은 **TDZ(Temporal Dead Zone, 일시적 사각지대)**가 됩니다.

```javascript
console.log(x); // ReferenceError: Cannot access 'x' before initialization
let x = 1;
```

`var`와 달리 선언 전 접근이 명시적 에러를 발생시킵니다. 이것이 `let`이 더 안전한 이유입니다.

![var · let · const 스코프 비교](/assets/posts/js-var-let-const-scope.svg)

## const: 변경 불가능한 바인딩

`const`는 `let`과 스코프·TDZ 동작이 동일하지만, 선언 시 **반드시 초기화**해야 하고, 이후 **재할당이 불가능**합니다.

```javascript
const PI = 3.14159;
PI = 3; // TypeError: Assignment to constant variable

const obj = { name: 'Lee' };
obj.name = 'Kim'; // 가능! 객체 내부는 변경 가능
obj = {};          // TypeError: 바인딩 자체는 변경 불가
```

중요한 포인트: `const`는 **바인딩(변수와 값의 연결)이 고정**될 뿐입니다. 객체나 배열을 `const`로 선언해도 내부 프로퍼티나 요소는 자유롭게 변경할 수 있습니다. 완전한 불변성을 원한다면 `Object.freeze()`를 사용해야 합니다.

```javascript
const arr = [1, 2, 3];
arr.push(4);     // 가능 — 배열 내용 변경
arr = [1, 2];    // TypeError — 바인딩 변경 불가
```

![함수 스코프 vs 블록 스코프](/assets/posts/js-var-let-const-block.svg)

## 재선언 규칙

`var`는 같은 스코프 안에서 같은 이름으로 재선언해도 에러가 없습니다.

```javascript
var name = 'Lee';
var name = 'Kim'; // 에러 없음 — 마지막 값으로 덮임
```

`let`과 `const`는 같은 스코프 안에서 재선언하면 `SyntaxError`가 발생합니다.

```javascript
let name = 'Lee';
let name = 'Kim'; // SyntaxError: Identifier 'name' has already been declared
```

단, 다른 블록 스코프에서는 같은 이름을 쓸 수 있습니다.

```javascript
let x = 1;
{
  let x = 2; // 별개의 스코프, 문제없음
}
```

## 전역 스코프에서의 차이

전역에서 `var`로 선언하면 브라우저의 `window` 객체 프로퍼티가 됩니다.

```javascript
var globalVar = 'I am global';
console.log(window.globalVar); // 'I am global'

let globalLet = 'I am also global';
console.log(window.globalLet); // undefined — window에 붙지 않음
```

`let`과 `const`는 전역 스코프에 변수를 만들지만 `window`에는 붙지 않습니다. `window` 오염을 방지하는 안전한 동작입니다.

## 언제 무엇을 써야 하는가

현대 JavaScript의 권장 관례는 간단합니다.

**기본으로 `const` 사용**: 재할당이 필요하지 않은 모든 변수에 `const`를 씁니다. 의도하지 않은 재할당을 컴파일 타임에 잡아줍니다.

**재할당이 필요하면 `let` 사용**: 반복문의 카운터, 누적 값, 조건에 따라 바뀌는 값 등에 씁니다.

**`var`는 사용하지 않습니다**: 함수 스코프, 호이스팅, `undefined` 초기화, 재선언 허용 등 예상치 못한 동작을 유발할 수 있습니다. 레거시 코드를 유지보수할 때만 다루게 될 것입니다.

```javascript
// 권장 패턴
const MAX_SIZE = 100;    // 변경 안 함 → const
const users = [];        // 배열 자체는 재할당 안 함 → const
users.push('Lee');       // 배열 내부 변경은 OK

let count = 0;           // 반복마다 증가 → let
for (let i = 0; i < 10; i++) { // 반복문 카운터 → let
  count += i;
}
```

ESLint의 `prefer-const` 규칙은 재할당이 없는 `let`을 자동으로 `const`로 교체하도록 안내합니다. 빌드 도구와 함께 설정해두면 팀 전체가 일관된 패턴을 유지할 수 있습니다.

---

**지난 글:** [Strict mode와 sloppy mode](/posts/js-strict-mode/)

**다음 글:** [호이스팅의 본질](/posts/js-hoisting/)

<br>
읽어주셔서 감사합니다. 😊
