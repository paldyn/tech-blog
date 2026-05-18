---
title: "[Nexacro N] 컴포넌트 텍스트 매핑"
description: "Nexacro N에서 컴포넌트의 text 속성에 언어 리소스 ID를 매핑하는 방법을 설명합니다. $접두사 바인딩, nexacro.getLanguageText() API, 런타임 동적 텍스트 설정, 그리드 헤더 다국어 처리 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 4
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "i18n", "텍스트매핑", "getLanguageText", "다국어", "컴포넌트", "그리드"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-i18n/)에서 Nexacro N 다국어 처리의 전체 구조를 살펴보았다. 이번에는 실제 컴포넌트에 텍스트 ID를 매핑하고 스크립트에서 언어 리소스를 조회하는 구체적인 패턴을 다룬다. 화면 설계 단계부터 텍스트 ID를 일관되게 사용하면 추후 언어 추가·변경 비용이 크게 줄어든다.

## $접두사 바인딩

Nexacro N의 컴포넌트 `text` 속성에 `$`로 시작하는 값을 쓰면, 런타임에 현재 언어의 해당 ID 텍스트로 자동 치환된다. 이것이 가장 기본적인 텍스트 매핑 방법이다.

```xml
<!-- Form XFDL - $접두사로 텍스트 ID 지정 -->
<Button  id="btn_save"   text="$SAVE"       width="80" height="30"/>
<Button  id="btn_search" text="$SEARCH"     width="80" height="30"/>
<Button  id="btn_delete" text="$DELETE"     width="80" height="30"/>
<Static  id="lbl_name"   text="$LBL_USER_NM"/>
<Static  id="lbl_dept"   text="$LBL_DEPT_NM"/>
```

언어가 `ko`이면 `$SAVE` → "저장", `en`이면 → "Save"로 표시된다. 개발자가 언어 전환 코드를 별도로 작성할 필요가 없다.

![컴포넌트 텍스트 매핑 구조](/assets/posts/nexacro-n-component-text-mapping-structure.svg)

## 텍스트 ID 명명 규칙

일관된 텍스트 ID 규칙을 세우지 않으면 ID가 중복되거나 용도를 알 수 없어진다. 다음 패턴을 권장한다.

| 접두사 | 용도 | 예시 |
|--------|------|------|
| (없음) | 동사형 버튼 | `SAVE`, `SEARCH`, `DELETE` |
| `LBL_` | 레이블 | `LBL_USER_NM`, `LBL_DEPT` |
| `COL_` | 그리드 컬럼 헤더 | `COL_USER_ID`, `COL_REG_DT` |
| `TAB_` | 탭 제목 | `TAB_BASIC`, `TAB_DETAIL` |
| `MSG_` | 메시지 | `MSG_SAVE_OK`, `MSG_CONFIRM_DEL` |
| `ERR_` | 오류 메시지 | `ERR_REQUIRED`, `ERR_FORMAT` |
| `TIT_` | 팝업/폼 제목 | `TIT_USER_DETAIL` |

## nexacro.getLanguageText() 활용

스크립트에서 언어 텍스트를 조회할 때는 `nexacro.getLanguageText()` API를 사용한다. 프로젝트 공통 함수로 래핑해두면 나중에 fallback 로직을 추가하기 쉽다.

```javascript
// CommonLib/i18n.xjs
function gfn_getText(sTextId) {
  var sText = nexacro.getLanguageText(sTextId);
  // 리소스에 없으면 ID를 그대로 반환 (개발 시 누락 확인 용)
  return (sText !== undefined && sText !== null) ? sText : "[" + sTextId + "]";
}
```

![텍스트 ID 활용 패턴](/assets/posts/nexacro-n-component-text-mapping-code.svg)

## 동적 텍스트 설정

버튼 텍스트가 상태에 따라 바뀌는 경우, `set_text()`와 `gfn_getText()`를 조합한다.

```javascript
// 신규/수정 모드에 따라 버튼 텍스트 변경
function fn_setMode(bNewMode) {
  if (bNewMode) {
    this.btn_action.set_text(gfn_getText("NEW"));
    this.lbl_title.set_text(gfn_getText("TIT_NEW_USER"));
  } else {
    this.btn_action.set_text(gfn_getText("EDIT"));
    this.lbl_title.set_text(gfn_getText("TIT_EDIT_USER"));
  }
}
```

