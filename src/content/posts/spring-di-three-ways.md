---
title: "Spring DI 세 가지 방식: 생성자·세터·필드 주입 완전 비교"
description: "생성자 주입, 세터 주입, 필드 주입의 동작 원리와 장단점을 코드로 비교하고, 생성자 주입이 권장되는 이유를 순환 참조 감지·불변성·테스트 관점에서 심층 분석합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 1
type: "knowledge"
category: "Spring"
tags: ["Spring", "DI", "의존성주입", "생성자주입", "IoC"]
featured: false
draft: false
---

[지난 글](/posts/spring-component-scan/)에서는 컴포넌트 스캔이 클래스패스를 순회하며 빈을 자동 등록하는 과정을 살펴봤습니다. 이번에는 IoC 컨테이너가 빈을 생성한 뒤 의존 관계를 어떤 방식으로 연결하는지, 즉 **의존성 주입(Dependency Injection)의 세 가지 전략**을 집중적으로 파고듭니다.

Spring은 세 가지 방법으로 의존성을 주입할 수 있습니다. **생성자 주입(Constructor Injection)**, **세터 주입(Setter Injection)**, 그리고 **필드 주입(Field Injection)**입니다. 셋 모두 `@Autowired`(또는 생략 가능한 경우)를 활용하지만 동작 시점·불변성 보장·테스트 용이성에서 뚜렷한 차이를 보입니다.

## 생성자 주입 — 가장 권장되는 방식

생성자 주입은 **빈이 생성되는 시점**에 의존 객체를 한 번에 받아 `final` 필드에 저장합니다. Spring 4.3부터는 생성자가 하나뿐이면 `@Autowired`를 생략할 수 있고, Lombok의 `@RequiredArgsConstructor`를 사용하면 보일러플레이트를 거의 없앨 수 있습니다.

```java
@Service
@RequiredArgsConstructor          // Lombok: final 필드 생성자 자동 생성
public class OrderService {

    private final ItemRepository itemRepository;   // 불변
    private final StockService   stockService;

    public void placeOrder(Long itemId, int qty) {
        Item item = itemRepository.findById(itemId)
                .orElseThrow(ItemNotFoundException::new);
        stockService.decrease(item, qty);
    }
}
```

`final` 선언 덕분에 한 번 주입된 의존 객체는 교체될 수 없습니다. 또한 컨테이너는 **ApplicationContext 초기화 단계**에서 모든 생성자 파라미터를 충족시킬 수 없으면 즉시 `BeanCurrentlyInCreationException`을 던집니다. 순환 참조나 누락된 빈을 운영 투입 전에 발견할 수 있는 이유가 바로 이것입니다.

![의존성 주입 세 가지 방식 비교](/assets/posts/spring-di-three-ways-overview.svg)

단위 테스트도 매우 간단합니다. 스프링 컨테이너 없이 `new`로 직접 생성할 수 있기 때문입니다.

```java
// 스프링 컨텍스트 불필요 — 순수 JUnit 테스트
class OrderServiceTest {

    ItemRepository mockRepo  = Mockito.mock(ItemRepository.class);
    StockService   mockStock = Mockito.mock(StockService.class);

    OrderService sut = new OrderService(mockRepo, mockStock);

    @Test
    void placeOrder_decreasesStock() {
        given(mockRepo.findById(1L)).willReturn(Optional.of(new Item(1L, "책", 10)));
        sut.placeOrder(1L, 3);
        then(mockStock).should().decrease(any(), eq(3));
    }
}
```

## 세터 주입 — 선택적 의존에 적합

세터 주입은 `@Autowired`가 붙은 setter 메서드를 통해 의존 객체를 주입합니다. 빈이 먼저 기본 생성자로 만들어진 다음, setter가 호출되므로 **의존 객체 없이도 빈 생성 자체는 가능**합니다. 이 특성 덕분에 선택적(optional) 의존성에 어울립니다.

```java
@Service
public class NotificationService {

    private EmailSender emailSender;

    @Autowired(required = false)   // 빈이 없어도 무시
    public void setEmailSender(EmailSender emailSender) {
        this.emailSender = emailSender;
    }

    public void notify(String msg) {
        if (emailSender != null) {
            emailSender.send(msg);
        }
    }
}
```

