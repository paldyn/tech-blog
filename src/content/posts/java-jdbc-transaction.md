---
title: "JDBC 트랜잭션 — 여러 SQL을 하나의 단위로 묶기"
description: "트랜잭션은 여러 SQL을 '전부 성공하거나 전부 취소'되는 하나의 작업 단위로 묶습니다. JDBC의 autoCommit 동작, setAutoCommit·commit·rollback 패턴, try-with-resources와의 조합, 격리 수준까지 실무 관점으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-22"
archiveOrder: 4
type: "knowledge"
category: "Java"
tags: ["Java", "JDBC", "트랜잭션", "commit", "rollback"]
featured: false
draft: false
---

[지난 글](/posts/java-prepared-statement/)에서 `PreparedStatement`로 SQL을 안전하게 실행하는 법을 다뤘습니다. 그런데 실제 업무 로직은 SQL 한 줄로 끝나지 않습니다. 계좌 이체는 한 계좌에서 돈을 빼고 다른 계좌에 넣는 두 번의 변경으로 이루어지고, 주문은 재고 차감과 주문 기록 생성이 함께 일어나야 합니다. 이때 일부만 성공하고 일부가 실패하면 데이터는 모순된 상태에 빠집니다. 이런 사고를 막기 위해 여러 SQL을 **하나의 작업 단위**로 묶는 것이 바로 트랜잭션입니다.

## 왜 트랜잭션이 필요한가 — 원자성

가장 고전적인 예가 계좌 이체입니다. A의 잔액을 1만 원 줄이고 B의 잔액을 1만 원 늘리는 두 작업은 반드시 함께 성공하거나 함께 실패해야 합니다. 만약 출금만 되고 입금 직전에 시스템이 멈추면, 1만 원이 허공에 사라지는 심각한 데이터 불일치가 발생합니다.

![계좌 이체 — 둘 다 성공하거나 둘 다 취소](/assets/posts/java-jdbc-transaction-commit-rollback.svg)

트랜잭션은 이를 **원자성(Atomicity)** 으로 보장합니다. 묶인 모든 작업이 성공하면 `commit`으로 한꺼번에 영구 반영하고, 중간에 하나라도 실패하면 `rollback`으로 지금까지의 변경을 전부 되돌립니다. "부분 성공"이라는 어정쩡한 상태가 존재하지 않는 것, 그것이 트랜잭션의 핵심입니다.

## autoCommit — JDBC의 기본 동작을 먼저 이해하라

JDBC를 처음 쓸 때 의아한 점이 있습니다. 앞선 글들에서 `commit`을 한 번도 호출하지 않았는데 데이터가 잘 저장됐습니다. 이는 JDBC의 `Connection`이 기본적으로 **autoCommit = true** 상태이기 때문입니다. 이 모드에서는 SQL 한 문장이 실행될 때마다 곧바로 자동으로 커밋됩니다.

![autoCommit — 기본값 true의 함정](/assets/posts/java-jdbc-transaction-autocommit.svg)

문제는 이 자동 커밋이 켜져 있으면 여러 SQL을 하나로 묶을 수 없다는 점입니다. 각 문장이 즉시 확정되어 버리므로, 두 번째 문장에서 실패해도 첫 번째 문장은 이미 커밋되어 되돌릴 수 없습니다. 그래서 트랜잭션을 쓰려면 먼저 자동 커밋을 꺼야 합니다.

## 표준 패턴 — setAutoCommit(false) · commit · rollback

JDBC 트랜잭션의 정석 패턴은 다음과 같습니다. 자동 커밋을 끄고, 모든 SQL을 실행한 뒤 성공하면 `commit`, 예외가 나면 `catch`에서 `rollback`을 호출합니다.

