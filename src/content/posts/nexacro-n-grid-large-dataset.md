---
title: "[Nexacro N] Grid 대용량 데이터 처리"
description: "Nexacro N Grid에서 수천~수만 건의 데이터를 다룰 때 발생하는 성능 문제의 원인과 조회 제한·페이징·suppressredraw 등 실무 최적화 기법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 6
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "grid", "대용량", "performance", "suppressredraw", "virtualrowcount", "페이징"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-grid-clipboard/)에서 Grid 클립보드 기능을 살펴봤습니다. Grid 개발에서 클립보드 못지않게 자주 마주치는 문제가 바로 **대용량 데이터 처리**입니다. 수만 건 데이터를 한 번에 로드하면 화면이 굳거나 브라우저가 응답하지 않는 경험을 해봤을 것입니다. 이번 글에서는 원인 분석부터 단계별 해결 전략까지 정리합니다.

## 왜 느려지는가?

Nexacro N Grid는 기본적으로 모든 데이터 행에 대한 DOM 요소를 생성합니다. 1만 행이라면 1만 개의 행 DOM이 생성되고, 각 행마다 여러 셀 DOM이 붙습니다. 브라우저는 이 많은 DOM을 레이아웃 계산하고 렌더링하는 데 상당한 시간을 씁니다.

주요 병목 지점:

- **트랜잭션 후 Dataset 바인딩**: 서버에서 받은 XML/JSON을 Dataset에 파싱하는 시간
- **Grid 초기 렌더링**: Dataset 연결 직후 모든 셀 그리기
- **스크롤 중 셀 스타일 계산**: `oncellstyle` 등 이벤트 과부하
- **루프 중 개별 `setColumn()`**: 루프마다 Grid가 재렌더링

![대용량 데이터 처리 전략](/assets/posts/nexacro-n-grid-large-dataset-strategy.svg)

## 전략 1: 서버 측 조회 건수 제한

가장 근본적인 해결책은 서버에서 반환하는 행 수를 제한하는 것입니다. 대부분의 업무에서 한 화면에 1,000건 이상이 필요한 경우는 드뭅니다.

```sql
-- Oracle
SELECT * FROM TB_ORDER
WHERE ORDER_DATE >= :sDate
FETCH FIRST 1000 ROWS ONLY;

-- MS SQL Server
SELECT TOP 1000 * FROM TB_ORDER
WHERE ORDER_DATE >= @sDate;
```

서버 쿼리에 `LIMIT` 또는 `TOP` 조건을 추가하고, 조회 조건이 충분히 좁혀지지 않으면 사용자에게 경고를 표시합니다.

```javascript
function fn_search() {
    if (!edtDate.value) {
        alert("조회 기간을 입력하세요.");
        return;
    }
    transaction("SVC_SEARCH", "ds=dsOut", "sDate=" + edtDate.value,
                "fn_searchCb", "", false);
}

function fn_searchCb(svcId, errCode, errMsg) {
    if (dsOut.rowcount >= 1000) {
        trace("경고: 최대 조회 건수(1,000)에 도달. 조건을 좁혀 주세요.");
    }
}
```

## 전략 2: suppressredraw로 일괄 갱신

루프에서 `setColumn()`, `setCellBackgroundColor()` 등을 반복 호출하면 호출마다 Grid가 부분 재렌더링됩니다. `suppressredraw`로 렌더링을 일시 정지한 뒤 한 번에 그리면 성능이 크게 향상됩니다.

![대용량 Grid 성능 최적화 설정 코드](/assets/posts/nexacro-n-grid-large-dataset-code.svg)

```javascript
function fn_applyRowStyles() {
    grd.set_suppressredraw(true);

    var nRows = ds.rowcount;
    for (var r = 0; r < nRows; r++) {
        var sStatus = ds.getColumn(r, "STATUS");
        if (sStatus == "ERR") {
            grd.setCellBackgroundColor(r, -1, "rgba(224,85,85,0.2)");
        }
    }

    grd.set_suppressredraw(false);
    grd.redraw();
}
```

`setCellBackgroundColor(row, -1, color)` 에서 컬럼 인덱스 `-1`은 행 전체에 색을 적용합니다.

## 전략 3: 데이터 분할 처리 (청크 로드)

