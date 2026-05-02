---
title: "[Nexacro N] Menu · Navigation — 메뉴 네비게이션 구현"
description: "Nexacro N 업무 시스템의 트리 기반 메뉴 구현 패턴, 메뉴 Dataset 설계, 화면 동적 로드, 중복 탭 방지, 권한별 메뉴 제어 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 7
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "menu", "navigation", "메뉴", "loadpage", "권한", "탭"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-tree/)에서 Tree 컴포넌트로 계층 구조를 표현하는 방법을 살펴봤습니다. 이번에는 실제 업무 시스템에서 가장 핵심적인 화면인 **메뉴 네비게이션**을 구현하는 방법을 다룹니다. 트리 기반 메뉴 Dataset 설계부터 화면 동적 로드, 탭 관리, 권한 제어까지 실무 패턴을 순서대로 살펴봅니다.

## 메뉴 시스템 전체 흐름

Nexacro N 업무 시스템의 메뉴는 크게 세 부분으로 나뉩니다.

1. **메뉴 Dataset**: 서버에서 받아온 계층 메뉴 데이터
2. **Tree 컴포넌트**: 메뉴 Dataset을 계층 트리로 렌더링
3. **탭 프레임**: 클릭한 메뉴의 Form URL을 동적 로드

![메뉴 네비게이션 구조](/assets/posts/nexacro-n-menu-navigation-flow.svg)

## 메뉴 Dataset 설계

메뉴 데이터는 Tree 컴포넌트의 계층 구조에 맞게 설계합니다.

```
ds_menu 컬럼:
  menu_id    — 메뉴 고유 ID
  parent_id  — 부모 메뉴 ID (최상위는 null)
  menu_text  — 화면에 표시될 메뉴명
  form_url   — 연결할 Form 파일 경로
  order_num  — 같은 레벨에서의 정렬 순서
  use_yn     — 사용 여부 (Y/N)
  auth_yn    — 현재 사용자 권한 여부
  icon_path  — 트리 아이콘 이미지 경로
```

서버에서 로그인 사용자의 권한을 필터링해 접근 가능한 메뉴만 반환하는 것이 일반적이지만, 클라이언트에서 `auth_yn` 컬럼으로 한 번 더 제어하는 이중 방어가 안전합니다.

## 로그인 후 메뉴 로드

```javascript
function fn_loadMenu() {
  this.transaction(
    "loadMenu",
    "SVC:getMenuList",
    "",
    "out:ds_menu",
    "",
    "fn_menuCallback"
  );
}

function fn_menuCallback(sId, nEC, sEM) {
  if (nEC == 0) {
    // ds_menu 채워지면 Tree 자동 갱신
    // 첫 번째 메뉴 자동 선택 (선택사항)
    var rootNode = this.tre_menu.getRootNode();
    if (rootNode && rootNode.childcount > 0) {
      this.tre_menu.expandAll();
    }
  }
}
```

## 메뉴 클릭 → 화면 로드

노드를 클릭하면 `form_url` 컬럼의 경로로 화면을 로드합니다.

```javascript
function tre_menu_onnodeclick(obj, e) {
  // 자식이 있는 그룹 노드는 무시
  if (e.node.childcount != 0) return;

  var menuId  = e.node.getDataValue("menu_id");
  var formUrl = e.node.getDataValue("form_url");
  var menuNm  = e.node.getDataValue("menu_text");

  // 권한 확인
  var authYn = e.node.getDataValue("auth_yn");
  if (authYn != "Y") {
    alert("접근 권한이 없습니다.");
    return;
  }

  gfn_loadPage(menuId, formUrl, menuNm);
}
```

![메뉴 클릭 코드 패턴](/assets/posts/nexacro-n-menu-navigation-code.svg)

## 화면 동적 로드 — gfn_loadPage

```javascript
function gfn_loadPage(menuId, url, title) {
  // 이미 열린 탭이면 포커스만 이동
  var existIdx = fn_findOpenTab(menuId);
  if (existIdx >= 0) {
    this.tab_main.set_tabindex(existIdx);
    return;
  }

  // 새 탭 추가
  var newIdx = this.tab_main.tabcount;
  this.tab_main.addTab(title);
  this.tab_main.set_tabindex(newIdx);

  // Form 로드
  var tabForm = this.tab_main.Tab[newIdx].form;
  tabForm.loadPage(url);

  // 탭 ID 맵에 등록 (중복 방지용)
  _tabMap[menuId] = newIdx;
}
```

탭이 이미 열려있는지 `_tabMap` 객체로 추적합니다. `menuId`를 키로 사용해 중복 로드를 방지합니다.

## 탭 닫기와 ID 맵 관리

```javascript
function fn_closeTab(tabIdx) {
  // 탭 맵에서 해당 탭 제거
  for (var menuId in _tabMap) {
    if (_tabMap[menuId] == tabIdx) {
      delete _tabMap[menuId];
      break;
    }
  }

  // 탭 제거 후 인덱스 재정렬
  this.tab_main.removeTab(tabIdx);
  fn_rebuildTabMap();
}
```

탭을 닫으면 뒤따르는 탭들의 인덱스가 하나씩 당겨지므로 `_tabMap`을 재정렬해야 합니다.

## 권한별 메뉴 표시

`auth_yn` 컬럼을 기준으로 권한 없는 메뉴를 트리에서 숨기는 방법입니다.

```javascript
function fn_filterMenuByAuth() {
  var ds = this.ds_menu;
  for (var i = ds.rowcount - 1; i >= 0; i--) {
    if (ds.getColumn(i, "auth_yn") != "Y") {
      ds.deleteRow(i);
    }
  }
}
```

`fn_menuCallback` 내에서 트리 바인딩 전에 이 함수를 호출하면 권한 없는 메뉴가 처음부터 표시되지 않습니다. 역방향 반복(`rowcount-1`부터)은 행 삭제 시 인덱스가 밀리는 문제를 방지합니다.

## 즐겨찾기 메뉴

자주 사용하는 메뉴를 즐겨찾기로 저장하고 별도 트리에 표시하는 패턴도 같은 구조를 재사용합니다.

```javascript
function fn_addFavorite(menuId) {
  var row = this.ds_menu.findRow("menu_id", menuId);
  if (row < 0) return;

  var newRow = this.ds_fav.addRow();
  this.ds_fav.copyRow(newRow, this.ds_menu, row);
  // 서버에 즐겨찾기 저장
  this.transaction("saveFav", "SVC:saveFavorite",
    "in:ds_fav", "", "", "");
}
```

## 정리

메뉴 네비게이션은 Dataset 설계 → Tree 연결 → 클릭 이벤트 → 동적 로드의 네 단계로 구성됩니다. 중복 탭 방지와 권한 필터링을 초기부터 설계에 포함시키면 이후 유지보수가 훨씬 수월해집니다.

---

**지난 글:** [Nexacro N Tree — 트리 컴포넌트 완전 정복](/posts/nexacro-n-tree/)

**다음 글:** [Nexacro N Grid — 그리드 컴포넌트 개요](/posts/nexacro-n-grid-overview/)

<br>
읽어주셔서 감사합니다. 😊
