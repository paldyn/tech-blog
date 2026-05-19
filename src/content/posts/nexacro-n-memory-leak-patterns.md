---
title: "[Nexacro N] 메모리 누수 패턴과 진단"
description: "Nexacro N 애플리케이션에서 자주 발생하는 메모리 누수 패턴 4가지를 설명합니다. 전역 변수 누적, Dataset 무한 증가, 팝업 미해제, 이벤트 핸들러 잔류의 원인과 예방책을 실무 코드로 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 4
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "메모리누수", "성능최적화", "GC", "Dataset", "전역변수"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-event-handler-cleanup/)에서 이벤트 핸들러 정리 패턴을 살펴보았다. 이번 글에서는 Nexacro N 프로젝트에서 반복적으로 나타나는 **메모리 누수 패턴** 전반을 정리한다. 누수는 즉시 장애를 일으키지 않는다. 처음에는 느려지고, 조금 더 지나면 브라우저가 멈추고, 결국 사용자가 새로고침을 강요당한다. 원인을 알면 코드 작성 시점에 예방할 수 있다.

## Nexacro N에서 메모리 누수가 발생하는 이유

Nexacro N은 JavaScript 런타임 위에서 동작하지만, 모든 메모리 정리를 GC(Garbage Collector)에 맡길 수는 없다. 컴포넌트 간 참조, 이벤트 핸들러 등록, Dataset 데이터가 복잡하게 얽혀있으면 GC가 수거하지 못하는 객체가 생긴다. 특히 장시간 실행되는 업무 시스템에서는 작은 누수가 누적되어 수 시간 후에 체감 가능한 성능 저하를 일으킨다.

![Nexacro N 메모리 누수 패턴 4가지](/assets/posts/nexacro-n-memory-leak-patterns-overview.svg)

## 패턴 1: 전역 변수 누적

`var` 선언 없이 변수를 사용하면 해당 변수는 전역(application) 객체의 속성으로 등록된다. 함수가 종료되어도 전역에 남아 GC 대상이 되지 않는다.

![전역 변수 누수 방지 코드 패턴](/assets/posts/nexacro-n-memory-leak-patterns-diagnosis.svg)

```javascript
// 나쁜 패턴: var 없이 전역 등록
function fnProcess() {
    tempList = [];              // 전역에 쌓임
    for (var i = 0; i < 1000; i++) {
        tempList.push({ id: i, name: "item" + i });
    }
    fnRender(tempList);
    // tempList가 전역에 남아 GC 불가
}

// 좋은 패턴: var 선언 + 사용 후 null
function fnProcess() {
    var tempList = [];          // 함수 스코프
    for (var i = 0; i < 1000; i++) {
        tempList.push({ id: i, name: "item" + i });
    }
    fnRender(tempList);
    tempList = null;            // GC 가능하게 해제
}
```

폼 레벨에서 필요한 변수도 폼 스크립트 최상단에 명시적으로 선언한다. `form_onunload`에서 큰 객체를 담고 있는 변수는 `null`로 초기화한다.

```javascript
// 폼 변수 선언 (스크립트 최상단)
var aCachedData = null;
var nPollTimer  = -1;

function form_onunload(obj, e) {
    aCachedData = null;     // GC 대상으로 전환
    if (nPollTimer != -1) { clearInterval(nPollTimer); nPollTimer = -1; }
}
```

## 패턴 2: Dataset 무한 증가

조회 버튼을 누를 때마다 Dataset에 데이터가 추가만 되고 지워지지 않으면 행 수가 계속 늘어난다. 새 Transaction 응답이 기존 Dataset을 교체하는지, 추가하는지 확인해야 한다.

```javascript
// 나쁜 패턴: clearData 없이 반복 조회
function fnSearch() {
    // dsList.clearData() 누락!
    this.transaction("LIST", svcUrl, args, "dsList=dsList", "", "cbSearch");
    // 1회 조회: 100행, 2회: 200행, 3회: 300행... 무한 증가
}

// 좋은 패턴: 조회 전 명시적 초기화
function fnSearch() {
    this.dsList.clearData();
    this.transaction("LIST", svcUrl, args, "dsList=dsList", "", "cbSearch");
}
```

분할 로드(appendData) 패턴에서는 의도적으로 누적시키되, 최대 행 수 제한을 두어 무한 증가를 막는다.

```javascript
var MAX_ROWS = 5000;

function cbLoadMore(sId, nErrorCode, sErrorMsg) {
    if (nErrorCode != 0) return;

    // 최대 행 수 초과 시 오래된 행 제거
    while (this.dsList.rowcount + this.dsTemp.rowcount > MAX_ROWS) {
        this.dsList.deleteRow(0);
    }
    this.dsList.appendData(this.dsTemp);
    this.dsTemp.clearData();
}
```

