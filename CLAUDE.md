# aion2-dotae 프로젝트 지침

## 배포 워크플로

코드 변경 완료 후 **확인 없이 자동으로** 아래 순서를 실행한다:

1. 변경 파일 스테이징 + 커밋 (feature 브랜치)
2. feature 브랜치 push (`git push -u origin <branch>`)
3. main 브랜치로 merge (`git checkout main && git merge <branch> --no-edit`)
4. main push (`git push -u origin main`)

매 작업 후 확인을 묻지 말고 위 과정을 자동 실행할 것.
