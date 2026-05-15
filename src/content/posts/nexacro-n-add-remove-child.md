---
title: "[Nexacro N] addChild / removeChild"
description: "Nexacro N에서 컨테이너(Div, Form)에 컴포넌트를 동적으로 추가·제거하는 addChild / removeChild / removeAll 메서드 사용법과 자식 컴포넌트 조회(getChild, getChildAll), 메모리 누수 방지 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 6
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "addChild", "removeChild", "removeAll", "getChild", "동적UI", "컴포넌트관리"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-dynamic-components/)에서 `new Edit(this)` 형태로 컴포넌트를 동적으로 생성하는 방법을 살펴보았다. 이번 글은 생성한 컴포넌트를 **컨테이너에 붙이고 제거하는 `addChild` / `removeChild` / `removeAll`** 메서드를 집중적으로 다룬다. 동적 UI를 안정적으로 유지하려면 추가만큼 제거도 올바르게 처리해야 한다.

## addChild

```javascript
parentContainer.addChild(sID, oComponent);
oComponent.show();
```

`addChild`의 첫 번째 인수는 **Form 내에서 고유한 ID**다. 중복된 ID를 사용하면 기존 컴포넌트가 덮어씌워지거나 오류가 발생한다. 부착 후 `show()`를 호출하지 않으면 화면에 표시되지 않는다.

```javascript
function fn_addButton(sLabel, nX, nY) {
  var oBtn = new Button(this);
  oBtn.set_left(nX);
  oBtn.set_top(nY);
  oBtn.set_width(80);
  oBtn.set_height(28);
  oBtn.set_text(sLabel);
  oBtn.addEventHandler("onclick", fn_btnClick, this);

  this.div_toolbar.addChild("btn_" + sLabel, oBtn);
  oBtn.show();
}
```

![addChild / removeChild 동작](/assets/posts/nexacro-n-add-remove-child-lifecycle.svg)

## removeChild

```javascript
parentContainer.removeChild(sID);
```

지정한 ID의 컴포넌트를 제거하고 메모리에서 해제한다. 제거 전에 `getChild`로 존재 여부를 확인하는 습관을 갖는 것이 좋다.

```javascript
function fn_removeField(sColNm) {
  var oDiv = this.div_form;
  if (oDiv.getChild("edt_" + sColNm)) {
    oDiv.removeChild("edt_" + sColNm);
    oDiv.removeChild("stc_" + sColNm);
  }
}
```

## removeAll

컨테이너 내 모든 자식 컴포넌트를 한 번에 제거한다. 동적 폼을 재구성할 때 가장 많이 쓰인다.

```javascript
function fn_rebuild() {
  this.div_form.removeAll();   // 기존 컴포넌트 전체 제거
  var nY = 8;
  for (var i = 0; i < this.ds_meta.rowcount; i++) {
    var sNm = this.ds_meta.getColumn(i, "colNm");
    fn_createRow(sNm, nY);
    nY += 32;
  }
  this.div_form.set_height(nY + 10);
}
```

`removeAll`은 **Studio에서 직접 그린 정적 컴포넌트도 제거한다**. 동적으로 추가한 컴포넌트만 지우려면 ID 규칙(예: 접두사 `dyn_`)을 정해 루프로 개별 제거하는 편이 안전하다.

![addChild / removeChild 패턴](/assets/posts/nexacro-n-add-remove-child-code.svg)

## 자식 컴포넌트 조회

```javascript
// ID로 단일 조회
var oEdit = this.div_form.getChild("edt_itemNm");

// 전체 자식 목록 (Object)
var oAll = this.div_form.getChildAll();
for (var sKey in oAll) {
  trace(sKey + " : " + oAll[sKey].classname);
}
```

`getChildAll()`은 키가 컴포넌트 ID인 Object를 반환한다. `for...in`으로 순회하면 모든 자식에 일괄 처리를 적용할 수 있다.

## 메모리 누수 방지

동적 컴포넌트를 자주 재생성하는 화면에서는 다음 규칙을 지킨다.

1. **재구성 전 `removeAll` 또는 개별 `removeChild` 호출** — 이전 컴포넌트가 메모리에 남지 않도록 한다.
2. **이벤트 핸들러 해제** — `removeChild`는 핸들러도 함께 제거하므로 별도 해제는 불필요하다.
3. **Form `onDestroy`에서 최종 정리** — 화면 종료 시 `div_form.removeAll()`을 호출해 잔류 컴포넌트가 없도록 한다.

```javascript
function this_onDestroy(obj, e) {
  this.div_form.removeAll();
  this.div_toolbar.removeAll();
}
```

---

**지난 글:** [[Nexacro N] 동적 컴포넌트 생성](/posts/nexacro-n-dynamic-components/)

**다음 글:** [[Nexacro N] 동적 그리드 컬럼](/posts/nexacro-n-dynamic-grid-columns/)

<br>
읽어주셔서 감사합니다. 😊
