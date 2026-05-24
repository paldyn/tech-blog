---
title: "SQLite 모바일·임베디드 환경 활용"
description: "Android Room, iOS Core Data, IoT 디바이스, WebAssembly 브라우저 환경에서 SQLite를 활용하는 방법과 오프라인-퍼스트 동기화 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 9
type: "knowledge"
category: "SQL"
tags: ["SQLite", "Android", "iOS", "IoT", "WebAssembly", "오프라인", "모바일"]
featured: false
draft: false
---

[지난 글](/posts/sqlite-fts5/)에서 전문 검색을 살펴봤다. SQLite가 가장 많이 사용되는 환경은 바로 **모바일·임베디드 플랫폼**이다. Android, iOS, IoT 디바이스, 심지어 브라우저 WebAssembly까지 — SQLite는 코드 한 줄 없이도 OS 안에 이미 존재한다.

## Android에서의 SQLite

Android는 SQLite를 OS 내장 DB로 포함한다. 앱별로 `/data/data/{패키지명}/databases/` 디렉토리에 DB 파일이 생성된다.

![SQLite 플랫폼별 사용 패턴](/assets/posts/sqlite-mobile-embedded-platforms.svg)

### Room (Jetpack 권장 방식)

```kotlin
// Room은 SQLite 위에서 컴파일 타임 검증 + 비동기 처리를 제공
// build.gradle.kts
dependencies {
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    kapt("androidx.room:room-compiler:2.6.1")
}

// Entity (테이블)
@Entity(tableName = "notes")
data class Note(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    @ColumnInfo(name = "title") val title: String,
    @ColumnInfo(name = "body")  val body: String,
    @ColumnInfo(name = "updated_at") val updatedAt: Long = System.currentTimeMillis()
)

// DAO (Data Access Object)
@Dao
interface NoteDao {
    @Query("SELECT * FROM notes ORDER BY updated_at DESC")
    fun getAllNotes(): Flow<List<Note>>

    @Query("SELECT * FROM notes WHERE title LIKE :query OR body LIKE :query")
    suspend fun search(query: String): List<Note>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(note: Note)

    @Delete
    suspend fun delete(note: Note)
}

// Database
@Database(entities = [Note::class], version = 2)
abstract class AppDatabase : RoomDatabase() {
    abstract fun noteDao(): NoteDao

    companion object {
        @Volatile private var instance: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase =
            instance ?: synchronized(this) {
                Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "notes.db"
                )
                .addMigrations(MIGRATION_1_2)
                .build()
                .also { instance = it }
            }
    }
}

// 마이그레이션
val MIGRATION_1_2 = object : Migration(1, 2) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE notes ADD COLUMN tags TEXT DEFAULT ''")
    }
}
```

### WAL 모드와 SQLCipher

```kotlin
// Room에서 WAL 모드 + 연결 설정
Room.databaseBuilder(context, AppDatabase::class.java, "app.db")
    .setJournalMode(RoomDatabase.JournalMode.WRITE_AHEAD_LOGGING)
    .build()

// SQLCipher로 DB 파일 암호화 (민감 데이터 보호)
// implementation("net.zetetic:android-database-sqlcipher:4.5.4")
val passphrase = SQLiteDatabase.getBytes("패스워드".toCharArray())
val factory = SupportFactory(passphrase)
Room.databaseBuilder(context, AppDatabase::class.java, "secure.db")
    .openHelperFactory(factory)
    .build()
```

## iOS/macOS에서의 SQLite

iOS도 SQLite를 OS에 내장한다. Core Data는 내부적으로 SQLite를 사용하며, 직접 SQLite API를 호출하거나 GRDB.swift 같은 라이브러리를 쓸 수도 있다.

```swift
// GRDB.swift로 SQLite 직접 접근
// Swift Package Manager: https://github.com/groue/GRDB.swift

import GRDB

// DB 정의
struct Player: Codable, FetchableRecord, PersistableRecord {
    var id: Int64?
    var name: String
    var score: Int

    static var databaseTableName = "players"
}

// DB 열기
let dbPath = try FileManager.default
    .url(for: .applicationSupportDirectory, in: .userDomainMask, ...)
    .appendingPathComponent("app.sqlite").path

let dbQueue = try DatabaseQueue(path: dbPath)

// 마이그레이션
var migrator = DatabaseMigrator()
migrator.registerMigration("v1") { db in
    try db.create(table: "players") { t in
        t.autoIncrementedPrimaryKey("id")
        t.column("name", .text).notNull()
        t.column("score", .integer).notNull().defaults(to: 0)
    }
}
try migrator.migrate(dbQueue)

// 읽기/쓰기
let topPlayers = try dbQueue.read { db in
    try Player.order(Column("score").desc).limit(10).fetchAll(db)
}

try dbQueue.write { db in
    var player = Player(name: "홍길동", score: 100)
    try player.insert(db)
}
```

