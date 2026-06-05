---
title: "Spring AI 입문: ChatClient, RAG, 도구 호출까지"
description: "Spring AI의 핵심 추상화인 ChatClient와 ChatModel 구조, 멀티 모델 지원, 스트리밍 응답, @Tool로 구현하는 Function Calling, QuestionAnswerAdvisor로 만드는 RAG 파이프라인을 실전 코드와 함께 소개합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 4
type: "knowledge"
category: "Spring"
tags: ["Spring AI", "ChatClient", "RAG", "Function Calling", "LLM", "OpenAI", "생성형 AI"]
featured: false
draft: false
---

[지난 글](/posts/spring-modern-virtual-threads/)에서 Virtual Threads로 동시성을 개선하는 방법을 봤습니다. 이번 글에서는 Spring 생태계에 생성형 AI를 통합하는 **Spring AI** 프레임워크를 소개합니다.

## Spring AI란

Spring AI는 OpenAI, Anthropic, Google Vertex AI, Ollama 등 다양한 AI 제공자를 **통일된 인터페이스**로 사용할 수 있게 해주는 Spring 생태계 프로젝트입니다. Spring Data가 다양한 데이터베이스를 추상화하듯, Spring AI는 다양한 LLM을 추상화합니다.

핵심 설계 원칙은 **이식성**입니다. OpenAI로 개발한 코드를 Anthropic Claude나 로컬 Ollama로 전환할 때 설정 파일만 변경하면 됩니다.

![Spring AI 핵심 구성 요소](/assets/posts/spring-ai-intro-architecture.svg)

## 의존성 추가

```xml
<!-- Maven: Spring AI BOM -->
<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>org.springframework.ai</groupId>
      <artifactId>spring-ai-bom</artifactId>
      <version>1.0.0</version>
      <type>pom</type>
      <scope>import</scope>
    </dependency>
  </dependencies>
</dependencyManagement>

<dependencies>
  <!-- OpenAI 사용 시 -->
  <dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-openai-spring-boot-starter</artifactId>
  </dependency>
</dependencies>
```

```yaml
# application.yml
spring:
  ai:
    openai:
      api-key: ${OPENAI_API_KEY}
      chat:
        options:
          model: gpt-4o-mini
          temperature: 0.7
```

## ChatClient: 기본 대화

`ChatClient`는 Spring AI의 중심 API입니다. HTTP의 `RestClient`와 비슷한 플루언트 빌더 스타일을 사용합니다.

```java
@Service
public class ChatService {

    private final ChatClient chatClient;

    public ChatService(ChatClient.Builder builder) {
        this.chatClient = builder
            .defaultSystem("당신은 Spring 전문가입니다. 한국어로 답변하세요.")
            .build();
    }

    public String ask(String question) {
        return chatClient.prompt()
            .user(question)
            .call()
            .content();
    }

    // 구조화된 출력 (POJO 매핑)
    public AnswerDto askStructured(String question) {
        return chatClient.prompt()
            .user(question)
            .call()
            .entity(AnswerDto.class);
    }
}
```

## 스트리밍 응답

ChatGPT처럼 답변이 실시간으로 출력되는 스트리밍을 구현합니다.

```java
@GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public Flux<String> stream(@RequestParam String question) {
    return chatClient.prompt()
        .user(question)
        .stream()
        .content();
}
```

```java
// WebClient로 스트리밍 소비
webClient.get()
    .uri("/stream?question=Spring AOP란?")
    .retrieve()
    .bodyToFlux(String.class)
    .subscribe(token -> System.out.print(token));
```

## PromptTemplate: 동적 프롬프트

```java
@Component
public class ProductRecommender {

    private final ChatClient chatClient;

    // 템플릿 파일: src/main/resources/prompts/recommend.st
    @Value("classpath:prompts/recommend.st")
    private Resource promptTemplate;

    public String recommend(String category, int budget) {
        return chatClient.prompt()
            .user(u -> u.text(promptTemplate)
                        .param("category", category)
                        .param("budget", String.valueOf(budget)))
            .call()
            .content();
    }
}
```

```
{{! recommend.st }}
{category} 카테고리에서 {budget}원 이하 제품을 3가지 추천해주세요.
각 제품의 장단점도 함께 설명해주세요.
```

## @Tool: 도구 호출 (Function Calling)

모델이 외부 시스템을 직접 호출하도록 허용합니다. Spring AI는 메서드에 `@Tool` 어노테이션을 붙이면 자동으로 스키마를 생성하고 모델에게 등록합니다.

