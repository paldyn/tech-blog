---
title: "[Nexacro N] 엑셀 이미지 삽입"
description: "Apache POI를 사용해 Nexacro N 연동 서버에서 엑셀 파일에 이미지를 삽입하는 방법을 설명합니다. ClientAnchor 좌표 체계, 이미지 크기 조절, 헤더 로고 패턴까지 실무 코드를 중심으로 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 1
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "엑셀이미지", "POI", "ClientAnchor", "addPicture", "엑셀내보내기"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-excel-merge-format/)에서 Apache POI로 셀 병합과 서식을 적용하는 방법을 살펴보았다. 이번에는 엑셀 파일에 이미지를 삽입하는 방법을 다룬다. 실무에서는 보고서 상단에 로고를 넣거나, 그리드 행마다 제품 이미지를 삽입하는 요구가 자주 들어온다. POI의 이미지 API는 독특한 좌표 체계를 사용하기 때문에 처음에 혼란스러울 수 있는데, 단계별로 이해하면 어렵지 않다.

## 이미지 삽입 기본 흐름

POI에서 이미지를 시트에 삽입하려면 세 단계를 거친다.

1. 이미지 바이트 배열을 Workbook에 등록하고 인덱스를 받는다.
2. 시트의 `DrawingPatriarch`를 생성하거나 가져온다.
3. `ClientAnchor`로 위치를 지정한 뒤 `createPicture()`를 호출한다.

![POI 이미지 삽입 흐름](/assets/posts/nexacro-n-excel-image-poi.svg)

```java
// 이미지 파일을 바이트 배열로 읽기
InputStream imgStream = new FileInputStream("logo.png");
byte[] imgBytes = IOUtils.toByteArray(imgStream);
imgStream.close();

// Workbook에 이미지 등록
int picIdx = workbook.addPicture(imgBytes, Workbook.PICTURE_TYPE_PNG);

// Drawing 생성 및 Anchor 설정
Drawing<?> drawing = sheet.createDrawingPatriarch();
CreationHelper helper = workbook.getCreationHelper();
ClientAnchor anchor = helper.createClientAnchor();
anchor.setCol1(1);  // B열 시작
anchor.setRow1(0);  // 1행 시작 (0-based)

// 이미지 생성
Picture picture = drawing.createPicture(anchor, picIdx);
```

`PICTURE_TYPE_PNG`, `PICTURE_TYPE_JPEG`, `PICTURE_TYPE_GIF` 등의 상수로 이미지 형식을 지정한다. 형식이 실제 바이트 배열과 일치하지 않으면 엑셀이 이미지를 열지 못하므로 정확하게 맞춰야 한다.

## ClientAnchor 좌표 체계

`ClientAnchor`는 이미지가 배치될 영역을 셀 좌표로 지정한다. 좌상단 셀(`Col1`, `Row1`)과 우하단 셀(`Col2`, `Row2`)을 설정하면 그 사각형 안에 이미지가 표시된다.

![ClientAnchor 좌표 체계](/assets/posts/nexacro-n-excel-image-anchor.svg)

```java
anchor.setCol1(1);   // B열 (0-based)
anchor.setRow1(2);   // 3행 (0-based)
anchor.setCol2(4);   // E열 (이미지 오른쪽 경계)
anchor.setRow2(6);   // 7행 (이미지 아래쪽 경계)
```

`Col2`, `Row2`를 설정하면 이미지가 해당 영역에 맞게 늘어나거나 줄어든다. 원본 비율을 유지하고 싶다면 `Col2`, `Row2`를 생략하고 `picture.resize(1.0)`을 호출한다.

```java
// 원본 크기 그대로 삽입
Picture picture = drawing.createPicture(anchor, picIdx);
picture.resize(1.0);  // 1.0 = 원본 100%

// 50% 축소
picture.resize(0.5);
```

## EMU 오프셋으로 세밀한 위치 조정

셀 경계보다 좀 더 안쪽에 이미지를 배치하고 싶을 때는 `Dx`, `Dy` 오프셋을 사용한다. 단위는 EMU(English Metric Unit)로 1인치 = 914,400 EMU다.

```java
// 왼쪽에서 5mm, 위에서 3mm 떨어진 위치에 시작
int mmToEmu = 36000;  // 1mm ≈ 36000 EMU
anchor.setDx1(5 * mmToEmu);
anchor.setDy1(3 * mmToEmu);
```

EMU 변환이 번거롭다면 픽셀을 기준으로 계산할 수도 있다. 96 DPI 기준에서 1픽셀은 약 9,525 EMU다.

## 헤더 로고 삽입 패턴

보고서 상단에 회사 로고를 고정 위치에 삽입하는 패턴은 매우 흔하다. 로고가 1행 높이보다 크면 행 높이를 늘려야 이미지가 잘리지 않는다.

```java
// 1행 높이를 60pt로 설정 (기본 15pt)
sheet.getRow(0).setHeightInPoints(60f);

// 1열(B)~3열(D), 1행에 로고 삽입
ClientAnchor logoAnchor = helper.createClientAnchor();
logoAnchor.setCol1(1);
logoAnchor.setRow1(0);
logoAnchor.setDx1(5 * 36000);  // 좌측 5mm 여백
logoAnchor.setDy1(3 * 36000);  // 상단 3mm 여백

Picture logo = drawing.createPicture(logoAnchor, picIdx);
logo.resize(1.0);
```

## 다수 이미지 삽입 시 주의사항

같은 시트에 여러 이미지를 삽입할 때는 `DrawingPatriarch`를 한 번만 생성하고 재사용해야 한다. `createDrawingPatriarch()`를 두 번 호출하면 기존 드로잉이 초기화되어 먼저 삽입한 이미지가 사라진다.

```java
// 한 번만 생성
Drawing<?> drawing = sheet.createDrawingPatriarch();

// 반복하며 각 행에 이미지 삽입
for (int i = 0; i < items.size(); i++) {
    byte[] imgData = fetchImageBytes(items.get(i).getImageUrl());
    int idx = workbook.addPicture(imgData, Workbook.PICTURE_TYPE_PNG);

    ClientAnchor a = helper.createClientAnchor();
    a.setCol1(5);          // F열에 이미지 배치
    a.setRow1(i + 1);      // 데이터 행
    a.setCol2(7);
    a.setRow2(i + 2);

    drawing.createPicture(a, idx);
}
```

이미지 URL을 서버에서 직접 가져오는 경우 HTTP 연결 실패에 대한 예외 처리를 반드시 추가한다. 이미지 한 건 실패가 전체 엑셀 생성을 막아서는 안 된다.

## XSSF vs HSSF

POI에는 `.xlsx`용 `XSSFWorkbook`과 `.xls`용 `HSSFWorkbook`이 있다. `ClientAnchor` API는 동일하지만 지원 이미지 형식에 차이가 있다.

| 형식 | PNG | JPEG | GIF | EMF/WMF |
|------|-----|------|-----|---------|
| XSSF (.xlsx) | O | O | O | O |
| HSSF (.xls) | O | O | O | O (제한적) |

실무에서는 `.xlsx`를 기본으로 사용하고, 레거시 시스템 호환이 필요할 때만 `.xls`를 검토한다.

---

**지난 글:** [엑셀 병합·서식](/posts/nexacro-n-excel-merge-format/)

**다음 글:** [Plot 컴포넌트](/posts/nexacro-n-plot-component/)

<br>
읽어주셔서 감사합니다. 😊
