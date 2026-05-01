---
title: "[Nexacro N] Radio / CheckBox — 선택 컴포넌트 활용 가이드"
description: "Nexacro N Radio와 CheckBox 컴포넌트의 차이점, group/groupid, value/checkedvalue/uncheckedvalue, onchanged 이벤트, Dataset 바인딩, 동적 생성 패턴을 실무 중심으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 6
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "radio", "checkbox", "선택컴포넌트", "group", "onchanged", "바인딩"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-spin/)에서 숫자를 단계별로 입력하는 Spin 컴포넌트를 살펴봤습니다. 이번에는 사용자가 미리 정해진 항목 중에서 선택하는 두 컴포넌트인 **Radio**와 **CheckBox**를 다룹니다. 두 컴포넌트는 비슷해 보이지만 근본적인 선택 방식이 다릅니다. Radio는 그룹 내 하나만 선택, CheckBox는 독립적으로 다중 선택이 가능합니다. 이 차이를 정확히 이해해야 올바른 컴포넌트를 선택할 수 있습니다.

## Radio — 단일 선택 그룹

`Radio` 컴포넌트는 여러 항목 중 **하나만** 선택할 수 있는 UI를 제공합니다. 같은 그룹(`groupid`)에 속한 Radio 중 하나를 선택하면 나머지는 자동으로 해제됩니다.

```xml
<!-- Studio에서 Radio 그룹 선언 -->
<Radio id="radMale"   groupid="gender" value="M" text="남성" .../>
<Radio id="radFemale" groupid="gender" value="F" text="여성" .../>
```

`groupid`가 같은 Radio들은 하나의 그룹을 형성합니다. 중요한 것은 `value` 속성입니다. 이 값이 해당 Radio를 선택했을 때 반환되는 **코드 값**입니다. 단순히 선택 여부(0/1)가 아니라, 의미 있는 코드를 저장합니다.

![Radio / CheckBox — 선택 컴포넌트 비교](/assets/posts/nexacro-n-radio-checkbox-compare.svg)

## Radio 값 읽기

선택된 Radio의 값을 읽는 방법은 그룹 내 어느 Radio에서든 동일합니다.

```javascript
// 선택된 Radio의 value 읽기
function fn_getGender() {
    // 그룹 내 선택된 Radio의 value 반환
    return this.radMale.value; // radFemale에서 읽어도 동일
}

// 스크립트로 특정 값 선택
function fn_setGender(sGender) {
    // "M" 또는 "F"를 전달하면 해당 Radio 자동 선택
    this.radMale.set_value(sGender);
}
```

그룹 내 어느 Radio 객체를 통해 `value`를 읽어도 현재 선택된 값이 반환됩니다. `set_value()`로 그룹 전체에 값을 설정하면 해당하는 Radio가 자동으로 선택됩니다.

## Radio onchanged 이벤트

선택이 변경될 때 `onchanged`가 발생합니다. `obj.value`로 새로 선택된 값을 읽습니다.

```javascript
function radGender_onchanged(obj, e) {
    var sGender = obj.value; // "M" 또는 "F"
    if (sGender === "M") {
        // 남성 선택 시 군복무 기간 필드 활성화
        this.divMilitary.set_visible(true);
    } else {
        this.divMilitary.set_visible(false);
    }
}
```

한 그룹의 모든 Radio는 같은 `onchanged` 핸들러를 공유하도록 설정하는 것이 일반적입니다. Studio에서 각 Radio의 onchanged 이벤트를 같은 함수에 연결하면 됩니다.

## CheckBox — 독립적 다중 선택

`CheckBox`는 각각 독립적으로 선택/해제되며, 여러 항목을 동시에 선택할 수 있습니다.

```xml
<CheckBox id="chkDev"    text="개발" .../>
<CheckBox id="chkDesign" text="디자인" .../>
<CheckBox id="chkPlan"   text="기획" .../>
```

Radio와 달리 `groupid`가 없습니다. 각 CheckBox는 서로 영향을 주지 않습니다.

## CheckBox value, checkedvalue, uncheckedvalue

CheckBox의 `value`는 선택 상태에 따라 달라집니다.

| 속성 | 기본값 | 설명 |
|------|--------|------|
| `checkedvalue` | `1` | 선택된 상태의 value |
| `uncheckedvalue` | `0` | 해제된 상태의 value |

