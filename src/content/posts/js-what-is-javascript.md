---
title: "JavaScript란 무엇인가 — 브라우저 스크립팅에서 범용 언어로"
description: "1995년 10일 만에 탄생한 JavaScript가 어떻게 세계에서 가장 많이 쓰이는 범용 언어가 되었는지, 역사와 생태계를 한눈에 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-27"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "역사", "ecmascript", "nodejs", "브라우저"]
featured: false
draft: false
---

웹 페이지에 처음 동작을 불어넣던 작은 스크립트 언어가 오늘날 브라우저·서버·모바일·데스크탑·IoT를 아우르는 범용 언어가 되기까지, JavaScript의 여정은 어떤 프로그래밍 언어도 따라가기 힘든 독특한 역사를 갖고 있습니다. 이 시리즈 **JavaScript 완전정복**은 그 역사와 내부 원리, 실전 패턴을 처음부터 끝까지 훑어봅니다. 첫 번째 글인 이번 편에서는 JavaScript가 무엇인지, 어떻게 태어나 지금에 이르렀는지 살펴봅니다.

## 브라우저 전쟁과 JavaScript의 탄생

1990년대 중반은 웹 브라우저 시장을 두고 Netscape와 Microsoft가 격렬하게 다투던 시대였습니다. Netscape는 정적인 HTML 페이지에 동적인 기능을 더할 수단이 필요했고, 1995년 Brendan Eich에게 그 역할을 맡겼습니다. 그가 받은 시간은 단 **10일**이었습니다.

초안은 Mocha라는 이름으로 시작했다가 LiveScript로 바뀌고, 최종적으로 **JavaScript**가 되었습니다. 당시 Sun Microsystems의 Java가 개발자들 사이에서 큰 인기를 끌고 있었기 때문에, Netscape는 마케팅 효과를 노려 이름에 "Java"를 붙였습니다. 두 언어는 사실 전혀 다른 설계 철학을 가지고 있지만, 이 작명 덕분에 수십 년이 지난 지금도 혼동이 이어지고 있습니다.

![JavaScript 역사 타임라인](/assets/posts/js-what-is-javascript-history.svg)

## Java와 JavaScript — 이름의 함정

Java와 JavaScript의 관계를 비유로 설명하자면, **햄과 햄스터**의 관계와 같습니다. 이름은 비슷하지만 근본적으로 다른 생물입니다.

| 항목 | Java | JavaScript |
|---|---|---|
| 패러다임 | 엄격한 OOP, 정적 타입 | 멀티 패러다임, 동적 타입 |
| 실행 방식 | JVM에서 컴파일 후 실행 | 엔진에서 인터프리트/JIT |
| 용도 | 엔터프라이즈 백엔드, Android | 웹, 서버, 모바일, 임베디드 |
| 설계자 | James Gosling | Brendan Eich |

JavaScript는 C와 Self, Scheme 언어에서 영향을 받았습니다. 겉으로 보이는 중괄호 문법은 C에서, 프로토타입 기반 객체 모델은 Self에서, 일급 함수와 클로저는 Scheme에서 왔습니다.

## ECMAScript: 표준의 이름

Netscape Navigator에서만 돌아가던 JavaScript는 곧 Microsoft의 JScript, 다른 벤더들의 유사 구현과 충돌하기 시작했습니다. 브라우저마다 동작이 다르다는 것은 개발자들에게 악몽이었습니다.

해결책은 표준화였습니다. 1997년 **ECMA International**이 언어 명세를 표준으로 정의하면서 이름을 **ECMAScript**로 지었습니다. 상표권 문제로 "JavaScript"라는 이름 대신 중립적인 명칭을 선택한 것입니다.

이후 우리가 "JavaScript"라고 부르는 것은 ECMAScript 표준을 따르는 구현체를 통칭하는 표현이 되었습니다. 명세를 따르는 엔진이라면 누구든 JavaScript를 구현할 수 있고, V8(Chrome), SpiderMonkey(Firefox), JavaScriptCore(Safari)가 그 대표적인 사례입니다.

## 브라우저 밖으로: Node.js의 등장

