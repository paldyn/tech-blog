---
title: "Java 마커 인터페이스 — 빈 몸체로 타입을 마킹하는 설계 패턴"
description: "메서드 없이 빈 몸체만 존재하는 마커 인터페이스의 동작 원리, JDK 내장 예시(Serializable, Cloneable, RandomAccess), 커스텀 마커 인터페이스 작성, 그리고 어노테이션과의 트레이드오프를 실전 코드와 함께 정리한다"
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "마커 인터페이스", "Serializable", "Cloneable", "RandomAccess", "instanceof", "어노테이션", "인터페이스 설계"]
featured: false
draft: false
---

[지난 글](/posts/java-functional-interface/)에서 추상 메서드가 정확히 하나인 **함수형 인터페이스**를 살펴봤다. 이번에는 정반대의 끝에 있는 인터페이스, 즉 추상 메서드가 **0개**인 **마커 인터페이스**를 다룬다. 아무 메서드도 선언하지 않지만, JVM과 라이브러리는 이를 보고 해당 클래스에 특별한 처리를 수행한다.

## 마커 인터페이스란

**마커 인터페이스(Marker Interface)**는 메서드나 필드를 전혀 선언하지 않는 빈 인터페이스다. 다른 말로 **태깅 인터페이스(Tagging Interface)**라고도 한다. 이름 그대로 클래스에 특정 표시(mark)를 붙이는 것이 목적이다.

```java
// JDK의 대표적 마커 인터페이스
public interface Serializable { }
public interface Cloneable    { }
public interface RandomAccess { }
```

빈 몸체이므로 구현해야 할 메서드가 없다. `implements Serializable`만 선언하면 끝이다. 그렇다면 이 선언이 어떤 효과를 내는가? 핵심은 **타입 계층**에 있다. 클래스가 해당 인터페이스를 구현하면 `instanceof` 검사에서 `true`를 반환하고, JVM이나 라이브러리 코드는 이를 보고 특별한 동작을 수행한다.

```java
public class Data implements Serializable {
    private String name;
    private int value;
}

Object obj = new Data("key", 42);
System.out.println(obj instanceof Serializable); // true
```

![마커 인터페이스 개요 — JDK 내장 예시와 코드 패턴](/assets/posts/java-marker-interface-overview.svg)

## JDK 내장 마커 인터페이스

### Serializable — java.io

가장 유명한 마커 인터페이스다. `ObjectOutputStream`은 객체를 직렬화하기 전에 `obj instanceof Serializable`을 확인하고, `false`이면 `NotSerializableException`을 던진다.

```java
// ObjectOutputStream 내부 동작 (JDK 소스 단순화)
private void writeObject0(Object obj) throws IOException {
    if (!(obj instanceof Serializable)) {
        throw new NotSerializableException(obj.getClass().getName());
    }
    // 직렬화 진행
}
```

직렬화된 클래스가 `serialVersionUID`를 선언하지 않으면 JVM이 자동으로 계산하는데, 클래스 변경 시 값이 달라져 역직렬화에 실패할 수 있다. 명시적 선언이 권장된다.

```java
public class User implements Serializable {
    private static final long serialVersionUID = 1L;
    private String name;
    private int age;
}
```

### Cloneable — java.lang

`Object.clone()` 메서드는 `Cloneable`을 구현하지 않은 객체에서 호출하면 `CloneNotSupportedException`을 던진다. 마커가 복제 허용의 문을 여는 열쇠다.

```java
public class Point implements Cloneable {
    public int x, y;

    @Override
    public Point clone() {
        try {
            return (Point) super.clone();  // Cloneable 덕에 동작
        } catch (CloneNotSupportedException e) {
            throw new AssertionError(); // 절대 발생 안 함
        }
    }
}
```

`Cloneable`은 설계 결함이 있는 인터페이스로 자주 언급된다. 마커임에도 `clone()` 메서드는 `Cloneable`이 아닌 `Object`에 있고, 접근 제한자도 `protected`다. 복사 생성자나 정적 팩터리가 더 나은 대안인 경우가 많다.

### RandomAccess — java.util