## IoT·임베디드 시스템

IoT 디바이스에서는 플래시 메모리 수명 보호와 낮은 메모리가 핵심 제약이다.

```python
import sqlite3
import time

# Raspberry Pi 센서 데이터 수집
def setup_iot_db(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    # 플래시 보호: 배터리 없는 환경에서 전원 차단 시 데이터 손실 감수
    conn.execute("PRAGMA synchronous = OFF")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA cache_size = -4000")   # 4MB 캐시
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sensor_data (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            sensor_id TEXT    NOT NULL,
            value     REAL    NOT NULL,
            ts        INTEGER NOT NULL  -- Unix 타임스탬프
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_sensor_ts
        ON sensor_data(sensor_id, ts)
    """)
    conn.commit()
    return conn

def collect_sensor(conn: sqlite3.Connection, sensor_id: str, value: float):
    conn.execute(
        "INSERT INTO sensor_data(sensor_id, value, ts) VALUES(?,?,?)",
        (sensor_id, value, int(time.time()))
    )
    # 배치 커밋: 1분마다 한 번
    # conn.commit()  → 별도 스레드에서 주기적으로 호출

# 오래된 데이터 정리 (디스크 용량 관리)
def cleanup_old_data(conn: sqlite3.Connection, days: int = 7):
    cutoff = int(time.time()) - (days * 86400)
    conn.execute("DELETE FROM sensor_data WHERE ts < ?", (cutoff,))
    conn.execute("VACUUM")
    conn.commit()
```

## WebAssembly 브라우저 환경

SQLite는 WebAssembly로 컴파일해 브라우저에서도 실행할 수 있다.

```javascript
// sql.js: 인메모리 SQLite (페이지 새로고침 시 데이터 소멸)
import initSqlJs from 'sql.js';

const SQL = await initSqlJs({
    locateFile: file => `/static/${file}`  // sqlite3.wasm 경로
});

const db = new SQL.Database();
db.run("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)");
db.run("INSERT INTO users VALUES (1, '홍길동')");

const result = db.exec("SELECT * FROM users");
console.log(result[0].values);  // [[1, "홍길동"]]

// 영구 저장: Uint8Array로 직렬화 → LocalStorage 또는 OPFS
const data = db.export();
localStorage.setItem('db', JSON.stringify(Array.from(data)));

// wa-sqlite + OPFS (Origin Private File System): 영구 저장
// import { default as moduleFactory } from 'wa-sqlite/dist/wa-sqlite-async.mjs';
// const module = await moduleFactory();
// const sqlite3 = SQLiteESMFactory(module);
```

## 오프라인-퍼스트 패턴

모바일 앱에서 SQLite를 로컬 캐시로 사용하면서 서버와 동기화하는 패턴은 "오프라인-퍼스트"라 부른다.

![오프라인-퍼스트 동기화 패턴](/assets/posts/sqlite-mobile-embedded-sync.svg)

```sql
-- 로컬 변경 큐 테이블 (동기화 대기 항목)
CREATE TABLE pending_sync (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    operation   TEXT    NOT NULL,  -- INSERT / UPDATE / DELETE
    entity_type TEXT    NOT NULL,  -- 'note', 'task' 등
    entity_id   TEXT    NOT NULL,
    payload     TEXT,              -- JSON
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    retry_count INTEGER NOT NULL DEFAULT 0
);

-- 변경 발생 시 로컬 저장 + 큐 등록
BEGIN IMMEDIATE;
INSERT INTO notes(title, body) VALUES('제목', '내용');
INSERT INTO pending_sync(operation, entity_type, entity_id, payload)
VALUES('INSERT', 'note', last_insert_rowid(),
       json_object('title', '제목', 'body', '내용'));
COMMIT;

-- 동기화 완료 후 큐에서 제거
DELETE FROM pending_sync WHERE id = ?;

-- 마지막 동기화 이후 서버 변경분 조회 쿼리 (서버 측)
SELECT * FROM notes
WHERE updated_at > ?  -- 마지막 sync 타임스탬프
ORDER BY updated_at;
```

SQLite는 독립 서버 없이도 완전한 SQL 환경을 제공한다. 오프라인 기능, 로컬 캐싱, 민감 데이터 암호화, 배터리 효율적 동기화 — 이 모든 것을 단일 파일 DB 하나로 구현할 수 있다는 점이 SQLite를 세상에서 가장 많이 배포된 DB로 만든 이유다.

---

**지난 글:** [SQLite FTS5 — 전문 검색 구현하기](/posts/sqlite-fts5/)

**다음 글:** [SQLite의 한계와 사용하면 안 되는 경우](/posts/sqlite-limitations/)

<br>
읽어주셔서 감사합니다. 😊
