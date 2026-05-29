---
title: "systemd 서비스 실행 실패 진단"
description: "systemctl로 등록한 서비스가 failed 상태로 죽을 때 status와 journalctl로 원인을 좁히고, 유닛 문법·권한·경로·의존성 문제를 분류해 고치는 진단 절차를 단계별로 설명합니다. daemon-reload 함정도 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 2
type: "knowledge"
category: "Linux"
tags: ["linux", "systemd", "systemctl", "journalctl", "troubleshooting", "service"]
featured: false
draft: false
---

[지난 글](/posts/linux-package-broken-recover/)에서 깨진 패키지 상태를 복구했다. 시리즈의 마지막인 이번 글에서는, 설치까지는 끝냈는데 서비스가 정작 떠 있지 않는 상황을 다룬다. `systemctl start myapp`을 실행했더니 잠시 뒤 `Active: failed`로 죽어 있거나, 부팅 후 분명히 enable 해 둔 서비스가 올라오지 않는 경우다. 이럴 때 로그를 어디서 어떻게 읽어 원인을 좁혀 가는지, 그 진단 흐름을 정리한다.

## 진단의 출발점은 status

서비스가 실패하면 가장 먼저 봐야 할 것은 추측이 아니라 `systemctl status`다. 이 명령은 현재 상태, 마지막 종료 코드, 그리고 최근 로그 몇 줄을 한 화면에 보여준다.

```bash
systemctl status myapp.service
```

출력에서 주목할 곳은 `Active:` 줄과 `Main PID:` 줄이다. 예를 들어 다음과 같다면,

```text
Active: failed (Result: exit-code) since ...
Main PID: 1234 (code=exited, status=1/FAILURE)
```

`status=1`은 프로그램이 0이 아닌 코드로 스스로 종료했다는 뜻이다. 즉 systemd 자체의 문제가 아니라 실행된 프로그램이 시작 직후 에러를 내고 죽은 것이다. 반면 `status=203/EXEC`는 systemd가 실행파일을 아예 실행하지 못했다는 뜻으로, 경로 오타나 실행 권한 누락을 의심해야 한다.

![서비스 실패 진단 흐름](/assets/posts/linux-systemd-service-fail-flow.svg)

## journalctl로 진짜 에러 찾기

status가 보여주는 로그는 몇 줄뿐이라 잘릴 때가 많다. 실제 에러 메시지를 보려면 해당 유닛의 로그만 골라 보는 `journalctl -u`를 쓴다.

```bash
# 이 유닛의 로그를 끝부분부터 보기
journalctl -u myapp -e --no-pager

# 가장 최근 부팅 이후 로그만
journalctl -u myapp -b

# 실시간으로 따라가며 재시작 관찰
journalctl -u myapp -f
```

`-e`는 가장 최근 로그로 바로 이동하고, `--no-pager`는 스크립트나 좁은 터미널에서 페이저 없이 한 번에 출력한다. 여기서 프로그램이 남긴 실제 에러(설정 파일을 못 찾음, 포트가 이미 사용 중, 데이터베이스 연결 실패 등)를 확인하는 것이 진단의 핵심이다.

![상태와 원인 한눈에](/assets/posts/linux-systemd-service-fail-commands.svg)

## 원인 분류하기

로그에서 본 에러를 토대로 원인을 몇 가지 범주로 나누면 고칠 곳이 분명해진다.

**유닛 파일 문법 오류** — `ExecStart`에 인자를 잘못 넣었거나 지시어 철자가 틀린 경우다. `systemd-analyze verify`로 문법을 검사할 수 있다.

```bash
systemd-analyze verify /etc/systemd/system/myapp.service
```

**실행파일 경로·권한** — `status=203/EXEC`가 보이면 `ExecStart`의 경로가 존재하는지, 실행 비트가 있는지 확인한다. systemd는 `$PATH`를 거의 쓰지 않으므로 절대 경로를 써야 한다.

```bash
ls -l /usr/local/bin/myapp     # 파일 존재·실행권한 확인
which myapp                     # 절대 경로 확인
```

**권한·사용자 문제** — `User=`로 지정한 계정이 로그 파일이나 데이터 디렉터리에 쓸 수 없으면 "Permission denied"로 죽는다. 해당 디렉터리의 소유자와 권한을 점검한다.

**의존성·기동 순서** — 데이터베이스가 뜨기 전에 앱이 먼저 시작돼 연결에 실패한다면 `After=`와 `Requires=`(또는 `Wants=`)를 점검한다. 다만 `After=`는 "기동 순서"만 보장할 뿐 "준비 완료"를 보장하지 않으므로, 앱 쪽에 재시도 로직을 두거나 헬스체크를 활용하는 편이 안전하다.

## daemon-reload 함정

유닛 파일을 고친 뒤 곧장 `systemctl restart`만 하면 systemd는 여전히 메모리에 캐시된 옛 정의를 사용한다. 그래서 "분명히 고쳤는데 왜 그대로지?"라는 혼란이 생긴다. 유닛 파일을 수정했다면 반드시 `daemon-reload`를 먼저 실행해야 한다.

```bash
# 유닛 파일을 고친 뒤 반드시
sudo systemctl daemon-reload
sudo systemctl restart myapp
systemctl status myapp
```

systemd가 리로드가 필요한 상태임을 알리기도 한다. status 출력에 "Warning: The unit file ... changed on disk. Run 'systemctl daemon-reload'"가 보이면 이 단계를 빼먹은 것이다.

## 재시작 폭주에 막혔을 때

`Restart=on-failure`를 설정해 둔 서비스가 시작-실패-재시작을 짧은 시간에 반복하면, systemd는 "start request repeated too quickly"라며 더 이상 시도하지 않고 멈춘다. 이때는 실패 카운터를 리셋한 뒤 원인을 고치고 다시 시작한다.

```bash
# 실패 카운터 리셋
sudo systemctl reset-failed myapp

# 부팅 시 자동 시작 여부도 함께 점검
systemctl is-enabled myapp
```

서비스 진단의 요령은 한 가지로 요약된다. 추측해서 유닛 파일을 이리저리 바꾸지 말고, `status`로 종료 코드를 읽고 `journalctl -u`로 프로그램이 남긴 진짜 에러를 확인한 다음, 그 메시지가 가리키는 범주(문법·경로·권한·의존성)만 고치는 것이다. 그리고 유닛을 고쳤다면 `daemon-reload`를 잊지 않는 것 — 이 한 흐름만 몸에 익히면 대부분의 서비스 실패는 몇 분 안에 풀린다.

이것으로 Linux를 다루며 마주치는 핵심 주제들을 처음부터 끝까지 살펴본 이 시리즈를 마무리한다. 파일과 권한, 프로세스와 서비스, 네트워크와 패키지, 그리고 문제가 터졌을 때의 복구까지 — 각 글이 실무에서 막히는 순간에 펼쳐 볼 수 있는 안내서가 되었기를 바란다.

---

**지난 글:** [깨진 패키지 상태 복구](/posts/linux-package-broken-recover/)

<br>
읽어주셔서 감사합니다. 😊
