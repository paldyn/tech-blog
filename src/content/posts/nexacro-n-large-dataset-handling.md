---
title: "[Nexacro N] 대용량 데이터 처리 전략"
description: "Nexacro N에서 수만 건 이상의 데이터를 안정적으로 처리하는 방법을 설명합니다. 서버 페이징, 클라이언트 가상화, 점진적 분할 로드, Dataset 메모리 관리까지 실무 기준으로 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 1
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "대용량데이터", "페이징", "가상화", "Dataset", "성능최적화"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-performance-optimization/)에서 성능 최적화의 전체 지형을 조감했다. 이번 글에서는 그 중에서도 가장 빈번하게 문제가 되는 **대용량 데이터 처리**를 집중해서 다룬다. 수만 건의 데이터를 한 번에 내려받아 Grid에 뿌리려다 브라우저가 멈추고, 사용자가 새로고침을 반복하는 상황 — Nexacro N 프로젝트에서 한 번쯤 겪어본 문제다. 올바른 전략을 선택하면 이 문제는 구조적으로 해결된다.

## 데이터 규모별 처리 전략

대용량 데이터 처리에는 정답이 하나가 아니다. 데이터 건수, 화면의 특성(집계 여부, 필터 빈도), 서버 부하 허용치에 따라 최적 전략이 달라진다. 실무에서는 세 가지 패턴이 주로 사용된다.

![대용량 데이터 처리 전략](/assets/posts/nexacro-n-large-dataset-handling-strategy.svg)

**서버 페이징**은 조회 조건에 PAGE_NO, PAGE_SIZE를 파라미터로 함께 전달하고, 서버가 해당 슬라이스와 총 건수(TOTAL_CNT)만 반환하는 패턴이다. Dataset에는 항상 한 페이지 분량만 존재하므로 메모리 부담이 없다. 단, 클라이언트 측에서 전체 데이터를 대상으로 정렬·집계를 직접 할 수 없다는 제약이 있다.

**전체 로드 + Grid 가상화**는 데이터를 모두 내려받되 Grid의 가상 렌더링(Virtualization)으로 DOM 생성을 최소화하는 방식이다. 5천~2만 건 수준에서 클라이언트 필터·정렬이 자주 바뀌는 화면에 적합하다. Dataset에 데이터가 모두 있으므로 집계·정렬이 자유롭지만, 초기 로딩 시간과 메모리 소비가 커진다.

**점진적 분할 로드**는 초기 N건만 로드하고, 사용자가 스크롤하거나 '더보기' 버튼을 누를 때 추가로 가져오는 패턴이다. `Dataset.appendData()`로 기존 데이터 뒤에 이어붙이므로 무한 스크롤 UX를 구현할 수 있다.

## 서버 페이징 구현

서버 페이징에서 핵심은 검색 파라미터 Dataset(dsSearch)에 페이지 번호와 크기를 담아 보내고, 응답 Dataset에서 총 건수를 꺼내 페이저를 갱신하는 루프를 만드는 것이다.

![서버 페이징 구현 패턴](/assets/posts/nexacro-n-large-dataset-handling-code.svg)

```javascript
// Form 변수 선언
var nPage     = 1;
var nPageSize = 100;
var nTotal    = 0;
var nMaxPage  = 0;

function fnSearch() {
    // 페이지 파라미터를 검색 Dataset에 세팅
    dsSearch.setColumn(0, "PAGE_NO",   nPage);
    dsSearch.setColumn(0, "PAGE_SIZE", nPageSize);

    var svcUrl = "svc::selectList.do";
    var args   = "dsSearch=dsSearch:U";
    var output = "dsList=dsList";

    this.transaction("LIST", svcUrl, args, output, "", "cbSearch");
}

function cbSearch(sId, nErrorCode, sErrorMsg) {
    if (nErrorCode != 0) {
        alert(sErrorMsg);
        return;
    }

    // 총 건수 및 최대 페이지 계산
    nTotal   = dsResult.getColumn(0, "TOTAL_CNT");
    nMaxPage = Math.ceil(nTotal / nPageSize);
    fnUpdatePager();
}

function fnNextPage() {
    if (nPage >= nMaxPage) return;
    nPage++;
    fnSearch();
}

function fnPrevPage() {
    if (nPage <= 1) return;
    nPage--;
    fnSearch();
}

function fnUpdatePager() {
    edtPageInfo.set_text(nPage + " / " + nMaxPage + " 페이지 (총 " + nTotal + "건)");
    btnPrev.set_enable(nPage > 1);
    btnNext.set_enable(nPage < nMaxPage);
}
```

서버 쿼리에서는 Oracle 기준으로 `ROWNUM`과 서브쿼리를 활용하거나, SQL Server의 `OFFSET ... FETCH NEXT`를 사용해 슬라이스를 잘라낸다. TOTAL_CNT를 매번 COUNT(*)로 구하면 느리므로, 첫 페이지 조회 시에만 카운트하고 이후에는 캐시하거나 별도 컬럼으로 넘기는 전략이 효과적이다.

## 전체 로드 + Grid 가상화 설정

Nexacro N의 Grid는 기본적으로 가상화를 지원한다. `Grid.virtualization` 속성을 `true`로 설정하면 현재 뷰포트에 보이는 행만 DOM으로 렌더링하고 나머지는 계산상으로만 유지한다.

```javascript
// Studio에서 속성 패널로도 설정 가능
grdList.set_virtualization(true);

// 행 높이가 가변적이면 fixedrowheight를 false로
grdList.set_fixedrowheight(false);

// 대용량 Dataset 바인딩 전에 화면 갱신 일시 중단
grdList.set_visible(false);
grdList.set_binddataset("dsList");
grdList.set_visible(true);
```

