<template>
  <admin-shell
    title="课程信息维护"
    subtitle="一门课程只对应一个签到点位，结构上不支持多点位"
    active="courses"
  >
    <view class="toolbar">
      <view class="search">
        <text class="search-icon">⌕</text>
        <input
          class="search-input"
          v-model="keyword"
          placeholder="搜索课程名称或授课教师"
          placeholder-class="ph"
        />
      </view>
      <view class="btn-primary" @click="openCreate">
        <text class="btn-primary-text">+ 新增课程</text>
      </view>
    </view>

    <view class="table-wrap">
      <view class="table">
        <view class="tr th">
          <text class="td c-name">课程名称</text>
          <text class="td c-teacher">授课教师</text>
          <text class="td c-time">上课时间</text>
          <text class="td c-place">签到点位</text>
          <text class="td c-radius">阈值</text>
          <text class="td c-status">状态</text>
          <text class="td c-ops">操作</text>
        </view>

        <view class="tr" v-for="c in filtered" :key="c._id">
          <view class="td c-name">
            <text class="name-text">{{ c.name }}</text>
          </view>
          <text class="td c-teacher">{{ c.teacherName || '未分配' }}</text>
          <view class="td c-time">
            <text class="time-text">{{ weekdayText(c.weekday) }} {{ c.startTime }}–{{ c.endTime }}</text>
          </view>
          <view class="td c-place">
            <text class="place-text">{{ c.locationName || '未设置' }}</text>
            <text class="place-sub">{{ Number(c.latitude).toFixed(5) }}, {{ Number(c.longitude).toFixed(5) }}</text>
          </view>
          <text class="td c-radius">{{ c.radius }} 米</text>
          <view class="td c-status">
            <view class="status" :class="c.status === 1 ? 'on' : 'off'">
              <text class="status-text" :class="c.status === 1 ? 'on' : 'off'">
                {{ c.status === 1 ? '启用' : '停用' }}
              </text>
            </view>
          </view>
          <view class="td c-ops">
            <text class="op" @click="openEdit(c)">编辑</text>
            <text class="op danger" @click="remove(c)">删除</text>
          </view>
        </view>

        <view class="empty" v-if="!filtered.length">
          <text class="empty-text">{{ loading ? '加载中…' : '没有匹配的课程' }}</text>
        </view>
      </view>
    </view>

    <!-- 新增 / 编辑弹窗 -->
    <view class="mask" v-if="showForm" @click="closeForm">
      <view class="dialog" @click.stop>
        <view class="dialog-head">
          <text class="dialog-title">{{ form.id ? '编辑课程' : '新增课程' }}</text>
          <text class="dialog-close" @click="closeForm">×</text>
        </view>

        <view class="dialog-body">
          <view class="field">
            <text class="label">课程名称</text>
            <input class="input" v-model="form.name" maxlength="30" placeholder="如：自动控制原理" placeholder-class="ph" />
          </view>

          <view class="row2">
            <view class="field">
              <text class="label">授课教师</text>
              <picker
                mode="selector"
                :range="teacherNames"
                :value="teacherIndex"
                @change="onTeacherChange"
              >
                <view class="picker">
                  <text class="picker-text">{{ teacherNames[teacherIndex] || '请选择教师' }}</text>
                  <text class="picker-arrow">▾</text>
                </view>
              </picker>
            </view>

            <view class="field">
              <text class="label">上课星期</text>
              <picker mode="selector" :range="weekdayNames" :value="form.weekday - 1" @change="onWeekdayChange">
                <view class="picker">
                  <text class="picker-text">{{ weekdayNames[form.weekday - 1] }}</text>
                  <text class="picker-arrow">▾</text>
                </view>
              </picker>
            </view>
          </view>

          <view class="row2">
            <view class="field">
              <text class="label">上课时间</text>
              <picker mode="time" :value="form.startTime" @change="(e) => (form.startTime = e.detail.value)">
                <view class="picker">
                  <text class="picker-text">{{ form.startTime }}</text>
                  <text class="picker-arrow">▾</text>
                </view>
              </picker>
            </view>
            <view class="field">
              <text class="label">下课时间</text>
              <picker mode="time" :value="form.endTime" @change="(e) => (form.endTime = e.detail.value)">
                <view class="picker">
                  <text class="picker-text">{{ form.endTime }}</text>
                  <text class="picker-arrow">▾</text>
                </view>
              </picker>
            </view>
          </view>

          <view class="field">
            <text class="label">签到点位名称</text>
            <input class="input" v-model="form.locationName" maxlength="40" placeholder="如：教二楼 301" placeholder-class="ph" />
          </view>

          <view class="row2">
            <view class="field">
              <text class="label">纬度</text>
              <input class="input" v-model="form.latitude" type="digit" placeholder="34.24695" placeholder-class="ph" />
            </view>
            <view class="field">
              <text class="label">经度</text>
              <input class="input" v-model="form.longitude" type="digit" placeholder="108.98362" placeholder-class="ph" />
            </view>
          </view>

          <view class="row2">
            <view class="field">
              <text class="label">距离阈值（米）</text>
              <input class="input" v-model="form.radius" type="number" placeholder="50" placeholder-class="ph" />
            </view>
            <view class="field">
              <text class="label">状态</text>
              <view class="seg">
                <view class="seg-item" :class="{ on: form.status === 1 }" @click="form.status = 1">启用</view>
                <view class="seg-item" :class="{ on: form.status === 0 }" @click="form.status = 0">停用</view>
              </view>
            </view>
          </view>

          <view class="hint">
            <text class="hint-text">提示：签到窗口为开课前 10 分钟至下课后 10 分钟。阈值建议 50~200 米，室内定位误差较大时可适当放宽。</text>
          </view>
        </view>

        <view class="dialog-foot">
          <view class="btn-ghost" @click="closeForm"><text class="btn-ghost-text">取消</text></view>
          <view class="btn-primary" :class="{ disabled: saving }" @click="save">
            <text class="btn-primary-text">{{ saving ? '保存中…' : '保存' }}</text>
          </view>
        </view>
      </view>
    </view>
  </admin-shell>
