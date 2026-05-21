---
title: "[Nexacro N] Java 어댑터 심화"
description: "Nexacro N Java 어댑터의 내부 구조와 DataSet 조작 API를 상세히 설명합니다. NexacroServlet, PL 파서, ServiceDispatcher의 동작 원리와 DataSet 읽기/쓰기 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 4
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "java어댑터", "DataSet", "NexaService", "PL파서", "VariableList"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-spring-boot/)에서 Spring Boot와 Nexacro N을 연동하는 전체 설정 방법을 살펴보았다. 이번에는 Java 어댑터가 내부적으로 어떻게 동작하는지, 그리고 DataSet API를 실제 업무 코드에서 어떻게 사용하는지 더 깊이 들어간다.

Java 어댑터는 Nexacro N의 공식 서버 SDK다. 클라이언트가 전송한 PL 스트림을 Java 객체로 변환하고, Spring 컨텍스트에서 서비스 빈을 찾아 메서드를 호출하는 전 과정을 담당한다.

## 어댑터 내부 처리 흐름

![Java 어댑터 내부 구조](/assets/posts/nexacro-n-java-adapter-structure.svg)

요청이 들어오면 `NexacroServlet`이 HTTP 요청을 수신한다. 이어 PL 파서가 요청 본문을 파싱해 `DataSet`과 `VariableList` Java 객체를 생성한다. `ServiceDispatcher`는 서비스 ID(`SVC::ClassName::methodName`)를 파싱해 Spring 컨텍스트에서 해당 서비스 빈을 찾고 리플렉션으로 메서드를 호출한다.

## DataSet API 상세

![Java 어댑터 DataSet 조작 API](/assets/posts/nexacro-n-java-adapter-code.svg)

### 입력 DataSet에서 데이터 읽기

```java
public void search(DataSet dsIn, DataSet dsOut, VariableList vl) {
    // 단일 값 읽기
    String userId   = dsIn.getStringColumn(0, "USER_ID");
    int    pageNo   = dsIn.getIntColumn(0, "PAGE_NO");
    double amount   = dsIn.getDoubleColumn(0, "AMOUNT");

    // 날짜는 String으로 받아 변환
    String startDt  = dsIn.getStringColumn(0, "START_DT");
    LocalDate date  = LocalDate.parse(startDt, DateTimeFormatter.ofPattern("yyyyMMdd"));

    // 복수 행 처리
    for (int i = 0; i < dsIn.getRowCount(); i++) {
        String nm = dsIn.getStringColumn(i, "ITEM_NM");
        int    qty = dsIn.getIntColumn(i, "QTY");
        // 처리 로직
    }
}
```

### 출력 DataSet 구성

```java
// 방법 1: NexacroUtils 사용 (권장 — MyBatis Map 결과와 자동 매핑)
List<Map<String, Object>> rows = mapper.selectUsers(param);
NexacroUtils.copyToDataSet(rows, dsOut);

// 방법 2: 직접 컬럼·행 추가
dsOut.addStringColumn("USER_ID");
dsOut.addStringColumn("USER_NM");
dsOut.addIntColumn("AGE");

int row = dsOut.newRow();
dsOut.set(row, "USER_ID", "U001");
dsOut.set(row, "USER_NM", "홍길동");
dsOut.set(row, "AGE", 30);
```

`NexacroUtils.copyToDataSet()`을 사용하면 `List<Map<String, Object>>` 형태의 MyBatis 결과를 DataSet으로 자동 변환한다. Map의 키가 컬럼명이 되고, 값 타입에 따라 String/Int/Double 컬럼이 자동으로 생성된다.

## RowType 기반 CRUD 처리

클라이언트에서 전송된 DataSet의 각 행에는 `RowType`이 설정되어 있다. 서버에서는 이를 읽어 INSERT/UPDATE/DELETE를 분기한다.

```java
public void save(DataSet dsUser, DataSet dsResult, VariableList vl)
        throws NexaServiceException {

    int successCnt = 0;
    for (int i = 0; i < dsUser.getRowCount(); i++) {
        int rowType = dsUser.getRowType(i);
        Map<String, Object> row = NexacroUtils.rowToMap(dsUser, i);

        switch (rowType) {
            case DataSet.ROW_TYPE_INSERTED:
                userMapper.insertUser(row);
                successCnt++;
                break;
            case DataSet.ROW_TYPE_UPDATED:
                userMapper.updateUser(row);
                successCnt++;
                break;
            case DataSet.ROW_TYPE_DELETED:
                userMapper.deleteUser((String) row.get("USER_ID"));
                successCnt++;
                break;
        }
    }
    vl.addVariable("errCode", "0");
    vl.addVariable("errMsg", successCnt + "건 처리되었습니다.");
}
```

`ROW_TYPE_NORMAL`(1), `ROW_TYPE_INSERTED`(2), `ROW_TYPE_UPDATED`(4), `ROW_TYPE_DELETED`(8)이 주로 사용된다. `dsUser.getRowCount()`는 삭제된 행도 포함하므로 `getRowType`으로 상태를 반드시 확인해야 한다.

## VariableList 활용

`VariableList`는 Dataset이 아닌 단순 key-value 쌍을 전송하는 데 사용한다. 페이지 정보, 오류 코드, 집계값 등을 전달하기 좋다.

```java
// 서버: VariableList에서 읽기
String searchType = vl.getStr("SEARCH_TYPE");
int pageNo        = vl.getInt("PAGE_NO");

// 서버: VariableList에 쓰기
vl.addVariable("errCode",    "0");
vl.addVariable("errMsg",     "정상 처리");
vl.addVariable("TOTAL_CNT",  String.valueOf(totalCount));
vl.addVariable("PAGE_TOTAL", String.valueOf(pageTotalCount));
```

클라이언트에서는 콜백 함수 인자나 `this.getVariable("TOTAL_CNT")`로 받는다.

## 트랜잭션 예외 처리

```java
public void search(DataSet dsIn, DataSet dsOut, VariableList vl)
        throws NexaServiceException {
    try {
        // 비즈니스 로직
        List<Map<String, Object>> list = mapper.selectUsers(dsIn);
        NexacroUtils.copyToDataSet(list, dsOut);
    } catch (DataAccessException e) {
        // DB 오류 → 어댑터가 PL 오류 응답으로 변환
        throw new NexaServiceException("DB_ERR", "데이터 조회 중 오류: " + e.getMessage());
    }
}
```

`NexaServiceException`을 throw하면 어댑터가 클라이언트에 오류 코드와 메시지를 담은 PL 응답을 반환한다. 클라이언트 콜백의 `errCode`와 `errMsg`로 전달된다.

---

**지난 글:** [Spring Boot 연동](/posts/nexacro-n-spring-boot/)

**다음 글:** [Node.js 어댑터](/posts/nexacro-n-node-adapter/)

<br>
읽어주셔서 감사합니다. 😊