`java.util.List` 구현체 중 임의 접근(`get(index)`)이 O(1)인 경우에 붙인다. `ArrayList`는 구현하지만 `LinkedList`는 구현하지 않는다.

```java
List<Integer> list = getList(); // ArrayList or LinkedList

if (list instanceof RandomAccess) {
    // 인덱스 기반 순회 (O(n))
    for (int i = 0; i < list.size(); i++) {
        process(list.get(i));
    }
} else {
    // 반복자 기반 순회 (LinkedList에서 효율적)
    for (Integer item : list) {
        process(item);
    }
}
```

`Collections.sort()`, `Collections.binarySearch()` 같은 유틸리티 메서드도 내부적으로 `RandomAccess` 여부를 확인해 알고리즘을 전환한다.

### Remote — java.rmi

Java RMI(Remote Method Invocation)에서 원격 호출 대상 객체에 붙이는 마커다. RMI 런타임이 이를 확인해 프록시를 생성하고 원격 통신을 처리한다.

```java
public interface AccountService extends Remote {
    BigDecimal getBalance(String id) throws RemoteException;
}

public class AccountServiceImpl implements AccountService {
    // Remote를 AccountService가 이미 extends하므로 자동 마킹
}
```

### EventListener — java.util

GUI 이벤트 리스너 계층의 루트 마커다. `ActionListener`, `MouseListener` 같은 구체적인 리스너 인터페이스들이 모두 `EventListener`를 상속한다. 직접 사용할 일은 드물지만, 리스너 계층 전체를 타입으로 다룰 때 유용하다.

```java
public interface ActionListener extends EventListener {
    void actionPerformed(ActionEvent e);
}

// EventListener로 모든 리스너 한 번에 관리
List<EventListener> allListeners = new ArrayList<>();
allListeners.add(new ActionListener() { ... });
```

## 작동 원리: instanceof 검사

마커 인터페이스의 실제 효력은 항상 `instanceof` 검사를 통해 나온다. JVM은 클래스 로딩 시점에 타입 계층 정보를 메모리에 저장하므로, `instanceof`는 빠른 포인터 비교 수준의 연산이다.

```java
// 마커 인터페이스 기반 처리 분기의 전형적 패턴
void serialize(Object obj, OutputStream out) throws IOException {
    if (obj instanceof Serializable s) {          // Java 16+ 패턴 매칭
        var oos = new ObjectOutputStream(out);
        oos.writeObject(s);
    } else {
        throw new NotSerializableException(
            obj.getClass().getName()
        );
    }
}
```

Java 16 이전에는 캐스팅이 별도로 필요했다.

```java
// Java 15 이하
if (obj instanceof Serializable) {
    Serializable s = (Serializable) obj;
    // ...
}
```

Java 16+의 패턴 매칭 `instanceof`를 사용하면 타입 체크와 캐스팅이 한 번에 이루어져 코드가 간결해진다.

## 커스텀 마커 인터페이스 작성

도메인 요구사항에 따라 직접 마커 인터페이스를 정의할 수 있다.

```java
// 감사 로그 대상 도메인 객체
public interface Auditable { }

// 소프트 딜리트 가능 엔티티
public interface SoftDeletable { }

// 실제 사용
public class Order implements Auditable, SoftDeletable {
    private Long id;
    private String status;
}
```

이를 인프라스트럭처 계층에서 활용하면 도메인 클래스에 어노테이션 없이도 공통 처리를 분리할 수 있다.

```java
public class AuditInterceptor {
    public void afterSave(Object entity) {
        if (entity instanceof Auditable) {
            auditLog.record(entity.getClass().getSimpleName(),
                            "SAVED",
                            LocalDateTime.now());
        }
    }
}
```

상속도 자동으로 마킹된다. `Order`를 상속한 `PremiumOrder`도 `instanceof Auditable`이 `true`다.

```java
public class PremiumOrder extends Order { }

PremiumOrder po = new PremiumOrder();
System.out.println(po instanceof Auditable);    // true (자동 마킹)
System.out.println(po instanceof SoftDeletable); // true
```

## 마커 인터페이스 vs 어노테이션

Java 5에서 어노테이션이 도입된 이후, 마커 인터페이스의 많은 역할을 어노테이션이 대체하게 됐다.

