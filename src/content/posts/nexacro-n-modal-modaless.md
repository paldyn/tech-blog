---
title: "[Nexacro N] 모달과 모달리스 팝업"
description: "Nexacro N openPopup의 bModal 파라미터로 결정되는 모달·모달리스 차이, 각 모드의 동작 원리와 UI 잠금 메커니즘, 그리고 실무에서 어떤 경우에 어느 모드를 선택해야 하는지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 2
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "모달", "모달리스", "openPopup", "bModal", "팝업", "UI잠금"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-popup-callback/)에서 팝업 콜백으로 결과를 받아오는 방법을 살펴보았다. 이번 글은 팝업의 또 다른 핵심 설정인 **모달(Modal)과 모달리스(Modaless)** 차이를 다룬다. 두 모드는 `openPopup`의 다섯 번째 인수 `bModal`로 결정된다.

## 모달 vs 모달리스

모달 팝업은 팝업이 열려 있는 동안 **메인 화면을 완전히 잠근다**. 사용자는 팝업을 닫기 전까지 메인 화면의 어떤 요소도 클릭하거나 입력할 수 없다. 반면 모달리스 팝업은 팝업이 떠 있어도 메인 화면과 **동시에 조작**이 가능하다.

![모달 vs 모달리스 동작 비교](/assets/posts/nexacro-n-modal-modaless-compare.svg)

## bModal 파라미터

```javascript
this.openPopup(
  "popup/ItemSearch",  // sURL
  0,                   // nZOrder
  "fn_callback",       // sCallbackFn
  null,                // sPopupID
  true,                // bModal ← 이 값이 모달 여부 결정
  oExtraData,
  "600:450"
);
```

`bModal = true`이면 모달 팝업, `false`이면 모달리스 팝업이다. 생략하면 기본값은 `false`(모달리스)다. 그러나 **국내 업무 시스템 대부분은 `true`를 명시**한다—의도치 않게 메인 화면이 조작 가능해지는 문제를 방지하기 위해서다.

![openPopup bModal 파라미터](/assets/posts/nexacro-n-modal-modaless-code.svg)

## 모달의 UI 잠금 원리

Nexacro N에서 모달 팝업이 열리면 Application 레이어 위에 반투명 차단막(dim layer)이 씌워지고, 팝업 Form만 그 위에 렌더링된다. 키보드 이벤트와 마우스 이벤트는 팝업 범위 내에서만 처리된다. 팝업을 `closePopup`으로 닫으면 차단막이 제거되고 메인 화면이 다시 활성화된다.

## 모달리스의 활용

모달리스 팝업은 다음 상황에서 유용하다.

- **참조용 코드 조회** — 사용자가 메인 입력 화면과 코드 조회 창을 번갈아 보면서 직접 값을 입력하는 경우
- **진행 상태 표시** — 백그라운드 작업 진행률을 별도 창에 표시하고, 완료 전에도 다른 조작을 허용하는 경우
- **비교 뷰** — 두 데이터를 나란히 보여줄 때

```javascript
// 모달리스: 팝업이 열려도 메인 화면 조작 가능
this.openPopup("popup/ProgressMonitor", 0, null, "progressWin",
               false, null, "300:150");
```

단, 모달리스는 사용자가 팝업을 열어둔 채로 메인 화면 상태를 바꿔버릴 수 있어 **콜백 시점의 메인 상태가 예측하기 어렵다**. 콜백에서 메인 화면 데이터를 건드릴 때는 항상 현재 상태를 다시 확인하는 방어 코드가 필요하다.

## 실무 선택 기준

| 상황 | 권장 모드 |
|---|---|
| 필수 입력 후 확인 팝업 | Modal |
| 저장·삭제 등 데이터 변경 팝업 | Modal |
| 코드 조회·참조 팝업 | Modal (또는 모달리스) |
| 진행 상태 표시 | Modaless |
| 도움말·가이드 창 | Modaless |

국내 엔터프라이즈 시스템에서는 **대부분 Modal**을 기본값으로 쓴다. 팝업이 뜰 때 메인 화면이 함께 조작되면 트랜잭션 충돌이나 UI 불일치가 발생할 수 있기 때문이다.

## 팝업 위치 제어

모달·모달리스 모두 `sColSize` 파라미터로 크기를 지정하고, `setPosition` 메서드로 위치를 조정할 수 있다.

```javascript
// 팝업 열린 직후 onInit에서 위치 조정
function this_onInit(obj, e) {
  var nX = (application.mainframe.width  - 600) / 2;
  var nY = (application.mainframe.height - 450) / 2;
  this.setPosition(nX, nY, 600, 450);
}
```

---

**지난 글:** [[Nexacro N] 팝업 콜백 패턴](/posts/nexacro-n-popup-callback/)

**다음 글:** [[Nexacro N] 팝업 생명주기](/posts/nexacro-n-popup-lifecycle/)

<br>
읽어주셔서 감사합니다. 😊
