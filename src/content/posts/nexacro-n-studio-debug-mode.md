---
title: "[Nexacro N] Studio 디버그 모드 활용"
description: "Nexacro Studio의 내장 디버거를 활용하는 방법을 설명합니다. 브레이크포인트 설정, 단계 실행, 변수 감시 창, 조건부 브레이크포인트, 즉시 실행 창 사용법을 실무 기준으로 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 8
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "디버거", "브레이크포인트", "Studio", "디버깅", "개발도구"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-network-trace/)에서 네트워크 트레이스로 Transaction 문제를 진단하는 방법을 살펴보았다. 네트워크 레벨에서 데이터가 올바르게 오고 갔는데도 화면이 기대처럼 동작하지 않는다면, 이번에는 스크립트 로직을 한 줄씩 추적해야 한다. Nexacro Studio는 IDE 수준의 디버거를 내장하고 있다. `trace()`로 값을 찍는 방식보다 훨씬 강력하다.

## Studio 디버거 기본 구조

Nexacro Studio의 디버거는 다음 구성 요소로 이루어진다.

- **브레이크포인트**: 실행을 멈출 코드 라인 지정
- **단계 실행 도구**: F10(Step Over), F11(Step Into), Shift+F11(Step Out), F5(계속)
- **변수 감시 창(Watch Window)**: 원하는 변수나 표현식의 현재 값 표시
- **호출 스택(Call Stack)**: 현재까지의 함수 호출 체인
- **즉시 실행 창(Immediate Window)**: 정지 상태에서 임의 코드 실행

![Studio 디버그 모드 워크플로우](/assets/posts/nexacro-n-studio-debug-mode-workflow.svg)

## 브레이크포인트 설정

Studio의 스크립트 편집기에서 코드 라인 번호 왼쪽을 클릭하면 빨간 원(브레이크포인트)이 표시된다. F9를 누르면 현재 커서 위치에 브레이크포인트를 토글한다.

디버그 모드로 실행(F5 또는 Debug > Start Debugging)하면 브라우저가 열리고, 브레이크포인트에 도달했을 때 Studio로 포커스가 돌아와 실행이 일시 정지된다.

## 단계 실행

- **F10 (Step Over)**: 현재 라인을 실행하고 다음 라인으로 이동. 함수 호출이 있어도 함수 내부로 들어가지 않는다
- **F11 (Step Into)**: 현재 라인의 함수 내부로 진입
- **Shift+F11 (Step Out)**: 현재 함수를 빠져나와 호출한 위치로 복귀
- **F5 (Continue)**: 다음 브레이크포인트까지 계속 실행
- **F9 (Toggle Breakpoint)**: 현재 라인의 브레이크포인트 토글

복잡한 로직을 추적할 때는 의심 구간 시작점에 브레이크포인트를 걸고 F10으로 한 줄씩 진행하면서 변수 값이 예상과 다른 시점을 찾는다.

## 변수 감시 창 활용

Watch Window에 변수명이나 표현식을 입력하면 실행이 멈출 때마다 현재 값을 보여준다.

![디버거 활용 실전 — 변수 감시 패턴](/assets/posts/nexacro-n-studio-debug-mode-code.svg)

```javascript
// Watch Window에 입력할 표현식 예시
this.dsList.rowcount                           // Dataset 행 수
this.dsList.getColumn(0, "USER_ID")            // 특정 셀 값
this.dsList.rowposition                        // 현재 커서 행
this.edtKeyword.value                          // 컴포넌트 값
i                                              // 루프 변수
sStatus == 1                                   // 조건 표현식 (true/false)
```

복잡한 Dataset 내용을 확인하고 싶을 때는 Watch에서 `getColumn`을 직접 호출해 원하는 컬럼 값을 조회할 수 있다. 이것이 `trace()` 대비 강점이다 — 멈춰있는 상태에서 어떤 값이든 즉시 조회할 수 있다.

## 조건부 브레이크포인트

1,000건 루프에서 300번째 행에서만 오류가 발생한다면 일반 브레이크포인트로는 300번을 F5로 지나쳐야 한다. 조건부 브레이크포인트를 사용하면 특정 조건이 충족될 때만 정지한다.

1. 브레이크포인트 위에서 오른쪽 클릭
2. "Edit Breakpoint" 또는 "Condition" 메뉴 선택
3. 조건식 입력: `i == 300` 또는 `sStatus != 1 && sStatus != 2`

