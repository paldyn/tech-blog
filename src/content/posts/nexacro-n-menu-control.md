---
title: "[Nexacro N] 메뉴 컨트롤"
description: "Nexacro N Menu 컴포넌트를 Dataset에 바인딩해 트리 구조 메뉴를 구성하는 방법—idcolumn, parentidcolumn, textcolumn 매핑과 onmenuclick 이벤트로 업무 화면을 동적 로드하는 실무 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 9
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "메뉴", "Menu", "onmenuclick", "Dataset바인딩", "트리메뉴", "GNB"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-load-form-runtime/)에서 런타임에 Form을 동적으로 로드하는 방법을 살펴보았다. 이번 글은 **Menu 컴포넌트**를 Dataset과 연결해 동적 트리 구조 메뉴를 구성하고, 메뉴 클릭 시 해당 화면을 로드하는 전형적인 GNB(Global Navigation Bar) 패턴을 다룬다.

## Nexacro N Menu 컴포넌트

Menu 컴포넌트는 계층형 메뉴를 표현하는 전용 컴포넌트다. Dataset에 메뉴 목록을 담고, `idcolumn`·`parentidcolumn`·`textcolumn`을 지정하면 트리 구조를 자동으로 렌더링한다. 서버에서 사용자별 메뉴 권한을 조회해 Dataset에 채우면 별도 코드 없이 권한별 메뉴가 표시된다.

![Nexacro N 메뉴 구성 구조](/assets/posts/nexacro-n-menu-control-structure.svg)

## 메뉴 Dataset 구조

```
ds_menu 컬럼: menuId | menuNm | parentId | menuUrl | menuLevel | menuOrder
```

| 컬럼 | 설명 |
|---|---|
| `menuId` | 메뉴 고유 ID (트리 식별) |
| `parentId` | 상위 메뉴 ID (최상위는 공백 또는 null) |
| `menuNm` | 화면 표시 텍스트 |
| `menuUrl` | 연결할 Form URL (폴더 메뉴는 공백) |
| `menuLevel` | 계층 깊이 (1=1단계, 2=2단계) |

## Dataset 바인딩

서버에서 메뉴 Dataset을 받아온 뒤 아래 속성을 설정하면 Menu 컴포넌트가 자동으로 계층 구조를 구성한다.

```javascript
function fn_bindMenu() {
  var oMenu = this.mnu_main;
  oMenu.set_binddataset("ds_menu");
  oMenu.set_idcolumn("menuId");
  oMenu.set_parentidcolumn("parentId");
  oMenu.set_textcolumn("menuNm");
  oMenu.refresh();
}
```

`refresh()`를 호출해야 변경사항이 화면에 반영된다. 메뉴 Dataset이 트랜잭션 콜백에서 채워지는 경우, 콜백 함수 안에서 `fn_bindMenu()`를 호출한다.

![메뉴 Dataset 바인딩 · 클릭 처리](/assets/posts/nexacro-n-menu-control-code.svg)

## onmenuclick 이벤트

메뉴 항목 클릭 시 `onmenuclick` 이벤트가 발화한다. 이벤트 객체 `e`에서 클릭된 메뉴 ID(`e.menuID`)와 Dataset 행 인덱스(`e.row`)를 얻을 수 있다.

```javascript
function mnu_main_onmenuclick(obj, e) {
  var sId  = e.menuID;
  var nRow = e.row;
  var sUrl = this.ds_menu.getColumn(nRow, "menuUrl");

  if (!sUrl || sUrl.trim() === "") {
    // 폴더 메뉴는 하위 펼치기만 함
    return;
  }

  var oWork = application.mainframe.workarea;

  // 이미 열린 탭이면 활성화
  if (oWork.getChildFrame(sId)) {
    oWork.activate(sId);
    return;
  }

  // 새 화면 로드
  oWork.createContents(sId, sUrl);
}
```

## 메뉴 상태 관리

현재 활성 메뉴를 시각적으로 강조하거나, 닫힌 탭과 메뉴 선택 상태를 동기화할 때는 `setMenuItemActive`(버전에 따라 `setFocus`)를 사용한다.

```javascript
// 화면 로드 후 해당 메뉴 항목 활성화 표시
function fn_setMenuActive(sMenuId) {
  var oMenu = application.mainframe.fnb_menu.mnu_main;
  var nRow  = this.ds_menu.findRow("menuId", sMenuId);
  if (nRow >= 0) {
    oMenu.setFocus(nRow);
  }
}
```

## Tree 컴포넌트와의 차이

Menu 컴포넌트는 가로 GNB 또는 세로 사이드바 형태 메뉴에 최적화되어 있다. 계층 구조를 접고 펴는 트리 형태 사이드메뉴가 필요하다면 Tree 컴포넌트를 사용하고, 동일한 Dataset 구조를 적용할 수 있다. 바인딩 속성명(`idcolumn`, `parentidcolumn`, `textcolumn`)은 동일하다.

## 서버에서 메뉴 로드

메뉴는 일반적으로 로그인 직후 한 번 조회해 Application 전역 Dataset에 저장한다.

```javascript
// Application Frame onInit에서 메뉴 조회
function fn_loadMenu() {
  this.transaction(
    "loadMenu",
    "svc/menu/getMenuList",
    "", "ds_menu=out_menu",
    "",
    "fn_menuCallback"
  );
}

function fn_menuCallback(svcId, errCode, errMsg) {
  if (errCode != 0) return;
  application.gds_menu.copyData(this.ds_menu);
  this.fn_bindMenu();
}
```

---

**지난 글:** [[Nexacro N] 런타임 폼 로드](/posts/nexacro-n-load-form-runtime/)

**다음 글:** [[Nexacro N] 권한 기반 메뉴](/posts/nexacro-n-permission-menu/)

<br>
읽어주셔서 감사합니다. 😊
