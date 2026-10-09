import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Keep the portable folder's documentation, notices and referenced source files together. */
export async function syncPackageDocs(target) {
  const app = path.join(target, 'resources', 'app');
  const sourceManifest = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  const packagedManifest = JSON.parse(await fs.readFile(path.join(app, 'package.json'), 'utf8'));
  if (sourceManifest.version !== packagedManifest.version) throw new Error('Source and portable versions do not match');
  await fs.access(path.join(target, '卫戍协议.exe'));
  for (const file of ['README.md', 'UI还原对照.md', 'Dockerfile', '.dockerignore', 'ecosystem.config.cjs']) {
    await fs.copyFile(path.join(root, file), path.join(app, file));
  }
  for (const directory of ['docs', 'deployment', 'scripts', 'tests']) {
    await fs.cp(path.join(root, directory), path.join(app, directory), {recursive: true});
  }
  const notices = path.join(root, 'research', 'apk', 'full', 'licenses');
  await fs.cp(notices, path.join(app, 'research', 'apk', 'full', 'licenses'), {recursive: true});
  await fs.cp(notices, path.join(target, 'licenses'), {recursive: true});
  const config = JSON.parse((await fs.readFile(path.join(target, '服务器配置.json'), 'utf8')).replace(/^\uFEFF/, ''));
  const currentMode = config.serverUrl ? `当前连接地址：${config.serverUrl}` : `当前使用本地模式，端口 ${config.localPort ?? 3001}。`;
  const readme = `# 卫戍协议：盟约 · Windows 联机便携版\n\n版本：${sourceManifest.version}。非官方同人作品。\n\n双击本目录的 **卫戍协议.exe** 启动作战终端。分发时保留完整文件夹，包含 resources、运行库及服务器配置.json。\n\n${currentMode}\n\n所有玩家连接同一台服务器，通过房间码或邀请链接加入同盟，队友准备后由房主开始。\n\n修改同级服务器配置.json 的 serverUrl 后重新打开 EXE，可切换 HTTP/HTTPS 游戏服务器；留空则进入本地模式。关闭远程客户端不会停止云服务器。\n\n- [项目 README](resources/app/README.md)\n- [开发文档](resources/app/docs/开发文档.md)\n- [联机协议](resources/app/docs/联机协议.md)\n- [云服务器部署说明](resources/app/deployment/云服务器部署说明.md)\n- [版权与使用声明](licenses/NOTICE.txt)\n- [完整源码与更新](https://github.com/AlistarTour/-)\n\n完整开发环境请从源码仓库获取并安装开发依赖；本便携版提供运行所需的生产依赖。原游戏素材和数据不属于代码的 GPL 授权范围，版权归相应权利人所有。\n`;
  await fs.writeFile(path.join(target, 'README.md'), readme, 'utf8');
  await fs.writeFile(path.join(target, '使用说明.txt'), `双击“卫戍协议.exe”启动作战终端。\r\n${currentMode}\r\n配置文件：EXE 同级“服务器配置.json”。\r\nserverUrl 有值时连接远程游戏服务；留空时使用本地服务，默认端口 3001。\r\n关闭窗口只会停止客户端自己启动的本地服务，不会停止复用的服务或云端服务。\r\n分发时保留整个便携版文件夹。最新说明见 README.md，开发文档位于 resources/app/docs。\r\n非官方、非商业同人项目；原版权与第三方声明保存在 licenses 目录。\r\n`, 'utf8');
  console.log(`Portable documentation synced: ${target}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await syncPackageDocs(path.join(root, 'dist', '卫戍协议-win32-x64'));
}
