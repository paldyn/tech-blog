---
title: "Docker OOM Kill 해결 — 컨테이너 메모리 부족"
description: "컨테이너가 exit code 137로 갑자기 종료되는 OOM Kill의 원인을 진단하고, 메모리 제한 조정·JVM 힙 설정·스왑 구성으로 해결하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 7
type: "knowledge"
category: "Docker"
tags: ["docker", "oom", "memory", "cgroup", "JVM", "트러블슈팅"]
featured: false
draft: false
---

[지난 글](/posts/docker-mount-permission-issue/)에서 마운트 권한 문제를 해결했다. 이번에는 컨테이너가 예고 없이 꺼지는 **OOM Kill** 문제를 다룬다. 로그도 없이 컨테이너가 죽으면 당황스럽지만, 진단 방법을 알면 빠르게 원인을 찾을 수 있다.

## 증상 확인

```bash
# 컨테이너 상태 확인
docker ps -a
# STATUS: Exited (137) 12 seconds ago

# exit code 137 = SIGKILL (128 + 9)
# OOM Killer가 강제 종료한 것

# OOMKilled 여부 직접 확인
docker inspect <컨테이너명> \
  --format='{{.State.OOMKilled}} exitCode={{.State.ExitCode}}'
# true exitCode=137
```

`OOMKilled: true`이면 OOM이 원인이다. 커널 메시지에서도 확인할 수 있다.

```bash
# 호스트 커널 로그에서 OOM 기록 확인
dmesg | grep -i "oom\|killed\|memory"
# [12345.678] oom-kill: constraint=CONSTRAINT_MEMCG ... killed
```

![OOM Kill 발생 메커니즘](/assets/posts/docker-killed-oom-diagram.svg)

## 원인 파악

Docker의 `--memory` 플래그는 cgroup을 통해 컨테이너의 메모리를 제한한다. 앱이 그 한도를 초과하면 커널 OOM Killer가 해당 프로세스를 SIGKILL로 종료한다. exit code는 항상 **137**이다.

```bash
# 현재 메모리 사용량 실시간 확인
docker stats <컨테이너명>

# 한 번만 찍기
docker stats --no-stream

# 컨테이너에 설정된 메모리 제한 확인
docker inspect <컨테이너명> \
  --format='Memory={{.HostConfig.Memory}} Swap={{.HostConfig.MemorySwap}}'
# Memory=536870912 (512MB) Swap=1073741824 (1GB)
```

## 해결 방법

### 방법 1: 메모리 제한 늘리기

```bash
# 실행 시 메모리 지정
docker run --memory=1g --memory-swap=1g myapp

# 스왑 무제한 허용
docker run --memory=1g --memory-swap=-1 myapp

# Compose
```

```yaml
# docker-compose.yml
services:
  app:
    image: myapp
    mem_limit: 1g
    memswap_limit: 1g
```

`--memory-swap`은 메모리+스왑의 합계 제한이다. `-1`로 설정하면 스왑을 무제한으로 사용할 수 있다.

### 방법 2: 메모리 제한 없이 실행 (개발 환경)

```bash
# 제한 없이 실행 (기본값)
docker run myapp

# 현재 메모리 제한 확인 (0 = 무제한)
docker inspect myapp --format='{{.HostConfig.Memory}}'
# 0
```

### 방법 3: JVM 힙 크기 조정

![JVM 메모리 튜닝 &amp; OOM 예방](/assets/posts/docker-killed-oom-jvm.svg)

Java 앱은 컨테이너 메모리 제한을 인식하지 못하고 호스트 전체 메모리 기준으로 힙을 설정하는 경우가 있다.

```bash
# Java 11+: 컨테이너 인식 옵션
java -XX:+UseContainerSupport \
     -XX:MaxRAMPercentage=75.0 \
     -jar app.jar

# 또는 명시적 힙 제한
java -Xmx400m -Xms256m -jar app.jar
```

컨테이너 메모리가 512MB라면 JVM 힙을 400MB(-Xmx400m)로 제한해 나머지를 OS와 메타스페이스에 남겨둔다.

```dockerfile
FROM eclipse-temurin:21-jre
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"
CMD java $JAVA_OPTS -jar /app.jar
```

### 방법 4: Node.js 힙 제한

```bash
# Node.js 힙 크기 제한 (MB 단위)
node --max-old-space-size=400 server.js

# 환경변수로 설정
NODE_OPTIONS="--max-old-space-size=400" node server.js
```

컨테이너가 512MB라면 Node.js 힙은 400MB 정도로 제한한다.

## 스왑 설정

```bash
# 스왑 사용 여부 확인
free -h
swapon --show

# 스왑 없는 호스트에서 스왑 추가 (임시)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

스왑이 있으면 OOM Kill 전에 스왑을 사용하므로 완충이 된다. 단 SSD에 스왑 쓰기가 과도해지면 성능 저하가 생긴다.

## 메모리 누수 탐지

```bash
# 시간에 따른 메모리 추이 확인
watch -n 5 'docker stats --no-stream'

# 1시간 동안 1분마다 메모리 기록
for i in $(seq 1 60); do
  docker stats --no-stream --format \
    "{{.MemUsage}}" myapp >> /tmp/mem.log
  sleep 60
done
cat /tmp/mem.log
```

메모리가 시간이 지날수록 계속 증가한다면 앱 내부의 메모리 누수가 원인이다. 단순히 제한을 늘려도 결국 다시 OOM이 발생한다. 앱 코드 수준에서 누수를 찾아 수정해야 한다.

---

**지난 글:** [Docker 볼륨 마운트 권한 문제 해결](/posts/docker-mount-permission-issue/)

**다음 글:** [Docker 빌드 캐시 실패 트러블슈팅](/posts/docker-build-fails-cache/)

<br>
읽어주셔서 감사합니다. 😊
