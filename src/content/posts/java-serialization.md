---
title: "Java 직렬화 — 객체를 바이트로"
description: "Java Serialization 완전 가이드 — Serializable 인터페이스, ObjectOutputStream/InputStream, serialVersionUID, transient, writeObject/readObject 커스터마이징, readResolve"
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 6
type: "knowledge"
category: "Java"
tags: ["Java", "직렬화", "Serializable", "ObjectOutputStream", "serialVersionUID", "transient", "역직렬화"]
featured: false
draft: false
---

[지난 글](/posts/java-async-file-channel/)에서 `AsynchronousFileChannel`로 비동기 파일 I/O를 수행하는 법을 익혔다. 이번에는 Java의 고유 직렬화 메커니즘을 다룬다. **직렬화(Serialization)**는 객체의 상태를 바이트 스트림으로 변환해 파일에 저장하거나 네트워크로 전송하고, **역직렬화(Deserialization)**로 다시 복원하는 과정이다.

## Serializable — 마커 인터페이스

직렬화를 허용하려면 클래스가 `java.io.Serializable` 인터페이스를 구현해야 한다. 구현할 메서드는 없다. 이 인터페이스는 JVM에게 "이 클래스는 직렬화 가능하다"를 선언하는 마커다.

```java
import java.io.Serializable;

public class User implements Serializable {
    private static final long serialVersionUID = 1L;
    private String name;
    private int age;
    // 생성자, getter, setter ...
}
```

부모 클래스가 `Serializable`이면 자식 클래스도 자동으로 직렬화 가능하다. 반대로 부모가 `Serializable`이 아니면 자식이 구현해야 한다 — 이때 역직렬화 시 부모 클래스의 인자 없는 생성자가 호출된다.

![Java 직렬화 개요](/assets/posts/java-serialization-overview.svg)

## ObjectOutputStream / ObjectInputStream

```java
User user = new User("Alice", 30);

// 직렬화: 객체 → 파일
try (ObjectOutputStream oos = new ObjectOutputStream(
        new FileOutputStream("user.ser"))) {
    oos.writeObject(user);
}

// 역직렬화: 파일 → 객체
try (ObjectInputStream ois = new ObjectInputStream(
        new FileInputStream("user.ser"))) {
    User restored = (User) ois.readObject();
    System.out.println(restored.getName()); // Alice
}
```

역직렬화는 **생성자를 호출하지 않는다**. 바이트 스트림에서 필드 값을 직접 복원한다. 따라서 생성자 검증 로직이 우회될 수 있다는 점을 유의해야 한다.

## serialVersionUID

클래스를 직렬화하면 JVM이 `serialVersionUID`를 바이트 스트림에 기록한다. 역직렬화 시 스트림의 UID와 현재 클래스의 UID가 일치하지 않으면 `InvalidClassException`이 발생한다.

```java
// 명시하지 않으면 JVM이 자동 계산
// 클래스 구조(필드, 메서드 등) 변경 시 계산값이 달라짐 → 역직렬화 실패
private static final long serialVersionUID = 1L; // 명시 권장
```

`serialVersionUID`를 명시하면 하위 호환성을 직접 제어할 수 있다. 클래스에 필드를 추가해도 같은 UID를 유지하면 기존 데이터를 역직렬화할 수 있다 (새 필드는 기본값으로 초기화).

## transient — 직렬화 제외

민감한 데이터(비밀번호, 소켓, 스레드 등)는 `transient`로 직렬화에서 제외한다.

```java
public class Connection implements Serializable {
    private static final long serialVersionUID = 1L;
    private String host;
    private transient Socket socket;       // 직렬화 제외
    private transient String password;     // 직렬화 제외
    private static int connectionCount;    // static도 제외
}
```

역직렬화 시 `transient` 필드는 타입 기본값 (`null`, `0`, `false`)으로 초기화된다.

![직렬화 코드 패턴](/assets/posts/java-serialization-code.svg)

## writeObject / readObject 커스터마이징

기본 직렬화 동작을 재정의하려면 `private void writeObject(ObjectOutputStream oos)`와 `private void readObject(ObjectInputStream ois)`를 구현한다. 시그니처가 정확해야 JVM이 인식한다.

