---
title: "소스에서 빌드하기 — ./configure·make·make install"
description: "Autotools와 CMake 기반 소스 빌드 과정, ./configure 옵션, make -j 병렬 빌드, checkinstall로 패키지 생성, 빌드 의존성 관리를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 2
type: "knowledge"
category: "Linux"
tags: ["linux", "make", "cmake", "autotools", "configure", "build", "gcc", "checkinstall", "pkg-config", "source-install"]
featured: false
draft: false
---

[지난 글](/posts/linux-snap-flatpak/)에서 Snap·Flatpak처럼 미리 컴파일된 패키지를 설치하는 방법을 배웠습니다. 하지만 최신 버전, 특수 컴파일 옵션이 필요하거나 저장소에 없는 소프트웨어는 **소스 코드에서 직접 빌드**해야 합니다. 리눅스의 많은 소프트웨어가 Autotools(`./configure && make && make install`) 또는 CMake로 빌드되며, 이 과정을 이해하면 어떤 오픈소스 프로젝트도 설치할 수 있습니다.

## 빌드 도구 준비

소스 빌드에 앞서 컴파일러와 빌드 도구를 설치해야 합니다.

```bash
# Debian/Ubuntu
sudo apt install build-essential pkg-config

# RHEL/Fedora
sudo dnf groupinstall "Development Tools"
sudo dnf install pkgconf

# 설치 확인
gcc --version
make --version
```

`build-essential`은 `gcc`, `g++`, `make`, `libc-dev`를 한 번에 설치합니다.

## Autotools 빌드 흐름

가장 전통적인 빌드 방식입니다. `./configure` 스크립트가 시스템 환경을 검사해 `Makefile`을 생성하면, `make`가 이를 읽고 컴파일합니다.

![소스 빌드 파이프라인](/assets/posts/linux-source-build-make-install-flow.svg)

```bash
# 소스 다운로드 및 압축 해제
wget https://example.org/app-2.0.tar.gz
tar -xzf app-2.0.tar.gz
cd app-2.0/

# 옵션 확인
./configure --help

# 빌드 환경 설정
./configure --prefix=/usr/local \
            --sysconfdir=/etc \
            --enable-openssl

# 컴파일 (병렬)
make -j$(nproc)

# 테스트
make check

# 설치
sudo make install
```

### configure 핵심 옵션

| 옵션 | 설명 |
|------|------|
| `--prefix=DIR` | 설치 루트 (기본 `/usr/local`) |
| `--bindir=DIR` | 실행 파일 위치 |
| `--sysconfdir=DIR` | 설정 파일 위치 |
| `--enable-FEAT` | 선택 기능 활성화 |
| `--disable-FEAT` | 선택 기능 비활성화 |
| `--with-LIB` | 외부 라이브러리 지정 |
| `--without-LIB` | 외부 라이브러리 제외 |

`configure`는 의존 라이브러리가 없으면 실패합니다. `checking for openssl... no` 같은 오류가 나타나면 해당 개발 헤더(`-dev` / `-devel` 패키지)를 설치합니다.

```bash
# 오류 예: openssl 헤더 없음
sudo apt install libssl-dev   # Ubuntu
sudo dnf install openssl-devel  # Fedora
```

### Makefile 타겟

```bash
make          # 기본 빌드
make -j$(nproc)   # 병렬 빌드
make install       # 설치
make uninstall     # 제거 (지원 시)
make clean         # 빌드 산출물 삭제
make distclean     # configure 캐시까지 초기화
```

## CMake 빌드 흐름

현대 C/C++ 프로젝트의 상당수가 CMake를 씁니다. **out-of-source 빌드**가 표준 방식입니다.

![CMake vs Autotools](/assets/posts/linux-source-build-make-install-cmake.svg)

```bash
# CMake 설치
sudo apt install cmake

# out-of-source 빌드 디렉터리
mkdir build && cd build

# Makefile 생성
cmake .. -DCMAKE_BUILD_TYPE=Release \
         -DCMAKE_INSTALL_PREFIX=/usr/local

# 병렬 빌드
cmake --build . --parallel $(nproc)

# 테스트
ctest --output-on-failure

# 설치
sudo cmake --install .
```

`CMakeCache.txt`를 삭제하면 configure를 초기화할 수 있습니다. `-DCMAKE_BUILD_TYPE`에는 `Debug`, `Release`, `RelWithDebInfo`, `MinSizeRel`을 쓸 수 있습니다.

## Meson 빌드

GNOME 프로젝트 등 최신 소프트웨어는 Meson을 씁니다.

```bash
sudo apt install meson ninja-build

meson setup builddir
meson configure builddir -Dprefix=/usr/local
ninja -C builddir
sudo ninja -C builddir install
```

## checkinstall — 제거 가능한 패키지로 설치

`make install` 대신 `checkinstall`을 쓰면 `.deb` 또는 `.rpm` 파일을 생성해 패키지 관리자로 추적 가능하게 합니다.

```bash
sudo apt install checkinstall

# make install 대신
sudo checkinstall --pkgname=myapp \
                  --pkgversion=2.0 \
                  --backup=no \
                  --default
```

이렇게 설치하면 나중에 `apt remove myapp`으로 깔끔하게 제거할 수 있습니다.

## 라이브러리 경로 갱신

`/usr/local`에 설치한 공유 라이브러리가 동적 링커에 인식되지 않을 때:

```bash
# /etc/ld.so.conf.d/ 에 경로 추가
echo '/usr/local/lib' | sudo tee /etc/ld.so.conf.d/local.conf
sudo ldconfig

# 확인
ldconfig -p | grep libmyapp
```

환경 변수로 임시 지정도 가능합니다.

```bash
export LD_LIBRARY_PATH=/usr/local/lib:$LD_LIBRARY_PATH
```

## 정리

`./configure && make && sudo make install`은 리눅스 소프트웨어 빌드의 오랜 표준입니다. `--prefix`로 설치 경로를 조절하고, `-j$(nproc)`으로 빌드 시간을 단축하며, `checkinstall`로 제거 가능성을 확보하는 것이 핵심입니다. CMake·Meson 프로젝트도 out-of-source 빌드를 기본으로 삼으면 소스 트리를 깔끔하게 유지할 수 있습니다.

---

**지난 글:** [Snap·Flatpak — 배포판 독립 패키지 시스템](/posts/linux-snap-flatpak/)

**다음 글:** [ip vs ifconfig — 네트워크 인터페이스 도구 비교](/posts/linux-ip-vs-ifconfig/)

<br>
읽어주셔서 감사합니다. 😊