기본적으로 선택 시 `value = 1`, 미선택 시 `value = 0`입니다. DB의 Y/N 컬럼에 바인딩한다면 `checkedvalue="Y"`, `uncheckedvalue="N"`으로 변경합니다.

```xml
<CheckBox id="chkAgree"
          checkedvalue="Y"
          uncheckedvalue="N"
          text="이용약관 동의"/>
```

```javascript
// Y/N으로 값 읽기
var sAgree = this.chkAgree.value; // "Y" 또는 "N"
```

## CheckBox 상태 제어

```javascript
// 체크 상태로 설정
this.chkDev.set_value(this.chkDev.checkedvalue);

// 미체크 상태로 설정
this.chkDev.set_value(this.chkDev.uncheckedvalue);

// 현재 체크 여부 확인
var bChecked = (this.chkDev.value == this.chkDev.checkedvalue);
```

직접 `1`이나 `0`을 하드코딩하는 것보다 `checkedvalue`/`uncheckedvalue`를 참조하는 것이 더 안전합니다. 나중에 값이 바뀌어도 코드 수정이 최소화됩니다.

## 다중 CheckBox 값 수집 패턴

여러 CheckBox의 선택 상태를 한 번에 수집합니다.

```javascript
// 체크된 항목 코드를 쉼표 구분 문자열로 수집
function fn_getCheckedItems() {
    var aItems = [
        { obj: this.chkDev,    code: "DEV"    },
        { obj: this.chkDesign, code: "DESIGN" },
        { obj: this.chkPlan,   code: "PLAN"   }
    ];
    var aResult = [];
    for (var i = 0; i < aItems.length; i++) {
        if (aItems[i].obj.value == aItems[i].obj.checkedvalue) {
            aResult.push(aItems[i].code);
        }
    }
    return aResult.join(","); // "DEV,PLAN" 형식
}
```

![Radio / CheckBox — 값 읽기 패턴](/assets/posts/nexacro-n-radio-checkbox-code.svg)

## Dataset 바인딩

Radio와 CheckBox 모두 Dataset과 바인딩할 수 있습니다. 특히 CheckBox는 `Y`/`N`이나 `1`/`0` 컬럼과 자연스럽게 바인딩됩니다.

```xml
<CheckBox id="chkActive"
          binddataset="dsMain"
          bindcolumn="IS_ACTIVE"
          checkedvalue="Y"
          uncheckedvalue="N"/>
```

Dataset의 행이 바뀌면 CheckBox 상태가 자동으로 갱신됩니다. 저장 시에는 Dataset의 값을 서버로 전송하면 됩니다.

## 전체 선택/해제 패턴

테이블 상단의 "전체 선택" 체크박스와 개별 항목 체크박스를 연동하는 패턴입니다.

```javascript
// 전체 선택/해제 핸들러
function chkAll_onchanged(obj, e) {
    var bChecked = (obj.value == obj.checkedvalue);
    var arrChecks = [this.chkDev, this.chkDesign, this.chkPlan];
    for (var i = 0; i < arrChecks.length; i++) {
        arrChecks[i].set_value(
            bChecked
                ? arrChecks[i].checkedvalue
                : arrChecks[i].uncheckedvalue
        );
    }
}

// 개별 항목 변경 시 전체 선택 체크박스 상태 갱신
function fn_updateChkAll() {
    var bAll = (
        this.chkDev.value    == this.chkDev.checkedvalue &&
        this.chkDesign.value == this.chkDesign.checkedvalue &&
        this.chkPlan.value   == this.chkPlan.checkedvalue
    );
    this.chkAll.set_value(
        bAll ? this.chkAll.checkedvalue : this.chkAll.uncheckedvalue
    );
}
```

## Radio vs CheckBox 선택 기준

| 상황 | 선택할 컴포넌트 |
|------|---------------|
| 성별, 상태코드 등 **하나만** 선택 | Radio |
| 권한, 관심사 등 **복수** 선택 | CheckBox |
| DB 컬럼이 단일 코드 | Radio |
| DB 컬럼이 Y/N 또는 비트 플래그 | CheckBox |
| UI 공간이 좁을 때 (모바일) | Combo 대체 고려 |

---

**지난 글:** [Spin — 숫자 증감 컴포넌트 완전 정복](/posts/nexacro-n-spin/)

**다음 글:** [Combo — 드롭다운 목록의 구조와 데이터 바인딩](/posts/nexacro-n-combo/)

<br>
읽어주셔서 감사합니다. 😊
