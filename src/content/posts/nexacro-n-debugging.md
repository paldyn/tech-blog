---
title: "[Nexacro N] 디버깅 완전 가이드 — Studio부터 런타임까지"
description: "Nexacro N Studio의 중단점·Watch·Call Stack, 런타임 trace() 활용, 네트워크 트레이스 뷰어까지 실무에서 바로 쓰는 디버깅 기법을 단계별로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 1
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "debugging", "trace", "breakpoint", "watch", "network-trace", "studio"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-error-handling-script/)에서 스크립트 오류 처리 패턴을 살펴봤습니다. 오류를 감지하고 잡아내는 것만큼 중요한 것이 오류의 **원인을 파악하는 능력**, 즉 디버깅입니다. Nexacro N은 Studio 내 디버거부터 런타임 trace(), 네트워크 트레이스까지 여러 계층의 디버깅 도구를 제공합니다. 어떤 상황에 어떤 도구를 써야 하는지 파악해두면 문제 해결 속도가 크게 달라집니다.

## 디버깅 도구 체계

Nexacro N의 디버깅은 세 계층으로 나뉩니다: **Studio 디버그 모드**, **런타임 코드 기반 디버깅**, **네트워크·서버 레벨 확인**.

![Nexacro N 디버깅 도구 체계](/assets/posts/nexacro-n-debugging-tools.svg)

문제를 좁혀가는 순서는 Studio → 런타임 → 네트워크입니다. Studio에서 재현이 안 되면 런타임 trace()로, 서버 데이터가 의심되면 네트워크 트레이스로 넘어갑니다.

## Studio 디버그 모드 사용법

Studio에서 디버그 모드는 메뉴 **실행 > 디버그 시작(F5)** 으로 진입합니다. 일반 실행과 달리 중단점·Watch 패널이 활성화됩니다.

### 중단점 (Breakpoint)

스크립트 편집기에서 줄 번호 왼쪽을 클릭하거나 `F9`로 중단점을 설정합니다. 실행이 해당 줄에 도달하면 일시 중지됩니다.

| 단축키 | 동작 |
|--------|------|
| F9 | 현재 줄 중단점 토글 |
| F10 | 한 줄씩 실행 (Step Over) |
| F11 | 함수 내부로 진입 (Step Into) |
| Shift+F11 | 함수에서 빠져나옴 (Step Out) |
| F5 | 다음 중단점까지 계속 실행 |

### Watch 패널

중단점에서 멈춘 상태에서 **Watch** 탭에 변수나 표현식을 추가하면 실시간으로 값을 확인할 수 있습니다. `this.dsMain.rowcount`, `this.edtName.value` 같은 표현식을 직접 입력해서 현재 상태를 점검합니다.

### Call Stack 패널

현재 실행 중인 함수가 어떤 경로로 호출됐는지 스택 형태로 보여줍니다. 이벤트 → 공통 함수 → 내부 함수 순서로 호출이 중첩될 때 어디서 문제가 발생했는지 추적하는 데 유용합니다.

### Immediate (즉시 실행) 창

중단점에서 멈춘 상태에서 **즉시 실행** 창에 스크립트를 입력하면 현재 컨텍스트에서 바로 실행됩니다. `this.dsMain.getColumn(0, "NAME")` 같은 표현식으로 Dataset 값을 빠르게 확인할 수 있습니다.

## 런타임 trace() 디버깅

Studio 디버거 없이도 `trace()` 함수로 Output 창에 값을 출력할 수 있습니다. 운영 환경에서는 trace() 출력이 억제되므로 개발 중에만 사용되는 안전한 방법입니다.

![trace() 활용 패턴과 디버그 흐름](/assets/posts/nexacro-n-debugging-trace.svg)

### 기본 패턴

```javascript
function fn_searchCb(svcId, errCode, errMsg) {
    trace("[DEBUG] svcId=" + svcId + " err=" + errCode);

    if (errCode !== 0) {
        trace("[ERROR] " + errMsg);
        return;
    }

    trace("[DEBUG] rowCount=" + this.dsMain.rowcount);

    if (this.dsMain.rowcount > 0) {
        trace("[DEBUG] firstCode=" + this.dsMain.getColumn(0, "CODE"));
    }
}
```

