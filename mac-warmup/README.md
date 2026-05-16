# Polarad Meta API Warmup — iMac launchd 설치 가이드

GitHub Actions 대신 iMac에서 매일 09:00 자동 실행되도록 설정합니다.
목적: Marketing API Access Tier 통과(15일/1,500회) 호출량 누적.

## 사전 조건

- iMac이 **24/7 켜져 있어야** 함 (절전모드 OK — `WakeForRequest=true`로 깨워서 실행)
- Node.js **22 이상** 설치 (`brew install node@22` 또는 `nvm install 22`)
- 이 레포가 `/Users/<username>/polarad-meta` 또는 어디든 클론되어 있음
- `dashboard/.env.local`에 다음 키 존재:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `TELEGRAM_BOT_TOKEN`

## 1. 레포 위치 정하기

```bash
# 예: 홈 디렉토리에 클론한다고 가정
cd ~
git clone <this-repo> polarad-meta
cd polarad-meta
```

> 다른 경로에 두려면 plist의 `cd /Users/REPLACE_USERNAME/polarad-meta` 부분을 본인 경로로 수정.

## 2. Node 22 설치 확인

```bash
node -v
# v22.x.x 이상이어야 함
```

미설치라면:

```bash
# Homebrew
brew install node@22
brew link --overwrite --force node@22

# 또는 nvm
nvm install 22
nvm alias default 22
```

## 3. 첫 실행으로 의존성 설치 + 동작 확인

```bash
chmod +x ~/polarad-meta/mac-warmup/run.sh
~/polarad-meta/mac-warmup/run.sh
```

성공 시 끝부분에 `meta-api-warmup exited with 0` 출력. 텔레그램 백필 채널에도 결과 알림이 옵니다.

## 4. plist 설치 (자동 실행 등록)

```bash
# (a) 본인 username으로 치환한 plist 생성
USER_NAME="$(whoami)"
sed "s/REPLACE_USERNAME/$USER_NAME/g" ~/polarad-meta/mac-warmup/co.polarad.meta-warmup.plist \
  > ~/Library/LaunchAgents/co.polarad.meta-warmup.plist

# (b) launchd에 등록 + 즉시 활성화
launchctl unload ~/Library/LaunchAgents/co.polarad.meta-warmup.plist 2>/dev/null || true
launchctl load -w ~/Library/LaunchAgents/co.polarad.meta-warmup.plist

# (c) 등록 확인
launchctl list | grep co.polarad.meta-warmup
```

매일 09:00에 자동 실행되며, 절전 중이라도 시스템이 깨어나서 실행합니다.

## 5. 절전 정책 미세조정 (선택)

기본 plist의 `WakeForRequest=true`만으로 보통 충분하지만, 더 확실하게 하려면 시스템 전원 옵션에서 **Power Nap 활성화**:

```bash
sudo pmset -a powernap 1
sudo pmset -a darkwakes 1
```

또는 09:00 즈음 깨우기 스케줄:

```bash
sudo pmset repeat wakeorpoweron MTWRFSU 08:55:00
```

## 6. 수동 즉시 실행

```bash
launchctl start co.polarad.meta-warmup
# 또는
~/polarad-meta/mac-warmup/run.sh
```

## 7. 로그 확인

```bash
tail -f ~/Library/Logs/polarad-meta-warmup.log
tail -f ~/Library/Logs/polarad-meta-warmup.err.log
```

## 8. 비활성화 / 제거

```bash
launchctl unload ~/Library/LaunchAgents/co.polarad.meta-warmup.plist
rm ~/Library/LaunchAgents/co.polarad.meta-warmup.plist
```

## 9. GitHub Actions 워크플로우 처리

iMac 운영이 안정화되면 `.github/workflows/meta-api-warmup.yml`을 비활성화 또는 삭제하세요. 둘이 동시에 돌면 호출량은 두 배가 되지만 어차피 15일 누적은 되므로 통과엔 무해.

비활성화 옵션:

- 파일 삭제: `git rm .github/workflows/meta-api-warmup.yml && git commit && git push`
- schedule만 주석: `cron` 라인 주석 처리 + `workflow_dispatch:` 만 남기기

## 트러블슈팅

| 증상                | 원인 / 해결                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| `node not found`    | nvm 환경이 launchd 셸에 안 잡힘. `run.sh`의 `nvm.sh` 경로가 본인 환경에 맞는지 확인 (`echo $NVM_DIR`) |
| `Node 22+ required` | `brew link --overwrite --force node@22` 후 `node -v` 재확인                                           |
| 09:00에 안 돔       | `pmset -g sched`로 깨우기 일정 확인 / iMac이 09:00 시점 켜져있는지 확인                               |
| 텔레그램 알림 없음  | `dashboard/.env.local`의 `TELEGRAM_BOT_TOKEN` 값 확인                                                 |
| Supabase 연결 실패  | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 값 확인                                       |
