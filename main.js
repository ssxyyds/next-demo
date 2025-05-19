// main.js
const { app, BrowserWindow, dialog } = require('electron');
const path = require('node:path');
const next = require('next'); // 1. 引入 next
const http = require('node:http'); // 2. 引入 http 来创建服务器

const isDev = process.env.NODE_ENV === 'development';
const nextDir = path.join(__dirname); // 假设 Next.js 项目与 main.js 在同一目录结构

let nextApp;
let expressServer; // Renamed from httpServer to avoid confusion with Node's http.Server
let appPort; // 3. 默认端口

async function prepareNextServer() {
    try {
        console.log(`[Nextron] Next.js is in ${isDev ? 'development' : 'production'} mode`);
        // 4. 创建 Next.js 应用实例
        // `dir` 参数指向 Next.js 项目的根目录
        // `dev` 参数根据环境变量设置
        nextApp = next({ dev: isDev, dir: nextDir, quiet: false });

        // 5. 准备 Next.js 应用 (编译等)
        await nextApp.prepare();
        console.log('[Nextron] Next.js app prepared.');

        // 6. 获取 Next.js 请求处理器
        const handler = nextApp.getRequestHandler();

        // 7. 动态查找一个可用端口
        appPort = 3000;

        // 8. 创建 HTTP 服务器并使用 Next.js 处理器
        expressServer = http.createServer(handler); // Using Node's http.createServer with Next's handler

        // 9. 启动服务器
        await new Promise((resolve, reject) => {
            expressServer.listen(appPort, '127.0.0.1', (err) => {
                if (err) {
                    console.error('[Nextron] Error starting Next.js server:', err);
                    return reject(err);
                }
                console.log(`[Nextron] ✅ Next.js server listening on http://localhost:${appPort}`);
                resolve();
            });
            expressServer.on('error', (error) => { // Add error listener to the server itself
                console.error('[Nextron] HTTP Server error:', error);
                reject(error);
            });
        });

    } catch (error) {
        console.error('[Nextron] Error preparing/starting Next.js server:', error);
        dialog.showErrorBox('Next.js Server Error', `Failed to start Next.js server: ${error.message}\n\nCheck console for more details.`);
        app.quit(); // Quit if Next.js server fails to start
        process.exit(1); // Ensure process exits
    }
}

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            // preload: path.join(__dirname, 'preload.js'), // 可选
            nodeIntegration: false,
            contextIsolation: true,
            devTools: isDev, // 开发模式下打开开发者工具
        },
    });

    if (!appPort) {
        console.error('[Nextron] Server port not available. Cannot load URL.');
        dialog.showErrorBox('Application Error', 'Server port not available. Cannot load URL.');
        return;
    }

    // 10. 加载内部 Next.js 服务器的 URL
    const appUrl = `http://localhost:${appPort}`;
    console.log(`[Nextron] Loading URL: ${appUrl}`);
    mainWindow.loadURL(appUrl);

    if (isDev) {
        mainWindow.webContents.openDevTools();
    }
}

app.on('ready', async () => { // Changed to 'ready' as whenReady() returns a Promise
    console.log('[Nextron] Electron app is ready.');
    await prepareNextServer(); // 确保 Next.js 服务器准备好再创建窗口
    createWindow();
});


app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && appPort) {
        createWindow();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', async () => {
    // 11. 关闭 Next.js 服务器和 HTTP 服务器
    console.log('[Nextron] Electron app will quit. Closing servers...');
    if (expressServer) {
        await new Promise(resolve => expressServer.close(resolve));
        console.log('[Nextron] HTTP server closed.');
    }
    if (nextApp) {
        // nextApp.close() is not always available or needed in this setup,
        // as the http server wrapping its handler is the main thing to close.
        // However, if a future version of Next.js offers a specific close method for programmatic use,
        // it could be called here.
        console.log('[Nextron] Next.js app instance (handler) does not require explicit closing beyond HTTP server.');
    }
});