---
title: "Java getter와 setter 완전 정복 — 올바른 설계와 안티패턴"
description: "getter와 setter의 올바른 작성법과 흔한 안티패턴을 분석하고, setter 없는 불변 객체·빌더 패턴·record를 활용해 캡슐화를 더 강하게 유지하는 설계 기법을 완전 정복한다"
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "getter", "setter", "캡슐화", "불변 객체", "빌더 패턴", "record", "OOP", "객체지향"]
featured: false
draft: false
---

[지난 글](/posts/java-encapsulation/)에서 캡슐화가 무엇이고 왜 필요한지를 살펴봤다. 이번에는 캡슐화를 구현할 때 가장 많이 사용하는 패턴인 **getter와 setter**를 올바르게 작성하는 방법과, 잘못 사용했을 때 어떤 문제가 생기는지를 다룬다.

## getter와 setter가 필요한 이유

필드를 `private`으로 선언하면 외부에서 직접 접근할 수 없다. 그렇다면 외부 코드가 그 값을 읽거나 변경해야 할 때는 어떻게 해야 할까? 바로 **getter(읽기 메서드)** 와 **setter(쓰기 메서드)** 가 그 역할을 한다.

```java
public class Person {
    private String name;
    private int age;

    // getter — 필드 값을 읽어서 반환
    public String getName() { return name; }
    public int getAge()     { return age; }

    // setter — 검증 후 필드 값을 변경
    public void setName(String name) {
        if (name == null || name.isBlank())
            throw new IllegalArgumentException("이름은 필수입니다.");
        this.name = name;
    }

    public void setAge(int age) {
        if (age < 0 || age > 150)
            throw new IllegalArgumentException("나이는 0~150 범위여야 합니다.");
        this.age = age;
    }
}
```

단순히 `this.name = name`을 위임하는 것처럼 보여도, setter 안에 유효성 검사가 있다는 점이 핵심이다. 유효성 검사가 없는 setter는 `public` 필드와 다를 바가 없다.

## getter 작성 원칙

getter는 필드 값을 반환하는 메서드다. 대부분은 단순하지만 가변 객체(컬렉션, 배열, 날짜 등)를 반환할 때 주의가 필요하다.

### 기본 타입과 불변 객체 — 그대로 반환해도 안전

```java
public String getName()       { return name; }     // String은 불변
public int getAge()           { return age; }      // int는 기본 타입
public LocalDate getBirthday(){ return birthday; } // LocalDate는 불변
```

`String`, `int`, `LocalDate` 같은 불변(immutable) 타입은 참조를 그대로 반환해도 외부에서 내부 상태를 바꿀 수 없다.

### 컬렉션 — 불변 뷰 또는 방어적 복사

```java
public class Team {
    private final List<String> members = new ArrayList<>();

    // 잘못된 방법 — 내부 리스트 직접 노출
    // public List<String> getMembers() { return members; }

    // 방법 1: 불변 뷰 반환
    public List<String> getMembers() {
        return Collections.unmodifiableList(members);
    }

    // 방법 2: Java 10+ List.copyOf()
    public List<String> getMembersCopy() {
        return List.copyOf(members);
    }

    public void addMember(String name) {
        if (name == null || name.isBlank())
            throw new IllegalArgumentException("이름이 필요합니다.");
        members.add(name);
    }
}
```

`unmodifiableList()`는 원본 리스트를 감싸는 뷰다. 원본이 변경되면 뷰도 반영된다. `List.copyOf()`는 완전한 복사본을 만들어 원본과 완전히 분리된다. 어느 쪽을 선택할지는 호출자가 스냅샷을 원하는지 실시간 뷰를 원하는지에 따라 다르다.

### 배열 — 방어적 복사 필수

```java
public class Matrix {
    private final int[] data;

    public Matrix(int[] data) {
        this.data = data.clone();  // 생성자에서도 방어적 복사
    }

    // 잘못된 방법 — 내부 배열 직접 노출
    // public int[] getData() { return data; }

    // 올바른 방법 — 복사본 반환
    public int[] getData() {
        return data.clone();
    }
}
```

배열은 `clone()` 메서드로 복사한다. `Arrays.copyOf(data, data.length)`도 동일한 역할을 한다.

## setter 작성 원칙

setter는 필드를 변경하는 메서드다. 검증이 핵심이다.

![getter/setter 패턴 비교 — 검증 있는 setter와 없는 setter](/assets/posts/java-getter-setter-pattern.svg)

### setter에 반드시 포함해야 할 것

