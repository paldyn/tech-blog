---
title: "[Nexacro N] 레이아웃과 스타일 완전 정복"
description: "Nexacro N에서 컴포넌트를 배치하는 좌표 기반 레이아웃, 앵커(Anchor) 기능, XCSS 스타일 시스템과 테마 관리를 실무 코드와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-22"
archiveOrder: 12
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "layout", "style", "xcss", "cssclass"]
featured: false
draft: false
---

이 글은 **Nexacro N 기준으로 작성되었습니다.**
넥사크로를 처음 접하면 컴포넌트를 어디에, 어떻게 배치해야 하는지부터 막힙니다.
웹 개발처럼 `flex`나 `grid`가 아닌, 픽셀 절대좌표 방식을 사용하기 때문입니다.
이번 글에서는 넥사크로 N의 레이아웃 배치 원리부터 XCSS 스타일 시스템, 그리고 실무에서 자주 쓰는 패턴까지 코드와 함께 정리합니다.

---

## 레이아웃의 기본: 절대좌표 배치

넥사크로 N은 기본적으로 **절대좌표(Absolute Positioning)** 방식을 사용합니다.
모든 컴포넌트는 Form(화면)의 좌상단 `(0, 0)`을 기준으로 `left`, `top`, `width`, `height` 속성으로 위치와 크기를 지정합니다.

![Nexacro N 레이아웃 좌표계와 속성](/assets/posts/nexacro-layout-position.svg)

| 속성 | 설명 | 단위 |
|------|------|------|
| `left` | 컴포넌트 좌측 X 좌표 | px 또는 % |
| `top` | 컴포넌트 상단 Y 좌표 | px 또는 % |
| `width` | 너비 | px 또는 % |
| `height` | 높이 | px 또는 % |
| `right` | 우측 여백 (앵커 배치 시) | px 또는 % |
| `bottom` | 하단 여백 (앵커 배치 시) | px 또는 % |

`%` 단위는 부모 컨테이너(Form 또는 Div) 크기를 기준으로 계산됩니다.
예를 들어 `width="50%"`는 부모 폼 너비의 절반을 차지합니다.

---

## 앵커(Anchor) 기능으로 반응형 배치 흉내 내기

넥사크로 N은 웹 CSS와 달리 반응형 레이아웃을 기본 제공하지 않지만, **앵커** 기능을 사용하면 창 크기가 바뀔 때 컴포넌트 위치와 크기를 자동으로 조정할 수 있습니다.

앵커는 `right`와 `bottom` 속성을 동시에 설정함으로써 동작합니다.
`right`를 지정하면 컴포넌트의 오른쪽 끝이 부모의 오른쪽 끝에서 해당 픽셀만큼 고정됩니다.

```javascript
// Form의 onload 이벤트에서 스크립트로 앵커 속성을 동적으로 설정하는 예시
function Form_onload(obj, e) {
    // Grid 컴포넌트를 폼 전체 너비에 꽉 차도록 앵커 설정
    // left=10, right=10이면 좌우 각 10px 여백을 남기고 폼 크기에 따라 width가 자동 계산됨
    this.grd_list.set_left(10);
    this.grd_list.set_right(10);
    this.grd_list.set_top(80);
    this.grd_list.set_bottom(10);
}
```

Studio에서는 속성 창에서 `right`와 `bottom` 값을 직접 입력하면 됩니다.
`left`와 `right`를 동시에 지정하면 width가 자동으로 결정되고, `top`과 `bottom`을 동시에 지정하면 height가 자동으로 결정됩니다.

---

## 스크립트로 컴포넌트 위치와 크기 동적 변경

런타임에 레이아웃을 바꿔야 할 때는 `set_*` 메서드를 사용합니다.

```javascript
// 검색 패널 펼치기/접기 토글 예시
function fn_toggleSearchPanel(obj, e) {
    var bExpand = (this.div_search.getVisible() === false);

    if (bExpand) {
        // 검색 영역 표시: div_search 높이를 120으로 확장
        this.div_search.set_visible(true);
        this.div_search.set_height(120);

        // 그리드 위치를 검색 영역 아래로 내림
        this.grd_list.set_top(200);
    } else {
        // 검색 영역 숨기기
        this.div_search.set_visible(false);
        this.div_search.set_height(0);

        // 그리드 위치를 위로 올림
        this.grd_list.set_top(80);
    }
}

// 컴포넌트 현재 크기 읽기
function fn_getComponentSize(obj, e) {
    var nLeft   = this.edt_name.left;    // 현재 left 값
    var nTop    = this.edt_name.top;     // 현재 top 값
    var nWidth  = this.edt_name.width;   // 현재 width 값
    var nHeight = this.edt_name.height;  // 현재 height 값

    trace("위치: (" + nLeft + ", " + nTop + ")  크기: " + nWidth + " x " + nHeight);
}
```

