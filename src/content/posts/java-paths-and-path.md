---
title: "Path API — 경로 표현의 표준"
description: "Java Path 인터페이스와 Paths 팩토리 완전 정복 — Path.of(), resolve, relativize, normalize, getParent/getFileName, Path↔File↔URI 상호 변환"
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "Path", "NIO2", "Paths", "java.nio.file", "파일경로", "resolve", "relativize"]
featured: false
draft: false
---

[지난 글](/posts/java-files-class/)에서 `Files` 유틸리티 클래스로 파일을 읽고 쓰고 탐색하는 법을 다뤘다. `Files`의 모든 메서드는 인자로 `Path`를 받는다. 이번에는 **`Path` 인터페이스 자체**를 깊이 파고든다 — 경로를 생성하고, 조합하고, 분해하고, 비교하는 모든 패턴을 정리한다.

## Path란 무엇인가

`Path`는 `java.nio.file` 패키지에 속하는 **인터페이스**다. 파일 시스템 경로를 표현하는 불변(immutable) 객체로, 실제 파일의 존재 여부와 무관하다. Java 7 이전의 `java.io.File` 클래스를 대체하기 위해 설계됐으며, OS별 파일 시스템 구현(Unix, Windows)을 `FileSystem` 인터페이스 뒤로 추상화한다.

```java
// Java 11+ 권장: Path.of()
Path p1 = Path.of("/home/user/docs");

// Java 7+: Paths.get() — 동일 결과
Path p2 = Paths.get("/home", "user", "docs");

// 여러 인자를 넘기면 OS 구분자로 결합
Path p3 = Path.of("user", "docs", "report.pdf");
// Unix: user/docs/report.pdf
// Windows: user\docs\report.pdf
```

`Path.of()`는 Java 11에서 `Paths.get()`의 편의 메서드로 추가됐다. 결과는 동일하지만 정적 팩토리 패턴에 더 부합하므로 Java 11 이상에서는 `Path.of()`를 쓰는 게 관례다.

![Path API 구조 다이어그램](/assets/posts/java-paths-and-path-api.svg)

## 경로 조작 메서드

### resolve — 경로 이어붙이기

`resolve(other)`는 현재 경로에 `other`를 이어붙인다. `other`가 절대 경로면 `other` 자체를 반환한다.

```java
Path base = Path.of("/home/user");
Path docs = base.resolve("docs");         // /home/user/docs
Path abs  = base.resolve("/tmp/x");       // /tmp/x (other가 절대경로)
Path file = docs.resolve("report.pdf");   // /home/user/docs/report.pdf
```

### relativize — 상대 경로 계산

`relativize(target)`는 현재 경로에서 `target`으로 가는 상대 경로를 반환한다. 두 경로 모두 절대이거나 모두 상대여야 한다.

```java
Path base   = Path.of("/home/user");
Path target = Path.of("/home/user/docs/report.pdf");
Path rel    = base.relativize(target);  // docs/report.pdf

// 역방향
Path other  = Path.of("/home/user/images");
Path rel2   = other.relativize(target); // ../docs/report.pdf
```

### normalize — 불필요한 요소 제거

`.` (현재 디렉터리)와 `..` (상위 디렉터리) 참조를 제거한다. 심볼릭 링크는 추적하지 않는다 — 링크까지 완전히 해소하려면 `toRealPath()`를 사용한다.

```java
Path messy = Path.of("/a/b/../c/./d");
Path clean = messy.normalize();  // /a/c/d

// toRealPath()는 실제 파일이 존재해야 동작
Path real = messy.toRealPath();  // IOException 가능
```

### toAbsolutePath — 절대 경로 변환

상대 경로를 현재 작업 디렉터리(cwd)와 결합해 절대 경로로 변환한다. 파일이 실제로 존재할 필요가 없다.

```java
Path rel = Path.of("data/input.csv");
Path abs = rel.toAbsolutePath();  // cwd + /data/input.csv
```

## 경로 분해

`Path`는 OS 구분자로 나뉜 각 요소에 인덱스로 접근할 수 있다.

```java
Path p = Path.of("/home/user/docs/report.pdf");

p.getFileName();          // report.pdf
p.getParent();            // /home/user/docs
p.getRoot();              // /  (Windows: C:\)
p.getNameCount();         // 4
p.getName(0);             // home
p.getName(3);             // report.pdf
p.subpath(1, 3);          // user/docs

p.isAbsolute();           // true
p.startsWith("/home");    // true
p.endsWith("report.pdf"); // true
```

![Path 코드 패턴](/assets/posts/java-paths-and-path-code.svg)

## 경로 비교

`Path`는 `Comparable<Path>`를 구현한다. `equals()`는 OS 문자열 비교를 따르므로 Windows에서는 대소문자 무시, Unix에서는 구분한다.

```java
Path a = Path.of("/home/user");
Path b = Path.of("/home/user");
a.equals(b);                  // true
a.compareTo(b);               // 0

// Paths.get() vs Path.of() 동등
Paths.get("/home").equals(Path.of("/home")); // true
```

`Files.isSameFile(p1, p2)`는 심볼릭 링크까지 해소해 실제 동일 파일인지 확인한다. 단순 경로 문자열 비교와 다르다.

## 상호 변환

레거시 코드나 외부 라이브러리와 통합할 때 `Path ↔ File ↔ URI` 변환이 필요하다.

```java
Path path = Path.of("/home/user/report.pdf");

// Path → File (레거시 API 호환)
File file = path.toFile();

// File → Path
Path back = file.toPath();

// Path → URI
URI uri = path.toUri();  // file:///home/user/report.pdf

// URI → Path
Path fromUri = Path.of(uri);

// String으로 출력
String s = path.toString();   // /home/user/report.pdf
```

## 경로 순회 (Iterator)

`Path`는 `Iterable<Path>`를 구현하므로 for-each로 각 요소를 순회할 수 있다.

```java
Path p = Path.of("/home/user/docs");
for (Path element : p) {
    System.out.println(element); // home → user → docs
}
// 루트("/")는 포함되지 않음
```

## File vs Path 비교

| 항목 | `java.io.File` | `java.nio.file.Path` |
|------|--------------|---------------------|
| 설계 연도 | Java 1.0 | Java 7 (NIO.2) |
| 불변성 | 불변 | 불변 |
| 오류 처리 | 반환값 `false` | `IOException` throw |
| 심볼릭 링크 | 제한적 | `toRealPath()` 완전 지원 |
| 문자열 결합 | `new File(parent, child)` | `resolve()` |
| 권장 여부 | 레거시 | 현대 Java 표준 |

Java 7 이전 API를 사용하는 서드파티 라이브러리가 `File`을 요구할 때는 `path.toFile()`로 변환하면 된다. 그 외에는 항상 `Path`를 사용하자.

## 핵심 정리

- `Path.of()` (Java 11+) 또는 `Paths.get()`으로 경로 생성
- `resolve()` = 경로 이어붙이기, `relativize()` = 상대 경로 계산
- `normalize()` = `..`·`.` 제거, `toRealPath()` = 심볼릭 링크까지 해소
- `getFileName()` / `getParent()` / `getNameCount()` / `getName(i)` 로 경로 분해
- `Path`는 불변 — 모든 변환 메서드는 새 `Path` 반환

---

**다음 글:** [NIO 채널과 버퍼 — 고성능 I/O의 핵심](/posts/java-nio-channels-buffers/)

<br>
읽어주셔서 감사합니다. 😊
