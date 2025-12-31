#!/bin/bash
set -e

# Switch to dist branch and merge main
git checkout dist
git merge main --no-edit

# Build the project
npm run build

# Stage dist files
git add -f dist/

# Check if there are actual changes to commit
if git diff --cached --quiet; then
    echo "No dist changes, resetting merge"
    git reset --hard HEAD~1
else
    git commit -m "build: update dist from main"
    git push origin dist
fi

# Return to main branch
git checkout main
