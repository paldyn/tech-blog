---
title: "groupadd & usermod — 그룹 관리와 사용자 속성 변경"
description: "groupadd, groupmod, groupdel로 그룹을 생성·수정·삭제하고, usermod로 사용자의 셸·홈 디렉터리·그룹 멤버십을 변경하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 1
type: "knowledge"
category: "Linux"
tags: ["linux", "groupadd", "groupmod", "groupdel", "usermod", "group", "user-management", "gid", "linux-admin"]
featured: false
draft: false
---

[지난 글](/posts/linux-passwd-shadow/)에서 `/etc/passwd`와 `/etc/shadow`의 구조를 살펴봤습니다. 이번에는 **그룹 관리 명령어**와 기존 사용자의 속성을 바꾸는 `usermod`를 다룹니다. 그룹은 파일 권한과 서비스 접근 제어의 핵심 단위이며, 그룹 멤버십을 잘못 설정하면 예상치 못한 보안 허점이 생깁니다.

## 그룹이란

리눅스에서 모든 파일에는 소유자(UID)와 소유 그룹(GID)이 붙습니다. 그룹을 이용하면 여러 사용자에게 동일한 파일 권한을 한 번에 부여할 수 있습니다. `/etc/group` 파일에 그룹 정보가 저장되며, 형식은 다음과 같습니다.

```
# 그룹명:암호필드:GID:멤버목록
sudo:x:27:alice,bob
docker:x:999:alice
devteam:x:1500:
```

멤버 목록은 쉼표로 구분된 사용자 이름입니다. **기본 그룹(primary group)** 은 `/etc/passwd`에 기록되며, `/etc/group`의 멤버 목록에는 일반적으로 표시되지 않습니다.

## groupadd — 그룹 생성

```bash
# 기본 생성 (GID 자동 할당)
groupadd devteam

# GID 직접 지정
groupadd -g 1500 devteam

# 시스템 그룹 생성 (GID < 1000)
groupadd -r myservice

# 이미 존재하면 성공으로 처리 (스크립트에서 유용)
groupadd -f devteam
```

`-r` 옵션으로 만든 시스템 그룹은 데몬이나 서비스 계정에 주로 사용됩니다. 일반 사용자 그룹과 GID 범위를 분리해 관리하기 편합니다.

![그룹 관리 명령어](/assets/posts/linux-groupadd-usermod-commands.svg)

## groupmod — 그룹 수정

그룹 이름이나 GID를 변경합니다.

```bash
# 이름 변경
groupmod -n engineering devteam

# GID 변경
groupmod -g 1600 engineering
```

GID를 변경하면 그 GID를 소유 그룹으로 가진 **기존 파일의 GID는 자동으로 바뀌지 않습니다.** `find / -gid OLD_GID -exec chgrp NEW_GID {} \;` 로 직접 수정해야 합니다.

## groupdel — 그룹 삭제

```bash
groupdel devteam
```

해당 그룹을 **기본 그룹**으로 사용하는 사용자가 있으면 삭제가 거부됩니다. 먼저 `usermod -g OTHER_GROUP USER` 로 기본 그룹을 바꿔야 합니다. 보조 그룹 멤버십은 자동으로 정리됩니다.

## gpasswd — 그룹 멤버십 관리

`usermod -aG` 외에 `gpasswd` 명령으로도 멤버를 추가·제거할 수 있습니다.

```bash
# 그룹에 사용자 추가
gpasswd -a alice devteam

# 그룹에서 사용자 제거
gpasswd -d bob devteam

# 그룹 관리자 지정
gpasswd -A alice devteam
```

`gpasswd`는 변경 즉시 `/etc/group`에 반영됩니다. `usermod -aG`와 달리 다른 보조 그룹을 건드리지 않으므로 단일 그룹 작업에 더 안전합니다.

## usermod — 사용자 속성 변경

`useradd`로 계정을 만든 뒤, 속성을 변경할 때 `usermod`를 사용합니다.

![usermod 주요 플래그](/assets/posts/linux-groupadd-usermod-usermod.svg)

### 그룹 멤버십 변경

```bash
# 보조 그룹 추가 (-a 없이 -G만 쓰면 기존 그룹이 교체됨!)
usermod -aG docker,sudo alice

# 기본 그룹 변경
usermod -g engineering alice
```

`-aG`의 `-a`(append)를 빠뜨리는 실수가 자주 발생합니다. `-G GROUP` 단독 사용은 기존 보조 그룹 목록을 **덮어씁니다.** 변경 후에는 반드시 `id alice` 로 그룹 목록을 확인하세요.

### 셸과 홈 디렉터리 변경

```bash
# 로그인 셸 변경
usermod -s /bin/zsh alice

# 홈 디렉터리 변경 + 파일 이동
usermod -d /data/alice -m alice
```

`-m` 옵션을 붙여야 기존 홈 디렉터리의 파일이 새 위치로 **이동**됩니다. 빠뜨리면 경로만 변경되고 파일은 구 위치에 남습니다.

### 계정 잠금과 만료

```bash
# 계정 잠금 (shadow 파일 비밀번호 앞에 ! 추가)
usermod -L alice

# 잠금 해제
usermod -U alice

# 만료일 설정
usermod -e 2026-12-31 alice

# 만료 해제 (빈 문자열)
usermod -e "" alice
```

계정 잠금은 패스워드 인증만 차단합니다. SSH 키 인증은 막지 않으므로, 완전한 접근 차단을 원하면 셸을 `/sbin/nologin`으로 바꾸거나 `authselect`를 함께 사용하세요.

## 변경 사항 즉시 반영 확인

`usermod`로 그룹을 추가해도, **현재 로그인된 세션에는 즉시 반영되지 않습니다.** 새 그룹 멤버십을 활성화하려면:

```bash
# 새 셸을 열어 그룹 재적용
exec newgrp devteam   # 특정 그룹으로 전환
# 또는 로그아웃 후 재로그인
```

`newgrp` 명령은 지정한 그룹을 현재 세션의 유효 그룹으로 바꿉니다. 재로그인 없이 그룹 변경을 테스트할 때 유용합니다.

## 실전: 새 팀원 온보딩 스크립트

```bash
#!/bin/bash
NEW_USER="charlie"
useradd -m -s /bin/bash "$NEW_USER"
usermod -aG sudo,docker,devteam "$NEW_USER"
passwd "$NEW_USER"
echo "계정 생성 완료: $(id $NEW_USER)"
```

그룹이 존재하지 않으면 `usermod -aG` 가 실패합니다. 스크립트 앞부분에 `groupadd -f devteam` 처럼 `-f` 옵션으로 그룹을 미리 보장하는 습관이 좋습니다.

---

**지난 글:** [passwd & shadow — 비밀번호 관리의 핵심](/posts/linux-passwd-shadow/)

**다음 글:** [sudo & sudoers — 권한 위임과 보안 설정](/posts/linux-sudo-sudoers/)

<br>
읽어주셔서 감사합니다. 😊
