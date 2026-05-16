---
title: "[Nexacro N] Tab Frame 구성"
description: "Nexacro N에서 TabControl과 ChildFrame을 조합해 MDI(Multiple Document Interface) 스타일 탭 내비게이션을 구현하는 방법, 탭 열기·닫기·중복 방지·생명주기 관리를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 2
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "TabFrame", "MDI", "ChildFrame", "탭내비게이션", "화면관리"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-multilingual-menu/)에서 다국어 메뉴를 Dataset 교체 방식으로 구현하는 법을 살펴보았다. 업무 시스템에서 메뉴를 클릭할 때 화면을 어떻게 열지 결정하는 것은 UX의 핵심이다. 탭(Tab) 방식은 여러 화면을 동시에 열어두고 전환하는 MDI 패턴의 대표 구현으로, Nexacro N에서도 실무 표준으로 자리잡고 있다.

## Tab Frame이란

Tab Frame은 Application Frame 안에 `TabControl` 컴포넌트를 배치하고, 각 탭 아이템마다 `ChildFrame`(또는 `Frame`)을 내장하는 구조다. 메뉴를 클릭하면 탭이 추가되고 해당 탭의 Frame 안에 업무 Form이 동적으로 로드된다. 사용자는 탭을 클릭해 여러 화면 사이를 전환하고, 탭의 X 버튼으로 화면을 닫는다.

![Tab Frame 구조](/assets/posts/nexacro-n-tab-frame-structure.svg)

## 기본 레이아웃 설정

Application Frame(`MainFrame.xfdl`)에 `TabControl`을 전체 영역으로 배치한다.

```xml
<TabControl id="tabMain"
    left="0" top="0" width="100%" height="100%"
    tabposition="top"
    onbeforeselecttab="tabMain_onbeforeselecttab"
    onchanged="tabMain_onchanged"/>
```

`tabposition="top"`은 탭 헤더를 상단에 배치한다. 좌측 탭(`"left"`)이나 하단 탭(`"bottom"`)도 지원한다.

## 탭 열기 함수

메뉴 클릭 시 탭을 여는 핵심 함수는 다음과 같다.

```javascript
function fn_openTab(sId, sUrl, sTitle) {
    var oExist = this.tabMain.findTabItemById(sId);
    if (oExist) {
        this.tabMain.tabIndex = oExist.index;
        return;
    }
    var oNew = this.tabMain.addTabItem(sId, sTitle);
    oNew.closeable = true;
    oNew.frame.loadForm(sUrl);
    this.tabMain.tabIndex = oNew.index;
}
```

`findTabItemById(sId)`로 이미 열린 탭을 확인해 중복 탭 생성을 막는다. 동일 화면이 이미 열려 있으면 포커스만 이동시킨다.

![Tab Frame 핵심 코드](/assets/posts/nexacro-n-tab-frame-code.svg)

## 탭 닫기 처리

탭의 X 버튼을 클릭하면 `onbeforeselecttab` 또는 별도 `onclose` 이벤트가 발생한다. 닫기 전 변경 사항 확인 로직을 추가할 수 있다.

```javascript
function tabMain_onbeforeselecttab(obj, e) {
    // 닫기(e.closetab == true)인 경우만 처리
    if (e.closetab) {
        var oItem = obj.getTabItem(e.tabindex);
        var oForm = oItem.frame.form;
        if (oForm && oForm.fn_isDirty && oForm.fn_isDirty()) {
            var nRet = this.gfn_confirm("저장하지 않은 내용이 있습니다. 닫으시겠습니까?");
            if (nRet != 1) {
                e.cancel = true;
            }
        }
    }
}
```

`e.cancel = true`로 이벤트를 취소하면 탭이 닫히지 않는다. 자식 Form에 `fn_isDirty()` 함수를 구현해 변경 감지 여부를 반환하면 닫기 전 확인 UX를 쉽게 구현할 수 있다.

## 탭 내 Form 생명주기

| 단계 | 이벤트 | 설명 |
|------|--------|------|
| 탭 열기 | `loadForm()` 후 `onload` | Form 초기화, 트랜잭션 호출 |
| 탭 비활성화 | `onhide` (지원 시) | 타이머 정지 등 리소스 절약 |
| 탭 활성화 | `onshow` (지원 시) | 데이터 갱신 등 복귀 처리 |
| 탭 닫기 | `ondestroy` | 메모리 해제, 타이머 정리 |

탭 Frame 안의 Form은 탭을 닫을 때 `ondestroy`가 호출되며 메모리에서 해제된다. 탭을 전환해도 Form은 메모리에 유지되므로, `setInterval` 같은 타이머는 `ondestroy`에서 반드시 해제해야 한다.

## 홈 탭 고정

첫 번째 탭(홈)은 닫을 수 없도록 설정한다.

```javascript
function Frame_onload(obj, e) {
    // 홈 탭은 최초 고정 배치
    var oHome = this.tabMain.getTabItem(0);
    oHome.closeable = false;
    oHome.frame.loadForm("home.xfdl");
}
```

`closeable = false`로 설정하면 탭 헤더에 X 버튼이 표시되지 않는다.

## 메뉴와 연결

Menu 컴포넌트의 `onitemclick` 이벤트에서 `fn_openTab()`을 호출한다.

```javascript
function menuMain_onitemclick(obj, e) {
    var sId    = e.item.getColumn("MENU_ID");
    var sUrl   = e.item.getColumn("MENU_URL");
    var sTitle = e.item.getColumn("MENU_NM");
    if (sUrl) {
        this.fn_openTab(sId, sUrl, sTitle);
    }
}
```

메뉴 Dataset의 `MENU_URL`에 xfdl 파일 경로를 저장해두면 메뉴 데이터만 변경해도 새 화면을 탭에 연결할 수 있다.

## 정리

Tab Frame 패턴은 TabControl의 `addTabItem()`, ChildFrame의 `loadForm()`을 조합해 동적으로 업무 화면을 열고 닫는다. 중복 탭 방지, 닫기 전 변경 확인, 홈 탭 고정이 실무에서 반드시 구현해야 할 세 가지 핵심 요소다.

---

**지난 글:** [다국어 메뉴 구성](/posts/nexacro-n-multilingual-menu/)

**다음 글:** [페이지 내비게이션](/posts/nexacro-n-page-navigation/)

<br>
읽어주셔서 감사합니다. 😊
