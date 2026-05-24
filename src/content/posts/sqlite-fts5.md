---
title: "SQLite FTS5 — 전문 검색 구현하기"
description: "SQLite FTS5 가상 테이블로 전문 검색을 구현하는 방법, 역 인덱스 구조, MATCH 쿼리 문법, BM25 랭킹, highlight·snippet 보조 함수, 한국어 처리 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["SQLite", "FTS5", "전문검색", "역인덱스", "BM25", "한국어검색"]
featured: false
draft: false
---

[지난 글](/posts/sqlite-concurrency-single-writer/)에서 SQLite 동시성 모델을 살펴봤다. 이번에는 SQLite가 기본 제공하는 **FTS5(Full-Text Search 5)** 전문 검색 엔진을 다룬다. 별도 검색 서버 없이 SQLite 안에서 BM25 랭킹 검색을 구현할 수 있다.

## FTS5란

FTS5는 SQLite의 **가상 테이블(Virtual Table)** 확장으로, 텍스트 필드에 대한 역 인덱스를 자동으로 관리한다. 일반 `LIKE '%키워드%'` 검색과 달리 인덱스를 사용해 빠르고, BM25 알고리즘으로 관련성 순 정렬도 가능하다.

![SQLite FTS5 — 전문 검색 구조](/assets/posts/sqlite-fts5-architecture.svg)

```sql
-- FTS5 지원 여부 확인
SELECT sqlite_compileoption_used('ENABLE_FTS5');
-- 1이면 활성화

-- 또는
SELECT * FROM pragma_compile_options
WHERE compile_options LIKE 'ENABLE_FTS5%';
```

## 기본 사용법

### FTS5 가상 테이블 생성

```sql
-- 기본 FTS5 테이블
CREATE VIRTUAL TABLE articles USING fts5(
    title,
    body,
    tokenize = 'unicode61'
);

-- 외부 콘텐츠 테이블 연결 (원본 테이블 따로 유지)
CREATE TABLE docs (
    id      INTEGER PRIMARY KEY,
    title   TEXT,
    body    TEXT,
    created TEXT
);

CREATE VIRTUAL TABLE docs_fts USING fts5(
    title, body,
    content = 'docs',      -- 원본 테이블
    content_rowid = 'id'   -- rowid 매핑
);

-- 초기 인덱싱
INSERT INTO docs_fts(docs_fts) VALUES('rebuild');
```

### 데이터 삽입과 검색

```sql
-- FTS5 직접 테이블에 삽입
INSERT INTO articles(title, body) VALUES
    ('SQLite 소개', 'SQLite는 가볍고 빠른 임베디드 데이터베이스입니다'),
    ('PostgreSQL 가이드', '고성능 관계형 데이터베이스 PostgreSQL의 특징'),
    ('전문 검색 구현', 'FTS5를 사용한 SQLite 전문 검색 예제');

-- 기본 검색
SELECT rowid, title
FROM articles
WHERE articles MATCH 'SQLite';

-- BM25 관련성 점수 정렬
SELECT rowid, title, bm25(articles) AS score
FROM articles
WHERE articles MATCH 'SQLite'
ORDER BY score;  -- 음수값: 더 관련성 높을수록 절댓값 큼
```

## MATCH 쿼리 문법

![FTS5 쿼리 문법과 보조 함수](/assets/posts/sqlite-fts5-query.svg)

```sql
-- AND 연산 (두 단어 모두 포함)
SELECT title FROM articles
WHERE articles MATCH 'SQLite AND 빠른';

-- OR 연산
SELECT title FROM articles
WHERE articles MATCH 'SQLite OR PostgreSQL';

-- NOT 연산
SELECT title FROM articles
WHERE articles MATCH '데이터베이스 NOT MySQL';

-- 구문 검색 (연속 단어)
SELECT title FROM articles
WHERE articles MATCH '"임베디드 데이터베이스"';

-- 접두사 검색 (* 사용)
SELECT title FROM articles
WHERE articles MATCH '데이터*';  -- 데이터, 데이터베이스, 데이터뱅크 등

-- 컬럼 한정 검색
SELECT title FROM articles
WHERE articles MATCH 'title:SQLite';  -- title 컬럼에서만 검색

SELECT title FROM articles
WHERE articles MATCH 'title:SQLite body:빠른';  -- 각 컬럼에서 검색

-- NEAR 근접 검색 (10토큰 이내)
SELECT title FROM articles
WHERE articles MATCH 'NEAR(SQLite 검색, 10)';
```

## 보조 함수

FTS5는 검색 결과를 풍부하게 만드는 세 가지 보조 함수를 제공한다.

