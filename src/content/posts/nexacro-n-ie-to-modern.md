---
title: "[Nexacro N] IE에서 모던 브라우저로 전환"
description: "Nexacro N 프로젝트에서 IE 전용 코드와 패턴을 모던 브라우저 호환 표준 방식으로 전환하는 방법을 설명합니다. ActiveX 제거, IE 전용 DOM API 교체, 파일 업로드 마이그레이션 등 실제 이슈와 해결 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 1
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "IE", "모던브라우저", "ActiveX", "마이그레이션", "크롬", "엣지"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-legacy-component-replace/)에서 레거시 컴포넌트를 체계적으로 교체하는 전략을 살펴보았다. 이제 그 연장선에서 가장 흔하게 만나는 레거시 — IE 전용 코드 — 를 실제로 어떻게 모던 브라우저 표준으로 전환하는지 알아본다.

국내 기업용 시스템은 Nexacro N으로 전환하면서도 오래된 IE 의존 코드가 남아 있는 경우가 많다. Nexacro N은 HTML5 런타임을 사용하므로 원칙적으로 IE 전용 코드가 필요 없다. 하지만 Nexacro 14나 Platform 시절에 작성된 코드가 그대로 이식된 경우, 또는 외부 시스템 연동을 위해 WebBrowser 컴포넌트 안에 IE 전용 JavaScript를 쓴 경우라면 적극적으로 교체해야 한다.

## IE 의존성 종류와 전환 우선순위

![IE 전용 패턴과 모던 표준 대체](/assets/posts/nexacro-n-ie-to-modern-compat.svg)

IE 의존성은 크게 다섯 범주로 나뉜다.

**ActiveX 컴포넌트**가 가장 시급하다. 그리드 출력, 파일 업로드, 전자서명 등에 ActiveX를 사용하는 경우 크롬과 엣지에서는 아예 실행되지 않는다. Nexacro N의 네이티브 컴포넌트나 HTML5 표준 API로 교체해야 한다.

**IE 전용 DOM API**(`document.all`, `attachEvent`, `window.showModalDialog`)는 Nexacro N의 Script 환경에서 직접 사용할 이유가 없다. Nexacro의 이벤트 핸들러와 팝업 API로 대체한다.

**IE 전용 CSS 필터**는 Nexacro의 CSS-like 속성(`background-color`, `box-shadow`)으로 교체한다. Nexacro N의 스타일 시스템은 표준 CSS 문법을 따르므로 `progid:DXImageTransform` 구문은 무시된다.

**VBScript·JScript**는 Nexacro 14 환경에서 일부 프로젝트가 사용했지만 Nexacro N의 Script 엔진은 표준 JavaScript다. 해당 코드를 JavaScript로 완전히 재작성해야 한다.

**WebBrowser 컴포넌트 내부 HTML**이 IE 렌더러를 전제하고 작성된 경우 가장 까다롭다. `document.all` 대신 `document.getElementById`, `attachEvent` 대신 `addEventListener`를 사용하도록 수정한다.

## ActiveX 파일 업로드 제거

가장 빈번하게 나오는 케이스다.

![파일 업로드 전환 코드 비교](/assets/posts/nexacro-n-ie-to-modern-code.svg)

ActiveX 기반 파일 업로드 컴포넌트는 완전히 제거하고 Nexacro N의 `FileUpload` 컴포넌트로 교체한다.

```nexacro
// 기존 ActiveX 코드 제거 후 — FileUpload 컴포넌트 이벤트
function FileUpload00_oncomplete(obj, e) {
    if (e.errorcode != 0) {
        alert("업로드 실패: " + e.errormessage);
        return;
    }
    // 서버 응답 처리
    var sFilePath = e.responsetexts["filePath"];
    Edit_filePath.set_value(sFilePath);
    fn_afterUpload();
}

function FileUpload00_onprogress(obj, e) {
    ProgressBar00.set_value(e.percent);
}
```

`FileUpload` 컴포넌트는 `oncomplete`, `onerror`, `onprogress` 이벤트를 제공한다. 서버 사이드는 multipart/form-data를 받으면 되므로 Spring의 `MultipartFile`이나 Node.js의 `multer`와 바로 연동된다.

## WebBrowser 내부 JavaScript 현대화

`WebBrowser` 컴포넌트로 외부 HTML 페이지를 로드하는 경우, 해당 HTML 파일의 JavaScript도 정리해야 한다.

```javascript
// chart.html 내부 — Before (IE 전용)
document.all["myDiv"].innerHTML = data;
element.attachEvent("onclick", handler);
window.showModalDialog("popup.html", null, "");

// chart.html 내부 — After (표준)
document.getElementById("myDiv").textContent = data;
element.addEventListener("click", handler);
// Nexacro 팝업으로 대체하거나 fetch + 인라인으로 처리
```

HTML 파일을 현대화할 때 `doctype`도 반드시 확인한다. `<!DOCTYPE html>`이 없으면 쿼크 모드로 렌더링되어 레이아웃이 깨진다.

## IE 조건부 코드 블록 제거

오래된 코드베이스에는 IE를 감지하는 조건 분기가 남아 있는 경우가 있다.

```nexacro
// 제거 대상 — IE 감지 분기
var sAgent = nexacro.navigator.userAgent;
if (sAgent.indexOf("Trident") > -1) {
    // IE 전용 처리
    fn_initForIE();
} else {
    fn_init();
}

// 정리 후 — 분기 제거, 단일 경로
fn_init();
```

`nexacro.navigator.userAgent`로 IE를 감지하는 코드를 모두 찾아서 IE 분기를 제거하고 단일 코드 경로로 합친다. 프로젝트 전체 검색으로 `"Trident"`, `"MSIE"`, `attachEvent`, `document.all` 키워드를 일괄 검색하면 작업 범위를 파악할 수 있다.

## 전자서명 컴포넌트 대체

전자서명은 ActiveX 의존도가 높은 영역이다. 선택지는 세 가지다.

첫째, 공인 전자서명이 아니어도 되는 경우 Nexacro의 기본 서명 기능(터치 패드 기반)을 사용한다. 둘째, 공공기관 연동이 필요한 경우 JavaScript SDK를 제공하는 최신 공인인증 솔루션(npki.js 등)으로 교체한다. 셋째, 이행 기간 동안은 WebBrowser 컴포넌트 안에서 최신 브라우저 호환 서명 라이브러리(signature_pad.js 등)를 사용하는 방법도 있다.

## 검증 방법

전환 후에는 세 가지 브라우저에서 반드시 확인한다. Chrome 최신, Edge 최신, 그리고 Nexacro N Studio의 내장 브라우저(크로미엄 기반)가 모두 동일하게 동작해야 한다. IE 모드 엣지에서 의도적으로 열었을 때 오작동하는 코드도 식별해서 정리한다.

---

**지난 글:** [레거시 컴포넌트 교체 전략](/posts/nexacro-n-legacy-component-replace/)

**다음 글:** [Nexacro N 어댑터 개요](/posts/nexacro-n-adapter-overview/)

<br>
읽어주셔서 감사합니다. 😊
