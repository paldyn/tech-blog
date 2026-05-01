---
title: "[Nexacro N] Calendar — 날짜 선택 컴포넌트 활용 가이드"
description: "Nexacro N Calendar 컴포넌트의 caltype(date/month/year), dateformat, mindate/maxdate, 오늘 버튼, onchanged 이벤트, 날짜 범위 제한, Edit과 연동 패턴을 실무 중심으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 4
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "calendar", "날짜선택", "caltype", "dateformat", "mindate", "maxdate", "날짜범위"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-maskedit/)에서 MaskEdit으로 날짜를 포맷에 맞게 입력받는 방법을 살펴봤습니다. MaskEdit이 직접 타이핑에 적합하다면, **Calendar 컴포넌트**는 마우스 클릭으로 날짜를 선택하는 UI를 제공합니다. 두 컴포넌트는 상호 보완적으로, 한 화면에 Calendar와 MaskEdit(또는 Edit)을 함께 배치해 날짜를 선택하거나 직접 입력하는 양쪽 방식을 모두 지원하는 것이 실무 표준 패턴입니다.

## Calendar 컴포넌트 개요

`Calendar` 컴포넌트는 월별 날짜 그리드를 화면에 직접 표시합니다. 사용자가 날짜 셀을 클릭하면 `onchanged` 이벤트가 발생하며, `value` 속성으로 선택된 날짜를 읽을 수 있습니다. 기본 값 형식은 `YYYYMMDD`입니다.

```javascript
// onchanged에서 선택된 날짜 읽기
function calDate_onchanged(obj, e) {
    var sDate = obj.value; // "20260501" 형식
    trace("선택된 날짜: " + sDate);
}
```

![Calendar — 컴포넌트 구조 및 주요 속성](/assets/posts/nexacro-n-calendar-structure.svg)

## caltype 속성

`caltype`은 Calendar의 선택 단위를 결정합니다.

| caltype | 선택 단위 | value 형식 |
|---------|-----------|-----------|
| `date` | 연·월·일 | `YYYYMMDD` |
| `month` | 연·월 | `YYYYMM` |
| `year` | 연 | `YYYY` |

기간 검색 시 시작·종료 연월을 선택하는 UI에는 `month`, 회계연도 선택에는 `year`를 사용합니다.

```javascript
// 월 단위 선택 Calendar 설정
function Form_onload(obj, e) {
    this.calPeriod.set_caltype("month");
}
```

## 날짜 범위 제한: mindate / maxdate

선택 가능한 날짜 범위를 `mindate`와 `maxdate`로 제한합니다. 범위를 벗어난 날짜는 비활성화되어 클릭할 수 없습니다.

```javascript
// 오늘부터 1년 후까지만 선택 가능
function fn_setDateRange() {
    var oToday = new Date();
    var sToday = this.fn_formatDate(oToday);
    // 1년 후 날짜 계산
    var oMaxDate = new Date();
    oMaxDate.setFullYear(oMaxDate.getFullYear() + 1);
    var sMaxDate = this.fn_formatDate(oMaxDate);

    this.calDate.set_mindate(sToday);
    this.calDate.set_maxdate(sMaxDate);
}

// Date 객체를 YYYYMMDD 문자열로 변환
function fn_formatDate(oDate) {
    var sY = oDate.getFullYear().toString();
    var sM = ("0" + (oDate.getMonth() + 1)).slice(-2);
    var sD = ("0" + oDate.getDate()).slice(-2);
    return sY + sM + sD;
}
```

`mindate`와 `maxdate`는 `YYYYMMDD` 형식의 문자열로 지정합니다.

## dateformat 속성

`dateformat`은 Calendar 셀에 날짜를 어떻게 표시할지 정의합니다. 기본값은 Nexacro N 설치 시의 로케일 설정에 따라 다르지만, 명시적으로 지정하는 것이 안전합니다.

```xml
<!-- Studio에서 직접 설정 -->
<Calendar id="calDate"
          dateformat="YYYY-MM-DD"
          caltype="date"
          .../>
```

```javascript
// 스크립트로 동적 설정
this.calDate.set_dateformat("YYYY/MM/DD");
```

## 오늘 버튼 (todaybutton)

`todaybutton` 속성을 `true`로 설정하면 달력 하단에 "오늘" 버튼이 표시됩니다. 클릭하면 오늘 날짜로 이동합니다.

