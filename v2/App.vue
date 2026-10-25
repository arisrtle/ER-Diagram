<script>
/**
 * 应用根组件
 *
 * 全局样式集中在这里，用 CSS 变量做设计令牌（不使用 SCSS，避免要求安装 sass 插件）。
 * 页面里只写局部样式，保证换主题时改一处即可。
 */
export default {
  onLaunch() {
    console.log('[课程签到] 启动')
  },
  onShow() {},
  onHide() {}
}
</script>

<style>
/* ============ 设计令牌 ============ */
page,
:root {
  --c-bg: #f5f7fb;
  --c-card: #ffffff;
  --c-text: #0f172a;
  --c-text-2: #64748b;
  --c-text-3: #94a3b8;
  --c-line: #e8edf5;
  --c-primary: #2563eb;
  --c-primary-2: #1d4ed8;
  --c-primary-soft: #eaf1ff;
  --c-success: #12b76a;
  --c-success-soft: #e8f8f0;
  --c-warn: #f79009;
  --c-warn-soft: #fff5e6;
  --c-danger: #f04438;
  --c-danger-soft: #fdeceb;
  --shadow-card: 0 8px 28px rgba(15, 23, 42, 0.06);
  --shadow-float: 0 18px 40px rgba(37, 99, 235, 0.28);
  --radius: 24rpx;
}

/* ============ 基础重置 ============ */
view,
text,
button,
input,
scroll-view {
  box-sizing: border-box;
}

page {
  background: var(--c-bg);
  color: var(--c-text);
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif;
  font-size: 28rpx;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

/* H5 端去掉 uni 默认的按钮样式干扰 */
button::after {
  border: none;
}

/* ============ 通用工具类 ============ */
.row {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.row-between {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.col {
  display: flex;
  flex-direction: column;
}

.flex-1 {
  flex: 1;
  min-width: 0;
}

.ellipsis {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.card {
  background: var(--c-card);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}

.muted {
  color: var(--c-text-2);
}

.tiny {
  font-size: 24rpx;
  color: var(--c-text-3);
}

/* ============ 标签 ============ */
.tag {
  display: inline-flex;
  align-items: center;
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  line-height: 1.6;
}

.tag-primary {
  background: var(--c-primary-soft);
  color: var(--c-primary);
}

.tag-success {
  background: var(--c-success-soft);
  color: var(--c-success);
}

.tag-warn {
  background: var(--c-warn-soft);
  color: var(--c-warn);
}

.tag-danger {
  background: var(--c-danger-soft);
  color: var(--c-danger);
}

.tag-gray {
  background: #f1f5f9;
  color: var(--c-text-2);
}
</style>