</template>

<script>
import AdminShell from '../../components/AdminShell.vue'
import { api } from '../../common/request'
import { requireLogin, getUser } from '../../common/session'
import { weekdayText } from '../../common/format'

const EMPTY_FORM = () => ({
  id: '',
  name: '',
  teacherId: '',
  weekday: 1,
  startTime: '08:00',
  endTime: '09:40',
  locationName: '',
  latitude: '34.24695',
  longitude: '108.98362',
  radius: 50,
  status: 1
})

export default {
  components: { AdminShell },

  data() {
    return {
      loading: true,
      saving: false,
      keyword: '',
      list: [],
      teachers: [],
      showForm: false,
      form: EMPTY_FORM(),
      weekdayNames: ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
    }
  },

  computed: {
    filtered() {
      const k = this.keyword.trim().toLowerCase()
      if (!k) return this.list
      return this.list.filter(
        (c) =>
          (c.name || '').toLowerCase().indexOf(k) >= 0 ||
          (c.teacherName || '').toLowerCase().indexOf(k) >= 0
      )
    },
    teacherNames() {
      return this.teachers.map((t) => `${t.name}（${t.account}）`)
    },
    teacherIndex() {
      const i = this.teachers.findIndex((t) => t._id === this.form.teacherId)
      return i >= 0 ? i : 0
    }
  },

  onShow() {
    if (!requireLogin()) return
    const user = getUser() || {}
    if (user.role !== 'admin') {
      uni.reLaunch({ url: '/pages/admin/records' })
      return
    }
    this.load()
  },

  methods: {
    weekdayText,

    async load() {
      this.loading = true
      try {
        const [courses, teachers] = await Promise.all([api.courseList('all'), api.teacherList()])
        this.list = courses || []
        this.teachers = teachers || []
      } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' })
      } finally {
        this.loading = false
      }
    },

    openCreate() {
      this.form = EMPTY_FORM()
      if (this.teachers.length) this.form.teacherId = this.teachers[0]._id
      this.showForm = true
    },

    openEdit(c) {
      this.form = {
        id: c._id,
        name: c.name,
        teacherId: c.teacherId,
        weekday: c.weekday,
        startTime: c.startTime,
        endTime: c.endTime,
        locationName: c.locationName,
        latitude: String(c.latitude),
        longitude: String(c.longitude),
        radius: c.radius,
        status: c.status
      }
      this.showForm = true
    },

    closeForm() {
      this.showForm = false
    },

    onTeacherChange(e) {
      const t = this.teachers[Number(e.detail.value)]
      if (t) this.form.teacherId = t._id
    },

    onWeekdayChange(e) {
      this.form.weekday = Number(e.detail.value) + 1
    },

    async save() {
      if (this.saving) return
      const f = this.form
      if (!f.name.trim()) return uni.showToast({ title: '请填写课程名称', icon: 'none' })
      if (!f.teacherId) return uni.showToast({ title: '请选择授课教师', icon: 'none' })
      if (!f.latitude || !f.longitude) return uni.showToast({ title: '请填写签到点位坐标', icon: 'none' })

      this.saving = true
      try {
        await api.courseSave({
          id: f.id,
          name: f.name.trim(),
          teacherId: f.teacherId,
          weekday: f.weekday,
          startTime: f.startTime,
          endTime: f.endTime,
          locationName: f.locationName.trim(),
          latitude: Number(f.latitude),
          longitude: Number(f.longitude),
          radius: Number(f.radius),
          status: f.status
        })
        this.showForm = false
        uni.showToast({ title: f.id ? '已更新' : '已创建', icon: 'success' })
        this.load()
      } catch (e) {
        uni.showToast({ title: e.message || '保存失败', icon: 'none' })
      } finally {
        this.saving = false
      }
    },

    remove(c) {
      uni.showModal({
        title: '删除课程',
        content: `确认删除「${c.name}」？\n\n该课程的历史签到记录会保留，不会一起删除。`,
        confirmColor: '#f04438',
        success: async (res) => {
          if (!res.confirm) return
          try {
            const r = await api.courseRemove(c._id)
            uni.showToast({
              title: r.keptRecords ? `已删除，保留 ${r.keptRecords} 条记录` : '已删除',
              icon: 'none'
            })
            this.load()
          } catch (e) {
            uni.showToast({ title: e.message || '删除失败', icon: 'none' })
          }
        }
      })
    }
  }
}
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.search {
  flex: 1;
  max-width: 320px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border: 1px solid #e8edf5;
  border-radius: 10px;
  padding: 0 12px;
  height: 36px;
}

