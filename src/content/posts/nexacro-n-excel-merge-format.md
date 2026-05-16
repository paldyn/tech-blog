---
title: "[Nexacro N] 엑셀 병합·서식"
description: "Nexacro N 연동 서버에서 Apache POI로 엑셀 셀 병합(CellRangeAddress), 숫자·날짜 포맷, 배경색·테두리 등의 셀 서식을 적용하는 패턴과 성능 최적화를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 10
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "엑셀병합", "엑셀서식", "POI", "CellStyle", "CellRangeAddress"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-excel-template/)에서 서버 측 엑셀 템플릿에 데이터를 주입하는 방법을 살펴보았다. 템플릿을 사용하면 서식을 미리 정의할 수 있지만, 데이터 건수에 따라 행이 동적으로 추가될 때는 코드로 직접 병합과 서식을 적용해야 할 때도 있다. 이 글은 Apache POI로 셀 병합과 다양한 서식을 적용하는 실무 패턴을 다룬다.

## 셀 병합

POI에서 셀 병합은 `addMergedRegion()`으로 처리한다. 병합 범위는 `CellRangeAddress(rowStart, rowEnd, colStart, colEnd)` 순서로 지정한다. 행과 열 인덱스는 모두 0-based다.

```java
// 0행 1~3열 병합 (첫 번째 행의 2~4번째 열)
sheet.addMergedRegion(new CellRangeAddress(0, 0, 1, 3));

// 병합된 셀에 값 설정은 좌상단 셀(첫 번째 셀)에만 한다
Row row = sheet.getRow(0);
Cell cell = row.getCell(1);  // colStart=1
cell.setCellValue("1분기");
```

병합 후에는 병합 범위의 첫 번째 셀에만 값을 설정한다. 나머지 셀에 값을 설정해도 표시되지 않는다.

![엑셀 병합·서식 처리 유형](/assets/posts/nexacro-n-excel-merge-format-types.svg)

## 병합과 테두리

병합 영역의 테두리를 일괄 적용하려면 `RegionUtil`을 활용한다.

```java
CellRangeAddress region = new CellRangeAddress(0, 0, 1, 3);
sheet.addMergedRegion(region);

RegionUtil.setBorderTop(BorderStyle.MEDIUM,    region, sheet);
RegionUtil.setBorderBottom(BorderStyle.MEDIUM, region, sheet);
RegionUtil.setBorderLeft(BorderStyle.MEDIUM,   region, sheet);
RegionUtil.setBorderRight(BorderStyle.MEDIUM,  region, sheet);
```

`RegionUtil`을 사용하면 병합 영역 전체 외곽선을 한 번에 설정할 수 있다.

## CellStyle 생성과 재사용

`CellStyle`은 `Workbook` 수준에서 관리된다. 동일한 스타일을 여러 셀에 적용할 때 매번 `createCellStyle()`을 호출하면 성능이 저하되고 POI의 스타일 개수 한계(최대 64,000개)를 초과할 수 있다. 스타일 객체를 미리 만들어 재사용해야 한다.

```java
// 미리 생성해두고 재사용
CellStyle numStyle  = createNumStyle(wb);
CellStyle hdrStyle  = createHeaderStyle(wb);
CellStyle dateStyle = createDateStyle(wb);

for (int i = 0; i < rows.size(); i++) {
    Row row = sheet.createRow(5 + i);
    row.createCell(0).setCellValue(rows.get(i).getItemCd());
    Cell amtCell = row.createCell(3);
    amtCell.setCellValue(rows.get(i).getAmt());
    amtCell.setCellStyle(numStyle);  // 재사용
}
```

![POI 셀 서식 적용 코드](/assets/posts/nexacro-n-excel-merge-format-code.svg)

## 숫자·날짜 포맷

```java
CellStyle numStyle = wb.createCellStyle();
DataFormat fmt     = wb.createDataFormat();
numStyle.setDataFormat(fmt.getFormat("#,##0"));    // 천단위 구분

CellStyle dateStyle = wb.createCellStyle();
dateStyle.setDataFormat(fmt.getFormat("yyyy-mm-dd"));  // 날짜
```

숫자를 `setCellValue(double)`, 날짜를 `setCellValue(LocalDate)` 또는 `setCellValue(Date)`로 설정하고 포맷을 적용하면 엑셀에서 올바른 형식으로 표시된다.

## 배경색과 폰트

```java
CellStyle hdrStyle = wb.createCellStyle();

// 배경색
hdrStyle.setFillForegroundColor(IndexedColors.LIGHT_BLUE.getIndex());
hdrStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
hdrStyle.setAlignment(HorizontalAlignment.CENTER);

// 굵은 폰트
Font hdrFont = wb.createFont();
hdrFont.setBold(true);
hdrFont.setFontHeightInPoints((short) 11);
hdrStyle.setFont(hdrFont);
```

`IndexedColors`에 없는 색상은 `XSSFCellStyle`의 `setFillForegroundColor(new XSSFColor(new byte[]{R,G,B}, null))`로 RGB 색상을 직접 지정할 수 있다.

## 열 너비 자동 맞춤

```java
// 내용에 맞게 열 너비 자동 조정
for (int c = 0; c < 5; c++) {
    sheet.autoSizeColumn(c);
    // 한글 포함 시 1.2배 여유
    int width = (int)(sheet.getColumnWidth(c) * 1.2);
    sheet.setColumnWidth(c, Math.min(width, 15000));
}
```

`autoSizeColumn()`은 성능 비용이 크므로, 열이 많거나 행이 수만 개인 경우 직접 너비를 지정하는 것이 유리하다.

## 실무 패턴: 헤더 행 + 데이터 행 스타일 팩토리

서식이 복잡한 보고서는 스타일 팩토리 함수로 관리한다.

```java
class ExcelStyleFactory {
    private final Workbook wb;
    private CellStyle numStyle;
    private CellStyle hdrStyle;

    ExcelStyleFactory(Workbook wb) { this.wb = wb; }

    CellStyle getNumStyle() {
        if (numStyle == null) {
            numStyle = wb.createCellStyle();
            numStyle.setDataFormat(
                wb.createDataFormat().getFormat("#,##0"));
            numStyle.setAlignment(HorizontalAlignment.RIGHT);
        }
        return numStyle;  // 항상 동일 객체 반환
    }
}
```

팩토리 패턴으로 스타일을 관리하면 중복 생성을 방지하고 유지보수가 쉬워진다.

## Nexacro 측 연동

서버에서 완성된 엑셀을 스트리밍하면 Nexacro 클라이언트에서는 `nexacro.FileDownload(url)` 한 줄로 연동된다. 병합·서식은 순전히 서버 로직이므로 Nexacro 코드 변경 없이 보고서 레이아웃을 개선할 수 있다.

```javascript
function btn_report_onclick(obj, e) {
    var sUrl = "/excel/formatted-report?dept=" + this.comboDept.value;
    nexacro.FileDownload(sUrl);
}
```

## 정리

엑셀 셀 병합은 `addMergedRegion(new CellRangeAddress(r1,r2,c1,c2))`로 처리하고, 병합 셀의 테두리는 `RegionUtil`로 일괄 적용한다. `CellStyle`은 Workbook 수준에서 한 번 생성 후 재사용해야 스타일 한계와 성능 문제를 피할 수 있다. 스타일 팩토리 패턴으로 복잡한 보고서 서식을 일관되게 관리하면 유지보수가 편리해진다.

---

**지난 글:** [엑셀 템플릿 출력](/posts/nexacro-n-excel-template/)

<br>
읽어주셔서 감사합니다. 😊
