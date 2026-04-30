---
title: "[Nexacro N] Application·Frame·Form의 관계 — 화면 계층 구조 심층 분석"
description: "Nexacro N 런타임 객체 트리에서 Application, MainFrame, ChildFrame, Form이 어떻게 연결되는지, 스크립트로 계층 간 객체를 참조하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 2
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "Application", "MainFrame", "ChildFrame", "Form", "객체참조", "화면계층"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-form-types/)에서 Nexacro N의 Form 타입 — MainFrame, ChildFrame, Form, PopupForm, Include Form — 을 개괄적으로 살펴봤습니다. 이번 글에서는 이 타입들이 런타임에서 어떤 객체 트리를 구성하는지, 그리고 스크립트로 계층 간 객체를 어떻게 참조하는지 깊이 들어갑니다. 이 내용을 이해하면 공통 라이브러리 함수에서 현재 화면 객체를 꺼내거나, 다른 화면에 데이터를 전달하는 코드를 자신 있게 작성할 수 있습니다.

## 런타임 객체 트리

Nexacro N이 구동되면 다음과 같은 객체 트리가 메모리에 만들어집니다. 최상위는 `Application` 싱글턴 객체이며, 그 아래로 `MainFrame`, `ChildFrame`, `Form` 이 중첩됩니다.

```
Application (nexacro.getApplication())
└── MainFrame (.mainframe)
    ├── Div — divHeader
    ├── Div — divNav
    └── ChildFrame (.mainframe.cfContent)
        └── Form — OrderList.xfdl (.mainframe.cfContent.form)
            ├── Grid — grdOrder
            ├── Button — btnSearch
            └── Dataset — dsCustList
```

이 트리의 특성 두 가지를 기억하면 많은 것이 명확해집니다.

1. **`ChildFrame.form`**: ChildFrame에 현재 로드된 Form 객체에 접근하는 속성입니다. `set_loadurl()`로 화면이 전환되면 이 속성이 가리키는 객체도 바뀝니다.
2. **스코프 격리**: 각 Form의 변수와 Dataset은 Form 스코프에 갇혀 있습니다. 다른 Form에서 직접 접근하려면 명시적인 경로(`nexacro.getApplication().mainframe...`)를 통해야 합니다.

![Application·Frame·Form 런타임 객체 트리](/assets/posts/nexacro-n-application-frame-form-structure.svg)

## Application 객체 — 전역 싱글턴

`Application` 객체는 앱 전체에 하나만 존재합니다. 스크립트 어디서든 `nexacro.getApplication()`으로 참조할 수 있습니다.

Application이 담당하는 것:
- `mainframe` 속성으로 MainFrame 접근
- 전역 Dataset과 변수 보관 (`gv_userId`, `gds_codeList` 등)
- 앱 레벨 이벤트 처리 (`onload`, `onunload`, `onerror`)

```javascript
// Application 전역 변수 접근 패턴 (App.js)
var app = nexacro.getApplication();

// 전역 변수 초기화
app.gv_userId  = "";
app.gv_langCd  = "KO";
app.gv_menuList = null;

function Application_onload(obj, e) {
    // 로그인 후 세션 정보 설정
    app.gv_userId = "admin";
}
```

전역 변수를 Application 객체에 붙여두면 어느 Form에서도 `nexacro.getApplication().gv_userId`로 꺼낼 수 있습니다.

## MainFrame — 레이아웃의 골격

MainFrame은 앱의 전체 레이아웃을 정의합니다. 헤더, 사이드바, 컨텐츠 영역의 크기와 위치가 여기서 결정됩니다. MainFrame도 Form과 마찬가지로 스크립트를 가질 수 있으며, 메뉴 클릭 처리, 화면 전환 함수, 탭 관리 로직을 여기에 두는 경우가 많습니다.

```javascript
// MainFrame.xfdl 스크립트 — 화면 전환 공통 함수
function gfn_loadForm(sUrl, sTitle) {
    var cf = nexacro.getApplication()
                    .mainframe.cfContent;
    cf.set_loadurl(sUrl);

    // 헤더 타이틀 업데이트
    nexacro.getApplication()
           .mainframe.divHeader
           .lblTitle.set_text(sTitle);
}
```

업무 Form에서는 `nexacro.getApplication().mainframe.gfn_loadForm(url, title)`처럼 MainFrame의 공통 함수를 호출해 화면을 전환합니다.

