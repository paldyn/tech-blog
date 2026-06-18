---
title: "allowJs와 checkJs"
description: "마이그레이션의 출발점인 allowJs와 checkJs 옵션을 자세히 다룬다. 두 옵션이 만드는 네 가지 상태, JS를 컴파일에 포함하는 것과 타입 검사하는 것의 차이, 파일 상단 @ts-check·@ts-nocheck로 전역 설정을 개별 재정의하는 법, maxNodeModuleJsDepth까지 정리한다."
author: "PALDYN Team"
pubDate: "2026-06-19"
archiveOrder: 7
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "allowJs", "checkJs", "마이그레이션", "tsconfig"]
featured: false
draft: false
---

[지난 글](/posts/ts-migration-strategy/)에서 마이그레이션의 큰 그림을 그렸다. 그 1단계가 "JS와 TS를 한 빌드 안에서 공존시키는 것"이었는데, 이를 가능하게 하는 두 옵션이 `allowJs`와 `checkJs`다. 이름이 비슷해 헷갈리기 쉽지만, 둘은 전혀 다른 일을 한다. 하나는 자바스크립트를 컴파일에 **포함**시키고, 다른 하나는 그 자바스크립트를 **검사**한다. 이번 글은 이 둘의 정확한 역할과 조합, 그리고 파일 단위로 세밀하게 제어하는 법을 다룬다.

## 포함과 검사는 다른 일

`allowJs`는 "`.js` 파일을 TypeScript 컴파일 대상에 넣을지"를 결정한다. 기본값은 `false`라서, 평소 `tsc`는 `.ts`만 보고 `.js`는 거들떠보지 않는다. `allowJs: true`로 켜면 `.js`도 컴파일 그래프에 들어와, 변환·번들·모듈 해석에 참여한다. 다만 이때 **타입 검사는 하지 않는다.** 그냥 포함만 한다.

`checkJs`는 한 발 더 나간다. 포함된 `.js`를 **타입 검사**한다. TypeScript는 자바스크립트의 추론과 JSDoc 주석을 근거로, `.ts에서 하듯` `.js`에서도 타입 에러를 띄운다.

![allowJs와 checkJs의 네 가지 상태](/assets/posts/ts-allowjs-checkjs-matrix.svg)

이 둘의 조합을 표로 보면 명확하다. `allowJs`가 꺼져 있으면 `checkJs`는 의미가 없다(검사할 JS가 컴파일에 없으니까). 그래서 실질적으로 의미 있는 상태는 셋이다. JS 무시(기본값), JS 포함만(`allowJs`), JS 포함+검사(`allowJs`+`checkJs`)다.

```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "noEmit": true
  }
}
```

## checkJs가 보는 것: 추론과 JSDoc

`checkJs`를 켜면, TypeScript는 자바스크립트 코드에서 끌어낼 수 있는 모든 타입 정보를 활용한다. 변수 초기값에서 타입을 추론하고, 함수 사용 패턴을 분석하며, 무엇보다 **JSDoc 주석**을 타입 주석처럼 읽는다.

```javascript
// @ts-check

/**
 * @param {string} name
 * @param {number} age
 * @returns {string}
 */
function describe(name, age) {
  return `${name} (${age})`;
}

describe("Kim", "30"); // ❌ 에러: '30'은 string이라 number 자리에 못 옴
```

`.ts`로 바꾸지 않고도, JSDoc만으로 상당한 수준의 타입 안전성을 얻는다. JSDoc 타이핑 자체는 별도 글에서 깊이 다룬다. 여기서 중요한 건, `checkJs`가 켜져야 이 JSDoc이 실제 검사로 이어진다는 점이다.

## 파일 단위로 뒤집기

전역 설정만으로는 마이그레이션이 뻣뻣하다. 어떤 레거시 파일은 아직 검사를 켜면 에러가 수백 개 쏟아지고, 어떤 새 파일은 JS인데도 검사를 받고 싶다. 그래서 TypeScript는 파일 상단 주석으로 전역 설정을 **개별 재정의**하게 해 준다.

![파일 단위 재정의](/assets/posts/ts-allowjs-checkjs-perfile.svg)

`checkJs: false`인 프로젝트라도, 특정 `.js` 파일 맨 위에 `// @ts-check`를 적으면 그 파일만 검사가 켜진다. 반대로 `checkJs: true`인 프로젝트에서 아직 손대지 못한 레거시 파일 위에 `// @ts-nocheck`를 적으면 그 파일만 검사에서 빠진다. 이 두 주석 덕분에 "전역은 검사 켜되, 문제 파일만 임시로 빼 두기" 같은 점진적 전략이 가능해진다.

```javascript
// @ts-check
// 이 파일은 검사 대상 — 위에서 본 JSDoc이 실제로 동작한다
```

한 줄만 무시하고 싶을 때는 `// @ts-ignore`(다음 줄의 에러 억제)나, 더 안전한 `// @ts-expect-error`(에러가 없으면 오히려 경고)를 쓴다. 마이그레이션 중에는 "에러가 사라지면 알려주는" `@ts-expect-error` 쪽이 빚을 갚았는지 추적하기 좋다.

## node_modules의 자바스크립트

`allowJs`를 켜면 가끔 의존성 안의 자바스크립트까지 분석하려다 빌드가 느려지거나 엉뚱한 에러를 만난다. `maxNodeModuleJsDepth`는 TypeScript가 `node_modules` 안의 `.js`를 얼마나 깊이 따라 들어가 추론할지를 제한한다. 기본값은 0이라 대개 신경 쓸 일이 없지만, 타입 정의 없는 JS 의존성을 다룰 때 조정할 수 있다. 보통은 `skipLibCheck: true`를 함께 두어 선언 파일 검사 비용을 줄인다.

```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "skipLibCheck": true,
    "maxNodeModuleJsDepth": 0
  }
}
```

## 정리

`allowJs`는 자바스크립트를 컴파일에 **포함**시키고, `checkJs`는 그 자바스크립트를 **검사**한다. **마이그레이션은 보통 `allowJs`만 켜서 공존을 만든 뒤, `checkJs`로 검사를 켜고, 파일 상단의 `@ts-check`/`@ts-nocheck`로 파일마다 검사 여부를 세밀하게 조절하며 전진한다.** `.ts`로 바꾸기 전에도 JSDoc과 `checkJs`만으로 상당한 타입 안전성을 미리 확보할 수 있다는 점이 이 단계의 핵심 이점이다. 다음 글에서는 그 JSDoc 타이핑을 본격적으로 파고든다.

---

**지난 글:** [TypeScript 마이그레이션 전략](/posts/ts-migration-strategy/)

**다음 글:** [JSDoc으로 타입 작성하기](/posts/ts-jsdoc-typing/)

<br>
읽어주셔서 감사합니다. 😊
