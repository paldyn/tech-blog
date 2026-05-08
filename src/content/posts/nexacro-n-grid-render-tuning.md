---
title: "[Nexacro N] Grid 렌더링 최적화"
description: "Nexacro N Grid에서 oncellstyle 미리 계산 맵, suppressredraw 일괄 갱신, 컬럼 최소화, 이벤트 핸들러 경량화 등 렌더링 성능을 높이는 실전 기법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 8
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "grid", "성능최적화", "oncellstyle", "suppressredraw", "렌더링"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-grid-virtualization/)에서 virtualrowcount로 DOM 수를 줄이는 가상화 기술을 다뤘습니다. 가상화와 함께 렌더링 자체를 최적화하면 더 큰 효과를 얻을 수 있습니다. 이번 글에서는 Grid 렌더링 성능을 높이는 다양한 기법을 속성·이벤트·스타일 세 가지 축으로 정리합니다.

## 렌더링 병목의 원인

Grid 렌더링이 느린 이유는 크게 세 가지입니다.

1. **과도한 DOM**: 비가상화 상태에서 수천 행의 셀 DOM
2. **빈번한 재렌더링**: 루프에서 셀 속성을 변경할 때마다 Grid가 다시 그림
3. **무거운 이벤트 핸들러**: 스크롤마다 호출되는 `oncellstyle`에서 복잡한 계산

![Grid 렌더링 최적화 체크리스트](/assets/posts/nexacro-n-grid-render-tuning-checklist.svg)

## oncellstyle 최적화 — 미리 계산 맵

`oncellstyle`은 화면에 셀이 그려질 때마다 호출됩니다. 가상화 환경에서는 스크롤할 때도 호출되므로 이 핸들러가 무거우면 스크롤이 끊깁니다.

핵심 원칙: **`oncellstyle`에서는 계산하지 않는다. 미리 계산된 결과만 조회한다.**

![oncellstyle 최적화 코드](/assets/posts/nexacro-n-grid-render-tuning-code.svg)

```javascript
// 데이터 로드 완료 콜백에서 1회 스타일 맵 구성
function fn_searchCb(svcId, errCode, errMsg) {
    fn_buildStyleMap();
}

var g_rowStyles = {};
function fn_buildStyleMap() {
    g_rowStyles = {};
    for (var r = 0; r < ds.rowcount; r++) {
        var nAmt   = parseInt(ds.getColumn(r, "AMT") || "0");
        var sState = ds.getColumn(r, "STATE");
        if (sState == "ERR") {
            g_rowStyles[r] = "#ff444433";
        } else if (nAmt < 0) {
            g_rowStyles[r] = "#ffaa0022";
        }
    }
}

// oncellstyle: O(1) 맵 조회만
function grd_oncellstyle(obj, e) {
    var sBg = g_rowStyles[e.row];
    if (sBg) {
        e.backgroundColor = sBg;
    }
}
```

Dataset 데이터가 바뀔 때마다 `fn_buildStyleMap()`을 다시 호출합니다.

## suppressredraw — 일괄 갱신

루프에서 셀 스타일이나 값을 변경하면 매번 Grid가 부분 재렌더링됩니다. `suppressredraw`로 일시 정지하고 한 번에 그립니다.

```javascript
function fn_markErrorRows(aErrRows) {
    grd.set_suppressredraw(true);

    for (var i = 0; i < aErrRows.length; i++) {
        var nRow = aErrRows[i];
        grd.setCellBackgroundColor(nRow, -1, "rgba(224,85,85,0.2)");
    }

    grd.set_suppressredraw(false);
    grd.redraw(); // 한 번에 렌더링
}
```

`-1`을 컬럼 인덱스로 넘기면 행 전체에 색이 적용됩니다.

## 컬럼 최소화

렌더링 대상 컬럼이 많을수록 그리는 시간이 길어집니다.

