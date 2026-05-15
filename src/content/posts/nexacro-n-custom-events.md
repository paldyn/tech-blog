---
title: "[Nexacro N] 사용자 정의 이벤트(Custom Event) 만들기"
description: "Nexacro N에서 fireEventHandler로 커스텀 이벤트를 발생시키고 addEventHandler로 부모 Form에서 수신하는 패턴을 설명합니다. 팝업-부모 간 데이터 전달, Form 간 결합도 감소 설계를 예제와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 7
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "custom-event", "fireEventHandler", "addEventHandler", "popup", "form-communication"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-event-bubbling/)에서 이벤트 버블링을 다뤘습니다. 이번 글에서는 한 단계 나아가 **사용자가 직접 정의하고 발생시키는 커스텀 이벤트(Custom Event)**를 만드는 방법을 설명합니다. 커스텀 이벤트는 팝업 Form이 부모 Form에 선택 결과를 전달하거나, 재사용 가능한 컴포넌트 Form이 외부에 상태 변화를 알릴 때 매우 유용합니다. 이를 통해 Form 간 직접 참조를 없애고 느슨한 결합(loose coupling)을 구현할 수 있습니다.

## 커스텀 이벤트가 필요한 상황

Nexacro N에서 팝업 Form을 열고 사용자가 목록에서 항목을 선택하면, 그 결과를 부모 Form에 전달해야 합니다. 일반적으로 두 가지 방법을 사용합니다.

1. **팝업에서 부모 Form을 직접 참조** (`opener`, `parent` 등) — 결합도 높음
2. **커스텀 이벤트로 전달** — 팝업이 부모를 알 필요 없음, 결합도 낮음

커스텀 이벤트 방식이 재사용성과 유지보수 측면에서 훨씬 우수합니다.

![커스텀 이벤트 전달 흐름](/assets/posts/nexacro-n-custom-events-flow.svg)

## 커스텀 이벤트 발생 — fireEventHandler

자식 Form(또는 팝업 Form)에서 `fireEventHandler`로 이벤트를 발생시킵니다. 두 번째 파라미터는 이벤트명, 세 번째 파라미터는 핸들러에 전달할 데이터 객체입니다.

```javascript
// Child Form (pop_user.xfdl 의 스크립트)
function fn_select() {
    var nRow  = this.grd_user.currentrow;
    var oDs   = this.dsUser;

    if (nRow < 0) {
        alert("항목을 선택하세요.");
        return;
    }

    // 커스텀 이벤트 발생 — 부모에게 선택 결과 전달
    this.fireEventHandler("onUserSelected", {
        userId:   oDs.getColumn(nRow, "USER_ID"),
        userNm:   oDs.getColumn(nRow, "USER_NM"),
        deptCd:   oDs.getColumn(nRow, "DEPT_CD")
    });

    this.close();
}
```

`fireEventHandler`의 첫 번째 파라미터가 이벤트 이름입니다. 관례적으로 `on` + 파스칼케이스 형태를 사용합니다.

## 커스텀 이벤트 수신 — addEventHandler

부모 Form에서 팝업을 열 때 `addEventHandler`로 커스텀 이벤트 핸들러를 등록합니다.

![커스텀 이벤트 전체 코드 패턴](/assets/posts/nexacro-n-custom-events-code.svg)

```javascript
// Parent Form 스크립트
function fn_openUserPopup() {
    var oPop = this.pop_user;

    // 커스텀 이벤트 핸들러 등록
    oPop.addEventHandler("onUserSelected", fn_onUserSelected, this);

    // 팝업 열기
    oPop.open(
        "pop_user",
        "/popup/pop_user.xfdl",
        "modal",
        "left:100, top:100, width:600, height:400"
    );
}

function fn_onUserSelected(obj, e) {
    // e 객체에 fireEventHandler에서 넘긴 데이터가 담겨 있음
    var sUserId = e.userId;
    var sUserNm = e.userNm;

    this.edt_userId.value = sUserId;
    this.edt_userNm.value = sUserNm;

    fn_loadUserDetail(sUserId);
}
```

