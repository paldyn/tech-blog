---
title: "JavaScript란 무엇인가 — 브라우저 스크립팅에서 범용 언어로"
description: "JavaScript의 탄생 배경, 표준화 역사, 그리고 오늘날 브라우저·서버·모바일·IoT까지 뻗어나간 생태계를 한눈에 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-27"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "ecmascript", "history", "runtime", "browser"]
featured: false
draft: false
---

1995년 봄, Netscape의 개발자 Brendan Eich는 단 **10일** 만에 새로운 스크립팅 언어를 만들었습니다. 처음엔 "Mocha", 곧이어 "LiveScript"로 불렸다가, 당시 Java 열풍에 편승해 **JavaScript**라는 이름으로 출시됩니다. HTML 폼의 입력값을 서버에 보내기 전에 간단히 검증하는 게 전부였던 이 언어는, 30년이 지난 지금 Stack Overflow 설문에서 12년 연속으로 '가장 많이 사용하는 프로그래밍 언어' 1위를 차지하고 있습니다. 어떻게 이런 일이 가능했을까요?

## 탄생: 폼 검증기에서 시작

초창기 JavaScript의 역할은 정말 소박했습니다. 사용자가 이메일 주소를 잘못 입력했는지 확인하고, 필수 필드가 비어 있으면 경고를 보여주는 것이 전부였습니다. 당시에는 서버에 요청을 보내야만 입력 검증이 가능했기 때문에, 클라이언트 단에서 즉시 피드백을 줄 수 있다는 것 자체가 혁신이었습니다.

그러나 Netscape와 Microsoft(Internet Explorer) 사이의 '브라우저 전쟁'이 시작되면서 문제가 생겼습니다. 각 브라우저가 저마다 다른 방식으로 JavaScript를 구현했고, 개발자들은 두 브라우저 모두에서 동작하는 코드를 짜기 위해 이중으로 고생해야 했습니다.

## 표준화: ECMAScript의 탄생

이 혼란을 해결하기 위해 1996년 Netscape는 ECMA International이라는 표준화 단체에 JavaScript 명세를 제출합니다. 1997년 **ECMA-262**라는 이름으로 첫 번째 공식 표준이 탄생했고, 언어의 공식 이름은 **ECMAScript**가 됩니다. JavaScript는 Netscape의 상표명이므로, 표준 명세의 이름으로는 사용할 수 없었던 것이죠.

이후 TC39(Technical Committee 39)라는 위원회가 표준 발전을 이끌게 됩니다. 오늘날 Google, Mozilla, Apple, Microsoft 같은 주요 브라우저 벤더와 Facebook, Airbnb 같은 기술 기업 개발자들이 이 위원회에 참여해 새 기능을 제안하고 토론합니다. 언어의 민주적인 발전 체계인 셈입니다.

## Node.js: 서버로의 도약

2009년은 JavaScript 역사에서 가장 중요한 해 중 하나입니다. Ryan Dahl이 **Node.js**를 발표하며 JavaScript를 브라우저 밖으로 꺼냈습니다. V8 엔진(Google Chrome의 JavaScript 엔진)을 기반으로 한 Node.js는 JavaScript가 서버에서도 실행될 수 있게 해줬습니다.

npm(Node Package Manager)과 함께 성장한 Node.js 생태계는 폭발적으로 팽창했습니다. 오늘날 npm 레지스트리에는 200만 개가 넘는 패키지가 존재하며, 이는 어떤 언어의 패키지 저장소보다도 큰 규모입니다.

![JavaScript 진화 타임라인](/assets/posts/js-what-is-javascript-evolution.svg)

## JavaScript = ECMAScript + DOM + BOM

한 가지 자주 혼동되는 개념을 짚고 넘어가겠습니다. 흔히 우리가 "JavaScript"라고 부르는 것은 사실 세 가지 요소의 집합입니다.

**ECMAScript**는 언어의 핵심 명세입니다. 변수, 함수, 클래스, 모듈, Promise 같은 언어 자체의 문법과 동작 규칙이 여기에 정의됩니다. 브라우저든 Node.js든 Deno든, 어느 환경에서나 동일하게 동작해야 하는 부분이죠.

