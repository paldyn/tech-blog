---
title: "sed 치환과 주소 지정"
description: "sed s 명령의 구분자, 플래그(g/i/p/N), 캡처 그룹, 역참조, 실전 치환 패턴(날짜 형식 변환, 앞뒤 공백 제거, HTML 태그 제거)을 코드 예제 중심으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 7
type: "knowledge"
category: "Linux"
tags: ["sed", "substitute", "regex", "linux", "text-processing", "capture-group", "shell"]
featured: false
draft: false
---

[지난 글](/posts/linux-sed-basics/)에서 sed의 동작 원리와 기본 명령들을 살펴봤습니다. 이번엔 가장 자주 쓰이는 `s` 명령 — 치환(substitute) — 을 깊게 파고듭니다. 플래그, 캡처 그룹, 구분자 선택까지 실전에서 바로 쓸 수 있는 패턴을 정리합니다.

## s 명령 기본 구조

```bash
# 기본: 각 줄의 첫 번째 매칭만 치환
sed 's/old/new/' file.txt

# 전체 치환
sed 's/old/new/g' file.txt

# 파일 직접 수정 (-i)
sed -i 's/old/new/g' file.txt

# 백업 후 수정
sed -i.bak 's/old/new/g' file.txt
```

![sed s 명령 구조 분해](/assets/posts/linux-sed-substitute-syntax.svg)

## 구분자 변경

구분자는 `/` 외에도 `@`, `#`, `!`, `|` 등 원하는 문자를 쓸 수 있습니다. 패턴이나 치환 문자열에 `/`가 포함될 때 유용합니다.

```bash
# 경로 치환 — 슬래시 이스케이프 불필요
sed 's#/usr/local#/opt#g' script.sh

# URL 치환
sed 's|http://old.example.com|https://new.example.com|g' urls.txt

# 첫 번째 방법과 동일 (/ 이스케이프)
sed 's/\/usr\/local/\/opt/g' script.sh   # 읽기 어려움
```

## 플래그

```bash
# g: 전체 치환
echo "aa bb aa" | sed 's/aa/XX/g'   # XX bb XX

# 숫자: N번째 매칭만 치환
echo "aa bb aa cc aa" | sed 's/aa/XX/2'  # aa bb XX cc aa

# 숫자+g: N번째 이후 전체 치환
echo "aa bb aa cc aa" | sed 's/aa/XX/2g'  # aa bb XX cc XX

# i: 대소문자 무시
echo "Error ERROR error" | sed 's/error/WARN/gi'  # WARN WARN WARN

# p: 치환된 줄 출력 (-n과 함께)
sed -n 's/error/ERROR/p' app.log   # 치환된 줄만 출력
```

## 캡처 그룹과 역참조

BRE에서는 `\( \)`로 그룹을 만들고, ERE(`-E`)에서는 `( )`를 씁니다.

```bash
# 성 이름 → 이름 성 순서로 변경 (BRE)
echo "Kim Minsu" | sed 's/\([A-Za-z]*\) \([A-Za-z]*\)/\2 \1/'
# Minsu Kim

# ERE 버전 (더 읽기 쉬움)
echo "Kim Minsu" | sed -E 's/([A-Za-z]+) ([A-Za-z]+)/\2 \1/'

# 날짜 형식 변환: YYYY-MM-DD → DD/MM/YYYY
echo "2026-05-21" | sed -E 's/([0-9]{4})-([0-9]{2})-([0-9]{2})/\3\/\2\/\1/'
# 21/05/2026

# 매칭 전체를 괄호로 감싸기 (&: 전체 매칭)
echo "hello world" | sed 's/[a-z]*/[&]/g'
# [hello] [world]

# 함수 호출에 로그 추가
sed -E 's/(myFunction\([^)]*\))/log(\1)/g' source.js
```

![sed 치환 실전 패턴](/assets/posts/linux-sed-substitute-examples.svg)

## 실전 패턴 모음

```bash
# 앞뒤 공백 제거 (trim)
sed -E 's/^\s+|\s+$//g' file.txt

# HTML 태그 제거
sed -E 's/<[^>]+>//g' page.html

# CSV에서 특정 컬럼 제거 (2번째 필드)
sed 's/,[^,]*//' data.csv    # 첫 번째 쉼표 이후 필드 제거

# 빈 줄 압축 (연속 빈 줄 → 한 줄)
sed '/^$/N; /^\n$/d' file.txt

# 줄 끝 공백 제거
sed 's/[[:space:]]*$//' file.txt

# 특정 줄 범위에서만 치환
sed '10,20s/old/new/g' file.txt
sed '/START/,/END/s/foo/bar/g' file.txt
```

## 주소와 치환 결합

```bash
# 주석 아닌 줄에서만 치환
sed '/^[[:space:]]*#/!s/debug/info/g' config.txt

# 첫 번째 패턴 발견 이후 치환
sed '0,/START/!s/old/new/g' file.txt

# 특정 섹션 내에서만 치환
sed '/\[section\]/,/\[/s/key=.*/key=value/' config.ini
```

## 여러 치환 한 번에

```bash
# -e 플래그로 여러 명령
sed -e 's/foo/bar/g' -e 's/baz/qux/g' file.txt

# 세미콜론 구분
sed 's/foo/bar/g; s/baz/qux/g' file.txt

# 스크립트 파일 사용 (-f)
cat > fix.sed <<'EOF'
s/http:/https:/g
s/old\.domain\.com/new.domain.com/g
s/v1\//v2\//g
EOF
sed -f fix.sed urls.txt
```

치환이 복잡해질수록 `-f`로 스크립트 파일에 분리하면 유지보수가 훨씬 쉽습니다. 특히 여러 파일에 동일한 변환을 반복 적용할 때 유용합니다.

---

**지난 글:** [sed 기초](/posts/linux-sed-basics/)

**다음 글:** [awk 기초](/posts/linux-awk-basics/)

<br>
읽어주셔서 감사합니다. 😊
