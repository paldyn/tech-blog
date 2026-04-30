---
title: "[Nexacro N] Container vs Form — 컴포넌트 배치의 두 가지 방식"
description: "Nexacro N에서 UI를 구성하는 두 축인 Container 계열(Div, Spread, Tab)과 Form 계열의 차이를 비교하고, 각각의 적합한 사용 시나리오를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 7
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "Div", "Container", "Form", "Spread", "TabPanel", "패널전환", "레이아웃"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-layout-and-style/)에서 Nexacro N의 절대 좌표 배치 모델과 스타일 속성을 살펴봤습니다. 화면을 구성할 때 개발자는 두 가지 선택지를 자주 마주합니다. 복잡한 영역을 별도 Form으로 분리할지, 아니면 같은 Form 안에서 `Div` 같은 Container 컴포넌트로 묶을지입니다. 이 선택이 화면의 유지보수성과 성능에 영향을 주기 때문에 두 방식의 특성을 명확히 이해하는 것이 중요합니다.

## Container 계열 컴포넌트

Container는 자식 컴포넌트를 담는 그릇 역할을 하면서 부모 Form의 스크립트 스코프를 **공유**합니다. 대표 컴포넌트는 다음과 같습니다.

### Div

가장 범용적인 Container입니다. 임의의 컴포넌트를 그루핑하고, `visible`로 표시·숨김을 토글하거나, `scrollbars` 속성으로 독자 스크롤을 추가할 수 있습니다.

```xml
<!-- 검색 조건 영역을 Div로 그루핑 -->
<Div id="divSearch"
     left="0" top="40"
     width="1720" height="60"
     style="background:#1a1a2a;">
  <Objects>
    <Edit id="edtKeyword"
          left="10" top="14"
          width="200" height="32" />
    <Button id="btnSearch"
            left="220" top="14"
            width="80" height="32"
            text="조회" />
  </Objects>
</Div>
```

Div 내부 컴포넌트에는 `this.divSearch.edtKeyword`로 접근합니다. 단, 같은 Form 스코프이므로 `this.edtKeyword`로도 접근 가능합니다.

### Spread

반복 데이터를 타일 형태로 렌더링하는 Container입니다. Dataset과 바인딩해서 카드 목록, 미리보기 패널 등을 만드는 데 씁니다. Grid가 행·열로 표현한다면 Spread는 자유로운 카드 형태로 표현합니다.

```xml
<Spread id="sprProduct"
        left="0" top="100"
        width="1720" height="800"
        binddataset="dsProduct"
        scrollbars="autoboth">
  <!-- 한 타일의 템플릿 정의 -->
  <TileObjects>
    <Static id="stcNm"  bindcolumn="prodNm" />
    <Static id="stcPrice" bindcolumn="price" />
  </TileObjects>
</Spread>
```

### Tab / TabPanel

탭 인터페이스를 구현하는 Container입니다. 탭을 클릭하면 해당 `TabPanel`이 활성화됩니다.

```xml
<Tab id="tabMain"
     left="0" top="40"
     width="1720" height="980">
  <TabPanel id="tp1" text="기본 정보">
    <Objects>
      <!-- tp1 전용 컴포넌트 -->
    </Objects>
  </TabPanel>
  <TabPanel id="tp2" text="상세 정보">
    <Objects>
      <!-- tp2 전용 컴포넌트 -->
    </Objects>
  </TabPanel>
</Tab>
```

![Container vs Form — 배치 방식 비교](/assets/posts/nexacro-n-container-vs-form-compare.svg)

## Form 계열과의 차이

Container 계열은 부모 Form과 **스크립트 스코프를 공유**합니다. 즉, `divSearch` 안에 있는 `edtKeyword`도 부모 Form의 `this.edtKeyword`로 직접 참조할 수 있습니다.

반면 Form 계열(일반 Form, PopupForm, Include Form)은 **독립 스코프**를 갖습니다. Include Form 안의 컴포넌트는 `this.incSearch.form.edtKeyword`처럼 명시적 경로가 필요합니다.

| 항목 | Container (Div 등) | Form 계열 |
|------|-------------------|-----------|
| 스크립트 스코프 | 부모 공유 | 독립 |
| 생명주기 이벤트 | 없음 | onload·onunload 등 |
| 파일 분리 | 불가 (같은 xfdl) | 별도 xfdl |
| 독립 Dataset | 없음 (부모 공유) | 가능 |
| 재사용 | 같은 Form 내에서만 | 다른 Form에서도 Include 가능 |

## Div로 패널 전환하기

탭을 별도 컴포넌트 없이 Div의 visible 토글로 구현하는 패턴은 실무에서 자주 쓰입니다. 단순한 '기본 검색 / 상세 검색' 전환 같은 경우에 적합합니다.

```javascript
// 기본 검색 ↔ 상세 검색 전환
function fn_toggleSearchMode() {
    var isAdv = this.divAdvSearch.visible;
    this.divBasicSearch.set_visible(isAdv);
    this.divAdvSearch.set_visible(!isAdv);

    // 전환 버튼 텍스트도 변경
    this.btnToggle.set_text(isAdv ? "상세 검색" : "기본 검색");
}
```

이 패턴의 장점은 두 패널 모두 같은 Form 스코프에 있어서 서로의 값을 자유롭게 읽고 쓸 수 있다는 것입니다.

![Div를 활용한 패널 전환 패턴](/assets/posts/nexacro-n-container-vs-form-div.svg)

## 언제 Form으로 분리할까

다음 기준 중 하나라도 해당하면 Div 대신 별도 Form(Include 또는 독립 화면)으로 분리하는 것이 낫습니다.

1. **재사용 필요**: 동일한 UI 영역을 여러 화면에서 사용해야 할 때 → Include Form
2. **독립 생명주기 필요**: 영역이 로드·언로드되면서 독자적으로 데이터를 관리해야 할 때 → Include Form 또는 ChildFrame
3. **복잡도 기준**: 컴포넌트가 20개 이상이거나 스크립트 함수가 10개 이상이면 별도 xfdl로 분리하는 것이 가독성 면에서 유리합니다.
4. **독립 팝업**: 사용자가 선택하고 결과를 부모 Form에 돌려주는 검색/조회 UI → PopupForm

## 실전 레이아웃 패턴

실제 업무 시스템에서 흔히 쓰이는 구조 예시입니다.

```
MainFrame.xfdl
├── divHeader (고정 헤더 Div)
├── divNav    (사이드 내비게이션 Div)
└── cfContent (ChildFrame)
    └── OrderList.xfdl (업무 Form)
        ├── divBtnBar   (버튼 바 Div)
        ├── tabSearch   (Tab 검색 영역)
        │   ├── tp1 (기본 검색)
        │   └── tp2 (상세 검색)
        └── grdOrder    (Grid)
```

이 구조에서 `divBtnBar`와 `tabSearch`는 Form 내 Container이고, `OrderList.xfdl` 자체는 ChildFrame에 로드되는 Form입니다. Container는 Form 내부의 레이아웃 구조화에, Form은 화면 단위 분리에 쓰이는 역할 분담이 명확합니다.

---

**지난 글:** [레이아웃과 스타일 기초 — Nexacro N의 화면 배치 원리](/posts/nexacro-n-layout-and-style/)

**다음 글:** [Anchor·Margin·Padding — 컴포넌트 위치와 여백 완전 정복](/posts/nexacro-n-anchor-margin-padding/)

<br>
읽어주셔서 감사합니다. 😊