## 패턴 3: 닫히지 않는 팝업

팝업을 열고 닫는 사이클에서 `popup.close()`를 호출하지 않으면 팝업 폼 인스턴스가 메모리에 잔류한다. 팝업을 10번 열면 10개의 폼 인스턴스가 쌓이는 셈이다.

```javascript
// 나쁜 패턴: 팝업 결과만 사용하고 close 누락
function fnOpenPopup() {
    var oPopup = this.gfn_openPopup("popSearch", "/forms/SearchPopup.xfdl", args);
}

function fnPopupCallback(oPopup, args) {
    var selectedId = args.ID;
    // oPopup.close() 누락!
    this.edtId.set_value(selectedId);
}

// 좋은 패턴: 콜백에서 반드시 close
function fnPopupCallback(oPopup, args) {
    var selectedId = args.ID;
    oPopup.close();             // 인스턴스 소멸
    this.edtId.set_value(selectedId);
}
```

팝업을 모달로 열었더라도 `close()`는 명시적으로 호출해야 한다. ESC 키나 닫기 버튼의 핸들러에서도 예외 없이 `close()`를 호출하는지 확인한다.

```javascript
// 팝업 폼 내부 닫기 버튼 핸들러
function btnClose_onclick(obj, e) {
    this.close();               // 자신을 닫음
}

// ESC 키 핸들러
function form_onkeydown(obj, e) {
    if (e.keycode === 27) {     // ESC
        this.close();
    }
}
```

## 패턴 4: 순환 참조

폼 A가 폼 B를 참조하고, 폼 B가 다시 폼 A를 참조하면 GC가 두 객체를 모두 수거하지 못한다.

```javascript
// 나쁜 패턴: 부모 폼을 직접 저장
function form_onload(obj, e) {
    // 부모 폼 객체를 저장 → 순환 참조 가능
    this.parentForm = nexacro.getApplication().activeform;
}

// 좋은 패턴: ID(문자열)만 저장, 필요할 때 조회
function form_onload(obj, e) {
    // 객체 참조 대신 ID 문자열만 보관
    this.sParentFormId = nexacro.getApplication().activeform.id;
}

function fnCallParent() {
    var oParent = nexacro.getApplication().getActiveForm(this.sParentFormId);
    if (oParent) oParent.fnCallback(result);
}

function form_onunload(obj, e) {
    this.sParentFormId = null;
}
```

## 메모리 누수 진단 방법

Chrome DevTools의 Memory 탭을 활용한다.

1. 화면을 정상 상태로 열고 Heap Snapshot을 찍는다
2. 의심스러운 작업(팝업 열기/닫기, 조회 반복 등)을 10~20회 수행한다
3. 두 번째 Heap Snapshot을 찍는다
4. 두 스냅샷을 비교(Comparison)해 새로 생긴 객체를 확인한다

Nexacro N에서는 `trace()` 함수로 Dataset 행 수를 출력해 증가 여부를 간단히 확인할 수도 있다.

```javascript
// 주기적으로 Dataset 행 수 출력
function fnDebugMemory() {
    trace("dsList.rowcount: " + this.dsList.rowcount);
    trace("dsMaster.rowcount: " + this.dsMaster.rowcount);
}

// 폼 변수 상태 점검
function fnDebugVars() {
    trace("nPollTimer: " + nPollTimer);
    trace("aCachedData: " + (aCachedData == null ? "null" : aCachedData.length));
}
```

## 정리

Nexacro N의 메모리 누수는 대부분 ① 전역 변수 누적 ② Dataset 무한 증가 ③ 팝업 미해제 ④ 이벤트 핸들러 잔류 네 가지 패턴에서 온다. 공통 원칙은 하나다 — "만든 것은 직접 정리한다." `var`로 선언하고, 조회 전 `clearData()`하고, 팝업은 `close()`하고, 핸들러는 `removeEventHandler()`로 해제한다. 이 네 가지 습관만으로 대부분의 메모리 누수를 예방할 수 있다.

---

**지난 글:** [\[Nexacro N\] 이벤트 핸들러 정리와 메모리 관리](/posts/nexacro-n-event-handler-cleanup/)

**다음 글:** [\[Nexacro N\] 폼 재사용 전략과 공통 컴포넌트](/posts/nexacro-n-form-reuse/)

<br>
읽어주셔서 감사합니다. 😊
