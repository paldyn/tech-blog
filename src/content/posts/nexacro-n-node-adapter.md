---
title: "[Nexacro N] Node.js 어댑터"
description: "Nexacro N을 Node.js 기반 서버와 연동하는 방법을 설명합니다. nexacro-node-adapter 패키지를 사용한 Express 서버 구성, 서비스 모듈 작성, async/await 패턴, DB 연동까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 5
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "nodejs", "express", "어댑터", "async-await", "postgresql"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-java-adapter/)에서 Java 어댑터의 내부 구조와 DataSet API를 살펴보았다. 이번에는 Node.js 어댑터를 사용해 Nexacro N과 Express 서버를 연동하는 방법을 다룬다.

Java 생태계가 아닌 JavaScript 풀스택 환경이나 경량 BFF(Backend for Frontend) 레이어를 구성할 때 Node.js 어댑터가 유용하다. `async/await`를 완전히 지원하므로 비동기 DB 쿼리나 외부 API 호출을 자연스럽게 처리할 수 있다.

## 구조 개요

![Nexacro N + Node.js 어댑터 구조](/assets/posts/nexacro-n-node-adapter-arch.svg)

Node.js 어댑터는 Express 미들웨어 형태로 제공된다. `nexacro.bodyParser()`가 HTTP 요청에서 PL 스트림을 파싱해 `dsIn`, `dsOut`, `vl` 객체를 생성하고, `nexacro.dispatcher(services)`가 서비스 ID를 기반으로 서비스 함수를 호출한다.

## 설치 및 기본 설정

```bash
npm install nexacro-node-adapter express pg
```

![Node.js 어댑터 서비스 코드](/assets/posts/nexacro-n-node-adapter-code.svg)

`app.js`에서 어댑터를 등록하고 서비스 모듈을 연결한다.

```javascript
const express = require('express');
const nexacro = require('nexacro-node-adapter');
const userService = require('./services/UserService');

const services = {
    UserService: userService,
    OrderService: require('./services/OrderService'),
};

const app = express();
app.use(nexacro.bodyParser());
app.post('/nexacro/svc', nexacro.dispatcher(services));
app.listen(3000, () => console.log('Nexacro adapter ready on :3000'));
```

`services` 객체의 키가 서비스 클래스 이름에 해당한다. 클라이언트 `transaction()`에서 `SVC::UserService::search`로 호출하면 `services.UserService.search`가 실행된다.

## 서비스 모듈 작성

```javascript
// services/UserService.js
const db = require('../db');

module.exports = {
    search: async (dsIn, dsOut, vl) => {
        const userId = dsIn.getString(0, 'USER_ID');
        const userNm = dsIn.getString(0, 'USER_NM');

        const { rows } = await db.query(
            'SELECT user_id, user_nm, email FROM users WHERE user_id ILIKE $1 AND user_nm ILIKE $2',
            [`%${userId}%`, `%${userNm}%`]
        );

        dsOut.fromRows(rows);  // rows 배열을 DataSet으로 변환
        vl.set('errCode', '0');
        vl.set('errMsg', `${rows.length}건 조회`);
    },

    save: async (dsIn, dsOut, vl) => {
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            for (let i = 0; i < dsIn.rowCount; i++) {
                const rowType = dsIn.getRowType(i);
                const row = dsIn.toRow(i);

                if (rowType === 'inserted') {
                    await client.query(
                        'INSERT INTO users(user_id, user_nm) VALUES($1, $2)',
                        [row.USER_ID, row.USER_NM]
                    );
                } else if (rowType === 'updated') {
                    await client.query(
                        'UPDATE users SET user_nm=$1 WHERE user_id=$2',
                        [row.USER_NM, row.USER_ID]
                    );
                } else if (rowType === 'deleted') {
                    await client.query('DELETE FROM users WHERE user_id=$1', [row.USER_ID]);
                }
            }

            await client.query('COMMIT');
            vl.set('errCode', '0');
            vl.set('errMsg', '저장 완료');
        } catch (err) {
            await client.query('ROLLBACK');
            vl.set('errCode', 'DB_ERR');
            vl.set('errMsg', err.message);
        } finally {
            client.release();
        }
    },
};
```

## DB 연결 설정

PostgreSQL 연결 풀을 `db.js`로 분리한다.

```javascript
// db.js
const { Pool } = require('pg');

const pool = new Pool({
    host:     process.env.DB_HOST,
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASS,
    port:     5432,
    max:      20,
});

module.exports = {
    pool,
    query: (text, params) => pool.query(text, params),
};
```

MySQL을 사용한다면 `pg` 대신 `mysql2/promise`를 사용하고, `pool.query()` API 형식을 그에 맞게 조정한다.

## 오류 처리 미들웨어

```javascript
// 어댑터 레벨 오류 처리
app.post('/nexacro/svc', nexacro.dispatcher(services), (err, req, res, next) => {
    if (err) {
        nexacro.sendError(res, 'SERVER_ERR', err.message);
    }
});
```

서비스 함수에서 예외가 발생하면 `nexacro.sendError()`로 PL 오류 응답을 반환한다. 클라이언트 콜백의 `errCode`가 `'SERVER_ERR'`로 전달된다.

## Java 어댑터 vs Node.js 어댑터

| 항목 | Java 어댑터 | Node.js 어댑터 |
|---|---|---|
| 언어 | Java | JavaScript |
| 프레임워크 | Spring Boot | Express / Fastify |
| 비동기 | 스레드 풀 | async/await 이벤트 루프 |
| 배포 | WAR/JAR | PM2 / Docker |
| 주요 사용처 | 엔터프라이즈 ERP | BFF·API 게이트웨이 |

---

**지난 글:** [Java 어댑터 심화](/posts/nexacro-n-java-adapter/)

**다음 글:** [DB 연동 패턴](/posts/nexacro-n-db-integration/)

<br>
읽어주셔서 감사합니다. 😊
