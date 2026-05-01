---
title: "[Nexacro N] Div 그루핑 — 복잡한 화면을 논리 단위로 묶는 방법"
description: "Nexacro N에서 Div 컴포넌트를 이용해 화면을 논리 단위로 그루핑하는 방법 — visible/enable 일괄 제어, 부모-자식 참조, 동적 이동·크기 변경, 재사용 가능한 그룹 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 1
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "div", "그루핑", "컨테이너", "레이아웃", "visible", "enable", "컴포넌트"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-multi-resolution/)에서 다양한 해상도 환경에서 앱을 최적화하는 방법을 살펴봤습니다. 화면 크기와 픽셀 밀도 문제를 해결했다면, 이제는 화면 안의 컴포넌트들을 어떻게 **논리적으로 조직화**할지 생각해야 합니다. 수십 개의 컴포넌트가 평평하게 나열된 폼은 유지보수가 어렵고, 관련 컴포넌트를 한 번에 보이거나 숨기는 단순한 작업조차 수십 줄의 반복 코드를 요구합니다. Div 그루핑은 이 문제를 해결하는 핵심 기법입니다.

## Div란 무엇인가

Nexacro N의 `Div` 컴포넌트는 다른 컴포넌트를 담을 수 있는 **컨테이너**입니다. HTML의 `<div>` 요소와 개념이 유사하지만, Nexacro N에서는 Div 자체도 컴포넌트 트리의 일원으로서 좌표·크기·이벤트를 갖습니다. Div 안에 배치된 컴포넌트들은 Div를 **부모**로 인식하며, 좌표 체계도 Div 기준으로 적용됩니다.

```xml
<!-- Form.xfdl 에서 Div 선언 예 -->
<Div id="divHeader" left="0" top="0" width="100%" height="60">
  <Objects>
    <Static id="stcTitle" left="10" top="10" width="300" height="40"
            text="화면 제목"/>
    <Button id="btnSearch" left="320" top="10" width="80" height="40"
            text="조회"/>
    <Button id="btnSave"   left="410" top="10" width="80" height="40"
            text="저장"/>
  </Objects>
</Div>
```

IDE(Nexacro Studio)에서는 도구 상자의 `Div`를 캔버스에 드래그하면 자동으로 `<Div>` 태그가 생성됩니다. 이후 컴포넌트를 Div 위에 배치하면 자동으로 자식이 됩니다.

![Div 그루핑 — 화면 논리 단위 분리](/assets/posts/nexacro-n-div-grouping-structure.svg)

## 그루핑의 핵심 이점: 일괄 제어

Div 그루핑의 가장 큰 이점은 **하나의 속성 변경이 자식 전체에 전파**된다는 점입니다. 그루핑하지 않으면 N개의 컴포넌트를 각각 제어해야 하지만, Div로 묶으면 Div 하나만 제어하면 됩니다.

### visible — 그룹 전체 보이기/숨기기

```javascript
// 그루핑 전: 각 컴포넌트 개별 처리
this.edtName.set_visible(false);
this.edtAge.set_visible(false);
this.edtAddress.set_visible(false);
this.btnSearch.set_visible(false);
this.btnSave.set_visible(false);

// 그루핑 후: Div 하나만 제어
this.divContent.set_visible(false);
```

### enable — 그룹 전체 활성/비활성

```javascript
// 조회 결과 없을 때 편집 영역 전체 비활성화
function fn_disableEditArea() {
    this.divContent.set_enable(false);
}

// 조회 완료 후 다시 활성화
function fn_enableEditArea() {
    this.divContent.set_enable(true);
}
```

`set_enable(false)`는 자식 컴포넌트 모두를 비활성화합니다. 사용자는 Div 안의 어떤 컴포넌트도 클릭하거나 입력할 수 없게 됩니다. 데이터가 로드되기 전, 권한이 없는 상태, 읽기 전용 모드 등에서 유용합니다.

## 부모-자식 참조 경로

Div 안의 컴포넌트는 **부모 Div를 경유해서 참조**합니다.

```javascript
// divContent 안의 edtName 참조
var sName = this.divContent.edtName.value;

// 중첩 Div의 경우 체이닝
var sCity = this.divContent.divAddr.edtCity.value;
```

`this`는 현재 폼을 가리킵니다. Div가 여러 층으로 중첩되어도 점(`.`) 표기법으로 계속 탐색할 수 있습니다. 단, 중첩이 너무 깊어지면 코드가 길어지므로 2~3단계 이상의 중첩은 지양합니다.

## 동적 이동과 크기 변경

Div는 위치와 크기를 런타임에 동적으로 조작할 수 있어 유연한 레이아웃 변화가 가능합니다.

```javascript
// Div 위치 이동: move(x, y)
function fn_slideContent(bExpanded) {
    var nY = bExpanded ? 60 : 120;
    this.divContent.move(0, nY);
    // 이동 후 크기도 함께 조정
    var nH = bExpanded ? 500 : 440;
    this.divContent.resize(this.divContent.width, nH);
}
```

`move(x, y)`는 폼(또는 부모 Div) 기준의 절대 좌표로 이동합니다. `resize(w, h)`는 너비와 높이를 변경합니다. 두 함수를 조합하면 조회 조건 영역을 접거나 펼치는 **아코디언 패턴** 구현이 가능합니다.

