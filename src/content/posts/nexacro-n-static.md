---
title: "[Nexacro N] Static — 텍스트 레이블 컴포넌트의 모든 활용법"
description: "Nexacro N Static 컴포넌트의 라벨·상태 표시·구분선·섹션 헤더 활용, set_text()·set_style() 동적 변경, Dataset 바인딩, 실무에서 자주 쓰이는 Static 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 10
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "static", "라벨", "텍스트", "set_text", "set_style", "상태표시", "바인딩"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-hidden-input/)에서 화면에 보이지 않는 Hidden 컴포넌트로 데이터를 보관하는 방법을 살펴봤습니다. 이번에는 반대로 화면에 **텍스트를 표시**하는 용도의 `Static` 컴포넌트를 다룹니다. "라벨"이라고도 불리는 Static은 단순해 보이지만, 정적 텍스트 표시부터 동적 상태 메시지, 구분선, 섹션 헤더, Dataset 바인딩까지 다양한 역할을 수행합니다.

## Static 컴포넌트란

`Static` 컴포넌트는 사용자가 직접 편집할 수 없는 **읽기 전용 텍스트**를 표시합니다. 입력 필드 앞의 라벨("이름", "전화번호"), 처리 결과 메시지, 합계·소계 값, 데이터 조회 결과의 단순 텍스트 표시 등에 사용됩니다.

```xml
<!-- 기본 Static 선언 -->
<Static id="stcLabel" text="이름 *"
        left="50" top="100" width="100" height="30"
        style="color:#e8e8e8; font-size:13; font-weight:600;"/>
```

![Static — 종류 및 활용 패턴](/assets/posts/nexacro-n-static-types.svg)

## 주요 속성

### text

표시할 텍스트 문자열입니다. Studio에서 직접 입력하거나 스크립트에서 `set_text()`로 동적 변경합니다.

```javascript
// 동적 텍스트 변경
this.stcResult.set_text("조회 결과: " + nCount + "건");
```

### style

색상, 폰트, 배경 등 스타일을 지정합니다. CSS와 유사한 키:값 쌍 형식입니다.

```javascript
// 스타일 동적 변경
this.stcStatus.set_style("color:#55c555; font-weight:700;");
```

### halign / valign

텍스트 정렬을 제어합니다.

| 속성 | 값 | 설명 |
|------|-----|------|
| `halign` | `left`, `center`, `right` | 수평 정렬 |
| `valign` | `top`, `middle`, `bottom` | 수직 정렬 |

```javascript
// 가운데 정렬
this.stcTitle.set_halign("center");
this.stcTitle.set_valign("middle");
```

## set_text() — 동적 텍스트 갱신

Static의 가장 자주 사용되는 메서드입니다. 조회 건수, 합계 금액, 상태 메시지 등을 실시간으로 업데이트합니다.

```javascript
// 조회 완료 후 결과 건수 표시
function fn_search_cb(sSvcId, nErrorCode, sErrorMsg) {
    if (nErrorCode < 0) return;
    var nCount = this.dsMain.rowcount;
    this.stcCount.set_text("총 " + nCount + "건");
}

// 합계 표시
function fn_updateTotal() {
    var nTotal = 0;
    for (var i = 0; i < this.dsCart.rowcount; i++) {
        nTotal += this.dsCart.getColumn(i, "AMOUNT");
    }
    this.stcTotal.set_text(nTotal.toLocaleString() + "원");
}
```

## set_style() — 동적 스타일 변경

처리 결과에 따라 색상을 바꾸는 상태 표시 패턴은 Static의 핵심 활용법입니다.

```javascript
function fn_setStatus(sMsg, sType) {
    this.stcStatus.set_text(sMsg);
    var sColor = (sType === "ok") ? "#55c555" : "#e05555";
    this.stcStatus.set_style(
        "color:" + sColor + "; font-weight:600;"
    );
}

// 사용 예
fn_setStatus("저장이 완료되었습니다.", "ok");
fn_setStatus("오류가 발생했습니다.", "error");
```

![Static — 텍스트·스타일 동적 변경](/assets/posts/nexacro-n-static-code.svg)

## 구분선 패턴

Static을 높이 1~2px, 너비 100%로 설정하고 배경색을 지정하면 수평 구분선이 됩니다.

```xml
<!-- 수평 구분선 -->
<Static id="stcLine1"
        left="10" top="60" width="860" height="1"
        style="background-color:#2a3a4a;"/>
```