2009년은 JavaScript 역사의 두 번째 분기점이었습니다. Ryan Dahl은 Google이 오픈소스로 공개한 V8 엔진을 꺼내어 브라우저 바깥에서 동작하는 런타임, **Node.js**를 만들었습니다.

Node.js의 혁신은 단순히 "서버에서도 JS를 쓸 수 있게 됐다"는 것이 아니었습니다. 이벤트 루프 기반의 비동기 I/O 모델을 통해 I/O 집약적인 작업에서 탁월한 성능을 발휘했고, npm 패키지 생태계가 폭발적으로 성장하면서 **하나의 언어로 풀스택 개발을 할 수 있는 시대**가 열렸습니다.

## ES6 / ES2015: 대전환

2015년 ECMAScript 2015(흔히 ES6라 불림)가 발표되면서 JavaScript는 완전히 새로운 모습으로 탈바꿈했습니다. 수년간 논의해온 결과물이 한꺼번에 쏟아졌습니다.

- **let / const**: 블록 스코프 변수 선언
- **화살표 함수**: 더 간결한 문법과 `this` 바인딩 개선
- **클래스 문법**: 프로토타입 기반 상속을 선언적으로 표현
- **모듈 시스템**: `import / export`로 코드 분리
- **Promise**: 비동기 처리의 패러다임 전환
- **템플릿 리터럴**, **디스트럭처링**, **스프레드 연산자** 등

ES6 이후 ECMAScript는 **매년 개정**되는 방식으로 바뀌었습니다. ES2016, ES2017... 이렇게 연도 기반으로 버전을 명명하며 꾸준히 새 기능을 추가하고 있습니다.

## 오늘의 JavaScript — 범용 언어

![JavaScript 실행 환경](/assets/posts/js-what-is-javascript-ecosystem.svg)

오늘날 JavaScript가 실행되는 환경을 나열하면 놀라울 정도입니다.

- **브라우저**: 모든 현대 웹 브라우저는 JS 엔진을 내장합니다
- **서버**: Node.js, Deno, Bun으로 백엔드 서비스 구축
- **모바일**: React Native, Expo로 iOS·Android 동시 개발
- **데스크탑**: Electron(VS Code, Slack, Figma가 이 기반), Tauri
- **엣지 컴퓨팅**: Cloudflare Workers, Vercel Edge Functions
- **IoT**: Espruino, JerryScript 등이 초소형 기기에서 동작

Stack Overflow의 개발자 설문조사에서 JavaScript는 10년 이상 연속으로 가장 많이 사용되는 프로그래밍 언어 1위를 지키고 있습니다. GitHub에서 가장 많은 저장소가 작성된 언어이기도 합니다.

## 왜 JavaScript인가

JavaScript를 배워야 하는 이유는 단순한 인기를 넘어섭니다.

**접근성**: 브라우저만 있으면 별도의 설치 없이 즉시 실험할 수 있습니다. 개발자 도구(F12)의 콘솔 탭이 곧 REPL 환경입니다.

**범용성**: 위에서 살펴봤듯, 하나의 언어로 클라이언트부터 서버, 모바일, 데스크탑까지 커버할 수 있습니다. 팀 내에서 언어 경계를 허무는 것은 생산성과 커뮤니케이션 효율을 크게 높입니다.

**생태계**: npm에는 200만 개가 넘는 패키지가 등록되어 있습니다. 거의 모든 문제에 대해 검증된 라이브러리가 이미 존재합니다.

**진화**: TC39 위원회는 매년 새 기능을 검토·추가합니다. 언어 자체가 활발히 발전하고 있어, 배움이 지속적으로 가치 있습니다.

다음 글에서는 이 언어의 표준을 관리하는 **ECMAScript의 버전 체계**를 자세히 살펴봅니다. ES5, ES6, ES2015부터 ES2024까지 각 버전이 무엇을 바꿔놓았는지 정리해 드리겠습니다.

---

**다음 글:** [ECMAScript 표준과 버전 이름 (ES5·ES6·ES2015~ES2024)](/posts/js-ecmascript-standard/)

<br>
읽어주셔서 감사합니다. 😊