`[DEBUG]` 접두어를 붙여두면 배포 전 일괄 검색으로 제거하기 쉽습니다.

### Dataset 전체 덤프

Dataset에 데이터가 제대로 들어왔는지 확인할 때 행 수와 대표 컬럼 값을 출력합니다.

```javascript
function debugDataset(ds) {
    trace("=== " + ds.name + " dump ===");
    trace("rowcount: " + ds.rowcount);
    for (var i = 0; i < Math.min(ds.rowcount, 5); i++) {
        trace("row[" + i + "] CODE=" + ds.getColumn(i, "CODE")
            + " NAME=" + ds.getColumn(i, "NAME"));
    }
}
```

최대 5행만 출력하도록 제한해두면 대량 데이터에서 Output 창이 넘치지 않습니다.

### 컴포넌트 상태 확인

```javascript
function debugComp(comp) {
    trace(comp.name
        + " visible=" + comp.visible
        + " enable=" + comp.enable
        + " value=" + comp.value);
}
```

화면에 보이지 않는 컴포넌트, 클릭이 안 되는 버튼의 원인을 빠르게 찾을 수 있습니다.

## Form 생명주기 디버깅

Form이 의도한 순서대로 동작하지 않을 때는 각 이벤트 진입 시 trace()를 추가합니다.

```javascript
function Form_oncreate(obj, e) {
    trace("[LIFECYCLE] oncreate");
}

function Form_onload(obj, e) {
    trace("[LIFECYCLE] onload — 초기 검색 시작");
    fn_search();
}

function Form_onclose(obj, e) {
    trace("[LIFECYCLE] onclose");
}
```

`[LIFECYCLE]` 접두어로 묶으면 Output 창에서 생명주기 흐름만 필터링해서 볼 수 있습니다.

## 네트워크 트레이스

서버와의 통신 데이터를 확인해야 할 때는 **NX 트레이스 뷰어**를 사용합니다. Studio 메뉴 **도구 > 트레이스 뷰어**에서 열 수 있습니다.

트레이스 뷰어에서 확인할 수 있는 것:
- 클라이언트가 서버로 보낸 Dataset 원문 (PL 포맷)
- 서버가 응답한 Dataset 원문
- 요청·응답 헤더 정보
- 처리 시간 (밀리초 단위)

트레이스 뷰어 없이 빠르게 확인하려면 브라우저 개발자 도구 **Network 탭**에서 해당 URL의 요청·응답 본문을 확인해도 됩니다. PL 포맷은 일반 텍스트이므로 브라우저에서도 읽을 수 있습니다.

## 브라우저 개발자 도구 활용

Nexacro N이 HTML5 런타임에서 동작할 때는 크롬 개발자 도구(F12)를 함께 활용할 수 있습니다.

```javascript
// Console 탭에서 직접 접근 가능
// Nexacro Application 객체 참조
var app = nexacro.getApplication();
var mainForm = app.getActiveFrame().getCurrentForm();
trace(mainForm.dsMain.rowcount);
```

**Console 탭**: JavaScript 오류, `console.log()` 출력 확인  
**Network 탭**: HTTP 요청/응답, 상태 코드(401·500 등) 확인  
**Elements 탭**: DOM 구조 (Nexacro가 생성한 HTML 확인)

## 디버깅 체크리스트

실무에서 자주 마주치는 문제와 확인 포인트입니다.

| 증상 | 확인 포인트 |
|------|-------------|
| 화면이 열리지 않음 | Form_oncreate/onload trace(), 브라우저 Console 오류 |
| 데이터가 보이지 않음 | 트랜잭션 콜백 errCode, dsMain.rowcount |
| 버튼이 눌리지 않음 | enable 속성, visible 속성 |
| 저장 후 반영 안 됨 | 저장 콜백 errCode, fn_search 재호출 여부 |
| 팝업이 열리지 않음 | 팝업 URL 경로, 브라우저 팝업 차단 설정 |

---

**지난 글:** [스크립트 오류 처리 패턴](/posts/nexacro-n-error-handling-script/)

**다음 글:** [트랜잭션(Transaction) 개요](/posts/nexacro-n-transaction/)

<br>
읽어주셔서 감사합니다. 😊
