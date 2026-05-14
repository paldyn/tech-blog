---
title: "[Nexacro N] BaseForm — 기본 폼 아키텍처"
description: "Nexacro N 프로젝트에서 모든 업무 폼이 공통 기능을 상속받는 BaseForm 설계 방법—forminclude 상속, 공통 훅 메서드 패턴, 세션 체크 자동화를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 6
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "BaseForm", "forminclude", "상속", "공통폼", "훅메서드", "아키텍처"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-common-confirm/)에서 공통 confirm 팝업 설계를 다루었다. 공통 라이브러리 시리즈의 마지막 주요 요소인 **BaseForm** 을 살펴본다. BaseForm은 모든 업무 폼이 상속하는 공통 기본 폼이다. 세션 체크, 공통 툴바, 표준 메서드 구조를 한 곳에 모아 두면 업무 폼은 순수 업무 로직에만 집중할 수 있다.

## BaseForm이 필요한 이유

100개 업무 폼이 있다고 가정하자. 폼마다 `Form_onload`에서 세션 체크 코드를 작성하면, 세션 체크 로직이 바뀔 때 100개 파일을 모두 수정해야 한다. BaseForm에 한 번 작성하면 수정은 BaseForm 1개로 끝난다.

| 기능 | BaseForm에 두는 이유 |
|---|---|
| 세션(로그인) 체크 | 모든 폼에서 동일하게 적용 |
| 메뉴 권한 체크 | 화면 접근 전 일괄 검사 |
| 공통 툴바(저장·삭제·인쇄) | UI 일관성 |
| fn_search / fn_save / fn_delete 훅 | 단축키 매핑 표준화 |
| F5 새로 고침 단축키 | 모든 폼에 동일 동작 |

![BaseForm 상속 계층 구조](/assets/posts/nexacro-n-base-form-hierarchy.svg)

## forminclude로 상속 설정

Nexacro N에서는 `forminclude` 속성으로 부모 폼을 지정한다.

```xml
<!-- SCR001.xfdl -->
<Form id="SCR001" forminclude="common/BaseForm.xfdl" ...>
  ...
</Form>
```

`forminclude`로 지정한 폼의 컴포넌트와 스크립트가 자식 폼에 포함된다. 자식 폼에서 같은 이름의 함수를 정의하면 부모 함수를 override한다.

## BaseForm 스크립트 구조

![BaseForm 스크립트 패턴](/assets/posts/nexacro-n-base-form-code.svg)

```javascript
// BaseForm.xfdl 스크립트

// 공통 onload — 모든 업무 폼 로드 시 실행
function Form_onload(obj, e) {
    // 세션 체크
    if (gfn_isNull(gv_userId)) {
        gfn_alert("세션이 만료되었습니다.");
        gfn_gotoLogin();
        return;
    }
    // 권한 체크
    if (!gfn_checkAuth(this.form.id)) {
        gfn_alert("접근 권한이 없습니다.");
        this.close();
        return;
    }
    // 업무 폼에서 override할 초기화 훅 호출
    this.fn_init();
}

// F5: 조회 단축키
function Form_onkeydown(obj, e) {
    if (e.keycode === 116) { // F5
        this.fn_search();
        return false; // 기본 새로 고침 방지
    }
}

// 업무 폼이 override하는 훅 메서드 (기본은 빈 구현)
function fn_init()   { /* 업무 폼에서 override */ }
function fn_search() { /* 업무 폼에서 override */ }
function fn_save()   { /* 업무 폼에서 override */ }
function fn_delete() { /* 업무 폼에서 override */ }
```

## 업무 폼에서 훅 override

업무 폼은 필요한 훅만 override한다. override하지 않은 훅은 BaseForm의 빈 기본 구현이 실행된다.

```javascript
// SCR001_주문조회.xfdl — fn_init과 fn_search만 override

function fn_init() {
    // 검색 조건 초기값 설정
    this.edt_fromDate.set_value(gfn_today());
    this.edt_toDate.set_value(gfn_today());
    this.fn_search();
}

function fn_search() {
    // 조건 유효성 체크
    if (gfn_isNull(this.edt_fromDate.value)) {
        gfn_alert("시작일을 입력하세요.");
        this.edt_fromDate.setFocus();
        return;
    }
    this.transaction(
        "search",
        "/order/getList.do",
        "in:ds_cond=ds_cond",
        "out:ds_list=list",
        "fn_searchCb",
        false
    );
}

function fn_searchCb(sId, nEC, sEM) {
    if (nEC != 0) { gfn_alert(sEM); return; }
    // 결과 처리 — 그리드에 자동 바인딩
}
```

## 공통 툴바 컴포넌트

BaseForm에 공통 툴바 영역을 만들고 저장·삭제·인쇄 버튼을 배치한다. 버튼 클릭 이벤트에서 각각 `this.fn_save()`, `this.fn_delete()`를 호출하면 업무 폼이 override한 메서드가 실행된다.

```javascript
// BaseForm의 공통 저장 버튼
function btn_save_onclick(obj, e) {
    this.fn_save(); // 업무 폼의 fn_save가 실행됨
}

function btn_delete_onclick(obj, e) {
    this.fn_delete(); // 업무 폼의 fn_delete가 실행됨
}
```

업무 폼에서 특정 버튼을 숨기고 싶을 때는 `fn_init`에서 `this.btn_delete.set_visible(false)` 를 호출한다.

## BaseForm 설계 시 주의사항

**너무 많은 기능을 BaseForm에 넣지 말 것**: BaseForm이 비대해지면 작은 변경도 전체 폼에 영향을 준다. 정말로 모든 폼에 공통인 기능만 넣는다.

**훅 이름 표준화**: 팀 전체가 `fn_init`, `fn_search`, `fn_save`, `fn_delete` 이름을 일관되게 사용해야 BaseForm의 툴바 버튼 이벤트가 올바르게 연결된다.

**BaseForm 자체는 단독 열기 금지**: BaseForm은 업무 폼에 포함되는 용도로만 존재한다. 직접 화면으로 열지 않도록 폼 ID 접두사나 팀 컨벤션으로 구분해 둔다.

---

**지난 글:** [[Nexacro N] 공통 confirm·alert 팝업 설계](/posts/nexacro-n-common-confirm/)

**다음 글:** [[Nexacro N] 폼 템플릿 활용 — 빠른 업무 화면 생성](/posts/nexacro-n-form-template/)

<br>
읽어주셔서 감사합니다. 😊
