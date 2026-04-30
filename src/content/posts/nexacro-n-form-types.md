---
title: "[Nexacro N] Form 타입 완전 정복 — MainFrame부터 PopupForm까지"
description: "Nexacro N의 화면 단위인 Form 타입 — MainFrame, ChildFrame, Form, PopupForm, Include Form — 을 역할과 선언 방식 중심으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 1
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "Form", "MainFrame", "ChildFrame", "PopupForm", "Include", "화면구조"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-build-distribute/)에서 Nexacro N 프로젝트를 빌드하고 웹 서버에 올리는 전 과정을 살펴봤습니다. 이제 실제 화면을 어떻게 구성하는지 본론으로 들어갈 차례입니다. Nexacro N에서 "화면"은 단순한 HTML 파일이 아닙니다. 모든 화면은 `.xfdl` 확장자를 가진 XML 파일이며, 그 루트 태그에 따라 **역할이 명확하게 구분**됩니다. Form 타입을 모르면 화면 계층 구조를 설계할 수 없기 때문에 이 개념을 먼저 잡는 것이 중요합니다.

## Nexacro N 화면의 최상위 컨테이너 — Application

모든 것의 시작은 `Application`입니다. Nexacro N 앱이 구동될 때 런타임은 `App.xml`(또는 `Application.xml`)에 정의된 Application 설정을 읽어 들입니다. Application 자체는 눈에 보이는 화면이 아니라, 전체 앱의 환경·리소스·이벤트를 관장하는 **논리적 최상위 컨테이너**입니다.

```xml
<!-- App.xml — Application 등록 예시 -->
<Application
  id="App"
  mainframe="MainFrame"
  servicepath="Service.xml"
  environmentpath="Environment.xml"
/>
```

`mainframe` 속성에 지정된 `MainFrame`이 실제 첫 화면을 구성하는 진입점입니다.

## MainFrame — 앱의 뼈대

`MainFrame`은 브라우저 창 전체를 차지하는 최상위 프레임입니다. 일반적으로 상단 헤더, 좌측 내비게이션, 중앙 컨텐츠 영역으로 나뉘는 레이아웃을 MainFrame.xfdl에 정의합니다.

```xml
<!-- MainFrame.xfdl 구조 -->
<MainFrame id="MainFrame" application="App"
           width="1920" height="1080">
  <Objects>
    <!-- 헤더 영역 -->
    <Div id="divHeader" left="0" top="0"
         width="1920" height="60" />
    <!-- 사이드 내비게이션 -->
    <Div id="divNav" left="0" top="60"
         width="200" height="1020" />
    <!-- 메인 콘텐츠 프레임 -->
    <ChildFrame id="cfContent" left="200" top="60"
                width="1720" height="1020"
                initurl="form/Home.xfdl" />
  </Objects>
</MainFrame>
```

MainFrame 안에서 실제 업무 화면을 표시하는 역할은 `ChildFrame`이 맡습니다.

![Nexacro N Form 타입 계층 구조](/assets/posts/nexacro-n-form-types-hierarchy.svg)

## ChildFrame — 화면 전환의 무대

`ChildFrame`은 MainFrame 내부에서 화면을 동적으로 교체할 수 있는 프레임입니다. 메뉴를 클릭하면 ChildFrame에 로드되는 xfdl 파일이 바뀌는 방식이 Nexacro N의 전형적인 화면 전환 패턴입니다.

```javascript
// 메뉴 클릭 시 ChildFrame에 화면 로드
function btnMenu_onclick(obj, e) {
    var cfContent = nexacro.getApplication()
        .mainframe.cfContent;
    cfContent.set_loadurl("form/OrderList.xfdl");
}
```

`set_loadurl()`을 호출하면 ChildFrame이 기존 Form을 언로드하고 새 Form을 로드합니다. 이 과정에서 Form의 생명주기 이벤트(`onload`, `onunload` 등)가 순서대로 발생합니다.

## Form (일반) — 업무 화면의 단위

`Form`은 가장 일반적인 화면 단위입니다. 주문 목록, 상품 상세, 사용자 관리처럼 각 업무 화면이 하나의 Form으로 만들어집니다. ChildFrame에 로드되거나 다른 Form에 Include되는 형태로 사용됩니다.