![Div 그루핑 — 스크립트 패턴](/assets/posts/nexacro-n-div-grouping-code.svg)

## 아코디언 패턴 구현

검색 조건 패널을 접었다 펼치는 UI는 엔터프라이즈 앱에서 자주 사용됩니다.

```javascript
var gbSearchExpanded = true;

function btnToggleSearch_onclick(obj, e) {
    gbSearchExpanded = !gbSearchExpanded;
    fn_toggleSearchPanel(gbSearchExpanded);
}

function fn_toggleSearchPanel(bExpand) {
    this.divSearch.set_visible(bExpand);
    var nGridY = bExpand ? 200 : 60;
    var nGridH = this.height - nGridY - 10;
    this.divGrid.move(0, nGridY);
    this.divGrid.resize(this.divGrid.width, nGridH);
    // 버튼 텍스트 토글
    var sBtnText = bExpand ? "▲ 조건 접기" : "▼ 조건 펼치기";
    this.btnToggleSearch.set_text(sBtnText);
}
```

검색 조건 Div(`divSearch`)를 숨기면 그리드 Div(`divGrid`)를 위로 이동시키고 높이를 늘려 공간을 채웁니다. 이 패턴을 적용하면 그리드가 더 넓게 보여 조회 결과 확인이 편리합니다.

## Div의 opacity와 부드러운 전환

Nexacro N에서 `opacity` 속성으로 0~1 범위의 불투명도를 설정할 수 있습니다. 단, CSS 애니메이션처럼 부드러운 전환(transition)을 기본 제공하지는 않습니다. 단계별로 opacity를 변경하는 타이머를 구현하거나, 단순히 0/1로 즉시 전환하는 방식을 선택합니다.

```javascript
// 즉시 투명화 (overlay 효과)
function fn_showOverlay() {
    this.divOverlay.set_visible(true);
    this.divOverlay.set_opacity(0.5); // 반투명 오버레이
}

function fn_hideOverlay() {
    this.divOverlay.set_visible(false);
}
```

반투명 오버레이는 서버 통신 중 사용자 입력을 막는 로딩 UI로 자주 활용됩니다.

## 이벤트와 Div

Div 자체도 `onclick`, `onmouseover` 같은 이벤트를 가집니다. 그러나 자식 컴포넌트의 이벤트가 Div로 **버블링**되지는 않습니다 — 이는 HTML DOM과의 차이점입니다. 자식 이벤트를 부모 Div에서 중앙 처리하려면 자식 이벤트에서 명시적으로 부모 Div의 함수를 호출해야 합니다.

```javascript
// 자식 컴포넌트 이벤트에서 부모 Div 함수 호출
function edtName_onkeyup(obj, e) {
    // Div에 정의된 공통 핸들러 호출
    this.divContent.fn_onInputChanged(obj, e);
}
```

## Div 내부 컴포넌트 일괄 초기화

저장 후 폼을 초기 상태로 되돌릴 때, 특정 Div 안의 모든 Edit을 한 번에 비우고 싶다면:

```javascript
function fn_clearGroup(oDiv) {
    var nCount = oDiv.components.length;
    for (var i = 0; i < nCount; i++) {
        var oComp = oDiv.components[i];
        if (oComp.type === "Edit" || oComp.type === "Textarea") {
            oComp.set_value("");
        }
    }
}

// 사용 예
function fn_clearForm() {
    fn_clearGroup(this.divContent);
}
```

`oDiv.components`는 Div의 직접 자식 컴포넌트 컬렉션입니다. 이 컬렉션을 순회하면 Div 안의 모든 컴포넌트를 타입에 따라 처리할 수 있습니다.

## Div 그루핑 설계 원칙

Div는 강력하지만 과도하게 중첩하면 참조 경로가 복잡해집니다. 실무에서 검증된 원칙은 다음과 같습니다.

| 원칙 | 설명 |
|------|------|
| **목적 기반 그루핑** | UI 기능 단위(검색, 상세, 그리드)로 Div를 나눈다 |
| **최대 3단계** | Div 중첩은 3단계를 넘지 않도록 한다 |
| **명확한 네이밍** | `divSearch`, `divContent`, `divGrid` 등 역할이 드러나는 이름 |
| **이동/숨김 주체는 Div** | 개별 컴포넌트가 아닌 Div 단위로 visible/enable 제어 |
| **크기 계산은 폼에서** | Div의 크기를 결정하는 로직은 Form 레벨에서 관리 |

Div 그루핑을 체계적으로 적용하면 화면 구조가 명확해지고, 복잡한 UI 변화(조건 영역 접기, 탭 전환, 권한별 UI 숨김)를 짧은 코드로 구현할 수 있습니다.

---

**지난 글:** [다중 해상도 지원 — DPI·해상도별 화면 최적화 전략](/posts/nexacro-n-multi-resolution/)

**다음 글:** [Edit / Textarea — 텍스트 입력 컴포넌트 완전 분석](/posts/nexacro-n-edit-textarea/)

<br>
읽어주셔서 감사합니다. 😊