```javascript
this.calDate.set_todaybutton(true);
```

## value 설정 (초기값 지정)

화면 로드 시 특정 날짜를 초기값으로 설정합니다.

```javascript
function Form_onload(obj, e) {
    // 오늘 날짜를 기본값으로 설정
    var oToday = new Date();
    var sToday = this.fn_formatDate(oToday);
    this.calDate.set_value(sToday);
}
```

빈 Calendar를 보여주려면 `set_value("")`를 사용합니다.

## Calendar와 Edit 연동 패턴

실무에서는 Calendar(클릭 선택)와 Edit 또는 MaskEdit(직접 입력)을 함께 배치하는 패턴이 많습니다.

```javascript
// Calendar 선택 → Edit에 반영
function calStartDate_onchanged(obj, e) {
    var sDate = obj.value;
    // YYYYMMDD → YYYY-MM-DD 변환
    var sFormatted = sDate.substr(0, 4) + "-"
                   + sDate.substr(4, 2) + "-"
                   + sDate.substr(6, 2);
    this.edtStartDate.set_value(sFormatted);
}

// Edit 변경 → Calendar에 반영
function edtStartDate_onchanged(obj, e) {
    var sDate = obj.value.replace(/-/g, ""); // YYYY-MM-DD → YYYYMMDD
    if (sDate.length === 8) {
        this.calStartDate.set_value(sDate);
    }
}
```

![Calendar — 날짜 선택 이벤트 처리](/assets/posts/nexacro-n-calendar-code.svg)

## 날짜 범위 선택 (시작~종료)

기간 조회 화면에서 시작일과 종료일을 선택할 때, 시작일이 종료일보다 이후가 되지 않도록 상호 제한을 걸 수 있습니다.

```javascript
// 시작일 변경 시 종료일 최솟값 갱신
function calStartDate_onchanged(obj, e) {
    this.calEndDate.set_mindate(obj.value);
    // 종료일이 시작일보다 이전이면 초기화
    if (this.calEndDate.value < obj.value) {
        this.calEndDate.set_value(obj.value);
    }
}

// 종료일 변경 시 시작일 최댓값 갱신
function calEndDate_onchanged(obj, e) {
    this.calStartDate.set_maxdate(obj.value);
}
```

이 패턴을 적용하면 사용자가 논리적으로 불가능한 날짜 범위를 입력하는 것을 방지할 수 있습니다.

## Calendar 표시 언어

Calendar 내부 요일, 월 표시는 `locale` 속성으로 언어를 지정합니다.

```javascript
this.calDate.set_locale("ko-KR"); // 한국어
```

`Environment.xml`의 기본 로케일이 설정되어 있다면 별도로 지정하지 않아도 됩니다.

## edittype 속성

`edittype="readonly"`로 설정하면 Calendar를 읽기 전용으로 만들어 날짜를 변경할 수 없게 합니다. 조회 결과를 단순 표시할 때 유용합니다.

```javascript
// 조회 모드: 읽기 전용
this.calDate.set_edittype("readonly");

// 편집 모드: 입력 가능
this.calDate.set_edittype("normal");
```

## 달력 비활성화 날짜 처리

특정 요일(예: 주말)이나 공휴일을 비활성화하는 기능은 기본 제공되지 않습니다. 이 경우 `onchanged`에서 선택된 날짜가 비활성화 대상인지 검사하고, 해당하면 경고 후 값을 초기화하는 방식으로 처리합니다.

```javascript
function calDate_onchanged(obj, e) {
    var sDate = obj.value;
    // JavaScript Date 객체로 변환
    var oDate = new Date(
        parseInt(sDate.substr(0, 4)),
        parseInt(sDate.substr(4, 2)) - 1,
        parseInt(sDate.substr(6, 2))
    );
    var nDay = oDate.getDay(); // 0=일, 6=토
    if (nDay === 0 || nDay === 6) {
        alert("평일만 선택할 수 있습니다.");
        obj.set_value("");
    }
}
```

---

**지난 글:** [MaskEdit — 서식 있는 입력 필드의 모든 것](/posts/nexacro-n-maskedit/)

**다음 글:** [Spin — 숫자 증감 컴포넌트 완전 정복](/posts/nexacro-n-spin/)

<br>
읽어주셔서 감사합니다. 😊
