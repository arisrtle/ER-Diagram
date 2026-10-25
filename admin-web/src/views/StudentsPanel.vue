<template>
  <section class="panel">
    <div class="panel-head row-between">
      <div>
        <h2>学生</h2>
        <p>维护学生名单，把学生分配到教学班。</p>
      </div>
      <div class="toolbar">
        <el-input
          v-model="keyword"
          placeholder="学号 / 姓名 / 班级"
          clearable
          style="width: 220px"
          @keyup.enter="loadStudents"
          @clear="loadStudents"
        />
        <el-button @click="loadStudents">查询</el-button>
        <el-button type="primary" @click="openStudent()">新增学生</el-button>
        <el-upload
          :show-file-list="false"
          :http-request="handleImport"
          accept=".xlsx"
        >
          <el-button>导入 Excel</el-button>
        </el-upload>
      </div>
    </div>

    <p class="table-hint">
      Excel 表头：学号、姓名、班级、课程编号、教学班编号（后两列可选，学号必须 10 位数字）
    </p>

    <el-table v-loading="loading" :data="students" empty-text="还没有学生">
      <el-table-column prop="student_no" label="学号" width="130" />
      <el-table-column prop="name" label="姓名" width="110" />
      <el-table-column prop="class_name" label="班级" min-width="140">
        <template #default="{ row }">{{ row.class_name || '—' }}</template>
      </el-table-column>
      <el-table-column label="教学班" min-width="260">
        <template #default="{ row }">
          <div v-if="row.sections.length" class="section-tags">
            <el-tag
              v-for="section in row.sections"
              :key="section.section_id"
              effect="plain"
              type="info"
            >
              {{ section.course_name }} · {{ section.section_name }}
            </el-tag>
          </div>
          <span v-else class="muted">未分配</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'info'" effect="light">
            {{ row.status === 'active' ? '正常' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="190" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openStudent(row)">编辑</el-button>
          <el-button link @click="openAssign(row)">分配教学班</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="studentDialog"
      :title="studentEditing ? '编辑学生' : '新增学生'"
      width="460px"
    >
      <el-form :model="studentForm" label-position="top">
        <el-form-item label="学号（10 位数字）">
          <el-input
            v-model="studentForm.student_no"
            :disabled="studentEditing"
            maxlength="10"
            placeholder="例如 2023010009"
          />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="studentForm.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="班级">
          <el-input v-model="studentForm.class_name" placeholder="例如 自动化2301" />
        </el-form-item>
        <el-form-item v-if="studentEditing" label="状态">
          <el-select v-model="studentForm.status" style="width: 100%">
            <el-option label="正常" value="active" />
            <el-option label="停用" value="disabled" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="studentDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveStudent">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="assignDialog" title="分配教学班" width="460px">
      <el-form :model="assignForm" label-position="top">
        <el-form-item label="课程">
          <el-select
            v-model="assignForm.course_id"
            style="width: 100%"
            placeholder="选择课程"
            @change="onAssignCourseChange"
          >
            <el-option
              v-for="course in courses"
              :key="course.id"
              :label="`${course.course_code} · ${course.course_name}`"
              :value="course.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="教学班">
          <el-select
            v-model="assignForm.section_id"
            style="width: 100%"
            placeholder="选择教学班"
          >
            <el-option
              v-for="section in assignSections"
              :key="section.id"
              :label="`${section.section_code} · ${section.section_name}`"
              :value="section.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveAssign">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="importDialog" title="导入结果" width="520px">
      <div class="import-result">
        <p>新增学生：{{ importResult.created }}</p>
        <p>更新学生：{{ importResult.updated }}</p>
        <p>新增分配：{{ importResult.assigned }}</p>
        <p>跳过：{{ importResult.skipped }}</p>
      </div>
      <div v-if="importResult.errors.length" class="import-errors">
        <p v-for="(error, index) in importResult.errors" :key="index">{{ error }}</p>
      </div>
      <template #footer>
        <el-button type="primary" @click="importDialog = false">知道了</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { admin } from '../api'

const students = ref([])
const courses = ref([])
const sections = ref([])
const keyword = ref('')
const loading = ref(false)
const saving = ref(false)

const studentDialog = ref(false)
const studentEditing = ref(false)
const studentForm = reactive({
  id: null,
  student_no: '',
  name: '',
  class_name: '',
  status: 'active'
})

const assignDialog = ref(false)
const assignTarget = ref(null)
const assignForm = reactive({ course_id: null, section_id: null })

const importDialog = ref(false)
const importResult = reactive({
  created: 0,
  updated: 0,
  assigned: 0,
  skipped: 0,
  errors: []
})

const assignSections = computed(() =>
  sections.value.filter((section) => section.course_id === assignForm.course_id)
)

onMounted(async () => {
  await loadAll()
})

async function loadAll() {
  loading.value = true
  try {
    const [courseList, sectionList, studentList] = await Promise.all([
      admin.listCourses(),
      admin.listSections(),
      admin.listStudents(keyword.value.trim())
    ])
    courses.value = courseList
    sections.value = sectionList
    students.value = studentList
  } catch (error) {
    ElMessage.error(error.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function loadStudents() {
  loading.value = true
  try {
    students.value = await admin.listStudents(keyword.value.trim())
  } catch (error) {
    ElMessage.error(error.message || '查询失败')
  } finally {
    loading.value = false
  }
}

function openStudent(row = null) {
  studentEditing.value = !!row
  studentForm.id = row?.id || null
  studentForm.student_no = row?.student_no || ''
  studentForm.name = row?.name || ''
  studentForm.class_name = row?.class_name || ''
  studentForm.status = row?.status || 'active'
  studentDialog.value = true
}

async function saveStudent() {
  if (!/^\d{10}$/.test(studentForm.student_no.trim())) {
    ElMessage.warning('学号必须是 10 位数字')
    return
  }
  if (!studentForm.name.trim()) {
    ElMessage.warning('请填写姓名')
    return
  }
  saving.value = true
  try {
    if (studentEditing.value) {
      await admin.updateStudent(studentForm.id, {
        name: studentForm.name.trim(),
        class_name: studentForm.class_name.trim(),
        status: studentForm.status
      })
    } else {
      await admin.createStudent({
        student_no: studentForm.student_no.trim(),
        name: studentForm.name.trim(),
        class_name: studentForm.class_name.trim()
      })
    }
    ElMessage.success('学生已保存')
    studentDialog.value = false
    await loadStudents()
  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    saving.value = false
  }
}

function openAssign(row) {
  assignTarget.value = row
  assignForm.course_id = courses.value[0]?.id || null
  assignForm.section_id = null
  assignDialog.value = true
}

function onAssignCourseChange() {
  assignForm.section_id = null
}

async function saveAssign() {
  if (!assignForm.course_id || !assignForm.section_id) {
    ElMessage.warning('请选择课程和教学班')
    return
  }
  saving.value = true
  try {
    await admin.assignStudent(assignTarget.value.id, {
      course_id: assignForm.course_id,
      section_id: assignForm.section_id
    })
    ElMessage.success('分配成功')
    assignDialog.value = false
    await loadStudents()
  } catch (error) {
    ElMessage.error(error.message || '分配失败')
  } finally {
    saving.value = false
  }
}

async function handleImport(options) {
  const file = options.file
  if (!file.name.endsWith('.xlsx')) {
    ElMessage.warning('请上传 .xlsx 文件')
    options.onError?.(new Error('请上传 .xlsx 文件'))
    return
  }
  try {
    const result = await admin.importStudents(file)
    importResult.created = result.created
    importResult.updated = result.updated
    importResult.assigned = result.assigned
    importResult.skipped = result.skipped
    importResult.errors = result.errors || []
    importDialog.value = true
    options.onSuccess?.(result)
    await loadStudents()
  } catch (error) {
    ElMessage.error(error.message || '导入失败')
    options.onError?.(error)
  }
}
</script>
