---
title: "lsof — 열린 파일과 소켓 한눈에 보기"
description: "lsof의 파일 디스크립터 조회 원리, 포트 점유 확인(-i), 삭제 파일 잔존 진단, FD 한도 소진 트러블슈팅, 실전 명령어 모음을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 2
type: "knowledge"
category: "Linux"
tags: ["linux", "lsof", "debugging", "network", "file-descriptor", "troubleshooting", "socket"]
featured: false
draft: false
---

[지난 글](/posts/linux-ltrace-basics/)에서 ltrace로 라이브러리 함수 호출을 추적하는 방법을 배웠습니다. 이번에는 **lsof(LiSt Open Files)** — 실행 중인 프로세스가 현재 열고 있는 모든 파일과 소켓을 보여주는 도구를 살펴봅니다.

리눅스에서 "모든 것은 파일"이라는 철학 덕분에 lsof 하나로 일반 파일, 디렉터리, 네트워크 소켓, 유닉스 소켓, 파이프, 디바이스를 모두 조회할 수 있습니다.

## 기본 출력 이해

```bash
# 현재 시스템의 모든 열린 파일 (매우 많음)
sudo lsof

# 특정 프로세스만
lsof -p 1234

# 특정 파일을 열고 있는 프로세스
lsof /var/log/syslog
```

출력의 주요 컬럼:

| 컬럼 | 의미 |
|------|------|
| COMMAND | 프로세스 이름 (앞 9자) |
| PID | 프로세스 ID |
| USER | 실행 사용자 |
| FD | 파일 디스크립터 (cwd/txt/숫자+r/w/u) |
| TYPE | REG/DIR/IPv4/IPv6/unix/FIFO 등 |
| NAME | 파일 경로 또는 소켓 상세 |

FD 값 중 `cwd`는 현재 작업 디렉터리, `txt`는 실행 바이너리, `mem`은 메모리 맵 파일을 의미합니다. 숫자에 붙는 `r`은 읽기, `w`는 쓰기, `u`는 읽기+쓰기입니다.

![lsof 동작 원리](/assets/posts/linux-lsof-concept.svg)

## 네트워크 소켓 조회

가장 자주 쓰이는 시나리오입니다. "8080 포트가 이미 사용 중"이라는 오류 메시지를 받았을 때:

```bash
# 포트 8080을 점유한 프로세스 확인
sudo lsof -i :8080

# TCP/UDP 구분
sudo lsof -i tcp:443
sudo lsof -i udp:53

# 포트 번호 그대로 표시 (-P), DNS 조회 생략 (-n) — 빠름
sudo lsof -i -P -n

# LISTEN 상태만 (서버 포트 목록)
sudo lsof -i -s TCP:LISTEN -P -n

# ESTABLISHED 연결만
sudo lsof -i -s TCP:ESTABLISHED
```

![lsof 실전 명령어](/assets/posts/linux-lsof-commands.svg)

## 삭제됐는데 공간이 안 풀리는 문제

`rm`으로 파일을 삭제했는데 `df`로 보면 공간이 그대로인 경우, 어떤 프로세스가 아직 그 파일의 fd를 열고 있는 것입니다.

```bash
# 삭제됐지만 여전히 열려 있는 파일
sudo lsof | grep deleted

# 예시 출력:
# nginx 2345 www-data 10w REG 8,1 2.1GB /var/log/nginx/access.log (deleted)
```

해당 PID를 재시작하거나 fd를 닫으면 공간이 해제됩니다. 급할 때는:

```bash
# 해당 프로세스의 fd를 강제로 비움 (주의: 프로세스에 따라 crash 가능)
> /proc/2345/fd/10
```

## FD 한도 소진 문제 진단

"too many open files" 오류가 나면 프로세스의 파일 디스크립터 한도를 초과한 것입니다.

```bash
# 특정 프로세스의 열린 FD 수
lsof -p 1234 | wc -l

# 시스템 최대 FD 수
cat /proc/sys/fs/file-max

# 현재 사용자 프로세스 한도
ulimit -n

# 현재 시스템 전체 열린 FD 수
cat /proc/sys/fs/file-nr
```

한도를 올리려면:

```bash
# 현재 세션에서 임시 증가
ulimit -n 65535

# /etc/security/limits.conf 에 영구 설정
# *  soft  nofile  65535
# *  hard  nofile  65535
```

## 사용자별 추적

```bash
# alice가 열고 있는 모든 파일
lsof -u alice

# alice 제외 (-u^)
lsof -u^alice

# 특정 사용자의 네트워크 연결
lsof -u alice -i
```

보안 감사나 사용자 활동 모니터링에 유용합니다.

## 프로세스가 사용하는 라이브러리 목록

```bash
# 특정 프로세스의 메모리 맵 (로드된 .so)
lsof -p 1234 | grep '\.so'

# 특정 .so를 사용하는 프로세스 찾기
lsof /lib/x86_64-linux-gnu/libc.so.6
```

라이브러리 업데이트 후 재시작이 필요한 프로세스를 찾는 데 활용할 수 있습니다.

## 디렉터리 아래 모든 파일 조회

```bash
# /data 디렉터리 아래 열린 파일
lsof +D /data

# 단순 경로 접두사 (더 빠름, 심볼릭 링크는 추적 안 함)
lsof +d /data
```

`+D`는 재귀적으로 탐색하므로 큰 디렉터리에서는 느릴 수 있습니다.

## ss / netstat와의 비교

네트워크 연결만 볼 때는 `ss`가 더 빠르고 상세합니다.

```bash
# lsof 방식
sudo lsof -i -P -n

# ss 방식 (더 빠름)
ss -tulnp

# 특정 포트
ss -tulnp | grep 8080
```

lsof의 강점은 네트워크뿐 아니라 일반 파일, 소켓, 파이프를 **하나의 인터페이스**로 조회할 수 있다는 점입니다.

---

**지난 글:** [ltrace 기초 — 라이브러리 함수 호출 추적으로 동작 파악하기](/posts/linux-ltrace-basics/)

**다음 글:** [eBPF 개요 — 커널을 재컴파일 없이 관찰하는 혁신적 기술](/posts/linux-eBPF-overview/)

<br>
읽어주셔서 감사합니다. 😊
