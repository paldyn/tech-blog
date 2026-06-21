---
title: "커넥션 풀 — 연결을 재사용해 비용을 줄이기"
description: "커넥션 풀은 DB 연결을 미리 만들어 두고 빌려주고 돌려받아 연결 생성·해제 비용을 없앱니다. 연결이 비싼 이유, DataSource 추상화, HikariCP 설정의 핵심 파라미터, 풀 고갈과 연결 누수까지 실무 관점으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-22"
archiveOrder: 6
type: "knowledge"
category: "Java"
tags: ["Java", "JDBC", "커넥션풀", "HikariCP", "DataSource"]
featured: false
draft: false
---

[지난 글](/posts/java-jdbc-batch/)에서 대량 SQL을 효율적으로 보내는 배치 처리를 다뤘습니다. 그런데 지금까지의 모든 예제에는 공통된 비효율이 하나 숨어 있었습니다. 매번 `DriverManager.getConnection`으로 연결을 새로 열고, 작업이 끝나면 닫았다는 점입니다. 연결을 여는 일은 생각보다 훨씬 비싼 작업이라, 요청이 몰리는 서비스에서는 이 비용 자체가 병목이 됩니다. 이 문제를 푸는 표준 해법이 **커넥션 풀(Connection Pool)** 입니다.

## 연결은 왜 비싼가

`getConnection` 한 번의 호출 뒤에서는 적지 않은 일이 벌어집니다. DB 서버와 TCP 연결을 맺기 위한 핸드셰이크가 일어나고, 계정·비밀번호로 인증이 이뤄지며, DB 측에서는 그 연결을 위한 세션과 메모리·프로세스 자원을 할당합니다.

![연결 생성 비용 — 매번 새로 열면 비싸다](/assets/posts/java-connection-pool-cost.svg)

이 과정은 한 번이면 수 밀리초에서 수십 밀리초가 걸립니다. 사소해 보이지만, 매 요청마다 연결을 새로 만들고 버리면 정작 SQL 실행보다 연결을 준비하는 데 더 많은 시간이 쓰이는 본말전도가 일어납니다. 커넥션 풀은 연결을 미리 몇 개 만들어 두고 **빌려주고 돌려받기만** 함으로써 이 생성·해제 비용을 제거합니다.

## 빌려주고 돌려받기 — close의 의미가 바뀐다

풀은 시작 시점에 연결을 여러 개 만들어 보관합니다. 애플리케이션이 연결을 요청하면 풀에서 놀고 있는(idle) 연결 하나를 빌려주고, 작업이 끝나면 그 연결을 다시 풀로 돌려받습니다.

![빌려주고 돌려받기 — 풀의 동작](/assets/posts/java-connection-pool-borrow-return.svg)

여기서 중요한 인식의 전환이 있습니다. 풀에서 빌린 연결에 `close`를 호출하면, 그것은 **실제로 연결을 닫는 것이 아니라 풀에 반납하는 것** 입니다. 풀이 `Connection`을 감싼 프록시를 돌려주기 때문에, 같은 `close()` 코드가 풀 환경에서는 "반납"으로 동작합니다. 덕분에 애플리케이션 코드는 풀을 쓰든 안 쓰든 거의 똑같이 작성할 수 있습니다.

## DataSource — 풀을 다루는 표준 창구

커넥션 풀을 직접 쓸 때는 `DriverManager` 대신 **`DataSource`** 인터페이스를 통해 연결을 얻습니다. `DataSource`는 연결을 제공하는 추상화된 창구로, 그 뒤에 풀이 있든 없든 사용하는 쪽 코드는 동일합니다.

```java
HikariConfig config = new HikariConfig();
config.setJdbcUrl("jdbc:mysql://localhost:3306/shop");
config.setUsername("user");
config.setPassword("pw");
config.setMaximumPoolSize(10);

try (HikariDataSource dataSource = new HikariDataSource(config)) {
    // 연결이 필요할 때마다 풀에서 빌리고, try 블록을 벗어나면 반납
    try (Connection conn = dataSource.getConnection();
         PreparedStatement ps =
             conn.prepareStatement("SELECT name FROM member WHERE id = ?")) {
        ps.setLong(1, 77L);
        try (ResultSet rs = ps.executeQuery()) {
            while (rs.next()) System.out.println(rs.getString("name"));
        }
    }
}
```

