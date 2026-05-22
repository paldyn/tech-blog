---
title: "[Nexacro N] 트러블슈팅: 메모리 누수"
description: "Nexacro N 애플리케이션에서 발생하는 메모리 누수를 진단하고 방지하는 방법을 설명합니다. 이벤트 핸들러 미해제, 타이머, Dataset 누적, 동적 컴포넌트 정리 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 9
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "트러블슈팅", "메모리누수", "onunload", "이벤트핸들러", "Dataset", "성능"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-troubleshoot-grid-not-render/)에서 Grid 렌더링 문제를 다루었다. 이번에는 장기간 사용하는 사내 시스템에서 자주 발생하는 **메모리 누수(Memory Leak)** 문제를 살펴본다. 메모리 누수는 초기에는 증상이 없다가, 몇 시간 또는 며칠이 지난 후 브라우저가 느려지거나 탭이 충돌하는 형태로 나타난다.

## 메모리 누수 주요 원인

Nexacro N에서 흔히 발생하는 메모리 누수 원인 여섯 가지를 정리했다.

![메모리 누수 주요 발생 원인](/assets/posts/nexacro-n-troubleshoot-memory-leak-sources.svg)

## onunload 정리 패턴

모든 정리 로직은 `Form_onunload`에 모아둔다. 화면이 닫힐 때 반드시 실행되므로, 여기에 해제 코드를 두면 누수를 확실히 막을 수 있다.

![onunload 정리 패턴](/assets/posts/nexacro-n-troubleshoot-memory-leak-fix.svg)

## 원인 1: 이벤트 핸들러 미해제

```javascript
// onload에서 동적으로 등록한 핸들러
function Form_onload(obj, e) {
    btn00.addEventHandler("onclick", fn_btnClick, this);
}

// onunload에서 반드시 해제
function Form_onunload(obj, e) {
    btn00.removeEventHandler("onclick", fn_btnClick, this);
}
```

`addEventHandler`로 등록한 모든 핸들러는 `removeEventHandler`로 해제해야 한다. Studio에서 이벤트 속성(Properties)에 직접 연결한 핸들러는 폼과 함께 자동으로 해제되므로 별도 처리가 불필요하다.

## 원인 2: 타이머 미해제

```javascript
var g_timerRunning = false;

function fn_startPolling() {
    if (g_timerRunning) return;
    timer00.set_interval(5000);
    timer00.start();
    g_timerRunning = true;
}

// onunload에서 반드시 중지
function Form_onunload(obj, e) {
    if (g_timerRunning) {
        timer00.stop();
        g_timerRunning = false;
    }
}
```

## 원인 3: Dataset 무한 누적

조회마다 새로운 행을 추가(addRow)하고 이전 데이터를 지우지 않으면 Dataset이 계속 커진다.

```javascript
function fn_search() {
    // 잘못된 예 — 이전 데이터가 쌓임
    // (clearData 없이 transaction 호출)

    // 올바른 예 — 조회 전 Dataset 초기화
    dsResult.clearData();

    this.transaction("search", url,
        "dsInput=dsSearch", "dsOut=dsResult",
        "", "fn_searchCb");
}
```

특히 Grid에 바인딩된 Dataset은 행이 많아질수록 렌더링 성능도 저하된다.

## 원인 4: 팝업 폼 미해제

```javascript
// 잘못된 예 — 팝업을 닫지 않고 새로 열기
function fn_openPopup() {
    var oPopup = this.open(
        "popup01", "SVC_SearchPopup",
        this, "", "modaless"
    );
    // 이전에 열린 팝업이 닫히지 않은 상태에서 또 open
}

// 올바른 예 — 기존 팝업 닫기 후 열기
function fn_openPopup() {
    if (this.popup01) {
        this.popup01.close();
    }
    var oPopup = this.open(
        "popup01", "SVC_SearchPopup",
        this, "", "modaless"
    );
}
```

## 원인 5: 동적 컴포넌트 미삭제

`addChild`로 생성한 컴포넌트는 `removeChild` 또는 `destroy`로 명시적으로 삭제해야 한다.

```javascript
// 기존 컴포넌트 삭제 후 새로 생성
function fn_rebuildRows() {
    // 기존 컴포넌트 모두 삭제
    while (divContainer.components.length > 0) {
        divContainer.removeChild(0);
    }

    // 새로 생성
    for (var i = 0; i < rowCount; i++) {
        var oDiv = new nexacro.Div("row_" + i, 0, i * 40, 760, 36, this);
        divContainer.addChild(oDiv.id, oDiv);
    }
    divContainer.show();
}
```

## 메모리 사용량 모니터링

브라우저 DevTools의 Memory 탭에서 Heap Snapshot을 찍어 비교하면 누수 여부를 확인할 수 있다.

1. 화면 열기 전 스냅샷 찍기
2. 화면을 열고 조회·닫기 10회 반복
3. 다시 스냅샷 찍기
4. 두 스냅샷의 Heap 크기 차이가 계속 증가한다면 누수 의심

```javascript
// Nexacro 내부 메모리 상태 힌트 (개발 환경)
trace("Application memory hint: " +
    nexacro.getApplication().getProperty("memoryUsage"));
```

## 예방 체크리스트

- [ ] `addEventHandler` 사용 시 `Form_onunload`에 `removeEventHandler` 추가
- [ ] `timer.start()` 사용 시 `Form_onunload`에 `timer.stop()` 추가
- [ ] 트랜잭션 전 `dsResult.clearData()` 호출
- [ ] 팝업 open 전 기존 팝업 close 여부 확인
- [ ] `addChild`로 생성한 컴포넌트를 재생성 전 `removeChild` 호출
- [ ] 전역 배열/객체를 화면 종료 시 초기화

---

**지난 글:** [트러블슈팅: Grid 렌더링 문제](/posts/nexacro-n-troubleshoot-grid-not-render/)

**다음 글:** [트러블슈팅: 타임존 문제](/posts/nexacro-n-troubleshoot-timezone/)

<br>
읽어주셔서 감사합니다. 😊
