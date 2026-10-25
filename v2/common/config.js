/**
 * 全局配置
 *
 * spaceId 是 uniCloud 阿里云服务空间的 ID，记录在这里便于核对。
 * 实际连接靠 HBuilderX：右键 uniCloud-aliyun → 关联云服务空间，
 * 编译时会把 spaceId / clientSecret 注入运行时，不需要写进代码。
 * （阿里云版手动 uniCloud.init 必须带 clientSecret，而 clientSecret 不应进仓库。）
 */

export const APP = {
  name: '课程签到',
  school: '西安交通大学',
  version: '2.0.0'
}

export const CLOUD = {
  fn: 'api',
  provider: 'aliyun',
  spaceId: 'mp-11c80251-c4a0-4219-9d53-bd141517b104'
}

/** 签到时间窗（与云函数 lib/time.js 保持一致） */
export const SIGN = {
  openBefore: 10,
  closeAfter: 10
}

/** 演示账号（seed 生成，密码统一 123456） */
export const DEMO_ACCOUNTS = [
  { label: '学生', account: '20230101001', password: '123456', desc: '李小明' },
  { label: '教师', account: 'T1001', password: '123456', desc: '张伟' },
  { label: '管理员', account: 'admin', password: '123456', desc: '王敏' }
]

/** 云端不可用时是否降级为离线演示模式 */
export const MOCK_ENABLED = true

export const WEEKDAYS = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']
