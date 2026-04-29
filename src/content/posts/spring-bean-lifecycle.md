---
title: "Spring Bean 생명주기: 초기화부터 소멸까지 완전 분석"
description: "Spring 빈이 인스턴스화되고 의존성이 주입되며 초기화·사용·소멸 단계를 거치는 전체 흐름을 분석합니다. @PostConstruct·InitializingBean·@Bean(initMethod) 세 가지 콜백의 차이와 실전 활용법을 상세히 다룹니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["Spring", "BeanLifecycle", "PostConstruct", "PreDestroy", "InitializingBean"]
featured: false
draft: false
---

[지난 글](/posts/spring-bean-scope/)에서는 빈이 몇 개나 만들어지는지 결정하는 스코프를 살펴봤습니다. 이번에는 하나의 빈이 **태어나고 살아가다 사라지는 전체 과정**, 즉 생명주기(Lifecycle)를 추적합니다. 생명주기를 이해하면 DB 커넥션 풀 초기화, 캐시 워밍, 리소스 해제 같은 작업을 올바른 시점에 수행할 수 있습니다.

## 빈 생명주기 7단계

![Spring Bean 생명주기 전체 흐름](/assets/posts/spring-bean-lifecycle-phases.svg)

Spring 빈은 다음 순서로 생성되고 소멸합니다.

1. **인스턴스화** — 생성자 호출로 객체 생성
2. **의존성 주입** — `@Autowired` 필드·세터·생성자 처리
3. **BeanPostProcessor — Before** — `postProcessBeforeInitialization()` 호출
4. **초기화 콜백** — `@PostConstruct` → `afterPropertiesSet()` → `initMethod`
5. **BeanPostProcessor — After** — `postProcessAfterInitialization()` 호출 (AOP 프록시 적용)
6. **사용 단계** — 실제 비즈니스 로직 수행
7. **소멸** — `@PreDestroy` → `destroy()` → `destroyMethod`

이 순서는 Spring Framework 공식 문서에서 정의한 것으로, 어떤 방식으로 콜백을 등록하든 일관되게 지켜집니다.

## `@PostConstruct` / `@PreDestroy` — 가장 권장되는 방식

`@PostConstruct`는 의존성 주입이 완료된 직후, `@PreDestroy`는 컨테이너가 빈을 소멸시키기 직전에 호출됩니다.

```java
@Component
public class CacheLoader {

    private final ItemRepository itemRepository;
    private Map<Long, Item> cache;

    public CacheLoader(ItemRepository itemRepository) {
        this.itemRepository = itemRepository;
    }

    @PostConstruct
    void init() {
        // 의존성 주입 완료 후 호출 — itemRepository 사용 가능
        cache = itemRepository.findAll()
                .stream()
                .collect(Collectors.toMap(Item::getId, i -> i));
        System.out.println("캐시 로드 완료: " + cache.size() + "건");
    }

    @PreDestroy
    void teardown() {
        cache.clear();
        System.out.println("캐시 정리 완료");
    }
}
```

`@PostConstruct` 메서드는 `void` 반환, 파라미터 없음, 예외 가능(checked 제외 시 런타임 예외 OK)이어야 합니다. 이 어노테이션은 **Jakarta EE(구 Java EE)의 JSR-250 표준**이기 때문에 Spring에 종속되지 않습니다.

생성자에서 의존 빈을 사용하지 못하는 경우는 없지만, 생성자 내 복잡한 초기화 로직은 테스트를 어렵게 합니다. `@PostConstruct` 메서드를 분리하면 단위 테스트에서 메서드를 직접 호출해 초기화 동작을 검증할 수 있습니다.

## `InitializingBean` / `DisposableBean` — Spring 인터페이스 방식

```java
@Component
public class ConnectionPool implements InitializingBean, DisposableBean {

    private HikariDataSource dataSource;

    @Override
    public void afterPropertiesSet() throws Exception {
        // @PostConstruct와 동일한 시점이지만 Spring에 종속
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:h2:mem:testdb");
        dataSource = new HikariDataSource(config);
    }

    @Override
    public void destroy() throws Exception {
        if (dataSource != null) {
            dataSource.close();
        }
    }
}
```

`InitializingBean.afterPropertiesSet()`은 `@PostConstruct`보다 나중에, `initMethod`보다 먼저 실행됩니다. Spring 특유의 인터페이스에 의존하기 때문에 신규 코드에서는 `@PostConstruct`를 선호합니다. 레거시 코드에서는 자주 볼 수 있습니다.

## `@Bean(initMethod / destroyMethod)` — 외부 라이브러리 통합

소스 코드를 수정할 수 없는 외부 라이브러리 클래스에 생명주기를 적용할 때 사용합니다.

```java
@Configuration
public class SchedulerConfig {

    @Bean(initMethod = "start", destroyMethod = "stop")
    public Scheduler scheduler() {
        Scheduler s = new Scheduler();
        s.setThreadCount(5);
        return s;
    }
}
```

