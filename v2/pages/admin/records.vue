<template>
  <admin-shell
    title="签到记录"
    :subtitle="isTeacher ? '仅显示你授课课程的记录' : '支持筛选与导出 Excel'"
    active="records"
  >
    <view class="stats">
      <view class="stat">
        <text class="stat-label">筛选结果</text>
        <text class="stat-num">{{ stats.total }}</text>
      </view>
      <view class="stat">
        <text class="stat-label">今日签到</text>
        <text class="stat-num">{{ stats.today }}</text>
      </view>
      <view class="stat">
        <text class="stat-label">涉及学生</text>
        <text class="stat-num">{{ stats.students }}</text>
      </view>
    </view>

    <view class="filters">
      <picker mode="selector" :range="courseNames" :value="courseIndex" @change="onCourseChange">
        <view class="filter-picker">
          <text class="filter-text">{{ courseNames[courseIndex] }}</text>
          <text class="filter-arrow">▾</text>
        </view>
      </picker>

      <picker mode="date" :value="dateFrom" @change="(e) => { dateFrom = e.detail.value; load() }">
        <view class="filter-picker">
          <text class="filter-text" :class="{ ph: !dateFrom }">{{ dateFrom || '开始日期' }}</text>
        </view>
      </picker>

      <text class="dash">—</text>

      <picker mode="date" :value="dateTo" @change="(e) => { dateTo = e.detail.value; load() }">
        <view class="filter-picker">
          <text class="filter-text" :class="{ ph: !dateTo }">{{ dateTo || '结束日期' }}</text>
        </view>
      </picker>

      <view class="search">
        <input
          class="search-input"
          v-model="keyword"
          placeholder="姓名 / 学号 / 课程"
          placeholder-class="ph"
          confirm-type="search"
          @confirm="load"
        />
      </view>

      <view class="btn-ghost" @click="load"><text class="btn-ghost-text">查询</text></view>
      <view class="btn-ghost" @click="reset"><text class="btn-ghost-text">重置</text></view>
      <view class="btn-primary" :class="{ disabled: exporting }" @click="exportExcel">
        <text class="btn-primary-text">{{ exporting ? '生成中…' : '导出 Excel' }}</text>
      </view>
    </view>

    <view class="table-wrap">
      <view class="table">
        <view class="tr th">
          <text class="td c-name">姓名</text>
          <text class="td c-account">学号</text>
          <text class="td c-class">班级</text>
          <text class="td c-course">课程</text>
          <text class="td c-date">上课日期</text>
          <text class="td c-time">签到时间</text>
          <text class="td c-dist">距离</text>
          <text class="td c-ops">操作</text>
        </view>

        <view class="tr" v-for="r in list" :key="r._id">
          <text class="td c-name strong">{{ r.userName }}</text>
          <text class="td c-account">{{ r.account }}</text>
          <text class="td c-class">{{ r.className }}</text>
          <text class="td c-course">{{ r.courseName }}</text>
          <text class="td c-date">{{ r.sessionDate }}</text>
          <text class="td c-time">{{ r.signTimeText }}</text>
          <text class="td c-dist">{{ Math.round(r.distance) }} 米</text>
          <view class="td c-ops">
            <text class="op danger" v-if="!isTeacher" @click="remove(r)">删除</text>
            <text class="op muted" v-else>—</text>
          </view>
        </view>

        <view class="empty" v-if="!list.length">
          <text class="empty-text">{{ loading ? '加载中…' : '没有符合条件的记录' }}</text>
        </view>
      </view>
    </view>

    <view class="pager" v-if="total > pageSize">
      <text class="pager-btn" :class="{ disabled: page <= 1 }" @click="prev">上一页</text>
      <text class="pager-info">{{ page }} / {{ pages }}</text>
      <text class="pager-btn" :class="{ disabled: page >= pages }" @click="next">下一页</text>
    </view>
  </admin-shell>
</template>

<script>
import AdminShell from '../../components/AdminShell.vue'
import { api } from '../../common/request'
import { requireLogin, getUser } from '../../common/session'

