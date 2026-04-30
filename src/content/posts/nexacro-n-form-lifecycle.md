---
title: "[Nexacro N] Form 생명주기 — onCreate에서 onDestroy까지"
description: "Nexacro N Form의 생명주기 이벤트(oncreate, onload, onactivate, onbeforeunload, onunload, ondestroy)를 순서와 실전 활용 패턴 중심으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 3
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "Form 생명주기", "onload", "onunload", "onactivate", "이벤트"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-application-frame-form/)에서 Application, MainFrame, ChildFrame, Form의 런타임 객체 트리를 살펴봤습니다. 이번에는 Form 하나가 로드되고 사용되다 언로드되기까지 발생하는 **생명주기 이벤트**를 다룹니다. 어느 이벤트에서 무엇을 해야 하는지 아는 것은 Nexacro N 개발의 가장 기본적인 규칙입니다. 잘못된 시점에 초기화 코드를 넣으면 데이터가 비어 있거나, 화면이 깜빡이거나, 메모리가 누수됩니다.

## 생명주기 이벤트 전체 순서

Form 하나의 전체 생애는 세 단계로 나눌 수 있습니다. **로드 단계**, **활성 단계**, **언로드 단계**입니다.

```
[로드]
oncreate → onprecreate → onload ★ → onloaded

[활성]
onactivate → (사용자 이벤트: onclick, onkeydown …) → ondeactivate

[언로드]
onbeforeunload → onunload ★ → ondestroy
```

★ 표시된 `onload`와 `onunload`가 실무에서 가장 자주 쓰이는 핵심 이벤트입니다.

![Form 생명주기 이벤트 순서](/assets/posts/nexacro-n-form-lifecycle-events.svg)

## 로드 단계 이벤트

### oncreate

Form 객체가 메모리에 생성된 직후 발생합니다. UI 컴포넌트는 아직 초기화 전이므로 컴포넌트를 참조하면 안 됩니다. 이 이벤트를 직접 사용하는 경우는 드뭅니다.

### onprecreate

컴포넌트 생성 직전 발생합니다. UI 렌더링 전에 필요한 환경 설정을 넣을 수 있지만 역시 잘 쓰이지 않습니다.

### onload ★

**가장 중요한 이벤트입니다.** 모든 UI 컴포넌트가 생성 완료된 후 발생하므로 여기서 컴포넌트를 참조하고 초기 데이터를 조회하는 것이 안전합니다.

```javascript
function Form_onload(obj, e) {
    // 팝업으로 열린 경우 인자 수신
    var args = this.opener ? this.opener.popupArgs : null;

    // 공통 초기화 (BaseForm 함수 또는 공통 lib)
    this.gfn_init(this);

    // 초기 데이터 조회
    this.fn_search();
}
```

### onloaded

Form이 완전히 렌더링된 후 발생합니다. 레이아웃이 확정된 뒤에 계산이 필요한 작업(예: 동적 Grid 컬럼 너비 조정)에 사용합니다.

## 활성 단계 이벤트

### onactivate

Form이 포커스를 받을 때마다 발생합니다. 팝업을 열었다 닫으면 부모 Form의 `onactivate`가 발생합니다. 팝업에서 데이터를 선택한 후 부모 목록을 자동으로 갱신하는 데 활용됩니다.

```javascript
// 팝업 닫힌 후 갱신 플래그 체크
function Form_onactivate(obj, e) {
    if (this.bNeedRefresh) {
        this.fn_search();
        this.bNeedRefresh = false;
    }
}
```

### ondeactivate

Form이 포커스를 잃을 때 발생합니다. 실시간 업데이트 타이머를 일시정지하거나 자동저장 트리거로 사용할 수 있습니다.

## 언로드 단계 이벤트

### onbeforeunload

화면이 전환되기 직전에 발생합니다. `return false`를 반환하면 화면 전환이 취소됩니다. 미저장 데이터 경고에 가장 많이 쓰입니다.

