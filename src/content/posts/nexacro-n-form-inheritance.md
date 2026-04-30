---
title: "[Nexacro N] Form 상속 — 공통 기능을 BaseForm으로 물려받기"
description: "Nexacro N의 Form 상속 메커니즘(inheritedform 속성)을 이용해 BaseForm에 공통 함수·Dataset·UI를 두고 모든 업무 Form이 재사용하는 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 4
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "Form 상속", "BaseForm", "inheritedform", "공통화", "코드재사용"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-form-lifecycle/)에서 Form 생명주기 이벤트의 순서와 각 이벤트에서 해야 할 일을 알아봤습니다. 실제 프로젝트에서는 수십에서 수백 개의 화면이 만들어지는데, 각 Form마다 동일한 초기화 코드, 공통 팝업 호출 함수, 코드 Dataset 로드 로직을 반복 작성하는 것은 비효율적입니다. Nexacro N은 **Form 상속(inheritedform)** 기능으로 이 문제를 해결합니다. BaseForm 하나에 공통 요소를 모아두면 모든 업무 Form이 자동으로 물려받습니다.

## Form 상속이란

Nexacro N의 Form 상속은 `<Form>` 태그의 **`inheritedform`** 속성으로 선언합니다. 지정된 BaseForm의 컴포넌트, Dataset, 스크립트를 자식 Form이 모두 물려받습니다.

```xml
<!-- OrderList.xfdl — inheritedform으로 상속 선언 -->
<Form id="OrderList"
      inheritedform="common/BaseForm.xfdl"
      width="1720" height="1020">
  <!-- 자식 Form 고유의 컴포넌트만 추가 -->
  <Objects>
    <Grid id="grdOrder" left="0" top="80"
          width="1720" height="940" />
  </Objects>
</Form>
```

이 선언 하나로 `BaseForm`에 정의된 공통 함수, 공통 Dataset, 공통 UI 컴포넌트를 `OrderList.xfdl`에서 모두 사용할 수 있습니다.

![Form 상속 구조 — BaseForm과 업무 Form](/assets/posts/nexacro-n-form-inheritance-diagram.svg)

## BaseForm 설계

BaseForm은 직접 화면에 표시되지 않고 상속 전용으로 쓰이는 추상 Form입니다. 다음 세 가지를 담습니다.

### 1. 공통 함수

```javascript
// BaseForm.xfdl Script
function gfn_init(form) {
    // 전역 변수에서 사용자 정보 세팅
    var app = nexacro.getApplication();
    form.gv_userId = app.gv_userId;
    form.gv_langCd = app.gv_langCd;

    // 공통 코드 Dataset 로드
    form.fn_loadCommonCode();
}

function gfn_openPopup(popId, url, x, y, w, h, cbFn, args, type) {
    // 공통 팝업 호출 wrapper
    var pop = nexacro.createObject("PopupForm", popId, url,
                                   x, y, w, h, null, this);
    pop.popupArgs    = args;
    pop.popupCbFn    = cbFn;
    pop.set_openStyle(type || "modal");
    pop.show();
    return pop;
}

function gfn_alert(msg) {
    alert(msg); // 프레임워크 공통 알림
}

function gfn_confirm(msg) {
    return confirm(msg);
}
```

### 2. 공통 Dataset

```xml
<!-- BaseForm.xfdl Objects 영역 -->
<Objects>
  <!-- 공통 코드 Dataset (자식 Form 전체에서 접근 가능) -->
  <Dataset id="dsCommonCode"
           xmlvar="SvcCommonCode" />
  <!-- 사용자 정보 Dataset -->
  <Dataset id="dsUserInfo" />
  <!-- 검색 조건 공통 Dataset -->
  <Dataset id="dsSearchParam">
    <ConstColumns>
      <ConstColumn id="pageNo"  type="INT"    value="1" />
      <ConstColumn id="pageSize" type="INT"   value="100" />
    </ConstColumns>
  </Dataset>
</Objects>
```

### 3. 공통 UI 컴포넌트

