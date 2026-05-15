---
title: "[Nexacro N] 폼 템플릿 활용 — 빠른 업무 화면 생성"
description: "Nexacro N 프로젝트에서 TPL_*.xfdl 폼 템플릿을 만들어 복사·이름 변경만으로 일관된 레이아웃과 Dataset 구조를 갖춘 업무 화면을 빠르게 생성하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 7
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "폼템플릿", "TPL", "화면생성", "코드재사용", "레이아웃일관성"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-base-form/)에서 BaseForm 상속 구조를 다루었다. 이번 글은 개발 생산성을 높이는 **폼 템플릿** 활용법이다. BaseForm이 "실행 중 공통 동작"을 제공한다면, 폼 템플릿은 "새 화면을 만들 때의 출발점"을 제공한다.

## 폼 템플릿이란

폼 템플릿(TPL_*.xfdl)은 새 업무 화면을 만들 때 복사하는 기준 파일이다. 레이아웃, Dataset 이름 규칙, 스크립트 스텁이 미리 채워진 상태로 제공된다. 개발자는 이 파일을 복사하고 이름을 바꾼 뒤 업무 로직만 채우면 된다.

![폼 템플릿 복사 → 업무 폼 생성 흐름](/assets/posts/nexacro-n-form-template-structure.svg)

## 템플릿 종류와 용도

| 템플릿 파일 | 용도 | 레이아웃 |
|---|---|---|
| `TPL_list.xfdl` | 목록 조회 (그리드) | 검색조건 + 그리드 + 버튼바 |
| `TPL_single.xfdl` | 단건 입력·조회 | 라벨 + 입력필드 행 반복 + 버튼바 |
| `TPL_list_detail.xfdl` | 목록 + 상세 복합 | 좌 그리드 + 우 상세 |
| `TPL_popup.xfdl` | 팝업 선택 화면 | 좁은 팝업 크기 + 확인/취소 버튼 |
| `TPL_excel.xfdl` | 엑셀 업로드 | 파일 선택 + 미리보기 그리드 |

## TPL_list.xfdl 구조

목록 조회 템플릿은 세 가지 영역으로 구성된다.

```xml
<!-- TPL_list.xfdl 레이아웃 구조 (의사 코드) -->
<Form id="TPL_list" forminclude="BaseForm.xfdl" ...>

  <!-- 1. 검색 조건 영역 -->
  <Div id="div_cond" height="80">
    <!-- 검색 조건 컴포넌트 (날짜, 콤보, Edit 등) -->
    <Button id="btn_search" text="조회" onclick="fn_search"/>
  </Div>

  <!-- 2. 결과 그리드 영역 -->
  <Div id="div_grid">
    <Grid id="grd_list" binddataset="ds_list"/>
  </Div>

  <!-- 3. 하단 버튼 영역 (BaseForm에서 제공하므로 비워 둠) -->
</Form>
```

스크립트는 스텁 상태로 제공되어 업무 폼에서 override만 하면 된다.

![목록 조회 템플릿 스크립트 스텁](/assets/posts/nexacro-n-form-template-code.svg)

## 실제 업무 폼 생성 절차

1. **템플릿 복사**: Studio에서 `TPL_list.xfdl` 우클릭 → Copy → Paste → 이름을 `SCR001_주문조회.xfdl`로 변경
2. **폼 ID 변경**: 폼 속성에서 `id`를 `SCR001`로 수정
3. **Dataset 컬럼 정의**: `ds_cond`에 검색 조건 컬럼 추가, `ds_list`는 서버 응답에 맞게 컬럼 정의
4. **그리드 컬럼 배치**: Format Editor에서 `ds_list`의 컬럼을 그리드에 배치
5. **훅 메서드 override**: `fn_init`, `fn_search` 내용 채우기

```javascript
// SCR001_주문조회.xfdl — 템플릿 복사 후 채운 상태

function fn_init() {
    // 조건 초기화
    this.ds_cond.addColumn("from_date", "string", 8);
    this.ds_cond.addColumn("to_date",   "string", 8);
    this.ds_cond.addRow();
    this.ds_cond.setColumn(0, "from_date", gfn_today());
    this.ds_cond.setColumn(0, "to_date",   gfn_today());
    this.fn_search();
}

function fn_search() {
    if (gfn_isNull(this.ds_cond.getColumn(0, "from_date"))) {
        gfn_alert("시작일을 입력하세요.");
        return;
    }
    this.transaction(
        "search",
        "/order/getList.do",
        "in:ds_cond=ds_cond",
        "out:ds_list=list",
        "fn_searchCb",
        false
    );
}

function fn_searchCb(sId, nEC, sEM) {
    if (nEC != 0) { gfn_alert(sEM); return; }
}
```

## 단건 입력 템플릿(TPL_single.xfdl) 구조

단건 입력 폼은 라벨-입력필드 쌍이 반복되는 구조다.

```xml
<!-- TPL_single.xfdl — 단건 입력 레이아웃 -->
<Form id="TPL_single" forminclude="BaseForm.xfdl">
  <Div id="div_form" layout="form">
    <Static  id="sta_field1" text="항목1*"/>
    <Edit    id="edt_field1" binddataset="ds_input" bindcolumn="field1"/>

    <Static  id="sta_field2" text="항목2"/>
    <Edit    id="edt_field2" binddataset="ds_input" bindcolumn="field2"/>
    <!-- 필드 추가는 여기에 -->
  </Div>
</Form>
```

## 템플릿 버전 관리

프로젝트가 진행되면서 공통 기준이 변경될 수 있다. 템플릿 파일을 버전화(TPL_list_v2.xfdl)하거나, 변경 내용을 팀 위키에 기록해 두면 "왜 구버전 방식을 쓰느냐"는 혼선을 줄일 수 있다.

이미 만들어진 업무 폼은 소급 적용하지 않고, 신규 화면부터 새 템플릿을 사용하는 것이 현실적인 운영 방법이다.

## 코드 생성 도구 연동

템플릿 복사 + 컬럼 정의 같은 반복 작업을 자동화하고 싶다면, 별도 코드 생성 스크립트(파이썬, Node.js 등)를 만들어 서버 API 명세(Swagger, JSON)에서 Dataset 컬럼을 자동 채우는 방법도 있다. 대형 프로젝트에서는 이 투자가 보람 있다.

---

**지난 글:** [[Nexacro N] BaseForm — 기본 폼 아키텍처](/posts/nexacro-n-base-form/)

**다음 글:** [[Nexacro N] 공유 이벤트 버스 패턴](/posts/nexacro-n-shared-event-bus/)

<br>
읽어주셔서 감사합니다. 😊
