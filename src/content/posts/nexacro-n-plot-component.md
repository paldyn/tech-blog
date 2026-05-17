---
title: "[Nexacro N] Plot 컴포넌트"
description: "Nexacro N의 내장 Plot 컴포넌트를 사용해 막대·꺾은선·파이·영역 차트를 구현하는 방법을 설명합니다. 데이터셋 바인딩, 시리즈 설정, 차트 타입 동적 전환, 이벤트 처리까지 실무 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 2
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "Plot", "차트", "bar", "line", "pie", "데이터시각화"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-excel-image/)에서 엑셀 파일에 이미지를 삽입하는 방법을 살펴보았다. 이번에는 Nexacro N이 기본으로 제공하는 Plot 컴포넌트를 사용해 화면 안에서 바로 데이터를 시각화하는 방법을 다룬다. 외부 라이브러리 없이도 막대, 꺾은선, 파이, 영역 차트를 구현할 수 있어 간단한 통계 대시보드를 빠르게 만들 때 유용하다.

## Plot 컴포넌트 개요

Plot은 Nexacro N 내장 차트 컴포넌트다. Dataset에 직접 바인딩되므로 트랜잭션으로 데이터를 받아오면 별도 코드 없이 차트가 자동으로 갱신된다. 주요 구성 요소는 제목 영역, 범례, 차트 플롯 영역, X/Y 축이다.

![Plot 컴포넌트 구성 요소](/assets/posts/nexacro-n-plot-component-structure.svg)

Studio에서 도구 상자의 Plot을 폼에 드래그해 배치하면 속성 창에서 `charttype`, `bindingdataset`, `xcol`, `series` 등을 설정할 수 있다.

## 데이터셋 바인딩

Plot은 Dataset 컬럼을 X축과 Y축(시리즈)에 매핑한다. Dataset 구조를 먼저 정의한 뒤 Plot 속성을 설정한다.

```nexacro
// Dataset 구조 예시
// Columns: MONTH, SALES_A, SALES_B, SALES_C
// 데이터: 1월~12월 월별 판매량

Plot00.bindingdataset = "ds_sales";
Plot00.xcol = "MONTH";           // X축 카테고리 컬럼
Plot00.series = "SALES_A,SALES_B,SALES_C";  // Y값 컬럼 (콤마 구분)
Plot00.charttype = "bar";
```

`series` 속성에는 Y값으로 사용할 컬럼명을 콤마로 구분해 나열한다. 각 컬럼이 하나의 시리즈(색상이 다른 막대 또는 선)가 된다.

## 차트 타입

Plot이 지원하는 주요 차트 타입은 막대(`bar`), 꺾은선(`line`), 파이(`pie`), 영역(`area`)이다.

![주요 차트 타입 비교](/assets/posts/nexacro-n-plot-component-types.svg)

차트 타입은 런타임에서도 변경할 수 있다. 버튼을 눌러 막대와 꺾은선을 전환하는 UI가 자주 쓰인다.

```nexacro
function btn_bar_onclick(obj, e) {
    Plot00.charttype = "bar";
    Plot00.redraw();
}

function btn_line_onclick(obj, e) {
    Plot00.charttype = "line";
    Plot00.redraw();
}
```

`charttype`을 변경한 뒤 `redraw()`를 호출해야 화면이 갱신된다. 데이터셋이 변경될 때는 자동으로 다시 그려지지만, 속성만 바꿀 때는 명시적 호출이 필요하다.

## 시리즈 색상 및 라벨 설정

시리즈별 색상은 `seriescolor` 속성으로 지정한다. 색상을 지정하지 않으면 기본 팔레트가 적용된다.

```nexacro
// 시리즈 색상 지정 (콤마 구분, HTML 색상코드)
Plot00.seriescolor = "#55c555,#7ec8e3,#7777cc";

// 범례 표시 여부 및 위치
Plot00.legendvisible = true;
Plot00.legendposition = "right";   // left / right / top / bottom

// 데이터 라벨 표시
Plot00.datalabelvisible = true;
Plot00.datalabelformat = "#,##0";  // 천 단위 구분 포맷
```

## 파이 차트 설정

파이 차트는 `xcol`이 범주 이름이 되고 `series`에 값 컬럼을 하나만 지정한다.

```nexacro
// Dataset: CATEGORY, AMOUNT
Plot00.charttype = "pie";
Plot00.xcol = "CATEGORY";
Plot00.series = "AMOUNT";
Plot00.datalabelformat = "0.0%";   // 비율 형식으로 표시
Plot00.doughnut = false;           // true로 하면 도넛 차트
```

## 클릭 이벤트 처리

차트 항목을 클릭했을 때 해당 데이터의 상세를 조회하는 패턴이 많이 쓰인다.

```nexacro
function Plot00_onclick(obj, e) {
    // e.datarow: 클릭한 데이터 행 인덱스
    // e.series: 클릭한 시리즈명
    var rowIdx = e.datarow;
    var category = ds_sales.getColumn(rowIdx, "MONTH");
    var seriesName = e.series;

    // 상세 조회
    fn_searchDetail(category, seriesName);
}
```

`onclick` 이벤트의 `e.datarow`로 Dataset 행 인덱스를 얻을 수 있다. 해당 인덱스로 Dataset에서 다른 컬럼 값을 읽어 상세 조회 로직을 실행하면 된다.

## 축 설정

Y축의 최솟값과 최댓값을 고정하거나, X축 라벨을 회전할 수 있다.

```nexacro
// Y축 범위 고정
Plot00.yaxismin = 0;
Plot00.yaxismax = 10000;

// Y축 눈금 단위
Plot00.yaxisstep = 2000;

// X축 라벨 회전 (긴 텍스트가 겹칠 때)
Plot00.xaxisrotate = 45;  // 도 단위
```

## 주의사항

Plot 컴포넌트는 복잡한 차트(다중 Y축, 혼합형 차트 등)를 지원하지 않는다. 이런 경우에는 외부 라이브러리 연동을 검토해야 한다. 또한 데이터가 많을수록 렌더링 시간이 늘어나므로, 수천 건 이상의 데이터를 시각화할 때는 서버에서 집계 후 전달하는 방식을 권장한다.

---

**지난 글:** [엑셀 이미지 삽입](/posts/nexacro-n-excel-image/)

**다음 글:** [외부 차트 연동](/posts/nexacro-n-external-chart/)

<br>
읽어주셔서 감사합니다. 😊