```java
public void setEmail(String email) {
    // 1. null 체크
    Objects.requireNonNull(email, "이메일은 null일 수 없습니다.");

    // 2. 형식 검증
    if (!email.matches("^[\\w._%+\\-]+@[\\w.\\-]+\\.[A-Za-z]{2,}$"))
        throw new IllegalArgumentException("유효한 이메일 형식이 아닙니다: " + email);

    // 3. 정규화 (선택적)
    this.email = email.toLowerCase().strip();
}
```

setter는 단순 대입이 아니다. 외부에서 들어오는 경계값(system boundary)이므로 유효성 검사를 수행하는 유일한 지점이어야 한다.

### setter가 필요 없는 경우

모든 필드에 setter를 만들면 안 된다. 필요할 때만 노출한다.

```java
public class Order {
    private final long orderId;       // 절대 변경 불가 → setter 없음
    private final LocalDateTime orderedAt;  // 절대 변경 불가 → setter 없음
    private OrderStatus status;       // 상태 전이는 전용 메서드로 제어

    public Order(long orderId) {
        this.orderId = orderId;
        this.orderedAt = LocalDateTime.now();
        this.status = OrderStatus.PENDING;
    }

    // setter 대신 도메인 의도를 표현하는 메서드
    public void confirm() {
        if (status != OrderStatus.PENDING)
            throw new IllegalStateException("PENDING 상태에서만 확인할 수 있습니다.");
        status = OrderStatus.CONFIRMED;
    }

    public void cancel() {
        if (status == OrderStatus.DELIVERED)
            throw new IllegalStateException("배송 완료 후에는 취소할 수 없습니다.");
        status = OrderStatus.CANCELLED;
    }

    public long getOrderId()           { return orderId; }
    public LocalDateTime getOrderedAt(){ return orderedAt; }
    public OrderStatus getStatus()     { return status; }
}
```

`setStatus(OrderStatus.CONFIRMED)`로 상태를 바꾸는 것보다 `confirm()`, `cancel()`이 훨씬 좋다. 허용되는 상태 전이 규칙이 메서드 안에 캡슐화되어 있고, 이름만 봐도 의도를 알 수 있다.

## getter/setter 안티패턴

![getter/setter 안티패턴과 대안](/assets/posts/java-getter-setter-antipattern.svg)

### 안티패턴 1 — 검증 없는 setter

```java
// 나쁜 예
public void setAge(int age) { this.age = age; }  // age = -100도 통과

// 좋은 예
public void setAge(int age) {
    if (age < 0 || age > 150)
        throw new IllegalArgumentException("나이 범위 초과: " + age);
    this.age = age;
}
```

### 안티패턴 2 — getter로 내부 가변 상태 노출

```java
// 나쁜 예 — 내부 리스트를 그대로 반환
public List<String> getTags() { return tags; }

// 호출자가 내부 상태를 직접 수정
service.getTags().clear();  // 예상 밖의 부작용

// 좋은 예
public List<String> getTags() {
    return Collections.unmodifiableList(tags);
}
```

### 안티패턴 3 — setter로 복잡한 객체 조립

```java
// 나쁜 예 — setter를 조합해 객체를 만들면 중간 상태가 존재
Order order = new Order();
order.setCustomer(customer);
// 이 시점에서 order는 아직 완전하지 않은 상태
order.setItems(items);
order.setTotal(total);
// total이 items 금액 합산인지 검증할 지점이 없음

// 좋은 예 — 빌더 패턴
Order order = Order.builder()
    .customer(customer)
    .items(items)
    .build();  // build() 안에서 일관성 검증
```

## setter 없는 불변 객체

setter가 없으면 객체를 생성 후 변경할 수 없다. 불변 객체(Immutable Object)는 스레드 안전하고 불변식 위반이 불가능하다.

```java
public final class Money {
    private final long amount;
    private final String currency;

    public Money(long amount, String currency) {
        if (amount < 0)
            throw new IllegalArgumentException("금액은 음수일 수 없습니다.");
        Objects.requireNonNull(currency, "통화는 null일 수 없습니다.");
        this.amount = amount;
        this.currency = currency.toUpperCase();
    }

    // setter 없음 — 상태 변경 불가
    public long getAmount()   { return amount; }
    public String getCurrency(){ return currency; }

    // 상태 변경 대신 새 객체 반환
    public Money add(Money other) {
        if (!currency.equals(other.currency))
            throw new IllegalArgumentException("통화가 다릅니다.");
        return new Money(amount + other.amount, currency);
    }

    public Money multiply(int factor) {
        return new Money(amount * factor, currency);
    }
}
```

