---
title: "[Nexacro N] 트러블슈팅: 이중 트랜잭션"
description: "Nexacro N에서 버튼 더블클릭이나 이벤트 중복 호출로 트랜잭션이 두 번 실행되는 문제를 진단하고 방지하는 방법을 설명합니다. 락 플래그 패턴, 버튼 비활성화 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 6
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "트러블슈팅", "이중트랜잭션", "더블클릭", "락플래그", "데이터정합성", "동시성"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-troubleshoot-form-not-shown/)에서 폼 미표시 문제를 다루었다. 이번에는 데이터 정합성에 직결되는 **이중 트랜잭션 문제**를 살펴본다. 사용자가 저장 버튼을 빠르게 두 번 클릭하거나, 네트워크가 느려 응답이 늦을 때 같은 트랜잭션이 두 번 실행되는 현상이다.

## 문제 발생 구조

이중 트랜잭션은 아주 간단한 이유로 발생한다. 첫 번째 클릭에서 트랜잭션을 호출하고 응답을 기다리는 동안, 두 번째 클릭이 들어오면 또 트랜잭션이 호출된다.

![이중 트랜잭션 발생 타임라인](/assets/posts/nexacro-n-troubleshoot-double-transaction-flow.svg)

결과적으로 서버에 같은 요청이 두 번 전달되고, 데이터가 두 번 저장되거나 삭제될 수 있다. 또는 콜백 함수가 두 번 실행되어 예상치 못한 화면 동작이 발생한다.

## 방지 패턴 1: 락 플래그

가장 범용적인 방법이다. 트랜잭션 시작 시 플래그를 `true`로 설정하고, 콜백에서 `false`로 해제한다.

![이중 트랜잭션 방지 패턴](/assets/posts/nexacro-n-troubleshoot-double-transaction-fix.svg)

```javascript
var g_isProcessing = false;

function fn_save() {
    if (g_isProcessing) {
        gfn_logWarn("저장 중 중복 호출 차단. 무시.");
        return;
    }
    g_isProcessing = true;

    this.transaction(
        "save",
        "/api/user/save",
        "dsInput=dsUser",
        "",
        "",
        "fn_saveCb"
    );
}

function fn_saveCb(svcId, errCode, errMsg) {
    g_isProcessing = false; // 반드시 콜백에서 해제

    if (errCode != 0) {
        gfn_alert(errMsg);
        return;
    }
    gfn_alert("저장이 완료되었습니다.");
}
```

**주의**: `fn_saveCb`의 에러 케이스에서도 반드시 `g_isProcessing = false`를 실행해야 한다. 에러 시 해제를 빠뜨리면 그 이후 저장이 영구적으로 막힌다.

## 방지 패턴 2: 버튼 비활성화

트랜잭션 진행 중 버튼 자체를 비활성화해서 추가 클릭을 막는 방법이다. 사용자가 버튼 상태를 시각적으로 확인할 수 있어 UX에도 좋다.

```javascript
function fn_save() {
    btn_save.set_enable(false); // 버튼 비활성화

    this.transaction(
        "save", "/api/user/save",
        "dsInput=dsUser", "", "", "fn_saveCb"
    );
}

function fn_saveCb(svcId, errCode, errMsg) {
    btn_save.set_enable(true); // 콜백에서 재활성화

    if (errCode != 0) {
        gfn_alert(errMsg);
        return;
    }
    gfn_alert("저장이 완료되었습니다.");
}
```

## 두 패턴의 조합 사용

락 플래그와 버튼 비활성화를 함께 쓰면 더 안전하다.

```javascript
function fn_setProcessingState(bProcessing) {
    g_isProcessing = bProcessing;
    btn_save.set_enable(!bProcessing);
    btn_delete.set_enable(!bProcessing);

    // 로딩 인디케이터 토글 (선택)
    div_loading.set_visible(bProcessing);
}

function fn_save() {
    if (g_isProcessing) return;
    fn_setProcessingState(true);

    this.transaction("save", url,
        "dsInput=dsUser", "", "", "fn_saveCb");
}

function fn_saveCb(svcId, errCode, errMsg) {
    fn_setProcessingState(false);
    if (errCode != 0) { gfn_alert(errMsg); return; }
    gfn_alert("저장 완료");
}
```

## 공통 함수로 래핑

프로젝트 전체에서 동일한 패턴을 강제하려면 트랜잭션 래퍼를 공통 함수로 만든다.

```javascript
// gfn_common.xjs
function gfn_transaction(svcId, url, inParam, outParam, args, cbFunc) {
    if (g_isProcessing) {
        gfn_logWarn("트랜잭션 중복 차단: " + svcId);
        return;
    }
    g_isProcessing = true;

    // 콜백을 래핑해서 자동으로 플래그 해제
    var wrappedCb = svcId + "_wrapped";
    this[wrappedCb] = function(sid, ec, em) {
        g_isProcessing = false;
        if (cbFunc) this[cbFunc](sid, ec, em);
    };

    this.transaction(svcId, url, inParam, outParam, args, wrappedCb);
}
```

## 이중 트랜잭션 탐지

기존 코드에서 이중 트랜잭션이 발생하는지 확인하려면 로그를 추가한다.

```javascript
function fn_save() {
    gfn_logDebug("fn_save 호출 시각: " + gfn_getSysDateTime());
    // ...
}
```

같은 시각에 콜이 두 번 찍힌다면 이중 호출이 발생 중인 것이다.

---

**지난 글:** [트러블슈팅: 폼 미표시](/posts/nexacro-n-troubleshoot-form-not-shown/)

**다음 글:** [트러블슈팅: 빈 Dataset](/posts/nexacro-n-troubleshoot-empty-dataset/)

<br>
읽어주셔서 감사합니다. 😊