핸들러 함수 `fn_onUserSelected` 내부에서 `e.userId`, `e.userNm`처럼 `fireEventHandler`에 넘긴 객체의 속성으로 데이터에 접근합니다.

## 핸들러 정리 — removeEventHandler

팝업이 닫힌 후에는 등록한 핸들러를 제거하는 것이 좋습니다. 메모리 누수를 방지하고, 다음에 팝업을 다시 열었을 때 핸들러가 중복 등록되지 않도록 합니다.

```javascript
// 팝업 onclose 핸들러에서 제거
// (팝업 Form의 스크립트)
this.form.onclose = function(obj, e) {
    // 자신에게 등록된 onUserSelected 핸들러 제거
    this.removeEventHandler("onUserSelected", fn_onUserSelected);
};

// 또는 부모 Form에서 팝업 닫힘 이벤트로 제거
oPop.onclose = function(obj, e) {
    oPop.removeEventHandler("onUserSelected", fn_onUserSelected);
};
```

## 커스텀 이벤트로 재사용 컴포넌트 설계

커스텀 이벤트의 진가는 여러 곳에서 재사용되는 Include Form이나 컴포넌트 Form을 설계할 때 나타납니다. 예를 들어 날짜 범위 선택 컴포넌트 Form이 있다면, 날짜가 바뀔 때마다 `onDateChanged` 이벤트를 발생시켜서 부모 Form이 원하는 방식으로 반응하도록 합니다.

```javascript
// 날짜 범위 컴포넌트 Form (재사용 가능)
// cal_from 또는 cal_to 변경 시 발생
function fn_notifyDateChange() {
    this.fireEventHandler("onDateChanged", {
        fromDate: this.cal_from.value,
        toDate:   this.cal_to.value
    });
}

// 사용하는 Form 1
dateRange.addEventHandler("onDateChanged", function(obj, e) {
    this.edt_period.value = e.fromDate + " ~ " + e.toDate;
    fn_search();
}, this);

// 사용하는 Form 2 — 다른 방식으로 반응
dateRange.addEventHandler("onDateChanged", function(obj, e) {
    this.dsFilter.setColumn(0, "FROM_DT", e.fromDate);
    this.dsFilter.setColumn(0, "TO_DT",   e.toDate);
}, this);
```

각 Form이 자신만의 방식으로 날짜 변경에 반응하지만, 날짜 컴포넌트 Form 자체는 어느 Form이 자신을 사용하는지 전혀 알 필요가 없습니다.

## 커스텀 이벤트 vs 직접 참조 비교

| 비교 항목 | 직접 참조 방식 | 커스텀 이벤트 방식 |
|----------|--------------|-----------------|
| 결합도 | 높음 (부모 Form ID 알아야 함) | 낮음 (이벤트명만 알면 됨) |
| 재사용성 | 낮음 | 높음 |
| 테스트 용이성 | 어려움 | 쉬움 |
| 코드 복잡도 | 간단 | 약간 복잡 |

규모가 작은 프로젝트나 팝업이 항상 같은 부모에서만 열리는 경우에는 직접 참조도 무방합니다. 하지만 같은 팝업을 여러 화면에서 공유하거나 컴포넌트를 라이브러리로 만들 때는 커스텀 이벤트 방식이 훨씬 유리합니다.

다음 글에서는 스크립트 작성 스타일 가이드를 다룹니다. 일관된 코드 스타일이 팀 협업과 유지보수에 얼마나 중요한지 살펴봅니다.

---

**지난 글:** [이벤트 버블링과 전파 제어](/posts/nexacro-n-event-bubbling/)

**다음 글:** [스크립트 스타일 가이드](/posts/nexacro-n-script-style-guide/)

<br>
읽어주셔서 감사합니다. 😊
