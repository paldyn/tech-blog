---
title: "[Nexacro N] Form Include — 화면 조각을 재사용하는 include 기법"
description: "Nexacro N의 Include 컴포넌트를 이용해 검색 바, 버튼 바 같은 공통 UI 조각을 여러 Form에서 재사용하는 방법과 부모-자식 통신 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 5
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "Include", "Form Include", "UI 재사용", "공통 컴포넌트", "화면 조각"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-form-inheritance/)에서 BaseForm 상속으로 공통 함수·Dataset을 물려받는 방법을 살펴봤습니다. 상속은 Form 계층에 대한 공통성을 다루지만, 화면의 특정 **UI 영역**을 조각으로 분리해 재사용하는 데는 **Include**가 더 적합합니다. 검색 조건 바, 버튼 바, 페이지네이션 같은 반복 UI를 별도 xfdl로 만들어두고 `<Include>` 태그 하나로 삽입하는 방식입니다.

## Include 컴포넌트란

`<Include>`는 Nexacro N에서 제공하는 컨테이너 컴포넌트로, 지정된 xfdl 파일을 현재 Form의 특정 위치에 삽입합니다. HTML의 `<iframe>`과 달리 삽입된 Form은 부모 Form과 같은 렌더링 트리에 포함되며, 화면이 자연스럽게 합쳐져 보입니다.

```xml
<!-- OrderList.xfdl — SearchBar 조각 삽입 -->
<Form id="OrderList" width="1720" height="1020">
  <Objects>
    <!-- 버튼 바 공통 조각 -->
    <Include id="incBtn"
             left="0" top="0"
             width="1720" height="40"
             src="common/ButtonBar.xfdl" />
    <!-- 검색 조각 -->
    <Include id="incSearch"
             left="0" top="40"
             width="1720" height="60"
             src="common/SearchBar.xfdl" />
    <!-- 업무 Grid -->
    <Grid id="grdOrder"
          left="0" top="100"
          width="1720" height="920" />
  </Objects>
</Form>
```

`src` 속성에 Include할 xfdl 경로를 지정합니다. 경로는 프로젝트 루트 기준 상대 경로 또는 `Service.xml`에 등록된 서비스 URL을 사용합니다.

![Form Include — 화면 조각 재사용](/assets/posts/nexacro-n-form-include-concept.svg)

## Include Form 작성

Include될 xfdl은 일반 Form과 동일하게 작성합니다. 다만 Include로만 쓸 것이라면 `TypeDefinition.xml`에 등록하지 않아 단독 접근을 막는 것이 원칙입니다.

```xml
<!-- common/SearchBar.xfdl — 공통 검색 바 -->
<Form id="SearchBar" width="1720" height="60">
  <Objects>
    <Edit id="edtKeyword"
          left="10" top="14"
          width="200" height="32"
          placeholder="검색어 입력" />
    <Combo id="cboDateRange"
           left="220" top="14"
           width="120" height="32" />
    <Calendar id="calFrom"
              left="350" top="14"
              width="130" height="32" />
    <Static id="stcWave"
            left="490" top="14"
            width="20" height="32"
            text="~" />
    <Calendar id="calTo"
              left="518" top="14"
              width="130" height="32" />
    <Button id="btnSearch"
            left="660" top="14"
            width="80" height="32"
            text="조회" />
  </Objects>
  <Script>
    <![CDATA[
      function btnSearch_onclick(obj, e) {
          // 부모 Form의 fn_search 호출
          var parentForm = this.parent.parent;
          if (typeof parentForm.fn_search === "function") {
              parentForm.fn_search();
          }
      }

      function fn_setDefaults(oConfig) {
          if (oConfig.keyword) {
              this.edtKeyword.set_value(oConfig.keyword);
          }
      }

      function fn_getParams() {
          return {
              keyword:   this.edtKeyword.value,
              dateFrom:  this.calFrom.value,
              dateTo:    this.calTo.value
          };
      }
    ]]>
  </Script>
</Form>
```

