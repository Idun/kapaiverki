@echo off
chcp 65001 >nul
echo ===================================
echo    AI 故事创作 (AI Story Weaver)
echo ===================================
echo.

echo [信息] 正在检查依赖是否安装...
call npm install
if %errorlevel% neq 0 (
    echo [错误] 依赖安装失败，请检查网络连接或手动运行 npm install
    pause
    exit /b 1
)
echo [成功] 依赖安装完成！
echo.

echo [信息] 正在构建项目...
call npm run build
if %errorlevel% neq 0 (
    echo [错误] 项目构建失败，请检查错误信息
    pause
    exit /b 1
)
echo [成功] 项目构建完成！
echo.

echo [信息] 正在启动应用...
echo [信息] 应用将在浏览器中自动打开: http://localhost:3000
echo.
echo 按 Ctrl+C 可以终止应用
echo.
start http://localhost:3000
call npm start