export default {
  components: { AdminShell },

  data() {
    return {
      loading: true,
      exporting: false,
      isTeacher: false,
      list: [],
      total: 0,
      page: 1,
      pageSize: 20,
      stats: { total: 0, today: 0, students: 0 },
      courses: [],
      courseId: '',
      dateFrom: '',
      dateTo: '',
      keyword: ''
    }
  },

  computed: {
    courseNames() {
      return ['全部课程'].concat(this.courses.map((c) => c.name))
    },
    courseIndex() {
      if (!this.courseId) return 0
      const i = this.courses.findIndex((c) => c._id === this.courseId)
      return i >= 0 ? i + 1 : 0
    },
    pages() {
      return Math.max(1, Math.ceil(this.total / this.pageSize))
    }
  },

  onShow() {
    if (!requireLogin()) return
    const user = getUser() || {}
    if (user.role === 'student') {
      uni.reLaunch({ url: '/pages/signin/signin' })
      return
    }
    this.isTeacher = user.role === 'teacher'
    this.loadCourses()
    this.load()
  },

  methods: {
    async loadCourses() {
      try {
        this.courses = (await api.courseList('all')) || []
      } catch (e) {
        this.courses = []
      }
    },

    params() {
      return {
        courseId: this.courseId,
        dateFrom: this.dateFrom,
        dateTo: this.dateTo,
        keyword: this.keyword.trim(),
        page: this.page,
        pageSize: this.pageSize
      }
    },

    async load() {
      this.loading = true
      try {
        const res = await api.recordList(this.params())
        this.list = res.list || []
        this.total = res.total || 0
        this.stats = res.stats || { total: 0, today: 0, students: 0 }
      } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' })
      } finally {
        this.loading = false
      }
    },

    onCourseChange(e) {
      const i = Number(e.detail.value)
      this.courseId = i === 0 ? '' : this.courses[i - 1]._id
      this.page = 1
      this.load()
    },

    reset() {
      this.courseId = ''
      this.dateFrom = ''
      this.dateTo = ''
      this.keyword = ''
      this.page = 1
      this.load()
    },

    prev() {
      if (this.page <= 1) return
      this.page--
      this.load()
    },

    next() {
      if (this.page >= this.pages) return
      this.page++
      this.load()
    },

    remove(r) {
      uni.showModal({
        title: '删除签到记录',
        content: `确认删除「${r.userName}」在「${r.courseName}」${r.sessionDate} 的签到记录？\n\n删除后该学生本节课可以重新签到。`,
        confirmColor: '#f04438',
        success: async (res) => {
          if (!res.confirm) return
          try {
            await api.recordRemove(r._id)
            uni.showToast({ title: '已删除', icon: 'success' })
            this.load()
          } catch (e) {
            uni.showToast({ title: e.message || '删除失败', icon: 'none' })
          }
        }
      })
    },

    async exportExcel() {
      if (this.exporting) return
      this.exporting = true
      try {
        const res = await api.recordExport({
          courseId: this.courseId,
          dateFrom: this.dateFrom,
          dateTo: this.dateTo,
          keyword: this.keyword.trim()
        })
        if (!res.count) {
          uni.showToast({ title: '没有可导出的记录', icon: 'none' })
          return
        }
        await this.openFile(res.fileID)
      } catch (e) {
        uni.showModal({
          title: '导出失败',
          content: e.message || '请确认 api 云函数已上传并安装依赖',
          showCancel: false
        })
      } finally {
        this.exporting = false
      }
    },

    async openFile(fileID) {
      const res = await uniCloud.getTempFileURL({ fileList: [fileID] })
      const file = res.fileList && res.fileList[0]
      const url = file && file.tempFileURL
      if (!url) throw new Error('获取下载地址失败')

      // #ifdef H5
      window.open(url, '_blank')
      // #endif

      // #ifndef H5
      uni.downloadFile({
        url,
        success: (r) => {
          uni.openDocument({ filePath: r.tempFilePath, fileType: 'xlsx', showMenu: true })
        }
      })
      // #endif
    }
  }
}
</script>

<style scoped>
.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 14px;
}

.stat {
  background: #fff;
  border-radius: 14px;
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.04);
}

.stat-label {
  font-size: 11px;
  color: #94a3b8;
}

.stat-num {
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
}

.filters {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.filter-picker {
  height: 34px;
  min-width: 96px;
  background: #fff;
  border: 1px solid #e8edf5;
  border-radius: 9px;
  padding: 0 11px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  cursor: pointer;
}

.filter-text {
  font-size: 12px;
  color: #0f172a;
}

.filter-text.ph {
  color: #b6c0cf;
}

.filter-arrow {
  font-size: 9px;
  color: #94a3b8;
}

.dash {
  font-size: 12px;
  color: #cbd5e1;
}

.search {
  flex: 1;
  min-width: 160px;
  height: 34px;
  background: #fff;
  border: 1px solid #e8edf5;
  border-radius: 9px;
  padding: 0 11px;
  display: flex;
  align-items: center;
}

.search-input {
  flex: 1;
  font-size: 12px;
  color: #0f172a;
  height: 32px;
}

.ph {
  color: #b6c0cf;
  font-size: 12px;
}

.btn-primary {
  height: 34px;
  padding: 0 14px;
  border-radius: 9px;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  display: flex;
  align-items: center;
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.18);
  cursor: pointer;
}

.btn-primary.disabled {
  opacity: 0.6;
}

.btn-primary-text {
  font-size: 12px;
  color: #fff;
}

.btn-ghost {
  height: 34px;
  padding: 0 14px;
  border-radius: 9px;
  background: #fff;
  border: 1px solid #e8edf5;
  display: flex;
  align-items: center;
  cursor: pointer;
}

.btn-ghost-text {
  font-size: 12px;
  color: #475569;
}

.table-wrap {
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.04);
  overflow-x: auto;
}

.table {
  min-width: 900px;
}

.tr {
  display: grid;
  grid-template-columns: 0.8fr 1.1fr 1.7fr 1.3fr 1fr 1.3fr 0.7fr 0.6fr;
  align-items: center;
  padding: 0 18px;
  border-bottom: 1px solid #f4f7fb;
}

.tr:last-child {
  border-bottom: none;
}

.tr.th {
  height: 42px;
  background: #fbfcfe;
}

.tr:not(.th) {
  height: 52px;
}

.tr:not(.th):hover {
  background: #fafcff;
}

.td {
  font-size: 12px;
  color: #475569;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.th .td {
  font-size: 11.5px;
  color: #94a3b8;
}

.strong {
  color: #0f172a;
  font-weight: 500;
}

.op {
  font-size: 12px;
  cursor: pointer;
}

.op.danger {
  color: #f04438;
}

.op.muted {
  color: #cbd5e1;
}

.empty {
  padding: 46px 0;
  text-align: center;
}

.empty-text {
  font-size: 12px;
  color: #cbd5e1;
}

.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin-top: 16px;
}

.pager-btn {
  font-size: 12px;
  color: #2563eb;
  cursor: pointer;
}

.pager-btn.disabled {
  color: #cbd5e1;
}

.pager-info {
  font-size: 11.5px;
  color: #94a3b8;
}

@media (max-width: 700px) {
  .stats {
    grid-template-columns: 1fr;
  }
}
</style>
