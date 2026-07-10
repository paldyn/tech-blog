---
title: "Java finalize() 제거 — try-with-resources와 Cleaner 대안"
description: "Object.finalize()가 Java 9에서 deprecated되고 Java 18에서 forRemoval로 강화된 이유, finalize()의 4가지 근본적 문제점, 그리고 AutoCloseable+try-with-resources와 java.lang.ref.Cleaner를 활용한 올바른 자원 관리 방법"
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 8
type: "knowledge"
category: "Java"
tags: ["Java", "finalize", "AutoCloseable", "try-with-resources", "Cleaner", "자원 관리", "GC"]
featured: false
draft: false
---

[지난 글](/posts/java-clone/)에서 `clone()` 메서드와 복사 생성자 대안을 살펴봤다. 이번에는 `Object`의 또 다른 문제적 메서드인 **`finalize()`**를 다룬다. 왜 폐기됐는지, 그리고 올바른 자원 관리 방법은 무엇인지 살펴본다.

## finalize()란

`Object.finalize()`는 객체가 GC에 의해 수거되기 직전에 호출되도록 설계됐다. 파일 핸들, 네이티브 메모리, 소켓 같은 자원을 해제하는 마지막 기회로 사용하려는 의도였다.

```java
// Java 초기 의도 — 실제로 쓰면 안 됨
class NativeResource {
    private long nativeHandle;

    @Override
    protected void finalize() throws Throwable {
        try {
            releaseNative(nativeHandle); // 네이티브 자원 해제
        } finally {
            super.finalize();
        }
    }
}
```

그러나 `finalize()`에는 근본적인 설계 결함이 있어, 실제 코드에서 사용해서는 안 된다.

## 폐기 타임라인

```text
Java 1.0 (1996) : finalize() 도입
Java 9  (2017)  : @Deprecated 지정
Java 18 (2022)  : @Deprecated(forRemoval=true) 강화
Java 24+        : 완전 제거 예정
```

![finalize() 폐기 타임라인과 근본 문제](/assets/posts/java-finalize-removed-timeline.svg)

## 4가지 근본적 문제

**문제 1: 호출 보장 없음**

GC가 `finalize()`를 호출한다는 보장이 없다. 프로그램이 종료되기 전에 GC가 실행되지 않으면 `finalize()`는 영원히 호출되지 않을 수 있다. 자원 해제가 보장되지 않는다.

```java
// System.runFinalization()도 finalize() 호출을 보장하지 않음
// System.gc()도 GC 실행을 보장하지 않음
```

**문제 2: 성능 저하**

`finalize()`를 가진 객체는 GC 두 번에 걸쳐 처리된다. 첫 번째 GC에서 finalizer 큐에 등록되고, 별도 스레드(finalizer 스레드)가 처리한 후에야 두 번째 GC에서 수거된다. 생성 속도보다 finalizer 처리 속도가 느리면 OutOfMemoryError가 발생할 수 있다.

**문제 3: 보안 취약점**

생성자에서 예외가 발생해도 `finalize()`는 실행된다. 공격자가 이를 이용해 불완전한 객체에 대한 참조를 획득할 수 있다.

```java
// 공격 패턴 예시
class Vulnerable {
    Vulnerable() {
        if (condition) throw new SecurityException();
        // 이후 finalize()가 실행되어 공격에 노출
    }

    @Override
    protected void finalize() {
        // 이 시점에 객체 참조를 어딘가에 저장 가능 (객체 부활)
        GLOBAL_REF = this; // 부활!
    }
    static Vulnerable GLOBAL_REF;
}
```

**문제 4: 예외 무시**

`finalize()` 안에서 발생한 예외는 무시되고 스택 트레이스도 출력되지 않는다. 자원 해제 실패가 조용히 사라진다.

## 대안 1: AutoCloseable + try-with-resources

자원 해제의 주된 방법은 `AutoCloseable` 인터페이스 구현과 `try-with-resources`다.

