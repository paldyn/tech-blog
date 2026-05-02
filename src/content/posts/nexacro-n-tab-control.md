---
title: "[Nexacro N] TabControl — 탭 컨테이너 완전 정복"
description: "Nexacro N TabControl 컴포넌트의 구조, tabindex 전환, ontabchanged 이벤트, 지연 로딩 패턴, 탭 활성화 제어, Form 연결 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 5
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "tabcontrol", "탭", "tabindex", "ontabchanged", "지연로딩"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-button/)에서 버튼 컴포넌트를 살펴봤습니다. 이번에는 여러 패널을 탭으로 구분하는 `TabControl`을 다룹니다. 업무 시스템의 상세 화면에서 "기본 정보 / 상세 내역 / 첨부 파일" 처럼 콘텐츠를 분할 표시할 때 필수적으로 사용됩니다.

## TabControl 구조

`TabControl`은 탭 헤더와 탭 패널로 구성됩니다. 각 탭은 `Tab` 객체이며, 패널 영역에 별도 Form 파일을 연결하거나 직접 컴포넌트를 배치할 수 있습니다.

```
TabControl (tab_main)
  ├── Tab[0] — "기본 정보"  → form: frm_basicInfo.xfdl
  ├── Tab[1] — "상세 내역"  → form: frm_detail.xfdl
  ├── Tab[2] — "첨부 파일"  → (인라인 배치)
  └── Tab[3] — "이력 조회"  → form: frm_history.xfdl
```

![TabControl 구조](/assets/posts/nexacro-n-tab-control-structure.svg)

## 기본 XML 구성

```xml
<TabControl id="tab_main"
  left="10" top="10" width="800" height="500"
  tabindex="0"
  tabplace="top">
  <Tab text="기본 정보"/>
  <Tab text="상세 내역"/>
  <Tab text="첨부 파일"/>
  <Tab text="이력 조회"/>
</TabControl>
```

`tabplace`는 탭 헤더 위치를 지정합니다. `top`(기본), `bottom`, `left`, `right` 중 선택할 수 있습니다.

## tabindex — 현재 탭 제어

`tabindex` 속성이 현재 선택된 탭의 인덱스(0-based)입니다. 스크립트에서 `set_tabindex()`로 탭을 전환합니다.

```javascript
// 두 번째 탭으로 이동 (인덱스 1)
this.tab_main.set_tabindex(1);

// 현재 탭 인덱스 읽기
var cur = this.tab_main.tabindex;
```

## ontabchanged 이벤트

탭이 전환될 때 `ontabchanged`가 발생합니다. `e.preindex`는 이전 탭, `e.postindex`는 새 탭의 인덱스입니다.

```javascript
function tab_main_ontabchanged(obj, e) {
  var newIdx = e.postindex;
  if (newIdx == 1) {
    // 상세 탭으로 진입 시 데이터 로드
    this.fn_loadDetail();
  }
}
```

![TabControl 탭 전환 코드](/assets/posts/nexacro-n-tab-control-code.svg)

## 지연 로딩 패턴

탭이 여러 개이고 각 탭마다 서버 조회가 있다면, 화면 진입 시 모든 탭을 한번에 로딩하는 것은 비효율적입니다. 탭이 처음 선택될 때 로딩하는 지연 로딩 패턴을 사용합니다.

```javascript
var _tabLoaded = [false, false, false, false];

function tab_main_ontabchanged(obj, e) {
  var idx = e.postindex;
  if (!_tabLoaded[idx]) {
    _tabLoaded[idx] = true;
    switch (idx) {
      case 0: this.fn_loadBasic();   break;
      case 1: this.fn_loadDetail();  break;
      case 2: this.fn_loadFile();    break;
      case 3: this.fn_loadHistory(); break;
    }
  }
}
```

`_tabLoaded` 배열로 각 탭의 로딩 여부를 추적합니다. 이미 로딩된 탭은 재조회 없이 캐시된 Dataset을 그대로 보여줍니다.

## 탭 활성화 제어

권한이나 상태에 따라 특정 탭을 비활성화하거나 숨깁니다.

```javascript
function fn_setTabAuth(hasAttach) {
  // 첨부 파일 탭 활성화 여부
  this.tab_main.Tab[2].set_enable(hasAttach);
}
```

`Tab[idx].set_enable(false)`로 탭 헤더를 비활성화하면 클릭이 차단됩니다. `set_visible(false)`는 탭 헤더를 완전히 숨깁니다.

## 탭에 Form 파일 연결

탭 패널에 독립된 Form 파일을 연결하면 복잡한 화면을 분리 관리할 수 있습니다. Studio에서 각 Tab의 `form` 속성에 파일 경로를 지정합니다.

```xml
<Tab text="기본 정보" form="Forms/frm_basicInfo.xfdl"/>
<Tab text="상세 내역" form="Forms/frm_detail.xfdl"/>
```

연결된 Form은 해당 탭이 처음 활성화될 때 로드됩니다. 부모 Form에서 자식 Form에 접근할 때는 `tab_main.Tab[0].form` 형태로 참조합니다.

## 탭 헤더 텍스트 동적 변경

조회 결과 건수를 탭 헤더에 표시하는 패턴이 실무에서 자주 쓰입니다.

```javascript
function fn_updateTabCount(count) {
  this.tab_main.Tab[1].set_text("상세 내역 (" + count + "건)");
}
```

## 정리

`TabControl`은 화면을 논리적으로 분할하는 핵심 컨테이너입니다. `ontabchanged` 이벤트와 지연 로딩 패턴을 함께 사용하면 초기 로딩 속도를 크게 개선할 수 있습니다. 탭에 Form 파일을 연결해 복잡도를 분산시키면 유지보수도 훨씬 수월해집니다.

---

**지난 글:** [Nexacro N Button — 버튼 컴포넌트 완전 정복](/posts/nexacro-n-button/)

**다음 글:** [Nexacro N Tree — 트리 컴포넌트 완전 정복](/posts/nexacro-n-tree/)

<br>
읽어주셔서 감사합니다. 😊