```javascript
// 이 루프에서 i == 300일 때만 정지하고 싶다면
for (var i = 0; i < 1000; i++) {
    var sStatus = this.dsList.getRowType(i);
    // ← 조건부 브레이크포인트: 조건 = (i == 300)
    if (sStatus == 1) {
        fnInsert(i);
    }
}
```

## 즉시 실행 창 (Immediate Window)

Debug > Windows > Immediate를 열면 정지 상태에서 임의의 코드를 실행할 수 있다. 변수에 새 값을 할당하거나, 함수를 직접 호출해 흐름을 바꿀 수 있다.

```javascript
// Immediate Window에 직접 입력
? this.dsList.rowcount              // 값 조회 (? 접두사)
? this.dsList.getColumn(0, "AMT")   // Dataset 컬럼 조회
this.dsList.setColumn(0, "AMT", 999) // 값 강제 변경
this.fnSearch()                      // 함수 직접 호출
```

이 기능을 사용하면 코드를 수정하지 않고도 다양한 시나리오를 테스트할 수 있다.

## 호출 스택으로 이벤트 흐름 추적

Call Stack 창에서는 현재 실행 위치까지 어떤 함수들이 호출됐는지 체인을 볼 수 있다. 이벤트 핸들러가 연쇄적으로 호출될 때 흐름을 파악하는데 유용하다.

```
fnSave          ← 현재 위치
btnSave_onclick ← 버튼 클릭 핸들러
[browser event] ← 브라우저 이벤트
```

스택 프레임을 클릭하면 해당 함수의 실행 위치로 이동하고, 그 시점의 변수 값을 Watch에서 확인할 수 있다.

## 자주 쓰는 디버깅 시나리오

**시나리오 1: Transaction 콜백에서 Dataset이 비어있는 이유 확인**

```javascript
function cbSearch(sId, nErrorCode, sErrorMsg) {
    // ← 브레이크포인트 설정
    // Watch: nErrorCode, sErrorMsg, this.dsList.rowcount
    if (nErrorCode != 0) { ... }
    // 이 시점에서 dsList.rowcount가 0이라면
    // → Response XML의 Dataset 내용을 DevTools에서 확인
}
```

**시나리오 2: 루프에서 조건 분기 오류**

```javascript
for (var i = 0; i < this.dsList.rowcount; i++) {
    var val = this.dsList.getColumn(i, "STATUS");
    // ← 조건부 브레이크포인트: val == "ERR"
    if (val === "ERR") {
        fnHandleError(i); // 이 분기가 올바르게 실행되는가?
    }
}
```

**시나리오 3: 폼 변수가 초기화되지 않은 이유**

```javascript
function form_onload(obj, e) {
    // ← 브레이크포인트
    // Watch: this.nTimerId, this.aCachedData
    // 이 시점에서 초기값이 올바른지 확인
}
```

## Studio 없이 Chrome DevTools 디버거 활용

Nexacro N을 브라우저에서 직접 실행 중이라면 Chrome DevTools의 Sources 탭에서도 디버거를 사용할 수 있다. 스크립트 파일을 찾아 브레이크포인트를 설정하면 Studio와 동일한 단계 실행이 가능하다.

1. F12로 DevTools 열기
2. Sources 탭 선택
3. 파일 트리에서 xfdl 파일의 스크립트를 찾기 (검색: Ctrl+P)
4. 코드 라인 번호 클릭으로 브레이크포인트 설정

## 정리

Studio 디버거는 `trace()`보다 강력한 도구다. 브레이크포인트로 실행을 멈추고, F10/F11로 한 줄씩 추적하며, Watch Window에서 어떤 값이든 즉시 확인할 수 있다. 조건부 브레이크포인트는 대용량 루프에서 특정 조건의 행만 정지시켜 준다. 즉시 실행 창에서 코드를 직접 실행해 시나리오를 변경할 수도 있다. 이 도구들을 익히면 디버깅 시간이 크게 줄어든다.

---

**지난 글:** [\[Nexacro N\] 네트워크 트레이스 분석](/posts/nexacro-n-network-trace/)

**다음 글:** [\[Nexacro N\] 런타임 오류 디버깅 전략](/posts/nexacro-n-runtime-debug/)

<br>
읽어주셔서 감사합니다. 😊
