---
title: "[Nexacro N] 화면 책임 설계"
description: "Nexacro N 화면 개발에서 각 컴포넌트가 가져야 할 책임 범위를 정의하는 방법을 설명합니다. 화면-제어-데이터 분리 원칙, 폼 간 통신 규칙, 책임 경계 설정 기준을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 1
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "화면책임", "설계", "아키텍처", "책임분리", "MVP", "클린코드"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-base-form-architecture/)에서 베이스 폼을 활용한 전체 아키텍처 구조를 살펴보았다. 이번에는 그 구조 위에서 개별 화면이 어떤 책임을 가져야 하는지, 즉 **화면 책임 설계(Screen Responsibility Design)** 원칙을 구체적으로 살펴본다.

규모가 커질수록 "이 로직이 View에 있어야 하나, Controller에 있어야 하나"라는 고민이 반복된다. 이 물음에 대한 명확한 기준이 없으면 화면마다 코드 스타일이 달라지고, 유지보수는 점점 어려워진다.

## 세 가지 책임 계층

Nexacro N 화면 개발은 크게 세 가지 책임 계층으로 나눌 수 있다.

![화면 책임 분리 계층](/assets/posts/nexacro-n-screen-responsibility-layers.svg)

**View Layer(화면 레이어)** 는 컴포넌트를 배치하고, 사용자 이벤트를 수신하며, 화면 상태를 갱신하는 역할만 담당한다. 서비스 URL을 알아서는 안 되고, 데이터 변환 로직이 있어서도 안 된다.

**Controller Layer(제어 레이어)** 는 입력 검증, 비즈니스 로직, 트랜잭션 호출을 책임진다. View에서 전달받은 요청을 처리하고 결과를 다시 View에 전달한다.

**Data Layer(데이터 레이어)** 는 Dataset 관리와 서버 통신, 응답 상태 추적을 담당한다. 화면 표시와 관련된 결정을 내려서는 안 된다.

## View 책임 범위 정의

View에서 허용되는 작업과 금지되는 작업을 명확히 구분해야 한다.

**View에서 해야 할 일**
- 버튼 클릭 이벤트에서 Controller 함수 호출
- 입력 필드 포커스·스타일 변경
- 로딩 인디케이터 표시/숨김
- 결과 Dataset을 Grid에 바인딩

**View에서 하면 안 되는 일**
- `this.transaction()` 직접 호출
- URL 문자열 하드코딩
- Dataset 컬럼 값 직접 조작
- 복잡한 날짜·숫자 변환 로직

```javascript
// View — 버튼 이벤트는 위임만 한다
function btn_search_onclick(obj, e) {
    this.pCtrl.fn_search();
}

function btn_save_onclick(obj, e) {
    this.pCtrl.fn_save();
}

// View — 결과 표시만 담당
function fn_updateGridVisible(bShow) {
    grd_result.set_visible(bShow);
}
```

## Controller 책임 범위 정의

Controller는 화면의 "두뇌" 역할이다. View와 Data 사이에서 흐름을 조율한다.

```javascript
// Controller — 실제 로직을 여기서 처리
function fn_search() {
    if (!fn_validate()) return;

    dsSearch.clearData();
    dsSearch.addRow();
    dsSearch.setColumn(0, "searchCond", edt_searchCond.value);

    this.transaction(
        "search",
        "/api/user/search",
        "dsInput=dsSearch",
        "dsOut=dsResult",
        "",
        "fn_searchCb"
    );
}

function fn_searchCb(svcId, errCode, errMsg) {
    if (errCode != 0) {
        gfn_alert(errMsg);
        return;
    }
    // View에 결과 전달
    this.fn_updateGridVisible(dsResult.rowcount > 0);
}
```

## 폼 간 통신 규칙

복수의 폼이 협력할 때는 직접 참조 대신 이벤트나 공유 Dataset을 통해 통신한다.

| 방식 | 설명 | 적합한 상황 |
|------|------|------------|
| 공유 Dataset | 두 폼이 같은 Dataset을 바인딩 | 마스터-디테일 구조 |
| opener 참조 | 팝업에서 부모 폼 함수 호출 | 팝업 콜백 |
| 이벤트 발행 | dispatchEvent로 상위 전달 | 느슨한 결합 필요 시 |

```javascript
// 팝업에서 부모 폼 함수 호출
function fn_confirm() {
    var oOpener = this.getOpenerObject();
    if (oOpener) {
        oOpener.fn_popupCallback(dsSelected);
    }
    this.close();
}
```

## 책임 분리 코드 비교

책임이 혼재된 코드와 분리된 코드를 직접 비교해 보면 차이가 명확하게 드러난다.

![책임 분리 코드 패턴](/assets/posts/nexacro-n-screen-responsibility-code.svg)

안티패턴에서는 View가 서비스 URL과 Dataset 조작 로직을 모두 알고 있다. 권장 패턴에서는 View가 Controller에 "저장을 요청"하고, 나머지는 Controller가 처리한다. URL이 바뀌거나 저장 로직이 변경되더라도 View 코드는 건드릴 필요가 없다.

## 실무 적용 기준

책임을 잘 분리하기 위한 간단한 체크리스트다.

1. 이 코드를 이 파일이 아닌 곳으로 옮겼을 때 화면이 그대로 동작하는가?
2. 서비스 URL이 바뀌었을 때 수정해야 하는 파일이 하나뿐인가?
3. 같은 비즈니스 로직을 다른 화면에서도 쓸 수 있는가?

이 세 가지 질문에 "예"라고 답할 수 있다면 책임 분리가 잘 된 코드다.

---

**지난 글:** [베이스 폼 아키텍처 설계](/posts/nexacro-n-base-form-architecture/)

**다음 글:** [에러 전략](/posts/nexacro-n-error-strategy/)

<br>
읽어주셔서 감사합니다. 😊
