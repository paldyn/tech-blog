---
title: "Java 추상 클래스 완전 정복 — abstract와 설계 계약"
description: "Java 추상 클래스의 abstract 키워드, 추상 메서드, 구체 메서드, 생성자 활용, final 조합, 템플릿 메서드 패턴까지 예제 중심으로 완전 정복한다"
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "추상 클래스", "abstract class", "abstract method", "OOP", "객체지향", "상속", "템플릿 메서드 패턴"]
featured: false
draft: false
---

[지난 글](/posts/java-polymorphism/)에서 다형성이 "하나의 타입으로 여러 형태의 객체를 다루는 힘"이라는 것을 살펴봤다. 다형성을 제대로 설계하려면 부모 클래스에 **공통 인터페이스(API)** 를 선언하고, 자식 클래스가 각자 구현을 채워 넣는 구조가 필요하다. 이때 등장하는 것이 바로 **추상 클래스(Abstract Class)** 다. 추상 클래스는 "미완성 설계도"다. 공통 로직은 직접 구현하고, 서브클래스마다 달라야 할 부분은 구현 없이 선언만 해둔다.

## 추상 클래스란

`abstract` 키워드를 붙인 클래스를 추상 클래스라 한다. 추상 클래스는 다음 두 가지 목적을 동시에 달성한다.

1. **공통 로직 재사용** — 여러 서브클래스가 공유할 필드와 메서드를 한 곳에 모은다.
2. **구현 강제** — `abstract` 메서드를 선언해 서브클래스가 반드시 해당 메서드를 구현하도록 강제한다.

```java
public abstract class Shape {
    private String color;

    public Shape(String color) {
        this.color = color;
    }

    // 추상 메서드 — 구현 없음, 서브클래스가 반드시 구현해야 함
    public abstract double area();
    public abstract String describe();

    // 구체 메서드 — 공통 로직, 모든 서브클래스가 그대로 사용
    public void print() {
        System.out.println(describe() + " (color=" + color + ")");
    }

    public String getColor() {
        return color;
    }
}
```

추상 클래스의 가장 중요한 제약: **직접 인스턴스화할 수 없다**.

```java
Shape s = new Shape("red");  // 컴파일 오류 — abstract 클래스 인스턴스화 불가
Shape s = new Circle(5, "blue");  // OK — 구체 서브클래스를 업캐스팅
```

"미완성 설계도"이므로 그 자체로는 만들 수 없고, 완성된 서브클래스를 통해서만 사용한다.

![추상 클래스 계층 구조 — 미완성 설계도와 구체 구현](/assets/posts/java-abstract-class-overview.svg)

## abstract 메서드의 규칙

`abstract` 메서드는 몇 가지 엄격한 규칙을 따른다.

```java
public abstract class Animal {
    // ✓ 올바른 abstract 메서드 — 선언만, 중괄호 없음
    public abstract String sound();

    // ✗ 컴파일 오류 — abstract이면서 구현 본문 있음
    // public abstract void run() { System.out.println("달린다"); }

    // ✓ 추상 클래스도 구체 메서드를 가질 수 있음
    public void breathe() {
        System.out.println("숨을 쉰다");
    }
}
```

**abstract 메서드 적용 제한**:

| 조합 | 가능 여부 | 이유 |
|------|-----------|------|
| `abstract` + `final` | ✗ | final은 오버라이딩 금지 — abstract는 오버라이딩 강제, 모순 |
| `abstract` + `static` | ✗ | static 메서드는 오버라이딩 불가(숨김만 가능) |
| `abstract` + `private` | ✗ | private은 상속 불가 — 서브클래스가 구현할 수 없음 |
| `abstract` + `protected` | ✓ | 서브클래스에서 접근·구현 가능 |
| `abstract` + `public` | ✓ | 가장 일반적인 사용 |

서브클래스가 추상 메서드 중 **하나라도 구현하지 않으면** 해당 서브클래스도 반드시 `abstract`로 선언해야 한다.

```java
public abstract class Animal {
    public abstract String sound();
    public abstract String habitat();
}

// sound()만 구현 — habitat() 미구현이므로 abstract 필수
public abstract class DomesticAnimal extends Animal {
    @Override
    public String sound() { return "집에서 나는 소리"; }
    // habitat() 미구현 → 이 클래스도 abstract
}

// 모든 추상 메서드를 구현한 구체 클래스
public class Dog extends DomesticAnimal {
    @Override
    public String sound()   { return "멍멍"; }
    @Override
    public String habitat() { return "집"; }
}
```

## 추상 클래스의 생성자

