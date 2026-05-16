---
title: "[Nexacro N] 엑셀 내보내기·가져오기"
description: "Nexacro N에서 Grid와 Dataset의 데이터를 엑셀로 내보내는 exportExcel 패턴, 엑셀 파일을 업로드해 Dataset으로 가져오는 Import 패턴, 서버 파싱 연동 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 8
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "엑셀내보내기", "엑셀가져오기", "exportExcel", "ExcelExportObject"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-file-server-side/)에서 파일 업로드의 서버 측 처리 방법을 살펴보았다. 업무 시스템에서 엑셀은 거의 필수 기능이다. 조회 결과를 엑셀로 저장하거나, 엑셀 양식에 입력한 데이터를 시스템으로 업로드하는 요구는 어느 프로젝트에나 있다. Nexacro N은 이 두 방향 모두를 지원한다.

## 엑셀 내보내기 기본

Nexacro N에서 엑셀 내보내기는 `ExcelExportObject`를 생성하고 `nexacro.exportObject()`를 호출하는 방식이다.

```javascript
function fn_exportExcel() {
    var oExcel = new ExcelExportObject();
    oExcel.addObject("Sheet1", this.grdMain);
    oExcel.fileName = "매출현황_" + gfn_getToday() + ".xlsx";
    nexacro.exportObject(oExcel);
}
```

`addObject(시트명, 대상객체)` 메서드에 Grid 또는 Dataset을 전달한다. Grid를 사용하면 컬럼 헤더가 자동으로 포함되고, 셀 너비도 Grid 컬럼 너비를 따른다.

![엑셀 내보내기·가져오기 흐름](/assets/posts/nexacro-n-excel-export-import-flow.svg)

## Grid vs Dataset 내보내기 차이

| 구분 | Grid 내보내기 | Dataset 내보내기 |
|------|--------------|-----------------|
| 헤더 | Grid 컬럼 헤더 자동 포함 | Dataset 컬럼명(영문) |
| 숨김 컬럼 | 제외 가능 | 모든 컬럼 포함 |
| 서식 | Grid 셀 서식 반영 | 기본 서식 |
| 사용 목적 | 화면 출력용 엑셀 | 데이터 원본 저장 |

Grid 내보내기가 일반적으로 사용자에게 더 친화적인 엑셀을 만들어 준다. 한글 헤더와 화면 표시 형식이 그대로 반영되기 때문이다.

![엑셀 내보내기 코드](/assets/posts/nexacro-n-excel-export-import-code.svg)

## 다중 시트 내보내기

한 파일에 여러 시트를 생성할 수 있다.

```javascript
function fn_exportMultiSheet() {
    var oExcel = new ExcelExportObject();
    oExcel.addObject("매출현황",  this.grdSales);
    oExcel.addObject("재고현황",  this.grdStock);
    oExcel.addObject("원본데이터", this.dsRaw);
    oExcel.fileName = "종합보고서_" + gfn_getToday() + ".xlsx";
    nexacro.exportObject(oExcel);
}
```

`addObject()`를 여러 번 호출하면 시트 순서대로 추가된다.

## 내보내기 옵션

`ExcelExportObject`에는 몇 가지 옵션 속성이 있다.

```javascript
var oExcel = new ExcelExportObject();
oExcel.addObject("Sheet1", this.grdMain);
oExcel.fileName       = "export.xlsx";
oExcel.exporttype     = "xls";     // xls 또는 xlsx (기본 xlsx)
oExcel.headerdisplay  = true;      // 헤더 표시 여부
nexacro.exportObject(oExcel);
```

`headerdisplay = false`로 헤더 행 없이 데이터만 내보낼 수도 있다.

## 엑셀 가져오기 패턴

엑셀 파일을 시스템으로 가져오는 Import는 두 단계로 진행된다. 먼저 `FileUpload`로 `.xlsx` 파일을 서버에 전송하고, 서버에서 파싱한 결과를 Dataset으로 받는다.

```javascript
// 1단계: 엑셀 파일 업로드
function btn_import_onclick(obj, e) {
    if (this.fileUpload.getFileCount() == 0) {
        this.gfn_alert("가져올 엑셀 파일을 선택해 주세요.");
        return;
    }
    this.fileUpload.uploadURL = "/excel/parse";
    this.fileUpload.upload();
}

// 2단계: 파싱 결과 Dataset 로드
function fileUpload_onuploadcompleted(obj, e) {
    if (e.errcode != 0) {
        this.gfn_alert("파일 처리 실패: " + e.errmsg);
        return;
    }
    // 서버가 Nexacro Dataset XML 형식으로 응답
    this.dsImport.loadXML(e.responsedata);
    this.gfn_alert(this.dsImport.rowcount + "건을 가져왔습니다.");
}
```

## 서버 엑셀 파싱 (Spring Boot + POI)

서버에서 Apache POI로 엑셀을 파싱해 Nexacro Dataset XML 형식으로 응답한다.

```java
@PostMapping("/excel/parse")
public ResponseEntity<String> parseExcel(
        @RequestParam("file") MultipartFile file) throws Exception {

    Workbook wb    = WorkbookFactory.create(file.getInputStream());
    Sheet    sheet = wb.getSheetAt(0);

    StringBuilder sb = new StringBuilder();
    sb.append("<Root><Parameters>");
    // 첫 행을 헤더로 사용해 컬럼 정의
    Row header = sheet.getRow(0);
    for (Cell c : header) {
        sb.append("<Parameter id=\"").append(c.getStringCellValue())
          .append("\" type=\"STRING\"/>");
    }
    sb.append("</Parameters><Rows>");
    for (int i = 1; i <= sheet.getLastRowNum(); i++) {
        Row row = sheet.getRow(i);
        if (row == null) continue;
        sb.append("<Row>");
        for (Cell c : row) {
            sb.append("<Col id=\"")
              .append(header.getCell(c.getColumnIndex()).getStringCellValue())
              .append("\">").append(getCellValue(c)).append("</Col>");
        }
        sb.append("</Row>");
    }
    sb.append("</Rows></Root>");

    return ResponseEntity.ok()
        .contentType(MediaType.TEXT_XML)
        .body(sb.toString());
}
```

## 가져오기 데이터 검증

Dataset으로 가져온 데이터를 Grid에 표시한 뒤 사용자가 확인하고 저장하는 2단계 방식이 실무 표준이다.

```javascript
// 가져온 데이터 저장
function btn_save_onclick(obj, e) {
    // 먼저 필수 항목 검증
    for (var i = 0; i < this.dsImport.rowcount; i++) {
        var sCode = this.dsImport.getColumn(i, "ITEM_CD");
        if (!sCode || sCode.trim() == "") {
            this.gfn_alert((i + 1) + "행: 품목코드가 없습니다.");
            return;
        }
    }
    this.transaction("saveBulk", "/bulk/save", this.dsImport, null,
        "", "fn_saveCallback");
}
```

## 정리

엑셀 내보내기는 `ExcelExportObject.addObject()` + `nexacro.exportObject()`로 클라이언트에서 직접 처리한다. 엑셀 가져오기는 `FileUpload`로 서버에 전송 → 서버 POI 파싱 → Dataset XML 응답 → `loadXML()`로 로드하는 서버 파싱 방식이 필요하다. Grid를 통한 사전 검증 후 저장 트랜잭션을 호출하는 2단계 패턴이 데이터 품질을 보장한다.

---

**지난 글:** [파일 서버 처리](/posts/nexacro-n-file-server-side/)

**다음 글:** [엑셀 템플릿](/posts/nexacro-n-excel-template/)

<br>
읽어주셔서 감사합니다. 😊
