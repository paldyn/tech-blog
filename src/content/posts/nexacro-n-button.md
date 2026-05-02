---
title: "[Nexacro N] Button — 버튼 컴포넌트 완전 정복"
description: "Nexacro N Button·ImageButton·CheckButton·RadioButton 컴포넌트의 속성, onclick 이벤트 처리, 중복 클릭 방지, enable/visible 제어, taborder 설정 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 4
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "button", "imagebutton", "checkbutton", "onclick", "enable", "중복클릭방지"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-plot-charts/)에서 Plot 컴포넌트로 차트를 구성하는 방법을 살펴봤습니다. 이번에는 사용자 인터랙션의 출발점인 `Button` 계열 컴포넌트를 다룹니다. 단순해 보이지만 실무에서 올바르게 다루려면 생각보다 알아야 할 것이 많습니다.

## Button 컴포넌트 종류

Nexacro N에는 네 가지 버튼 컴포넌트가 있습니다.

| 컴포넌트 | 용도 |
|---|---|
| `Button` | 일반 동작 버튼 (조회·저장·취소) |
| `ImageButton` | 아이콘과 텍스트를 조합하는 버튼 |
| `CheckButton` | 토글 형태의 체크 버튼 |
| `RadioButton` | 그룹 중 하나만 선택하는 라디오 버튼 |

![Button 컴포넌트 타입](/assets/posts/nexacro-n-button-types.svg)

## Button 기본 속성

```xml
<Button id="btn_search"
  left="20" top="20" width="80" height="28"
  text="조회"
  enable="true"
  visible="true"
  taborder="10"/>
```

| 속성 | 설명 |
|---|---|
| `text` | 버튼에 표시되는 텍스트 |
| `enable` | false면 클릭 불가, 시각적으로 비활성화 |
| `visible` | false면 화면에서 숨김 |
| `taborder` | 탭 키 이동 순서 |
| `access` | `"tabstop"`이면 탭 포커스 정지 |

## onclick 이벤트 처리

가장 기본적인 버튼 이벤트는 `onclick`입니다. Studio에서 버튼을 더블클릭하거나 이벤트 탭에서 직접 연결합니다.

```javascript
function btn_search_onclick(obj, e) {
  this.fn_search();
}
```

`this`는 현재 Form 인스턴스를 가리킵니다. 같은 Form 내의 다른 함수를 호출하거나, Dataset·컴포넌트에 접근할 때 `this`를 사용합니다.

## 중복 클릭 방지 패턴

트랜잭션 호출 중에 다시 버튼을 누르면 서버에 같은 요청이 중복으로 전송됩니다. 특히 저장·전송 버튼에서 이 문제가 자주 발생합니다. 처리 중에는 버튼을 비활성화했다가 완료 후 복원하는 패턴이 표준입니다.

```javascript
function btn_save_onclick(obj, e) {
  this.btn_save.set_enable(false);
  this.btn_save.set_text("저장 중...");
  this.transaction(
    "save", "SVC:saveData",
    "in:ds_input", "",
    "", "fn_saveCallback"
  );
}

function fn_saveCallback(sId, nEC, sEM) {
  this.btn_save.set_enable(true);
  this.btn_save.set_text("저장");
  if (nEC == 0) {
    alert("저장이 완료되었습니다.");
  }
}
```

![Button 이벤트 처리 패턴](/assets/posts/nexacro-n-button-events.svg)

## ImageButton — 아이콘 + 텍스트

`ImageButton`은 `imageInfo` 속성에 상태별 이미지를 등록해 아이콘이 있는 버튼을 만듭니다.

```xml
<ImageButton id="ibtn_add"
  left="20" top="20" width="100" height="28"
  text="추가"
  imageInfo="images/btn_add.png"
  imagealign="left"/>
```

`imagealign`으로 아이콘 위치를 `left`, `right`, `top`, `bottom`으로 지정합니다. 아이콘만 표시하려면 `text`를 비우면 됩니다.

### 상태별 이미지

`imageInfo`에 세미콜론으로 normal, hover, press, disable 순서로 이미지를 지정합니다.

```xml
imageInfo="img/btn_n.png;img/btn_h.png;img/btn_p.png;img/btn_d.png"
```

세 번째 이미지부터는 생략 가능합니다. 생략하면 첫 번째 이미지를 그대로 사용합니다.

## CheckButton — 토글 버튼

`CheckButton`은 누를 때마다 선택/해제 상태가 전환됩니다. `value` 속성으로 현재 상태를 확인하고, `onitemchanged` 이벤트로 변화를 감지합니다.

```javascript
function chk_allSelect_onitemchanged(obj, e) {
  var checked = (e.postvalue == "1");
  // 체크 여부에 따른 처리
  this.fn_toggleAll(checked);
}
```

`value`가 `"1"`이면 선택 상태, `"0"`이면 해제 상태입니다.

## RadioButton — 그룹 선택

`RadioButton`은 같은 `groupname`을 가진 버튼 중 하나만 선택됩니다.

```xml
<RadioButton id="rdo_gender_m" groupname="gender"
  text="남" value="M"/>
<RadioButton id="rdo_gender_f" groupname="gender"
  text="여" value="F"/>
```

선택된 값을 읽을 때는 그룹 내 버튼을 순회하거나 `getCheckValue()` 메서드를 사용합니다.

```javascript
function fn_getGender() {
  // 선택된 RadioButton의 value 읽기
  if (this.rdo_gender_m.value == "1") return "M";
  if (this.rdo_gender_f.value == "1") return "F";
  return "";
}
```

## 버튼 활성화 제어 패턴

권한에 따라 버튼을 보이거나 숨기는 패턴입니다.

```javascript
function fn_setButtonAuth(auth) {
  var canWrite = (auth == "W");
  this.btn_save.set_visible(canWrite);
  this.btn_delete.set_visible(canWrite);
  this.btn_search.set_enable(true);  // 조회는 항상 활성
}
```

`visible`은 버튼 자체를 숨기고, `enable`은 보이지만 클릭 불가 상태입니다. 보안상 민감한 기능이라면 `visible=false`가 더 안전합니다.

## 정리

`Button`은 단순해 보이지만 중복 클릭 방지, 처리 중 상태 표시, 권한별 활성화 제어까지 다양한 패턴이 실무에서 필요합니다. 트랜잭션 전후 `set_enable()` 제어를 습관화하면 사용자 경험과 데이터 무결성을 동시에 지킬 수 있습니다.

---

**지난 글:** [Nexacro N Plot — 차트 컴포넌트 완전 정복](/posts/nexacro-n-plot-charts/)

**다음 글:** [Nexacro N TabControl — 탭 컨테이너 완전 정복](/posts/nexacro-n-tab-control/)

<br>
읽어주셔서 감사합니다. 😊
