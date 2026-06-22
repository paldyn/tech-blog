---
title: "gRPC — 고성능 RPC 프레임워크"
description: "gRPC는 .proto 계약에서 클라이언트·서버 코드를 생성하고, Protocol Buffers 바이너리를 HTTP/2로 주고받는 고성능 RPC 프레임워크입니다. RPC의 개념, proto 계약과 코드 생성, 네 가지 호출 방식, REST와의 비교를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-23"
archiveOrder: 6
type: "knowledge"
category: "Java"
tags: ["Java", "gRPC", "RPC", "ProtocolBuffers", "마이크로서비스"]
featured: false
draft: false
---

[지난 글](/posts/java-websocket/)에서 양방향 실시간 통신을 가능하게 하는 WebSocket을 봤습니다. 지금까지 다룬 소켓·HTTP·WebSocket은 모두 "메시지를 어떻게 주고받느냐"에 관한 것이었습니다. 그런데 서버 간 통신, 특히 마이크로서비스 사이에서는 한 단계 높은 추상화를 원하게 됩니다. "메시지를 보낸다"가 아니라 마치 **로컬 메서드를 호출하듯 원격 서비스의 함수를 부르고 싶은** 것입니다. 이 요구에 답하는 것이 RPC이고, 그 현대적 대표 주자가 구글이 만든 gRPC입니다. 이번 글에서 gRPC의 핵심을 정리합니다.

## RPC — 원격 호출을 로컬처럼

RPC(Remote Procedure Call, 원격 프로시저 호출)의 발상은 단순합니다. 네트워크 너머에 있는 함수를, 마치 같은 프로그램 안의 함수인 것처럼 호출하자는 것입니다. `userService.getUser(42)`라고 쓰면, 그 호출이 실제로는 네트워크를 건너 다른 서버의 메서드를 실행하고 결과를 돌려받습니다. 직렬화, 전송, 역직렬화 같은 네트워크의 복잡함은 모두 프레임워크 뒤로 숨겨집니다.

gRPC는 이 RPC를 세 가지 핵심 기술 위에 세웠습니다. 인터페이스를 정의하는 **Protocol Buffers**, 빠른 전송을 위한 **HTTP/2**, 그리고 이 둘을 엮는 코드 생성입니다. 이 조합 덕분에 gRPC는 빠르고, 타입이 강제되며, 다양한 언어 간에 동작합니다.

## .proto — 계약이 먼저다

gRPC의 출발점은 항상 `.proto` 파일입니다. 여기에 어떤 서비스가 어떤 메서드를 가지며, 각 메서드가 어떤 메시지를 주고받는지를 **언어 중립적인 계약** 으로 적습니다.

```protobuf
syntax = "proto3";

message UserRequest {
  int64 id = 1;
}

message UserReply {
  string name = 1;
  int32 age = 2;
}

service UserService {
  rpc GetUser(UserRequest) returns (UserReply);
}
```

각 필드 뒤의 `= 1`, `= 2`는 값이 아니라 **필드 번호** 로, 바이너리 인코딩에서 그 필드를 식별하는 태그입니다. 이 번호 덕분에 필드 이름이 바뀌어도 호환이 유지되고, 새 필드를 추가해도 기존 클라이언트가 깨지지 않습니다.

## 계약에서 양쪽 코드를 생성한다

이 `.proto` 하나에서 gRPC 컴파일러(protoc)가 클라이언트와 서버 양쪽의 자바 코드를 자동 생성합니다.

![gRPC — .proto 계약에서 양쪽 코드를 생성한다](/assets/posts/java-grpc-contract.svg)

클라이언트 쪽에는 **Stub** 이 생성됩니다. 스텁의 메서드를 호출하면, 내부적으로 인자를 Protocol Buffers 바이너리로 직렬화해 HTTP/2로 보내고 응답을 역직렬화해 돌려줍니다. 개발자 눈에는 그냥 로컬 메서드 호출처럼 보입니다.

```java
ManagedChannel channel = ManagedChannelBuilder
        .forAddress("localhost", 9090)
        .usePlaintext()
        .build();

UserServiceGrpc.UserServiceBlockingStub stub =
        UserServiceGrpc.newBlockingStub(channel);

UserReply reply = stub.getUser(
        UserRequest.newBuilder().setId(42).build());

System.out.println(reply.getName());   // 원격 호출의 결과
```