.search-icon {
  font-size: 14px;
  color: #94a3b8;
}

.search-input {
  flex: 1;
  font-size: 12.5px;
  color: #0f172a;
  height: 34px;
}

.ph {
  color: #b6c0cf;
  font-size: 12px;
}

.btn-primary {
  height: 36px;
  padding: 0 16px;
  border-radius: 10px;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.2);
}

.btn-primary.disabled {
  opacity: 0.6;
}

.btn-primary-text {
  font-size: 12.5px;
  color: #fff;
  font-weight: 500;
}

.table-wrap {
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.04);
  overflow-x: auto;
}

.table {
  min-width: 840px;
}

.tr {
  display: grid;
  grid-template-columns: 2fr 0.9fr 1.25fr 1.45fr 0.65fr 0.65fr 1fr;
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
  border-radius: 14px 14px 0 0;
}

.tr:not(.th) {
  height: 60px;
}

.tr:not(.th):hover {
  background: #fafcff;
}

.td {
  font-size: 12.5px;
  color: #475569;
  min-width: 0;
}

.th .td {
  font-size: 11.5px;
  color: #94a3b8;
  font-weight: 500;
}

.name-text {
  font-size: 13px;
  color: #0f172a;
  font-weight: 600;
}

.time-text {
  font-size: 12px;
  color: #475569;
}

.place-text {
  display: block;
  font-size: 12px;
  color: #475569;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.place-sub {
  display: block;
  font-size: 10px;
  color: #b6c0cf;
  margin-top: 2px;
}

.status {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f1f5f9;
}

.status.on {
  background: #e8f8f0;
}

.status-text {
  font-size: 10.5px;
  color: #94a3b8;
}

.status-text.on {
  color: #0f9d58;
}

.c-ops {
  display: flex;
  gap: 12px;
}

.op {
  font-size: 12px;
  color: #2563eb;
  cursor: pointer;
}

.op.danger {
  color: #f04438;
}

.empty {
  padding: 46px 0;
  text-align: center;
}

.empty-text {
  font-size: 12px;
  color: #cbd5e1;
}

/* ---------- 弹窗 ---------- */
.mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.42);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99;
  padding: 20px;
}

.dialog {
  width: 560px;
  max-width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 30px 70px rgba(15, 23, 42, 0.24);
  display: flex;
  flex-direction: column;
}

.dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px 12px;
}

.dialog-title {
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
}

.dialog-close {
  font-size: 20px;
  color: #94a3b8;
  cursor: pointer;
  line-height: 1;
}

.dialog-body {
  padding: 4px 22px 8px;
}

.field {
  margin-bottom: 13px;
  flex: 1;
  min-width: 0;
}

.row2 {
  display: flex;
  gap: 12px;
}

.label {
  display: block;
  font-size: 11.5px;
  color: #64748b;
  margin-bottom: 6px;
}

.input {
  height: 36px;
  background: #f6f8fc;
  border: 1px solid transparent;
  border-radius: 9px;
  padding: 0 11px;
  font-size: 12.5px;
  color: #0f172a;
}

.picker {
  height: 36px;
  background: #f6f8fc;
  border-radius: 9px;
  padding: 0 11px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}

.picker-text {
  font-size: 12.5px;
  color: #0f172a;
}

.picker-arrow {
  font-size: 10px;
  color: #94a3b8;
}

.seg {
  display: flex;
  background: #f6f8fc;
  border-radius: 9px;
  padding: 3px;
  height: 36px;
}

.seg-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #64748b;
  border-radius: 7px;
  cursor: pointer;
}

.seg-item.on {
  background: #fff;
  color: #1d4ed8;
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.08);
}

.hint {
  background: #f7f9fc;
  border-radius: 9px;
  padding: 9px 11px;
}

.hint-text {
  font-size: 10.5px;
  color: #94a3b8;
  line-height: 1.6;
}

.dialog-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 22px 20px;
}

.btn-ghost {
  height: 36px;
  padding: 0 18px;
  border-radius: 10px;
  background: #f1f5f9;
  display: flex;
  align-items: center;
}

.btn-ghost-text {
  font-size: 12.5px;
  color: #475569;
}
</style>
