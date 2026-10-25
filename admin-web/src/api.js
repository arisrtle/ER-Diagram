const BASE_URL = import.meta.env.VITE_API_BASE || ''

function getToken() {
  return localStorage.getItem('admin_token') || ''
}

async function request(path, options = {}) {
  const token = getToken()
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  })

  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!res.ok) {
    const detail = data && data.detail
    const message =
      (data && data.message) ||
      (detail && detail.message) ||
      (typeof detail === 'string' ? detail : '请求失败')
    const error = new Error(message)
    error.status = res.status
    error.data = data
    throw error
  }
  return data
}

export const auth = {
  login(phone, password) {
    return request('/api/auth/teacher-login', {
      method: 'POST',
      body: JSON.stringify({ phone, password })
    })
  },
  me() {
    return request('/api/admin/me')
  }
}

export const admin = {
  listSessions() {
    return request('/api/admin/class-sessions')
  },
  createSession(payload) {
    return request('/api/admin/class-sessions', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  },
  open(sessionId) {
    return request(`/api/admin/class-sessions/${sessionId}/open`, { method: 'POST' })
  },
  close(sessionId) {
    return request(`/api/admin/class-sessions/${sessionId}/close`, { method: 'POST' })
  },
  updatePoint(sessionId, payload) {
    return request(`/api/admin/class-sessions/${sessionId}/point`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    })
  },
  checkins(sessionId) {
    return request(`/api/admin/class-sessions/${sessionId}/checkins`)
  },
  updateCheckin(checkinId, payload) {
    return request(`/api/admin/checkins/${checkinId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    })
  },
  async exportCheckins(sessionId) {
    const token = getToken()
    const res = await fetch(
      `${BASE_URL}/api/admin/class-sessions/${sessionId}/checkins/export`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    )
    if (!res.ok) {
      throw new Error('导出失败')
    }
    return res.blob()
  },
  listCourses() {
    return request('/api/admin/courses')
  },
  createCourse(payload) {
    return request('/api/admin/courses', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  },
  updateCourse(courseId, payload) {
    return request(`/api/admin/courses/${courseId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    })
  },
  listSections(courseId) {
    const query = courseId ? `?course_id=${courseId}` : ''
    return request(`/api/admin/sections${query}`)
  },
  createSection(payload) {
    return request('/api/admin/sections', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  },
  updateSection(sectionId, payload) {
    return request(`/api/admin/sections/${sectionId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    })
  },
  listTeachers() {
    return request('/api/admin/teachers')
  },
  listStudents(keyword) {
    const query = keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''
    return request(`/api/admin/students${query}`)
  },
  createStudent(payload) {
    return request('/api/admin/students', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  },
  updateStudent(studentId, payload) {
    return request(`/api/admin/students/${studentId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    })
  },
  assignStudent(studentId, payload) {
    return request(`/api/admin/students/${studentId}/assignments`, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  },
  importStudents(file) {
    const form = new FormData()
    form.append('file', file)
    return request('/api/admin/students/import', {
      method: 'POST',
      body: form
    })
  }
}
