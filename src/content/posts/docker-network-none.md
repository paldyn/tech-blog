---
title: "Docker none 네트워크: 완전한 네트워크 격리"
description: "Docker none 네트워크 드라이버로 loopback만 존재하는 완전 격리 컨테이너를 만드는 방법과 실전 활용 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 4
type: "knowledge"
category: "Docker"
tags: ["docker", "network", "none", "격리", "보안", "loopback"]
featured: false
draft: false
---

[지난 글](/posts/docker-network-host/)에서 격리를 없애고 성능을 극대화하는 host 네트워크를 다뤘다. 이번에는 정반대 방향으로 — **네트워크 연결을 완전히 차단**하는 `none` 드라이버를 살펴본다.

## none 네트워크란

`--network none`으로 실행한 컨테이너는 루프백(`lo`, 127.0.0.1) 인터페이스만 가진다. 외부 인터넷, 다른 컨테이너, 심지어 호스트와의 네트워크 통신도 불가능하다.

```bash
docker run --rm --network none alpine sh -c "ip addr show"
# 1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536
#     inet 127.0.0.1/8 brd 127.255.255.255

docker run --rm --network none alpine ping -c1 8.8.8.8
# ping: connect: Network unreachable
```

## 구조와 격리 범위

![Docker none 네트워크 격리 구조](/assets/posts/docker-network-none-diagram.svg)

none 컨테이너는 외부, 다른 컨테이너, 호스트 어느 쪽과도 TCP/IP 통신이 불가능하다. 데이터를 주고받는 방법은 **볼륨(파일 시스템)**뿐이다.

## 실전 활용 코드

![none 네트워크 실전 사용법](/assets/posts/docker-network-none-code.svg)

### 파일 기반 처리 작업

```bash
# 입력 파일을 볼륨으로 넣고, 결과를 볼륨에서 꺼내는 패턴
docker run --rm \
  --network none \
  -v "$(pwd)/input:/data/in:ro" \
  -v "$(pwd)/output:/data/out" \
  my-processor \
  process /data/in/report.csv /data/out/result.json
```

네트워크 없이 파일만 처리하는 배치 작업에 적합하다. 실수로 외부로 데이터가 유출될 가능성을 차단한다.

### 보안 처리 작업

```bash
# 암호화 키 생성 — 외부 노출 원천 차단
docker run --rm \
  --network none \
  -v "$(pwd)/keys:/output" \
  alpine sh -c \
  "apk add --no-cache openssl && \
   openssl genrsa -out /output/private.pem 4096"
```

암호화 작업, 서명 생성, 민감 데이터 처리 등 외부 통신이 있어선 안 되는 작업에 유용하다.

### 테스트 격리

```bash
# 외부 의존성 없이 단위 테스트 실행
docker run --rm \
  --network none \
  -v "$(pwd):/app" \
  -w /app \
  node:20-alpine \
  npm test
```

테스트가 외부 API에 의존하지 않는지 확인하는 데도 쓸 수 있다. none 네트워크에서 테스트가 실패한다면 외부 네트워크 의존성이 있다는 신호다.

## 커스텀 네트워크 플러그인과의 조합

none 네트워크는 커스텀 CNI 플러그인을 직접 붙이기 위한 시작점으로도 쓰인다. 컨테이너를 none으로 시작해 네트워크 인터페이스를 수동으로 구성할 수 있다.

```bash
# 컨테이너를 none으로 시작
docker run -d --network none --name myapp myimage

# 컨테이너 PID 확인 후 수동 네트워크 설정
PID=$(docker inspect --format '{{.State.Pid}}' myapp)
# ip link, nsenter 등으로 수동 인터페이스 구성
```

Kubernetes와 같은 오케스트레이터가 내부적으로 이 패턴을 사용한다.

## 주의사항

- none 컨테이너에서 패키지를 설치(`apk`, `apt`)하려면 미리 이미지에 포함되어 있어야 한다. 실행 중에는 네트워크가 없어 다운로드 불가
- DNS도 동작하지 않는다
- `docker network connect`로 나중에 네트워크를 연결하는 것은 가능하다

```bash
# none으로 시작했다가 나중에 네트워크 추가
docker run -d --network none --name isolated-app myimage
docker network connect my-net isolated-app
# 이제 my-net 내에서 통신 가능
```

---

**지난 글:** [Docker host 네트워크: 격리 없는 최고 성능](/posts/docker-network-host/)

**다음 글:** [Docker overlay 네트워크: 멀티호스트 컨테이너 통신](/posts/docker-network-overlay/)

<br>
읽어주셔서 감사합니다. 😊
