---
title: "sed 기초"
description: "sed(stream editor)의 동작 원리, Pattern Space와 Hold Space, 주소 지정 방식, d/p/a/i/y 명령, 그리고 -n/-i 옵션 사용법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 6
type: "knowledge"
category: "Linux"
tags: ["sed", "stream-editor", "linux", "text-processing", "regex", "shell"]
featured: false
draft: false
---

[지난 글](/posts/linux-grep-egrep-fgrep/)에서 grep으로 텍스트를 검색하는 법을 살펴봤습니다. `sed`는 검색에서 한 단계 나아가 **파일을 직접 열지 않고 스트림으로 텍스트를 편집**하는 도구입니다. 치환, 삭제, 삽입, 추출 등을 한 줄 명령으로 처리합니다.

## sed의 동작 원리

sed는 입력을 한 줄씩 읽어 **Pattern Space**에 올리고, 주소(address)가 매칭되면 명령을 적용한 뒤, 기본적으로 Pattern Space의 내용을 출력합니다. Hold Space는 보조 버퍼로, 여러 줄에 걸친 복잡한 처리에 사용됩니다.

```bash
# 기본 형식
sed '[address]command' file

# 여러 명령 (세미콜론 구분 또는 -e 반복)
sed 'command1; command2' file
sed -e 'command1' -e 'command2' file

# -n: 자동 출력 억제 (p 명령으로 명시적 출력)
sed -n 'p' file   # 모든 줄 출력 (cat과 동일)

# -i: 파일 직접 수정 (in-place)
sed -i 's/old/new/g' file.txt

# -i.bak: 백업 후 수정 (원본 보존)
sed -i.bak 's/old/new/g' file.txt
```

![sed 동작 구조](/assets/posts/linux-sed-structure.svg)

## 주소 지정

명령 앞에 주소를 붙이면 해당 줄에만 명령이 적용됩니다. 주소가 없으면 모든 줄에 적용됩니다.

```bash
# 특정 줄 번호
sed '3d' file.txt          # 3번째 줄 삭제
sed '2,5d' file.txt        # 2~5번째 줄 삭제
sed '3,$d' file.txt        # 3번째 줄부터 끝까지 삭제
sed '$d' file.txt          # 마지막 줄 삭제

# 패턴 매칭
sed '/^#/d' file.txt       # #으로 시작하는 줄 삭제
sed '/error/,/end/d' file  # error ~ end 사이 줄 삭제

# step: 0~N (GNU sed)
sed -n '1~2p' file.txt     # 홀수 줄만 출력
sed -n '0~2p' file.txt     # 짝수 줄만 출력

# ! 반전
sed '/^#/!d' file.txt      # 주석 아닌 줄 모두 삭제
```

![sed 주소 지정 방식](/assets/posts/linux-sed-address.svg)

## 주요 명령

### d: 삭제

```bash
# 빈 줄 삭제
sed '/^\s*$/d' file.txt

# 주석과 빈 줄 동시 삭제
sed '/^[[:space:]]*#/d; /^[[:space:]]*$/d' file.txt
```

### p: 출력

`-n`과 함께 쓰면 선택적 출력 도구가 됩니다.

```bash
# 5번째 줄만 출력
sed -n '5p' file.txt

# 패턴 매칭 줄만 출력 (grep -n과 유사)
sed -n '/error/p' app.log

# 라인 번호도 함께 출력
sed -n '/error/{=; p}' app.log
```

### a, i, c: 추가·삽입·교체

```bash
# 특정 줄 다음에 텍스트 추가
sed '/pattern/a 추가할 텍스트' file.txt

# 특정 줄 앞에 텍스트 삽입
sed '/pattern/i 삽입할 텍스트' file.txt

# 매칭 줄을 다른 텍스트로 교체
sed '/old line/c 새로운 줄 내용' file.txt

# 파일 마지막에 줄 추가
sed '$a 마지막 줄' file.txt
```

### y: 문자 변환 (tr과 유사)

```bash
# 소문자 → 대문자
sed 'y/abcdefghijklmnopqrstuvwxyz/ABCDEFGHIJKLMNOPQRSTUVWXYZ/' file.txt

# 특정 문자 변환
sed 'y/,/\n/' csv.txt   # 쉼표를 줄바꿈으로
```

## 여러 파일 동시 처리

```bash
# 여러 파일에 동일한 치환 적용
sed -i 's/http:/https:/g' *.html

# 특정 디렉터리 내 모든 .conf 파일
find /etc -name "*.conf" | xargs sed -i 's/old/new/g'
```

## q: 특정 줄에서 종료

```bash
# 처음 10줄만 출력 (head와 동일)
sed '10q' file.txt

# 패턴 발견 후 종료
sed '/pattern/q' file.txt
```

sed의 `-i` 옵션은 파일을 직접 수정하므로 중요한 파일에 쓸 때는 `-i.bak`으로 백업을 만들거나 먼저 출력을 리디렉션해 결과를 확인하는 것이 안전합니다.

---

**지난 글:** [grep/egrep/fgrep 텍스트 검색](/posts/linux-grep-egrep-fgrep/)

**다음 글:** [sed 치환과 주소 지정](/posts/linux-sed-substitute/)

<br>
읽어주셔서 감사합니다. 😊