```java
class DatabaseConnection implements AutoCloseable {
    private final Connection conn;

    DatabaseConnection(String url) throws SQLException {
        this.conn = DriverManager.getConnection(url);
    }

    public ResultSet query(String sql) throws SQLException {
        return conn.createStatement().executeQuery(sql);
    }

    @Override
    public void close() throws Exception {
        conn.close();
        System.out.println("연결 해제");
    }
}

// try-with-resources: 블록 종료 시 자동으로 close() 호출
try (DatabaseConnection db = new DatabaseConnection(url)) {
    ResultSet rs = db.query("SELECT * FROM users");
    // 정상 종료 또는 예외 발생 시 close() 보장
}
```

예외 발생 여부와 무관하게 `close()`가 반드시 호출된다. `finally` 블록보다 더 안전하다.

```java
// 여러 자원 동시 관리
try (var in  = new FileInputStream("input.txt");
     var out = new FileOutputStream("output.txt")) {
    in.transferTo(out);
} // in, out 모두 close() — 역순으로 닫힘
```

![AutoCloseable + try-with-resources vs Cleaner](/assets/posts/java-finalize-removed-alternatives.svg)

## 대안 2: java.lang.ref.Cleaner (Java 9+)

`Cleaner`는 `finalize()`의 안전한 대체재다. `close()`를 호출하지 않았을 때 GC 시 자동 정리하는 **안전망(safety net)**으로 사용한다.

```java
import java.lang.ref.Cleaner;

class NativeBuffer implements AutoCloseable {
    private static final Cleaner CLEANER = Cleaner.create();

    private final long nativePtr;
    private final Cleaner.Cleanable cleanable;

    NativeBuffer(int size) {
        this.nativePtr = allocNative(size);
        // 정리 작업은 this를 참조하지 않는 별도 Runnable로 분리
        // (this 참조 시 GC 대상이 안 됨)
        long ptr = this.nativePtr;
        this.cleanable = CLEANER.register(this, () -> freeNative(ptr));
    }

    @Override
    public void close() {
        cleanable.clean(); // 명시적 해제
    }

    private static native long allocNative(int size);
    private static native void freeNative(long ptr);
}
```

`Cleaner`의 핵심 규칙: **정리 Runnable이 `this`를 참조하면 안 된다**. `this`를 참조하면 GC가 객체를 수거할 수 없어 Cleaner가 절대 실행되지 않는다. 필요한 값을 지역 변수에 캡처한다.

## finalize() 방어 패턴

다른 클래스를 상속받을 때 `finalize()`의 보안 취약점을 방지하는 패턴이다.

```java
class Base {
    // final finalize()로 서브클래스가 오버라이드 못 하게 봉인
    @Override
    protected final void finalize() { }
}
```

## 이미 finalize()를 사용 중이라면

Java 9+ 컴파일러 경고 `-Xlint:deprecation`이 나타나면 다음 순서로 마이그레이션한다.

1. 클래스에 `implements AutoCloseable` 추가
2. `finalize()` 로직을 `close()` 메서드로 이동
3. 호출자에서 `try-with-resources`로 교체
4. 안전망이 필요하면 `Cleaner` 등록 추가
5. `finalize()` 메서드 제거

`finalize()`는 Java 역사에서 가장 큰 실수 중 하나로 평가된다. 새 코드에서는 절대 사용하지 말고, 기존 코드도 마이그레이션을 검토하라. 다음 글에서는 **`Comparable`과 `Comparator`**를 다룬다. 자연 순서와 커스텀 정렬을 정의하는 두 인터페이스의 차이와 활용법을 살펴볼 것이다.

---

**지난 글:** [Java clone() — Cloneable과 깊은 복사·얕은 복사](/posts/java-clone/)

**다음 글:** [Java Comparable과 Comparator — 자연 순서와 커스텀 정렬](/posts/java-comparable-comparator/)

<br>
읽어주셔서 감사합니다. 😊
