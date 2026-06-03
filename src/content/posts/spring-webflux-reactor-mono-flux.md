---
title: "Reactor Mono·Flux 완전 정복: 오퍼레이터와 실전 패턴"
description: "Spring WebFlux의 핵심인 Project Reactor의 Mono와 Flux를 팩토리 메서드, 핵심 오퍼레이터(map/flatMap/zip), 에러 처리, 스케줄러까지 실전 코드와 함께 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["Reactor", "Mono", "Flux", "Spring WebFlux", "flatMap", "zip", "에러처리", "Scheduler"]
featured: false
draft: false
---

[지난 글](/posts/spring-webflux-reactive-concept/)에서 리액티브 프로그래밍의 개념과 Spring WebFlux의 아키텍처를 살펴봤다. 이번 글에서는 WebFlux의 실질적인 구현체인 **Project Reactor**의 두 핵심 타입 `Mono`와 `Flux`를 오퍼레이터와 함께 깊이 파고든다. 이 두 타입을 자유롭게 다룰 수 있어야 WebFlux 애플리케이션을 작성할 수 있다.

## Mono와 Flux의 본질

`Mono<T>`는 0개 또는 1개의 아이템을, `Flux<T>`는 0개에서 N개(무한 포함)의 아이템을 비동기적으로 방출하는 Publisher다.

```java
// Mono — 단건 처리
Mono<User> findUserById(Long id);       // 찾으면 1개, 없으면 empty
Mono<Void> deleteUser(Long id);         // 완료 신호만 (아이템 없음)
Mono<User> saveUser(User user);         // 저장 후 저장된 엔티티 반환

// Flux — 다건 처리
Flux<User> findAllUsers();              // 0~N개 사용자 스트림
Flux<String> streamChatMessages();      // 무한 스트림 (SSE/WebSocket)
Flux<Integer> range = Flux.range(1, 10);  // 1~10 시퀀스
```

**가장 중요한 특성**: Reactor 타입은 **Cold Publisher**다. `subscribe()`를 호출하기 전까지 아무것도 실행되지 않는다. DB 쿼리도, 네트워크 요청도 없다. 단지 "무엇을 할지" 설명하는 파이프라인을 조립하는 것뿐이다.

```java
// 이 코드는 아무것도 실행하지 않는다
Mono<User> pipeline = userRepository.findById(1L)
    .map(User::toDto)
    .doOnNext(dto -> log.info("Found: {}", dto));

// subscribe() 호출 시 비로소 실행된다
pipeline.subscribe(dto -> System.out.println(dto));
```

Spring WebFlux 컨트롤러에서 `Mono`/`Flux`를 반환하면, 프레임워크가 내부적으로 `subscribe()`를 호출한다.

![Mono·Flux 구독 생명주기](/assets/posts/spring-webflux-reactor-mono-flux-lifecycle.svg)

## 팩토리 메서드 — 어떻게 만드는가

```java
// === Mono 생성 ===
Mono<String> just = Mono.just("hello");                  // 즉시 값
Mono<String> empty = Mono.empty();                       // 값 없이 완료
Mono<String> error = Mono.error(new RuntimeException()); // 즉시 에러

// 블로킹 코드를 Reactor에 편입
Mono<String> callable = Mono.fromCallable(() -> blockingJdbcCall());
Mono<String> future = Mono.fromFuture(asyncMethod());
Mono<String> supplier = Mono.fromSupplier(() -> expensiveCompute());

// defer — 구독할 때마다 새로 생성 (lazy evaluation)
Mono<LocalDateTime> now = Mono.defer(() -> Mono.just(LocalDateTime.now()));
```

```java
// === Flux 생성 ===
Flux<String> fromJust = Flux.just("a", "b", "c");
Flux<Integer> fromRange = Flux.range(1, 100);
Flux<User> fromList = Flux.fromIterable(userList);
Flux<Long> interval = Flux.interval(Duration.ofSeconds(1));  // 1초마다 0, 1, 2...

// 두 Flux 결합
Flux<String> merged = Flux.merge(flux1, flux2);   // 순서 무관 병합
Flux<String> concat = Flux.concat(flux1, flux2);  // 순서 보장 순차 연결
```

## map vs flatMap — 가장 중요한 구분

```java
// map — 동기 변환 (1:1)
// T → R 변환, 내부에서 Publisher를 반환하면 안 됨
Flux<String> names = userFlux.map(user -> user.getName());
Mono<String> upper = mono.map(String::toUpperCase);

// flatMap — 비동기 변환 (1:Mono/Flux → 평탄화)
// T → Mono<R> 변환, 내부 Publisher를 구독하고 결과를 평탄화
Flux<Order> orders = userFlux.flatMap(user -> orderService.findByUser(user));
```

