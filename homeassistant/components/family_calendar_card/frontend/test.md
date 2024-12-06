# Git Workflow

## Initial Setup
```bash
git config pull.rebase true
```

## Regular Workflow

### 1. Getting Updates from Home Assistant
```bash
git pull --rebase upstream dev
```

### 2. Pushing Changes to Your Fork
```bash
git push origin feature/family-calendar-card
```

### 3. Force Push (if needed after rebase)
```bash
git push -f origin feature/family-calendar-card
```

## Notes
- Never push directly to `home-assistant/core`
- Always push to your own fork (`origin`)
- Pull from upstream (`home-assistant/core`) using rebase
- Force push only when necessary (after rebasing)

## Common Issues
If you see "divergent branches" message, use the rebase approach:
```bash
git pull --rebase upstream dev
```