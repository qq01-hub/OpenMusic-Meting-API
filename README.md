<div align="center">

# OpenMusic-Meting-API

统一的多平台音乐 API 服务

网易云音乐 · QQ 音乐 · 汽水音乐 · 酷狗音乐

[快速开始](#快速开始) · [接口](#接口) · [音质](#音质) · [管理与配置](#管理与配置)

</div>

支持歌曲、歌单、搜索、私人漫游、播放地址与结构化歌词，内置多账号 Cookie 管理、扫码登录、自动监测和管理后台

## 快速开始

Node.js `>= 18`，推荐使用 Node.js 或 Docker 部署以保留完整的管理与持久化能力

```powershell
git clone https://github.com/qq01-hub/Meting-API.git
cd Meting-API
npm install
npm run start:node
```

| 入口 | 默认地址 | 说明 |
|:---|:---|:---|
| API 文档 | [localhost:3000](http://localhost:3000) | 接口与参数说明 |
| 管理后台 | [localhost:3000/admin](http://localhost:3000/admin) | 默认账号 `admin` / `admin123`，首次登录后修改密码 |
| 在线测试 | [localhost:3000/test](http://localhost:3000/test) | 同音乐 API 一样需要服务端授权 |

接入顺序：登录后台 → 添加并验证平台 Cookie → 创建 API Token → 在 OpenMusic 服务端配置地址与 Token

**音乐接口默认要求 API Token + OpenMusic 短期签名**，下文请求只展示参数格式，完整接入与兼容开关见 [服务端授权](docs/OPENMUSIC_AUTH.md)

<details>
<summary>Docker 部署</summary>

以下命令在 Linux 宿主机执行，先准备持久化目录，再启动容器

```bash
mkdir -p /opt/meting-api/data

docker run -d \
  --name openmusic-meting-api \
  --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  --mount type=bind,source=/opt/meting-api/data,target=/app/data \
  w3126197382/meting-api:latest
```

容器内数据目录为 `/app/data`，升级时复用原挂载目录

OpenMusic 与本服务在同一 Docker 网络时，可直接使用容器名和端口连接，省略宿主机端口映射

</details>

## 接口

```http
GET /api?server=netease&type=playlist&id=6907557348
```

| 参数 | 默认值 | 说明 |
|:---|:---|:---|
| `server` | `netease` | `netease` / `tencent` / `qishui` / `kugou` |
| `type` | `playlist` | 见下表 |
| `id` | `6907557348` | 资源 ID、搜索词或漫游模式，通常应显式传入 |
| `quality` | `standard` | 音质档位，主要用于 `type=url`，也可随曲目请求传入以生成对应播放链接 |
| `redirect` | 关闭 | `1` 或 `true` 时，`url` 返回 302；`pic` 始终返回 302 |
| `format` | 文本 | `type=lrc&format=json` 返回结构化歌词 |
| `limit` / `page` / `offset` | 见分页说明 | 仅网易云 `search` / `dj` 支持 |
| `fm` | 关闭 | FM 曲目的播放链接自动带 `fm=1`，用于优先选择 FM 账号 |

| `type` | 用途 | 网易云 | QQ | 汽水 | 酷狗 |
|:---|:---|:---:|:---:|:---:|:---:|
| `song` / `playlist` | 单曲 / 歌单 | ✓ | ✓ | ✓ | ✓ |
| `search` / `search_playlist` | 搜索歌曲 / 歌单 | ✓ | ✓ | ✓ | ✓ |
| `fm` | 私人漫游 | ✓ | ✓ | ✓ | ✓ |
| `url` / `lrc` / `pic` | 播放地址 / 歌词 / 封面 | ✓ | ✓ | ✓ | ✓ |
| `artist` | 歌手歌曲 | ✓ | — | — | — |
| `search_dj` / `dj` / `dj_detail` / `djprogram` / `dj_hot` | 电台与节目 | ✓ | — | — | — |

曲目类接口返回 JSON 数组，通常包含 `id`、`title`、`author`、`url`、`pic`、`lrc`，部分曲目附带秒级 `duration`

`type=url` 默认返回播放信息，`quality` 表示实际获得的中文档位，`duration` 不可用时省略，`loudness` 无数据时为 `null`，以下为网易云响应示例

```json
{
  "url": "https://音源地址/song.flac",
  "quality": "无损",
  "duration": 260,
  "loudness": null
}
```

时长单位：网易云、QQ、酷狗为秒，汽水当前取流层返回毫秒，客户端读取时需按平台换算

<details>
<summary>常用请求示例</summary>

```http
GET /api?server=netease&type=search&id=风筝误
GET /api?server=tencent&type=song&id=0010BrWk2SucQr
GET /api?server=qishui&type=search_playlist&id=流行
GET /api?server=kugou&type=playlist&id=gcid_3zfpq2kyzmz04f
GET /api?server=netease&type=url&id=254059&quality=lossless
GET /api?server=tencent&type=url&id=0010BrWk2SucQr&quality=master&redirect=1
GET /api?server=qishui&type=url&id=汽水歌曲ID&quality=studio
GET /api?server=kugou&type=url&id=72db6da75ffe23a3a6361bdb8f44d5f4&quality=flac
GET /api?server=tencent&type=lrc&id=0010BrWk2SucQr
GET /api?server=tencent&type=lrc&id=0010BrWk2SucQr&format=json
```

`lrc` 默认返回 LRC 文本，`format=json` 可补充 YRC / QRC / KRC / TTML，缺少逐字时间轴时保留逐行歌词，详见 [结构化歌词](docs/FOLIA_LYRICS.md)

MetingJS 可使用以下地址模板，请求仍须经过服务端授权接入，模板中的 `auth` 不替代 API Token 和签名

```html
<script>
  var meting_api = 'https://你的域名/api?server=:server&type=:type&id=:id&auth=:auth&r=:r&redirect=1'
</script>
```

</details>

<details>
<summary>网易云分页</summary>

- `search` 不传分页参数时默认返回前 30 首，`dj` 不传分页参数时保留原有全量行为
- 显式分页时，`search` 的默认 `limit=30`，`dj` 的默认 `limit=100`
- `limit` 为整数 `1–100`，`page` 从 `1` 开始，`offset` 从 `0` 开始，显式 `offset` 优先于 `page`
- 响应保持 JSON 数组，由客户端递增页码或偏移并合并结果，空数组表示无可用结果
- `/admin/openmusic` 房间私有入口支持相同分页规则，其他平台不使用这组分页参数

```http
GET /api?server=netease&type=search&id=歌手名&limit=100&page=2
GET /api?server=netease&type=search&id=歌手名&limit=100&offset=200
GET /api?server=netease&type=dj&id=电台ID&limit=100&page=2
```

</details>

<details>
<summary>私人漫游与多账号切换</summary>

| 平台 | `id` 模式 |
|:---|:---|
| 网易云 | `DEFAULT` / `FAMILIAR` / `EXPLORE` / `aidj` / `SCENE_RCMD[:子模式]`，子模式支持 `EXERCISE` / `FOCUS` / `NIGHT_EMO` |
| QQ | 固定猜你喜欢，忽略 `id` |
| 汽水 | 可不传，或传平台支持的偏好模式 |
| 酷狗 | 以平台推荐结果为准 |

后台可为每个平台设置一个 FM 优先账号，推荐列表可使用非会员账号，但公共播放地址只从已确认有会员权益、且满足目标档位的有效账号中选择，没有可用账号时返回 `503 MUSIC_ACCOUNT_UNAVAILABLE`

FM 返回的播放链接带 `fm=1`，优先账号满足音质要求时继续使用，否则选择其他符合条件的账号，保持原 FM 歌曲 ID

公共 FM 失败会尝试其他会员账号，失败账号短暂冷却 30 秒；播放取链失败最多切换 3 次备用账号，避免无限重试

QQ 触发官方验证后冷却 1 小时，状态持久化，普通空链接或异常只记录失败，不直接禁用账号，完成验证并播放成功或更换 Cookie 可提前恢复

显式携带 `X-OpenMusic-Cookie` 时始终使用请求中的账号，不启用公共池切换，房间私有账号入口及失效后的回退协议见 [服务端授权](docs/OPENMUSIC_AUTH.md)

</details>

<details>
<summary>错误响应</summary>

| HTTP | 常见错误码 | 含义 |
|:---|:---|:---|
| `400` | 参数错误 | 平台、接口、音质或分页参数无效 |
| `401` | `OPENMUSIC_AUTH_REQUIRED` / `OPENMUSIC_REPLAY` | 授权缺失、无效或请求重放 |
| `403` | `MUSIC_URL_UNAVAILABLE` | 未获得可用播放地址 |
| `422` | `MUSIC_ACCOUNT_INVALID` / `MUSIC_VERIFICATION_REQUIRED` | 账号失效或需要官方验证 |
| `503` | `MUSIC_ACCOUNT_UNAVAILABLE` | 公共池没有可用账号 |
| `502` / `504` | `UPSTREAM_REQUEST_FAILED` / `UPSTREAM_TIMEOUT` | 上游失败或超时 |

推荐成功但没有候选时返回 `200` 与空数组，上游异常不再伪装成成功空列表，客户端应结合 HTTP 状态与 `code` 处理错误

</details>

## 音质

以下会员档位是本服务选择账号的规则，实际能否播放还取决于曲目资源、账号权益与平台风控

| 常用参数 | 网易云 | QQ | 汽水 | 酷狗 |
|:---|:---|:---|:---|:---|
| `standard` | 标准 | 标准品质 | 标准 | 标准 |
| `exhigh` | 极高 · VIP | HQ高品质 · VIP | 极高 · VIP | 极高 · VIP |
| `lossless` | 无损 · VIP | SQ无损品质 · VIP | 无损 · SVIP | 无损 · VIP |

同义参数：`128` = `standard`，`320` = `exhigh`，`flac` = `lossless`

标准档位本身不要求会员，但公共播放账号池仍仅选择有会员权益的账号，平台返回较低档位时以响应中的 `quality` 为准，参数不受支持时返回 `400`

<details>
<summary>平台专属音质</summary>

不同平台的同名参数可能代表不同音质，各独立档位不能互当别名

| 平台 | 参数 | 音质 | 账号要求 |
|:---|:---|:---|:---|
| 网易云 | `higher` | 较高 | 无额外会员要求 |
| 网易云 | `hires` | 高解析度无损 | VIP |
| 网易云 | `jyeffect` | 高清臻音 | VIP |
| 网易云 | `sky` | 沉浸环绕声 | SVIP |
| 网易云 | `jymaster` | 超清母带 | SVIP |
| 网易云 | `dolby` | 杜比全景声 | SVIP |
| QQ | `atmos` | 臻品全景声 | 超级会员 |
| QQ | `master` | 臻品母带 | 超级会员 |
| 汽水 | `atmos` | 全景声 | SVIP |
| 汽水 | `studio` | 录音室音质 | SVIP |
| 酷狗 | `hires` | Hi-Res音质 | VIP |
| 酷狗 | `atmos` / `viper_atmos` | 蝰蛇全景声2.0，两者同义 | SVIP |
| 酷狗 | `master` | 母带 | SVIP |
| 酷狗 | `viper_tape` | 蝰蛇母带音质 | SVIP |
| 酷狗 | `viper_clear` | 蝰蛇超清音质 | SVIP |
| 酷狗 | `viper_hifi` | 蝰蛇HiFi音质 | SVIP |
| 酷狗 | `acappella` | 人声伴奏 | SVIP |
| 酷狗 | `multitrack` | 多轨音质 | SVIP |

QQ 超级会员在内部按 `SVIP` 选择账号，酷狗 `master` 与 `viper_tape` 是不同请求档位

只有 `standard` / `128`、`exhigh` / `320`、`lossless` / `flac` 四个平台均支持，`higher` 仅网易云支持，蝰蛇档位仅酷狗支持

</details>

## 管理与配置

后台提供 Cookie 管理与四平台扫码登录、会员权益验证、FM 优先账号、QQ 自动续期、定时监测与 Webhook、API Token、2FA、多用户、接口日志和每日备份

| 配置 | 默认值 | 用途 |
|:---|:---|:---|
| `PORT` | `3000` | 服务端口 |
| `DATA_DIR` | `./data` | Node.js 数据目录，Cookie、配置、日志与备份持久化位置 |
| `ADMIN_PATH` | `admin` | 初始后台页面路径，已保存的后台路径优先 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `admin` / `admin123` | 初始管理员账号 |
| `QISHUI_SIGNER_URL` | 未配置 | 汽水远程签名服务地址，后台保存值优先 |
| `LOUDNESS_SERVICE_URL` | 未配置 | 响度分析辅助服务地址，后台保存值优先 |

汽水取链需要有效登录 Cookie 和远程签名服务，后台可配置签名服务地址，仅添加 Cookie 不足以获取播放地址

<details>
<summary>Cookie、日志与备份</summary>

| 平台 | 配置建议 |
|:---|:---|
| 网易云 | 后台扫码登录，或复制完整 Cookie |
| QQ | 后台扫码登录，或至少提供 `uin` + `qqmusic_key`，包含 `psrf_qqrefresh_token` 可用于自动续期 |
| 汽水 | 后台扫码登录，保留 `sessionid` 等登录字段，过期后重新扫码 |
| 酷狗 | 推荐后台扫码登录，手动添加需同时提供 `token` 与 `userid` |

后台接口日志记录失败分类、错误码和账号切换，重复错误会去重，QQ FM 额外记录选账号、尝试、切换与结果，方便定位推荐失败

Node.js 每日备份默认开启，可在后台设置中关闭，备份保存在 `DATA_DIR/backups/YYYY-MM-DD`，按服务进程本地时区在每日零点后执行，新备份成功后仅保留当日目录

备份包含 Cookie、配置、用户、Token、日志和 Cookie 加密密钥，恢复时保留完整数据目录

管理员会话调用管理 API 时使用以下认证头，API Token 的程序化调用规则另见 [服务端授权](docs/OPENMUSIC_AUTH.md)

```http
X-Auth-Username: <username>
X-Auth-Token: <session-token>
```

</details>

<details>
<summary>响度辅助服务</summary>

可选接入 [OpenMusic-Meting-Api-Audio-Loudness](https://github.com/qq01-hub/OpenMusic-Meting-Api-Audio-Loudness)，在后台监测设置或环境变量中配置完整分析地址，例如 `http://localhost:3100/analyze`

配置后，`type=url` 的 JSON 响应使用标准音质音源分析响度，播放 URL 和实际音质保持原请求结果，辅助服务不可用时保留平台响度数据，`redirect=1` 不触发辅助分析

酷狗将平台 `volume` 映射为 `gain`、`volume_peak` 映射为 `peak`，无可用响度信息时返回 `loudness: null`

容器部署时，`localhost` 指向当前容器，同一 Docker 网络可使用 `http://meting-api-audio-loudness:3100/analyze`

</details>

<details>
<summary>常见问题</summary>

- **高音质被降级**：先检查后台账号权益和曲目档位，再查看响应中的实际 `quality`，有会员不代表每首歌都有所有音质
- **公共播放返回 503**：确认平台存在已启用、有效且满足目标档位的会员账号，仅有非会员或未知权益账号不会尝试公共取链
- **QQ 要求验证**：在后台处理官方验证或更新 Cookie，冷却中的账号会暂时跳过，其他账号仍可参与播放
- **汽水无法取链**：同时检查登录态与远程签名配置，音频代理也需要 API Token 和相应签名授权
- **Cookie 无法续期**：QQ 续期依赖有效刷新凭据，续期失败或其他平台登录过期时重新扫码，不假定统一有效期
- **忘记后台路径**：查看 `DATA_DIR/config.json` 中的 `adminPath`，已有保存值优先于 `ADMIN_PATH`

</details>

项目声明 MIT 许可，内置 Folia QRC 派生文件遵循其 AGPL-3.0 许可，详见 [Folia 说明](src/vendor/folia/NOTICE.md)