`flatMap`을 잘못 이해하면 `map`으로 `Mono<Mono<T>>`를 만드는 실수를 저지른다.

```java
// 틀린 예 — Flux<Mono<User>>가 되어버림
Flux<Mono<User>> wrong = idFlux.map(id -> userRepository.findById(id));

// 올바른 예 — Flux<User>로 평탄화
Flux<User> correct = idFlux.flatMap(id -> userRepository.findById(id));
```

`flatMap`의 특징:
- 내부 Publisher들을 **동시에(concurrently)** 구독
- 완료 순서는 보장하지 않음 (빠른 것부터 방출)
- 순서 보장이 필요하면 `concatMap` 사용 (순차 처리, 느림)

```java
// flatMap: 병렬 실행, 순서 무보장
Flux<String> fast = idFlux.flatMap(id -> fetchAsync(id));

// concatMap: 순차 실행, 순서 보장
Flux<String> ordered = idFlux.concatMap(id -> fetchAsync(id));
```

![Reactor 핵심 오퍼레이터 시각화](/assets/posts/spring-webflux-reactor-mono-flux-operators.svg)

## 핵심 오퍼레이터 정리

```java
Flux<User> users = userRepository.findAll();

// filter — 조건에 맞는 항목만 통과
Flux<User> actives = users.filter(User::isActive);

// take / skip — 앞에서 N개, 또는 N개 건너뜀
Flux<User> first10 = users.take(10);
Flux<User> after5 = users.skip(5);

// distinct — 중복 제거
Flux<String> uniqueEmails = users.map(User::getEmail).distinct();

// collectList — Flux를 Mono<List>로 수집
Mono<List<User>> list = users.collectList();

// reduce — 하나로 집계
Mono<Integer> totalAge = users.map(User::getAge).reduce(0, Integer::sum);

// window / buffer — 배치 처리
Flux<Flux<User>> windows = users.window(100);  // 100개씩 윈도우
Flux<List<User>> batches = users.buffer(100);  // 100개씩 리스트
```

## zip — 여러 Publisher 결합

`zip`은 여러 비동기 작업을 **병렬로 실행**하고 모두 완료되면 결합한다. 대시보드처럼 여러 API를 동시에 호출해야 할 때 매우 유용하다.

```java
@GetMapping("/dashboard/{userId}")
public Mono<DashboardResponse> getDashboard(@PathVariable Long userId) {
    Mono<User> userMono = userService.findById(userId);
    Mono<List<Order>> ordersMono = orderService.findRecent(userId);
    Mono<Integer> pointsMono = pointService.getBalance(userId);
    Mono<List<Notification>> notifMono = notifService.getUnread(userId);

    // 4개 API를 병렬 호출 후 결합 — 가장 느린 것이 전체 시간을 결정
    return Mono.zip(userMono, ordersMono, pointsMono, notifMono)
        .map(tuple -> DashboardResponse.builder()
            .user(tuple.getT1())
            .recentOrders(tuple.getT2())
            .points(tuple.getT3())
            .notifications(tuple.getT4())
            .build()
        );
}
```

순차 호출 대비 응답 시간이 각 서비스 응답 시간의 합에서 최댓값으로 줄어든다.

## 에러 처리

리액티브 스트림에서 에러는 `onError` 신호로 전파된다. try-catch 대신 오퍼레이터로 처리한다.

```java
// onErrorReturn — 에러 시 기본값 반환
Mono<User> user = userRepository.findById(id)
    .onErrorReturn(User.GUEST);

// onErrorResume — 에러 시 대체 Publisher로 전환
Mono<User> user2 = userRepository.findById(id)
    .onErrorResume(NotFoundException.class, e ->
        cacheService.findUser(id)           // 캐시에서 재시도
    );

// onErrorMap — 에러 타입 변환
Mono<User> user3 = userRepository.findById(id)
    .onErrorMap(DataAccessException.class, e ->
        new UserServiceException("DB 조회 실패", e)
    );

// doOnError — 에러 로깅 (에러는 계속 전파)
Mono<User> user4 = userRepository.findById(id)
    .doOnError(e -> log.error("User 조회 실패: {}", e.getMessage()))
    .onErrorReturn(User.GUEST);

// retry — 자동 재시도
Mono<String> retry = externalApiCall()
    .retry(3)                               // 최대 3회 재시도
    .retryWhen(Retry.backoff(3, Duration.ofMillis(100)));  // 지수 백오프
```

## switchIfEmpty와 defaultIfEmpty

