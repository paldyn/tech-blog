---
title: "SCP vs SFTP — SSH 기반 파일 전송 완전 비교"
description: "SCP와 SFTP의 프로토콜 구조 차이, 전송 재개·디렉터리 관리·배치 모드 활용법을 실무 예제와 함께 비교합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 1
type: "knowledge"
category: "Linux"
tags: ["linux", "scp", "sftp", "ssh", "file-transfer", "remote-copy", "sftp-server"]
featured: false
draft: false
---

[지난 글](/posts/linux-ssh-agent/)에서 ssh-agent로 패스프레이즈 없이 SSH 인증을 자동화하는 방법을 살펴봤습니다. SSH 인증이 편리해졌으니 이제 SSH 위에서 파일을 주고받는 두 가지 방법 **SCP**와 **SFTP**를 비교해봅니다. 둘 다 SSH 암호화 채널을 이용하지만 내부 구조와 제공하는 기능이 크게 다릅니다. 어떤 상황에서 무엇을 써야 하는지 정확히 알아두면 운영 효율이 높아집니다.

## SCP — 단순하고 빠른 복사

`scp`는 과거 `rcp(1)` 명령을 SSH로 감싼 구조입니다. 명령 한 줄로 로컬↔원격, 원격↔원격 파일 복사를 처리하며 세션을 따로 유지하지 않습니다.

```bash
# 로컬 → 원격
scp file.txt user@host:/remote/path/

# 원격 → 로컬
scp user@host:/remote/file.txt ./local/

# 원격 → 원격 (중간 경유)
scp user@host1:/file user@host2:/dest/

# 디렉터리 재귀 복사
scp -r ./mydir user@host:/opt/
```

SCP의 강점은 **단순성**입니다. 스크립트에서 파일 한 개를 밀어 넣을 때 한 줄이면 끝납니다. 약점은 중단된 전송을 이어받지 못한다는 점입니다. 네트워크가 끊기면 처음부터 다시 전송해야 합니다.

![SCP vs SFTP 비교](/assets/posts/linux-scp-vs-sftp-comparison.svg)

## SFTP — 대화형 파일 관리 세션

`sftp`는 SSH의 **sftp 서브시스템**을 통해 독립적인 파일 전송 세션을 엽니다. 단순 복사를 넘어 디렉터리 탐색, 파일 이름 변경, 삭제, 그리고 중단된 전송 재개까지 지원합니다.

```bash
# 대화형 세션 접속
sftp user@host

# 세션 내 주요 명령
sftp> ls -la            # 원격 디렉터리 목록
sftp> cd /var/log       # 원격 디렉터리 이동
sftp> lcd ~/Downloads   # 로컬 디렉터리 이동
sftp> get syslog        # 다운로드
sftp> put deploy.sh     # 업로드
sftp> reget large.tar.gz  # 이어받기
sftp> mkdir backups     # 원격 디렉터리 생성
sftp> rename old.log old.bak
sftp> bye               # 세션 종료
```

### 배치 모드

스크립트에서 SFTP를 사용하려면 `-b` 옵션으로 명령 파일을 전달합니다.

```bash
# commands.txt 내용
put /local/app.tar.gz /remote/deploy/
mkdir /remote/deploy/backup
bye

# 실행
sftp -b commands.txt user@host
```

![SFTP 세션 흐름](/assets/posts/linux-scp-vs-sftp-session.svg)

## 핵심 차이 정리

| 항목 | SCP | SFTP |
|------|-----|------|
| 전송 방향 | 단방향 복사 | 양방향 세션 |
| 디렉터리 조작 | 불가 | ls, mkdir, rename, rm |
| 전송 재개 | 불가 | reget / reput |
| 속도 | 빠름 (오버헤드 최소) | 약간 느림 (세션 유지 비용) |
| 스크립트 적합성 | 매우 높음 | 배치 모드로 가능 |
| 서버 설정 | sshd만 필요 | Subsystem sftp 설정 필요 |

## 서버 측 SFTP 설정

`/etc/ssh/sshd_config`에 다음이 있어야 SFTP가 작동합니다.

```bash
# sshd_config 기본 설정 (대부분 배포판에 기본 포함)
Subsystem sftp /usr/lib/openssh/sftp-server

# SFTP 전용 chroot 계정 설정 예
Match User ftpuser
    ForceCommand internal-sftp
    ChrootDirectory /srv/ftp/%u
    AllowTcpForwarding no
    X11Forwarding no
```

`ChrootDirectory`를 설정하면 해당 계정은 지정 디렉터리 밖으로 나갈 수 없습니다. 파일 업로드 전용 계정을 만들 때 유용합니다.

## 언제 무엇을 쓸까

**SCP를 선택할 때**: CI/CD 파이프라인에서 빌드 결과물 한 개를 서버로 밀어 넣을 때, 스크립트 한 줄로 처리하고 싶을 때.

**SFTP를 선택할 때**: 대용량 파일 전송 도중 네트워크가 불안정할 때(`reget` 활용), 원격 파일 목록 확인이나 디렉터리 구조 정리가 필요할 때, 보안상 셸 접근 없이 파일 전송만 허용하는 계정을 운영할 때.

실무에서는 **빠른 단건 복사는 SCP, 관리 작업이 섞인 복잡한 파일 전송은 SFTP**라고 기억하면 됩니다. 이어지는 글에서는 SCP와 rsync를 직접 비교하기 전에 먼저 SSH 터널을 살펴봅니다.

---

**다음 글:** [SSH 터널 — 로컬·리모트·다이나믹 포워딩](/posts/linux-ssh-tunnel/)

<br>
읽어주셔서 감사합니다. 😊
