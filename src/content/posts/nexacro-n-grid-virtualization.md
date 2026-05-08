---
title: "[Nexacro N] Grid 가상화(Virtual Scrolling)"
description: "Nexacro N Grid의 virtualrowcount 속성으로 수만 행을 DOM 50개만으로 렌더링하는 가상 스크롤 기술을 설명하고, rowheight 고정 필수 조건과 셀 병합 등 제약사항을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 7
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "grid", "virtualrowcount", "가상화", "virtual-scrolling", "성능"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-grid-large-dataset/)에서 대용량 데이터의 전반적인 처리 전략을 살펴봤습니다. 이번 글에서는 그 중 **Grid 가상화(Virtual Scrolling)** 기술을 집중적으로 다룹니다. `virtualrowcount` 속성 하나로 수만 행 Grid의 렌더링 성능을 극적으로 개선할 수 있습니다.

## 가상화의 핵심 아이디어

일반적으로 Grid는 Dataset의 모든 행에 대해 DOM 요소를 생성합니다. 10,000행이면 10,000개의 행 DOM, 각 행마다 수십 개의 셀 DOM이 생깁니다. 이 많은 DOM을 브라우저가 처리하는 것이 성능 문제의 주원인입니다.

**가상화**는 발상의 전환입니다. 사용자가 실제로 볼 수 있는 행은 화면 크기에 따라 기껏해야 30~50행입니다. 나머지는 스크롤해야만 보입니다. 그렇다면 화면에 보이는 행만 DOM으로 만들고, 스크롤이 발생하면 DOM을 재사용하면서 데이터만 교체하면 됩니다.

![Grid 가상화 원리](/assets/posts/nexacro-n-grid-virtualization-concept.svg)

## virtualrowcount 설정

```xml
<Grid id="grd"
      bindeddataset="dsHuge"
      virtualrowcount="50"
      rowheight="24"
      cellrecycling="true" />
```

| 속성 | 설명 |
|---|---|
| `virtualrowcount` | 실제 DOM으로 그릴 행 수. 화면에 보이는 행 수 + 여유분 |
| `rowheight` | 행 높이(px). 가상화 사용 시 고정 값 필수 |
| `cellrecycling` | 셀 DOM 재사용 활성화. 가상화와 함께 사용 권장 |

`virtualrowcount="50"`이면 Dataset에 10,000행이 있어도 DOM은 50개만 생성됩니다. 스크롤 시 DOM 위치를 이동하고 데이터만 교체합니다.

![virtualrowcount 설정 코드](/assets/posts/nexacro-n-grid-virtualization-code.svg)

## rowheight 고정이 왜 필수인가?

가상화는 행의 위치를 `rowIndex × rowHeight` 수식으로 계산합니다. 행마다 높이가 다르면 스크롤바의 위치와 실제 데이터 위치가 맞지 않아 틀어집니다. 따라서 `autorowheight`(내용에 따라 높이 자동 조정)와 `virtualrowcount`는 **함께 사용할 수 없습니다**.

행 안에 줄바꿈이 있거나 내용 길이가 다른 열이 있다면 가상화 대신 다른 전략을 선택해야 합니다.

## virtualrowcount 값 결정

적절한 값은 **화면에 표시 가능한 최대 행 수 × 1.5~2** 배 정도가 권장됩니다.

```javascript
// Grid 높이에 따른 최적값 계산
var nGridH   = grd.height;       // Grid 컴포넌트 높이
var nRowH    = grd.rowheight;    // 행 높이
var nVisible = Math.ceil(nGridH / nRowH);
var nVirtual = Math.ceil(nVisible * 2);

grd.set_virtualrowcount(nVirtual);
```

너무 작으면 스크롤 시 빈 행이 보이는 깜박임이 생기고, 너무 크면 DOM이 많아져 가상화 효과가 줄어듭니다.

## 스크롤 위치 제어

가상화가 활성화된 Grid에서 특정 행으로 바로 이동하려면 `scrollToRow()`를 사용합니다.

```javascript
// 특정 행으로 스크롤 이동
grd.scrollToRow(4999); // 5,000번째 행(0 인덱스)

// 현재 스크롤 위치 저장
var nScrollPos = grd.vscrollpos;

// 데이터 갱신 후 위치 복원
function fn_refreshCb() {
    grd.set_vscrollpos(nScrollPos);
}
```

`vscrollpos`는 픽셀 단위 스크롤 위치입니다. 행 인덱스로 저장하려면 `currentrowindex`를 별도로 보관합니다.

## 셀 스타일과 가상화

`oncellstyle` 이벤트는 셀이 렌더링될 때마다 발생합니다. 가상화 환경에서는 스크롤 시 DOM이 재사용되므로 이 이벤트가 빈번하게 호출됩니다. 이벤트 핸들러가 복잡하면 스크롤 성능에 영향을 줍니다.

```javascript
// 무거운 계산은 피하고 단순 분기만
function grd_oncellstyle(obj, e) {
    var sStatus = ds.getColumn(e.row, "STATUS");
    // switch보다 배열 조회가 빠름
    var oStyles = {
        "ERR":  { background: "#ff444433", forecolor: "#ff4444" },
        "WARN": { background: "#ffaa0033", forecolor: "#ffaa00" }
    };
    var oStyle = oStyles[sStatus];
    if (oStyle) {
        e.backgroundColor = oStyle.background;
        e.foreColor       = oStyle.forecolor;
    }
}
```

## 제약 사항 정리

가상화를 도입하기 전에 다음 제약을 확인합니다.

| 제약 | 이유 | 대안 |
|---|---|---|
| `autorowheight` 미사용 | 행 높이 가변 불가 | 고정 rowheight 설정 |
| 셀 병합 주의 | 가변 span과 충돌 가능 | 헤더 병합만 허용 |
| `setCellMerge()` 부분 제한 | 스크롤 시 병합 계산 오류 | 정적 병합만 사용 |
| `scrollToRow()` 필요 | 인덱스 직접 계산 안 됨 | API 사용 |

## 실전 적용 체크리스트

```javascript
// 가상화 적용 체크리스트 함수
function fn_enableVirtualization() {
    // 1. rowheight 고정 확인
    if (!grd.rowheight || grd.rowheight <= 0) {
        grd.set_rowheight(24);
    }

    // 2. autorowheight 비활성화
    grd.set_autorowheight(false);

    // 3. virtualrowcount 설정
    var nVirtual = Math.ceil((grd.height / grd.rowheight) * 2);
    grd.set_virtualrowcount(nVirtual);

    // 4. cellrecycling 활성화
    grd.set_cellrecycling(true);
}
```

## 성능 비교 기대치

| 데이터 건수 | 가상화 미사용 초기 렌더링 | 가상화 사용 초기 렌더링 |
|---|---|---|
| 1,000건 | ~100ms | ~80ms |
| 5,000건 | ~500ms | ~90ms |
| 10,000건 | ~1,200ms | ~100ms |
| 50,000건 | 5초+ (체감 불가) | ~150ms |

수치는 환경마다 다르지만, 1만 건 이상에서 가상화 효과는 10배 이상입니다.

---

**지난 글:** [Grid 대용량 데이터 처리](/posts/nexacro-n-grid-large-dataset/)

**다음 글:** [Grid 렌더링 최적화](/posts/nexacro-n-grid-render-tuning/)

<br>
읽어주셔서 감사합니다. 😊
