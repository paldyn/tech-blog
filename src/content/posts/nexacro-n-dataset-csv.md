---
title: "[Nexacro N] Dataset CSV 데이터 다루기"
description: "Nexacro N Dataset의 saveCSV·loadCSV API를 설명하고, 한글 인코딩·BOM 처리·구분자 설정 등 실전에서 자주 겪는 CSV 관련 이슈와 해결 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 4
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "dataset", "csv", "saveCSV", "loadCSV", "excel", "encoding"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-dataset-json/)에서 JSON 변환 패턴을 살펴봤습니다. 업무 시스템에서는 Excel로 열 수 있는 CSV 파일 내보내기·가져오기 기능이 빈번히 요구됩니다. Nexacro N Dataset은 `saveCSV()`와 `loadCSV()` API로 CSV 직렬화를 지원합니다. 단, 한글 처리와 BOM에 주의해야 합니다.

## saveCSV — Dataset을 CSV 문자열로 직렬화

```javascript
// 기본: 탭 구분, 헤더 포함
var csvTab = this.dsMain.saveCSV(true, "\t");

// 쉼표 구분
var csvComma = this.dsMain.saveCSV(true, ",");
```

첫 번째 인자는 헤더(컬럼명) 포함 여부, 두 번째는 구분자입니다. 기본 구분자는 탭(`\t`)입니다.

![Dataset ↔ CSV 변환 흐름](/assets/posts/nexacro-n-dataset-csv-flow.svg)

## loadCSV — CSV 문자열을 Dataset으로 파싱

```javascript
// 헤더 있는 쉼표 구분 CSV 로드
this.dsMain.loadCSV(csvStr, true, ",");
```

`loadCSV()` 후 모든 행의 rowType은 `NORMAL(1)`입니다. 파싱된 데이터를 수정 추적 없이 그리드에 표시할 때는 이대로 쓸 수 있습니다. 서버로 전송할 때는 별도 rowType 변경이 필요합니다.

![CSV 내보내기 / 가져오기 코드](/assets/posts/nexacro-n-dataset-csv-code.svg)

## 한글 인코딩 — BOM 처리

Windows Excel에서 한글 CSV를 올바르게 열려면 UTF-8 BOM이 필요합니다. `saveCSV()`는 BOM을 자동으로 붙이지 않으므로 직접 추가해야 합니다.

```javascript
function fn_downloadCsv() {
    var csv = this.dsMain.saveCSV(true, ",");
    var bom = "﻿"; // UTF-8 BOM
    var withBom = bom + csv;
    // 파일 트랜잭션으로 서버에 임시 저장 후 다운로드하거나
    // nexacro.saveFile() 활용
    nexacro.saveFile("export.csv", withBom, "utf-8");
}
```

반대로 `loadCSV()` 시 BOM이 포함된 파일을 읽으면 첫 컬럼명에 BOM 문자가 붙을 수 있습니다. 로드 전에 제거합니다.

```javascript
function fn_loadCsvFile(filePath) {
    var raw = nexacro.loadFile(filePath, "utf-8");
    if (!raw) return;
    // BOM 제거
    raw = raw.replace(/^﻿/, "");
    this.dsImport.loadCSV(raw, true, ",");
}
```

## 구분자 선택 전략

| 구분자 | 장점 | 단점 |
|--------|------|------|
| 탭(`\t`) | 값에 쉼표 있어도 안전 | 탭 문자 포함 값 처리 필요 |
| 쉼표(`,`) | 범용 CSV 표준 | 값에 쉼표 포함 시 따옴표 필요 |
| 세미콜론(`;`) | 유럽 Excel 기본 | 한국 환경 비표준 |

쉼표 구분 CSV에서 값 자체에 쉼표가 들어갈 경우 큰따옴표로 감싸야 합니다. `saveCSV()`는 이 처리를 자동으로 하지 않으므로, 쉼표 포함 가능성이 있는 필드는 `"` + value.replace(`"`, `""`) + `"` 형태로 수동 처리하거나, 탭 구분자를 선택하는 것이 안전합니다.

## 수동 CSV 파싱 패턴

`loadCSV()`에 의존하지 않고 직접 파싱해야 할 때가 있습니다. 예를 들어 컬럼 매핑을 동적으로 구성하거나, 멀티라인 값(개행 포함)이 있는 경우입니다.

```javascript
function fn_parseCsvManual(csvStr) {
    var lines = csvStr.split("\n");
    var headers = lines[0].split(",");
    this.dsImport.clearData();
    for (var i = 1; i < lines.length; i++) {
        if (!lines[i]) continue;
        var cols = lines[i].split(",");
        var nRow = this.dsImport.addRow();
        for (var j = 0; j < headers.length; j++) {
            this.dsImport.setColumn(nRow, headers[j].trim(), cols[j] || "");
        }
    }
}
```

개행 포함 값이나 따옴표 이스케이프가 있는 RFC 4180 표준 CSV는 직접 파싱보다 서버 사이드 처리를 권장합니다.

## 대용량 CSV 내보내기

Dataset 행 수가 수만 건 이상이면 `saveCSV()` 호출 자체는 빠르지만, 파일 저장이나 다운로드 트랜잭션에서 병목이 생길 수 있습니다. 이 경우 서버에서 스트리밍 방식으로 CSV를 생성해 다운로드하는 방식이 더 안정적입니다. Nexacro에서는 파일 트랜잭션(`FileUpload` 서비스)으로 Dataset을 서버에 보내고, 서버에서 CSV를 생성해 응답 헤더를 `Content-Disposition: attachment`로 설정하는 패턴을 씁니다.

---

**지난 글:** [[Nexacro N] Dataset JSON 데이터 다루기](/posts/nexacro-n-dataset-json/)

**다음 글:** [[Nexacro N] 데이터바인딩 개념과 기초](/posts/nexacro-n-databinding/)

<br>
읽어주셔서 감사합니다. 😊