서버 쪽에는 생성된 추상 클래스가 있고, 우리는 그 메서드를 **구현** 하기만 하면 됩니다. 통신·직렬화는 전부 프레임워크가 처리하고, 우리는 비즈니스 로직에만 집중합니다. 계약이 코드를 강제하므로, 클라이언트와 서버가 같은 `.proto`를 공유하는 한 타입 불일치가 컴파일 단계에서 드러납니다.

## Protocol Buffers와 HTTP/2의 효율

gRPC가 "고성능"이라 불리는 이유는 전송 형식과 프로토콜에 있습니다. REST API가 흔히 쓰는 JSON은 사람이 읽기 좋은 텍스트지만, 필드 이름이 매번 반복되고 파싱 비용이 큽니다. 반면 **Protocol Buffers** 는 필드 번호와 값만 담는 조밀한 바이너리라 크기가 작고 인코딩·디코딩이 빠릅니다.

여기에 **HTTP/2** 의 연결 다중화가 더해집니다. 하나의 연결로 여러 호출을 동시에 처리하고, 헤더를 압축하며, 양방향 스트리밍을 자연스럽게 지원합니다. 작은 페이로드와 효율적인 프로토콜의 조합이 gRPC의 속도를 만듭니다.

## 네 가지 호출 방식

gRPC는 단순한 요청-응답을 넘어, 스트리밍을 포함한 네 가지 호출 방식을 제공합니다. HTTP/2의 스트리밍 능력을 그대로 활용한 것입니다.

![gRPC의 네 가지 호출 방식](/assets/posts/java-grpc-streaming.svg)

가장 흔한 **Unary** 는 요청 하나에 응답 하나로, 보통의 함수 호출과 같습니다. **Server Streaming** 은 요청 하나에 서버가 여러 응답을 차례로 흘려보내는 방식으로, 목록 전송이나 구독에 적합합니다. **Client Streaming** 은 반대로 클라이언트가 여러 건을 모아 보내고 응답 하나를 받는 형태로, 업로드나 집계에 쓰입니다. **Bidirectional Streaming** 은 양쪽이 동시에 자유롭게 스트림을 주고받는 가장 유연한 방식으로, 실시간 양방향 통신에 어울립니다.

## REST와 어떻게 다른가

gRPC와 REST는 둘 다 서비스 간 통신 방식이지만 지향점이 다릅니다. REST는 텍스트(JSON) 기반이라 사람이 읽기 쉽고, 브라우저에서 바로 호출할 수 있으며, 도구 생태계가 넓습니다. 공개 API에는 여전히 REST가 잘 맞습니다. 반면 gRPC는 바이너리·강타입·고성능이라 내부 마이크로서비스 사이의 통신, 낮은 지연이 중요한 경우, 다양한 언어가 섞인 환경에서 빛납니다. 계약(`.proto`)이 진실의 원천이 되어 클라이언트·서버가 자동으로 동기화된다는 점도 큰 장점입니다. 둘은 경쟁이라기보다, 외부에는 REST, 내부에는 gRPC처럼 역할을 나눠 쓰는 경우가 많습니다.

## 정리

gRPC는 원격 호출을 로컬 메서드 호출처럼 다루는 RPC 프레임워크로, `.proto` 계약에서 클라이언트 스텁과 서버 구현 코드를 생성합니다. 통신은 조밀한 Protocol Buffers 바이너리를 HTTP/2로 주고받아 작고 빠르며, Unary부터 양방향 스트리밍까지 네 가지 호출 방식을 지원합니다. 텍스트·범용성의 REST와 달리 바이너리·강타입·고성능을 추구해, 내부 마이크로서비스 통신에 특히 잘 맞습니다. 이로써 소켓부터 gRPC까지 자바의 네트워킹 지형을 한 바퀴 돌았습니다. 다음 글에서는 시야를 더 넓혀, 자바와 같은 무대를 공유하는 JVM 언어 생태계 전체를 조망합니다.

---

**지난 글:** [WebSocket — 양방향 실시간 통신](/posts/java-websocket/)

**다음 글:** [JVM 언어 생태계 개관](/posts/jvm-languages-overview/)

<br>
읽어주셔서 감사합니다. 😊
