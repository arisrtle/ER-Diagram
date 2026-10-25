<template>
  <div>
    <section class="panel">
      <div class="panel-head row-between">
        <div>
          <h2>课程</h2>
          <p>维护课程编号和名称；课程下面再建教学班。</p>
        </div>
        <el-button type="primary" @click="openCourse()">新增课程</el-button>
      </div>

      <el-table v-loading="loading" :data="courses" empty-text="还没有课程">
        <el-table-column prop="course_code" label="课程编号" width="140" />
        <el-table-column prop="course_name" label="课程名称" min-width="180" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'" effect="light">
              {{ row.status === 'active' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="section_count" label="教学班数" width="110" />
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button link type="primary" @click="openCourse(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <section class="panel" style="margin-top: 22px">
      <div class="panel-head row-between">
        <div>
          <h2>教学班</h2>
          <p>一个教学班对应一个任课教师，学生通过教学班参加签到。</p>
        </div>
        <el-button type="primary" @click="openSection()">新增教学班</el-button>
      </div>

      <el-table v-loading="loading" :data="sections" empty-text="还没有教学班">
        <el-table-column prop="course_name" label="课程" min-width="150" />
        <el-table-column prop="section_code" label="教学班编号" width="150" />
        <el-table-column prop="section_name" label="教学班名称" width="130" />
        <el-table-column prop="teacher_name" label="任课教师" width="120">
          <template #default="{ row }">{{ row.teacher_name || '未分配' }}</template>
        </el-table-column>
        <el-table-column prop="student_count" label="学生数" width="90" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'" effect="light">
              {{ row.status === 'active' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button link type="primary" @click="openSection(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-dialog
      v-model="courseDialog"
      :title="courseEditing ? '编辑课程' : '新增课程'"
      width="460px"
    >
      <el-form :model="courseForm" label-position="top">
        <el-form-item label="课程编号">
          <el-input v-model="courseForm.course_code" placeholder="例如 AC101" />
        </el-form-item>
        <el-form-item label="课程名称">
          <el-input v-model="courseForm.course_name" placeholder="例如 自动控制原理" />
        </el-form-item>
        <el-form-item v-if="courseEditing" label="状态">
          <el-select v-model="courseForm.status" style="width: 100%">
            <el-option label="启用" value="active" />
            <el-option label="停用" value="disabled" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="courseDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveCourse">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="sectionDialog"
      :title="sectionEditing ? '编辑教学班' : '新增教学班'"
      width="460px"
    >
      <el-form :model="sectionForm" label-position="top">
        <el-form-item label="所属课程">
          <el-select
            v-model="sectionForm.course_id"
            :disabled="sectionEditing"
            style="width: 100%"
            placeholder="选择课程"
          >
            <el-option
              v-for="course in courses"
              :key="course.id"
              :label="`${course.course_code} · ${course.course_name}`"
              :value="course.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="教学班编号">
          <el-input v-model="sectionForm.section_code" placeholder="例如 AC101-01" />
        </el-form-item>
        <el-form-item label="教学班名称">
          <el-input v-model="sectionForm.section_name" placeholder="例如 1班" />
        </el-form-item>
        <el-form-item label="任课教师">
          <el-select
            v-model="sectionForm.teacher_id"
            clearable
            style="width: 100%"
            placeholder="暂不分配"
          >
            <el-option
              v-for="teacher in teachers"
              :key="teacher.id"
              :label="teacher.name"
              :value="teacher.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="sectionEditing" label="状态">
          <el-select v-model="sectionForm.status" style="width: 100%">
            <el-option label="启用" value="active" />
            <el-option label="停用" value="disabled" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="sectionDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveSection">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { admin } from '../api'

const courses = ref([])
const sections = ref([])
const teachers = ref([])
const loading = ref(false)
const saving = ref(false)

const courseDialog = ref(false)
const courseEditing = ref(false)
const courseForm = reactive({
  id: null,
  course_code: '',
  course_name: '',
  status: 'active'
})

const sectionDialog = ref(false)
const sectionEditing = ref(false)
const sectionForm = reactive({
  id: null,
  course_id: null,
  section_code: '',
  section_name: '',
  teacher_id: null,
  status: 'active'
})

onMounted(loadAll)

async function loadAll() {
  loading.value = true
  try {
    const [courseList, sectionList, teacherList] = await Promise.all([
      admin.listCourses(),
      admin.listSections(),
      admin.listTeachers()
    ])
    courses.value = courseList
    sections.value = sectionList
    teachers.value = teacherList
  } catch (error) {
    ElMessage.error(error.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function openCourse(row = null) {
  courseEditing.value = !!row
  courseForm.id = row?.id || null
  courseForm.course_code = row?.course_code || ''
  courseForm.course_name = row?.course_name || ''
  courseForm.status = row?.status || 'active'
  courseDialog.value = true
}

async function saveCourse() {
  if (!courseForm.course_code.trim() || !courseForm.course_name.trim()) {
    ElMessage.warning('请填写课程编号和名称')
    return
  }
  saving.value = true
  try {
    if (courseEditing.value) {
      await admin.updateCourse(courseForm.id, {
        course_code: courseForm.course_code.trim(),
        course_name: courseForm.course_name.trim(),
        status: courseForm.status
      })
    } else {
      await admin.createCourse({
        course_code: courseForm.course_code.trim(),
        course_name: courseForm.course_name.trim()
      })
    }
    ElMessage.success('课程已保存')
    courseDialog.value = false
    await loadAll()
  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    saving.value = false
  }
}

function openSection(row = null) {
  sectionEditing.value = !!row
  sectionForm.id = row?.id || null
  sectionForm.course_id = row?.course_id || courses.value[0]?.id || null
  sectionForm.section_code = row?.section_code || ''
  sectionForm.section_name = row?.section_name || ''
  sectionForm.teacher_id = row?.teacher_id || null
  sectionForm.status = row?.status || 'active'
  sectionDialog.value = true
}

async function saveSection() {
  if (!sectionForm.course_id || !sectionForm.section_code.trim() || !sectionForm.section_name.trim()) {
    ElMessage.warning('请填写所属课程、教学班编号和名称')
    return
  }
  saving.value = true
  try {
    const payload = {
      section_code: sectionForm.section_code.trim(),
      section_name: sectionForm.section_name.trim(),
      teacher_id: sectionForm.teacher_id || null
    }
    if (sectionEditing.value) {
      await admin.updateSection(sectionForm.id, {
        ...payload,
        status: sectionForm.status
      })
    } else {
      await admin.createSection({
        ...payload,
        course_id: sectionForm.course_id
      })
    }
    ElMessage.success('教学班已保存')
    sectionDialog.value = false
    await loadAll()
  } catch (error) {
    ElMessage.error(error.message || '保存失败')
  } finally {
    saving.value = false
  }
}
</script>
