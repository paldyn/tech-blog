---
title: "[Nexacro N] Nexacro 14 → Platform → N · V24 진화"
description: "Nexacro가 ActiveX 기반 14버전에서 HTML5 순수 기반의 N과 V24까지 어떻게 진화해왔는지, 각 버전의 핵심 변화와 마이그레이션 포인트를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-26"
archiveOrder: 2
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "nexacro-platform", "v24", "migration", "history"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-what-is-nexacro/)에 이어 이 글은 **Nexacro N 기준**으로 작성되었습니다.

[지난 글](/posts/nexacro-n-what-is-nexacro/)에서 Nexacro N이 RIA 시대의 흐름 위에서 탄생한 엔터프라이즈 UI 플랫폼이라는 점을 살펴봤습니다. 그런데 현장에서는 "우리 시스템이 Nexacro 14인지 Platform인지 N인지 모르겠다", "Platform에서 N으로 올리면 코드를 많이 고쳐야 하나?" 하는 질문이 끊이지 않습니다. 이 글에서는 버전 간 무엇이 바뀌었는지, 어떤 부분이 호환되고 어디서 주의해야 하는지를 구체적으로 살펴봅니다.

## Nexacro 14 — C/S를 웹으로 옮기다

Nexacro의 출발점인 **Nexacro 14**는 2010년대 초 국내 대기업 그룹웨어와 ERP 시장에서 인기를 얻었습니다. 핵심 특징은 **ActiveX 기반 런타임**이었습니다. Internet Explorer 안에서 ActiveX 컨트롤로 구동되면서, 데스크톱 애플리케이션 수준의 Grid 편집 경험과 다양한 컴포넌트를 제공했습니다.

```javascript
// Nexacro 14 시절의 전형적인 조회 패턴 (현재와 거의 동일)
function fn_search() {
    this.transaction(
        "search",
        "svc::HRService.do",
        "input=ds_cond",
        "output=ds_emp",
        "",
        "fn_searchCallback"
    );
}

function fn_searchCallback(sId, nErrorCd, sErrorMsg) {
    if (nErrorCd < 0) {
        alert(sErrorMsg);
        return;
    }
    // 이 콜백 패턴은 N/V24에서도 그대로 통용됨
    grd_emp.setBindDataset("ds_emp");
}
```

14버전의 `transaction()` 패턴은 현재 Nexacro N·V24에서도 거의 그대로 사용됩니다. 핵심 API 설계가 버전을 뛰어넘어 유지되었기 때문에, 14 시절 개발자들이 N으로 넘어올 때 비즈니스 로직 재학습 부담이 적습니다.

단점은 명확했습니다. IE가 필수였고, 모바일에서는 동작하지 않았으며, ActiveX 설치 정책 이슈로 배포가 번거로웠습니다.

## Nexacro Platform — HTML5로 발을 내딛다

2013년 전후에 등장한 **Nexacro Platform**은 ActiveX 의존을 줄이고 HTML5 기반 런타임으로 이전하는 과도기 버전입니다. 브라우저 플러그인 없이 Chrome, Firefox에서도 구동이 가능해졌고, 기업 시스템의 IE 탈피를 위한 교두보가 되었습니다.

```javascript
// Platform에서 추가된 Application Variable 활용 패턴
// (로그인 정보, 공통 코드 등을 앱 전역에서 접근)
function fn_getLoginInfo() {
    var oApp = nexacro.getApplication();

    var sUserId   = oApp.gv_userId;    // Application Variable
    var sUserNm   = oApp.gv_userNm;
    var sDeptCd   = oApp.gv_deptCd;

    return {
        userId : sUserId,
        userNm : sUserNm,
        deptCd : sDeptCd
    };
}
```

그러나 Platform은 완전한 HTML5 전환이 아니었습니다. 일부 컴포넌트(특히 파일 업로드 관련)는 여전히 플러그인에 의존했고, IE와 비-IE 브라우저 간 렌더링 차이가 존재했습니다. "Platform에서 크롬으로 열면 일부 기능이 안 된다"는 민원이 개발팀을 괴롭히던 시기였습니다.

## Nexacro N — 순수 HTML5, 완전한 재탄생

**Nexacro N**은 선언적으로 "Flash와 ActiveX를 완전히 제거하고 순수 HTML5·JavaScript로 재구축한다"는 방향으로 개발된 버전입니다. 2022년 이후 공식 권장 버전으로 자리잡았습니다.

### 무엇이 바뀌었나

가장 큰 변화는 **런타임 독립성**입니다. 별도 플러그인 설치 없이 Chrome, Edge, Safari, Firefox 등 모든 모던 브라우저에서 동일하게 동작합니다. 모바일 브라우저도 정식 지원 대상에 포함되어, 같은 `.xfdl` 파일로 데스크톱·모바일을 모두 커버할 수 있습니다.

```javascript
// N에서 강화된 반응형 레이아웃 처리 예시
// Form의 onresize 이벤트로 해상도 분기
function Form_onresize(obj, e) {
    var nWidth = this.getOfficeInnerWidth();

    if (nWidth < 768) {
        // 모바일 레이아웃으로 전환
        div_mobileLayout.set_visible(true);
        div_desktopLayout.set_visible(false);
    } else {
        div_mobileLayout.set_visible(false);
        div_desktopLayout.set_visible(true);
    }
}
```

### 성능 개선