```java
Connection conn = null;
try {
    conn = DriverManager.getConnection(url, "user", "pw");
    conn.setAutoCommit(false);            // 트랜잭션 시작

    try (PreparedStatement debit =
             conn.prepareStatement("UPDATE account SET balance = balance - ? WHERE id = ?");
         PreparedStatement credit =
             conn.prepareStatement("UPDATE account SET balance = balance + ? WHERE id = ?")) {

        debit.setBigDecimal(1, amount);
        debit.setLong(2, fromId);
        debit.executeUpdate();

        credit.setBigDecimal(1, amount);
        credit.setLong(2, toId);
        credit.executeUpdate();
    }

    conn.commit();                        // 둘 다 성공 → 확정
} catch (SQLException e) {
    if (conn != null) conn.rollback();    // 하나라도 실패 → 전부 취소
    throw e;
} finally {
    if (conn != null) conn.close();
}
```

흐름은 단순합니다. `setAutoCommit(false)`로 시작 지점을 표시하고, 모든 변경을 실행한 뒤 `commit`으로 확정합니다. 도중에 어떤 예외라도 발생하면 `catch`로 빠져 `rollback`이 모든 변경을 되돌립니다.

## 자원 정리에서 주의할 점

위 코드에서 `Connection`만 try-with-resources로 감싸지 않고 수동으로 다룬 이유가 있습니다. `Connection`을 try-with-resources에 넣으면 블록을 벗어날 때 자동으로 `close`되는데, **닫기 전에 커밋·롤백 결정을 내려야** 하기 때문입니다. 자동으로 닫히는 시점과 커밋 시점을 명확히 통제하기 위해 `Connection`은 직접 관리하는 편이 안전합니다.

또 하나, `close`되는 연결은 보통 커밋되지 않은 변경을 자동으로 롤백하지만, 이 동작은 드라이버 구현에 따라 미묘하게 다를 수 있습니다. 그래서 "성공이면 commit, 실패면 rollback"을 명시적으로 호출하는 습관이 중요합니다. 한편 `setAutoCommit(false)`로 바꾼 연결을 풀에 반납하기 전에는 다시 `true`로 돌려놓아야 다음 사용자가 혼란을 겪지 않습니다.

## 격리 수준 — 동시성의 또 다른 축

트랜잭션은 원자성뿐 아니라 동시에 실행되는 트랜잭션끼리 서로를 얼마나 볼 수 있는지를 정하는 **격리 수준(Isolation Level)** 도 다룹니다. JDBC에서는 `Connection`에서 설정합니다.

```java
conn.setTransactionIsolation(Connection.TRANSACTION_READ_COMMITTED);
```

`READ_UNCOMMITTED` → `READ_COMMITTED` → `REPEATABLE_READ` → `SERIALIZABLE` 순으로 격리가 강해지고, 그만큼 동시성은 떨어집니다. 대부분의 DB는 합리적인 기본값(예: PostgreSQL·Oracle은 `READ_COMMITTED`)을 제공하므로 처음에는 기본값을 따르되, 같은 데이터를 두 번 읽을 때 값이 달라지는 문제가 생긴다면 격리 수준을 조정하게 됩니다. 격리 수준의 세부 현상(더티 리드, 팬텀 리드 등)은 데이터베이스 영역의 주제이므로 여기서는 JDBC에서 설정하는 지점이 있다는 것까지만 짚습니다.

## 정리

트랜잭션은 여러 SQL을 "전부 성공하거나 전부 취소"되는 하나의 단위로 묶어 데이터의 일관성을 지킵니다. JDBC는 기본이 autoCommit = true라 문장마다 즉시 커밋되므로, 트랜잭션을 쓰려면 `setAutoCommit(false)`로 자동 커밋을 끄고 성공 시 `commit`, 실패 시 `rollback`을 명시적으로 호출하는 패턴을 따라야 합니다. 자원 정리와 커밋 시점의 통제, 격리 수준 설정까지가 트랜잭션 처리의 골격입니다. 그런데 위 예제처럼 비슷한 SQL을 여러 번 실행할 때는 매번 왕복하는 비용이 아깝습니다. 다음 글에서는 이를 한 번에 모아 보내는 배치 처리를 다룹니다.

---

**지난 글:** [PreparedStatement — SQL 인젝션을 막는 매개변수 바인딩](/posts/java-prepared-statement/)

**다음 글:** [JDBC 배치 — 여러 SQL을 한 번에 모아 보내기](/posts/java-jdbc-batch/)

<br>
읽어주셔서 감사합니다. 😊
