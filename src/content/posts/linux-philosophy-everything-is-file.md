---
title: "Linux 철학: 모든 것은 파일이다"
description: "Unix/Linux에서 디스크, 장치, 소켓, 파이프가 모두 파일 인터페이스로 통합되는 원리와 실제 활용법을 살펴본다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 5
type: "knowledge"
category: "Linux"
tags: ["Linux", "파일디스크립터", "Unix철학", "VFS", "파일시스템"]
featured: false
draft: false
---

[지난 글](/posts/linux-kernel-vs-distro/)에서 커널과 배포판의 관계를 정리했다. 이번에는 Linux(그리고 Unix)의 가장 독특한 설계 철학을 다룬다. **"모든 것은 파일이다(Everything is a file)"** — 이 한 문장이 Linux 명령어와 API 설계 전반에 걸쳐 있다. 이를 이해하면 `cat /proc/cpuinfo` 같은 이상해 보이는 명령어가 왜 동작하는지 직관적으로 이해하게 된다.

## 왜 파일인가

1970년대 Unix 설계자들은 매우 실용적인 문제에 부딪혔다. 프로그램이 파일을 읽고 쓰는 API는 있다. 그런데 시리얼 포트에서 데이터를 읽으려면 어떻게 해야 할까? 네트워크 연결에서 데이터를 받으려면? 프로세스 간에 데이터를 전달하려면?

각 자원마다 별도의 API를 만들 수도 있었다. 하지만 Unix 설계자들은 다른 길을 택했다. **모든 자원을 "파일"처럼 다룰 수 있게** 하는 것이다. 하나의 API — `open()`, `read()`, `write()`, `close()` — 로 파일, 장치, 소켓, 파이프를 모두 다룰 수 있다.

![모든 것은 파일이다 — 통합 인터페이스](/assets/posts/linux-philosophy-everything-is-file-concept.svg)

## 파일 디스크립터: 모든 것의 핵심

`open()` 시스템 콜을 호출하면 커널은 **파일 디스크립터(file descriptor, fd)**라는 정수를 돌려준다. 이 정수가 자원을 가리키는 핸들이다.

```c
// 일반 파일 열기
int fd = open("/etc/hostname", O_RDONLY);
read(fd, buffer, sizeof(buffer));
close(fd);

// 소켓도 동일한 read/write
int sock = socket(AF_INET, SOCK_STREAM, 0);
connect(sock, &addr, sizeof(addr));
write(sock, "GET / HTTP/1.0\r\n\r\n", 18);
read(sock, response, sizeof(response));
close(sock);
```

모든 프로세스는 시작할 때 세 개의 fd를 이미 갖고 있다.

| fd 번호 | 이름 | 기본 연결 |
|---|---|---|
| 0 | stdin | 키보드 입력 |
| 1 | stdout | 터미널 출력 |
| 2 | stderr | 터미널 에러 출력 |

이 fd들도 파일이기 때문에 리다이렉션(`>`, `<`)으로 연결 대상을 바꿀 수 있다.

```bash
# stdout(fd 1)을 파일로 리다이렉트
ls -la > output.txt

# stderr(fd 2)를 stdout으로 합치기
./script.sh 2>&1 | tee log.txt

# stdin을 파일에서 읽기
sort < unsorted.txt
```

## /dev — 장치도 파일

```bash
# 블록 디바이스(하드디스크) 정보를 파일처럼 읽기
file /dev/sda          # block special

# 터미널 디바이스 확인
ls -la /dev/tty        # crw-rw-rw- : 문자 디바이스

# /dev/null : 모든 걸 삼키는 블랙홀 파일
echo "버릴 출력" > /dev/null

# /dev/zero : 무한히 0을 생성하는 파일
dd if=/dev/zero of=empty.bin bs=1M count=100
```

`/dev/null`과 `/dev/zero`는 실제 내용이 없지만, 파일 인터페이스를 구현한 커널 가상 장치다. 프로그램 입장에서는 진짜 파일과 구분할 수 없다.

## /proc — 커널 상태도 파일

`/proc` 디렉터리는 **procfs**라는 가상 파일시스템이다. 디스크에 실제로 저장된 파일이 아니라, 커널이 읽기 요청을 받을 때마다 실시간으로 생성하는 가상 파일이다.

```bash
# CPU 정보
cat /proc/cpuinfo

# 메모리 정보
cat /proc/meminfo

# 실행 중인 프로세스 1234의 상태
cat /proc/1234/status

# 프로세스가 열어둔 파일 목록
ls -la /proc/1234/fd/

# 현재 프로세스의 커맨드라인
cat /proc/self/cmdline | tr '\0' ' '
```

이처럼 `cat` 하나로 CPU 정보, 메모리 현황, 프로세스 상태를 모두 읽을 수 있는 것은 "모든 것은 파일"이라는 철학 덕분이다.

## 파이프 — 프로세스 간 통신도 파일

파이프(`|`)는 두 프로세스를 연결하는 임시 채널이다. 한 프로세스의 stdout이 다른 프로세스의 stdin으로 연결된다. 내부적으로 파이프도 파일 디스크립터로 구현된다.

```bash
# 파이프로 명령어 조합
ps aux | grep nginx | awk '{print $2}'

# named pipe(FIFO) 생성 — 파일처럼 존재
mkfifo /tmp/mypipe
ls -la /tmp/mypipe
# prw-r--r-- 1 user user 0 /tmp/mypipe
#  ^-- 'p' 타입: named pipe

# 한 터미널에서 쓰기
echo "hello pipe" > /tmp/mypipe

# 다른 터미널에서 읽기
cat /tmp/mypipe
```

## 파일 타입 구분하기

![ls -la로 보는 파일 타입 구분자](/assets/posts/linux-philosophy-everything-is-file-types.svg)

`ls -la` 출력의 첫 글자가 파일 종류를 나타낸다. `-`는 일반 파일, `d`는 디렉터리, `l`은 심볼릭 링크, `b`는 블록 디바이스, `c`는 문자 디바이스, `p`는 파이프, `s`는 소켓이다. `file` 명령어로도 타입을 확인할 수 있다.

## 이 철학이 주는 힘

"모든 것은 파일"이라는 철학은 강력한 조합 가능성을 만든다. `cat`은 파일 내용을 출력하는 명령이지만, `/dev/urandom`(난수 생성기)과 결합하면 난수 스트림이 된다. `echo`는 문자열을 출력하지만, `/sys/` 가상 파일에 쓰면 커널 설정을 바꿀 수 있다.

```bash
# 커널 파라미터를 파일처럼 수정
echo 1 > /proc/sys/net/ipv4/ip_forward

# 랜덤 16진수 32자리 생성
cat /dev/urandom | tr -dc 'a-f0-9' | head -c 32
```

이 철학은 앞으로 다룰 리다이렉션, 파이프, 셸 스크립팅, 프로세스 관리 모두의 기반이 된다.

---

**지난 글:** [Linux 커널과 배포판의 차이: 무엇이 커널이고 무엇이 배포판인가](/posts/linux-kernel-vs-distro/)

**다음 글:** [셸과 터미널의 차이: 무엇이 명령어를 실행하는가](/posts/linux-shell-vs-terminal/)

<br>
읽어주셔서 감사합니다. 😊