`dataSource.getConnection()`이 풀에서 연결을 빌리고, 안쪽 try-with-resources를 벗어나면 `close`가 호출되어 풀로 반납됩니다. JDBC 코드의 모양은 그대로지만, 연결의 생애가 풀에 의해 관리된다는 점만 달라집니다.

## HikariCP — 사실상의 표준

자바 진영에서 가장 널리 쓰이는 커넥션 풀은 **HikariCP** 입니다. 가볍고 빠르며, Spring Boot의 기본 풀로 채택되어 있습니다. HikariCP를 다룰 때 알아야 할 핵심 파라미터는 많지 않습니다.

```text
maximumPoolSize : 풀이 가질 수 있는 최대 연결 수 (가장 중요)
minimumIdle     : 항상 유지할 최소 유휴 연결 수
connectionTimeout : 빈 연결을 기다리는 최대 시간 (초과 시 예외)
maxLifetime     : 연결의 최대 수명 (이후 폐기하고 새로 생성)
idleTimeout     : 유휴 연결을 회수하기까지의 시간
```

이 중 가장 중요한 것은 `maximumPoolSize` 입니다. 무작정 크게 잡는다고 좋아지지 않습니다. 연결 수가 DB가 감당할 수 있는 범위를 넘으면 오히려 DB 쪽 자원 경쟁으로 전체 성능이 떨어집니다. 적정 크기는 DB의 CPU·코어 수와 워크로드에 따라 다르며, 흔히 알려진 출발점은 "코어 수의 두 배 + 디스크 수" 정도의 비교적 작은 값입니다. 큰 풀이 답이 아니라는 점이 핵심입니다.

## 풀 고갈과 연결 누수

풀의 가장 흔한 사고는 **연결 누수** 입니다. 빌린 연결을 반납(`close`)하지 않으면 그 연결은 영원히 "사용 중" 상태로 남고, 이런 일이 반복되면 풀에 빌려줄 수 있는 연결이 바닥납니다. 그러면 새 요청은 빈 연결을 기다리다가 `connectionTimeout`을 넘겨 예외를 받고, 결국 서비스 전체가 멈춥니다.

```java
// 위험 — 예외가 나면 close가 호출되지 않아 연결이 새어 나간다
Connection conn = dataSource.getConnection();
PreparedStatement ps = conn.prepareStatement(sql);
ps.executeUpdate();   // 여기서 예외 → conn.close() 도달 못 함
conn.close();
```

해법은 앞선 글들에서 반복한 것과 같습니다. **try-with-resources** 로 연결을 감싸 어떤 경우에도 반납이 보장되게 하는 것입니다. HikariCP는 `leakDetectionThreshold`로 일정 시간 이상 반납되지 않은 연결을 로그로 경고해 누수를 찾도록 돕습니다.

## 정리

커넥션 풀은 비싼 DB 연결을 미리 만들어 두고 빌려주고 돌려받아 생성·해제 비용을 제거하는 표준 기법으로, `DataSource`라는 추상화된 창구를 통해 JDBC 코드의 모양은 그대로 유지합니다. 풀 환경에서 `close`는 반납을 의미하며, HikariCP가 사실상의 표준입니다. `maximumPoolSize`는 클수록 좋은 것이 아니라 DB가 감당할 작은 값이 적정이고, 연결 누수를 막기 위해 try-with-resources가 필수입니다. 여기까지가 JDBC를 직접 다루는 저수준 데이터 접근의 기초입니다. 다음 글부터는 이 위에 올라가는 영속성 추상화, JPA의 세계로 넘어갑니다.

---

**지난 글:** [JDBC 배치 — 여러 SQL을 한 번에 모아 보내기](/posts/java-jdbc-batch/)

**다음 글:** [JPA 개요 — 객체와 관계형 데이터베이스의 다리](/posts/java-jpa-overview/)

<br>
읽어주셔서 감사합니다. 😊
