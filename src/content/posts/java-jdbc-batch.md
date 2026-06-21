---
title: "JDBC 배치 — 여러 SQL을 한 번에 모아 보내기"
description: "배치 처리는 여러 SQL을 모아 한 번의 네트워크 왕복으로 전송해 대량 처리 성능을 끌어올립니다. addBatch·executeBatch 패턴, 청크 단위 flush, rewriteBatchedStatements 같은 드라이버 옵션, 그리고 흔한 함정까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-22"
archiveOrder: 5
type: "knowledge"
category: "Java"
tags: ["Java", "JDBC", "배치", "성능", "대량처리"]
featured: false
draft: false
---

[지난 글](/posts/java-jdbc-transaction/)에서 여러 SQL을 하나의 작업 단위로 묶는 트랜잭션을 다뤘습니다. 그런데 비슷한 SQL을 수천, 수만 번 반복 실행해야 하는 경우는 또 다른 고민을 던집니다. 로그 일괄 적재, 외부 데이터 동기화, 대량 회원 등록 같은 작업에서 `executeUpdate`를 한 건씩 호출하면 처리 시간이 감당하기 어려울 만큼 늘어납니다. 이 문제를 푸는 JDBC의 도구가 **배치(Batch) 처리** 입니다.

## 병목은 SQL이 아니라 왕복이다

대량 처리가 느린 진짜 원인은 의외로 SQL 실행 자체가 아니라 **애플리케이션과 DB 사이의 네트워크 왕복** 입니다. `executeUpdate`를 한 번 호출할 때마다 SQL을 보내고 결과를 받는 왕복이 한 번씩 발생하는데, 이 왕복 지연이 수천 번 누적되면 전체 시간을 지배하게 됩니다.

![개별 실행 vs 배치 — 네트워크 왕복 횟수](/assets/posts/java-jdbc-batch-roundtrip.svg)

배치는 여러 SQL을 메모리에 모았다가 한 번의 왕복으로 묶어 보냅니다. 1000건을 1000번 왕복하는 대신, 1000건을 한 묶음으로 보내면 왕복이 한 번으로 줄어듭니다. SQL 실행에 걸리는 DB 내부 시간은 비슷하더라도, 왕복 지연이 사라지면서 전체 처리량이 극적으로 개선됩니다.

## 기본 패턴 — addBatch와 executeBatch

배치 처리의 골격은 두 메서드로 이뤄집니다. 반복문 안에서 값을 바인딩하고 `addBatch`로 묶음에 추가한 뒤, 마지막에 `executeBatch`로 한 번에 전송합니다.

![배치 흐름 — addBatch로 모으고 executeBatch로 전송](/assets/posts/java-jdbc-batch-flow.svg)

```java
String sql = "INSERT INTO log (member_id, action) VALUES (?, ?)";

try (Connection conn = DriverManager.getConnection(url, "user", "pw");
     PreparedStatement ps = conn.prepareStatement(sql)) {

    conn.setAutoCommit(false);

    for (LogEntry entry : entries) {
        ps.setLong(1, entry.memberId());
        ps.setString(2, entry.action());
        ps.addBatch();                 // 전송하지 않고 묶음에 추가
    }

    int[] counts = ps.executeBatch();  // 쌓인 묶음을 한 번에 전송
    conn.commit();
}
```

`addBatch`는 SQL을 곧바로 보내지 않고 메모리에 쌓아둡니다. `executeBatch`가 호출될 때 비로소 쌓인 전체가 한 번에 전송되고, 각 건의 영향받은 행 수가 `int[]` 배열로 반환됩니다. 배치는 트랜잭션과 함께 쓰는 것이 자연스러우므로 `setAutoCommit(false)`로 묶고 마지막에 `commit`합니다.

## 청크 단위로 끊어서 — 메모리 관리

수십만 건을 한 묶음에 다 쌓으면 애플리케이션 메모리가 폭증하고 트랜잭션이 지나치게 비대해집니다. 그래서 실무에서는 일정 건수(예: 1000건)마다 중간 `executeBatch`로 flush 하는 패턴을 씁니다.

