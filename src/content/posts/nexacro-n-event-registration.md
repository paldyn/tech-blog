---
title: "[Nexacro N] 이벤트 등록 방법 — Studio vs 스크립트"
description: "Nexacro N에서 이벤트 핸들러를 등록하는 두 가지 방법(Studio 속성창 vs 스크립트 동적 등록)을 비교하고, addEventHandler·removeEventHandler의 실전 활용법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 2
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "event", "event-registration", "addEventHandler", "onclick"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-events-and-scripts/)에서 Nexacro N 이벤트 시스템의 전체 구조를 살펴봤습니다. 이번 글에서는 실제로 이벤트 핸들러를 **어떻게 등록하는지**에 집중합니다. Nexacro N에서 이벤트를 등록하는 방법은 크게 두 가지입니다. Studio 속성창에서 시각적으로 등록하는 방법과, 스크립트 코드에서 직접 핸들러를 할당하는 동적 등록 방법입니다. 각 방법의 동작 원리와 적합한 사용 상황을 이해하면 더 유연하게 화면을 개발할 수 있습니다.

## Studio 속성창에서 이벤트 등록

가장 기본적인 방법입니다. Studio에서 버튼 등 컴포넌트를 선택한 뒤, 우측 속성창 상단의 **Event 탭**(번개 아이콘)을 클릭합니다. 이벤트 목록이 표시되며, 등록하고 싶은 이벤트(예: `onclick`) 항목을 더블클릭하면 자동으로 스크립트에 핸들러 함수가 생성됩니다.

```
// Studio가 자동 생성하는 xfdl 마크업 예시
<Button id="btn_search" text="조회" onclick="btn_search_onclick" ... />
```

이와 동시에 Form Script 탭에는 다음 함수가 자동 생성됩니다.

```javascript
this.btn_search_onclick = function(obj, e) {
    // 여기에 로직 작성
};
```

Studio가 함수명을 `{컴포넌트ID}_{이벤트명}` 형식으로 자동 생성하기 때문에, 이름 규칙을 별도로 신경 쓰지 않아도 됩니다. xfdl 파일의 마크업에 이벤트 정보가 기록되므로, 누가 이 컴포넌트의 이벤트를 처리하는지 마크업만 봐도 파악할 수 있습니다.

![이벤트 등록 방법 비교](/assets/posts/nexacro-n-event-registration-methods.svg)

## 스크립트에서 동적 이벤트 등록

스크립트에서 직접 이벤트를 등록하는 방법은 `this.컴포넌트ID.이벤트명 = 함수` 형태로 핸들러를 할당합니다. 주로 `onload` 핸들러 또는 `fn_init()` 함수 내에서 처리합니다.

```javascript
this.form.onload = function(obj) {
    // 스크립트에서 직접 이벤트 등록
    this.btn_save.onclick = function(obj, e) {
        fn_save();
    };

    // 기명 함수를 참조로 전달 (권장)
    this.btn_cancel.onclick = fn_cancel;
};

function fn_cancel(obj, e) {
    // 취소 처리
    this.form.close();
}
```

기명 함수를 참조로 전달하는 방식(`this.btn.onclick = fn_cancel`)이 익명 함수보다 권장됩니다. 이유는 나중에 `removeEventHandler`로 제거할 때 함수 참조가 필요하기 때문입니다.

## addEventHandler / removeEventHandler

동적 등록의 고급 방법으로 `addEventHandler`가 있습니다. 직접 할당(`=`)과 달리 기존 핸들러를 **유지하면서 추가**로 핸들러를 등록할 수 있습니다.

```javascript
function extraLogger(obj, e) {
    trace("버튼 클릭 로그: " + obj.id);
}

// 기존 onclick 핸들러를 유지하며 추가 핸들러 등록
this.btn_ok.addEventHandler("onclick", extraLogger, this);

// 특정 핸들러만 제거
this.btn_ok.removeEventHandler("onclick", extraLogger);
```

`addEventHandler`의 세 번째 파라미터는 핸들러 함수 내에서의 `this` 컨텍스트를 지정합니다. Form 내 함수에서 `this`로 Form 컴포넌트에 접근해야 할 때 반드시 전달해야 합니다.

![동적 이벤트 등록 실전 패턴](/assets/posts/nexacro-n-event-registration-dynamic.svg)

## 조건에 따른 핸들러 교체 패턴

스크립트 동적 등록의 가장 큰 장점은 **런타임에 핸들러를 교체**할 수 있다는 점입니다. 예를 들어 사용자 권한에 따라 버튼의 동작을 다르게 설정할 수 있습니다.

```javascript
function fn_init() {
    var bAdmin = gv_userInfo.authLevel === "ADMIN";

    if (bAdmin) {
        this.btn_delete.onclick = fn_delete;
        this.btn_delete.enable = true;
    } else {
        this.btn_delete.onclick = fn_noAuth;
        this.btn_delete.enable = false;
    }
}

function fn_noAuth(obj, e) {
    alert("삭제 권한이 없습니다.");
}
```

## 동적 생성 컴포넌트의 이벤트 등록

`addChild`로 런타임에 생성한 컴포넌트에는 반드시 스크립트로 이벤트를 등록해야 합니다. Studio 속성창은 디자인 타임에만 동작하기 때문입니다.

```javascript
function fn_addButton(sId, sText) {
    var oBtn = new Button();
    oBtn.init(sId, "absolute", 0, 0, 100, 30);
    oBtn.text = sText;

    // 동적 생성 컴포넌트에 이벤트 등록
    oBtn.onclick = function(obj, e) {
        trace("동적 버튼 클릭: " + obj.id);
    };

    this.div_container.addChild(oBtn.id, oBtn);
    oBtn.show();
}
```

## Studio 방식 vs 스크립트 방식 선택 기준

| 상황 | 권장 방식 |
|------|----------|
| 정적 컴포넌트, 고정 동작 | Studio 속성창 등록 |
| 권한·조건에 따라 동작이 바뀌는 경우 | 스크립트 동적 등록 |
| 런타임에 생성하는 컴포넌트 | 스크립트 동적 등록 (필수) |
| 기존 핸들러 유지하며 추가 | `addEventHandler` |
| 임시로 추가 후 나중에 제거 | `addEventHandler` + `removeEventHandler` |

대부분의 업무 화면에서는 Studio 속성창으로 등록하되, 특수한 경우에만 동적 등록을 사용하는 혼합 방식이 가장 실용적입니다.

---

**지난 글:** [이벤트와 스크립트 기초](/posts/nexacro-n-events-and-scripts/)

**다음 글:** [이벤트 객체(Event Object) 파헤치기](/posts/nexacro-n-event-object/)

<br>
읽어주셔서 감사합니다. 😊
