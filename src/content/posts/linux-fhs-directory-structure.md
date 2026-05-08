---
title: "Linux FHS: 디렉터리 구조 완전 정복"
description: "Filesystem Hierarchy Standard가 정의하는 Linux 디렉터리 구조를 한눈에 파악하고, 어디에 무엇이 있는지 이해한다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 8
type: "knowledge"
category: "Linux"
tags: ["Linux", "FHS", "디렉터리구조", "파일시스템", "etc", "var"]
featured: false
draft: false
---

[지난 글](/posts/linux-bash-vs-zsh-fish/)에서 셸의 종류를 살펴봤다. 이번 글에서는 셸을 열었을 때 눈앞에 펼쳐지는 **Linux 디렉터리 구조**를 체계적으로 정리한다. 처음 Linux를 접하면 `/etc`, `/var`, `/usr`이 무슨 차이인지 몰라 당황하기 쉽다. Filesystem Hierarchy Standard(FHS)를 이해하면 어디서 무엇을 찾아야 하는지 직관적으로 알게 된다.

## FHS란

**FHS(Filesystem Hierarchy Standard)**는 Linux 파운데이션이 관리하는 표준으로, Linux 시스템에서 각 디렉터리가 담아야 할 내용을 정의한다. 배포판마다 세부 차이는 있지만 큰 틀은 동일하다. 덕분에 Ubuntu에서 배운 `/etc/nginx/` 경로가 RHEL에서도 동일하게 통한다.

```bash
# 최상위 디렉터리 목록 확인
ls /
# bin  boot  dev  etc  home  lib  lib64  media
# mnt  opt  proc  root  run  sbin  srv  sys  tmp  usr  var
```

![FHS 디렉터리 트리](/assets/posts/linux-fhs-directory-structure-tree.svg)

## 주요 디렉터리 해설

### / (루트)

모든 경로의 시작점. Windows의 `C:\`에 해당하지만, 드라이브 문자가 없고 모든 것이 하나의 트리에 통합된다.

### /bin, /sbin — 필수 실행 파일

`/bin`은 일반 사용자가 사용하는 필수 명령어(`ls`, `cp`, `mv`, `cat`, `bash`)가 있다. `/sbin`은 시스템 관리자용 명령어(`fdisk`, `ifconfig`, `reboot`)가 있다. 현대 배포판에서 이 두 디렉터리는 `/usr/bin`과 `/usr/sbin`의 심볼릭 링크다.

```bash
ls -la /bin
# lrwxrwxrwx 1 root root 7 /bin -> usr/bin
```

### /etc — 설정 파일의 집

시스템 전역 설정 파일이 모두 여기에 있다. nginx 설정은 `/etc/nginx/`, ssh 설정은 `/etc/ssh/`, 사용자 목록은 `/etc/passwd`, 네트워크 설정은 `/etc/network/`에 있다.

```bash
# 자주 보게 될 /etc 파일들
cat /etc/hostname        # 호스트명
cat /etc/hosts           # IP-호스트명 매핑
cat /etc/fstab           # 마운트 설정
cat /etc/passwd          # 사용자 정보 (비밀번호 제외)
ls /etc/systemd/         # systemd 설정
ls /etc/apt/             # apt 패키지 소스 (Debian계열)
```

### /home — 사용자 홈 디렉터리

각 사용자의 개인 파일이 있다. 사용자 `alice`의 홈은 `/home/alice/`. 환경 변수 `$HOME`이 가리키는 곳이다. `~` 틸드 기호도 `$HOME`의 단축 표기다.

### /var — 변하는(variable) 데이터

실행 중에 지속적으로 변경되는 파일들이다.

| 경로 | 내용 |
|---|---|
| `/var/log/` | 시스템·서비스 로그 |
| `/var/lib/` | 애플리케이션 상태 데이터 |
| `/var/cache/` | 캐시 파일 |
| `/var/spool/` | 큐·스풀 데이터 |
| `/var/tmp/` | 재부팅 후에도 유지되는 임시 파일 |

```bash
# nginx 접근 로그
tail -f /var/log/nginx/access.log

# systemd 서비스 로그 (journalctl로도 볼 수 있음)
ls /var/log/journal/
```

### /usr — 사용자 프로그램

사용자가 사용하는 대부분의 프로그램과 라이브러리가 있다. `/usr/bin`에 일반 명령어, `/usr/lib`에 공유 라이브러리, `/usr/share`에 문서·아이콘·데이터 파일이 있다. 패키지 관리자가 설치하는 대부분의 파일이 여기에 들어온다.

`/usr/local`은 수동 설치(`make install`) 결과물을 위한 공간이다. 패키지 관리자와 충돌하지 않도록 별도로 분리되어 있다.

### /tmp — 임시 파일

재부팅 시 삭제되는 임시 파일 공간. 모든 사용자가 파일을 쓸 수 있는 세계 쓰기 가능(world-writable) 디렉터리다. 스크립트에서 임시 파일을 만들 때 자주 사용한다.

```bash
# 임시 파일 안전하게 생성
TMPFILE=$(mktemp /tmp/myapp.XXXXXX)
echo "data" > "$TMPFILE"
# 스크립트 종료 시 정리
trap "rm -f $TMPFILE" EXIT
```

### /proc, /sys — 가상 파일시스템

디스크에 없는 가상 파일시스템이다. `/proc`는 프로세스 정보와 커널 상태, `/sys`는 커널 파라미터와 디바이스 정보를 파일 형태로 노출한다. 이전 글에서 다룬 "모든 것은 파일" 철학의 구현체다.

### /dev — 장치 파일

블록 디바이스, 문자 디바이스, 가상 장치가 있다. `/dev/sda`(첫 번째 디스크), `/dev/null`(블랙홀), `/dev/urandom`(난수 생성기) 등이 있다.

![핵심 디렉터리 용도 정리](/assets/posts/linux-fhs-directory-structure-purpose.svg)

## 실무에서 자주 쓰는 탐색 패턴

```bash
# 어떤 패키지가 어떤 파일을 설치했는지
dpkg -L nginx            # Debian/Ubuntu
rpm -ql nginx            # RHEL/Fedora

# 특정 파일이 어느 패키지 소속인지
dpkg -S /usr/sbin/nginx
rpm -qf /usr/sbin/nginx

# 설정 파일 백업 후 수정
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak
sudo vim /etc/nginx/nginx.conf
```

이 구조를 외울 필요는 없다. `man hier`(FHS 계층 구조 매뉴얼)를 참고하거나, 모르면 `find / -name "파일명" 2>/dev/null`로 찾으면 된다. 쓰다 보면 자연스럽게 익혀진다.

---

**지난 글:** [Bash vs Zsh vs Fish: 어떤 셸을 써야 할까](/posts/linux-bash-vs-zsh-fish/)

**다음 글:** [pwd, cd, ls: 파일시스템 탐색의 기본기](/posts/linux-pwd-cd-ls/)

<br>
읽어주셔서 감사합니다. 😊