Grid의 렌더링 엔진이 재작성되어 대량 데이터(수만 행) 처리에서 Platform 대비 체감 성능이 크게 향상되었습니다. 가상화 렌더링(화면에 보이는 행만 실제로 DOM에 그림)이 개선되면서 스크롤 부드러움이 달라졌습니다.

## V24 — Nexacro N의 현재 권장 버전

**V24**는 Nexacro N의 특정 메이저 릴리즈를 가리키는 명칭으로, 현재(2024~) 기준 공식 권장 버전입니다. N과 V24를 구분하기보다 "V24가 Nexacro N의 현재 버전"으로 이해하면 됩니다.

V24의 주요 추가 사항:

- **TypeScript 지원**: 스크립트 파일을 `.ts`로 작성하고 타입 안전성을 확보할 수 있음
- **ES6+ 문법 사용**: `const`, `let`, 화살표 함수, 템플릿 리터럴 등 현대 JS 문법
- **Studio N V24 업데이트**: IDE 성능과 자동완성 품질 향상
- **컴포넌트 신규 속성 다수**: V24 릴리즈 노트 기준으로 각 컴포넌트마다 속성·이벤트 추가

```javascript
// V24에서 사용 가능한 모던 JS 문법 예시
function fn_processEmployees() {
    const rowCount = ds_emp.rowcount;

    // 화살표 함수와 배열 메서드 활용
    const empNames = Array.from({ length: rowCount }, (_, i) =>
        ds_emp.getColumn(i, "emp_nm")
    );

    // 템플릿 리터럴
    trace(`총 ${rowCount}명의 직원 데이터 처리 완료`);

    return empNames;
}
```

![Nexacro 버전 진화 연대표](/assets/posts/nexacro-n-history-version-evolution.svg)

## Platform → N 마이그레이션 시 주의사항

Platform에서 N으로 올릴 때 대부분의 코드는 그대로 동작합니다. 그러나 다음 항목은 반드시 점검해야 합니다.

### 1. 제거된 컴포넌트

Platform에서 Flash 또는 ActiveX 기반이었던 일부 컴포넌트는 N에서 제거되거나 대체 컴포넌트로 바뀌었습니다. 대표적으로 `RichEdit`(ActiveX 기반 HTML 에디터)는 N에서 지원이 중단되었고, 외부 에디터 라이브러리 연동으로 대체해야 합니다.

```javascript
// Platform에서 쓰던 방식 (N에서 동작 안 함)
// richedit1.set_innerHtml("<b>내용</b>");  // ← 제거된 API

// N에서 권장하는 외부 에디터 연동 패턴
function fn_initEditor() {
    // WebBrowser 컴포넌트로 TinyMCE 등 iframe 삽입
    var sEditorUrl = "common/editor/editor.html";
    wb_editor.set_url(sEditorUrl);
}
```

### 2. IE 전용 스크립트 제거

Platform 시절 IE 전용 JavaScript API(`window.attachEvent`, `document.all` 등)를 직접 호출했던 코드는 N의 크롬 환경에서 동작하지 않습니다. `attachEvent` → `addEventListener`로 교체해야 합니다.

### 3. 파일 업로드 컴포넌트 변경

`FileUpload` 컴포넌트의 속성명과 이벤트 일부가 N에서 재정비되었습니다. 업로드 관련 화면은 N 기준 문서를 재확인하는 것이 안전합니다.

![Platform vs Nexacro N 핵심 차이](/assets/posts/nexacro-n-history-platform-vs-n.svg)

## 버전 확인 방법

개발 중인 프로젝트가 어느 버전인지 확인하려면 Studio N 상단 메뉴 → **Help → About**을 확인하거나, 프로젝트 루트의 `.xcfg`(설정 파일) 또는 `TypeDef.xadl`의 버전 정보를 봅니다.

```javascript
// 런타임에서 버전 확인
function fn_checkVersion() {
    var oApp    = nexacro.getApplication();
    var sVer    = nexacro.System.getRuntimeVersion();

    trace("Nexacro Runtime Version: " + sVer);
    // 예: "24.0.0.100" 형태
}
```

버전 문자열 앞 두 자리가 `24`라면 V24, `17`이면 Nexacro 17(Platform 계열) 등으로 구분할 수 있습니다.

## 정리

| | Nexacro 14 | Platform | Nexacro N | V24 |
|--|--|--|--|--|
| 런타임 | ActiveX | HTML5+ | 순수 HTML5 | 순수 HTML5 |
| IE 의존 | 필수 | 일부 | 없음 | 없음 |
| 모바일 | 불가 | 제한 | 정식 지원 | 정식 지원 |
| 현재 권장 | ✕ | ✕ | ✓ | ✓ |

Nexacro N·V24는 과거 버전의 핵심 API 설계를 그대로 계승하면서 런타임만 현대화했습니다. `transaction()`, `Dataset`, `Grid` 바인딩 패턴은 버전과 무관하게 동일하게 쓰입니다. 다음 글에서는 Nexacro N의 내부 구조, 즉 브라우저·런타임·서버가 어떻게 연결되는지 아키텍처 관점에서 상세히 살펴봅니다.

---

**지난 글:** [[Nexacro N] Nexacro란 무엇인가 — RIA 시대부터 N까지](/posts/nexacro-n-what-is-nexacro/)

**다음 글:** [[Nexacro N] 아키텍처 개요 — 브라우저·런타임·서버](/posts/nexacro-n-architecture/)

<br>
읽어주셔서 감사합니다. 😊
