---
title: "[Nexacro N] Grid Multi Header — 다중 헤더 구성"
description: "Nexacro N Grid에서 HeadLine과 HeadCell의 colspan/rowspan으로 2단 이상의 계층형 헤더를 구성하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 3
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "grid", "multiheader", "colspan", "rowspan", "HeadLine", "HeadCell"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-grid-styles/)에서 Grid의 스타일 설정 방법을 살펴봤습니다. 이번에는 업무 화면에서 자주 필요한 다중 헤더(Multi Header) 구성을 다룹니다. 관련 컬럼을 그룹으로 묶어 2단 또는 3단 헤더를 표현하면 사용자가 정보 구조를 한눈에 파악할 수 있습니다.

## 다중 헤더의 필요성

인사·회계·재고 시스템처럼 컬럼 수가 많은 그리드에서는 컬럼을 논리적으로 그룹화해 헤더를 2단으로 구성하는 경우가 많습니다.

```
┌──────────────┬───────────────────────┬──────────┐
│   기본정보    │        인사정보        │   급여   │
├──────┬───────┼───────┬───────┬───────┤          │
│ 사번 │  성명 │  부서 │  직급 │입사일 │          │
├──────┼───────┼───────┼───────┼───────┼──────────┤
│ ... │  ... │  ... │  ... │  ... │   ...    │
```

1단 헤더로는 "기본정보", "인사정보"와 같은 상위 분류를 표현하기 어렵습니다. 다중 헤더로 계층 구조를 명확히 할 수 있습니다.

## HeadLine과 HeadCell

Nexacro N Grid의 헤더는 `Head` 밴드 안에 `HeadLine` 요소를 여러 개 선언해 다단 헤더를 구성합니다. 각 `HeadLine`은 하나의 헤더 행이며, 그 안에 `HeadCell` 요소로 셀을 배치합니다.

![Grid 다중 헤더 구조](/assets/posts/nexacro-n-grid-multi-header-layout.svg)

## colspan — 가로 병합

하나의 헤더 셀이 여러 컬럼을 가로 방향으로 병합할 때 `colspan`을 사용합니다.

```xml
<Head>
  <HeadLine height="40">
    <!-- 0~1번 컬럼 병합: "기본정보" -->
    <HeadCell col="0" colspan="2" text="기본정보"
      halign="center"/>
    <!-- 2~4번 컬럼 병합: "인사정보" -->
    <HeadCell col="2" colspan="3" text="인사정보"
      halign="center"/>
    <!-- 5번 컬럼: "급여" rowspan -->
    <HeadCell col="5" rowspan="2" text="급여"
      halign="center"/>
  </HeadLine>
  <HeadLine height="38">
    <!-- 개별 컬럼 헤더 -->
    <HeadCell col="0" text="사번" halign="center"/>
    <HeadCell col="1" text="성명"/>
    <HeadCell col="2" text="부서" halign="center"/>
    <HeadCell col="3" text="직급" halign="center"/>
    <HeadCell col="4" text="입사일" halign="center"/>
    <!-- col="5"는 HeadLine 0에서 rowspan=2로 이미 선언 -->
  </HeadLine>
</Head>
```

`colspan`이 지정된 셀은 `col` 속성에서 시작 컬럼 인덱스를 지정합니다. `col="0" colspan="2"`이면 0번과 1번 컬럼을 병합합니다.

![다중 헤더 XFD 코드](/assets/posts/nexacro-n-grid-multi-header-code.svg)

## rowspan — 세로 병합

헤더 행이 여러 개일 때, 특정 헤더 셀이 두 행에 걸쳐 표시되게 하려면 `rowspan`을 사용합니다.

```xml
<HeadLine height="40">
  <!-- 두 HeadLine 모두에 걸쳐 표시 -->
  <HeadCell col="5" rowspan="2" text="급여"
    halign="center" valign="middle"/>
</HeadLine>
<HeadLine height="38">
  <!-- col="5"는 위에서 rowspan으로 이미 선언했으므로 여기서는 생략 -->
</HeadLine>
```

`rowspan`을 적용한 셀은 두 번째 `HeadLine`에서 동일한 `col`의 `HeadCell`을 선언하지 않아야 합니다. 중복 선언 시 렌더링 충돌이 발생합니다.

## 주의사항: colspan과 rowspan 동시 사용 불가

`colspan`과 `rowspan`을 하나의 `HeadCell`에 동시에 지정할 수 없습니다. 두 방향으로 동시 병합이 필요하다면 레이아웃을 재설계해야 합니다.

```xml
<!-- ❌ 잘못된 예: colspan과 rowspan 동시 사용 불가 -->
<HeadCell col="0" colspan="2" rowspan="2" text="제목"/>

<!-- ✅ 올바른 예: 방향 중 하나만 사용 -->
<HeadCell col="0" colspan="2" text="제목"/>
```

## 3단 헤더

`HeadLine`을 3개 선언하면 3단 헤더도 구성할 수 있습니다.

```xml
<Head>
  <HeadLine height="36">
    <HeadCell col="0" colspan="5" text="2024년 상반기 현황"/>
  </HeadLine>
  <HeadLine height="36">
    <HeadCell col="0" colspan="2" text="개인"/>
    <HeadCell col="2" colspan="3" text="팀"/>
  </HeadLine>
  <HeadLine height="36">
    <HeadCell col="0" text="사번"/>
    <HeadCell col="1" text="성명"/>
    <HeadCell col="2" text="부서"/>
    <HeadCell col="3" text="목표"/>
    <HeadCell col="4" text="실적"/>
  </HeadLine>
</Head>
```

단계가 많아질수록 `HeadLine` 수가 증가하고 XFD가 복잡해지므로, 실무에서는 2단 헤더가 일반적입니다.

## 헤더 정렬과 스타일

각 `HeadCell`에 `halign`(수평 정렬)과 `valign`(수직 정렬)을 지정할 수 있습니다. `rowspan`으로 세로 병합된 셀은 `valign="middle"`을 설정해야 텍스트가 중앙에 표시됩니다.

```xml
<HeadCell col="5" rowspan="2" text="급여"
  halign="center" valign="middle"/>
```

## 스크립트에서 HeadCell 텍스트 동적 변경

다국어 지원 등의 목적으로 런타임에 헤더 텍스트를 변경할 수 있습니다.

```javascript
function fn_setHeaderLang(lang) {
  var txt = (lang == "en") ? "Salary" : "급여";
  // headcell 텍스트 동적 변경
  this.grd_emp.setCellProperty(
    "head", 0, 5, "text", txt
  );
}
```

`setCellProperty("head", lineIdx, col, "text", value)`로 특정 헤더 행과 컬럼의 텍스트를 변경합니다.

## 정리

다중 헤더는 `HeadLine`을 여러 개 선언하고, 각 `HeadCell`의 `col`·`colspan`·`rowspan`으로 병합 위치를 지정해 구성합니다. `colspan`은 가로 병합, `rowspan`은 세로 병합이며 두 속성을 동시에 사용할 수 없습니다. 복잡한 헤더 구조가 필요할 때는 설계 단계에서 병합 구조를 먼저 도식화한 뒤 XFD로 옮기는 것이 효율적입니다.

---

**지난 글:** [Nexacro N Grid Styles — 그리드 스타일 완전 가이드](/posts/nexacro-n-grid-styles/)

**다음 글:** [Nexacro N Grid Cell Merge — 셀 병합 처리](/posts/nexacro-n-grid-cell-merge/)

<br>
읽어주셔서 감사합니다. 😊
