---
title: "WatchService — 디렉터리 변경 감시"
description: "Java WatchService 완전 가이드 — 파일 생성/수정/삭제 이벤트 감지, WatchKey 상태 관리, key.reset() 필수 패턴, 재귀 감시 구현"
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 4
type: "knowledge"
category: "Java"
tags: ["Java", "WatchService", "WatchKey", "WatchEvent", "NIO2", "파일감시", "디렉터리모니터링"]
featured: false
draft: false
---

[지난 글](/posts/java-nio-selector/)에서 Selector로 네트워크 채널을 감시하는 법을 다뤘다. 이번에는 비슷한 개념을 파일 시스템에 적용한다. **`WatchService`**는 디렉터리 변경(파일 생성·수정·삭제)을 OS 네이티브 메커니즘으로 감시해 Java 애플리케이션에 이벤트를 전달한다.

## WatchService가 필요한 이유

설정 파일 자동 리로드, 핫 디플로이, 파일 동기화 도구 같은 기능은 디렉터리를 주기적으로 폴링하거나 OS 이벤트를 수신해야 한다. 폴링은 간단하지만 CPU 낭비가 크고 반응 속도가 느리다. `WatchService`는 OS 커널이 제공하는 이벤트 통지(`inotify`/`kqueue`/`FSEvents`)를 사용하므로 CPU 사용 없이 즉각 반응한다.

![WatchService 아키텍처](/assets/posts/java-watch-service-arch.svg)

## 핵심 클래스

| 클래스 | 역할 |
|--------|------|
| `WatchService` | 이벤트 큐, `take()`/`poll()`로 이벤트 수신 |
| `WatchKey` | 등록된 디렉터리당 1개, 이벤트 목록 보유 |
| `WatchEvent<T>` | 개별 이벤트, `kind()`와 `context()`로 정보 추출 |
| `StandardWatchEventKinds` | 이벤트 종류 상수 |

## 기본 사용 패턴

![WatchService 코드 패턴](/assets/posts/java-watch-service-code.svg)

```java
import static java.nio.file.StandardWatchEventKinds.*;

Path dir = Path.of("/watched");
try (WatchService watcher =
        FileSystems.getDefault().newWatchService()) {

    // 디렉터리를 WatchService에 등록
    dir.register(watcher,
        ENTRY_CREATE, ENTRY_MODIFY, ENTRY_DELETE);

    while (true) {
        WatchKey key = watcher.take(); // 이벤트 올 때까지 블로킹

        for (WatchEvent<?> evt : key.pollEvents()) {
            WatchEvent.Kind<?> kind = evt.kind();

            // OVERFLOW: 이벤트가 너무 많아 일부 유실
            if (kind == OVERFLOW) continue;

            // 변경된 파일의 상대 경로 (파일명만)
            Path changed = (Path) evt.context();
            Path fullPath = dir.resolve(changed);

            System.out.println(kind.name() + ": " + fullPath);
        }

        // 반드시 reset() 호출 — 없으면 다음 이벤트를 못 받음
        boolean valid = key.reset();
        if (!valid) break; // 디렉터리가 사라짐
    }
}
```

## 이벤트 종류

```java
// StandardWatchEventKinds의 세 가지 핵심 이벤트
ENTRY_CREATE  // 파일/디렉터리 생성
ENTRY_MODIFY  // 파일 내용 변경 (속성 변경은 OS에 따라 다름)
ENTRY_DELETE  // 파일/디렉터리 삭제
OVERFLOW      // 이벤트 큐 오버플로 — 일부 이벤트 유실 가능
```

`OVERFLOW` 이벤트는 이벤트가 너무 빠르게 쏟아져 큐가 넘칠 때 발생한다. 대량 파일 복사 같은 상황에서 나타난다. `context()`가 `null`이므로 반드시 `continue`로 건너뛴다.

## key.reset() — 절대 빠뜨리면 안 된다

`WatchKey`는 이벤트를 받으면 **Signalled** 상태로 전환되고 이 상태에서는 새 이벤트를 받지 못한다. `reset()`을 호출해야 **Ready** 상태로 돌아와 다음 이벤트를 수신할 수 있다. `reset()`이 `false`를 반환하면 감시 대상 디렉터리가 삭제됐다는 의미다.

```java
// 잘못된 패턴 (reset 없음 — 두 번째 이벤트부터 놓침)
for (WatchEvent<?> evt : key.pollEvents()) { ... }
// ← reset() 없음!

// 올바른 패턴
for (WatchEvent<?> evt : key.pollEvents()) { ... }
boolean valid = key.reset();
if (!valid) { /* 디렉터리 삭제됨 — 정리 */ }
```

