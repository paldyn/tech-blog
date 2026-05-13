---
title: "fork / exec / wait 완전 이해 — 프로세스 생성의 원리"
description: "리눅스 프로세스 생성의 핵심인 fork(), exec(), wait() 시스템 콜의 동작 원리, Copy-on-Write, exec 계열 함수, zombie 방지 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 1
type: "knowledge"
category: "Linux"
tags: ["linux", "fork", "exec", "wait", "process", "system-call", "copy-on-write", "zombie"]
featured: false
draft: false
---

[지난 글](/posts/linux-process-states/)에서 프로세스 상태(R, S, D, Z 등)가 무엇인지 살펴봤습니다. 이번엔 한 단계 더 깊이 들어가, 리눅스에서 새 프로세스가 태어나는 과정 — `fork()`, `exec()`, `wait()` — 을 원리부터 코드까지 완전히 이해합니다. 쉘이 명령어를 실행하거나, 웹 서버가 워커를 생성하거나, 컨테이너 런타임이 프로세스를 띄울 때도 결국 이 세 가지 시스템 콜이 뼈대를 이룹니다.

## fork() — 프로세스 복제

`fork()`는 현재 프로세스를 **그대로 복제**해 자식 프로세스를 만듭니다. 복제 후 부모와 자식은 거의 동일한 주소 공간을 가지지만, 반환값이 달라 서로를 구분합니다.

```c
pid_t pid = fork();
if (pid == -1) {
    perror("fork");        /* 실패 */
} else if (pid == 0) {
    /* 자식: fork()가 0 반환 */
    printf("자식 PID: %d\n", getpid());
} else {
    /* 부모: fork()가 자식 PID 반환 */
    printf("부모 PID: %d, 자식: %d\n", getpid(), pid);
}
```

### Copy-on-Write (CoW)

`fork()` 직후 메모리를 즉시 복사하면 비용이 큽니다. 리눅스 커널은 **Copy-on-Write** 기법으로 이를 최적화합니다. 부모와 자식이 같은 물리 페이지를 공유하다가, 어느 한 쪽이 **쓰기**를 시도하는 순간 해당 페이지만 복사합니다. `exec()`를 바로 호출할 경우 실제 메모리 복사가 거의 발생하지 않아 매우 효율적입니다.

![fork/exec/wait 흐름](/assets/posts/linux-fork-exec-wait-flow.svg)

## exec() — 프로그램 이미지 교체

`exec()` 계열 함수는 **현재 프로세스의 이미지를 새 프로그램으로 교체**합니다. PID는 그대로 유지되지만, 코드·데이터·스택 모두 새 프로그램의 것으로 덮어씁니다.

```bash
# 쉘에서 명령을 실행할 때 내부적으로 일어나는 일
# 1. 쉘이 fork() → 자식 프로세스 생성
# 2. 자식이 exec("ls") → ls 프로그램으로 교체
# 3. 부모(쉘)는 wait() → 자식 종료 대기

strace -e fork,execve,wait4 /bin/ls 2>&1 | head -20
```

exec 계열에는 여러 변형이 있습니다.

| 함수 | 특징 |
|------|------|
| `execve(path, argv, envp)` | 가장 기본 시스템 콜, 경로 명시 |
| `execv(path, argv)` | 환경변수는 현재 것 상속 |
| `execlp(file, arg0, ...)` | PATH에서 파일 검색, 가변 인수 |
| `execvp(file, argv)` | PATH 검색 + 배열 인수 |
| `posix_spawn(...)` | fork+exec를 원자적으로 수행 |

## wait() — 자식 종료 수집

부모가 `wait()` 또는 `waitpid()`를 호출하지 않으면 자식은 종료 후에도 프로세스 테이블에 zombie 상태로 남습니다. 커널이 exit code를 보관하다가 부모가 수집할 때 비로소 제거되기 때문입니다.

```c
#include <sys/wait.h>

pid_t pid = fork();
if (pid == 0) {
    execlp("ls", "ls", "-l", NULL);
    _exit(127);   /* exec 실패 시 */
} else {
    int status;
    waitpid(pid, &status, 0);

    if (WIFEXITED(status))
        printf("종료 코드: %d\n", WEXITSTATUS(status));
    else if (WIFSIGNALED(status))
        printf("시그널 종료: %d\n", WTERMSIG(status));
}
```

### WNOHANG — 비블로킹 대기

```c
/* 자식이 아직 실행 중이어도 즉시 반환 */
pid_t result = waitpid(pid, &status, WNOHANG);
if (result == 0)
    printf("아직 실행 중\n");
```

## 실전: 쉘은 어떻게 명령어를 실행하는가

```bash
# bash 소스 기준 간략 의사 코드
pid = fork()
if pid == 0:
    설정(리다이렉션, 환경변수)
    execvp(명령어, 인수들)
    exit(127)   # not found
else:
    if 포그라운드:
        waitpid(pid, ...)
    else:
        백그라운드 작업 테이블에 등록
```

## 주요 확인 명령

```bash
# 부모-자식 관계 확인
ps -o pid,ppid,comm ax | grep -E "^(PID|자식명)"

# 특정 프로세스의 fork/exec 추적
strace -f -e trace=process bash -c "ls"

# zombie 프로세스 찾기
ps aux | awk '$8=="Z"'
```

![fork/exec 코드 패턴](/assets/posts/linux-fork-exec-wait-code.svg)

## 정리

`fork()` → `exec()` → `wait()` 트리플렛은 리눅스 프로세스 모델의 핵심입니다. `fork()`가 복제하고, `exec()`가 교체하고, `wait()`가 회수합니다. Copy-on-Write 덕분에 `fork()`는 비용이 낮고, `exec()` 직전까지 공유된 메모리를 실제로 복사하지 않습니다. 부모가 `wait()`를 제때 호출하지 않으면 zombie가 쌓이고, 부모가 먼저 죽으면 자식은 고아(orphan)가 됩니다 — 다음 글에서 이를 자세히 다룹니다.

---

**다음 글:** [zombie와 orphan 프로세스 완전 정복](/posts/linux-zombie-orphan/)

<br>
읽어주셔서 감사합니다. 😊
