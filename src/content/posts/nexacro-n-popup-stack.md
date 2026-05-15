---
title: "[Nexacro N] 팝업 스택 관리"
description: "Nexacro N에서 팝업 위에 팝업을 여는 중첩 구조, LIFO 닫힘 순서, opener 참조로 상위 Form에 접근하는 방법, 그리고 전체 팝업을 일괄 닫는 closeAllPopup 활용까지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 4
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "팝업스택", "중첩팝업", "opener", "closeAllPopup", "팝업관리"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-popup-lifecycle/)에서 팝업 생명주기 이벤트의 발화 순서를 살펴보았다. 실무 화면에서는 팝업 위에 또 팝업을 여는 **중첩 구조**가 자주 등장한다. 목록 팝업에서 상세 팝업을 열고, 상세 팝업에서 확인 팝업을 열면 팝업 스택이 3단계까지 쌓인다.

## 팝업 스택 개념

Nexacro N은 팝업을 LIFO(후입선출) 스택으로 관리한다. 가장 마지막에 열린 팝업이 가장 먼저 닫히며, 각 팝업은 자신을 연 Form(Opener)에 대한 참조를 내부적으로 유지한다.

![팝업 스택 — 중첩 팝업 구조](/assets/posts/nexacro-n-popup-stack-diagram.svg)

```
Main → openPopup(ListPopup)
         ↳ ListPopup → openPopup(DetailPopup)
                          ↳ DetailPopup → openPopup(ConfirmPopup)
                                             ↳ ConfirmPopup.closePopup(1)
                                          DetailPopup 콜백 실행
                          DetailPopup.closePopup(1)
                       ListPopup 콜백 실행
         ListPopup.closePopup(1)
      Main 콜백 실행
```

## 중첩 팝업 열기

팝업 안에서 또 다른 팝업을 열 때는 `this.openPopup`을 동일하게 사용한다. Opener가 Main Form이 아닌 현재 팝업 Form이 된다는 점만 다르다.

```javascript
// ListPopup 내부에서 DetailPopup 열기
function btn_detail_onclick(obj, e) {
  var nRow = this.grd_list.currentrow;
  if (nRow < 0) return;
  var sKey = this.ds_list.getColumn(nRow, "itemCd");
  this.openPopup(
    "popup/ItemDetail",
    0, "fn_detailCallback",
    null, true, { key: sKey }, "700:500"
  );
}

function fn_detailCallback(objPopup, nReturn) {
  if (nReturn == 1) {
    this.fn_search();   // 목록 갱신
  }
}
```

## opener 참조

팝업 Form 내에서 `this.opener`는 직전 Opener Form을 가리킨다. 중첩된 경우 `this.opener.opener`로 2단계 위에 접근할 수 있다.

```javascript
// ConfirmPopup 내에서 ListPopup의 데이터셋 접근 (비권장)
var dsMain = this.opener.opener.ds_result;
```

그러나 `opener` 체인을 이용한 직접 접근은 팝업 구조가 변경될 때 깨지기 쉽다. **콜백 함수를 통해 데이터를 전달하는 방식**이 더 안전하다.

![팝업 스택 관리 패턴](/assets/posts/nexacro-n-popup-stack-code.svg)

## 열린 팝업 목록 조회

Application 객체를 통해 현재 열려 있는 팝업 정보를 조회할 수 있다.

```javascript
// 열린 팝업 수
var nCount = application.getPopupCount();

// 가장 위에 있는 팝업
var oTopPopup = application.getTopPopup();

// ID로 특정 팝업 찾기
var oTarget = application.getPopupByID("detailPopup");
if (oTarget) {
  oTarget.grd_list.setFocus();
}
```

## 전체 팝업 일괄 닫기

세션 타임아웃·강제 로그아웃 등 상황에서 모든 팝업을 한 번에 닫아야 할 때는 `closeAllPopup`을 사용한다.

```javascript
function fn_sessionTimeout() {
  application.closeAllPopup();
  application.gotoURL("login/Login");
}
```

`closeAllPopup`은 각 팝업의 `onClose` 이벤트를 발화하지 않고 강제 종료한다. 정리 로직이 필요한 경우 `getTopPopup`으로 하나씩 닫는 루프를 구현해야 한다.

## 중첩 팝업 설계 원칙

중첩 팝업이 3단계 이상 깊어지면 사용자 경험이 나빠진다. 다음 원칙을 지키면 스택 관리가 쉬워진다.

- 팝업 간 데이터 전달은 반드시 `extraData → getArgs` 또는 `closePopup → 콜백` 채널을 이용한다
- `this.opener` 직접 참조는 최소화하고, 반드시 null 체크를 한다
- 세션 만료·오류 상황에서는 `closeAllPopup`으로 전체 정리 후 로그인 화면으로 이동한다
- 팝업 ID(`sPopupID`)를 명시하면 `getPopupByID`로 특정 팝업을 찾아 조작할 수 있다

---

**지난 글:** [[Nexacro N] 팝업 생명주기](/posts/nexacro-n-popup-lifecycle/)

**다음 글:** [[Nexacro N] 동적 컴포넌트 생성](/posts/nexacro-n-dynamic-components/)

<br>
읽어주셔서 감사합니다. 😊
