<template>
  <div class="admin-shell">
    <header class="topbar">
      <div class="brand-small">
        <div class="brand-icon small">签</div>
        <div>
          <strong>定位签到 · 管理端</strong>
          <span>课程 / 教学班 / 签到</span>
        </div>
      </div>
      <div class="topbar-right">
        <el-tag effect="light" type="info">
          {{ roleLabel }} · {{ user?.name || '—' }}
        </el-tag>
        <el-button :loading="loading" @click="loadSessions">刷新</el-button>
        <el-button @click="$emit('logout')">退出</el-button>
      </div>
    </header>

    <main class="main">
      <el-tabs v-model="activeTab" class="admin-tabs">
        <el-tab-pane label="签到管理" name="sessions" />
        <el-tab-pane label="课程管理" name="courses" />
        <el-tab-pane label="学生管理" name="students" />
      </el-tabs>

      <template v-if="activeTab === 'sessions'">
      <section class="stats">
        <div class="stat-card">
          <span>课程数</span>
          <strong>{{ sessions.length }}</strong>
        </div>
        <div class="stat-card">
          <span>签到中</span>
          <strong>{{ openCount }}</strong>
        </div>
        <div class="stat-card">
          <span>签到总人次</span>
          <strong>{{ totalCheckins }}</strong>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head row-between">
          <div>
            <h2>课程与签到</h2>
            <p>开启签到后，学生端才会出现签到按钮。</p>
          </div>
          <el-button type="primary" @click="openSessionCreate">新增一次课</el-button>
        </div>

        <el-table
          v-loading="loading"
          :data="sessions"
          row-key="id"
          style="width: 100%"
          empty-text="暂无课程"
        >
          <el-table-column label="日期" width="120">
            <template #default="{ row }">{{ row.class_date }}</template>
          </el-table-column>
          <el-table-column label="课程" min-width="160">
            <template #default="{ row }">
              <div class="course-cell">
                <strong>{{ row.course_name }}</strong>
                <span>{{ row.section_name }} · {{ row.section_code }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="时间" width="150">
            <template #default="{ row }">
              {{ row.start_time || '—' }} - {{ row.end_time || '—' }}
            </template>
          </el-table-column>
          <el-table-column prop="classroom" label="教室" width="100" />
          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              <el-tag :type="statusMeta(row.checkin_status).type" effect="light">
                {{ statusMeta(row.checkin_status).label }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="签到人数" width="110">
            <template #default="{ row }">
              {{ row.checkin_count }} / {{ row.total_students }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="300" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="row.checkin_status !== 'open'"
                type="success"
                link
                :disabled="row.class_status !== 'scheduled'"
                @click="openSession(row)"
              >
                开启签到
              </el-button>
              <el-button
                v-else
                type="warning"
                link
                @click="closeSession(row)"
              >
                关闭签到
              </el-button>
              <el-button
                link
                :disabled="row.checkin_status === 'open'"
                @click="openPointDialog(row)"
              >
                设置点位
              </el-button>
              <el-button link type="primary" @click="openRecords(row)">
                查看记录
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </section>
      </template>

      <CoursesPanel v-else-if="activeTab === 'courses'" />
      <StudentsPanel v-else />
    </main>

    <el-dialog v-model="pointVisible" title="设置签到点" width="460px">
      <el-form :model="pointForm" label-position="top">
        <el-form-item label="纬度">
          <el-input-number
            v-model="pointForm.latitude"
            :precision="7"
            :step="0.0000001"
            :min="-90"
            :max="90"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="经度">
          <el-input-number
            v-model="pointForm.longitude"
            :precision="7"
            :step="0.0000001"
            :min="-180"
            :max="180"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="距离阈值（米）">
          <el-input-number
            v-model="pointForm.distance_limit"
            :min="1"
            :max="50000"
            style="width: 100%"
          />
        </el-form-item>
        <el-button size="small" @click="useCurrentLocation">使用我的当前位置</el-button>
      </el-form>
      <template #footer>
        <el-button @click="pointVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingPoint" @click="savePoint">
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="sessionDialog" title="新增一次课" width="520px">
      <el-form :model="sessionForm" label-position="top">
        <el-form-item label="教学班">
          <el-select v-model="sessionForm.section_id" style="width: 100%" placeholder="选择教学班">
            <el-option
              v-for="section in sections"
              :key="section.id"
              :label="`${section.course_name} · ${section.section_name}`"
              :value="section.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="上课日期">
          <el-date-picker
            v-model="sessionForm.class_date"
            type="date"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="节次">
          <div class="period-row">
            <el-input-number v-model="sessionForm.period_start" :min="1" :max="20" />
            <span>至</span>
            <el-input-number v-model="sessionForm.period_end" :min="1" :max="20" />
          </div>
        </el-form-item>
        <el-form-item label="时刻（可留空）">
          <div class="period-row">
            <el-time-picker
              v-model="sessionForm.start_time"
              value-format="HH:mm:ss"
              placeholder="开始"
              style="width: 170px"
            />
            <span>至</span>
            <el-time-picker
              v-model="sessionForm.end_time"
              value-format="HH:mm:ss"
              placeholder="结束"
              style="width: 170px"
            />
          </div>
        </el-form-item>
        <el-form-item label="教室">
          <el-input v-model="sessionForm.classroom" placeholder="例如 A101" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="sessionDialog = false">取消</el-button>
        <el-button type="primary" :loading="savingSession" @click="saveSession">
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="recordsVisible" title="签到记录" width="820px">
      <div class="records-toolbar">
        <div class="records-summary" v-if="currentSession">
          {{ currentSession.course_name }} · {{ currentSession.section_name }}
          · 已签到 {{ validRecordCount }} / {{ currentSession.total_students }}
        </div>
        <el-button size="small" type="primary" @click="exportRecords">
          导出 Excel
        </el-button>
      </div>
      <el-table :data="records" empty-text="还没有学生签到">
        <el-table-column prop="student_no" label="学号" width="130" />
        <el-table-column prop="student_name" label="姓名" width="110" />
        <el-table-column label="签到时间" min-width="170">
          <template #default="{ row }">{{ formatTime(row.checked_in_at) }}</template>
        </el-table-column>
        <el-table-column label="距离（米）" width="110">
          <template #default="{ row }">{{ Math.round(row.distance) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'valid' ? 'success' : 'info'" effect="light">
              {{ row.status === 'valid' ? '有效' : '已删除' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button link type="primary" @click="openCheckinEdit(row)">编辑</el-button>
            <el-button
              v-if="row.status === 'valid'"
              link
              type="danger"
              @click="deleteCheckin(row)"
            >
              删除
            </el-button>
            <el-button v-else link type="success" @click="restoreCheckin(row)">
              恢复
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <p class="records-note">删除是逻辑删除，记录保留；学生不能重复签到。</p>
    </el-dialog>

    <el-dialog v-model="checkinEditVisible" title="编辑签到记录" width="460px">
      <el-form :model="checkinForm" label-position="top">
        <el-form-item label="学号（10 位数字）">
          <el-input v-model="checkinForm.student_no_snapshot" maxlength="10" />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="checkinForm.student_name_snapshot" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="checkinForm.status" style="width: 100%">
            <el-option label="有效" value="valid" />
            <el-option label="已删除" value="deleted" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="checkinEditVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingCheckin" @click="saveCheckin">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { admin } from '../api'
import CoursesPanel from './CoursesPanel.vue'
import StudentsPanel from './StudentsPanel.vue'

const props = defineProps({
  user: { type: Object, default: null }
})
const emit = defineEmits(['logout'])

const allowedTabs = ['sessions', 'courses', 'students']
const initialTab =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('tab')
    : null
const activeTab = ref(allowedTabs.includes(initialTab) ? initialTab : 'sessions')
const sessions = ref([])
const sections = ref([])
const loading = ref(false)
const savingPoint = ref(false)
const pointVisible = ref(false)
const recordsVisible = ref(false)
const pointSession = ref(null)
const currentSession = ref(null)
const records = ref([])
const checkinEditVisible = ref(false)
const savingCheckin = ref(false)
const checkinForm = reactive({
  id: null,
  student_no_snapshot: '',
  student_name_snapshot: '',
  status: 'valid'
})
const pointForm = reactive({
  latitude: 39.9042,
  longitude: 116.4074,
  distance_limit: 50
})
const sessionDialog = ref(false)
const savingSession = ref(false)
const sessionForm = reactive({
  section_id: null,
  class_date: '',
  period_start: 1,
  period_end: 2,
  start_time: '08:00:00',
  end_time: '09:40:00',
  classroom: ''
})
let timer = null

const roleLabel = computed(() => (props.user?.role === 'admin' ? '管理员' : '教师'))
const openCount = computed(
  () => sessions.value.filter((item) => item.checkin_status === 'open').length
)
const totalCheckins = computed(() =>
  sessions.value.reduce((sum, item) => sum + item.checkin_count, 0)
)
const validRecordCount = computed(
  () => records.value.filter((item) => item.status === 'valid').length
)

onMounted(() => {
  loadSessions()
  loadSections()
  timer = setInterval(() => loadSessions(true), 30000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

function statusMeta(status) {
  if (status === 'open') return { label: '签到中', type: 'success' }
  if (status === 'closed') return { label: '已结束', type: 'info' }
  return { label: '未开启', type: 'warning' }
}

function formatTime(value) {
  if (!value) return '—'
  return value.replace('T', ' ').slice(0, 19)
}

async function loadSessions(silent = false) {
  if (!silent) loading.value = true
  try {
    sessions.value = await admin.listSessions()
  } catch (error) {
    if (error.status === 401) {
      emit('logout')
      return
    }
    if (!silent) ElMessage.error(error.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function openSession(row) {
  try {
    await admin.open(row.id)
    ElMessage.success('签到已开启')
    await loadSessions()
  } catch (error) {
    ElMessage.error(error.message || '开启失败')
  }
}

async function closeSession(row) {
  try {
    await admin.close(row.id)
    ElMessage.success('签到已关闭')
    await loadSessions()
  } catch (error) {
    ElMessage.error(error.message || '关闭失败')
  }
}

function openPointDialog(row) {
  pointSession.value = row
  pointForm.latitude = row.latitude ?? 39.9042
  pointForm.longitude = row.longitude ?? 116.4074
  pointForm.distance_limit = row.distance_limit ?? 50
  pointVisible.value = true
}

function useCurrentLocation() {
  if (!navigator.geolocation) {
    ElMessage.warning('当前浏览器不支持定位')
    return
  }
  navigator.geolocation.getCurrentPosition(
    (position) => {
      pointForm.latitude = Number(position.coords.latitude.toFixed(7))
      pointForm.longitude = Number(position.coords.longitude.toFixed(7))
      ElMessage.success('已填入当前位置')
    },
    () => ElMessage.error('获取位置失败，请手动填写')
  )
}

async function savePoint() {
  if (!pointSession.value) return
  savingPoint.value = true
  try {
    await admin.updatePoint(pointSession.value.id, {
      latitude: pointForm.latitude,
      longitude: pointForm.longitude,
      distance_limit: pointForm.distance_limit
    })
    ElMessage.success('签到点已保存')
    pointVisible.value = false
    await loadSessions()
  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    savingPoint.value = false
  }
}

async function openRecords(row) {
  currentSession.value = row
  records.value = []
  recordsVisible.value = true
  try {
    records.value = await admin.checkins(row.id)
  } catch (error) {
    ElMessage.error(error.message || '加载记录失败')
  }
}

async function reloadRecords() {
  if (!currentSession.value) return
  try {
    records.value = await admin.checkins(currentSession.value.id)
    await loadSessions(true)
  } catch (error) {
    ElMessage.error(error.message || '刷新记录失败')
  }
}

function openCheckinEdit(row) {
  checkinForm.id = row.id
  checkinForm.student_no_snapshot = row.student_no
  checkinForm.student_name_snapshot = row.student_name
  checkinForm.status = row.status
  checkinEditVisible.value = true
}

async function saveCheckin() {
  const studentNo = checkinForm.student_no_snapshot.trim()
  if (!/^\d{10}$/.test(studentNo)) {
    ElMessage.warning('学号必须是 10 位数字')
    return
  }
  if (!checkinForm.student_name_snapshot.trim()) {
    ElMessage.warning('姓名不能为空')
    return
  }
  savingCheckin.value = true
  try {
    await admin.updateCheckin(checkinForm.id, {
      student_no_snapshot: studentNo,
      student_name_snapshot: checkinForm.student_name_snapshot.trim(),
      status: checkinForm.status
    })
    ElMessage.success('记录已更新')
    checkinEditVisible.value = false
    await reloadRecords()
  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    savingCheckin.value = false
  }
}

async function deleteCheckin(row) {
  try {
    await ElMessageBox.confirm('确定逻辑删除这条签到记录吗？', '提示', {
      type: 'warning'
    })
    await admin.updateCheckin(row.id, { status: 'deleted' })
    ElMessage.success('已删除')
    await reloadRecords()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

async function restoreCheckin(row) {
  try {
    await admin.updateCheckin(row.id, { status: 'valid' })
    ElMessage.success('已恢复')
    await reloadRecords()
  } catch (error) {
    ElMessage.error(error.message || '恢复失败')
  }
}

async function exportRecords() {
  if (!currentSession.value) return
  try {
    const blob = await admin.exportCheckins(currentSession.value.id)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `checkins_session_${currentSession.value.id}.xlsx`
    link.click()
    URL.revokeObjectURL(url)
    ElMessage.success('已开始下载')
  } catch (error) {
    ElMessage.error(error.message || '导出失败')
  }
}

async function loadSections() {
  try {
    const list = await admin.listSections()
    sections.value =
      props.user?.role === 'teacher'
        ? list.filter((section) => section.teacher_id === props.user.id)
        : list
  } catch (error) {
    ElMessage.error(error.message || '教学班加载失败')
  }
}

function openSessionCreate() {
  const today = new Date()
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  sessionForm.section_id = sections.value[0]?.id || null
  sessionForm.class_date = dateStr
  sessionForm.period_start = 1
  sessionForm.period_end = 2
  sessionForm.start_time = '08:00:00'
  sessionForm.end_time = '09:40:00'
  sessionForm.classroom = ''
  sessionDialog.value = true
}

async function saveSession() {
  if (!sessionForm.section_id) {
    ElMessage.warning('请选择教学班')
    return
  }
  if (!sessionForm.class_date) {
    ElMessage.warning('请选择上课日期')
    return
  }
  if (sessionForm.period_end < sessionForm.period_start) {
    ElMessage.warning('结束节次不能小于开始节次')
    return
  }
  if (
    (sessionForm.start_time && !sessionForm.end_time) ||
    (!sessionForm.start_time && sessionForm.end_time)
  ) {
    ElMessage.warning('开始时刻和结束时刻需要同时填写')
    return
  }
  savingSession.value = true
  try {
    await admin.createSession({
      section_id: sessionForm.section_id,
      class_date: sessionForm.class_date,
      period_start: sessionForm.period_start,
      period_end: sessionForm.period_end,
      start_time: sessionForm.start_time || null,
      end_time: sessionForm.end_time || null,
      classroom: sessionForm.classroom.trim() || null,
      distance_limit: 50
    })
    ElMessage.success('课程已新增')
    sessionDialog.value = false
    await loadSessions()
  } catch (error) {
    ElMessage.error(error.message || '新增失败')
  } finally {
    savingSession.value = false
  }
}
</script>
