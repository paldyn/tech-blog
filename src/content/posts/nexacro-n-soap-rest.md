---
title: "[Nexacro N] SOAP과 REST 연동"
description: "Nexacro N 어댑터에서 외부 SOAP 웹서비스와 REST API를 연동하는 방법을 설명합니다. JAX-WS 클라이언트, WebClient 호출, JSON-to-DataSet 변환, 오류 처리 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 7
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "SOAP", "REST", "외부API", "WebClient", "JAX-WS", "연동"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-db-integration/)에서 DB 연동 패턴을 살펴보았다. 이번에는 Nexacro N 프로젝트에서 외부 SOAP 웹서비스나 REST API를 연동하는 방법을 다룬다.

기업 시스템에서는 자체 DB뿐 아니라 ERP, 공공 API, 타 부서 마이크로서비스와 연동해야 하는 경우가 많다. Nexacro N 클라이언트는 어댑터 서비스만 바라보면 되고, 외부 시스템과의 실제 통신은 어댑터 서비스 레이어에서 처리한다.

## 연동 구조

![SOAP / REST 연동 경로](/assets/posts/nexacro-n-soap-rest-comparison.svg)

Nexacro N 클라이언트는 항상 `transaction()`으로 어댑터를 호출한다. 어댑터 서비스가 내부적으로 외부 REST API나 SOAP 서비스를 호출하고, 결과를 DataSet으로 변환해 클라이언트에 반환한다. 클라이언트 코드는 외부 시스템의 종류와 무관하게 동일한 DataSet 패턴을 사용한다.

## REST API 호출

![REST / SOAP 호출 코드](/assets/posts/nexacro-n-soap-rest-code.svg)

Spring WebClient를 사용해 외부 REST API를 호출한다. WebClient는 비동기 지원하지만, 어댑터 서비스 메서드가 동기 방식이므로 `.block()`으로 동기화한다.

```java
@Configuration
public class WebClientConfig {
    @Bean
    public WebClient externalApiClient() {
        return WebClient.builder()
            .baseUrl("https://api.external-service.com")
            .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .defaultHeader("X-API-KEY", System.getenv("EXTERNAL_API_KEY"))
            .build();
    }
}
```

```java
@NexaService
@Service
public class ItemExternalService {

    @Autowired
    private WebClient externalApiClient;

    public void getItem(DataSet dsIn, DataSet dsOut, VariableList vl)
            throws NexaServiceException {

        String itemCd = dsIn.getStringColumn(0, "ITEM_CD");

        try {
            Map<?, ?> result = externalApiClient.get()
                .uri("/items/{code}", itemCd)
                .retrieve()
                .onStatus(HttpStatusCode::isError, response ->
                    response.bodyToMono(String.class)
                        .map(body -> new RuntimeException("API 오류: " + body))
                )
                .bodyToMono(Map.class)
                .block();

            dsOut.addStringColumn("ITEM_NM");
            dsOut.addStringColumn("ITEM_PRICE");
            int row = dsOut.newRow();
            dsOut.set(row, "ITEM_NM",    (String) result.get("name"));
            dsOut.set(row, "ITEM_PRICE", String.valueOf(result.get("price")));

            vl.addVariable("errCode", "0");
        } catch (RuntimeException e) {
            throw new NexaServiceException("EXT_API_ERR", e.getMessage());
        }
    }
}
```

`onStatus()`로 HTTP 4xx/5xx 오류를 처리하고, `NexaServiceException`으로 변환해 클라이언트에 오류 코드를 전달한다.

## SOAP 웹서비스 호출

레거시 공공기관 API나 구형 ERP는 SOAP 형식으로 서비스를 제공하는 경우가 있다. JAX-WS의 `wsimport` 도구로 WSDL에서 Java 스텁을 자동 생성한다.

```bash
# WSDL에서 Java 스텁 생성
wsimport -s src/main/java -p com.example.soap.client \
         https://legacy-erp.example.com/ItemService?wsdl
```

생성된 스텁 클래스를 사용해 서비스를 호출한다.

```java
public void getItemFromErp(DataSet dsIn, DataSet dsOut, VariableList vl)
        throws NexaServiceException {

    String itemCd = dsIn.getStringColumn(0, "ITEM_CD");

    try {
        ItemServiceSoap port = new ItemServiceSoap_Service().getItemServiceSoap();

        // 요청 객체 구성
        GetItemRequest request = new GetItemRequest();
        request.setItemCode(itemCd);

        // SOAP 호출
        GetItemResponse response = port.getItem(request);

        // 응답 → DataSet
        dsOut.addStringColumn("ITEM_NM");
        dsOut.addStringColumn("UNIT_PRICE");
        int row = dsOut.newRow();
        dsOut.set(row, "ITEM_NM",    response.getItemName());
        dsOut.set(row, "UNIT_PRICE", String.valueOf(response.getUnitPrice()));

        vl.addVariable("errCode", "0");
    } catch (Exception e) {
        throw new NexaServiceException("SOAP_ERR", "ERP 연동 오류: " + e.getMessage());
    }
}
```

## 복수 외부 API 병렬 호출

두 개 이상의 외부 서비스를 동시에 호출해야 할 때 `Mono.zip()`으로 병렬 처리한다.

```java
public void getItemWithStock(DataSet dsIn, DataSet dsOut, VariableList vl)
        throws NexaServiceException {

    String itemCd = dsIn.getStringColumn(0, "ITEM_CD");

    Mono<Map> itemMono  = externalApiClient.get().uri("/items/{cd}", itemCd)
        .retrieve().bodyToMono(Map.class);
    Mono<Map> stockMono = stockApiClient.get().uri("/stock/{cd}", itemCd)
        .retrieve().bodyToMono(Map.class);

    // 두 API를 동시에 호출하고 결과를 합침
    Mono.zip(itemMono, stockMono).subscribe(tuple -> {
        Map item  = tuple.getT1();
        Map stock = tuple.getT2();
        int row = dsOut.newRow();
        dsOut.set(row, "ITEM_NM",    (String) item.get("name"));
        dsOut.set(row, "STOCK_QTY",  String.valueOf(stock.get("quantity")));
    });

    vl.addVariable("errCode", "0");
}
```

## 타임아웃 및 재시도 설정

외부 API가 느리거나 일시적으로 장애일 때를 대비해 타임아웃과 재시도를 설정한다.

```java
WebClient.builder()
    .baseUrl("https://api.external.com")
    .clientConnector(new ReactorClientHttpConnector(
        HttpClient.create()
            .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 5000)
            .responseTimeout(Duration.ofSeconds(10))
    ))
    .build();
```

재시도가 필요하면 `.retryWhen(Retry.backoff(3, Duration.ofSeconds(1)))`을 `.bodyToMono()` 앞에 추가한다.

---

**지난 글:** [DB 연동 패턴](/posts/nexacro-n-db-integration/)

**다음 글:** [Nexacro 프로토콜 PL](/posts/nexacro-n-protocol-pl/)

<br>
읽어주셔서 감사합니다. 😊
