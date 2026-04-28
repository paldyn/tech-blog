---
title: "[Nexacro N] HTML5 런타임 동작 원리"
description: "Nexacro N이 플러그인 없이 브라우저에서 동작하는 방법, Canvas 기반 렌더링 구조, 초기화 시퀀스와 배포 파일 구성을 상세히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 2
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "html5", "런타임", "canvas", "렌더링"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-when-to-use/)에서 Nexacro N이 적합한 프로젝트 유형을 살펴봤습니다. 이번에는 한 단계 더 들어가서 "Nexacro N이 브라우저 안에서 어떻게 살아 움직이는가"를 런타임 관점에서 풀어봅니다. 이 구조를 이해하면 성능 튜닝이나 트러블슈팅 시 원인을 훨씬 빠르게 찾을 수 있습니다.

## ActiveX에서 HTML5로

Nexacro Platform 시절 핵심 고통 중 하나는 **NPXLCF(Nexacro Platform Cross-Layer Communication Framework) ActiveX 플러그인**이었습니다. 화면을 렌더링하는 엔진 자체가 ActiveX 형태로 브라우저에 주입되었기 때문에, IE11이 아닌 환경에서는 아무것도 동작하지 않았습니다. 사내 PC에 플러그인 설치가 안 되어 있으면 화면이 흰 화면으로만 뜨는 경험은 Nexacro Platform 개발자라면 누구나 한 번씩 겪었습니다.

Nexacro N은 이 플러그인 의존성을 완전히 제거했습니다. 렌더링 엔진이 순수 JavaScript로 재작성되었고, 컴포넌트를 DOM 요소 대신 **HTML5 Canvas 위에 직접 그리는** 방식으로 전환했습니다. 덕분에 플러그인 설치 없이 Chrome, Edge, Firefox, Safari 모두에서 동일한 화면이 출력됩니다.

## 런타임 3계층 구조

![Nexacro N HTML5 런타임 구조](/assets/posts/nexacro-n-runtime-html5-architecture.svg)

런타임은 크게 3개의 계층으로 나뉩니다.

**브라우저 계층**은 Nexacro N이 의존하는 Web API를 제공합니다. Canvas 2D API로 컴포넌트를 그리고, CSS Variables로 테마를 적용하며, Fetch API로 서버와 통신합니다. WebSocket은 실시간 알림이나 SSE 연동에 사용할 수 있습니다.

**Nexacro N 런타임 엔진 계층**은 `nexacro.js`라는 단일 JavaScript 번들로 배포됩니다. 이 파일 안에 네 가지 핵심 서브시스템이 포함되어 있습니다.

- **컴포넌트 렌더러**: Grid, Edit, Button 같은 컴포넌트를 Canvas 위에 픽셀 단위로 그립니다. 10만 행짜리 Grid도 화면에 보이는 행만 실제로 그리는 가상화(virtualization) 덕분에 렌더링 성능이 유지됩니다.
- **이벤트 시스템**: DOM 이벤트를 내부적으로 추상화해 Nexacro의 버블링·캡처링 모델로 변환합니다. `onClick`, `onchanged`, `onkeydown` 같은 Nexacro 이벤트가 이 시스템을 통해 전달됩니다.
- **Dataset 관리자**: 메모리 내 테이블 구조로 데이터를 보관하고, 컴포넌트와의 바인딩을 유지합니다. Dataset의 행이 바뀌면 그에 연결된 Grid나 Edit가 자동으로 다시 그려집니다.
- **Transaction 관리자**: PL Protocol(Nexacro 전용 데이터 포맷) 기반의 HTTP 통신을 담당합니다. `transaction()` 호출 하나로 Input Dataset을 서버로 보내고 Output Dataset을 받아 바인딩까지 처리합니다.

**애플리케이션 파일 계층**은 개발자가 작성하는 파일들입니다. `.xfdl` 폼 파일, `.js` 스크립트, `.css` 테마, TypeDef XML, 환경설정 XML이 웹서버에 정적 파일로 배포됩니다.

## Canvas 렌더링의 의미

일반적인 웹 프레임워크(React, Vue)는 HTML DOM 요소를 생성해서 브라우저의 레이아웃 엔진이 그리도록 위임합니다. Nexacro N은 다른 접근법을 씁니다. 컴포넌트 하나하나가 `<canvas>` 태그 위에 JavaScript 코드로 직접 그려집니다.