```javascript
function Form_onbeforeunload(obj, e) {
    // Dataset에 수정된 행이 있으면 확인
    if (this.dsOrder.getUpdateRowCount() > 0 ||
        this.dsOrder.getInsertRowCount() > 0) {
        var ok = confirm("저장하지 않은 변경이 있습니다.\n화면을 떠나시겠습니까?");
        if (!ok) {
            return false; // 화면 전환 취소
        }
    }
}
```

### onunload ★

Form이 ChildFrame에서 제거될 때 발생합니다. **타이머, 구독, 이벤트 리스너 등 명시적으로 해제해야 하는 리소스를 여기서 정리합니다.** 이 정리를 빠뜨리면 메모리 누수가 발생합니다.

```javascript
function Form_onunload(obj, e) {
    // 폴링 타이머 해제
    if (this.nTimerId) {
        this.clearInterval(this.nTimerId);
        this.nTimerId = null;
    }
    // WebSocket 연결 종료
    if (this.oWs) {
        this.oWs.close();
        this.oWs = null;
    }
}
```

### ondestroy

Form 객체가 메모리에서 완전히 제거될 때 발생합니다. 일반적으로 `onunload`에서 정리를 완료하므로 `ondestroy`까지 직접 핸들링하는 경우는 많지 않습니다.

## 팝업 Form의 생명주기 특성

PopupForm은 일반 Form과 생명주기가 동일하지만 몇 가지 차이가 있습니다.

- **opener 참조**: `this.opener`로 팝업을 열어준 부모 Form 객체에 접근할 수 있습니다.
- **onload에서 인자 수신**: `this.opener.popupArgs`로 부모가 전달한 인자를 받습니다.
- **닫힐 때 콜백 호출**: 결과를 돌려줄 때는 `this.opener.fn_popupCallback(result)`처럼 부모 함수를 직접 호출합니다.

```javascript
// PopupForm.xfdl — onload에서 인자 수신
function Form_onload(obj, e) {
    var args = this.opener.popupArgs;
    if (args && args.searchType) {
        this.edtType.set_value(args.searchType);
    }
    this.fn_search();
}

// 팝업 확인 버튼 클릭
function btnOk_onclick(obj, e) {
    var row = this.grdResult.selectrow;
    var result = {
        custCd:  this.dsResult.getColumn(row, "custCd"),
        custNm:  this.dsResult.getColumn(row, "custNm")
    };
    this.opener.fn_popupCallback("popSearch", result);
    this.close();
}
```

![Form 생명주기 이벤트 핸들러 패턴](/assets/posts/nexacro-n-form-lifecycle-code.svg)

## 생명주기별 역할 요약

| 이벤트 | 하는 일 |
|--------|---------|
| `onload` | 공통 초기화, 코드 로드, 초기 데이터 조회 |
| `onloaded` | 렌더 후 레이아웃 계산 (컬럼 폭, 동적 UI) |
| `onactivate` | 팝업 복귀 후 목록 갱신, 실시간 업데이트 재개 |
| `ondeactivate` | 타이머 일시정지, 자동저장 트리거 |
| `onbeforeunload` | 미저장 확인 다이얼로그, 전환 취소 |
| `onunload` | 타이머·소켓·구독 해제, 변수 null 처리 |

## 자주 하는 실수

**onload 전에 Dataset 참조**: `oncreate`나 스크립트 최상위에서 `this.dsOrder.clearData()`를 호출하면 오류가 납니다. Dataset도 `onload` 이후에 참조해야 합니다.

**onunload 누락**: `setInterval()`로 만든 타이머를 `onunload`에서 `clearInterval()`하지 않으면 Form이 언로드된 후에도 타이머가 실행되어 에러가 발생합니다.

**onbeforeunload 오남용**: 단순 읽기 전용 화면에서도 `return false`를 남발하면 사용자가 화면을 빠져나갈 수 없는 상황이 생깁니다. 실제 변경 여부를 정확히 확인하는 로직이 필요합니다.

---

**지난 글:** [Application·Frame·Form의 관계 — 화면 계층 구조 심층 분석](/posts/nexacro-n-application-frame-form/)

**다음 글:** [Form 상속 — 공통 기능을 BaseForm으로 물려받기](/posts/nexacro-n-form-inheritance/)

<br>
읽어주셔서 감사합니다. 😊
