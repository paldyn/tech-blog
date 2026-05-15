---
title: "[Nexacro N] 이벤트와 스크립트 기초"
description: "Nexacro N의 이벤트 시스템과 스크립트 구성 방식을 설명합니다. 이벤트 핸들러 등록, 실행 흐름, 스크립트 범위(Form·Include·App)를 단계별로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 1
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "event", "script", "onload", "onclick", "form-script"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-master-detail/)에서 마스터-디테일 패턴을 살펴봤습니다. 실제로 화면을 개발할 때 가장 많이 작성하게 되는 코드는 바로 **이벤트 핸들러**와 **스크립트 함수**입니다. Nexacro N은 컴포넌트 기반의 이벤트 모델을 채택하고 있어, 특정 컴포넌트에서 사용자 행동이나 시스템 동작이 발생하면 미리 등록된 함수가 자동으로 호출됩니다. 이 글에서는 이벤트가 무엇인지, 어떤 종류가 있는지, 스크립트는 어떻게 구성하는지를 체계적으로 정리합니다.

## 이벤트란 무엇인가

이벤트(Event)는 **컴포넌트나 시스템이 특정 상황을 알리기 위해 발생시키는 신호**입니다. 사용자가 버튼을 클릭하면 `onclick` 이벤트가 발생하고, 입력 필드의 값이 바뀌면 `onchanged` 이벤트가 발생합니다. Form이 화면에 로드되는 시점에는 `onload`가, 화면을 닫을 때는 `onunload`가 발생합니다.

이벤트 핸들러(Event Handler)는 이 신호를 받아 실행되는 함수입니다. Studio에서 컴포넌트를 더블클릭하면 해당 컴포넌트의 기본 이벤트(보통 `onclick`)에 대한 핸들러 함수가 자동으로 생성됩니다.

![이벤트와 스크립트 구조 개요](/assets/posts/nexacro-n-events-and-scripts-overview.svg)

## 주요 이벤트 목록

Nexacro N에서 자주 사용하는 이벤트를 유형별로 정리합니다.

**마우스/키보드 이벤트**

| 이벤트 | 발생 시점 |
|--------|----------|
| `onclick` | 마우스 클릭 |
| `ondblclick` | 더블클릭 |
| `onkeydown` / `onkeyup` | 키보드 누름 / 뗌 |
| `onmouseover` / `onmouseout` | 마우스 진입 / 이탈 |

**포커스 이벤트**

| 이벤트 | 발생 시점 |
|--------|----------|
| `onfocus` | 컴포넌트가 포커스를 받을 때 |
| `onkillfocus` | 컴포넌트가 포커스를 잃을 때 |

**값 변경 이벤트**

| 이벤트 | 발생 시점 |
|--------|----------|
| `onchanged` | 값이 변경되고 포커스 이탈 시 |
| `onchange` | 값이 변경되는 즉시 |

**Form 생명주기 이벤트**

| 이벤트 | 발생 시점 |
|--------|----------|
| `onload` | Form 로드 완료 |
| `onunload` | Form 종료 전 |
| `onactivate` | Form이 활성화될 때 |
| `ondeactivate` | Form이 비활성화될 때 |

**Dataset 이벤트**

| 이벤트 | 발생 시점 |
|--------|----------|
| `oncurrentchanged` | 현재 행 변경 시 |
| `onrowcountchanged` | 행 수 변경 시 |

## 스크립트 구성 방식

Nexacro N의 스크립트는 **Form Script**에 작성합니다. Studio에서 Form을 열면 하단에 Script 탭이 있으며, 여기에 해당 Form에서 사용할 모든 함수를 정의합니다.

스크립트 범위는 세 가지 수준이 있습니다.

- **Form Script**: 해당 Form 내에서만 접근 가능한 함수와 변수를 정의합니다.
- **Include Script (.xjs)**: 여러 Form이 공유하는 공통 함수를 정의하는 외부 스크립트 파일입니다. TypeDef에서 Include 설정 후 Form에서 Include 속성으로 등록합니다.
- **Application Script**: `application.xadl`에 등록하는 전역 스크립트로, 모든 Form에서 접근 가능합니다.

## Form Script 기본 패턴

실무에서는 다음과 같은 패턴으로 스크립트를 구성합니다.

![Form 스크립트 기본 패턴](/assets/posts/nexacro-n-events-and-scripts-code.svg)

```javascript
// ==========================================
// 이벤트 핸들러 영역
// ==========================================
this.form.onload = function(obj) {
    fn_init();
};

this.btn_search.onclick = function(obj, e) {
    fn_search();
};

this.edt_name.onchanged = function(obj, e) {
    fn_onNameChanged(obj.value);
};

// ==========================================
// 비즈니스 로직 함수 영역
// ==========================================
function fn_init() {
    // 화면 초기화: 기본값 세팅, 초기 조회 등
    this.dsList.clearData();
}

function fn_search() {
    // 조회 처리
    var svcId = "svcSearch";
    var in    = "dsSearch:input=dsSearch";
    var out   = "dsResult:output=dsResult";
    this.transaction(svcId, "/search.do", in, out, "", "fn_searchCb");
}

function fn_searchCb(svcId, errCode, errMsg) {
    if (errCode !== 0) {
        alert(errMsg);
        return;
    }
    // 정상 처리
}
```

이벤트 핸들러는 **가능한 짧게** 유지하고, 실제 로직은 `fn_*` 형태의 함수로 분리하는 것이 핵심입니다. 이렇게 하면 동일한 로직을 여러 이벤트에서 재사용할 수 있고, 코드 가독성도 높아집니다.

## 스크립트 작성 시 주의사항

**`this` 컨텍스트 주의**: 스크립트 함수 내에서 `this`는 Form 객체를 가리킵니다. 이벤트 핸들러 안에서도 마찬가지입니다. 단, 콜백 함수나 클로저 내부에서는 `this`가 달라질 수 있으니 주의하세요. 이 부분은 [다음 글](/posts/nexacro-n-event-registration/)에서 이벤트 등록 방법과 함께 더 자세히 다룹니다.

**전역 변수 최소화**: Form Script 최상단에 전역 변수를 선언하면 Form 내 어디서든 접근할 수 있습니다. 하지만 전역 변수가 많아지면 상태 추적이 어려워집니다. 필요한 경우에만 선언하고, 지역 변수를 최대한 활용하세요.

```javascript
// Form 전역 변수 (최상단에 선언)
var g_bIsEditing = false;
var g_nCurrentPage = 1;
```

**함수명 중복 방지**: Form Script와 Include Script에서 같은 이름의 함수를 정의하면 충돌이 발생합니다. Include Script의 함수는 공통 접두사(예: `cmn_`)를 사용해서 Form 함수와 구분합니다.

## 스크립트 디버깅 기본

`trace()` 함수를 사용하면 Studio의 Output 창에 값을 출력할 수 있습니다. 개발 중에 변수 값을 확인할 때 유용합니다.

```javascript
function fn_search() {
    trace("fn_search 호출됨");
    trace("검색어: " + this.edt_name.value);
    // ...
}
```

`alert()` 도 사용할 수 있지만, 화면 흐름을 멈추는 블로킹 방식이므로 디버깅 후에는 반드시 제거해야 합니다. 운영 환경에서는 `trace()`도 제거하거나 로그 레벨 조건으로 감싸는 것이 좋습니다.

---

**다음 글:** [이벤트 등록 방법 — Studio vs 스크립트](/posts/nexacro-n-event-registration/)

<br>
읽어주셔서 감사합니다. 😊