```sql
-- highlight(): 검색어 강조 표시
-- 인수: (테이블명, 컬럼인덱스, 시작태그, 끝태그)
SELECT
    rowid,
    highlight(articles, 0, '<mark>', '</mark>') AS title_hl,
    highlight(articles, 1, '<mark>', '</mark>') AS body_hl
FROM articles
WHERE articles MATCH 'SQLite';
-- 결과: "<mark>SQLite</mark>는 가볍고 빠른 임베디드..."

-- snippet(): 관련 부분 발췌
-- 인수: (테이블명, 컬럼인덱스, 시작태그, 끝태그, 생략기호, 토큰수)
SELECT
    rowid,
    snippet(articles, 1, '<b>', '</b>', '...', 15) AS excerpt
FROM articles
WHERE articles MATCH '전문 검색';

-- bm25(): 관련성 점수
-- 컬럼별 가중치 조정 (제목 가중치를 본문의 5배로)
SELECT title, bm25(articles, 5.0, 1.0) AS score
FROM articles
WHERE articles MATCH 'SQLite'
ORDER BY score;
```

## 외부 콘텐츠 테이블과 동기화

원본 데이터를 FTS5와 별도로 관리할 때 트리거로 동기화한다.

```sql
-- 원본 테이블
CREATE TABLE posts (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    title   TEXT NOT NULL,
    content TEXT NOT NULL,
    updated TEXT DEFAULT (datetime('now'))
);

-- FTS5 외부 콘텐츠 테이블
CREATE VIRTUAL TABLE posts_fts USING fts5(
    title, content,
    content = 'posts',
    content_rowid = 'id'
);

-- 동기화 트리거
CREATE TRIGGER posts_ai AFTER INSERT ON posts BEGIN
    INSERT INTO posts_fts(rowid, title, content)
    VALUES (new.id, new.title, new.content);
END;

CREATE TRIGGER posts_au AFTER UPDATE ON posts BEGIN
    INSERT INTO posts_fts(posts_fts, rowid, title, content)
    VALUES ('delete', old.id, old.title, old.content);
    INSERT INTO posts_fts(rowid, title, content)
    VALUES (new.id, new.title, new.content);
END;

CREATE TRIGGER posts_ad AFTER DELETE ON posts BEGIN
    INSERT INTO posts_fts(posts_fts, rowid, title, content)
    VALUES ('delete', old.id, old.title, old.content);
END;
```

## 한국어 처리

기본 `unicode61` 토크나이저는 공백으로 단어를 분리한다. 한국어는 어절 단위 분리는 가능하지만 **형태소 분석이 없어** 검색 정확도가 낮다. 대안:

### trigram 토크나이저 (부분 문자열 검색)

```sql
-- trigram: 3글자씩 쪼개 인덱싱 → 부분 문자열 검색 가능
CREATE VIRTUAL TABLE articles_tri USING fts5(
    title, body,
    tokenize = 'trigram'
);

-- "SQLite" → "SQL", "QLi", "Lit", "ite" 등으로 분리
-- 짧은 단어도 검색 가능, 인덱스 크기 증가
INSERT INTO articles_tri SELECT title, body FROM articles;

SELECT title FROM articles_tri
WHERE articles_tri MATCH '데이터베이스';  -- 부분 문자열도 매칭
```

### Python에서 형태소 분석 후 저장

```python
import sqlite3

# konlpy 등 형태소 분석기로 토큰화 후 저장
try:
    from konlpy.tag import Okt
    okt = Okt()
    def tokenize(text: str) -> str:
        return ' '.join(okt.morphs(text))
except ImportError:
    def tokenize(text: str) -> str:
        return text  # fallback: 원문 그대로

conn = sqlite3.connect("blog.db")
conn.execute("""
    CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
        tokens,          -- 형태소 분석 결과
        content = '',    -- contentless (별도 저장)
        tokenize = 'unicode61'
    )
""")

def index_post(post_id: int, title: str, body: str):
    tokens = tokenize(title + ' ' + body)
    conn.execute(
        "INSERT INTO posts_fts(rowid, tokens) VALUES (?, ?)",
        (post_id, tokens)
    )
    conn.commit()

def search(query: str):
    tokens = tokenize(query)
    return conn.execute(
        """SELECT rowid, bm25(posts_fts) AS score
           FROM posts_fts
           WHERE posts_fts MATCH ?
           ORDER BY score LIMIT 10""",
        (tokens,)
    ).fetchall()
```

## FTS5 유지보수

```sql
-- 인덱스 최적화 (세그먼트 병합)
INSERT INTO articles(articles) VALUES('optimize');

-- 인덱스 전체 재빌드
INSERT INTO articles(articles) VALUES('rebuild');

-- 무결성 검사
INSERT INTO articles(articles, rank) VALUES('integrity-check', 1);

-- 인덱스 통계
SELECT * FROM articles WHERE articles MATCH 'SQLite';
-- 내부적으로 fts_data, fts_idx, fts_content 테이블 사용
```

FTS5는 Elasticsearch나 Typesense 같은 전용 검색 엔진의 대안은 아니지만, 서버 없이 SQLite 하나로 기본적인 전문 검색을 구현하기에 충분한 기능을 제공한다. 특히 모바일 앱의 오프라인 검색, 데스크탑 앱의 로컬 검색, 소규모 콘텐츠 사이트에 이상적이다.

---

**지난 글:** [SQLite 동시성과 단일 writer 모델](/posts/sqlite-concurrency-single-writer/)

**다음 글:** [SQLite 모바일·임베디드 환경 활용](/posts/sqlite-mobile-embedded/)

<br>
읽어주셔서 감사합니다. 😊
