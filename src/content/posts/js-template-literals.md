---
title: "템플릿 리터럴 완전 정복"
description: "JavaScript 템플릿 리터럴의 보간·여러 줄 문자열부터 태그드 템플릿으로 XSS 방어·SQL 안전 쿼리·styled-components 원리까지 심층 해설합니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 13
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "템플릿리터럴", "template-literal", "tagged-template", "보간", "ES6", "XSS"]
featured: false
draft: false
---

[지난 글](/posts/js-destructuring/)에서 구조 분해 할당으로 값을 추출하는 법을 살펴봤습니다. 이번에는 ES2015가 가져온 또 다른 문자열 혁신인 **템플릿 리터럴(template literal)**을 다룹니다. 백틱(`` ` ``)으로 감싸는 이 문법은 단순 보간 그 이상으로, 태그드 템플릿을 통해 styled-components, GraphQL 쿼리, XSS 방어 같은 강력한 추상화를 가능하게 합니다.

## 기본 문법 — 보간과 여러 줄

템플릿 리터럴의 가장 기본 기능은 `${...}` 보간(interpolation)입니다. 중괄호 안에는 **임의의 JavaScript 표현식**이 올 수 있습니다.

```javascript
const name = 'Kim';
const age  = 30;

`안녕, ${name}!`                    // '안녕, Kim!'
`내년엔 ${age + 1}살`               // '내년엔 31살'
`${age >= 18 ? '성인' : '미성년'}` // '성인'
`${name.toUpperCase()}`             // 'KIM'
```

백틱 안의 개행은 그대로 문자열에 포함됩니다. `\n` 없이 여러 줄 문자열을 만들 수 있습니다.

```javascript
const template = `
  <div>
    <h1>${name}</h1>
    <p>나이: ${age}</p>
  </div>
`;
```

주의: 들여쓰기 공백도 문자열에 포함됩니다. 시작 백틱 뒤 첫 개행과 끝 백틱 앞 공백을 `trim()`으로 제거하거나, 들여쓰기를 의도적으로 배치해야 합니다.

![템플릿 리터럴 문법](/assets/posts/js-template-literals-syntax.svg)

## 이스케이프

백틱 자체는 `\`` 로 이스케이프하고, `${`는 `\${`로 막습니다.

```javascript
`가격: \${price}`    // '가격: ${price}' (보간 억제)
`백틱: \``           // '백틱: `'
```

기존 `\n`, `\t`, `\u` 등 이스케이프 시퀀스는 모두 동일하게 동작합니다.

## 태그드 템플릿 — 함수가 문자열을 제어

백틱 앞에 함수 이름을 붙이면 그 함수가 템플릿 처리를 가로챕니다. 이것이 **태그드 템플릿(tagged template)**입니다.

```javascript
function highlight(strings, ...values) {
  return strings.reduce((result, str, i) => {
    const val = values[i] !== undefined
      ? `<mark>${values[i]}</mark>`
      : '';
    return result + str + val;
  }, '');
}

const score = 95;
highlight`점수: ${score}점입니다.`;
// '점수: <mark>95</mark>점입니다.'
```

태그 함수의 시그니처는 항상 같습니다:
- `strings` — 정적 문자열 조각의 배열. `strings.length === values.length + 1`
- `...values` — 보간된 표현식의 평가 결과들

## String.raw — 이스케이프 없는 원본

`String.raw`는 내장 태그 함수로, 이스케이프 시퀀스를 처리하지 않고 원본 문자열을 반환합니다.

```javascript
String.raw`C:\Users\new\temp`
// 'C:\\Users\\new\\temp' — \n, \t가 개행/탭으로 변환되지 않음

new RegExp(String.raw`\d+\.\d+`)
// /\d+\.\d+/ — 정규식 패턴 문자열 구성에 유용
```

태그 함수 내부에서는 `strings.raw` 배열로 원본 이스케이프 시퀀스에 접근할 수 있습니다.

## 실전: XSS 방어 태그

사용자 입력을 HTML에 삽입할 때 태그드 템플릿으로 자동 이스케이프를 구현할 수 있습니다.

```javascript
function safeHtml(strings, ...values) {
  const escape = v =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  return strings.reduce(
    (acc, str, i) => acc + str + escape(values[i] ?? ''),
    ''
  );
}

const userInput = '<script>alert(1)</script>';
safeHtml`<p>댓글: ${userInput}</p>`
// '<p>댓글: &lt;script&gt;alert(1)&lt;/script&gt;</p>'
```

![태그드 템플릿 실전 활용](/assets/posts/js-template-literals-tagged.svg)

## 실전: styled-components 원리

styled-components가 CSS-in-JS를 구현하는 방법이 바로 태그드 템플릿입니다. 보간에 **함수**를 넘겨 props 기반 동적 스타일을 만듭니다.

```javascript
// styled-components 내부 동작 개념
function css(strings, ...interpolations) {
  return (props) =>
    strings.reduce((acc, str, i) => {
      const interp = interpolations[i];
      const val = typeof interp === 'function' ? interp(props) : (interp ?? '');
      return acc + str + val;
    }, '');
}

const getColor = css`
  color: ${(p) => (p.primary ? 'blue' : 'black')};
  padding: 8px;
`;
getColor({ primary: true });  // 'color: blue; padding: 8px;'
```

## 중첩 템플릿과 배열 조인

보간 안에 다시 템플릿 리터럴을 쓸 수 있고, 배열을 `join`으로 연결하는 패턴이 유용합니다.

```javascript
const items = ['사과', '배', '포도'];

const list = `
장바구니:
${items.map((item, i) => `  ${i + 1}. ${item}`).join('\n')}
`;

// 조건부 클래스명
const cls = `btn ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`.trim();
```

## 성능 고려

템플릿 리터럴은 런타임에 문자열을 조립하므로, 반복문 안에서 매우 긴 문자열을 빈번히 만들면 배열 `push` 후 `join('')`이 더 효율적일 수 있습니다. 그러나 대부분의 경우 차이는 미미하고, 가독성 우선이 올바른 선택입니다.

---

**지난 글:** [구조 분해 할당 완전 정복](/posts/js-destructuring/)

**다음 글:** [함수 선언식 vs 함수 표현식](/posts/js-function-declaration-vs-expression/)

<br>
읽어주셔서 감사합니다. 😊