`add()`와 `multiply()`는 기존 객체를 변경하지 않고 새 `Money` 객체를 반환한다. 호출자가 결과를 새 변수에 받지 않으면 연산 결과가 사라진다. 불변 객체는 공유해도 안전하고 `HashMap` 키로도 안전하게 쓸 수 있다.

## record — 불변 데이터 객체의 표준

Java 16에서 정식 도입된 `record`는 불변 데이터 클래스를 간결하게 선언한다. getter 이름이 `get`으로 시작하지 않고 필드명 그대로 메서드가 된다.

```java
// record 선언 — 컴파일러가 생성자, getter, equals, hashCode, toString 생성
record Point(double x, double y) {
    // 컴팩트 생성자 — 검증 가능
    Point {
        if (Double.isNaN(x) || Double.isNaN(y))
            throw new IllegalArgumentException("좌표에 NaN 불가");
    }

    // 추가 메서드 정의 가능
    public double distanceTo(Point other) {
        double dx = x - other.x;
        double dy = y - other.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
}

// 사용
Point p = new Point(3.0, 4.0);
System.out.println(p.x());          // getter는 필드명() 형태
System.out.println(p.distanceTo(new Point(0, 0)));  // 5.0
```

`record`는 `final` 클래스이며 모든 필드가 `private final`이다. setter가 없고 상속도 불가하다. 단순한 데이터 운반 객체(DTO, Value Object)에 이상적이다.

## 빌더 패턴 — 복잡한 객체 생성

필드가 많은 객체를 setter로 조립하면 중간 상태 문제가 생긴다. 빌더 패턴은 모든 필드를 설정한 뒤 `build()` 시점에 한 번에 검증하고 객체를 생성한다.

```java
public class HttpRequest {
    private final String url;
    private final String method;
    private final Map<String, String> headers;
    private final String body;

    private HttpRequest(Builder builder) {
        this.url     = builder.url;
        this.method  = builder.method;
        this.headers = Map.copyOf(builder.headers);
        this.body    = builder.body;
    }

    // getter들
    public String getUrl()                    { return url; }
    public String getMethod()                 { return method; }
    public Map<String, String> getHeaders()   { return headers; }
    public String getBody()                   { return body; }

    public static Builder builder(String url) {
        return new Builder(url);
    }

    public static class Builder {
        private final String url;
        private String method = "GET";
        private final Map<String, String> headers = new LinkedHashMap<>();
        private String body;

        private Builder(String url) {
            Objects.requireNonNull(url, "URL은 필수입니다.");
            this.url = url;
        }

        public Builder method(String method)   { this.method = method; return this; }
        public Builder header(String k, String v) { headers.put(k, v); return this; }
        public Builder body(String body)       { this.body = body; return this; }

        public HttpRequest build() {
            if ("POST".equals(method) && (body == null || body.isBlank()))
                throw new IllegalStateException("POST 요청에는 body가 필요합니다.");
            return new HttpRequest(this);
        }
    }
}

// 사용
HttpRequest req = HttpRequest.builder("https://api.example.com/users")
    .method("POST")
    .header("Content-Type", "application/json")
    .body("{\"name\":\"Alice\"}")
    .build();
```

생성된 `HttpRequest`는 불변이다. `build()` 이후에는 상태를 바꿀 방법이 없다.

## 정리

getter와 setter는 캡슐화를 구현하는 도구지만, 무분별하게 사용하면 캡슐화를 오히려 파괴한다. 핵심 원칙을 요약하면 다음과 같다.

| 상황 | 권장 방식 |
|---|---|
| 값 읽기 (기본 타입/불변 객체) | 그대로 반환 |
| 값 읽기 (컬렉션/배열) | unmodifiable 뷰 또는 복사본 |
| 상태 변경 | 검증 포함한 setter 또는 도메인 메서드 |
| 상태 변경 없음 | setter 미제공, 불변 객체 |
| 복잡한 객체 생성 | 빌더 패턴 |
| 단순 데이터 클래스 | `record` |

getter와 setter를 올바르게 설계하면 객체의 불변식이 항상 유지되고, 내부 구현을 자유롭게 바꿀 수 있는 유연한 코드가 만들어진다.

---

**지난 글:** [Java 캡슐화 완전 정복 — 정보 은닉과 불변식 보호](/posts/java-encapsulation/)

**다음 글:** [Java 상속 완전 정복 — extends와 is-a 관계](/posts/java-inheritance/)

<br>
읽어주셔서 감사합니다. 😊
