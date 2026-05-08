---
title: "[Nexacro N] Grid 클립보드 복사·붙여넣기"
description: "Nexacro N Grid에서 copytype 속성과 copyToClipboard / pasteFromClipboard API로 엑셀 스타일 클립보드 기능을 구현하고, onpaste 이벤트로 붙여넣기 후 유효성 검사를 연결하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 5
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "grid", "clipboard", "copytype", "onpaste", "복사", "붙여넣기"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-grid-excel-shortcuts/)에서 Grid 엑셀 단축키 설정 방법을 다뤘습니다. 엑셀과 유사한 입력 경험에서 클립보드 기능은 빼놓을 수 없습니다. 이번 글에서는 Grid의 **복사·붙여넣기 메커니즘**, `copytype` 설정, 그리고 붙여넣기 이벤트 처리까지 정리합니다.

## Grid 클립보드의 동작 원리

Nexacro N Grid는 내부적으로 TSV(Tab-Separated Values) 형식으로 클립보드 데이터를 관리합니다. 사용자가 Ctrl+C를 누르면 선택된 셀 데이터가 탭과 줄바꿈으로 구분된 문자열로 클립보드에 복사되고, Ctrl+V를 누르면 클립보드의 TSV 문자열을 파싱해 Grid에 입력합니다.

이 구조 덕분에 Grid에서 복사한 데이터를 엑셀에 그대로 붙여넣거나, 엑셀에서 복사한 데이터를 Grid에 붙여넣는 것이 기본적으로 동작합니다.

![Grid 클립보드 복사·붙여넣기 흐름](/assets/posts/nexacro-n-grid-clipboard-flow.svg)

## copytype 속성

`copytype`은 Ctrl+C를 눌렀을 때 어느 범위를 복사할지 결정합니다.

```xml
<Grid id="grd" copytype="selected" ... />
```

| 값 | 설명 |
|---|---|
| `"selected"` | 선택된 셀만 복사 (기본값) |
| `"row"` | 현재 포커스 행 전체 |
| `"all"` | Grid의 모든 데이터 행 |

실무에서는 `"selected"`가 가장 범용적입니다. 사용자가 Shift+클릭이나 Ctrl+클릭으로 범위를 선택한 뒤 복사하면 선택 영역만 클립보드에 들어갑니다.

런타임에도 변경 가능합니다.

```javascript
grd.set_copytype("all"); // 전체 복사 모드로 전환
```

## 헤더 포함 복사

기본 Ctrl+C는 데이터 행만 복사합니다. 헤더(컬럼명)를 첫 행으로 포함하려면 스크립트로 직접 TSV를 구성합니다.

```javascript
function fn_copyWithHeader() {
    var aCols = ["이름", "수량", "단가", "금액"];
    var sTsv  = aCols.join("\t") + "\n";

    for (var r = 0; r < ds.rowcount; r++) {
        var sName  = ds.getColumn(r, "NAME");
        var nQty   = ds.getColumn(r, "QTY");
        var nPrice = ds.getColumn(r, "PRICE");
        var nAmt   = ds.getColumn(r, "AMT");
        sTsv += [sName, nQty, nPrice, nAmt].join("\t") + "\n";
    }

    // 클립보드 API (브라우저 지원 필요)
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(sTsv);
        alert("클립보드에 복사되었습니다.");
    }
}
```

![Grid 클립보드 API 활용 코드](/assets/posts/nexacro-n-grid-clipboard-code.svg)

## copyToClipboard / pasteFromClipboard

스크립트에서 복사/붙여넣기를 명시적으로 실행하려면 Grid의 메서드를 사용합니다.

```javascript
// Grid 복사 (copytype 설정 기준)
grd.copyToClipboard();

// Grid 붙여넣기 (현재 포커스 위치부터)
grd.pasteFromClipboard();
```

버튼에 복사/붙여넣기 기능을 달 때 활용합니다. Ctrl+C/V 단축키를 허용하고 싶지 않은 보안 화면에서도 버튼만으로 클립보드를 제어할 수 있습니다.

