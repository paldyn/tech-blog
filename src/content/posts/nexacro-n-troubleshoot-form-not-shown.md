---
title: "[Nexacro N] 트러블슈팅: 폼이 표시되지 않을 때"
description: "Nexacro N에서 폼이 화면에 나타나지 않는 문제를 진단하고 해결하는 방법을 설명합니다. 경로 오류, visibility 속성, onload 에러, 컨테이너 크기 문제 등 5가지 주요 원인을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 5
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "트러블슈팅", "폼", "visibility", "onload", "경로오류", "디버깅"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-code-conventions/)에서 코드 컨벤션을 정립하는 방법을 살펴보았다. 이번부터는 실무에서 자주 마주치는 문제와 해결법을 다루는 **트러블슈팅 시리즈**를 시작한다. 첫 번째 주제는 Nexacro N 개발 초반에 가장 당혹스러운 증상 중 하나인 **"폼이 화면에 나타나지 않는 문제"** 다.

개발자가 `application.open` 또는 `Frame.show`를 호출했는데 화면이 아무것도 보이지 않거나, 다른 화면 뒤에 가려진 것처럼 보일 때가 있다. 이 증상의 원인은 대부분 다섯 가지 중 하나다.

## 진단 순서

증상이 발생하면 다음 순서로 확인한다.

![폼 미표시 진단 흐름](/assets/posts/nexacro-n-troubleshoot-form-not-shown-checklist.svg)

출력 창(Nexacro Studio의 Output 탭 또는 브라우저 콘솔)에 에러 메시지가 있다면 그것이 가장 빠른 힌트다. 아무 에러 없이 폼만 빈 경우에는 나머지 단계를 순서대로 점검한다.

## 원인 1: 잘못된 TypeDefinition 경로

`application.xprj`에 등록된 폼 경로가 실제 파일 위치와 다를 때 발생한다.

![폼 미표시 주요 원인 5가지](/assets/posts/nexacro-n-troubleshoot-form-not-shown-causes.svg)

```xml
<!-- application.xprj — 잘못된 경로 예 -->
<Form id="SVC_UserList"
  src="services/user/userList.xfdl"/>

<!-- 실제 파일 위치: services/User/UserList.xfdl
     대소문자 불일치 → 일부 OS에서 폼 로드 실패 -->
```

**해결**: TypeDefinition Editor 또는 xprj 파일에서 경로를 실제 파일 위치와 정확히 일치시킨다. 특히 Windows에서 개발하고 Linux 서버에 배포할 때 대소문자 차이로 이 문제가 자주 발생한다.

## 원인 2: visible 속성 false

폼 자체 또는 폼을 담고 있는 컨테이너(Div, Frame)의 `visible` 속성이 `false`인 경우다.

```javascript
// 조건부 표시 로직에서 실수
function fn_showDetail() {
    // 의도: 상세 폼을 표시
    // 실수: isDetail이 false일 때 오히려 숨김
    divDetail.set_visible(isDetail);
    // isDetail이 초기화되지 않았다면 undefined → false
}

// 수정
function fn_showDetail() {
    divDetail.set_visible(true); // 명시적으로 true 설정
}
```

디버깅: 폼 또는 컨테이너를 Studio에서 선택 후 속성 창(Properties)에서 `visible` 값을 확인한다.

## 원인 3: onload 스크립트 에러로 렌더 중단

`Form_onload` 내에서 예외가 발생하면 그 이후 코드가 실행되지 않는다. 컴포넌트 초기화가 완료되지 않아 화면이 빈 상태로 남는다.

```javascript
// 문제가 되는 onload
function Form_onload(obj, e) {
    var data = JSON.parse(undefined); // ← 예외 발생!
    // 이후 코드는 실행되지 않음 → 컴포넌트 초기화 없음
    fn_init();
}

// 수정: try-catch로 감싸고 에러를 명확히 처리
function Form_onload(obj, e) {
    try {
        fn_init();
    } catch(e) {
        gfn_logError("Form_onload 오류: " + e.message);
        gfn_alert("화면 초기화 중 오류가 발생했습니다.");
    }
}
```

## 원인 4: z-order 문제 (다른 컴포넌트에 가려짐)

폼이 렌더링되었지만 같은 위치에 다른 컴포넌트가 위에 배치되어 시각적으로 보이지 않는 경우다.

**확인 방법**:
1. Studio에서 해당 폼/컴포넌트 선택
2. 우클릭 → "Bring to Front" 또는 "Z-Order" 메뉴 확인
3. 부모 Div의 자식 컴포넌트 목록에서 순서 확인

```javascript
// 코드로 z-order 변경
divTarget.bringToFront();
// 또는
divTarget.sendToBack();
```

## 원인 5: 부모 컨테이너 크기 0

부모 Div의 `width` 또는 `height`가 0이면 자식 컴포넌트도 화면에 나타나지 않는다. 레이아웃을 동적으로 설정하는 코드에서 초기화 순서 문제로 발생한다.

```javascript
// 문제: 크기 설정 전에 폼이 렌더링됨
function Form_onload(obj, e) {
    fn_showContent();
    divContent.set_width(700); // ← 너무 늦음, 렌더 이미 끝남
}

// 수정: 크기를 먼저 설정하거나 Studio에서 고정값 지정
function Form_onload(obj, e) {
    divContent.set_width(700);  // 크기 먼저
    divContent.set_height(400);
    fn_showContent();           // 이후 내용 표시
}
```

## 빠른 진단 명령어

```javascript
// 콘솔에서 폼의 visible, 크기, 위치 일괄 확인
function fn_debugForm(formObj) {
    trace("=== 폼 디버그 ===");
    trace("name:    " + formObj.name);
    trace("visible: " + formObj.visible);
    trace("width:   " + formObj.width);
    trace("height:  " + formObj.height);
    trace("left:    " + formObj.left);
    trace("top:     " + formObj.top);
    trace("z-order: " + formObj.zorder);
    trace("parent:  " + (formObj.parent ? formObj.parent.name : "none"));
}
```

이 함수를 `Form_onload` 시작 부분에 호출하면 초기 상태를 빠르게 파악할 수 있다.

---

**지난 글:** [코드 컨벤션](/posts/nexacro-n-code-conventions/)

**다음 글:** [트러블슈팅: 이중 트랜잭션](/posts/nexacro-n-troubleshoot-double-transaction/)

<br>
읽어주셔서 감사합니다. 😊