```xml
<!-- 버튼 바, 검색 바 등 공통 영역 -->
<Objects>
  <Div id="divButtonBar" left="0" top="0"
       width="1720" height="40">
    <Objects>
      <Button id="btnSearch" text="조회"
              left="0" top="4" width="80" height="32" />
      <Button id="btnNew"    text="신규"
              left="88" top="4" width="80" height="32" />
      <Button id="btnSave"   text="저장"
              left="176" top="4" width="80" height="32" />
      <Button id="btnDelete" text="삭제"
              left="264" top="4" width="80" height="32" />
    </Objects>
  </Div>
</Objects>
```

## 자식 Form에서 상속받은 것 사용하기

자식 Form에서는 `this.gfn_init()`, `this.dsCommonCode`, `this.divButtonBar`처럼 `this`로 바로 접근합니다.

```javascript
// OrderList.xfdl — BaseForm 함수를 직접 호출
function Form_onload(obj, e) {
    this.gfn_init(this); // BaseForm 공통 초기화
    this.fn_search();    // 자식 Form 고유 함수
}

function btnSearch_onclick(obj, e) {
    this.fn_search();
}

function fn_search() {
    // BaseForm의 dsSearchParam 사용
    this.dsSearchParam.setColumn(0, "pageNo", 1);

    this.transaction(
        "SvcOrderList",
        "/order/list.do",
        "dsSearchParam",
        "dsOrder",
        "",
        "fn_searchCb"
    );
}
```

## 공통 함수 오버라이드

BaseForm의 함수를 자식 Form에서 재정의하려면 같은 이름의 함수를 선언하면 됩니다. 자바의 `@Override`와 같은 개념입니다.

```javascript
// OrderList.xfdl — gfn_init 오버라이드
function gfn_init(form) {
    // 주문 화면 전용 초기화 먼저 수행
    form.cboStatus.set_codecolumn("statusCd");
    form.cboStatus.set_datacolumn("statusNm");

    // 그다음 BaseForm 공통 초기화 호출 (super 패턴)
    this.parent.gfn_init(form);
}
```

`this.parent`는 inheritedform이 적용된 경우 BaseForm 객체를 가리킵니다. 이 패턴으로 BaseForm 로직을 완전히 대체하지 않고 기능을 확장할 수 있습니다.

![BaseForm 선언과 상속 코드](/assets/posts/nexacro-n-form-inheritance-code.svg)

## BaseForm 설계 원칙

**공통성 기준으로 선별합니다.** 모든 화면에서 필요한 것만 BaseForm에 넣습니다. 일부 화면에서만 쓰는 기능을 BaseForm에 넣으면 불필요한 컴포넌트가 모든 화면에 로드되어 성능에 영향을 줍니다.

**BaseForm을 직접 열지 않습니다.** `inheritedform`으로만 참조하고, TypeDefinition에 등록하지 않아 사용자가 직접 URL로 접근할 수 없게 합니다.

**중첩 상속은 피합니다.** BaseForm → MidForm → ChildForm처럼 상속을 여러 단계로 쌓으면 디버깅이 어렵고 의도치 않은 오버라이드가 발생합니다. 단일 단계 상속을 원칙으로 합니다.

## Form 상속 vs 공통 라이브러리

공통 기능을 넣는 방법은 Form 상속 외에도 **공통 스크립트 파일(lib.js)**을 Include해서 전역 함수로 제공하는 방식도 있습니다.

| 방식 | 적합한 내용 |
|------|-------------|
| BaseForm 상속 | 공통 UI 컴포넌트, 공통 Dataset, Form 생명주기 기본 구현 |
| 공통 lib 파일 | UI 없는 유틸리티 함수, 날짜 변환, 유효성 검사 함수 |

두 방식을 병행하는 것이 일반적입니다. BaseForm으로 화면 구조의 공통성을 보장하고, lib.js에 순수 함수를 모아두는 방식입니다.

---

**지난 글:** [Form 생명주기 — onCreate에서 onDestroy까지](/posts/nexacro-n-form-lifecycle/)

**다음 글:** [Form Include — 화면 조각을 재사용하는 include 기법](/posts/nexacro-n-form-include/)

<br>
읽어주셔서 감사합니다. 😊
