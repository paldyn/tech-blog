---
title: "cat·tac·head·tail: 파일 내용 보기 4총사"
description: "cat, tac, head, tail 명령어로 파일 내용을 다양하게 출력하고, tail -f로 로그를 실시간 모니터링하는 방법을 배운다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 3
type: "knowledge"
category: "Linux"
tags: ["Linux", "cat", "tac", "head", "tail", "로그모니터링"]
featured: false
draft: false
---

[지난 글](/posts/linux-paths-absolute-relative/)에서 절대 경로와 상대 경로를 이해했다. 이번 글에서는 **파일 내용을 읽는 가장 기본적인 명령어 4가지**인 `cat`, `tac`, `head`, `tail`을 정리한다. 이 네 명령어는 파이프라인에서도 빈번히 조합되므로 각각의 특징과 주요 옵션을 정확히 알아두면 생산성이 크게 높아진다.

## cat — 파일 전체 출력

`cat`은 파일 내용을 표준출력으로 내보내는 명령이다. 이름은 con**cat**enate(연결)에서 왔다. 가장 단순한 용도는 파일 읽기지만, 여러 파일을 하나로 합치거나 리다이렉션과 결합해 파일을 생성하는 데도 사용한다.

```bash
cat file.txt                   # 파일 내용 출력
cat -n file.txt                # 줄 번호 표시
cat -A file.txt                # 탭(^I), 줄 끝($) 등 비가시 문자 표시
cat -s file.txt                # 연속된 빈 줄을 하나로 압축
cat file1.txt file2.txt        # 두 파일 이어서 출력
cat file1.txt file2.txt > merged.txt  # 합쳐서 파일로 저장
cat > newfile.txt              # stdin 으로 파일 생성 (Ctrl+D 종료)
```

큰 파일을 `cat`으로 보면 터미널이 스크롤로 가득 차서 불편하다. 그럴 때는 `less`가 더 적합하다.

## tac — 줄 순서 뒤집기

`tac`은 `cat`을 거꾸로 쓴 이름처럼, 파일을 **마지막 줄부터 첫 줄 순서로** 출력한다. 타임스탬프가 오름차순인 로그 파일에서 최신 항목을 먼저 보고 싶을 때 유용하다.

```bash
tac access.log                 # 로그를 최신 순으로 출력
tac -s ':' /etc/passwd         # : 를 구분자로 뒤집기
tac numbers.txt | head -5      # 마지막 5줄을 먼저 출력
```

## head — 파일 앞부분 출력

`head`는 파일의 **처음 N줄**을 출력한다. 기본값은 10줄이다.

```bash
head file.txt                  # 앞 10줄
head -n 20 file.txt            # 앞 20줄
head -n -5 file.txt            # 끝 5줄을 제외한 나머지 전부
head -c 100 file.txt           # 앞 100 바이트
head -n 1 *.log                # 여러 파일 각각의 첫 줄
```

`-n -5`처럼 음수를 주면 "뒤에서 N줄을 빼고 출력"이 된다. 이를 활용해 마지막 헤더 줄을 제거할 수 있다.

## tail — 파일 끝부분 출력

`tail`은 파일의 **마지막 N줄**을 출력한다. 기본값은 10줄이다. 로그 파일의 최신 기록을 볼 때 가장 많이 사용한다.

```bash
tail file.txt                  # 끝 10줄
tail -n 50 file.txt            # 끝 50줄
tail -n +5 file.txt            # 5번째 줄부터 끝까지
tail -c 200 file.txt           # 끝 200 바이트
tail -f /var/log/syslog        # 실시간 추적 (Ctrl+C 종료)
tail -F /var/log/nginx/access.log  # 로그 로테이션에도 계속 추적
```

`-n +N` 형태는 "N번째 줄부터 끝까지"를 의미한다. CSV 파일의 헤더 줄을 건너뛰고 데이터만 처리할 때 자주 쓴다.

![cat·tac·head·tail 비교 다이어그램](/assets/posts/linux-cat-tac-head-tail-overview.svg)

## tail -f: 로그 실시간 모니터링

`tail -f`(follow)는 파일에 새 내용이 추가될 때마다 즉시 출력한다. 웹 서버 로그나 앱 로그를 라이브로 볼 때 가장 자주 사용하는 명령 중 하나다.

```bash
tail -f /var/log/syslog
tail -f /var/log/nginx/access.log
tail -f /var/log/auth.log | grep sshd   # SSH 인증 로그만 필터
```

`-f`와 `-F`의 차이: `-f`는 파일 디스크립터를 따라가므로 로그 로테이션으로 파일이 교체되면 추적이 끊긴다. `-F`는 파일 이름을 주기적으로 재확인해 로테이션 후에도 계속 추적한다. 장시간 운영 서버 로그 모니터링에는 `-F`가 적합하다.

![tail -f 실시간 모니터링 흐름](/assets/posts/linux-cat-tac-head-tail-tailf.svg)

## 파이프라인 조합 예시

```bash
# 로그에서 에러만 실시간 확인
tail -f app.log | grep --line-buffered ERROR

# CSV 헤더 제외하고 처음 5행만
tail -n +2 data.csv | head -n 5

# 여러 로그를 한 번에 모니터링
tail -f /var/log/nginx/error.log /var/log/app.log

# 파일 맨 마지막 빈 줄 제거
tac file.txt | sed '/./,$!d' | tac
```

`grep --line-buffered` 옵션은 파이프라인에서 grep이 출력을 즉시 내보내도록 강제한다. 없으면 버퍼가 가득 찰 때까지 출력이 지연된다.

## here-document로 다중 줄 파일 생성

`cat`과 here-document를 결합하면 스크립트 안에서 여러 줄 파일을 인라인으로 생성할 수 있다.

```bash
cat > /tmp/config.conf << 'EOF'
server {
    listen 80;
    server_name example.com;
}
EOF
```

단따옴표 `'EOF'`를 쓰면 내부의 `$변수`나 백틱이 확장되지 않는다. 설정 파일을 그대로 쓰고 싶을 때 유용하다.

---

**지난 글:** [절대 경로 vs 상대 경로: Linux 파일 주소 완벽 이해](/posts/linux-paths-absolute-relative/)

**다음 글:** [less & more: 대용량 파일을 쪽쪽 넘기며 읽기](/posts/linux-less-more/)

<br>
읽어주셔서 감사합니다. 😊