**DOM(Document Object Model) API**는 브라우저가 제공하는, HTML 문서를 조작하기 위한 인터페이스입니다. `document.querySelector()`, `addEventListener()` 같은 함수들이 여기에 속합니다. W3C와 WHATWG라는 단체가 표준을 정의하지만, ECMAScript와는 별개입니다.

**BOM(Browser Object Model) API**는 브라우저 자체를 제어하는 인터페이스입니다. `window`, `location`, `navigator`, `history` 같은 객체가 여기에 해당합니다. 엄밀한 표준 없이 브라우저 벤더들이 구현해왔으나, 점차 공식 명세로 편입되고 있습니다.

![JavaScript 구성 요소](/assets/posts/js-what-is-javascript-structure.svg)

## 오늘날의 JavaScript

현재 JavaScript는 다음과 같은 곳에서 실행됩니다.

**웹 브라우저**: 여전히 JavaScript의 고향입니다. Chrome, Firefox, Safari, Edge 모두 정교한 JavaScript 엔진을 탑재하고 있으며, 복잡한 웹 앱(Gmail, Figma, Google Docs)이 이를 기반으로 돌아갑니다.

**서버**: Node.js, Deno, Bun 등의 런타임이 서버사이드 개발을 지원합니다. Netflix, LinkedIn, PayPal 같은 대형 서비스가 Node.js로 API 서버를 운영합니다.

**모바일 앱**: React Native, Expo를 통해 iOS와 Android 앱을 JavaScript로 만들 수 있습니다. Facebook, Instagram, Discord 앱이 이 기술을 사용합니다.

**데스크톱 앱**: Electron(VS Code, Slack, Figma 데스크톱 앱), Tauri를 통해 크로스플랫폼 데스크톱 앱을 만들 수 있습니다.

**엣지·IoT**: Cloudflare Workers, Vercel Edge Functions 같은 CDN 엣지 환경에서 JavaScript가 실행되며, Espruino 같은 마이크로컨트롤러에도 이식되어 있습니다.

## JavaScript라는 이름의 역설

"Java와 JavaScript의 관계는 Car와 Carpet의 관계와 같다"라는 유명한 농담이 있습니다. 두 언어는 이름만 비슷할 뿐, 설계 철학이나 동작 방식이 전혀 다릅니다. Java는 정적 타입, 클래스 기반의 컴파일 언어이고, JavaScript는 동적 타입, 프로토타입 기반의 인터프리터 언어입니다.

마케팅 목적으로 'Java'를 이름에 붙였던 초창기 결정이 지금까지도 혼란을 유발하고 있는 셈이죠. 하지만 이 혼란스러운 이름을 가진 언어가 전 세계 웹을 움직이고 있다는 사실만큼은 변함이 없습니다.

## 왜 JavaScript를 배워야 하는가

JavaScript는 배우기 쉬운 언어가 아닙니다. 암묵적 타입 변환, `this`의 복잡한 동작, 비동기 처리의 함정, 프로토타입 기반 상속 등 처음 접하면 당혹스러운 특성이 많습니다.

그러나 이 언어는 **브라우저에서 실행되는 유일한 언어**입니다. WebAssembly가 등장했지만, 아직도 웹 프론트엔드를 직접 다루려면 JavaScript를 이해해야 합니다. 게다가 Node.js 덕분에 하나의 언어로 프론트엔드와 백엔드를 모두 개발할 수 있다는 점은 생산성 면에서 큰 장점입니다.

이 시리즈는 JavaScript의 겉모습이 아닌 **본질**을 파고들기 위해 기획되었습니다. 언어가 왜 이렇게 동작하는지, 어떤 역사적 맥락에서 이런 설계 결정이 이루어졌는지를 이해하면, 예상치 못한 버그를 만났을 때도 당황하지 않고 원인을 찾을 수 있게 됩니다.

---

**다음 글:** [ECMAScript 표준과 버전 이름 — ES5·ES6·ES2015~ES2024](/posts/js-ecmascript-standard/)

<br>
읽어주셔서 감사합니다. 😊
