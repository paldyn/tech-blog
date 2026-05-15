---
title: "[Nexacro N] 런타임 폼 로드"
description: "Nexacro N에서 실행 중에 Form을 동적으로 로드하는 두 가지 방법—Div.loadContents로 단일 컨테이너에 교체 표시하는 방식과 Frame.createContents로 독립 Form 인스턴스를 여러 개 관리하는 방식—을 비교하고 실무 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 8
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "loadContents", "createContents", "동적폼", "Form로드", "WorkArea", "런타임"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-dynamic-grid-columns/)에서 Grid 컬럼을 동적으로 구성하는 방법을 살펴보았다. 이번 글은 컴포넌트 하나가 아닌 **Form 전체를 런타임에 로드하는 방법**을 다룬다. 메뉴 클릭 시 해당 업무 Form을 동적으로 불러오거나, 탭 구조 없이 하나의 영역에 여러 화면을 전환하며 보여주는 시나리오에 사용한다.

## 두 가지 방식 비교

| | `loadContents` | `createContents` |
|---|---|---|
| 대상 | Div 컨테이너 | ChildFrame (WorkArea 등) |
| 동작 | 기존 Form 교체 | 독립 Form 추가 생성 |
| 동시 로드 | 1개 (교체) | 여러 개 가능 |
| 제거 | 다음 loadContents 시 자동 | `deleteContents(sId)` |
| 주 용도 | 단일 영역 화면 전환 | MDI 탭 방식 업무 화면 |

![런타임 폼 로드 방식 비교](/assets/posts/nexacro-n-load-form-runtime-flow.svg)

## loadContents

Div의 `loadContents`는 지정한 URL의 Form을 해당 Div 안에 로드한다. 기존에 로드된 Form이 있으면 자동으로 제거하고 새 Form으로 교체한다.

```javascript
function fn_showScreen(sMenuId) {
  var sUrl = this.fn_getUrl(sMenuId);
  var oArgs = { menuId: sMenuId, mode: "view" };
  this.div_work.loadContents(sUrl, oArgs);
}
```

로드가 완료되면 Div의 `onload` 이벤트가 발화한다. `obj.form`으로 로드된 Form 객체에 접근해 초기 조회 등을 실행할 수 있다.

```javascript
function div_work_onload(obj, e) {
  var oChildForm = obj.form;
  if (oChildForm && oChildForm.fn_init) {
    oChildForm.fn_init();
  }
}
```

로드된 Form 내부에서는 `this.parent`가 Div를 가리킨다. `this.parent.parent`를 통해 상위 Form에 접근할 수 있지만, 직접 참조보다 `application` 전역 변수나 이벤트 채널을 이용하는 편이 낫다.

![loadContents / createContents 코드](/assets/posts/nexacro-n-load-form-runtime-code.svg)

## createContents

ChildFrame(WorkArea)에 `createContents`를 사용하면 Form 인스턴스를 ID와 함께 독립적으로 생성한다. 여러 업무 화면을 동시에 메모리에 유지하고 `activate`로 전환하는 MDI 탭 방식 시스템에 주로 쓰인다.

```javascript
function fn_openMenu(sMenuId, sUrl) {
  var oWork = application.mainframe.workarea;

  // 이미 열린 화면이면 활성화만
  if (oWork.getChildFrame(sMenuId)) {
    oWork.activate(sMenuId);
    return;
  }
  // 새로 생성
  oWork.createContents(sMenuId, sUrl);
}

function fn_closeMenu(sMenuId) {
  var oWork = application.mainframe.workarea;
  oWork.deleteContents(sMenuId);
}
```

`getChildFrame(sId)`로 해당 ID의 Frame이 존재하는지 확인 후 중복 생성을 방지한다.

## getArgs로 파라미터 수신

`loadContents`와 `createContents` 모두 두 번째 인수로 파라미터 객체를 전달할 수 있다. 로드된 Form의 `onInit`에서 `this.getArgs()`로 수신한다.

```javascript
// 부모에서 전달
this.div_work.loadContents("screen/ItemList", { deptCd: "D001" });

// 자식 Form onInit에서 수신
function this_onInit(obj, e) {
  var args = this.getArgs();
  if (args && args.deptCd) {
    this.edt_dept.set_value(args.deptCd);
    this.fn_search();
  }
}
```

## 주의 사항

- `loadContents`는 비동기로 동작한다. 호출 직후 `obj.form`에 접근하면 아직 로드되지 않아 `null`이다. 반드시 `onload` 이벤트 핸들러 안에서 접근한다.
- 많은 수의 Form을 `createContents`로 열어두면 메모리 사용량이 누적된다. 탭을 닫을 때 `deleteContents`를 반드시 호출한다.
- `deleteContents` 호출 시 해당 Form의 `onDestroy` 이벤트가 발화한다. 정리 로직은 여기서 처리한다.

---

**지난 글:** [[Nexacro N] 동적 그리드 컬럼](/posts/nexacro-n-dynamic-grid-columns/)

**다음 글:** [[Nexacro N] 메뉴 컨트롤](/posts/nexacro-n-menu-control/)

<br>
읽어주셔서 감사합니다. 😊
