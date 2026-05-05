---
title: "[Nexacro N] Grid Paging — 페이징 처리"
description: "Nexacro N Grid의 pageRowCount와 currentPage로 클라이언트 페이징을 구현하는 방법, 서버사이드 페이징 패턴, 페이지 이동 UI 구현을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 9
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "grid", "paging", "pageRowCount", "currentPage", "페이징"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-grid-sort-filter/)에서 정렬과 필터 처리 방법을 살펴봤습니다. 이번에는 대량 데이터를 다룰 때 필수적인 페이징(Paging) 처리를 다룹니다. Nexacro N은 클라이언트 페이징과 서버사이드 페이징 두 가지 방식을 지원합니다.

## 페이징의 두 가지 방식

| 방식 | 원리 | 적합한 데이터 규모 |
|---|---|---|
| 클라이언트 페이징 | 전체 데이터를 한 번에 로드 후 페이지 분할 | 소~중용량 (수백~수천 건) |
| 서버사이드 페이징 | 페이지 요청마다 서버에서 해당 페이지 데이터만 수신 | 대용량 (수만 건 이상) |

![Grid 페이징 처리 구조](/assets/posts/nexacro-n-grid-paging-concept.svg)

## 클라이언트 페이징 — pageRowCount

Grid의 `pagerowcount` 속성에 페이지당 표시할 행 수를 지정하면 클라이언트 페이징이 활성화됩니다.

```xml
<Grid id="grd_emp"
  pagerowcount="20"
  bindDataset="ds_emp">
</Grid>
```

`pagerowcount="20"`을 설정하면 Dataset의 전체 행 중 현재 페이지에 해당하는 20개 행만 Grid에 표시됩니다.

## 관련 속성

| 속성 | 설명 |
|---|---|
| `pagerowcount` | 페이지당 표시 행 수 |
| `currentpage` | 현재 페이지 인덱스 (0-based) |
| `pagecount` | 전체 페이지 수 (read-only) |

```javascript
function fn_initPaging() {
  // Grid의 총 페이지 수 확인
  var totalPage = this.grd_emp.pagecount;
  // 현재 페이지 확인
  var curPage = this.grd_emp.currentpage;
  trace("현재: " + (curPage + 1) + "페이지 / 전체: " + totalPage + "페이지");
}
```

## 페이지 이동 함수

![클라이언트 페이징 구현 코드](/assets/posts/nexacro-n-grid-paging-code.svg)

페이지 이동은 `grd.currentpage` 값을 변경하는 방식으로 구현합니다.

```javascript
function fn_movePage(pageIdx) {
  var totalPage = this.grd_emp.pagecount;
  if (pageIdx < 0 || pageIdx >= totalPage) return;

  // Grid 페이지 변경
  this.grd_emp.currentpage = pageIdx;
  // Dataset 현재 행을 해당 페이지 첫 번째 행으로 이동
  this.ds_emp.rowposition =
    pageIdx * this.grd_emp.pagerowcount;

  // 페이지 표시 레이블 갱신
  this.lbl_page.set_text(
    (pageIdx + 1) + " / " + totalPage
  );
}

function btn_prev_onclick(obj, e) {
  this.fn_movePage(this.grd_emp.currentpage - 1);
}

function btn_next_onclick(obj, e) {
  this.fn_movePage(this.grd_emp.currentpage + 1);
}

function btn_first_onclick(obj, e) {
  this.fn_movePage(0);
}

function btn_last_onclick(obj, e) {
  this.fn_movePage(this.grd_emp.pagecount - 1);
}
```

## 페이지 번호 버튼 동적 생성

페이지 번호 버튼 목록을 동적으로 생성하려면 페이지 수에 따라 버튼을 추가/제거하는 방식을 사용합니다.

