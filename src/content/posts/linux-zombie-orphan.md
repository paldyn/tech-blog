---
title: "zombie와 orphan 프로세스 완전 정복"
description: "리눅스 zombie 프로세스와 orphan 프로세스의 생성 원인, 차이점, zombie 제거 방법, SIGCHLD 핸들러와 double fork 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 2
type: "knowledge"
category: "Linux"
tags: ["linux", "zombie", "orphan", "process", "sigchld", "waitpid", "double-fork", "daemon"]
featured: false
draft: false
---

[지난 글](/posts/linux-fork-exec-wait/)에서 `fork()`, `exec()`, `wait()` 시스템 콜을 다뤘습니다. 부모가 `wait()`를 호출하지 않으면 자식이 zombie가 된다고 잠깐 언급했는데, 이번엔 zombie와 orphan을 각각 깊이 파헤칩니다. `ps aux`에서 `Z` 상태가 쌓이기 시작하면 이 글이 필요한 순간입니다.

## Zombie 프로세스란?

자식 프로세스가 `exit()`를 호출하면 커널은 해당 프로세스의 **종료 코드를 프로세스 테이블에 보관**합니다. 부모가 `wait()`로 이 코드를 수거하기 전까지 프로세스는 이미 실행이 멈췄지만 테이블 엔트리는 살아 있습니다. 이 상태가 **zombie(defunct)** 입니다.

```bash
# zombie 확인: STAT 컬럼이 Z 또는 Z+
ps aux | awk '$8 ~ /^Z/ {print $1,$2,$8,$11}'

# pstree로 zombie 탐색
pstree -p | grep defunct
```

### Zombie의 영향

zombie 자체는 CPU나 메모리를 소비하지 않습니다. 하지만 **PID를 점유**하므로, 장기 실행 서버에서 zombie가 계속 쌓이면 `/proc/sys/kernel/pid_max`(기본 32768) 한도에 달해 새 프로세스를 생성할 수 없게 됩니다.

```bash
# 현재 zombie 수 확인
ps aux | grep -c ' Z '

# PID 최대값 확인
cat /proc/sys/kernel/pid_max
```

![Zombie와 Orphan 생성 경로](/assets/posts/linux-zombie-orphan-lifecycle.svg)

## Orphan 프로세스란?

부모가 자식보다 먼저 종료되면 자식은 **orphan(고아)** 이 됩니다. 커널은 orphan을 자동으로 `init`(PID 1, systemd) 에 입양시킵니다. `init`은 항상 `wait()`를 수행하므로 orphan이 zombie가 되는 일은 없습니다.

```bash
# orphan 확인: PPID가 1인 프로세스
ps -o pid,ppid,comm ax | awk '$2==1 && $3!="init" && $3!="systemd"'
```

## Zombie 제거하기

### 방법 1: 부모에 SIGCHLD 보내기

부모가 살아 있고 SIGCHLD 핸들러가 없거나 잘못 구현된 경우, 시그널을 수동으로 보내면 핸들러가 트리거됩니다.

```bash
# zombie의 부모 PID 찾기
PARENT=$(ps -o ppid= -p ZOMBIE_PID | tr -d ' ')

# SIGCHLD 전송
kill -SIGCHLD $PARENT
```

### 방법 2: 부모 재시작 또는 종료

부모가 `wait()`를 전혀 구현하지 않았다면, 부모를 종료하는 것이 가장 확실합니다. 부모가 죽으면 zombie도 init에 입양되어 즉시 회수됩니다.

```bash
kill -9 $PARENT
```

### 방법 3: SIG_IGN 설정 (코드 수정)

C 코드에서 `SIGCHLD`를 `SIG_IGN`으로 설정하면 커널이 자식을 **자동으로 즉시 소멸**시킵니다. POSIX가 보장하는 동작입니다.

```c
signal(SIGCHLD, SIG_IGN);
/* 이후 fork()된 자식은 즉시 회수됨 */
```

## Zombie 방지 패턴

![Zombie 방지 코드 패턴](/assets/posts/linux-zombie-orphan-code.svg)

### SIGCHLD 핸들러 (권장)

```c
#include <signal.h>
#include <sys/wait.h>

void sigchld_handler(int sig) {
    (void)sig;
    /* -1: 모든 자식, WNOHANG: 비블로킹 */
    while (waitpid(-1, NULL, WNOHANG) > 0);
}

int main(void) {
    struct sigaction sa = {.sa_handler = sigchld_handler,
                           .sa_flags = SA_RESTART | SA_NOCLDSTOP};
    sigaction(SIGCHLD, &sa, NULL);
    /* ... */
}
```

`SA_NOCLDSTOP` 플래그를 지정하면 자식이 멈출 때(SIGSTOP)는 핸들러가 호출되지 않고, 실제 종료 시에만 호출됩니다.

### Double Fork (데몬 프로세스)

데몬처럼 부모와 완전히 분리된 프로세스가 필요할 때 사용합니다. 중간 부모가 즉시 종료하면 손자가 init에게 입양되어 zombie가 될 수 없습니다.

```bash
# bash에서 double fork 흉내
(setsid bash -c 'sleep 100' &)
# 외부 쉘이 중간 부모로 즉시 종료
# sleep 100은 init 자식이 됨
```

## 실전 진단 예시

```bash
# 다음 명령으로 zombie 모니터링
watch -n 2 'ps aux | awk "NR==1 || \$8~/^Z/"'

# /proc으로 상세 정보
cat /proc/ZOMBIE_PID/status | grep -E 'State|PPid|Threads'
```

## 정리

zombie는 부모가 `wait()`를 호출하지 않아 발생하며, PID를 소모하지만 자원을 쓰지는 않습니다. orphan은 부모가 먼저 죽어 init에 입양된 자식으로, 문제가 없습니다. zombie를 근본적으로 막으려면 `SIGCHLD` 핸들러 안에서 `waitpid(-1, NULL, WNOHANG)`을 루프로 돌리거나, `SIGCHLD`를 `SIG_IGN`으로 설정하면 됩니다. 다음 글에서는 프로세스 자원 제한의 핵심 기술인 cgroups를 살펴봅니다.

---

**지난 글:** [fork / exec / wait 완전 이해](/posts/linux-fork-exec-wait/)

**다음 글:** [cgroups 완전 개요 — 자원 격리의 뼈대](/posts/linux-cgroups-overview/)

<br>
읽어주셔서 감사합니다. 😊
