# 校园机会雷达

这是一个基于 Python + Flask + SQLite 的校园机会信息站，适合学生发掘比赛、实习、奖学金、科研和公益机会。

## 项目功能

- 统一展示校园和社会机会信息
- 按分类、关键词和时间筛选
- 浏览器本地生成 user_id，支持本地收藏功能
- 支持用户上报新增机会
- 使用 SQLite 本地存储，不依赖第三方数据库服务

## 运行方式

1. 进入项目目录：
   ```bash
   cd 校园机会雷达
   ```

2. 安装依赖：
   ```bash
   python -m pip install -r requirements.txt
   ```

3. 启动程序：
   ```bash
   python app.py
   ```

4. 浏览器访问：
   ```text
   http://127.0.0.1:5000
   ```

## 目录说明

- `app.py`：Flask 应用主文件
- `campus_opportunities.db`：SQLite 数据库文件（启动时自动创建）
- `templates/index.html`：前端页面
- `static/css/style.css`：页面样式
- `static/js/app.js`：前端交互逻辑

## 说明

- 本项目不含登录系统，使用浏览器本地 `user_id` 区分用户。
- 数据库使用 Python 标准库 `sqlite3`，兼容 Windows、macOS 和 Linux。
