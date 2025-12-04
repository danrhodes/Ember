@echo off
REM ============================================================
REM Version Bump Utility
REM Updates version in manifest.json
REM ============================================================
echo.
echo ========================================
echo Version Bump Utility
echo ========================================
echo.

REM Get current version using PowerShell for more reliable JSON parsing
for /f "delims=" %%a in ('powershell -Command "(Get-Content manifest.json | ConvertFrom-Json).version"') do (
    set CURRENT_VERSION=%%a
)

echo Current version: %CURRENT_VERSION%
echo.

REM Parse version numbers
for /f "tokens=1,2,3 delims=." %%a in ("%CURRENT_VERSION%") do (
    set MAJOR=%%a
    set MINOR=%%b
    set PATCH=%%c
)

REM Calculate new versions
set /a NEW_MAJOR=%MAJOR%+1
set /a NEW_MINOR=%MINOR%+1
set /a NEW_PATCH=%PATCH%+1

echo Select version bump type:
echo.
echo   1. Patch  (%MAJOR%.%MINOR%.%NEW_PATCH%) - Bug fixes
echo   2. Minor  (%MAJOR%.%NEW_MINOR%.0)        - New features
echo   3. Major  (%NEW_MAJOR%.0.0)              - Breaking changes
echo   4. Custom
echo   5. Cancel
echo.

choice /C 12345 /N /M "Choice: "
set CHOICE=%ERRORLEVEL%

if %CHOICE%==1 (
    set NEW_VERSION=%MAJOR%.%MINOR%.%NEW_PATCH%
    set BUMP_TYPE=PATCH
)
if %CHOICE%==2 (
    set NEW_VERSION=%MAJOR%.%NEW_MINOR%.0
    set BUMP_TYPE=MINOR
)
if %CHOICE%==3 (
    set NEW_VERSION=%NEW_MAJOR%.0.0
    set BUMP_TYPE=MAJOR
)
if %CHOICE%==4 (
    echo.
    set /p NEW_VERSION="Enter new version (e.g., 2.2.0): "
    set BUMP_TYPE=CUSTOM
)
if %CHOICE%==5 (
    echo Cancelled
    pause
    exit /b 0
)

echo.
echo ========================================
echo Version Bump: %BUMP_TYPE%
echo ========================================
echo.
echo   Current: %CURRENT_VERSION%
echo   New:     %NEW_VERSION%
echo.

choice /C YN /M "Confirm version bump"
if errorlevel 2 (
    echo Cancelled
    pause
    exit /b 0
)

REM Update manifest.json
echo.
echo Updating manifest.json...
powershell -Command "(Get-Content manifest.json) -replace '\"version\":\s*\"%CURRENT_VERSION%\"', '\"version\":\"%NEW_VERSION%\"' | Set-Content manifest.json"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Version Updated Successfully!
    echo ========================================
    echo.
    echo New version: %NEW_VERSION%
    echo.

    REM Create release folder and copy files
    echo Creating release folder...
    set RELEASE_DIR=_release\%NEW_VERSION%

    REM Use PowerShell inline to create folder and copy files - avoids temp file issues
    powershell -ExecutionPolicy Bypass -Command "& { if (-not (Test-Path '_release')) { New-Item -Path '_release' -ItemType Directory -Force | Out-Null; Write-Host 'Created _release folder' }; if (-not (Test-Path '_release\%NEW_VERSION%')) { New-Item -Path '_release\%NEW_VERSION%' -ItemType Directory -Force | Out-Null; Write-Host 'Created: _release\%NEW_VERSION%' } else { Write-Host 'Folder already exists: _release\%NEW_VERSION%' } }"

    echo.
    echo Copying release files...

    REM Copy files using PowerShell inline command
    powershell -ExecutionPolicy Bypass -Command "& { $releaseDir = '_release\%NEW_VERSION%'; if (Test-Path 'main.js') { Copy-Item 'main.js' \"$releaseDir\main.js\" -Force; Write-Host '  - Copied main.js' } else { Write-Host '  WARNING: main.js not found' }; if (Test-Path 'manifest.json') { Copy-Item 'manifest.json' \"$releaseDir\manifest.json\" -Force; Write-Host '  - Copied manifest.json' } else { Write-Host '  WARNING: manifest.json not found' }; if (Test-Path 'styles.css') { Copy-Item 'styles.css' \"$releaseDir\styles.css\" -Force; Write-Host '  - Copied styles.css' } else { Write-Host '  WARNING: styles.css not found' } }"

    echo.
    echo ========================================
    echo Release files ready in: %RELEASE_DIR%
    echo ========================================
    echo.

    REM Git operations
    echo.
    echo ========================================
    echo Creating Git Release
    echo ========================================
    echo.

    REM Stage the updated manifest.json
    echo Staging manifest.json...
    git add manifest.json

    REM Stage the entire release folder for this version
    echo Staging release folder...
    git add _release\%NEW_VERSION%\

    REM Create commit
    echo Creating commit...
    git commit -m "Release %NEW_VERSION%"

    if %ERRORLEVEL% EQU 0 (
        echo Commit created successfully

        REM Create git tag
        echo.
        echo Creating tag %NEW_VERSION%...
        git tag -a %NEW_VERSION% -m "Release version %NEW_VERSION%"

        if %ERRORLEVEL% EQU 0 (
            echo Tag created successfully

            REM Push commit and tag
            echo.
            echo Pushing to GitHub...
            git push origin main

            if %ERRORLEVEL% EQU 0 (
                echo.
                echo Pushing tag...
                git push origin %NEW_VERSION%

                if %ERRORLEVEL% EQU 0 (
                    echo.
                    echo ========================================
                    echo Release Complete!
                    echo ========================================
                    echo.
                    echo Version %NEW_VERSION% has been:
                    echo   - Committed to repository
                    echo   - Tagged as %NEW_VERSION%
                    echo   - Pushed to GitHub
                    echo.
                    echo View release at:
                    echo https://github.com/danrhodes/Ember/releases/tag/%NEW_VERSION%
                    echo.
                ) else (
                    echo.
                    echo ERROR: Failed to push tag to GitHub
                    echo You can manually push with: git push origin %NEW_VERSION%
                    echo.
                )
            ) else (
                echo.
                echo ERROR: Failed to push commit to GitHub
                echo You can manually push with: git push origin main
                echo.
            )
        ) else (
            echo.
            echo ERROR: Failed to create Git tag
            echo.
        )
    ) else (
        echo.
        echo ERROR: Failed to create Git commit
        echo.
    )

    echo.
) else (
    echo.
    echo ERROR: Failed to update version
    echo.
)

pause
