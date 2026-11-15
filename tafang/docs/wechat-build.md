# 微信小游戏构建步骤

1. 用 Cocos Creator 3.x 打开本工程（D:\project\tafang）。
2. 首次打开会生成 `library/`、`temp/`、`local/`、`profiles/`（已在 .gitignore 中排除）。
3. 菜单「项目 → 构建发布」。
4. 平台选「微信小游戏」，填写：
   - 初始场景：Startup
   - 主包资源按默认（本项目资源量小，无需分包）
5. 点击「构建」。
6. 用「微信开发者工具」打开构建产物目录 `build/wechatgame/`。
7. 填入 AppID（测试可用测试号），编译预览 / 上传。
8. 微信 API（login/share/onShow/onHide/storage）由 WeChatAdapter 自动检测 `wx` 对象；开发者工具内 `wx` 存在，会走真实微信接口；浏览器/编辑器内自动降级为 no-op / localStorage。
