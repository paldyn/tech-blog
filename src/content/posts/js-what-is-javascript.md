---
title: "JavaScript란 무엇인가 — 브라우저 스크립팅에서 범용 언어로"
description: "JavaScript의 탄생 배경, Java와의 차이, 그리고 브라우저를 넘어 서버·모바일·엣지까지 확장된 범용 언어로서의 JavaScript를 소개합니다."
author: "PALDYN Team"
pubDate: "2026-04-22"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "ECMAScript", "history", "runtime", "web"]
featured: false
draft: false
---

1995년, Netscape의 개발자 Brendan Eich는 단 **10일** 만에 새로운 언어를 만들어냈습니다. 그 이름은 처음에 Mocha, 이후 LiveScript였다가 마케팅 이유로 최종적으로 **JavaScript**가 되었습니다. Java가 한창 인기를 끌던 시절, 이름을 빌린 것인데—오늘날까지 수많은 오해의 씨앗이 되고 있습니다. 이번 시리즈에서는 JavaScript의 본질부터 최신 생태계까지 낱낱이 파헤쳐 봅니다.

## JavaScript가 탄생한 이유

1990년대 초 웹 브라우저는 정적 HTML만 보여줄 수 있었습니다. 폼 입력값 유효성 검사 하나도 서버에 요청을 보내야 했고, 느린 모뎀 환경에서 이는 엄청난 UX 문제였습니다. Netscape는 "브라우저 안에서 직접 실행되는 가벼운 스크립팅 언어"가 필요하다고 판단했고, 그 결과로 탄생한 것이 JavaScript입니다.

초기 JavaScript의 목적은 단순했습니다:
- 폼 입력 검증
- 간단한 DOM 조작
- 동적 경고창 표시

아무도 이 언어가 30년 후 서버·모바일·엣지 컴퓨팅까지 지배하게 될 것이라 예상하지 못했습니다.

![JavaScript의 진화](/assets/posts/js-what-is-javascript-evolution.svg)

## JavaScript와 Java — 이름만 같은 두 언어

가장 흔한 혼동부터 짚고 넘어갑시다. **JavaScript와 Java는 전혀 다른 언어입니다.** 이름이 비슷한 것은 순전히 마케팅 전략이었고, 언어의 설계 철학과 쓰임새는 완전히 다릅니다.

![JavaScript vs Java](/assets/posts/js-what-is-javascript-vs-java.svg)

Java는 "Write Once, Run Anywhere"를 목표로 JVM 위에서 컴파일된 바이트코드를 실행하는 정적 타입 언어입니다. 반면 JavaScript는 인터프리터 방식(현재는 JIT 컴파일 포함)의 동적 타입 언어로, 브라우저 엔진 위에서 소스 코드 그대로 실행됩니다.

```javascript
// JavaScript — 동적 타입
let x = 42;
x = "hello";    // 타입 변경 가능, 오류 없음
x = { name: "JS" };  // 객체로도 변경 가능
```

```java
// Java — 정적 타입
int x = 42;
// x = "hello";  // 컴파일 오류 — 타입 불일치
```

## ECMAScript와의 관계

JavaScript는 구현체이고, **ECMAScript**는 그 명세(specification)입니다. ECMA International의 TC39 위원회가 ECMAScript 표준을 관리하며, 각 브라우저 벤더(Google, Mozilla, Apple 등)가 이 표준에 따라 각자의 엔진을 구현합니다.

```
ECMAScript 명세
    ├── V8 (Chrome, Node.js)       ← Google 구현체
    ├── SpiderMonkey (Firefox)     ← Mozilla 구현체
    └── JavaScriptCore (Safari)    ← Apple 구현체
```

ES5(2009), ES6/ES2015(2015) 등 버전명을 들어보셨을 겁니다. 이 버전 이야기는 다음 글에서 자세히 다룹니다.

## 브라우저를 넘어선 JavaScript

2009년 Ryan Dahl이 **Node.js**를 발표하면서 JavaScript는 서버 사이드로 확장됩니다. V8 엔진을 브라우저 밖으로 꺼내 파일 시스템, 네트워크 I/O와 연결한 것입니다. 이 사건은 JavaScript 생태계를 완전히 바꿔놓았습니다.

현재 JavaScript가 활약하는 영역:

| 영역 | 주요 런타임/도구 |
|------|-----------------|
| 브라우저 | Chrome, Firefox, Safari |
| 서버 | Node.js, Deno, Bun |
| 모바일 앱 | React Native, Expo |
| 데스크톱 | Electron, Tauri |
| 엣지/CDN | Cloudflare Workers, Deno Deploy |
| IoT/임베디드 | Espruino, Moddable |

## JavaScript의 핵심 특성

**싱글 스레드 + 이벤트 루프**: JavaScript는 한 번에 하나의 코드만 실행하는 싱글 스레드 언어이지만, 이벤트 루프를 통해 비동기 I/O를 효율적으로 처리합니다. 이 구조 덕분에 적은 자원으로 많은 동시 연결을 처리할 수 있습니다.

**인터프리터 + JIT 컴파일**: 초기에는 순수 인터프리터 방식이었지만, V8 같은 현대 엔진은 자주 실행되는 코드를 기계어로 JIT 컴파일하여 성능을 크게 높였습니다.

**프로토타입 기반 객체 지향**: 클래스 기반 상속(Java, C++)과 달리, JavaScript는 프로토타입 체인을 통한 상속을 사용합니다. ES6에서 `class` 키워드가 추가됐지만 내부적으로는 여전히 프로토타입입니다.

**일급 함수(First-class functions)**: 함수를 변수에 담고, 인자로 넘기고, 반환값으로 사용할 수 있습니다. 이 특성이 클로저, 고차 함수, 함수형 프로그래밍을 가능하게 합니다.

## JavaScript를 배워야 하는 이유

GitHub의 언어 통계, Stack Overflow 개발자 설문, TIOBE 인덱스를 막론하고 JavaScript는 매년 가장 많이 사용되는 언어 1위를 차지합니다. 이유는 단순합니다:

- 브라우저에서 실행되는 **유일한** 스크립팅 언어
- 프론트엔드와 백엔드를 **같은 언어**로 개발 가능
- npm에 **200만 개 이상**의 패키지
- React, Vue, Angular, Next.js 등 방대한 프레임워크 생태계

JavaScript를 이해한다는 것은 웹의 작동 원리를 이해하는 것과 같습니다. 이 시리즈가 그 이해를 단단하게 만드는 데 도움이 되기를 바랍니다.

---

**다음 글:** [ECMAScript 표준과 버전 이름 (ES5·ES6·ES2015~ES2024)](/posts/js-ecmascript-standard/)

<br>
읽어주셔서 감사합니다. 😊
