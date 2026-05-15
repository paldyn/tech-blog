---
title: "[Nexacro N] 이벤트 버블링과 전파 제어"
description: "Nexacro N 이벤트 버블링의 개념과 동작 방식을 설명합니다. 부모 컴포넌트에서 자식 이벤트를 일괄 처리하는 패턴과, stopPropagation으로 전파를 차단하는 방법을 예제와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 6
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "event-bubbling", "stopPropagation", "event-propagation", "onclick"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-event-cancel-return/)에서 이벤트 취소 방법을 살펴봤습니다. 이번 글에서는 **이벤트 버블링(Event Bubbling)** 개념을 다룹니다. 버블링은 자식 컴포넌트에서 발생한 이벤트가 부모 컴포넌트로 전파되는 현상입니다. 이를 잘 활용하면 각 컴포넌트마다 핸들러를 붙이지 않고 부모에서 한 번에 처리할 수 있고, 반대로 전파를 차단해서 의도치 않은 부모 핸들러 실행을 막을 수도 있습니다.

## 이벤트 버블링이란

Nexacro N에서 버튼을 클릭하면 이벤트는 버튼에서 출발해서 부모 Div, 그 위의 Form, 그리고 최상위 Application까지 계층을 따라 올라갑니다. 이 흐름을 버블링(bubbling)이라 부릅니다. 마치 물속 거품이 위로 올라가는 것과 같습니다.

![이벤트 버블링 구조 다이어그램](/assets/posts/nexacro-n-event-bubbling-diagram.svg)

예를 들어 `div_toolbar` 안에 버튼이 여러 개 있을 때, 각 버튼에 개별 핸들러를 붙이는 대신 `div_toolbar.onclick`에 하나의 핸들러를 등록하면 모든 버튼 클릭이 이 핸들러로 전달됩니다.

```javascript
// 개별 등록 방식 (비효율적)
this.btn_search.onclick = function(obj, e) { fn_search(); };
this.btn_save.onclick   = function(obj, e) { fn_save(); };
this.btn_delete.onclick = function(obj, e) { fn_delete(); };

// 버블링 활용 방식 (효율적)
this.div_toolbar.onclick = function(obj, e) {
    switch (obj.id) {
        case "btn_search": fn_search(); break;
        case "btn_save":   fn_save();   break;
        case "btn_delete": fn_delete(); break;
    }
};
```

`obj.id`가 실제 이벤트를 발생시킨 컴포넌트의 ID를 담고 있으므로, 어느 버튼에서 올라온 이벤트인지 구분할 수 있습니다.

## 버블링 활용 패턴

### Grid 내 버튼 버블링

Grid 셀 안에 동적으로 생성된 버튼의 클릭을 처리할 때 버블링이 특히 유용합니다.

```javascript
this.grd_list.oncellclick = function(obj, e) {
    var nRow   = obj.currentrow;
    var nCol   = obj.currentcol;
    var sCellType = obj.getCellProperty(0, nCol, "displaytype");

    // 버튼 타입 셀 클릭
    if (sCellType === "button") {
        var sCellId = obj.getCellProperty(0, nCol, "id");
        if (sCellId === "btn_detail") {
            fn_openDetail(nRow);
        } else if (sCellId === "btn_remove") {
            fn_removeRow(nRow);
        }
    }
};
```

![버블링 활용 및 전파 차단 코드](/assets/posts/nexacro-n-event-bubbling-code.svg)

## 이벤트 전파 차단 — stopPropagation

자식 컴포넌트에서 이벤트를 처리하고 부모로 전파되지 않도록 하려면 `e.stopPropagation()`을 호출합니다.

```javascript
// 자식 버튼에서 처리 후 부모 핸들러 실행 방지
this.btn_inner.onclick = function(obj, e) {
    fn_innerAction();
    e.stopPropagation(); // 부모 div_outer.onclick 실행 안 함
};

// 또는 e.bubbles 속성으로 제어
this.btn_inner.onclick = function(obj, e) {
    fn_innerAction();
    e.bubbles = false;   // 같은 효과
};
```

두 방법 모두 동일하게 동작합니다. `stopPropagation()`이 더 명시적이어서 코드 가독성이 높습니다.

## 버블링이 발생하지 않는 이벤트

모든 이벤트가 버블링되는 것은 아닙니다. 일부 이벤트는 발생 지점에서만 처리됩니다.

| 버블링 O | 버블링 X |
|----------|---------|
| `onclick` | `onload` |
| `ondblclick` | `onunload` |
| `onkeydown` | `onfocus` |
| `onkeyup` | `onkillfocus` |
| `onmouseover` | `onactivate` |

`onfocus`와 `onkillfocus`는 버블링되지 않으므로 부모 컴포넌트에서 포착할 수 없습니다. 이 경우 각 컴포넌트에 개별적으로 핸들러를 등록해야 합니다.

## 주의사항 — 버블링으로 인한 의도치 않은 이중 실행

부모와 자식 모두에 같은 이벤트 핸들러가 등록되어 있으면, 자식에서 이벤트가 발생할 때 두 핸들러가 모두 실행됩니다.

```javascript
// 자식 버튼
this.btn_save.onclick = function(obj, e) {
    trace("btn_save clicked"); // ① 먼저 실행
};

// 부모 div_content
this.div_content.onclick = function(obj, e) {
    trace("div_content clicked"); // ② 버블링으로 실행
};

// btn_save 클릭 시 → ①, ② 모두 출력됨
```

이중 실행을 원하지 않으면 자식 핸들러에서 `e.stopPropagation()`을 호출하거나, 부모 핸들러에서 `obj.id`를 확인해서 자식 컴포넌트 ID인 경우에만 처리하도록 합니다.

## 실무 권장 패턴

- **여러 버튼이 같은 컨테이너 안에 있고 동작이 명확히 구분**되면 버블링 방식을 사용해서 핸들러 수를 줄입니다.
- **부모와 자식 모두 핸들러가 필요**한 경우, 자식에서 처리 후 `stopPropagation()`으로 전파를 차단합니다.
- **복잡한 UI 트리 구조**에서는 버블링보다 직접 등록 방식이 더 예측 가능하고 디버깅하기 쉽습니다.

다음 글에서는 Nexacro N에서 사용자 정의 이벤트(Custom Event)를 만들고 발생시키는 방법을 다룹니다.

---

**지난 글:** [이벤트 취소와 return 값 제어](/posts/nexacro-n-event-cancel-return/)

**다음 글:** [사용자 정의 이벤트(Custom Event) 만들기](/posts/nexacro-n-custom-events/)

<br>
읽어주셔서 감사합니다. 😊
