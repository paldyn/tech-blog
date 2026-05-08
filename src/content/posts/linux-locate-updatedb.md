---
title: "locate & updatedb: 초고속 파일 위치 검색"
description: "locate 명령어와 updatedb 데이터베이스를 이해하고, find와의 차이점 및 올바른 사용 시나리오를 파악한다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 10
type: "knowledge"
category: "Linux"
tags: ["Linux", "locate", "updatedb", "파일검색", "mlocate"]
featured: false
draft: false
---

[지난 글](/posts/linux-find-exec-xargs/)에서 `find -exec`와 `xargs`로 찾은 파일에 명령을 실행하는 방법을 익혔다. 이번 글에서는 `find`와는 다른 방식으로 동작하는 **`locate` 명령어와 그 데이터베이스를 구축하는 `updatedb`**를 다룬다. 파일 이름 하나로 시스템 전체에서 밀리초 안에 결과를 얻고 싶을 때 바로 `locate`다.

## locate의 동작 원리

`find`는 명령 실행 시 파일시스템을 직접 탐색하기 때문에 수십만 개의 파일이 있는 시스템에서는 수초 이상 걸릴 수 있다. 반면 `locate`는 **사전에 구축된 파일 경로 데이터베이스(`mlocate.db`)**를 조회하므로 거의 즉시 결과를 반환한다.

데이터베이스는 `/var/lib/mlocate/mlocate.db`(또는 `/var/cache/locate/locatedb`)에 저장되며, `updatedb`가 이를 갱신한다. 대부분의 배포판은 `cron`이나 `systemd timer`를 통해 매일 새벽 자동으로 `updatedb`를 실행한다.

## locate 기본 사용법

```bash
locate nginx.conf            # 경로에 'nginx.conf' 포함된 모든 항목
locate -i readme             # 대소문자 무시
locate -n 5 '*.conf'         # 결과 5개만 출력
locate -c '*.log'            # 결과 개수만 출력
locate -e '*.conf'           # 현재 실제로 존재하는 파일만
locate --regex 'log.*\.gz'   # 정규 표현식으로 검색
```

`locate 패턴`은 경로 전체에서 부분 문자열을 찾는다. `locate nginx`라고 입력하면 `/etc/nginx/`, `/usr/sbin/nginx` 등 경로 어디에든 'nginx'가 포함된 항목을 모두 반환한다.

![locate & updatedb 동작 흐름](/assets/posts/linux-locate-updatedb-flow.svg)

## updatedb — 데이터베이스 수동 갱신

새로 생성한 파일을 `locate`로 찾으려면 먼저 `updatedb`를 실행해 DB를 갱신해야 한다.

```bash
sudo updatedb                # DB 갱신 (루트 권한 필요)
locate newfile.txt           # 갱신 후 검색
```

`updatedb`는 전체 파일시스템을 순회하므로 수십 초가 걸릴 수 있다. 옵션을 통해 제외할 경로와 파일시스템 유형을 설정할 수 있다.

## updatedb 설정 파일

`updatedb`의 동작은 `/etc/updatedb.conf`에서 제어한다.

```bash
cat /etc/updatedb.conf
# PRUNEFS="nfs nfs4 proc sysfs ..."   # 제외할 파일시스템 유형
# PRUNENAMES=".git .hg .svn"          # 제외할 디렉터리 이름
# PRUNEPATHS="/tmp /var/spool /media"  # 제외할 경로
```

`PRUNENAMES`에 `.git`이 포함돼 있으면 `locate`로 프로젝트의 `.git` 내부 파일은 찾을 수 없다. 보안상 민감한 경로(`/root`, `/home`)를 DB에서 제외하려면 `PRUNEPATHS`에 추가한다.

## locate의 한계

`locate`를 사용할 때 반드시 기억해야 할 제약이 있다.

1. **DB 갱신 전 파일은 검색 불가**: 방금 생성한 파일은 다음 `updatedb` 실행 전까지 찾을 수 없다.
2. **삭제된 파일 표시 가능**: DB 갱신 후 삭제된 파일이 결과에 나타날 수 있다. `-e` 옵션으로 실제 존재하는 파일만 필터링할 수 있다.
3. **크기·날짜·권한 조건 없음**: `locate`는 파일 이름 검색에 특화되어 있고 메타데이터 조건은 지원하지 않는다.

![locate vs find 비교](/assets/posts/linux-locate-updatedb-comparison.svg)

## locate와 find 함께 사용하기

두 명령어를 조합하면 각각의 강점을 살릴 수 있다.

```bash
# locate 로 후보 경로를 빠르게 찾고, find 로 세부 조건 적용
locate '*.conf' | grep nginx | xargs ls -lh

# locate 결과를 stat 로 자세히 확인
locate -e nginx.conf | xargs stat

# locate 가 없는 환경에서 find 대안
find / -name 'nginx.conf' 2>/dev/null
```

## mlocate, plocate, slocate

배포판에 따라 `locate`의 구현체가 다를 수 있다.

- **mlocate**: 가장 널리 쓰이는 구현. `locate` 명령이 기본적으로 이것을 사용
- **plocate**: mlocate의 빠른 대안. 인덱스를 개선해 더 빠른 검색 제공. Ubuntu 21.04 이후 기본
- **slocate**: 보안 강화 버전. 사용자 권한에 따라 결과를 필터링

```bash
# 설치 확인
which locate
dpkg -l | grep locate      # Debian/Ubuntu
rpm -qa | grep mlocate     # RHEL/CentOS

# plocate 설치 (더 빠름)
sudo apt install plocate
```

plocate는 DB 형식이 달라 mlocate와 호환되지 않지만 검색 속도가 훨씬 빠르다. 현재 많은 배포판에서 기본 도구로 채택하고 있다.

## 실전 활용 패턴

```bash
# 설정 파일 빠르게 찾기
locate httpd.conf

# 특정 확장자 파일 전체 개수 파악
locate -c '*.py'

# 패키지 설치 경로 확인
locate libssl | head -10

# DB 마지막 갱신 시각 확인
stat /var/lib/mlocate/mlocate.db
```

---

**지난 글:** [find -exec & xargs: 찾은 파일에 명령 실행하기](/posts/linux-find-exec-xargs/)

<br>
읽어주셔서 감사합니다. 😊