![마커 인터페이스 vs @interface 어노테이션 비교](/assets/posts/java-marker-interface-vs-annotation.svg)

### 어노테이션이 더 나은 경우

**메타데이터 추가가 필요할 때**: 마커 인터페이스는 빈 몸체이므로 추가 정보를 담을 수 없다. 어노테이션은 속성을 가질 수 있다.

```java
// 어노테이션: 버전 메타데이터 포함 가능
@interface Auditable {
    String since() default "1.0";
    AuditLevel level() default AuditLevel.BASIC;
}

@Auditable(since = "2.1", level = AuditLevel.FULL)
public class Order { }
```

**런타임 제거가 필요할 때**: `@Retention(RetentionPolicy.SOURCE)`로 선언하면 컴파일 후 바이트코드에 남지 않는다.

**기존 클래스를 수정하지 않고 마킹할 때**: 어노테이션 프로세서를 통해 외부에서 처리할 수 있다(예: Lombok).

### 마커 인터페이스가 더 나은 경우

**컴파일 타임 타입 안전성**: 인터페이스는 타입 계층에 통합되므로, 메서드 파라미터 타입으로 선언해 컴파일러가 검사하도록 할 수 있다.

```java
// 어노테이션 방식: 컴파일 타임 체크 불가
void save(@Auditable Object entity) { } // 어노테이션은 파라미터 타입이 될 수 없음

// 마커 인터페이스 방식: 컴파일 타임 체크
void save(Auditable entity) { }         // Auditable 타입만 허용

Order order = new Order();   // Auditable 구현
String s = "text";           // Auditable 미구현
save(order); // 컴파일 OK
save(s);     // 컴파일 에러
```

**자동 상속**: 부모 클래스나 인터페이스에 마커를 붙이면 모든 하위 타입이 자동으로 마킹된다. 어노테이션은 `@Inherited`를 붙여야 하고, 인터페이스 구현 경로로는 전파되지 않는다.

## 마커 인터페이스의 한계와 주의점

**남용 금지**: 마커 인터페이스를 여러 개 정의하면 클래스 선언이 `implements A, B, C, D, E`처럼 늘어난다. 각 마커가 실제로 타입 계층에 의미 있는 구분을 만드는지 검토해야 한다.

**어노테이션으로 대체 가능한 경우 굳이 쓰지 말 것**: 이미 어노테이션 기반 인프라(`@Transactional`, `@Cacheable` 등)가 갖춰진 환경이라면 마커 인터페이스보다 어노테이션이 일관성 면에서 낫다.

**메서드 추가 불가**: 마커에서 시작해 나중에 메서드를 추가하면 기존 구현체가 모두 영향을 받는다. 처음부터 어노테이션으로 시작하면 이 문제가 없다.

**빈 인터페이스 선언만으로 안전하지 않다**: `Cloneable`의 사례처럼, 마커만 붙인다고 안전한 복사가 보장되지 않는다. 내부 mutable 객체에 대한 깊은 복사는 여전히 직접 구현해야 한다.

```java
public class Team implements Cloneable {
    private List<Member> members; // mutable 필드

    @Override
    public Team clone() throws CloneNotSupportedException {
        Team copy = (Team) super.clone();
        // 얕은 복사 — members 리스트는 원본과 공유됨 (위험)
        // 깊은 복사를 원하면 아래와 같이:
        copy.members = new ArrayList<>(this.members);
        return copy;
    }
}
```

마커 인터페이스는 단순하지만 의미 있는 설계 도구다. 타입 시스템에 통합된 마킹이 필요할 때, 특히 컴파일 타임 안전성이 중요한 API 설계에서 여전히 유효한 선택이다. 다음 글에서는 인터페이스와 관련된 가장 복잡한 주제인 **다중 상속**과 다이아몬드 문제를 다룬다.

---

**지난 글:** [Java 함수형 인터페이스 — @FunctionalInterface와 람다의 기반](/posts/java-functional-interface/)

**다음 글:** [Java 다중 상속 — default 메서드와 다이아몬드 문제 해결](/posts/java-multiple-inheritance/)

<br>
읽어주셔서 감사합니다. 😊