Dataset 자체가 수만 건이어야 한다면, 한 번에 로드하지 않고 스크롤에 따라 추가 로드하는 무한 스크롤 패턴을 구현합니다.

```javascript
var g_nPage = 1;
var g_nPageSize = 200;
var g_bLoading = false;

function fn_loadMore() {
    if (g_bLoading) return;
    g_bLoading = true;
    transaction("SVC_LOAD",
        "ds=dsChunk",
        "nPage=" + g_nPage + "&nSize=" + g_nPageSize,
        "fn_loadMoreCb", "", false);
}

function fn_loadMoreCb(svcId, errCode, errMsg) {
    g_bLoading = false;
    if (errCode != 0) return;

    // 새로 받은 데이터를 기존 Dataset에 합치기
    dsMain.appendDataset(dsChunk);
    g_nPage++;
}

// Grid 스크롤이 끝에 닿으면 추가 로드
function grd_onscrollended(obj, e) {
    fn_loadMore();
}
```

`appendDataset()`은 대상 Dataset의 행을 현재 Dataset 뒤에 추가합니다. Dataset 구조(컬럼 정의)가 같아야 합니다.

## 전략 4: Dataset 필터·정렬 활용

전체 데이터를 한 번 로드한 뒤 클라이언트 측 필터와 정렬을 쓰는 방식도 유효합니다. 이 경우 초기 로드가 무겁지만, 이후 사용자 인터랙션에서 서버 요청이 없어 빠릅니다.

```javascript
// 검색어 입력 시 즉시 필터
function edtFilter_onchange(obj, e) {
    var sKeyword = obj.value;
    if (sKeyword) {
        ds.setFilter("NAME like '%" + sKeyword + "%'");
    } else {
        ds.clearFilter();
    }
}
```

`setFilter()`는 서버 재조회 없이 클라이언트 메모리에서 Dataset을 필터링합니다. 데이터 전체가 이미 클라이언트에 있으므로 응답이 즉각적입니다.

## 전략 5: virtualrowcount 가상 스크롤

데이터를 이미 모두 로드한 상태에서 렌더링만 최적화하려면 `virtualrowcount` 속성을 사용합니다. 이 속성은 다음 글(Grid 가상화)에서 자세히 다루므로 여기서는 활성화 방법만 소개합니다.

```javascript
grd.set_virtualrowcount(50); // 화면에 실제 DOM으로 그릴 행 수 제한
```

## Dataset 일괄 작업 최적화

Dataset에서 대량의 행을 추가하거나 수정할 때도 성능을 고려합니다.

```javascript
// 느린 방법: 루프마다 이벤트 발생
for (var i = 0; i < 5000; i++) {
    var nRow = ds.addRow();
    ds.setColumn(nRow, "KEY", i);
    ds.setColumn(nRow, "VAL", "data" + i);
}

// 빠른 방법: XML 문자열 일괄 로드
var sXml = "<Dataset id='ds'>";
sXml += "<ColumnInfo><Column id='KEY' type='STRING'/><Column id='VAL' type='STRING'/></ColumnInfo>";
sXml += "<Rows>";
for (var i = 0; i < 5000; i++) {
    sXml += "<Row><Col id='KEY'>" + i + "</Col><Col id='VAL'>data" + i + "</Col></Row>";
}
sXml += "</Rows></Dataset>";
ds.loadXML(sXml);
```

`loadXML()`은 Dataset을 한 번에 채우므로 중간 이벤트가 발생하지 않아 루프 방식보다 훨씬 빠릅니다.

## 실무 체크리스트

- [ ] 조회 결과가 1,000건을 넘는지 서버에서 체크하고 경고 표시
- [ ] 루프에서 Grid 속성 변경 시 `suppressredraw` 사용
- [ ] `virtualrowcount` 설정으로 DOM 수 제한
- [ ] 초기 로드 후 필터/정렬은 클라이언트 처리
- [ ] Dataset에 대량 삽입 시 `loadXML()` 활용

---

**지난 글:** [Grid 클립보드 복사·붙여넣기](/posts/nexacro-n-grid-clipboard/)

**다음 글:** [Grid 가상화(Virtual Scrolling)](/posts/nexacro-n-grid-virtualization/)

<br>
읽어주셔서 감사합니다. 😊