`fn_getParams()` 함수처럼 Include Form이 수집한 검색 조건을 반환하는 인터페이스를 만들어두면 부모 Form이 깔끔하게 꺼낼 수 있습니다.

## 부모 Form에서 Include Form 접근

Include 컴포넌트의 `form` 속성으로 내부 Form 객체를 참조합니다.

```javascript
// OrderList.xfdl 스크립트
function Form_onload(obj, e) {
    // Include Form에 초기 설정 전달
    var incSearchForm = this.incSearch.form;
    incSearchForm.fn_setDefaults({ keyword: "" });

    this.fn_search();
}

function fn_search() {
    // Include Form에서 검색 파라미터 수집
    var params = this.incSearch.form.fn_getParams();

    // Dataset에 파라미터 세팅
    this.dsSearchParam.setColumn(0, "keyword",  params.keyword);
    this.dsSearchParam.setColumn(0, "dateFrom", params.dateFrom);
    this.dsSearchParam.setColumn(0, "dateTo",   params.dateTo);

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

![Include 선언 및 부모-자식 통신 코드](/assets/posts/nexacro-n-form-include-code.svg)

## Include Form에서 부모 Form 접근

Include Form 스크립트에서 부모 Form을 참조할 때는 `this.parent.parent`를 사용합니다. `this.parent`는 Include 컴포넌트 자체이고, 그 `parent`가 부모 Form입니다.

```javascript
// SearchBar.xfdl — 부모 Form 접근
function fn_callParent(fnName, args) {
    var parentForm = this.parent.parent;
    if (typeof parentForm[fnName] === "function") {
        parentForm[fnName](args);
    }
}
```

이처럼 직접 참조 대신 함수명을 문자열로 전달하는 패턴을 쓰면 SearchBar가 어느 Form에 Include되든 동작합니다.

## Include vs 상속 비교

| 항목 | Include | 상속(inheritedform) |
|------|---------|---------------------|
| 적용 방식 | `<Include>` 태그 삽입 | `inheritedform` 속성 |
| 재사용 대상 | UI 조각 (컴포넌트 영역) | 함수·Dataset·공통 UI 전체 |
| 복수 적용 | 한 Form에 여러 개 가능 | BaseForm 하나만 |
| 독립성 | 부분 독립 (독자 스크립트 보유) | BaseForm과 강하게 결합 |
| 통신 | parent.parent 참조 또는 이벤트 | 함수·변수 직접 공유 |

두 방식은 경쟁 관계가 아니라 **상호 보완**입니다. BaseForm 상속으로 공통 함수·Dataset을 제공하고, Include로 반복 UI 조각을 삽입하는 조합이 실무 표준 패턴입니다.

## 여러 Include 조각 관리

화면 수가 많아지면 Include할 조각도 늘어납니다. 조각 파일 관리 규칙을 미리 정해두면 혼란을 막을 수 있습니다.

```
common/
├── ButtonBar.xfdl    ← 조회/신규/저장/삭제 버튼
├── SearchBar.xfdl    ← 날짜·키워드 검색 바
├── PagingBar.xfdl    ← 페이지네이션
└── StatusBar.xfdl    ← 건수·처리 상태 표시
```

각 조각은 `fn_getParams()` (인풋 반환), `fn_setDefaults(config)` (초기값 설정), `fn_reset()` (초기화)의 3개 인터페이스를 통일해두면 부모 Form 코드가 간결해집니다.

---

**지난 글:** [Form 상속 — 공통 기능을 BaseForm으로 물려받기](/posts/nexacro-n-form-inheritance/)

**다음 글:** [레이아웃과 스타일 기초 — Nexacro N의 화면 배치 원리](/posts/nexacro-n-layout-and-style/)

<br>
읽어주셔서 감사합니다. 😊