```java
public class SecureUser implements Serializable {
    private static final long serialVersionUID = 1L;
    private String name;
    private transient String password; // 암호화해서 저장

    private void writeObject(ObjectOutputStream oos)
            throws IOException {
        oos.defaultWriteObject(); // 기본 필드 직렬화
        // 비밀번호를 암호화해서 별도 기록
        oos.writeObject(encrypt(password));
    }

    private void readObject(ObjectInputStream ois)
            throws IOException, ClassNotFoundException {
        ois.defaultReadObject(); // 기본 필드 역직렬화
        // 복호화
        password = decrypt((String) ois.readObject());
    }
}
```

`defaultWriteObject()` / `defaultReadObject()`는 선언 순서대로 non-transient 필드를 처리한다. 커스텀 데이터는 그 전/후에 추가로 write/read한다.

## readResolve / writeReplace

역직렬화 결과 객체를 대체하려면 `readResolve()`를 구현한다. 싱글턴 패턴에서 직렬화-역직렬화 후에도 동일 인스턴스를 보장하는 데 사용한다.

```java
public class Singleton implements Serializable {
    private static final long serialVersionUID = 1L;
    private static final Singleton INSTANCE = new Singleton();

    private Singleton() {}

    public static Singleton getInstance() { return INSTANCE; }

    // readResolve: 역직렬화 시 새 인스턴스 대신 INSTANCE 반환
    private Object readResolve() {
        return INSTANCE;
    }
}
```

`writeReplace()`는 직렬화 전 다른 객체로 교체한다 — 대리 객체(proxy)를 통해 직렬화하는 패턴에 사용한다.

## 그래프 직렬화와 참조 공유

`ObjectOutputStream`은 객체 그래프를 인식한다. 같은 객체를 두 번 직렬화하면 첫 번째만 완전히 쓰고 이후는 참조로 대체한다.

```java
User u = new User("Bob", 25);
oos.writeObject(u);
oos.writeObject(u); // 두 번째는 참조만 기록

// 역직렬화
User r1 = (User) ois.readObject();
User r2 = (User) ois.readObject();
System.out.println(r1 == r2); // true — 같은 인스턴스
```

이 동작은 원하지 않을 때 `oos.reset()`으로 초기화할 수 있다.

## 직렬화 바이트 스트림 구조

Java 직렬화 스트림은 `AC ED 00 05`로 시작하는 매직 넘버를 포함한다. 이 패턴은 역직렬화 공격의 식별 지표로 사용되기도 한다.

```text
AC ED       - STREAM_MAGIC
00 05       - STREAM_VERSION
73 72       - TC_OBJECT, TC_CLASSDESC
00 04 55 73 65 72  - class name length(4) + "User"
...
```

## Externalizable — 완전한 직렬화 제어

`Serializable` 대신 `Externalizable`을 구현하면 모든 직렬화 로직을 직접 작성한다.

```java
public class Point implements Externalizable {
    private int x, y;

    @Override
    public void writeExternal(ObjectOutput out) throws IOException {
        out.writeInt(x);
        out.writeInt(y);
    }

    @Override
    public void readExternal(ObjectInput in)
            throws IOException, ClassNotFoundException {
        x = in.readInt();
        y = in.readInt();
    }
}
```

`Externalizable`은 `Serializable`보다 빠를 수 있지만 인자 없는 기본 생성자가 반드시 존재해야 한다 (역직렬화 시 JVM이 먼저 호출).

## 핵심 정리

- `Serializable` = 마커 인터페이스 (메서드 없음)
- `serialVersionUID` 명시 권장 — 자동 계산은 클래스 변경마다 달라짐
- `transient` = 직렬화 제외 (역직렬화 시 기본값)
- `writeObject/readObject` = 커스텀 직렬화 로직
- `readResolve` = 역직렬화 결과 교체 (싱글턴 보장)
- 역직렬화는 **생성자를 호출하지 않는다** — 불변식 검증 우회 주의

---

**지난 글:** [AsynchronousFileChannel — 비동기 파일 I/O](/posts/java-async-file-channel/)

**다음 글:** [Java 직렬화의 함정 — 보안과 성능 문제](/posts/java-serialization-pitfalls/)

<br>
읽어주셔서 감사합니다. 😊