---

## XCSS: 넥사크로 전용 스타일 시트

넥사크로 N의 스타일 시스템은 **XCSS(eXtensible Cascading Style Sheets)**입니다.
웹 CSS와 문법이 유사하지만, 넥사크로 컴포넌트 고유 속성을 지원하는 확장 포맷입니다.

XCSS 파일은 보통 두 위치에 존재합니다.

- `skin/` 폴더: 테마(전역 스타일) 파일
- 각 Form 폴더: 해당 Form 전용 XCSS 파일 (`*.xcss`)

XCSS 기본 문법은 웹 CSS와 거의 동일합니다.

```javascript
/* 컴포넌트 타입 선택자 — 모든 Button에 적용 */
Button {
    background: #1e3a5f;
    color: #ffffff;
    border-radius: 4px;
    font-size: 13px;
}

/* 클래스 선택자 — cssclass="primary" 인 컴포넌트에 적용 */
.primary {
    background: #2563eb;
    color: #ffffff;
}

/* 타입 + 클래스 조합 */
Button.primary {
    background: #2563eb;
    font-weight: bold;
}

/* 의사 클래스(pseudo-class): 마우스 오버, 비활성 상태 */
Button:hover {
    background: #1d4ed8;
}

Button:disabled {
    background: #94a3b8;
    color: #64748b;
}

/* 필수 입력 필드 강조 스타일 */
Edit.essential {
    background: #fffbe6;
    border: 1px solid #f59e0b;
}

/* 읽기 전용 스타일 */
Edit.readonly {
    background: #f1f5f9;
    color: #64748b;
}
```

---

## 스타일 우선순위 (낮은 → 높은)

![XCSS 스타일 계층과 우선순위](/assets/posts/nexacro-xcss-theme.svg)

실무에서 "왜 내 스타일이 안 먹히지?"를 디버깅할 때는 우선순위 계층을 먼저 확인하세요.

1. **테마 XCSS** - `skin/` 폴더, 앱 전체 기본값
2. **Form XCSS** - 해당 Form 전용 파일
3. **cssclass 속성** - 컴포넌트에 지정한 클래스
4. **style 속성(인라인)** - 스크립트로 직접 지정

---

## cssclass 속성으로 스타일 전환하기

컴포넌트의 `cssclass` 속성을 스크립트에서 동적으로 바꾸면, 상태에 따라 스타일을 전환할 수 있습니다.

```javascript
// 입력 유효성 검사 후 스타일 전환 예시
function fn_validateField(obj, e) {
    var sValue = this.edt_userid.value;

    if (sValue.length < 4) {
        // 에러 상태: 빨간 테두리 클래스 적용
        this.edt_userid.set_cssclass("error");
        this.stt_errmsg.set_text("아이디는 4자 이상 입력하세요.");
        this.stt_errmsg.set_visible(true);
    } else {
        // 정상 상태: 기본 클래스 복원
        this.edt_userid.set_cssclass("");
        this.stt_errmsg.set_visible(false);
    }
}

// 여러 클래스를 동시에 적용할 때는 공백으로 구분
function fn_applyMultiClass(obj, e) {
    // "essential"과 "highlight" 두 클래스를 동시에 적용
    this.edt_amount.set_cssclass("essential highlight");
}
```

XCSS 파일에는 이에 대응하는 스타일을 정의합니다.

```javascript
/* Form의 xcss 파일 */

Edit.error {
    border: 1px solid #ef4444;
    background: #fef2f2;
}

Edit.essential {
    background: #fffbe6;
    border: 1px solid #f59e0b;
}

Edit.highlight {
    box-shadow: 0 0 0 2px #93c5fd;
}
```

---

## 컴포넌트 visible / enable 제어

레이아웃 조작에서 가장 자주 쓰는 패턴은 `visible`과 `enable` 전환입니다.

```javascript
// 버튼 클릭 시 특정 영역 표시/숨기기
function btn_toggleDetail_onclick(obj, e) {
    var bCurrent = this.div_detail.visible;

    // visible: true이면 보이는 상태, false이면 숨긴 상태
    this.div_detail.set_visible(!bCurrent);

    // 버튼 텍스트도 함께 변경
    if (!bCurrent) {
        obj.set_text("상세 접기 ▲");
    } else {
        obj.set_text("상세 보기 ▼");
    }
}

// 권한에 따른 버튼 활성화/비활성화
function fn_setPermission(sRole) {
    if (sRole === "ADMIN") {
        // 관리자: 저장, 삭제 버튼 모두 활성화
        this.btn_save.set_enable(true);
        this.btn_delete.set_enable(true);
    } else {
        // 일반 사용자: 삭제 버튼 비활성화
        this.btn_save.set_enable(true);
        this.btn_delete.set_enable(false);
        // cssclass로 비활성 시각 힌트 추가
        this.btn_delete.set_cssclass("disabled_hint");
    }
}
```