```xml
<!-- OrderList.xfdl — 일반 Form 선언 -->
<Form id="OrderList"
      width="1720" height="1020"
      scrollbars="autoboth"
      onload="Form_onload">
  <Objects>
    <Grid id="grdOrder" ... />
    <Button id="btnSearch" ... />
  </Objects>
  <Script>
    <![CDATA[
      function Form_onload(obj, e) {
          fn_search();
      }
    ]]>
  </Script>
</Form>
```

Form의 `width`와 `height`는 ChildFrame 크기와 일치시키거나 `scrollbars` 속성으로 스크롤을 추가합니다.

## PopupForm — 독립 팝업 창

`PopupForm`은 별도의 브라우저 창 또는 레이어로 뜨는 팝업 화면입니다. 검색 팝업, 상세 조회 팝업, 알림 팝업 등에 사용됩니다. 호출 방법은 스크립트에서 `openPopup()` 계열 함수를 사용합니다.

```javascript
// PopupForm 열기
function btnSearch_onclick(obj, e) {
    // 인자 전달 (args)
    var args = {
        searchType: "CUSTOMER",
        multiSelect: false
    };
    this.gfn_openPopup(
        "popSearch",              // 팝업 ID
        "popup/CustSearch.xfdl",  // 경로
        0, 0, 800, 600,           // x, y, w, h
        "fn_popupCallback",       // 콜백 함수명
        args,                     // 전달 인자
        "modal"                   // 모달 여부
    );
}

function fn_popupCallback(sPopupId, oResult) {
    if (oResult && oResult.custCd) {
        this.edtCustCd.set_value(oResult.custCd);
    }
}
```

`"modal"` 옵션을 주면 팝업이 닫힐 때까지 부모 화면 조작이 블로킹됩니다. `"modeless"`로 설정하면 두 창을 동시에 사용할 수 있습니다.

## Include Form — 화면 조각 재사용

`Include Form`은 공통 영역(예: 검색 조건 바, 버튼 바)을 별도 xfdl로 분리해두고 여러 화면에서 재사용하는 방식입니다. 컴포넌트처럼 삽입되며 `.xfdl`이 아닌 `<Include>` 태그로 선언합니다.

```xml
<!-- OrderList.xfdl 내 Include 사용 -->
<Form id="OrderList" width="1720" height="1020">
  <Objects>
    <!-- 공통 검색 바 재사용 -->
    <Include id="incSearchBar"
             left="0" top="0"
             width="1720" height="60"
             src="common/SearchBar.xfdl" />
    <Grid id="grdOrder" left="0" top="60"
          width="1720" height="960" />
  </Objects>
</Form>
```

Include된 Form은 부모 Form의 스크립트와 독립적으로 동작하며, 부모와의 통신은 이벤트나 직접 참조(`this.parent.incSearchBar`)로 이루어집니다.

![Form 타입별 선언 방식 비교](/assets/posts/nexacro-n-form-types-code.svg)

## Form 타입 선택 가이드

| 상황 | 추천 타입 |
|------|-----------|
| 전체 앱 레이아웃 정의 | MainFrame |
| 업무 화면 간 전환 영역 | ChildFrame |
| 하나의 업무 화면 | Form (일반) |
| 검색·확인·알림 팝업 | PopupForm |
| 공통 헤더·버튼바 재사용 | Include Form |

실무에서는 MainFrame 1개 → ChildFrame 1~2개 → 업무 Form 다수의 구조가 가장 흔합니다. 화면이 복잡한 경우 ChildFrame을 2개(좌우 분할 또는 상하 분할) 두기도 합니다.

## 핵심 정리

Nexacro N의 화면 계층은 Application → MainFrame → ChildFrame → Form 순서로 중첩됩니다. PopupForm은 이 계층과 별도로 떠 있고, Include Form은 Form의 일부로 삽입됩니다. 이 다섯 가지 타입의 역할을 명확히 구분해두면 화면 설계 단계에서 구조를 올바르게 잡을 수 있습니다.

---

**지난 글:** [빌드와 배포 — Nexacro Studio로 빌드하고 웹 서버에 올리기](/posts/nexacro-n-build-distribute/)

**다음 글:** [Application·Frame·Form의 관계 — 화면 계층 구조 심층 분석](/posts/nexacro-n-application-frame-form/)

<br>
읽어주셔서 감사합니다. 😊
