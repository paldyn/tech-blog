---
title: "[Nexacro N] this 컨텍스트 이해와 활용"
description: "Nexacro N Form 스크립트에서 this가 무엇을 가리키는지, 콜백·클로저 내부에서 this가 바뀌는 문제를 어떻게 해결하는지, lookup과 getOwnerForm 등 컴포넌트 탐색 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 4
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "this", "context", "lookup", "getOwnerForm", "script"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-event-object/)에서 이벤트 객체 `obj`와 `e`의 속성을 살펴봤습니다. 이번 글에서는 Nexacro N 스크립트에서 가장 혼란을 일으키는 주제인 **`this` 컨텍스트**를 다룹니다. 어디서나 `this`를 쓰면 될 것 같지만, 콜백 함수나 Include 스크립트 함수에서는 `this`가 예상과 다른 대상을 가리켜서 런타임 오류가 발생하곤 합니다.

## Form 스크립트에서 this의 의미

Form Script 최상위 레벨에서 `this`는 **현재 Form 객체**를 가리킵니다. 이벤트 핸들러 함수 안에서도 동일합니다.

```javascript
// Form 스크립트 최상위 — this = Form
this.btn_search.onclick = function(obj, e) {
    // 이 안에서도 this = Form
    this.dsResult.clearData(); // OK
    fn_search();               // OK
};

function fn_search() {
    // 일반 함수 내부에서도 this = Form
    this.transaction(...);     // OK
}
```

Form이 가진 모든 컴포넌트와 Dataset은 `this.{id}` 형태로 바로 접근할 수 있습니다.

![this 컨텍스트 구조 다이어그램](/assets/posts/nexacro-n-this-context-diagram.svg)

## this가 바뀌는 상황 — 주의 필요

`this`가 Form이 아닌 다른 대상을 가리키게 되는 상황이 있습니다.

### 타이머 콜백

`setTimeout`, `setInterval`의 콜백 함수 내부에서 `this`는 전역 객체(`window`)를 가리킵니다.

```javascript
function fn_delayRefresh() {
    var me = this; // Form을 me에 저장

    setTimeout(function() {
        // this = window (❌)
        // me = Form    (✅)
        me.dsResult.clearData();
        me.fn_search();
    }, 500);
}
```

가장 간단한 해결책은 `var me = this`로 Form 참조를 클로저 변수에 저장하는 것입니다.

### 일반 이벤트 리스너에서 전달되는 스코프

`addEventHandler`의 세 번째 파라미터가 `this` 컨텍스트를 결정합니다. 이를 생략하면 핸들러 내부에서 `this`가 Form이 아닐 수 있습니다.

```javascript
function extraHandler(obj, e) {
    // addEventHandler 세 번째 인자로 this를 넘겨야
    // 이 함수 내부에서 this = Form이 됨
    this.dsLog.addRow(); // this 컨텍스트에 따라 동작이 달라짐
}

// ✅ 세 번째 인자에 this(Form) 전달
this.btn_ok.addEventHandler("onclick", extraHandler, this);
```

## Div 안 컴포넌트 접근

Form에 Div 컨테이너가 있고, Div 안에 컴포넌트가 있는 경우에도 `this.{divId}.{componentId}` 형태로 직접 접근할 수 있습니다.

```javascript
// div_top 안의 btn_save에 접근
this.div_top.btn_save.enable = false;

// div_top 안의 edt_name 값 읽기
var sName = this.div_top.edt_name.value;
```

만약 Div 내부에서 핸들러 함수가 정의된 경우라면, `obj.parent`를 통해 상위로 올라갈 수 있습니다.

```javascript
// Div 내 버튼의 onclick — Div 밖 Form에 접근하는 법
function btn_inside_onclick(obj, e) {
    // obj.parent = Div, obj.parent.form = Form
    var oForm = obj.parent.form;
    oForm.dsResult.clearData();
}
```

![this 접근 패턴 — 컴포넌트 탐색](/assets/posts/nexacro-n-this-context-patterns.svg)

## lookup으로 동적 컴포넌트 접근

컴포넌트 ID를 런타임에 조합해서 접근해야 할 때는 `this.lookup(sId)` 메서드를 사용합니다.

```javascript
function fn_toggleButtons(sSuffix) {
    var aIds = ["btn_search", "btn_save", "btn_delete"];

    for (var i = 0; i < aIds.length; i++) {
        var sId   = aIds[i] + "_" + sSuffix;
        var oComp = this.lookup(sId); // ID 문자열로 컴포넌트 탐색
        if (oComp) {
            oComp.enable = false;
        }
    }
}
```

`lookup`은 Form 내 어디에 있는 컴포넌트든 ID로 찾아줍니다. 단, 반환값이 `null`일 수 있으므로 항상 `null` 체크를 하는 것이 좋습니다.

## getOwnerForm — Include 스크립트에서 Form 접근

Include 스크립트(`.xjs`)의 함수 안에서는 `this`가 어떤 Form인지 불명확합니다. 함수가 여러 Form에서 호출될 수 있기 때문입니다. 이때 컴포넌트를 인자로 받아 `getOwnerForm()`으로 소속 Form을 얻는 패턴을 사용합니다.

```javascript
// Include 스크립트 (cmn_util.xjs)
function cmn_clearForm(oComponent) {
    // 어느 Form에서 호출되든 소속 Form 참조 획득
    var oForm = oComponent.getOwnerForm();

    oForm.dsResult.clearData();
    oForm.grd_list.setRedraw(true);
}

// Form 스크립트에서 호출
// this(Form의 컴포넌트)를 넘겨주면 Include 함수가 Form을 알 수 있음
cmn_clearForm(this.btn_clear);
```

## this 패턴 요약

| 상황 | this가 가리키는 대상 | 해결책 |
|------|--------------------|----|
| Form 스크립트 최상위 | Form | 그대로 사용 |
| 이벤트 핸들러 함수 | Form | 그대로 사용 |
| setTimeout 콜백 | window | `var me = this` 클로저 |
| addEventHandler 핸들러 | 세 번째 파라미터에 따라 다름 | 세 번째 인자에 `this` 전달 |
| Include 스크립트 함수 | 불명확 | `getOwnerForm()` 사용 |
| Div 내부 핸들러 | Div | `obj.parent.form` 역추적 |

`this` 컨텍스트를 올바르게 이해하면 컴포넌트 접근 오류를 크게 줄일 수 있습니다. 다음 글에서는 이벤트 취소와 `return` 값으로 이벤트 흐름을 제어하는 방법을 알아봅니다.

---

**지난 글:** [이벤트 객체(Event Object) 파헤치기](/posts/nexacro-n-event-object/)

**다음 글:** [이벤트 취소와 return 값 제어](/posts/nexacro-n-event-cancel-return/)

<br>
읽어주셔서 감사합니다. 😊
