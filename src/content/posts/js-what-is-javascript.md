---
title: "JavaScript란 무엇인가? — 웹의 언어가 된 10일의 기적"
description: "1995년 단 10일 만에 탄생한 JavaScript가 어떻게 세계에서 가장 많이 쓰이는 프로그래밍 언어가 되었는지, 그 본질과 특성을 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "역사", "기초", "웹"]
featured: false
draft: false
---

JavaScript는 1995년 Brendan Eich가 단 10일 만에 설계한 언어입니다. 당시 Netscape는 웹 페이지에 동적인 상호작용을 추가하고 싶었고, 그 결과물이 처음에는 "Mocha", 그다음엔 "LiveScript", 최종적으로 "JavaScript"라는 이름을 갖게 됩니다. 이름에 Java가 들어있지만 Java와는 전혀 다른 언어입니다 — 당시 Java의 인기에 편승한 마케팅 결정이었을 뿐입니다. 30년이 지난 지금, JavaScript는 브라우저·서버·엣지·모바일 어디서나 실행되는 세계에서 가장 광범위하게 쓰이는 프로그래밍 언어가 되었습니다.

## HTML, CSS, JavaScript — 웹의 세 축

웹 프론트엔드는 세 가지 기술이 각자의 역할을 담당합니다.

![JavaScript란 무엇인가? — 세 가지 핵심 역할](/assets/posts/js-what-is-javascript-overview.svg)

**HTML**은 콘텐츠의 *구조와 의미*를 정의합니다. 제목, 단락, 링크, 이미지가 어떤 관계인지를 기술합니다. **CSS**는 그 구조에 *스타일과 레이아웃*을 입힙니다. 색상, 폰트, 배치가 여기서 결정됩니다. **JavaScript**는 페이지에 *동작과 상호작용*을 부여합니다. 버튼 클릭, 데이터 불러오기, 실시간 업데이트 — 이 모든 것이 JavaScript의 영역입니다.

세 기술은 서로 관심사를 분리하도록 설계되었지만, 실제로는 JavaScript가 DOM을 통해 HTML 구조를 바꾸고 CSSOM을 통해 스타일까지 제어할 수 있습니다.

## JavaScript의 핵심 특성

JavaScript를 다른 언어와 구별 짓는 특성 네 가지가 있습니다.

**동적 타입(Dynamically Typed)** — 변수에 타입을 선언하지 않습니다. 같은 변수가 숫자였다가 문자열이 될 수 있습니다. 유연하지만 런타임 오류의 원인이 되기도 하며, 이를 보완하기 위해 TypeScript가 등장했습니다.

**인터프리터 + JIT 컴파일** — 소스 코드를 기계어로 미리 컴파일하지 않고 엔진이 실행 시점에 해석합니다. 현대 엔진(V8, SpiderMonkey)은 JIT(Just-In-Time) 컴파일러를 통해 자주 실행되는 코드 경로를 기계어로 최적화하여 성능 격차를 줄였습니다.

**멀티 패러다임(Multi-Paradigm)** — 절차적·객체지향·함수형 스타일을 모두 지원합니다. 클래스 기반 상속도 가능하고, 함수를 일급 값으로 취급하는 함수형 프로그래밍도 자연스럽게 표현됩니다.

**이벤트 기반 비동기(Event-Driven Async)** — 단일 스레드로 동작하지만, 이벤트 루프를 통해 I/O를 비차단(non-blocking) 방식으로 처리합니다. 이 덕분에 수많은 동시 요청을 적은 자원으로 처리할 수 있습니다.

## 역사 — 표준화의 여정

![JavaScript 역사 타임라인](/assets/posts/js-what-is-javascript-timeline.svg)

1997년 ECMA International이 JavaScript를 "ECMAScript"라는 이름으로 표준화했습니다. ES3(1999)에서 정규식과 예외 처리가 추가되었고, ES5(2009)에서 `"use strict"`, `JSON`, `Array` 고차 메서드가 도입되었습니다. 그러나 진정한 현대 JavaScript의 시작은 **ES6/ES2015**입니다 — `let`, `const`, 화살표 함수, 클래스, 모듈, 프로미스 등 지금 우리가 당연하게 쓰는 기능들이 대거 추가되었습니다. 이후 TC39는 매년 새로운 버전을 출시하는 연간 릴리즈 체계로 전환했습니다.

## 브라우저 밖으로 — 실행 환경의 확장

```javascript
// 같은 JavaScript, 다른 실행 환경
// 브라우저
document.getElementById('app').textContent = 'Hello';

// Node.js (서버)
const fs = require('fs');
fs.writeFileSync('hello.txt', 'Hello');

// Deno (서버, 권한 기반 보안)
await Deno.writeTextFile('hello.txt', 'Hello');

// Bun (서버, JavaScriptCore 기반)
await Bun.write('hello.txt', 'Hello');
```

2009년 Ryan Dahl이 V8 엔진을 서버에서 실행할 수 있도록 만든 **Node.js**가 등장하면서 JavaScript는 브라우저를 벗어났습니다. 이후 보안 모델을 개선한 **Deno**, 성능에 집중한 **Bun**, 엣지 환경을 위한 **Cloudflare Workers** 등 다양한 런타임이 생태계를 풍성하게 만들었습니다.

## JavaScript를 배우는 이유

JavaScript는 학습 비용 대비 적용 범위가 매우 넓습니다. 하나의 언어로 브라우저 UI, 서버 API, CLI 도구, 모바일 앱(React Native), 데스크톱 앱(Electron), IoT 기기까지 개발할 수 있습니다. 또한 npm 생태계에는 200만 개 이상의 패키지가 존재해, 대부분의 문제에 이미 검증된 해결책이 있습니다.

물론 단점도 있습니다. 역사적으로 축적된 설계 결함(`typeof null === 'object'`, 암묵적 형변환 등), 지나치게 빠른 생태계 변화, 런타임 타입 오류 가능성 등입니다. 이 시리즈는 이러한 함정까지 포함해 JavaScript를 깊이 이해하는 것을 목표로 합니다.

---

**다음 글:** [ECMAScript 표준과 TC39 프로세스](/posts/js-ecmascript-standard/)

<br>
읽어주셔서 감사합니다. 😊