가상화를 켜도 Dataset 자체는 메모리에 전부 올라가 있다는 점을 기억해야 한다. 20만 건짜리 Dataset이라면 Dataset 객체의 메모리 점유가 상당하다. 이 경우 서버 페이징이나 점진적 분할 로드로 전략을 바꾸는 것이 옳다.

## Dataset 메모리 관리

Dataset이 계속 누적되지 않도록 관리하는 것이 중요하다. 조회 버튼을 누를 때마다 기존 Dataset에 추가되는 실수는 흔하게 발생한다.

```javascript
function fnSearch() {
    // 새 검색 시 기존 Dataset 초기화 (clear 필수)
    dsList.clearData();

    // appendData 패턴이 아닌 일반 Transaction은
    // 기본적으로 Dataset을 교체하므로 clear 불필요하지만
    // 명시적으로 초기화하면 혼동이 줄어든다

    this.transaction("LIST", svcUrl, args, "dsList=dsList", "", "cbSearch");
}
```

반면 점진적 분할 로드에서는 의도적으로 `appendData()`를 사용한다.

```javascript
function cbSearchMore(sId, nErrorCode, sErrorMsg) {
    if (nErrorCode != 0) return;
    // 서버 응답 데이터를 기존 Dataset 뒤에 병합
    dsList.appendData(dsTemp);
    dsTemp.clearData();
}
```

## 대용량 데이터와 클라이언트 정렬·필터

Dataset의 내장 sort/filter는 건수가 많아지면 느려진다. 2만 건 이상에서 클라이언트 정렬을 실행하면 눈에 띄는 지연이 발생한다.

```javascript
// 나쁜 패턴: 2만 건 Dataset을 클라이언트에서 sort
dsList.set_sortcolumn("REG_DATE");
dsList.set_sorttype("descend");

// 좋은 패턴: sort 파라미터를 서버에 전달하고 서버에서 ORDER BY
dsSearch.setColumn(0, "SORT_COL", "REG_DATE");
dsSearch.setColumn(0, "SORT_DIR", "DESC");
fnSearch(); // 서버에서 정렬된 결과 반환
```

필터도 마찬가지다. 로컬 필터(`Dataset.set_filter`)는 편리하지만 대용량에서는 서버에 조건을 추가해 재조회하는 편이 훨씬 빠르다.

## 페이징 없는 대용량 조회의 위험

Transaction 호출이 완료되기까지 브라우저 메인 스레드가 응답하지 못하는 시간이 길어진다. 10만 건을 한 번에 내려받으면 수초간 UI가 멈춘다. 거기에 Grid 렌더링까지 한 번에 일어나면 사용자 입장에서는 완전히 멈춘 것처럼 보인다. 서버 부하도 급증하고, 타임아웃 오류가 빈발한다.

간단한 규칙: **단일 Transaction 결과 Dataset이 5천 건을 초과할 것으로 예상되면 반드시 페이징이나 분할 로드를 설계에 포함**한다.

## Dataset 컬럼 수 최소화

데이터 건수뿐 아니라 컬럼 수도 메모리에 영향을 미친다. 화면에 표시하지 않는 컬럼을 포함해 30개 이상의 컬럼을 가진 Dataset이 5만 건이라면 메모리 점유는 상당하다.

```javascript
// 서버에서 SELECT * 하지 말고 화면에 필요한 컬럼만 지정
// 쿼리: SELECT ID, USER_NM, DEPT_CD, REG_DATE FROM ...
// (ADDR1, ADDR2, MEMO 등 화면 불필요 컬럼 제외)
```

ConstColumn을 사용해 공통 코드 값을 Dataset에 반복 저장하지 않고 별도 콤보 Dataset과 연결하는 것도 메모리 절감에 도움이 된다.

## 로딩 인디케이터와 사용자 피드백

대용량 조회는 시간이 걸린다. 사용자에게 진행 상황을 알려야 한다.

```javascript
function fnSearch() {
    // 로딩 시작
    this.grdList.set_enable(false);
    this.btnSearch.set_enable(false);
    this.divLoading.set_visible(true);

    this.transaction("LIST", svcUrl, args, output, "", "cbSearch");
}

function cbSearch(sId, nErrorCode, sErrorMsg) {
    // 로딩 종료 (성공/실패 모두)
    this.grdList.set_enable(true);
    this.btnSearch.set_enable(true);
    this.divLoading.set_visible(false);

    if (nErrorCode != 0) {
        alert("조회 실패: " + sErrorMsg);
        return;
    }
}
```

## 정리

Nexacro N에서 대용량 데이터를 다루는 핵심은 "얼마나 가져올 것인가"를 설계 시점에 결정하는 것이다. 5천 건 이하라면 전체 로드 + 가상화가 간단하고 편리하다. 5천~2만 건 사이라면 화면 특성에 따라 두 전략 중 하나를 택한다. 2만 건을 넘거나 실시간 누적 데이터라면 서버 페이징이나 점진적 분할 로드를 처음부터 설계에 넣어야 한다. 나중에 패턴을 교체하는 것은 처음부터 올바르게 구현하는 것보다 훨씬 많은 비용이 든다.

---

**지난 글:** [\[Nexacro N\] 성능 최적화 개요](/posts/nexacro-n-performance-optimization/)

**다음 글:** [\[Nexacro N\] 화면 렌더링(Paint) 최적화](/posts/nexacro-n-paint-optimization/)

<br>
읽어주셔서 감사합니다. 😊