## onpaste 이벤트 — 붙여넣기 후 처리

Ctrl+V 또는 `pasteFromClipboard()` 호출 직후 `onpaste` 이벤트가 발생합니다. 붙여넣기가 반영된 행 범위는 `e.startrow`와 `e.endrow`로 알 수 있습니다.

```javascript
function grd_onpaste(obj, e) {
    var nFrom = e.startrow;
    var nTo   = e.endrow;

    for (var r = nFrom; r <= nTo; r++) {
        var sName = ds.getColumn(r, "NAME");
        var nQty  = parseInt(ds.getColumn(r, "QTY") || "0");

        if (!sName) {
            alert((r + 1) + "행: 이름이 비어 있습니다.");
            ds.deleteRow(r); // 잘못된 행 즉시 제거
            break;
        }
        if (nQty < 1) {
            ds.setColumn(r, "QTY", "1"); // 기본값 강제 입력
        }
    }
}
```

붙여넣기를 완전히 막으려면 이벤트에서 `e.cancel = true`를 반환합니다.

```javascript
function grd_onpaste(obj, e) {
    if (bReadOnly) {
        e.cancel = true; // 읽기 전용 상태면 붙여넣기 차단
    }
}
```

## 엑셀 → Grid 붙여넣기 시 주의사항

엑셀에서 복사한 데이터를 Grid에 붙여넣을 때 몇 가지 유의할 점이 있습니다.

**컬럼 순서 일치 필요**: 엑셀 컬럼 순서와 Grid 컬럼 순서가 다르면 데이터가 엉뚱한 열에 들어갑니다. 붙여넣기용 Grid 컬럼 순서를 엑셀 서식과 맞춰 두거나, 붙여넣기 전 안내 문구를 표시합니다.

**날짜 형식 차이**: 엑셀의 날짜 셀이 복사되면 시리얼 번호가 아닌 표시 형식 문자열로 클립보드에 들어갑니다. Grid의 날짜 컬럼이 `"yyyyMMdd"` 형식을 기대한다면 `onpaste`에서 형식을 변환해야 합니다.

```javascript
function fn_normDate(sDate) {
    // "2026-05-06" → "20260506"
    return sDate.replace(/-/g, "");
}
```

**빈 행/열 처리**: 엑셀에서 빈 행이 포함된 범위를 복사하면 그 빈 행도 Dataset에 추가됩니다. `onpaste`에서 빈 행을 탐지해 제거합니다.

```javascript
function grd_onpaste(obj, e) {
    for (var r = e.endrow; r >= e.startrow; r--) {
        var sKey = ds.getColumn(r, "KEY_CD");
        if (!sKey || sKey.trim() == "") {
            ds.deleteRow(r); // 역순 삭제로 인덱스 오류 방지
        }
    }
}
```

## 복사 금지 컬럼 설정

특정 컬럼(예: 자동 채번 키, 내부 코드)은 복사·붙여넣기에서 제외하고 싶을 때는 `oncopy` 이벤트나 스크립트로 해당 열 값을 비웁니다. 또는 `edittype="none"`으로 설정된 열은 기본적으로 붙여넣기 대상에서 제외됩니다.

## 클립보드 보안 정책

브라우저의 Clipboard API는 HTTPS 환경이나 사용자 제스처(클릭) 없이는 클립보드에 쓸 수 없습니다. 개발 환경(HTTP)에서 `navigator.clipboard.writeText()`가 오류를 내면 브라우저 정책 때문입니다. 이 경우 `document.execCommand("copy")` 폴백을 사용하거나, Nexacro N이 내부적으로 제공하는 `copyToClipboard()` 메서드를 활용합니다.

---

**지난 글:** [Grid 엑셀 단축키 설정](/posts/nexacro-n-grid-excel-shortcuts/)

**다음 글:** [Grid 대용량 데이터 처리](/posts/nexacro-n-grid-large-dataset/)

<br>
읽어주셔서 감사합니다. 😊