```javascript
// 동적 구분선 색상 변경
this.stcLine1.set_style("background-color:#4a5a6a;");
```

## 섹션 헤더 패턴

화면을 논리 섹션으로 구분하는 헤더 Static 패턴입니다.

```xml
<!-- 섹션 헤더 -->
<Static id="stcHeader1"
        text="■ 기본 정보"
        left="10" top="10" width="860" height="30"
        style="font-size:15; font-weight:700; color:#e8e8e8;
               border-bottom:1px solid #2a3a4a;"/>
```

`■` 같은 특수문자를 prefix로 사용하면 시각적 강조 효과를 줄 수 있습니다.

## Dataset 바인딩

Static도 Dataset 컬럼에 바인딩할 수 있습니다. 행이 이동할 때마다 자동으로 값이 갱신됩니다.

```xml
<!-- Dataset 컬럼 바인딩 -->
<Static id="stcName"
        binddataset="dsMain"
        bindcolumn="USER_NM"
        left="200" top="100" width="200" height="30"/>
```

Grid의 행을 클릭하면 상세 영역의 Static에 해당 행 값이 자동으로 표시됩니다. 편집이 불필요한 필드(등록일, 등록자 등)는 Edit 대신 Static + 바인딩 패턴을 사용합니다.

## 글자 수 카운터

Textarea와 함께 사용해 남은 글자 수를 실시간으로 표시합니다.

```javascript
var MAX_LEN = 500;

function txaComment_onchanged(obj, e) {
    var nLen     = obj.value.length;
    var nRemain  = MAX_LEN - nLen;
    this.stcCount.set_text(nLen + " / " + MAX_LEN);
    // 초과 시 빨간색
    var sColor = (nLen > MAX_LEN) ? "#e05555" : "#888";
    this.stcCount.set_style("color:" + sColor + ";");
    // 초과 시 잘라내기
    if (nLen > MAX_LEN) {
        obj.set_value(obj.value.substr(0, MAX_LEN));
    }
}
```

## 로딩 메시지

서버 통신 중 사용자에게 진행 상태를 안내하는 Static 패턴입니다.

```javascript
// 통신 시작 전
function fn_showLoading() {
    this.stcLoading.set_visible(true);
    this.stcLoading.set_text("조회 중...");
    this.stcLoading.set_style("color:#7ec8e3;");
}

// 통신 완료 후
function fn_hideLoading() {
    this.stcLoading.set_visible(false);
}
```

## visible 제어

Static도 `set_visible()`로 조건부 표시가 가능합니다. 오류 메시지 Static은 평소에는 숨겨두다가 오류 발생 시만 표시하는 패턴이 UX 측면에서 자연스럽습니다.

```javascript
// 유효성 오류 메시지 표시/숨김
function fn_showError(sMsg) {
    this.stcError.set_text(sMsg);
    this.stcError.set_visible(true);
}

function fn_hideError() {
    this.stcError.set_visible(false);
}
```

## Static 공통 스타일 관리

팀 표준 스타일을 상수로 정의해 일관성을 유지합니다.

```javascript
// 공통 라이브러리에 스타일 상수 정의
var STYLE = {
    label:   "color:#888; font-size:12;",
    value:   "color:#e8e8e8; font-size:13;",
    ok:      "color:#55c555; font-weight:600;",
    error:   "color:#e05555; font-weight:600;",
    warning: "color:#b5cea8; font-weight:600;",
    header:  "color:#7ec8e3; font-size:14; font-weight:700;"
};

// 사용 예
this.stcLabel1.set_style(STYLE.label);
this.stcStatus.set_style(STYLE.ok);
```

스타일 상수를 공통 라이브러리에 두면, 디자인 변경 시 한 곳만 수정해도 앱 전체에 적용됩니다. 이로써 입력 컴포넌트 카탈로그의 마지막 주제인 Static을 마쳤습니다. Div 그루핑부터 Edit, MaskEdit, Calendar, Spin, Radio, CheckBox, Combo, Select/MultiSelect, Hidden, Static까지 — 실무에서 가장 자주 쓰이는 기본 컴포넌트를 모두 살펴봤습니다.

---

**지난 글:** [Hidden — 화면에 보이지 않는 데이터 컨테이너](/posts/nexacro-n-hidden-input/)

**다음 글:** [ImageViewer / Picture — 이미지 표시 컴포넌트 활용](/posts/nexacro-n-imageviewer-picture/)

<br>
읽어주셔서 감사합니다. 😊