## 그리드 컬럼 헤더 매핑

그리드 헤더는 두 가지 방법으로 텍스트 ID를 연결할 수 있다.

### Format XML에서 직접 지정

```xml
<!-- Grid Format XML -->
<Row size="24" band="head">
  <Cell col="0" text="$COL_USER_ID"/>
  <Cell col="1" text="$COL_USER_NM"/>
  <Cell col="2" text="$COL_DEPT_NM"/>
  <Cell col="3" text="$COL_REG_DT"/>
</Row>
```

### 스크립트로 동적 설정

언어 전환 후 그리드 헤더를 갱신해야 할 때 유용하다.

```javascript
function fn_setGridHeader(grid) {
  grid.setColProperty(0, "header.text", gfn_getText("COL_USER_ID"));
  grid.setColProperty(1, "header.text", gfn_getText("COL_USER_NM"));
  grid.setColProperty(2, "header.text", gfn_getText("COL_DEPT_NM"));
  grid.setColProperty(3, "header.text", gfn_getText("COL_REG_DT"));
}
```

## Combo 코드값 다국어 처리

Combo 컴포넌트의 표시 값도 언어에 맞게 설정해야 한다. 서버에서 언어별 코드값을 반환하거나, 클라이언트에서 텍스트 ID로 변환한다.

```javascript
// 클라이언트에서 언어별 코드 Dataset 구성
function fn_buildGenderDataset() {
  var ds = this.ds_gender;
  ds.clearData();

  var codes = [
    { cd: "M", textId: "CD_MALE"   },
    { cd: "F", textId: "CD_FEMALE" }
  ];

  for (var i = 0; i < codes.length; i++) {
    var r = ds.addRow();
    ds.setColumn(r, "CD",   codes[i].cd);
    ds.setColumn(r, "CDNM", gfn_getText(codes[i].textId));
  }
}
```

언어 전환 이벤트에서 이 함수를 다시 호출하면 Combo 표시 값이 즉시 갱신된다.

## Tab 컴포넌트 텍스트 매핑

TabControl의 탭 제목도 동일하게 `$접두사`를 사용하거나 스크립트로 설정한다.

```xml
<Tab id="tab1" text="$TAB_BASIC"/>
<Tab id="tab2" text="$TAB_DETAIL"/>
<Tab id="tab3" text="$TAB_HISTORY"/>
```

## alert/confirm 메시지 매핑

사용자에게 보여주는 대화상자 메시지도 텍스트 ID를 통해 다국어를 지원한다.

```javascript
function fn_delete() {
  var bConfirm = this.gfn_confirm(gfn_getText("MSG_CONFIRM_DEL"));
  if (!bConfirm) return;

  this.transaction(
    "deleteData",
    "svc://UserService/delete",
    "ds_input=ds_input",
    "",
    "",
    "fn_deleteCallback"
  );
}

function fn_deleteCallback(sId, nErrCode, sErrMsg) {
  if (nErrCode == 0) {
    this.gfn_alert(gfn_getText("MSG_DEL_OK"));
  } else {
    this.gfn_alert(gfn_getText("ERR_SERVER") + " : " + sErrMsg);
  }
}
```

## 누락 ID 검출

개발 중 리소스 파일에 ID가 빠진 경우를 빠르게 발견하려면, `gfn_getText()` 반환값이 `[ID명]` 형식으로 나오도록 fallback을 설정해둔다. 화면에서 `[MSG_SAVE_OK]` 같은 문자열이 보이면 즉시 리소스 파일에 추가한다.

컴포넌트 텍스트 매핑은 처음에 규칙을 잘 잡아두면 언어 추가 시 XML 파일 하나만 작성하면 전체 화면이 자동으로 처리된다. `$접두사` 방식과 `gfn_getText()` 패턴을 일관되게 적용하는 것이 핵심이다.

---

**지난 글:** [다국어(i18n) 개요](/posts/nexacro-n-i18n/)

**다음 글:** [언어 전환](/posts/nexacro-n-language-switching/)

<br>
읽어주셔서 감사합니다. 😊