## ChildFrame — 화면 전환의 무대

ChildFrame은 업무 화면을 동적으로 로드·언로드하는 컨테이너입니다. 핵심 속성과 메서드:

| 멤버 | 설명 |
|------|------|
| `.form` | 현재 로드된 Form 객체 |
| `set_loadurl(url)` | 새 화면으로 전환 (기존 Form 언로드) |
| `set_initurl(url)` | 초기 로드 URL 설정 |
| `onload` | Form 로드 완료 이벤트 |
| `onunload` | Form 언로드 이벤트 |

```javascript
// ChildFrame 이벤트로 화면 전환 감지
function cfContent_onload(obj, e) {
    // 새 화면이 로드됐을 때 탭 타이틀 갱신
    var sTitle = obj.form.title || "";
    this.divHeader.lblTitle.set_text(sTitle);
}
```

## Form에서 다른 Form 참조하기

업무 Form 스크립트에서 다른 Form의 컴포넌트나 Dataset에 접근해야 하는 경우가 있습니다.

```javascript
// Form A에서 Form B(동일 ChildFrame)의 Dataset 접근
function fn_refreshOtherForm() {
    // 현재 ChildFrame에 로드된 Form 참조
    var cf   = nexacro.getApplication()
                      .mainframe.cfContent;
    var frmB = cf.form;

    if (frmB && frmB.id === "OrderDetail") {
        frmB.fn_reload(); // Form B의 함수 호출
    }
}
```

이처럼 `nexacro.getApplication()` → `mainframe` → `cfContent` → `form`의 경로를 따라가면 어느 계층이든 접근할 수 있습니다. 단, 이런 직접 참조는 두 Form 간의 결합도를 높이기 때문에 가능하면 이벤트나 공통 함수를 통해 소통하는 패턴이 권장됩니다.

![계층 간 객체 참조 패턴](/assets/posts/nexacro-n-application-frame-form-access.svg)

## 멀티 ChildFrame 구성

복잡한 화면에서는 ChildFrame을 2개 이상 두기도 합니다. 예를 들어 상단 ChildFrame에는 목록, 하단 ChildFrame에는 상세 화면을 로드하는 구조입니다.

```xml
<!-- MainFrame — 상하 분할 구성 -->
<ChildFrame id="cfList"
            left="0" top="60"
            width="1920" height="400"
            initurl="form/OrderList.xfdl" />
<ChildFrame id="cfDetail"
            left="0" top="460"
            width="1920" height="560"
            initurl="form/OrderDetail.xfdl" />
```

이 경우 각 ChildFrame은 독립적으로 화면을 로드합니다. 목록 Form에서 행을 클릭하면 `cfDetail.set_loadurl("form/OrderDetail.xfdl")`을 호출해 하단을 갱신하는 패턴을 씁니다.

## this와 계층 탐색의 관계

Form 스크립트 내에서 `this`는 현재 Form 객체를 가리킵니다. `this.parent`는 ChildFrame, `this.parent.parent`는 MainFrame이 됩니다.

```javascript
// this를 이용한 상위 접근 (권장하지 않는 패턴 — 구조 변경에 취약)
var mf = this.parent.parent; // ChildFrame.parent = MainFrame

// 권장 패턴 — 명시적 경로 사용
var mf = nexacro.getApplication().mainframe;
```

`this.parent` 연쇄는 MainFrame 구조가 변경되면 깨질 수 있으므로, 실무에서는 `nexacro.getApplication().mainframe`처럼 절대 경로 방식을 선호합니다.

## 핵심 정리

Nexacro N의 런타임 객체 트리는 Application → MainFrame → ChildFrame → Form 순서로 중첩됩니다. 스크립트에서는 `nexacro.getApplication()`을 진입점 삼아 어느 계층이든 참조할 수 있습니다. 전역 상태는 Application 객체에, 레이아웃 제어는 MainFrame에, 화면 전환은 ChildFrame의 `set_loadurl()`로 처리하는 역할 분리가 코드 품질을 높이는 핵심입니다.

---

**지난 글:** [Form 타입 완전 정복 — MainFrame부터 PopupForm까지](/posts/nexacro-n-form-types/)

**다음 글:** [Form 생명주기 — onCreate에서 onDestroy까지](/posts/nexacro-n-form-lifecycle/)

<br>
읽어주셔서 감사합니다. 😊