`Scheduler` 클래스에 어노테이션을 추가할 수 없어도, `@Bean` 선언에서 메서드 이름을 문자열로 지정하면 Spring이 해당 메서드를 자동으로 호출합니다. 문자열이기 때문에 오타 시 런타임에야 `NoSuchMethodException`이 발생한다는 점에 주의합니다.

`destroyMethod`의 기본값은 `"(inferred)"`입니다. Spring은 `close()`나 `shutdown()` 메서드가 있으면 자동으로 소멸 메서드로 추론합니다.

## 콜백 실행 순서와 선택 가이드

![초기화·소멸 콜백 3가지 방식 비교](/assets/posts/spring-bean-lifecycle-callbacks.svg)

동일 빈에 여러 콜백이 등록되면 다음 순서로 실행됩니다.

```
초기화: @PostConstruct → afterPropertiesSet() → initMethod
소멸:   @PreDestroy    → destroy()            → destroyMethod
```

실무 선택 기준:

```
내가 만든 클래스, 초기화 필요       → @PostConstruct / @PreDestroy
외부 라이브러리, @Bean으로 등록     → initMethod / destroyMethod
Spring 레거시 코드 분석 시          → InitializingBean / DisposableBean 이해 필요
```

## SmartInitializingSingleton — 모든 싱글톤 완성 후

일반 `@PostConstruct`는 **해당 빈** 단독의 초기화 완료를 보장하지만, 다른 싱글톤 빈들이 모두 초기화된 뒤에 작업해야 할 때가 있습니다. 이 경우 `SmartInitializingSingleton`을 구현합니다.

```java
@Component
public class PluginRegistry implements SmartInitializingSingleton {

    private final List<Plugin> plugins;

    public PluginRegistry(List<Plugin> plugins) {
        this.plugins = plugins;
    }

    @Override
    public void afterSingletonsInstantiated() {
        // 모든 싱글톤 빈이 생성된 후 호출
        plugins.forEach(p -> {
            p.initialize();
            System.out.println("플러그인 등록: " + p.getName());
        });
    }
}
```

`ApplicationListener<ContextRefreshedEvent>`도 동일한 시점을 포착할 수 있지만, `SmartInitializingSingleton`이 더 간결합니다.

## 생명주기 콜백 테스트

```java
class CacheLoaderTest {

    @Test
    void init_loadsCache() {
        ItemRepository mockRepo = Mockito.mock(ItemRepository.class);
        given(mockRepo.findAll()).willReturn(List.of(new Item(1L, "책")));

        CacheLoader loader = new CacheLoader(mockRepo);
        loader.init();  // @PostConstruct 메서드 직접 호출

        assertThat(loader.getCache()).hasSize(1);
    }

    @Test
    void teardown_clearCache() {
        CacheLoader loader = new CacheLoader(Mockito.mock(ItemRepository.class));
        loader.init();
        loader.teardown();  // @PreDestroy 직접 호출

        assertThat(loader.getCache()).isEmpty();
    }
}
```

`@PostConstruct`와 `@PreDestroy`를 일반 public 메서드로 선언하면 테스트에서 직접 호출할 수 있습니다. 이것이 인터페이스 구현 방식보다 테스트 친화적인 이유 중 하나입니다.

## 컨테이너 종료 훅 등록

`ApplicationContext.close()`를 명시적으로 호출하거나 JVM 셧다운 훅을 등록해야 `@PreDestroy`가 호출됩니다.

```java
// 스프링 부트 앱은 자동 등록되지만,
// 일반 ApplicationContext를 사용하면 직접 등록 필요
ConfigurableApplicationContext ctx =
    new AnnotationConfigApplicationContext(AppConfig.class);
ctx.registerShutdownHook();   // JVM 종료 시 @PreDestroy 자동 호출
```

Spring Boot 애플리케이션은 `SpringApplication.run()`이 반환하는 `ConfigurableApplicationContext`에 셧다운 훅이 기본으로 등록되어 있습니다.

## 정리

- **①→② 인스턴스화·주입** → 생성자 호출 후 `@Autowired` 처리
- **③④⑤ 초기화 단계** → BPP Before → `@PostConstruct` → BPP After(AOP)
- **⑥ 사용** → 실제 서비스 처리
- **⑦ 소멸** → `@PreDestroy` 호출 후 GC
- 콜백 선택: `@PostConstruct` 우선, 외부 라이브러리엔 `initMethod`
- JVM 셧다운 훅 등록이 되어야 `@PreDestroy`가 실행됨

---

**지난 글:** [Spring Bean Scope: 싱글톤부터 Request·Session까지](/posts/spring-bean-scope/)

**다음 글:** [BeanPostProcessor: Spring AOP와 확장 포인트의 핵심](/posts/spring-bean-postprocessor/)

<br>
읽어주셔서 감사합니다. 😊
