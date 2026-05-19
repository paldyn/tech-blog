---
title: "Bash Here Document와 Here String"
description: "Bash의 <<EOF Here Document와 <<<  Here String 문법을 설명합니다. 변수 확장 억제, <<- 들여쓰기 제거, SSH 원격 명령·SQL 실행·설정 파일 생성 등 실전 활용 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 7
type: "knowledge"
category: "Linux"
tags: ["bash", "heredoc", "here-string", "stdin", "shell", "linux", "scripting"]
featured: false
draft: false
---

[지난 글](/posts/bash-getopts/)에서 getopts로 옵션을 파싱하는 방법을 살펴봤습니다. 이번엔 여러 줄 텍스트를 명령의 표준 입력으로 바로 넘기는 Here Document와 한 줄 문자열을 stdin으로 주는 Here String을 알아봅니다.

## Here Document — <<EOF

Here Document는 `<<구분자`로 시작해 같은 `구분자`가 단독으로 있는 줄에서 끝납니다. 구분자 이름은 관례적으로 `EOF`를 쓰지만 아무 단어나 쓸 수 있습니다.

```bash
cat <<EOF
안녕하세요, $USER
홈 디렉터리: $HOME
오늘: $(date +%F)
EOF
```

기본적으로 변수 확장(`$VAR`)과 명령 치환(`$(cmd)`)이 적용됩니다.

![Here Document 문법](/assets/posts/bash-heredoc-syntax.svg)

## 변수 확장 억제 — 구분자를 따옴표로

구분자를 작은따옴표나 큰따옴표로 감싸면 변수·명령 치환이 발생하지 않아 내용이 그대로 출력됩니다.

```bash
cat <<'EOF'
변수: $USER       # 그대로 출력 ($USER 미치환)
명령: $(whoami)   # 그대로 출력
백슬래시: \n      # 이스케이프 없음
EOF
```

셸 스크립트 자체를 파일로 쓸 때, 또는 Python/Ruby 인라인 스크립트를 삽입할 때 유용합니다.

## <<- 탭 들여쓰기 제거

`<<-`를 쓰면 내용 줄 앞의 **탭**이 제거됩니다. 소스 코드를 들여쓴 채로 작성할 수 있어 가독성이 높아집니다.

```bash
generate_config() {
    cat <<-EOF
        [server]
        host = $HOST
        port = $PORT
    EOF
}
```

주의: 들여쓰기는 **탭**(Tab) 문자만 제거합니다. 공백은 제거되지 않습니다. 편집기에서 탭을 공백으로 자동 변환하도록 설정되어 있다면 `-`가 효과가 없을 수 있습니다.

## 파일로 리다이렉트

```bash
# 파일에 쓰기
cat > /etc/myapp.conf <<EOF
HOST=$DB_HOST
PORT=$DB_PORT
NAME=$DB_NAME
EOF

# 기존 파일에 추가
cat >> /var/log/deploy.log <<EOF
[$(date)] 배포 완료: $VERSION
EOF

# sudo 권한 파일 — tee 활용
sudo tee /etc/protected.conf > /dev/null <<EOF
secret=$SECRET
EOF
```

## Here String — <<<

Here String은 한 줄 문자열을 명령의 stdin으로 넘깁니다.

```bash
# read에 문자열 전달
read -r first second <<< "hello world"
echo "$first"    # hello
echo "$second"   # world

# grep에 문자열 전달
grep "error" <<< "$LOG_LINE"

# bc로 계산
result=$(bc <<< "scale=2; 22/7")
echo "$result"   # 3.14

# 문자열 분리 (IFS 활용)
IFS=':' read -ra parts <<< "a:b:c"
echo "${parts[0]}"   # a
```

Here String은 임시 파일을 만들지 않아 파이프보다 효율적이고, 서브셸을 생성하지 않아 외부에서 변수를 볼 수 있습니다.

## 실전 활용 패턴

![Here Document 활용 패턴](/assets/posts/bash-heredoc-usecases.svg)

```bash
# SSH 원격 다중 명령 (인용하면 로컬 변수 미확장)
ssh user@server <<'REMOTE'
    sudo systemctl restart nginx
    tail -20 /var/log/nginx/error.log
REMOTE

# psql SQL 실행 (변수 확장 적용)
psql -U "$DB_USER" "$DB_NAME" <<SQL
    INSERT INTO logs (ts, msg) VALUES (NOW(), '$MESSAGE');
SQL

# Python 인라인 실행
python3 <<'PY'
import sys
for line in sys.stdin:
    print(line.upper(), end='')
PY <<< "hello world"
```

## 공통 실수

```bash
# ❌ EOF 앞에 공백이 있으면 인식 실패
cat <<EOF
    some text
    EOF   # ← 공백 있음 — 루프가 끝나지 않음

# ✅ EOF는 줄의 맨 앞에 와야 함 (<<- 사용 또는 탭만 허용)
cat <<EOF
    some text
EOF
```

---

**지난 글:** [Bash getopts로 옵션 파싱](/posts/bash-getopts/)

**다음 글:** [Bash 프로세스 치환](/posts/bash-process-substitution/)

<br>
읽어주셔서 감사합니다. 😊