```javascript
// 사용자가 열 숨기기를 선택했을 때
function fn_toggleColumn(sColId, bVisible) {
    var oCol = grd.getColumnById(sColId);
    if (oCol) {
        oCol.set_visible(bVisible);
    }
}
```

화면에 표시할 필요가 없는 키 컬럼이나 내부 상태 컬럼은 `visible="false"`로 숨기면 렌더링 부하가 줄어듭니다.

## 헤더·바디 포맷셀 최소화

Grid Format Editor에서 헤더와 바디에 많은 포맷셀이 겹쳐 있으면 각 셀마다 레이어 계산이 누적됩니다.

- 빈 포맷셀(내용 없는 투명 div)을 제거합니다.
- 사용하지 않는 서브 레이어(head2, body2 등)를 삭제합니다.
- 이미지가 있는 셀은 `useimagecache="true"`로 캐싱합니다.

## 고정 컬럼(leftcolcount) 최소화

고정 컬럼은 스크롤 시 별도 DOM 레이어를 유지하므로 렌더링 비용이 추가됩니다. 필수적인 키 컬럼 1~2개만 고정하고 나머지는 해제합니다.

```javascript
grd.set_leftcolcount(1); // 첫 번째 컬럼만 고정
```

## 이미지 셀 최적화

Grid 셀에 이미지를 표시하는 경우 `useimagecache="true"`를 설정하면 동일한 이미지 URL을 캐싱해 재사용합니다.

```xml
<Grid id="grd" useimagecache="true" ... />
```

아이콘 이미지는 PNG 개별 파일보다 SVG 인라인이 렌더링에 유리합니다. 작은 상태 아이콘(체크·경고·오류 표시)은 유니코드 이모지나 단색 Unicode Symbol로 대체하면 이미지 요청 자체를 없앨 수 있습니다.

## 스크롤 이벤트 debounce

`onscroll` 이벤트는 스크롤 중 매우 빈번하게 발생합니다. 이 이벤트에서 무거운 처리를 하면 스크롤이 버벅입니다.

```javascript
var g_scrollTimer = null;

function grd_onscroll(obj, e) {
    if (g_scrollTimer) clearTimeout(g_scrollTimer);
    g_scrollTimer = setTimeout(function() {
        fn_onScrollEnd();
    }, 150);
}

function fn_onScrollEnd() {
    // 스크롤이 멈춘 뒤 150ms 후 1번만 실행
    fn_updateVisibleRowInfo();
}
```

`setTimeout`을 이용한 debounce 패턴으로 연속 호출을 한 번으로 줄입니다.

## 렌더링 성능 측정

최적화 전후를 비교하려면 브라우저 개발자 도구의 Performance 탭을 활용합니다. Grid 렌더링 중 Layout, Paint, Composite 단계에서 시간이 얼마나 소요되는지 확인합니다.

Nexacro N의 `tracemode`도 활용할 수 있습니다.

```javascript
nexacro.traceMode = true; // 성능 로그 활성화
```

콘솔에 컴포넌트별 렌더링 시간이 출력되어 병목 지점을 파악할 수 있습니다.

## 실전 최적화 순서

1. **virtualrowcount 설정** (가장 효과 큼)
2. **oncellstyle 핸들러 미리 계산 맵으로 교체**
3. **suppressredraw + redraw() 패턴 적용**
4. **불필요한 컬럼 visible=false**
5. **포맷셀 정리 (Format Editor에서 빈 셀 제거)**
6. **고정 컬럼 최소화**
7. **이미지 캐싱 활성화**

이 순서대로 적용하면 대부분의 성능 문제가 해결됩니다.

---

**지난 글:** [Grid 가상화(Virtual Scrolling)](/posts/nexacro-n-grid-virtualization/)

**다음 글:** [Grid 트러블슈팅](/posts/nexacro-n-grid-troubleshooting/)

<br>
읽어주셔서 감사합니다. 😊
