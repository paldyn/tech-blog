---
title: "[Nexacro N] 권한 기반 메뉴"
description: "Nexacro N에서 역할(Role)별 메뉴 권한을 서버에서 받아 Dataset을 필터링하는 방법, 허용되지 않은 메뉴를 숨기는 패턴, 화면별 버튼 권한(신규·삭제·저장)을 전역 Dataset으로 일관되게 제어하는 실무 전략을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 10
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "권한메뉴", "역할기반", "버튼권한", "메뉴필터", "RBAC", "접근제어"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-menu-control/)에서 Menu 컴포넌트를 Dataset에 바인딩해 동적 메뉴를 구성하는 방법을 살펴보았다. 실무 업무 시스템에서는 사용자 역할(Role)에 따라 **볼 수 있는 메뉴가 달라지고**, 같은 화면이라도 **신규·수정·삭제 버튼의 활성 여부가 다르다**. 이번 글은 이 권한 기반 메뉴와 버튼 제어 전략을 다룬다.

## 권한 처리 전략

Nexacro N 환경에서 권한 처리는 두 계층으로 나뉜다.

| 계층 | 위치 | 목적 |
|---|---|---|
| 메뉴 필터링 | 클라이언트 (Dataset 조작) | 접근 불가 메뉴 숨기기 |
| API 권한 차단 | 서버 | 직접 URL 접근 방어 |
| 버튼 제어 | 클라이언트 (전역 Dataset) | 행위 권한 표현 |

클라이언트 단의 메뉴 숨기기는 UX 편의이고, **실제 보안은 서버가 담당한다**. 클라이언트만 막으면 URL을 직접 입력해 우회할 수 있으므로 서버에서도 반드시 권한을 검증해야 한다.

## 메뉴 권한 Dataset 구조

로그인 성공 후 서버에서 두 가지 Dataset을 받는다.

```
gds_menu:     menuId | parentId | menuNm | menuUrl | menuLevel
gds_menuAuth: menuId | auth_read | auth_new | auth_save | auth_del
```

`gds_menu`에는 해당 사용자가 **접근 가능한 메뉴만** 담아 보내는 방식이 가장 단순하다. 서버가 역할별 필터링을 완료한 목록을 내려주면 클라이언트는 그대로 Menu 컴포넌트에 바인딩한다.

![권한 기반 메뉴 필터링 흐름](/assets/posts/nexacro-n-permission-menu-flow.svg)

## 클라이언트 측 메뉴 필터링

전체 메뉴를 내려받은 뒤 클라이언트에서 필터링하는 방식도 쓰인다. 이 경우 Dataset에서 미허용 행을 역순으로 삭제한다.

```javascript
function fn_filterMenu() {
  var dsMenu = this.ds_menu;
  var aRemove = [];

  for (var i = 0; i < dsMenu.rowcount; i++) {
    var sId = dsMenu.getColumn(i, "menuId");
    if (!fn_hasAuth(sId)) {
      aRemove.push(i);
    }
  }
  // 역순 삭제: 앞에서부터 삭제하면 인덱스가 밀림
  for (var j = aRemove.length - 1; j >= 0; j--) {
    dsMenu.deleteRow(aRemove[j]);
  }
  this.mnu_main.refresh();
}

function fn_hasAuth(sMenuId) {
  var ds = application.gds_menuAuth;
  return ds.findRow("menuId", sMenuId) >= 0;
}
```

![권한 체크 · 버튼 제어 코드](/assets/posts/nexacro-n-permission-menu-code.svg)

## 버튼 권한 제어

각 업무 화면의 `onInit`에서 자신의 `menuId`를 기반으로 `gds_menuAuth`를 조회해 버튼 활성 여부를 설정한다.

```javascript
function fn_applyButtonAuth(sMenuId) {
  var ds   = application.gds_menuAuth;
  var nRow = ds.findRow("menuId", sMenuId);

  var bNew  = nRow >= 0 && ds.getColumn(nRow, "auth_new")  == "Y";
  var bSave = nRow >= 0 && ds.getColumn(nRow, "auth_save") == "Y";
  var bDel  = nRow >= 0 && ds.getColumn(nRow, "auth_del")  == "Y";

  this.btn_new.set_enable(bNew);
  this.btn_save.set_enable(bSave);
  this.btn_delete.set_enable(bDel);
}
```

이 함수를 Base Form(공통 부모 Form)에 정의해두면, 모든 업무 화면에서 `this.fn_applyButtonAuth(this.sMenuId)`만 호출하면 일관된 권한 제어가 적용된다.

## 직접 URL 접근 차단

클라이언트 메뉴 숨김만으로는 충분하지 않다. 사용자가 `createContents`에 URL을 직접 입력하거나 브라우저 주소창으로 접근하는 경우를 서버에서 차단해야 한다.

```javascript
// 모든 화면 onInit에서 권한 재확인
function this_onInit(obj, e) {
  if (!fn_hasAuth(this.sMenuId)) {
    this.alert("접근 권한이 없습니다.");
    // 현재 Frame 제거
    if (this.parent && this.parent.deleteContents) {
      this.parent.deleteContents(this.sMenuId);
    }
    return;
  }
  fn_applyButtonAuth(this.sMenuId);
  this.fn_search();
}
```

이 이중 체크(클라이언트 + 서버)가 국내 업무 시스템 표준 보안 패턴이다.

## 권한 갱신

관리자가 실시간으로 권한을 변경하는 경우, 현재 열린 화면의 버튼 권한도 갱신해야 한다. 간단하게는 권한 변경 후 재로그인을 요청하거나, WebSocket/SSE로 권한 갱신 이벤트를 받아 `gds_menuAuth`를 업데이트하고 각 열린 화면에 알림을 보내는 방식을 사용한다.

---

**지난 글:** [[Nexacro N] 메뉴 컨트롤](/posts/nexacro-n-menu-control/)

<br>
읽어주셔서 감사합니다. 😊