```java
// defaultIfEmpty — Mono가 empty일 때 기본값
Mono<User> user = userRepository.findById(id)
    .defaultIfEmpty(User.GUEST);

// switchIfEmpty — empty일 때 다른 Publisher로 전환
Mono<User> user2 = userRepository.findById(id)
    .switchIfEmpty(
        Mono.error(new UserNotFoundException("User not found: " + id))
    );

// 404 응답 처리 패턴
@GetMapping("/{id}")
public Mono<ResponseEntity<UserDto>> findById(@PathVariable Long id) {
    return userService.findById(id)
        .map(user -> ResponseEntity.ok(user.toDto()))
        .switchIfEmpty(Mono.just(ResponseEntity.notFound().build()));
}
```

## doOn 사이드 이펙트 오퍼레이터

```java
userFlux
    .doOnSubscribe(sub -> log.info("구독 시작"))
    .doOnNext(user -> log.debug("처리: {}", user.getName()))
    .doOnError(e -> log.error("에러: {}", e.getMessage()))
    .doOnComplete(() -> log.info("완료"))
    .doFinally(signalType -> log.info("종료: {}", signalType));  // 항상 실행
```

`doOn*` 오퍼레이터는 스트림을 변경하지 않고 사이드 이펙트(로깅, 메트릭)만 수행한다.

## Scheduler — 어떤 스레드에서 실행할까

```java
// subscribeOn — 소스 구독을 어떤 스케줄러에서 할지 (전체 영향)
Mono<String> blocking = Mono.fromCallable(() -> jdbcQuery())
    .subscribeOn(Schedulers.boundedElastic());   // 블로킹 I/O용

// publishOn — 이 시점 이후 오퍼레이터들을 어떤 스케줄러에서 실행할지
Flux<String> mixed = Flux.range(1, 10)
    .subscribeOn(Schedulers.parallel())
    .map(i -> heavyCompute(i))
    .publishOn(Schedulers.boundedElastic())
    .flatMap(result -> saveToDb(result));        // DB 저장은 별도 스레드
```

| 스케줄러 | 스레드 수 | 적합한 작업 |
|---|---|---|
| `Schedulers.parallel()` | CPU 코어 수 | CPU 집약 연산 |
| `Schedulers.boundedElastic()` | 최대 10 × CPU | 블로킹 I/O (JDBC, 파일) |
| `Schedulers.single()` | 1개 (재사용) | 순차 실행 보장 |
| `Schedulers.immediate()` | 현재 스레드 | 테스트, 동기 실행 |

## StepVerifier로 테스트

리액티브 코드는 `StepVerifier`로 테스트한다.

```java
@Test
void testUserFlux() {
    Flux<User> users = userService.findAll();

    StepVerifier.create(users)
        .expectNextMatches(u -> u.getId() != null)
        .expectNextCount(4)                     // 그 다음 4개 확인
        .expectComplete()                        // 완료 신호 확인
        .verify(Duration.ofSeconds(3));
}

@Test
void testEmptyResult() {
    Mono<User> user = userService.findById(-1L);

    StepVerifier.create(user)
        .expectEmpty()                           // 빈 Mono 확인
        .verify();
}

@Test
void testErrorHandling() {
    Mono<User> error = userService.findById(999L);

    StepVerifier.create(error)
        .expectError(UserNotFoundException.class)  // 특정 에러 확인
        .verify();
}
```

## 실전 패턴 — WebFlux Repository와 서비스 계층

```java
// R2DBC 기반 Repository
@Repository
public interface UserRepository extends ReactiveCrudRepository<User, Long> {
    Flux<User> findByActiveTrue();
    Mono<User> findByEmail(String email);
}

// 서비스 계층
@Service
@RequiredArgsConstructor
@Transactional  // @Transactional은 WebFlux에서도 동작 (R2DBC)
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public Mono<User> register(RegisterRequest req) {
        return userRepository.findByEmail(req.getEmail())
            .flatMap(existing -> Mono.<User>error(
                new EmailAlreadyExistsException(req.getEmail())
            ))
            .switchIfEmpty(Mono.defer(() -> {
                User user = User.of(req, passwordEncoder.encode(req.getPassword()));
                return userRepository.save(user);
            }));
    }

    public Flux<UserSummary> findActiveSummaries() {
        return userRepository.findByActiveTrue()
            .map(UserSummary::from)
            .onErrorResume(e -> {
                log.error("활성 사용자 조회 실패", e);
                return Flux.empty();
            });
    }
}
```

`switchIfEmpty`와 `flatMap`의 조합은 "이미 존재하면 에러, 없으면 생성" 패턴을 명확하게 표현한다.

---

**지난 글:** [Spring WebFlux와 리액티브 프로그래밍 개념](/posts/spring-webflux-reactive-concept/)

<br>
읽어주셔서 감사합니다. 😊
