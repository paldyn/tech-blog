---
title: "[Nexacro N] 성능 최적화 개요"
description: "Nexacro N 애플리케이션의 성능 최적화 전략을 전반적으로 설명합니다. 데이터 최적화, 렌더링 최적화, 이벤트·메모리 관리, trace를 활용한 성능 측정, 그리드 가상화, 메모리 누수 방지 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 10
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "성능최적화", "그리드", "메모리누수", "trace", "가상화", "렌더링"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-style-files/)에서 스타일 파일 관리를 살펴보았다. 이번에는 Nexacro N 애플리케이션의 성능 최적화 전략을 전반적으로 다룬다. 업무 시스템은 수천 건의 데이터를 조회하고, 복잡한 그리드를 다루며, 오랜 세션 동안 실행된다. 초기에 올바른 최적화 구조를 잡지 않으면 나중에 개선하기 어렵다.

## 성능 문제의 세 가지 원인

Nexacro N 애플리케이션의 성능 저하는 대부분 세 가지 영역에서 발생한다.

1. **과도한 데이터 조회**: 서버에서 필요 이상의 데이터를 가져와 클라이언트에서 필터·정렬
2. **비효율적인 렌더링**: 그리드에 수천 행을 한꺼번에 렌더링, `ongetcellstyle`의 무거운 로직
3. **메모리 누수**: 이벤트 핸들러 미해제, 팝업 destroy 미호출, 전역 Dataset 무한 증가

![성능 최적화 전략](/assets/posts/nexacro-n-performance-optimization-strategy.svg)

## 데이터 최적화

### 페이징으로 데이터량 제한

그리드에 전체 데이터를 한 번에 로드하지 않는다. 서버 측 페이징으로 한 페이지당 100~200건만 가져온다.

```javascript
// 페이징 트랜잭션 패턴
function fn_search(nPage) {
  var nPageSize = 100;
  this.ds_searchParam.setColumn(0, "PAGE_NO",   nPage || 1);
  this.ds_searchParam.setColumn(0, "PAGE_SIZE", nPageSize);

  this.transaction(
    "searchData",
    "svc://DataService/search",
    "ds_searchParam=ds_searchParam",
    "ds_result=ds_result:ds_paging=ds_paging",
    "",
    "fn_searchCallback"
  );
}

function fn_searchCallback(sId, nErrCode, sErrMsg) {
  if (nErrCode == 0) {
    var nTotal = this.ds_paging.getColumn(0, "TOTAL_CNT");
    fn_updatePagingUI(nTotal, this.ds_searchParam.getColumn(0, "PAGE_NO"));
  }
}
```

### Dataset 컬럼 최소화

서버에서 화면에 필요한 컬럼만 반환한다. 사용하지 않는 컬럼은 서버 쿼리에서 제외한다.

```javascript
// 조회 파라미터에 필요 컬럼 목록 전달
this.ds_searchParam.setColumn(0, "COLUMNS", "USER_ID,USER_NM,DEPT_NM,REG_DT");
```

### 클라이언트 필터 대신 서버 필터

Dataset의 `filter()` 메서드는 전체 데이터를 메모리에 올린 후 필터링한다. 데이터량이 많으면 검색 조건을 서버로 보내 처음부터 필터된 결과만 받는다.

```javascript
// 나쁜 예: 대용량 데이터 클라이언트 필터
this.ds_result.filter("DEPT_NM == 'IT팀'"); // 전체 로드 후 필터

// 좋은 예: 서버 필터
this.ds_searchParam.setColumn(0, "DEPT_NM", "IT팀");
this.transaction("search", ...); // 서버에서 필터된 결과만 반환
```

## 렌더링 최적화

### 그리드 가상화

Nexacro N의 그리드는 기본적으로 보이는 행만 렌더링하는 가상화를 지원한다. 이 기능이 활성화되어 있으면 수천 건 데이터도 부드럽게 스크롤된다.

```xml
<!-- 그리드 가상화 설정 -->
<Grid id="grd_main"
      useVirtualItem="true"
      virtualItemcount="50"/>
```

`useVirtualItem="true"`로 설정하면 화면에 보이는 행만 렌더링하고, 스크롤 시 재사용한다.

### ongetcellstyle 경량화

`ongetcellstyle`은 셀 하나가 화면에 나타날 때마다 호출된다. 무거운 연산을 피한다.