이 방식의 장점은 **DOM 트리 크기와 렌더링 성능이 독립적**이라는 점입니다. 10만 행의 Grid가 있어도 DOM에는 Canvas 요소 하나만 존재하고, 실제로 화면에 보이는 행 20여 개만 그립니다. React 기반의 가상 스크롤링도 비슷한 아이디어지만, Nexacro N은 프레임워크 레벨이 아니라 렌더링 엔진 레벨에서 이를 처리합니다.

단점은 브라우저 DevTools로 컴포넌트 DOM을 검사할 수 없다는 점입니다. Nexacro Studio의 내장 디버거나 Runtime Debug 도구를 사용해야 컴포넌트 상태를 확인할 수 있습니다.

## 초기화 시퀀스

![HTML5 런타임 초기화 시퀀스](/assets/posts/nexacro-n-runtime-html5-lifecycle.svg)

브라우저가 Nexacro N 앱을 로드할 때 다섯 단계를 거칩니다.

1. `nexacro.js` 스크립트가 로드되면서 런타임 엔진이 메모리에 초기화됩니다.
2. `service.xml`(또는 `environment.xml`)을 파싱해 서비스 URL 맵과 환경 설정을 등록합니다.
3. TypeDef XML을 읽어 사용자 정의 컴포넌트와 타입을 런타임에 등록합니다.
4. 진입점 폼(`.xfdl`)을 파싱해 컴포넌트 트리를 생성하고 Canvas에 초기 렌더링을 수행합니다.
5. 폼의 `onload` 이벤트가 발생하면 개발자가 작성한 초기화 스크립트가 실행됩니다.

이 시퀀스에서 ②번의 `service.xml` 파싱이 실패하면 어떤 폼도 열리지 않습니다. 운영 환경 배포 후 화면이 흰 화면으로만 뜨는 경우 `service.xml` 경로 오류를 가장 먼저 확인해야 하는 이유입니다.

## 배포 파일 구성

Nexacro Studio N으로 빌드(패키징)하면 다음과 같은 파일 구조가 만들어집니다.

```
dist/
  nexacro.js          ← 런타임 엔진 번들
  service.xml         ← 서비스 URL·환경 설정
  TypeDef/            ← TypeDef XML 파일들
  form/               ← .xfdl 폼 파일들
  script/             ← .js 스크립트 파일들
  css/                ← 테마 CSS 파일들
  index.html          ← 진입점
```

`index.html`의 핵심은 `nexacro.js`를 로드한 다음 `nexacro.init()` 호출 한 줄입니다.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="nexacro/nexacro.js"></script>
</head>
<body>
  <script>
    nexacro.init({
      startForm  : "frame/MainFrame",
      serviceURL : "service.xml",
      targetID   : "container"
    });
  </script>
  <div id="container" style="width:100%;height:100vh;"></div>
</body>
</html>
```

`startForm`에는 진입 폼의 TypeDef 상 경로를 지정합니다. `targetID`는 Canvas가 마운트될 DOM 요소 ID입니다. 이 세 가지 파라미터만 맞으면 런타임이 나머지를 모두 처리합니다.

## 런타임 버전과 업데이트

Nexacro N의 런타임 버전은 `nexacro.js` 파일 내부에 기재되어 있습니다. 서버에 배포된 `nexacro.js` 버전과 Studio에서 빌드할 때 사용한 런타임 버전이 다르면 예상치 못한 렌더링 오류가 발생할 수 있습니다. 특히 그리드 셀 타입이나 스타일 속성이 버전에 따라 행동이 바뀌는 경우가 있으므로, 빌드 환경과 배포 환경의 런타임 버전을 반드시 일치시켜야 합니다.

```javascript
// 런타임 버전 확인 (브라우저 콘솔)
console.log(nexacro.version);
// 예: "24.0.0.2400"
```

버전 앞 두 자리가 메이저 릴리즈를 나타냅니다. 24.x대는 2024년 릴리즈 기준이며, Nexacro 공식 포털에서 최신 런타임 파일을 내려받아 교체할 수 있습니다.

---

**지난 글:** [Nexacro N, 언제 도입해야 하는가](/posts/nexacro-n-when-to-use/)

**다음 글:** [Nexacro N 라이선스와 배포 구조](/posts/nexacro-n-license-and-deployment/)

<br>
읽어주셔서 감사합니다. 😊
