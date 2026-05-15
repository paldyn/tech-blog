---
title: "[Nexacro N] 팝업 생명주기"
description: "Nexacro N 팝업 Form의 생명주기 이벤트—onCreate, onInit, onOpen, onClose, onDestroy—각각의 발화 시점과 올바른 사용 패턴, onClose에서 return false로 닫힘을 취소하는 방법까지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 3
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "팝업생명주기", "onInit", "onOpen", "onClose", "onDestroy", "onCreate"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-modal-modaless/)에서 모달과 모달리스의 차이를 살펴보았다. 이번 글은 팝업 Form의 **생명주기 이벤트**—창이 열리고 닫히는 사이에 Nexacro 런타임이 순서대로 발화하는 이벤트들—를 다룬다. 이벤트를 잘못된 순서에 작성하면 컴포넌트가 아직 초기화되지 않아 오류가 나거나, 포커스가 엉뚱한 곳에 가는 문제가 생긴다.

## 생명주기 5단계

팝업 Form은 열릴 때 `onCreate → onInit → onOpen`, 닫힐 때 `onClose → onDestroy` 순서로 이벤트가 발화한다.

![팝업 생명주기 이벤트](/assets/posts/nexacro-n-popup-lifecycle-events.svg)

| 이벤트 | 발화 시점 | 컴포넌트 접근 |
|---|---|:---:|
| `onCreate` | Form 객체 생성 직후 | X |
| `onInit` | 컴포넌트 초기화 완료 후 | O |
| `onOpen` | 화면 렌더·표시 완료 후 | O |
| `onClose` | `closePopup` 호출 직전 | O |
| `onDestroy` | 메모리 해제 직전 | O (단, 부분 해제 상태) |

## onCreate

Form 객체가 메모리에 올라간 직후다. 자식 컴포넌트들이 아직 생성되지 않은 상태이므로 `this.edt_name` 같은 컴포넌트 참조는 불가능하다. **멤버 변수 선언**에만 사용하는 것이 안전하다.

```javascript
function this_onCreate(obj, e) {
  this.sMode  = "";
  this.bDirty = false;
}
```

## onInit

가장 중요한 이벤트다. 컴포넌트 초기화가 완료되어 모든 자식 컴포넌트에 접근할 수 있고, `getArgs()`로 Opener가 전달한 파라미터를 수신할 수 있다. **데이터 조회·화면 초기화**는 반드시 여기서 수행한다.

```javascript
function this_onInit(obj, e) {
  var args = this.getArgs();
  if (args) {
    this.sMode = args.mode;   // "new" | "edit" | "view"
    this.sKey  = args.key;
  }
  this.fn_initUI();
  if (this.sMode != "new") {
    this.fn_search();
  }
}
```

## onOpen

화면이 사용자에게 실제로 표시된 후 발화한다. `onInit`에서 트랜잭션을 호출하면 비동기로 동작하기 때문에, 데이터가 채워지기 전에 `onOpen`이 먼저 호출될 수 있다는 점을 유의한다. 주로 **포커스 설정·스크롤 초기화**에 사용한다.

```javascript
function this_onOpen(obj, e) {
  this.edt_search.setFocus();
  this.grd_main.setScrollPos(0, 0);
}
```

![팝업 생명주기 이벤트 핸들러 예시](/assets/posts/nexacro-n-popup-lifecycle-code.svg)

## onClose

`closePopup()`이 호출된 직후, 실제 닫힘이 처리되기 전에 발화한다. 이 이벤트에서 **`return false`를 반환하면 닫힘을 취소**할 수 있다. 미저장 변경사항 확인 등에 활용한다.

```javascript
function this_onClose(obj, e) {
  if (this.bDirty) {
    var bConfirm = this.confirm("변경사항이 있습니다. 닫겠습니까?");
    if (!bConfirm) {
      return false;   // 닫힘 취소
    }
  }
}
```

`onClose`에서 `false`를 반환해도 Opener의 콜백 함수는 호출되지 않는다. 실제로 팝업이 닫혀야 콜백이 실행된다.

## onDestroy

Form 메모리가 해제되기 직전 발화한다. 팝업 내에서 동적으로 생성한 객체나 대용량 Dataset을 여기서 정리하면 메모리 누수를 방지할 수 있다.

```javascript
function this_onDestroy(obj, e) {
  this.ds_temp.clearData();
  this.bDirty   = false;
  this.sMode    = null;
}
```

## 이벤트 등록 방법

Nexacro Studio에서는 Form 속성 창의 **Events** 탭에서 이벤트 핸들러를 연결한다. 직접 코드로 등록하려면 Form의 `addEventHandler` 메서드를 사용한다.

```javascript
// 스크립트에서 동적 등록
this.addEventHandler("onInit", this_onInit, this);
this.addEventHandler("onClose", this_onClose, this);
```

실무에서는 Studio에서 자동 생성하는 방식을 선호한다. 함수명 규칙인 `{폼ID}_{이벤트명}`을 따르면 Studio가 자동으로 매핑한다.

---

**지난 글:** [[Nexacro N] 모달과 모달리스 팝업](/posts/nexacro-n-modal-modaless/)

**다음 글:** [[Nexacro N] 팝업 스택 관리](/posts/nexacro-n-popup-stack/)

<br>
읽어주셔서 감사합니다. 😊