`required = false`로 설정하면 `EmailSender` 빈이 등록되어 있지 않아도 예외 없이 기동됩니다. 단, `final`을 사용할 수 없어 불변성을 보장하지 못하며, 순환 참조가 런타임까지 드러나지 않을 수 있습니다.

## 필드 주입 — 간편하지만 지양

필드 주입은 리플렉션으로 `private` 필드에 직접 값을 밀어 넣습니다. 코드가 가장 짧지만 단점이 많습니다.

```java
@Service
public class PaymentService {

    @Autowired                  // 리플렉션으로 private 필드에 주입
    private PaymentRepository paymentRepository;

    @Autowired
    private AuditService auditService;
}
```

- **테스트 어려움**: `new PaymentService()`로 생성하면 필드가 `null`이어서 Mockito `@InjectMocks` 같은 리플렉션 도구 없이 테스트할 수 없습니다.
- **`final` 불가**: 주입 후 언제든 교체 가능한 상태가 됩니다.
- **IDE 경고**: IntelliJ가 "Field injection is not recommended"를 경고합니다.
- **숨겨진 의존성**: 생성자를 보는 것만으로 의존 관계 파악이 불가능합니다.

## 순환 참조와 생성자 주입의 방어

생성자 주입의 가장 큰 장점 중 하나는 **순환 참조의 조기 감지**입니다.

![생성자 주입과 순환 참조 감지](/assets/posts/spring-di-three-ways-circular.svg)

`ServiceA` → `ServiceB` → `ServiceA` 구조가 있을 때, 생성자 주입이라면 컨테이너가 `ServiceA`를 만들기 위해 `ServiceB`를 요청하고, `ServiceB`를 만들기 위해 다시 `ServiceA`를 요청하면서 스택이 한없이 깊어집니다. Spring은 이 상황을 감지해 애플리케이션 기동 단계에서 `BeanCurrentlyInCreationException`을 던집니다.

반면 세터·필드 주입은 빈 생성 후 주입이 이루어지므로 두 빈 모두 일단 만들어진 뒤 서로를 가리키게 됩니다. 순환 참조가 숨어있는 채로 운영 환경에 배포될 위험이 있습니다.

```
[생성자 주입 + 순환 참조 — 기동 시 즉시 실패]
***************************
APPLICATION FAILED TO START
***************************
The dependencies of some of the beans in the application
context form a cycle:
orderService → stockService → orderService
```

Spring Boot 2.6부터는 기본값으로 순환 참조를 금지하며(`spring.main.allow-circular-references=false`), 이를 허용하더라도 생성자 주입은 여전히 시작 시점에 감지합니다.

## 세 가지 방식 선택 가이드

| 상황 | 추천 방식 |
|---|---|
| 필수 의존성 (대부분) | **생성자 주입** |
| 선택적 의존성 (플러그인, 옵셔널 기능) | 세터 주입 |
| 레거시 코드, 빠른 프로토타입 | 필드 주입 (단, 점진적 교체 권장) |

실무에서는 `@RequiredArgsConstructor`를 표준으로 사용하고, 선택적 의존에만 `@Autowired(required=false)` setter를 추가하는 패턴이 가장 많습니다.

## 정리

- **생성자 주입**: `final` 필드, 불변성, 조기 오류 감지, 테스트 용이 → 항상 우선 고려
- **세터 주입**: 선택적 의존성 표현, `required=false` 활용
- **필드 주입**: 코드가 짧지만 테스트·불변성·가시성 모두 손해 → 신규 코드에서 지양

다음 글에서는 같은 타입의 빈이 여러 개일 때 어떻게 하나를 선택하는지, `@Qualifier`와 `@Primary` 전략을 다룹니다.

---

**지난 글:** [컴포넌트 스캔: Spring이 빈을 자동 탐색하는 원리](/posts/spring-component-scan/)

**다음 글:** [@Autowired와 @Qualifier: 빈 선택 전략 완전 정리](/posts/spring-autowired-qualifier/)

<br>
읽어주셔서 감사합니다. 😊
