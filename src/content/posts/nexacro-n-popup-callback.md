---
title: "[Nexacro N] 팝업 콜백 패턴"
description: "Nexacro N에서 팝업이 닫힐 때 Opener로 값을 돌려보내는 콜백 패턴—openPopup의 콜백 함수 인수, closePopup의 nReturn·returnValue 활용법, 그리고 Dataset 공유 방식까지 실무 예제로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 1
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "팝업콜백", "closePopup", "openPopup", "returnValue", "nReturn", "팝업패턴"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-popup-args/)에서 Opener가 팝업에 파라미터를 *전달*하는 방법을 살펴보았다. 이번 글은 그 반대 방향—팝업이 닫히면서 Opener에게 결과값을 *돌려보내는* **콜백 패턴**을 다룬다. 검색 팝업에서 선택한 항목을 메인 화면에 반영하거나, 입력 팝업에서 저장 결과를 확인하는 시나리오 모두 이 패턴에 해당한다.

## openPopup 콜백 함수 인수

`openPopup`의 세 번째 인수가 콜백 함수명이다.

```javascript
this.openPopup(
  "popup/ItemSearch",   // 팝업 URL (TypeDef 서비스 ID)
  0,                    // z-order (0=자동)
  "fn_callback",        // 팝업 종료 시 호출될 함수명(문자열)
  null,                 // 팝업 컴포넌트 ID (null=자동생성)
  false,                // 모달 여부 (false=모달리스)
  { key: sKey },        // extraData
  "600:450"             // 크기 "너비:높이"
);
```

콜백 함수명은 **문자열**로 전달한다. Nexacro 런타임이 팝업 종료 시 해당 이름의 함수를 Opener Form에서 찾아 실행한다.

## closePopup과 nReturn

팝업 측에서 `closePopup(nReturn)`을 호출하면 Opener의 콜백 함수가 실행된다.

| nReturn 값 | 의미 | 콜백 호출 여부 |
|:---:|---|:---:|
| `1` | 정상 확인(OK) | O |
| `0` | 취소 | O |
| `-1` | 강제 종료 | X (콜백 미호출) |

```javascript
// 팝업 확인 버튼
function btn_ok_onclick(obj, e) {
  this.fn_setResult();      // ds_result에 데이터 세팅
  this.closePopup(1);       // nReturn=1로 닫기
}

// 팝업 취소 버튼
function btn_cancel_onclick(obj, e) {
  this.closePopup(0);
}
```

![팝업 콜백 흐름](/assets/posts/nexacro-n-popup-callback-flow.svg)

## 콜백 함수 시그니처

Opener에서 콜백 함수는 다음 인수를 받는다.

```javascript
function fn_callback(objPopup, nReturn, sExt, oExt) {
  // objPopup: 팝업 Form 객체 (직접 접근 가능)
  // nReturn : closePopup에 전달한 값
  // sExt    : 추가 문자열 (closePopup 2번째 인수)
  // oExt    : 추가 객체   (closePopup 3번째 인수)

  if (nReturn == 1) {
    // 팝업의 Dataset에 직접 접근
    this.ds_master.copyData(objPopup.ds_result);
    this.grd_main.setFocus();
  }
}
```

`objPopup`은 팝업 Form 인스턴스 자체이므로, 팝업 안에 있는 Dataset·컴포넌트에 직접 접근할 수 있다. 별도의 전역 변수 없이 `objPopup.ds_result`처럼 참조하면 충분하다.

## Dataset으로 다중 값 반환

단순 스칼라 값 대신 Dataset을 반환할 때는 팝업 내 Dataset을 채운 뒤 `closePopup(1)`만 호출하면 된다. Opener의 콜백에서 `objPopup.ds_result`로 접근한다.

```javascript
// 팝업 측: ds_result에 선택 행 복사
function fn_confirm(obj, e) {
  var nRow = this.grd_list.currentrow;
  if (nRow < 0) {
    this.alert("선택된 항목이 없습니다.");
    return;
  }
  this.ds_result.clearData();
  this.ds_result.copyRow(0, this.ds_list, nRow);
  this.closePopup(1);
}
```

```javascript
// Opener 측: ds_result 수신
function fn_callback(objPopup, nReturn) {
  if (nReturn != 1) return;
  var ds = objPopup.ds_result;
  this.edt_code.value  = ds.getColumn(0, "itemCd");
  this.edt_name.value  = ds.getColumn(0, "itemNm");
}
```

![콜백 코드 패턴](/assets/posts/nexacro-n-popup-callback-code.svg)

## closePopup vs destroy

| 메서드 | 설명 |
|---|---|
| `closePopup(nReturn)` | 콜백 실행 + 팝업 제거 |
| `this.close()` | 팝업 닫기 (콜백 실행 여부는 설정에 따라 다름) |
| `this.destroy()` | 팝업 메모리 해제, 콜백 미호출 |

실무에서는 항상 `closePopup`을 사용한다. `destroy`는 의도치 않게 콜백을 건너뛰기 때문에, 팝업 스택이 꼬이는 문제가 생긴다.

## 주의 사항

- `objPopup`은 콜백 함수가 끝난 뒤 자동 해제된다. 콜백 내에서 데이터를 **즉시 복사**해야 한다.
- 팝업이 여러 개 열려 있을 때 각 팝업은 독립적인 콜백 함수를 갖는다. 같은 이름의 콜백 함수를 공유해도 되지만, 팝업 인스턴스가 다르므로 `objPopup`으로 구분할 수 있다.
- 취소(`nReturn=0`) 때도 콜백이 호출된다는 점을 잊지 말고 `if (nReturn == 1)` 분기를 반드시 작성한다.

---

**다음 글:** [[Nexacro N] 모달과 모달리스 팝업](/posts/nexacro-n-modal-modaless/)

<br>
읽어주셔서 감사합니다. 😊