```java
@Component
public class WeatherTools {

    @Tool(description = "주어진 도시의 현재 날씨를 조회합니다")
    public String getCurrentWeather(
            @ToolParam(description = "도시 이름 (예: 서울, 부산)") String city) {
        // 실제로는 외부 날씨 API 호출
        return "서울: 맑음, 23°C";
    }

    @Tool(description = "특정 날짜의 날씨 예보를 반환합니다")
    public String getWeatherForecast(String city, String date) {
        return city + " " + date + ": 구름 조금, 최고 26°C";
    }
}

// ChatClient에 Tool 등록
@Service
public class WeatherChatService {

    private final ChatClient chatClient;
    private final WeatherTools weatherTools;

    public WeatherChatService(ChatClient.Builder builder,
                               WeatherTools weatherTools) {
        this.chatClient = builder.build();
        this.weatherTools = weatherTools;
    }

    public String askWithTools(String question) {
        return chatClient.prompt()
            .user(question)
            .tools(weatherTools)  // 도구 등록
            .call()
            .content();
    }
}
```

`"서울 오늘 날씨 알려줘"`라고 물으면 모델이 자동으로 `getCurrentWeather("서울")`을 호출하고 결과를 답변에 통합합니다.

## RAG: 내 문서로 답변하기

RAG(Retrieval-Augmented Generation)는 LLM의 지식 한계를 넘어, 내부 문서나 DB를 검색해 답변에 활용하는 패턴입니다.

![RAG 파이프라인 흐름](/assets/posts/spring-ai-intro-rag.svg)

```java
@Configuration
public class RagConfig {

    // 문서 임베딩 후 벡터 스토어에 저장
    @Bean
    CommandLineRunner ingestDocuments(
            VectorStore vectorStore,
            ResourcePatternResolver resolver) {
        return args -> {
            var docs = new TokenTextSplitter()
                .apply(new TikaDocumentReader(
                    resolver.getResource("classpath:docs/manual.pdf"))
                    .get());
            vectorStore.add(docs);
        };
    }
}

@Service
public class RagChatService {

    private final ChatClient chatClient;

    public RagChatService(ChatClient.Builder builder, VectorStore vectorStore) {
        this.chatClient = builder
            .defaultAdvisors(
                new QuestionAnswerAdvisor(vectorStore)  // RAG 어드바이저
            )
            .build();
    }

    public String askAboutManual(String question) {
        return chatClient.prompt()
            .user(question)
            .call()
            .content();
        // QuestionAnswerAdvisor가 자동으로:
        // 1. 질문을 임베딩
        // 2. VectorStore에서 유사 문서 검색
        // 3. 프롬프트에 문서 내용 추가
        // 4. LLM에 전달
    }
}
```

## VectorStore 선택

Spring AI는 여러 벡터 스토어를 지원합니다.

```yaml
# PGVector (PostgreSQL 확장) — 프로덕션 권장
spring:
  ai:
    vectorstore:
      pgvector:
        dimensions: 1536
        index-type: HNSW

# Redis Vector — 캐시 겸용
# Chroma — 개발/테스트용 인메모리
# Qdrant, Weaviate, Pinecone 등
```

```java
// 메모리 내 VectorStore (테스트용)
@TestConfiguration
public class TestConfig {
    @Bean
    VectorStore vectorStore(EmbeddingModel embeddingModel) {
        return new SimpleVectorStore(embeddingModel);
    }
}
```

## 대화 메모리

멀티턴 대화에서 이전 컨텍스트를 유지합니다.

```java
@Service
public class ConversationService {

    private final ChatClient chatClient;

    public ConversationService(ChatClient.Builder builder) {
        this.chatClient = builder
            .defaultAdvisors(
                new MessageChatMemoryAdvisor(new InMemoryChatMemory())
            )
            .build();
    }

    public String chat(String sessionId, String message) {
        return chatClient.prompt()
            .user(message)
            .advisors(a -> a.param(
                CHAT_MEMORY_CONVERSATION_ID_KEY, sessionId))
            .call()
            .content();
    }
}
```

## 모델 전환

OpenAI에서 Anthropic Claude로 전환하려면 의존성과 설정만 변경하면 됩니다.

```xml
<!-- OpenAI → Anthropic 전환 -->
<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-anthropic-spring-boot-starter</artifactId>
</dependency>
```

```yaml
spring:
  ai:
    anthropic:
      api-key: ${ANTHROPIC_API_KEY}
      chat:
        options:
          model: claude-sonnet-4-6
```

서비스 코드(`ChatClient` 사용 부분)는 변경 없이 그대로 동작합니다.

---

**지난 글:** [Virtual Threads로 Spring MVC 성능 극대화하기](/posts/spring-modern-virtual-threads/)

<br>
읽어주셔서 감사합니다. 😊