---

## Div로 컴포넌트 그룹화하기

관련 컴포넌트를 `Div` 컴포넌트로 묶으면 그룹 단위로 `visible`과 `enable`을 제어할 수 있어 코드가 훨씬 간결해집니다.

```javascript
// Div 하나를 숨기면 그 안의 모든 컴포넌트가 함께 숨겨짐
function fn_hideSearchArea(obj, e) {
    // div_search 안에 있는 Label, Edit, Button 등이 모두 숨겨짐
    this.div_search.set_visible(false);

    // 그리드를 검색 영역만큼 위로 올림
    this.grd_list.set_top(40);
}

// Div 안의 특정 컴포넌트에 접근할 때는 점(.)으로 경로 지정
function fn_getDivChildValue(obj, e) {
    // div_search 안에 있는 edt_keyword Edit의 value를 읽음
    var sKeyword = this.div_search.edt_keyword.value;
    trace("검색어: " + sKeyword);
}
```

---

## 실무에서 자주 쓰는 레이아웃 패턴

### 상단 고정 검색 바 + 하단 그리드

```javascript
// Form_onload에서 초기 레이아웃 설정
function Form_onload(obj, e) {
    var nFormW  = this.width;   // Form 전체 너비
    var nFormH  = this.height;  // Form 전체 높이

    var nSearchH = 80;   // 검색 영역 높이
    var nBtnH    = 40;   // 버튼 영역 높이
    var nMargin  = 8;    // 여백

    // 검색 Div: 상단 고정
    this.div_search.set_left(nMargin);
    this.div_search.set_top(nMargin);
    this.div_search.set_width(nFormW - nMargin * 2);
    this.div_search.set_height(nSearchH);

    // 버튼 Div: 검색 Div 바로 아래
    this.div_btns.set_left(nMargin);
    this.div_btns.set_top(nMargin + nSearchH + nMargin);
    this.div_btns.set_right(nMargin);  // 우측 앵커
    this.div_btns.set_height(nBtnH);

    // 그리드: 나머지 영역 전체
    this.grd_list.set_left(nMargin);
    this.grd_list.set_top(nMargin + nSearchH + nMargin + nBtnH + nMargin);
    this.grd_list.set_right(nMargin);   // 좌우 앵커
    this.grd_list.set_bottom(nMargin);  // 상하 앵커
}
```

### 창 크기 변경 이벤트에서 재배치

```javascript
// Form_onsize: 창 크기가 변경될 때 자동 호출
function Form_onsize(obj, e) {
    // right/bottom 앵커를 사용하면 대부분 자동 처리되지만,
    // 복잡한 계산이 필요할 때는 직접 재배치
    fn_layoutComponents.call(this);
}

function fn_layoutComponents() {
    var nW = this.width;
    var nH = this.height;

    // 1/3 너비로 좌우 패널 분할
    this.div_left.set_width(Math.floor(nW / 3));
    this.div_right.set_left(Math.floor(nW / 3) + 4);
    this.div_right.set_width(nW - Math.floor(nW / 3) - 4);
}
```

---

## 정리

| 상황 | 추천 방법 |
|------|-----------|
| 고정 화면 | `left`, `top`, `width`, `height`만 지정 |
| 창 크기 변화에 대응 | `right` / `bottom` 앵커 추가 |
| 전체 앱 통일 스타일 | 테마 XCSS(`skin/` 폴더) 수정 |
| 특정 화면 전용 스타일 | Form 전용 XCSS 파일 작성 |
| 컴포넌트 개별 스타일 | `cssclass` 속성 + 클래스 선택자 |
| 동적 스타일 전환 | `set_cssclass()` 메서드 |
| 그룹 표시/숨김 | `Div`로 묶고 `set_visible()` |

넥사크로 N의 레이아웃은 웹 표준과 다르지만, 규칙을 이해하면 오히려 예측 가능하고 제어하기 쉽습니다.
`Div` 그룹화와 앵커 조합을 적극적으로 활용하면 유지보수가 편한 화면 구조를 만들 수 있습니다.

---

**지난 글:** [[Nexacro N] Dataset — 화면 데이터의 핵심 저장소](/posts/nexacro-n-dataset/)

**다음 글:** [[Nexacro N] 이벤트와 스크립트 작성법](/posts/nexacro-n-events-and-scripts/)

<br>
읽어주셔서 감사합니다. 😊