## take() vs poll()

```java
// take() — 이벤트 올 때까지 무한 블로킹
WatchKey key = watcher.take();

// poll() — 즉시 반환 (이벤트 없으면 null)
WatchKey key = watcher.poll();

// poll(timeout) — 최대 timeout만큼 대기
WatchKey key = watcher.poll(5, TimeUnit.SECONDS);
```

백그라운드 스레드 루프에서는 `take()`를, 타임아웃이 필요하면 `poll(timeout)`을 사용한다.

## 여러 디렉터리 동시 감시

하나의 `WatchService`에 여러 디렉터리를 등록할 수 있다. `WatchKey`로 어느 디렉터리의 이벤트인지 구분한다.

```java
Map<WatchKey, Path> keyMap = new HashMap<>();

try (WatchService watcher =
        FileSystems.getDefault().newWatchService()) {

    for (Path dir : List.of(Path.of("/a"), Path.of("/b"))) {
        WatchKey key = dir.register(watcher, ENTRY_CREATE, ENTRY_DELETE);
        keyMap.put(key, dir);
    }

    while (true) {
        WatchKey key = watcher.take();
        Path dir = keyMap.get(key);

        for (WatchEvent<?> evt : key.pollEvents()) {
            Path full = dir.resolve((Path) evt.context());
            System.out.println(evt.kind() + ": " + full);
        }
        if (!key.reset()) {
            keyMap.remove(key);
            if (keyMap.isEmpty()) break;
        }
    }
}
```

## 재귀 감시 (하위 디렉터리 포함)

`WatchService`는 기본적으로 **등록한 디렉터리만** 감시한다. 하위 디렉터리까지 감시하려면 `Files.walkFileTree()`로 모두 등록하고, 새 디렉터리가 생길 때마다 추가로 등록한다.

```java
// 모든 하위 디렉터리 등록
Files.walkFileTree(root, new SimpleFileVisitor<>() {
    @Override
    public FileVisitResult preVisitDirectory(Path dir,
            BasicFileAttributes attrs) throws IOException {
        WatchKey key = dir.register(watcher,
            ENTRY_CREATE, ENTRY_MODIFY, ENTRY_DELETE);
        keyMap.put(key, dir);
        return FileVisitResult.CONTINUE;
    }
});

// 이벤트 루프에서 새 디렉터리 생성 감지 시 추가 등록
if (evt.kind() == ENTRY_CREATE) {
    Path newDir = dir.resolve((Path) evt.context());
    if (Files.isDirectory(newDir)) {
        WatchKey newKey = newDir.register(watcher,
            ENTRY_CREATE, ENTRY_MODIFY, ENTRY_DELETE);
        keyMap.put(newKey, newDir);
    }
}
```

## 백그라운드 스레드에서 실행

감시 루프는 블로킹이므로 별도 스레드(또는 가상 스레드)에서 실행한다.

```java
Thread.ofVirtual()
    .name("file-watcher")
    .start(() -> {
        try (WatchService watcher = /* ... */) {
            // ... 이벤트 루프
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (IOException e) {
            log.error("Watch error", e);
        }
    });
```

`InterruptedException`을 잡으면 반드시 `Thread.currentThread().interrupt()`로 인터럽트 상태를 복원한다.

## 주의사항

- **ENTRY_MODIFY가 두 번 오는 경우**: 일부 OS는 메타데이터 변경과 내용 변경을 각각 이벤트로 보낸다. 중복 처리 방지 로직이 필요할 수 있다.
- **파일 이름 변경**: 이름 변경은 `DELETE` + `CREATE` 쌍으로 온다. 원자적 rename 이벤트는 OS에 따라 다르다.
- **감시 대상은 디렉터리만**: 파일을 직접 등록할 수 없다. 파일이 담긴 디렉터리를 등록하고 `context()`로 파일명을 필터링한다.

## 핵심 정리

- `dir.register(watcher, ENTRY_CREATE, ENTRY_MODIFY, ENTRY_DELETE)`
- 이벤트 루프: `watcher.take()` → `key.pollEvents()` → **`key.reset()`**
- `reset()` = false면 디렉터리 삭제됨 — 루프 탈출
- `evt.context()`는 파일명만 (상대경로) → `dir.resolve()`로 절대경로 변환
- 재귀 감시 = `walkFileTree`로 모든 하위 디렉터리를 개별 등록

---

**지난 글:** [NIO Selector — 단일 스레드 다중 채널 I/O](/posts/java-nio-selector/)

**다음 글:** [AsynchronousFileChannel — 비동기 파일 I/O](/posts/java-async-file-channel/)

<br>
읽어주셔서 감사합니다. 😊
