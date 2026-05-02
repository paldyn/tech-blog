---
title: "[Nexacro N] Plot — 차트 컴포넌트 완전 정복"
description: "Nexacro N Plot 컴포넌트의 Bar·Line·Pie 차트 타입, chartInfo 속성 구성, Dataset 바인딩, 런타임 차트 타입 전환, 다중 시리즈 구성 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 3
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "plot", "차트", "bar", "line", "pie", "chartInfo", "바인딩"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-progressbar/)에서 ProgressBar로 진행 상태를 표현하는 방법을 살펴봤습니다. 이번에는 데이터를 시각화하는 `Plot` 컴포넌트를 다룹니다. 매출 추이, 비율 분석, 순위 비교 등 업무 대시보드에서 빠질 수 없는 컴포넌트입니다.

## Plot 컴포넌트 개요

`Plot`은 Nexacro N에 내장된 차트 컴포넌트입니다. 외부 라이브러리 없이 Dataset과 연결만 하면 Bar, Line, Pie, Area, Scatter 등의 차트를 그릴 수 있습니다. `chartInfo` 속성으로 차트 타입과 옵션을 제어하며, Dataset이 업데이트되면 차트도 자동으로 갱신됩니다.

![Plot 차트 타입 개요](/assets/posts/nexacro-n-plot-charts-types.svg)

## 기본 구성

Studio에서 `Plot` 컴포넌트를 폼에 배치하면 `bindingInfo`와 `chartInfo`를 설정해야 합니다.

```xml
<Plot id="plt_sales"
  left="20" top="20" width="600" height="300"
  bindingInfo="ds_sales"
  chartInfo="charttype:bar;labelcol:month;datacolumn:amount;"/>
```

- `bindingInfo`: 연결할 Dataset의 ID
- `chartInfo`: 차트 옵션을 세미콜론으로 연결한 문자열
- `labelcol`: x축(레이블)으로 사용할 컬럼명
- `datacolumn`: y축(값)으로 사용할 컬럼명

`ds_sales`에 `month`, `amount` 컬럼이 있다면 이 설정만으로 막대 차트가 렌더링됩니다.

## chartInfo 주요 속성

| 속성 | 설명 | 예시 |
|---|---|---|
| `charttype` | 차트 종류 | `bar`, `line`, `pie`, `area` |
| `labelcol` | x축 레이블 컬럼 | `month` |
| `datacolumn` | y축 데이터 컬럼 | `amount` |
| `xtitle` | x축 제목 | `월` |
| `ytitle` | y축 제목 | `금액` |
| `legendvisible` | 범례 표시 여부 | `true` |
| `gridline` | 격자선 표시 | `true` |
| `animation` | 렌더링 애니메이션 | `true` |

## Dataset 바인딩과 런타임 갱신

```javascript
// 트랜잭션 완료 후 차트 자동 갱신
function fn_salesCallback(sId, nEC, sEM) {
  if (nEC == 0) {
    // ds_sales에 데이터가 채워지면 plt_sales 자동 갱신
    // 별도 refresh() 불필요
  }
}
```

Dataset에 `bindingInfo`가 연결된 경우 Dataset 데이터가 바뀌면 차트가 자동으로 다시 그려집니다. 별도로 `refresh()`를 호출할 필요가 없습니다.

![Plot Dataset 바인딩 코드](/assets/posts/nexacro-n-plot-charts-binding.svg)

## 런타임 차트 타입 전환

사용자가 버튼으로 Bar/Line/Pie를 전환하는 패턴이 실무에서 자주 쓰입니다.

```javascript
function fn_changeChartType(type) {
  var ci = this.plt_sales.chartInfo;
  ci.set("charttype", type);
  this.plt_sales.set_chartInfo(ci);
}

// 라디오 버튼 이벤트
function rdo_chartType_onitemchanged(obj, e) {
  fn_changeChartType(e.postvalue);  // "bar" or "line" or "pie"
}
```

`chartInfo` 객체의 `set()` 메서드로 속성을 변경한 뒤 `set_chartInfo()`를 호출하면 즉시 반영됩니다.

## 다중 시리즈 구성

여러 데이터 계열을 한 차트에 표현할 때는 `datacolumn`을 여러 컬럼으로 지정합니다.

```xml
<Plot id="plt_compare"
  bindingInfo="ds_quarterly"
  chartInfo="charttype:bar;labelcol:quarter;
             datacolumn:q1_amt,q2_amt,q3_amt,q4_amt;
             legendvisible:true;"/>
```

`datacolumn`에 쉼표로 컬럼명을 나열하면 각 컬럼이 하나의 시리즈가 됩니다. 색상은 Nexacro가 자동으로 할당합니다.

## 색상 커스터마이징

기본 색상이 마음에 들지 않으면 `colorInfo` 속성으로 직접 지정합니다.

```javascript
this.plt_sales.set_colorInfo(
  "#7ec8e3;#55c555;#e05555;#e0a030;#7777cc"
);
```

세미콜론으로 구분된 색상 코드가 각 시리즈에 순서대로 적용됩니다.

## Pie 차트 — 레이블 표시

Pie 차트에서는 각 조각에 값이나 퍼센트를 표시할 수 있습니다.

```xml
<Plot id="plt_share"
  bindingInfo="ds_share"
  chartInfo="charttype:pie;labelcol:region;datacolumn:share;
             showlabel:true;labeltype:percent;"/>
```

`showlabel:true`에 `labeltype:percent`를 더하면 "32.5%" 형식으로 조각마다 표시됩니다. `labeltype:value`로 바꾸면 실제 수치가 출력됩니다.

## 차트 이벤트

사용자가 차트 요소를 클릭했을 때 세부 정보를 보여주는 드릴다운 패턴에는 `onclick` 이벤트를 사용합니다.

```javascript
function plt_sales_onclick(obj, e) {
  var idx = e.dataindex;   // 클릭된 데이터 인덱스
  var col = e.datacolumn;  // 클릭된 컬럼명
  // 해당 인덱스의 Dataset 행으로 이동
  this.ds_sales.set_rowposition(idx);
  // 상세 팝업 열기
  this.fn_openDetail();
}
```

`e.dataindex`가 Dataset의 행 인덱스와 일치하므로 `set_rowposition()`으로 연계 처리가 간단합니다.

## 정리

`Plot`은 Dataset과 `chartInfo`의 조합으로 다양한 차트를 구성할 수 있습니다. Dataset이 갱신되면 차트도 자동으로 반영되므로 추가 코드 없이 실시간 갱신이 가능합니다. 런타임 타입 전환과 다중 시리즈를 활용하면 인터랙티브한 분석 화면을 빠르게 만들 수 있습니다.

---

**지난 글:** [Nexacro N ProgressBar — 진행 상태 시각화 컴포넌트](/posts/nexacro-n-progressbar/)

**다음 글:** [Nexacro N Button — 버튼 컴포넌트 완전 정복](/posts/nexacro-n-button/)

<br>
읽어주셔서 감사합니다. 😊