```javascript
// 나쁜 예: ongetcellstyle에서 복잡한 계산
function grd_ongetcellstyle(obj, e) {
  if (e.band !== "body" || e.datarow < 0) return;
  var ds = obj.getBindDataset();
  // 매 셀마다 문자열 파싱·변환 수행 (느림)
  var sDate = ds.getColumn(e.datarow, "REG_DT");
  var dDate = new Date(sDate.substr(0,4), sDate.substr(4,2)-1, sDate.substr(6,2));
  var nDiff = (new Date() - dDate) / 86400000;
  if (nDiff > 30) e.color = "#e05555";
}

// 좋은 예: 미리 계산한 값을 Dataset에 저장
function fn_preprocessData() {
  var ds = this.ds_main;
  var today = new Date();
  for (var i = 0; i < ds.rowcount; i++) {
    var sDate = ds.getColumn(i, "REG_DT");
    var dDate = new Date(sDate.substr(0,4), sDate.substr(4,2)-1, sDate.substr(6,2));
    var nDiff = Math.floor((today - dDate) / 86400000);
    ds.setColumn(i, "_IS_OLD", nDiff > 30 ? 1 : 0);
  }
}

function grd_ongetcellstyle(obj, e) {
  if (e.band !== "body" || e.datarow < 0) return;
  if (obj.getBindDataset().getColumn(e.datarow, "_IS_OLD") === 1) {
    e.color = "#e05555";
  }
}
```

### 폼 지연 로드

탭이나 메뉴에서 접근 시에만 폼을 로드한다. 앱 시작 시 모든 폼을 한꺼번에 로드하면 초기화 시간이 길어진다.

```javascript
// 탭 클릭 시 폼 동적 로드
function tab_onclick(obj, e) {
  var sFormId = "form_" + e.tabid;
  if (!this[sFormId]) {
    this.createObject("Form", sFormId, this.div_content,
      0, 0, this.div_content.width, this.div_content.height);
    this[sFormId].set_url("Forms/" + e.tabid + ".xfdl");
  }
  this[sFormId].set_visible(true);
}
```

![성능 측정 & 프로파일링 도구](/assets/posts/nexacro-n-performance-optimization-checklist.svg)

## 이벤트·메모리 관리

### Form_Destroy에서 이벤트 핸들러 해제

```javascript
function Form_Destroy(obj, e) {
  // 타이머 해제
  if (this._timer) {
    this.killTimer(this._timer);
    this._timer = null;
  }

  // 이벤트 핸들러 명시적 해제
  this.edt_name.removeEventListener("onchanged", this, "edt_name_onchanged");

  // Dataset 참조 해제
  this.ds_temp = null;
}
```

### 팝업 닫힌 후 destroy()

팝업을 `close()`만 하면 메모리에서 해제되지 않는다. 팝업을 완전히 제거하려면 `destroy()`를 호출한다.

```javascript
function fn_closePopup() {
  if (this.win_popup) {
    this.win_popup.close();
    this.win_popup.destroy();
    this.win_popup = null;
  }
}
```

### 전역 Dataset 무한 증가 방지

반복 트랜잭션에서 Dataset에 계속 데이터를 누적하지 않도록 조회 전에 `clearData()`를 호출한다.

```javascript
function fn_search() {
  this.ds_result.clearData(); // 이전 조회 결과 제거
  this.transaction("search", ...);
}
```

## trace()를 활용한 성능 측정

```javascript
// 트랜잭션 응답 시간 측정
function fn_search() {
  this._searchStart = new Date().getTime();
  this.transaction("search", ..., "fn_searchCallback");
}

function fn_searchCallback(sId, nErrCode, sErrMsg) {
  var elapsed = new Date().getTime() - this._searchStart;
  trace("조회 완료: " + this.ds_result.rowcount + "건, " + elapsed + "ms");

  if (elapsed > 2000) {
    trace("⚠️ 응답 시간 2초 초과: " + sId);
  }
}
```

배포 빌드에서는 `trace()`가 성능에 영향을 줄 수 있으므로, 빌드 옵션에서 trace를 비활성화하거나 공통 함수로 래핑해 환경 변수로 제어한다.

## 성능 최적화 우선순위

성능 문제가 발생하면 다음 순서로 접근한다.

1. **데이터량 확인**: 조회 결과 row 수가 적정한가? 페이징 적용 여부
2. **쿼리 분석**: 서버 응답 시간이 느린가? SQL 실행 계획 확인
3. **렌더링 분석**: 그리드 스크롤이 느린가? 가상화 설정 확인
4. **메모리 확인**: 장시간 사용 시 느려지는가? 메모리 누수 탐지
5. **이벤트 분석**: 특정 조작 시 느린가? `ongetcellstyle` 로직 점검

성능 최적화는 측정 없이 짐작으로 하면 오히려 코드가 복잡해질 수 있다. `trace()`와 브라우저 DevTools로 먼저 병목을 정확히 파악한 뒤 개선에 착수하는 것이 원칙이다.

---

**지난 글:** [스타일 파일 관리](/posts/nexacro-n-style-files/)

<br>
읽어주셔서 감사합니다. 😊
