Important Notes:
    Never push to home-assistant/core
    Always push to your fork (origin)
    Pull from upstream (home-assistant/core) using rebase
    Only force push when necessary (after rebase)

Initial Setup:
    Configure git settings:
        git config --global pull.rebase true
        git config --global cursor.rebase true
        git config --global cursor.autostash true

    Check your settings:
        git config --list

Regular Workflow:
    Get updates from Home Assistant:
        git pull --rebase upstream dev

    Push your changes to your fork:
        git push origin feature/family-calendar-card-new

    If needed, force push after rebase:
        git push -f origin feature/family-calendar-card-new

    Make sure branch tracks your fork:
        git branch --set-upstream-to=origin/feature/family-calendar-card feature/family-calendar-card

    Check tracking with:
        git branch -vv

Common Issues:
    If you see "divergent branches":
        git pull --rebase upstream dev

    If push is rejected (non-fast-forward):
        git push -f origin feature/family-calendar-card