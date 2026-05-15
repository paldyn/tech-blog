---
title: "[Nexacro N] 동적 컴포넌트 생성"
description: "Nexacro N에서 런타임에 컴포넌트를 생성하는 방법—new Static(this), new Edit(this) 같은 생성자 패턴, 속성 설정, 컨테이너에 addChild로 부착하는 과정, Dataset 바인딩과 이벤트 등록까지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 5
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "동적컴포넌트", "createComponent", "addChild", "Edit", "Static", "런타임생성"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-popup-stack/)에서 팝업 스택 관리 패턴을 살펴보았다. 이번 글은 **동적 컴포넌트 생성**—Studio에서 미리 그려두지 않고 스크립트로 실행 중에 컴포넌트를 만들어 화면에 붙이는 방법—을 다룬다. 서버 메타데이터에 따라 입력 폼이 달라지거나, 사용자 권한에 따라 버튼이 동적으로 나타나야 할 때 필수적이다.

## 동적 컴포넌트 생성 3단계

Nexacro N에서 동적으로 컴포넌트를 만드는 과정은 세 단계다.

1. **생성자 호출** — `new ComponentType(this)`
2. **속성 설정** — `set_left`, `set_top`, `set_width`, `set_value` 등
3. **컨테이너에 부착** — `parentDiv.addChild(sID, obj)` 후 `obj.show()`

![동적 컴포넌트 생성 흐름](/assets/posts/nexacro-n-dynamic-components-flow.svg)

## 기본 생성 예제

가장 단순한 예로 `Static`(라벨)과 `Edit`를 동적으로 만들어본다.

```javascript
function fn_createRow(sLabel, sColumn, nY) {
  // Static(라벨) 생성
  var oLabel = new Static(this);
  oLabel.set_left(10);
  oLabel.set_top(nY);
  oLabel.set_width(120);
  oLabel.set_height(24);
  oLabel.set_text(sLabel);

  // Edit 생성
  var oEdit = new Edit(this);
  oEdit.set_left(140);
  oEdit.set_top(nY);
  oEdit.set_width(200);
  oEdit.set_height(24);

  // 컨테이너에 부착
  this.div_container.addChild("stc_" + sColumn, oLabel);
  this.div_container.addChild("edt_" + sColumn, oEdit);
  oLabel.show();
  oEdit.show();
}
```

`addChild`의 첫 번째 인수는 컴포넌트 ID다. 같은 Form 내에서 고유해야 하므로 Column 이름 등을 활용해 자동 부여한다.

## Dataset 바인딩 연결

동적으로 생성한 Edit에도 Dataset 바인딩을 적용할 수 있다.

```javascript
oEdit.set_bindcolumn("ds_master:" + sColumnName);
```

형식은 `"데이터셋ID:컬럼명"`이며, Dataset의 현재 행이 바뀌면 자동으로 값이 반영된다.

![createComponent 코드 예시](/assets/posts/nexacro-n-dynamic-components-code.svg)

## 이벤트 핸들러 동적 등록

동적 컴포넌트에는 `addEventHandler`로 이벤트 핸들러를 연결한다.

```javascript
oEdit.addEventHandler("onchange", fn_onEditChange, this);
oBtn.addEventHandler("onclick",   fn_onBtnClick,   this);

function fn_onEditChange(obj, e) {
  // obj.id로 어떤 Edit인지 식별
  trace("changed: " + obj.id + " = " + obj.value);
}
```

두 번째 인수는 핸들러 함수 참조, 세 번째는 `this` 컨텍스트다. 스코프를 명시하지 않으면 핸들러 내 `this`가 예상과 다를 수 있으므로 항상 세 번째 인수를 전달한다.

## 서버 메타데이터 기반 폼 동적 생성

실무에서 가장 많이 쓰이는 패턴이다. 서버에서 필드 목록(컬럼명, 라벨, 타입)을 Dataset으로 받아 동적으로 입력 폼을 구성한다.

```javascript
function fn_buildForm() {
  // ds_meta: colNm, colLabel, colType, colLen
  var nY = 10;
  for (var i = 0; i < this.ds_meta.rowcount; i++) {
    var sNm    = this.ds_meta.getColumn(i, "colNm");
    var sLabel = this.ds_meta.getColumn(i, "colLabel");
    var sType  = this.ds_meta.getColumn(i, "colType");
    fn_createField(sLabel, sNm, sType, nY);
    nY += 32;
  }
  // 컨테이너 높이 조정
  this.div_form.set_height(nY + 20);
}
```

## 주의 사항

- 동적 컴포넌트는 Form이 소멸될 때 자동으로 제거된다. 하지만 동적 생성을 반복할 경우 이전 컴포넌트를 `removeChild`로 먼저 제거하지 않으면 메모리 누수가 발생한다.
- `new Grid(this)`로 Grid도 동적 생성할 수 있지만, 컬럼 구조까지 스크립트로 잡아야 해 복잡도가 높다. Grid 동적 컬럼은 다음 글에서 별도로 다룬다.
- `show()`를 호출하지 않으면 컴포넌트가 부착되어도 화면에 보이지 않는다.

---

**지난 글:** [[Nexacro N] 팝업 스택 관리](/posts/nexacro-n-popup-stack/)

**다음 글:** [[Nexacro N] addChild / removeChild](/posts/nexacro-n-add-remove-child/)

<br>
읽어주셔서 감사합니다. 😊