```javascript
function fn_buildPageButtons() {
  var totalPage = this.grd_emp.pagecount;
  var curPage = this.grd_emp.currentpage;

  // 최대 5개 버튼 표시 (앞뒤 2페이지)
  var startPage = Math.max(0, curPage - 2);
  var endPage = Math.min(totalPage - 1, startPage + 4);

  // 기존 버튼 초기화 후 재생성 로직
  // (실제 구현은 Dynamic 컴포넌트 활용)
  for (var i = startPage; i <= endPage; i++) {
    var isActive = (i == curPage);
    // 버튼 텍스트: i + 1, 현재 페이지 강조
    trace("페이지 버튼: " + (i + 1) +
      (isActive ? " [현재]" : ""));
  }
}
```

## 서버사이드 페이징

대용량 데이터에서는 서버에 현재 페이지 번호와 페이지 크기를 전달해 해당 페이지 데이터만 받아오는 방식이 필요합니다.

```javascript
var g_currentPage = 1;
var g_pageSize = 20;
var g_totalCount = 0;

function fn_search(pageNo) {
  g_currentPage = pageNo;

  this.ds_search.setColumn(0, "page_no", pageNo);
  this.ds_search.setColumn(0, "page_size", g_pageSize);

  this.transaction(
    "getEmpPage",
    this.getSvcUrl("getEmpPage"),
    "ds_search=ds_search",
    "ds_emp=ds_emp ds_meta=ds_meta",
    "",
    "fn_searchCallback"
  );
}

function fn_searchCallback(svc, errCode, errMsg) {
  if (errCode != 0) return;

  // 서버에서 전체 건수 수신 (ds_meta에 저장)
  g_totalCount = this.ds_meta.getColumn(0, "total_count");

  // 전체 페이지 수 계산
  var totalPage = Math.ceil(g_totalCount / g_pageSize);

  // 페이지 UI 갱신
  this.lbl_page.set_text(
    g_currentPage + " / " + totalPage
  );
}
```

서버사이드 페이징에서는 `pagerowcount`를 사용하지 않습니다. 트랜잭션으로 받은 데이터가 이미 한 페이지 분량이므로 Dataset 전체를 표시합니다.

## 무한 스크롤 (Infinite Scroll)

페이지 버튼 대신 스크롤 끝에 도달할 때 다음 페이지를 자동 로드하는 무한 스크롤 패턴도 구현할 수 있습니다.

```javascript
function grd_emp_onvscrollchanged(obj, e) {
  var maxScrollPos = obj.vscrollmax;
  var curScrollPos = obj.vscrollpos;

  // 스크롤이 끝에서 10% 이내에 도달하면 추가 로드
  if (curScrollPos >= maxScrollPos * 0.9) {
    if (!g_loading) {
      g_loading = true;
      this.fn_search(g_currentPage + 1, true); // append=true
    }
  }
}
```

`onvscrollchanged` 이벤트에서 스크롤 위치를 감지해 추가 데이터를 요청합니다.

## 페이징과 필터/정렬 조합

클라이언트 페이징 상태에서 `filter()`를 적용하면 필터된 행 기준으로 페이지 수가 재계산됩니다.

```javascript
function fn_filterAndPage(dept) {
  this.ds_emp.filter("dept_cd == '" + dept + "'");
  // 필터 후 첫 페이지로 이동
  this.fn_movePage(0);
}
```

필터 적용 직후에는 반드시 첫 페이지로 이동해야 합니다. 필터로 행 수가 줄어 현재 페이지가 범위를 벗어날 수 있습니다.

## 정리

`pagerowcount`로 클라이언트 페이징을 활성화하고, `currentpage`를 변경해 페이지를 이동합니다. 대용량 데이터는 서버사이드 페이징으로 페이지 번호를 서버에 전달해 해당 페이지 데이터만 수신합니다. 필터/정렬과 페이징은 독립적으로 동작하므로 조합 시 현재 페이지를 초기화해야 합니다.

---

**지난 글:** [Nexacro N Grid Sort & Filter — 정렬과 필터](/posts/nexacro-n-grid-sort-filter/)

**다음 글:** [Nexacro N Grid Row Actions — 행 단위 액션](/posts/nexacro-n-grid-row-actions/)

<br>
읽어주셔서 감사합니다. 😊