추상 클래스는 인스턴스화할 수 없지만 **생성자를 가질 수 있다**. 서브클래스가 `super()`를 통해 부모 생성자를 호출할 때 사용된다.

```java
public abstract class Vehicle {
    private final String brand;
    private final int year;

    // 추상 클래스 생성자 — 직접 호출 불가, super()로만 호출
    protected Vehicle(String brand, int year) {
        this.brand = brand;
        this.year = year;
    }

    public abstract double fuelEfficiency();  // 연비 (km/L 또는 km/kWh)

    public void info() {
        System.out.printf("%s (%d) — 연비: %.1f%n", brand, year, fuelEfficiency());
    }
}

public class GasCar extends Vehicle {
    private final double mpg;

    public GasCar(String brand, int year, double mpg) {
        super(brand, year);  // 부모 생성자 호출
        this.mpg = mpg;
    }

    @Override
    public double fuelEfficiency() { return mpg; }
}

public class ElectricCar extends Vehicle {
    private final double kwh;

    public ElectricCar(String brand, int year, double kwh) {
        super(brand, year);
        this.kwh = kwh;
    }

    @Override
    public double fuelEfficiency() { return kwh; }
}
```

추상 클래스 생성자를 `protected`로 선언하는 것이 관례다. `private`으로 하면 서브클래스가 `super()`를 호출하지 못하고, `public`으로 하면 외부에서 혼란을 줄 수 있다.

## 구체 메서드와 공통 로직 캡슐화

추상 클래스의 강점은 공통 로직을 구체 메서드로 구현해 서브클래스의 코드 중복을 제거하는 것이다.

```java
public abstract class Report {
    // 공통 필드
    private final String title;
    private final LocalDate generatedAt;

    protected Report(String title) {
        this.title = title;
        this.generatedAt = LocalDate.now();
    }

    // 서브클래스마다 다른 형식으로 출력
    protected abstract String formatContent();
    protected abstract String formatHeader();

    // 공통 로직 — 모든 리포트가 동일한 출력 구조 사용
    public final String generate() {
        return String.format("""
            ===== %s =====
            생성일: %s
            %s
            %s
            ==================
            """, title, generatedAt, formatHeader(), formatContent());
    }
}

public class SalesReport extends Report {
    private final List<Integer> sales;

    public SalesReport(List<Integer> sales) {
        super("매출 리포트");
        this.sales = sales;
    }

    @Override
    protected String formatHeader() {
        return "총 항목: " + sales.size() + "건";
    }

    @Override
    protected String formatContent() {
        int total = sales.stream().mapToInt(Integer::intValue).sum();
        return "합계: " + total + "원";
    }
}
```

여기서 `generate()`는 `final`로 선언됐다. 이 패턴의 핵심: **알고리즘의 뼈대(`generate`)는 추상 클래스가 소유하고, 세부 단계(`formatHeader`, `formatContent`)만 서브클래스에 위임한다**.

## 템플릿 메서드 패턴

위에서 자연스럽게 구현한 패턴을 GoF 디자인 패턴에서는 **템플릿 메서드 패턴(Template Method Pattern)** 이라 부른다. 추상 클래스가 알고리즘의 골격(템플릿)을 정의하고, 서브클래스가 구체 단계를 채운다.

```java
public abstract class DataProcessor {
    // 템플릿 메서드 — final로 오버라이딩 방지
    public final void process() {
        readData();     // 1단계: 데이터 읽기
        processData();  // 2단계: 처리
        writeResult();  // 3단계: 결과 저장
    }

    // 훅(Hook) — 선택적으로 오버라이딩
    protected void onStart() {}  // 기본 구현 존재, 필요시 재정의

    protected abstract void readData();
    protected abstract void processData();
    protected abstract void writeResult();
}

public class CsvProcessor extends DataProcessor {
    @Override
    protected void readData()    { System.out.println("CSV 파일 읽기"); }
    @Override
    protected void processData() { System.out.println("쉼표 기준 파싱"); }
    @Override
    protected void writeResult() { System.out.println("DB 저장"); }
}

public class JsonProcessor extends DataProcessor {
    @Override
    protected void readData()    { System.out.println("JSON 스트림 읽기"); }
    @Override
    protected void processData() { System.out.println("Jackson으로 역직렬화"); }
    @Override
    protected void writeResult() { System.out.println("캐시 저장"); }
}
```

`process()` 메서드에 `final`을 붙여 알고리즘 순서를 고정했다. 서브클래스는 단계별 구현에만 집중하면 된다. "훅(Hook) 메서드"(`onStart()`)는 기본 구현이 있지만 서브클래스가 선택적으로 재정의할 수 있다.

