---
title: "read: 스크립트에서 사용자 입력 받기"
description: "Bash read 명령어의 옵션과 IFS 활용법, 파일 한 줄씩 처리 패턴, 대화형 스크립트 작성 방법을 익힌다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 7
type: "knowledge"
category: "Linux"
tags: ["Linux", "read", "bash", "입력", "IFS", "스크립트"]
featured: false
draft: false
---

[지난 글](/posts/linux-tee/)에서 `tee`로 파이프라인을 분기하는 방법을 살펴봤다. 이번에는 셸 스크립트에서 **사용자 입력을 받거나 파일을 한 줄씩 처리**할 때 쓰는 `read` 명령어를 다룬다. `read`는 단순해 보이지만 옵션과 IFS(Internal Field Separator)를 조합하면 강력한 입력 처리가 가능하다.

## read 기본 동작

`read` 는 표준 입력에서 한 줄을 읽어 변수에 저장한다. 변수를 여러 개 지정하면 공백을 기준으로 각 변수에 분배하고, 마지막 변수에 나머지 모두를 넣는다.

```bash
read name                     # 입력 대기 후 name에 저장
read first last               # "John Doe" → first=John last=Doe
read first middle last rest   # 3단어 → rest에 나머지 전부
```

변수를 지정하지 않으면 `REPLY` 변수에 저장된다.

```bash
read
echo "입력: $REPLY"
```

## 주요 옵션

![read 명령어 옵션](/assets/posts/linux-read-input-options.svg)

### -r 옵션 — 항상 붙여라

`-r`이 없으면 입력 중 `\n`, `\\` 같은 백슬래시 조합이 이스케이프로 처리된다. 파일 경로처럼 백슬래시를 그대로 보존해야 할 때 문제가 생긴다. 스크립트에서는 **습관적으로 `-r`을 붙이는 것이 안전**하다.

```bash
# -r 없으면: "\n"이 개행으로 해석될 수 있음
read path
echo "$path"

# -r 있으면: 백슬래시 그대로 보존
read -r path
echo "$path"
```

### -p 와 -s — 인터랙티브 입력

```bash
read -rp "사용자명: " username
read -rsp "비밀번호: " password
echo    # -s 는 개행을 출력하지 않으므로 직접 추가
```

`-sp`처럼 옵션을 붙여 쓸 수 있다. `-s`는 입력한 문자가 화면에 보이지 않아 비밀번호 입력에 적합하다.

## 타임아웃과 단일 키 입력

```bash
# 10초 안에 입력 없으면 타임아웃
if ! read -rt 10 -p "계속하려면 Enter: " ans; then
    echo "타임아웃 — 기본값 사용"
fi

# 한 글자만 입력받기 (Enter 불필요)
read -rn 1 -p "삭제하시겠습니까? [y/N] " key
echo
[[ $key == [Yy] ]] && echo "삭제" || echo "취소"
```

## IFS — 필드 구분자 제어

`IFS`(Internal Field Separator)는 `read`가 입력을 나눌 때 사용하는 구분 문자다. 기본값은 공백·탭·개행이다.

```bash
# 콜론으로 구분 (예: /etc/passwd 파싱)
IFS=':' read -r user _ uid gid desc home shell <<< "root:x:0:0:root:/root:/bin/bash"
echo "user=$user uid=$uid shell=$shell"
# user=root uid=0 shell=/bin/bash

# CSV 파싱
IFS=',' read -r name age city <<< "Alice,30,Seoul"
```

`IFS=` (빈 값)로 설정하면 앞뒤 공백과 탭을 보존하면서 줄 전체를 하나의 변수에 저장한다. 파일을 줄 단위로 처리할 때 공백이 포함된 행을 안전하게 읽으려면 이렇게 해야 한다.

## 파일 한 줄씩 처리 — while IFS= read 관용구

```bash
while IFS= read -r line; do
    echo "처리: $line"
done < input.txt
```

이 패턴이 Bash에서 파일을 안전하게 줄 단위로 처리하는 표준 관용구다.

- `IFS=` — 앞뒤 공백 보존
- `-r` — 백슬래시 보존
- `< input.txt` — 파일을 stdin으로 전달 (서브셸 생성 없음)

`for line in $(cat file)`을 쓰면 공백·파일글로브·특수문자에 취약하므로 반드시 `while read`를 쓴다.

![read 스크립트 활용 패턴](/assets/posts/linux-read-input-script.svg)

## 배열로 읽기

```bash
# 공백 구분 단어를 배열에 저장
read -ra words <<< "apple banana cherry"
echo "${words[0]}"   # apple
echo "${words[@]}"   # 전체

# 파일의 모든 줄을 배열로
mapfile -t lines < input.txt
echo "총 ${#lines[@]}줄"
```

`mapfile`(또는 `readarray`)은 파일 전체를 배열로 한 번에 읽는다. 파일이 크면 메모리를 많이 쓰므로 주의한다.

## 확인 대화 함수

스크립트에서 자주 쓰는 확인 대화를 함수로 만들어 두면 편리하다.

```bash
confirm() {
    local prompt="${1:-계속하시겠습니까?} [y/N] "
    read -rp "$prompt" yn
    case "$yn" in
        [Yy]*) return 0 ;;
        *)     return 1 ;;
    esac
}

confirm "파일을 삭제하시겠습니까?" && rm -rf /tmp/data
```

---

**지난 글:** [tee: 파이프라인을 분기하는 T자 이음새](/posts/linux-tee/)

**다음 글:** [inode 완전 해부: 파일 시스템의 심장](/posts/linux-inode-essence/)

<br>
읽어주셔서 감사합니다. 😊