```java
int batchSize = 1000;
int count = 0;

for (LogEntry entry : entries) {
    ps.setLong(1, entry.memberId());
    ps.setString(2, entry.action());
    ps.addBatch();

    if (++count % batchSize == 0) {
        ps.executeBatch();             // 1000건마다 전송
        ps.clearBatch();               // 묶음 비우기
    }
}
ps.executeBatch();                     // 남은 자투리 처리
conn.commit();
```

`clearBatch`로 쌓인 묶음을 비워 다음 청크를 위한 자리를 마련합니다. 마지막에 `batchSize`로 나누어떨어지지 않는 자투리가 남으므로 반복문 밖에서 한 번 더 `executeBatch`를 호출하는 것을 잊지 말아야 합니다.

## 흔한 함정 — addBatch만 하고 executeBatch를 안 하면

배치에서 가장 흔한 실수는 `addBatch`만 호출하고 `executeBatch`를 빠뜨리는 것입니다. 이 경우 SQL은 메모리에 쌓이기만 할 뿐 **DB에 전혀 반영되지 않습니다.** 오류도 나지 않고 조용히 아무 일도 일어나지 않으므로, "분명히 코드를 실행했는데 데이터가 없다"는 당혹스러운 상황으로 이어집니다. 청크 패턴에서 자투리 `executeBatch`를 빠뜨리는 것도 같은 종류의 함정입니다.

또 하나, 배치 도중 한 건이 실패하면 `BatchUpdateException`이 발생하는데, 이미 처리된 일부 건과 실패한 건의 경계가 드라이버마다 다르게 동작할 수 있습니다. 그래서 배치는 반드시 트랜잭션으로 감싸 실패 시 전체를 롤백할 수 있게 해야 합니다.

## 드라이버 옵션 — 진짜 배치가 되게 하라

주의할 점이 하나 더 있습니다. JDBC API에서 `addBatch`를 쓴다고 해서 드라이버가 항상 SQL을 진짜 하나로 묶어 보내는 것은 아닙니다. 예를 들어 MySQL 드라이버는 기본 설정에서 배치를 내부적으로 개별 문장으로 풀어 보내기도 합니다. 이때는 접속 URL에 옵션을 줘야 진짜 배치 효과가 납니다.

```text
jdbc:mysql://localhost:3306/shop?rewriteBatchedStatements=true
```

`rewriteBatchedStatements=true`를 켜면 여러 INSERT가 하나의 다중 행 INSERT로 재작성되어 왕복이 실제로 줄어듭니다. 드라이버마다 이런 옵션의 이름과 동작이 다르므로, 배치를 적용했는데 기대만큼 빨라지지 않는다면 드라이버 문서에서 해당 옵션을 확인해야 합니다.

## 정리

배치 처리는 여러 SQL을 메모리에 모았다가 한 번의 왕복으로 전송해, 대량 처리의 진짜 병목인 네트워크 왕복을 줄이는 기법입니다. `addBatch`로 누적하고 `executeBatch`로 전송하며, 메모리와 트랜잭션 크기 관리를 위해 청크 단위로 끊어 flush 합니다. `executeBatch` 누락이라는 조용한 함정과 드라이버별 옵션(`rewriteBatchedStatements` 등)을 함께 챙겨야 기대한 성능이 나옵니다. 지금까지 JDBC로 연결을 직접 열고 닫았는데, 이 "연결을 매번 새로 만드는" 비용이 사실 만만치 않습니다. 다음 글에서는 연결을 미리 만들어 재사용하는 커넥션 풀을 다룹니다.

---

**지난 글:** [JDBC 트랜잭션 — 여러 SQL을 하나의 단위로 묶기](/posts/java-jdbc-transaction/)

**다음 글:** [커넥션 풀 — 연결을 재사용해 비용을 줄이기](/posts/java-connection-pool/)

<br>
읽어주셔서 감사합니다. 😊