![템플릿 메서드 패턴 — 골격은 추상 클래스, 단계는 서브클래스](/assets/posts/java-abstract-class-template.svg)

## abstract와 final 조합

추상 클래스 안에서 `final`을 활용해 상속 계층을 더 정밀하게 제어할 수 있다.

```java
public abstract class BaseService {
    // final 메서드 — 서브클래스가 오버라이딩 불가 (로직 보호)
    public final void execute() {
        validate();   // 공통 검증 (추상)
        doExecute();  // 실제 실행 (추상)
        log();        // 공통 로깅 (구체, final)
    }

    protected abstract void validate();
    protected abstract void doExecute();

    // 구체 메서드이지만 오버라이딩 금지 — 로깅 형식 일관성 보장
    private void log() {
        System.out.println("[LOG] " + getClass().getSimpleName() + " executed");
    }
}
```

`private` 메서드는 자동으로 오버라이딩 불가이므로 `final`을 명시할 필요가 없다. `protected` 구체 메서드에 `final`을 붙이면 "상속은 가능하지만 변경은 불가"가 된다.

## 추상 클래스의 다형성 활용

추상 클래스는 인터페이스처럼 타입 변수로 사용할 수 있다.

```java
List<Shape> shapes = List.of(
    new Circle(5.0, "red"),
    new Rectangle(4.0, 6.0, "blue"),
    new Triangle(3.0, 4.0, "green")
);

// 추상 타입으로 일관되게 처리
double totalArea = shapes.stream()
    .mapToDouble(Shape::area)
    .sum();

shapes.forEach(Shape::print);
```

`Shape` 타입으로 `Circle`, `Rectangle`, `Triangle`을 모두 다룬다. 새로운 `Shape` 서브클래스가 추가되어도 이 코드는 수정하지 않아도 된다. OCP(Open-Closed Principle)가 자동으로 달성된다.

## 추상 클래스 vs 인터페이스 비교

추상 클래스와 인터페이스는 모두 타입을 추상화하지만 목적과 능력이 다르다.

| 항목 | 추상 클래스 | 인터페이스 |
|------|-------------|------------|
| 다중 상속 | 불가 (단일 상속) | 가능 (여러 개 구현) |
| 필드 | 인스턴스 필드 허용 | 상수만 허용 (`public static final`) |
| 생성자 | 있음 | 없음 |
| 접근 제어자 | 제한 없음 | `public` 기본 |
| 사용 목적 | IS-A 관계 + 공통 상태/로직 | CAN-DO 관계 + 순수 계약 |

**언제 추상 클래스를 선택할까?**
- 공통 상태(필드)를 공유해야 할 때
- 공통 로직의 일부만 서브클래스에 위임하고 싶을 때 (템플릿 메서드 패턴)
- "~이다(IS-A)" 관계가 명확할 때 (`GasCar`는 `Vehicle`이다)

**언제 인터페이스를 선택할까?**
- 다중 구현이 필요할 때
- 공통 상태 없이 행동(메서드)만 계약으로 정의할 때 (`Printable`, `Comparable`)

인터페이스의 자세한 내용은 다음 글에서 살펴본다.

## 정리

추상 클래스는 다형성 설계의 핵심 도구다.

| 개념 | 설명 |
|------|------|
| `abstract class` | 인스턴스화 불가, 상속을 위한 미완성 클래스 |
| `abstract method` | 구현 없는 메서드 선언 — 서브클래스 구현 강제 |
| 구체 메서드 | 공통 로직을 한 곳에 모아 코드 중복 제거 |
| 생성자 | `super()`로만 호출 가능, 공통 초기화 담당 |
| `final` 메서드 | 알고리즘 뼈대를 고정해 서브클래스의 임의 변경 방지 |
| 템플릿 메서드 패턴 | 골격은 추상 클래스, 세부 단계는 서브클래스에 위임 |

추상 클래스로 설계하면 공통 로직을 중복 없이 공유하면서, 서브클래스에 구현 의무를 컴파일 타임에 강제할 수 있다. 다음 글에서는 추상 클래스의 형제 개념인 **인터페이스**를 살펴본다.

---

**지난 글:** [Java 다형성 완전 정복 — 업캐스팅과 동적 디스패치](/posts/java-polymorphism/)

**다음 글:** [Java 인터페이스 완전 정복 — 계약과 다중 구현](/posts/java-interface/)

<br>
읽어주셔서 감사합니다. 😊
