-- ============================================================
-- 微信小程序 / uni-app 定位签到系统 数据库设计（6 表版）
-- SQL 方言：MySQL 8.0
--
-- 表结构：
--   主表：users、courses、course_sections、class_sessions、checkins
--   中间表：student_section_assignments
--
-- 设计原则：
--   1. 学生、教师、管理员统一在 users，用 role 区分；
--   2. 课程 courses → 教学班 course_sections → 一次课 class_sessions
--      逐层表达“多教学班、多老师、多时段、不同教室”；
--   3. class_sessions 同时保存一次课的上课安排和签到规则，
--      不再单独建 attendance_sessions，避免 1:1 的重复表；
--   4. 签到点由管理员/教师在每次课上设置，签到为手动开启/关闭；
--   5. 一次课一个学生只能签到一次；签到记录逻辑删除；
--   6. 不做多学期、不做备用班授权、不做设备唯一。
-- ============================================================

-- ------------------------------------------------------------
-- 1. 用户表（学生/教师/管理员统一）
-- ------------------------------------------------------------
CREATE TABLE users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户ID',
    role VARCHAR(20) NOT NULL DEFAULT 'student' COMMENT 'student/teacher/admin',
    openid VARCHAR(64) NULL COMMENT '微信openid；微信端登录使用',
    student_no VARCHAR(10) NULL COMMENT '学号，10位数字；role=student时必填',
    name VARCHAR(50) NOT NULL COMMENT '姓名',
    class_name VARCHAR(100) NULL COMMENT '行政班级；学生使用',
    phone VARCHAR(20) NULL COMMENT '手机号；可选登录/校验',
    email VARCHAR(100) NULL COMMENT '邮箱；可选登录/校验',
    password_hash VARCHAR(255) NULL COMMENT '密码哈希；教师/管理员Web登录使用',
    status VARCHAR(20) NOT NULL DEFAULT 'active' COMMENT 'active/disabled',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '修改时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_openid (openid),
    UNIQUE KEY uk_users_student_no (student_no),
    UNIQUE KEY uk_users_phone (phone),
    UNIQUE KEY uk_users_email (email),
    KEY idx_users_role_status (role, status),
    CONSTRAINT chk_users_role CHECK (role IN ('student', 'teacher', 'admin')),
    CONSTRAINT chk_users_status CHECK (status IN ('active', 'disabled')),
    CONSTRAINT chk_users_student_no CHECK (role <> 'student' OR student_no IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表：学生/教师/管理员统一身份';

-- ------------------------------------------------------------
-- 2. 课程表
-- ------------------------------------------------------------
CREATE TABLE courses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '课程ID',
    course_code VARCHAR(30) NOT NULL COMMENT '课程编号',
    course_name VARCHAR(100) NOT NULL COMMENT '课程名称',
    status VARCHAR(20) NOT NULL DEFAULT 'active' COMMENT 'active/disabled',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '修改时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_courses_code (course_code),
    KEY idx_courses_status (status),
    CONSTRAINT chk_courses_status CHECK (status IN ('active', 'disabled'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='课程表：课程目录';

-- ------------------------------------------------------------
-- 3. 教学班表
-- ------------------------------------------------------------
CREATE TABLE course_sections (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '教学班ID',
    course_id BIGINT UNSIGNED NOT NULL COMMENT '所属课程',
    section_code VARCHAR(30) NOT NULL COMMENT '教学班编号',
    section_name VARCHAR(100) NOT NULL COMMENT '教学班名称',
    teacher_id BIGINT UNSIGNED NULL COMMENT '任课教师；引用users(id)，role=teacher',
    status VARCHAR(20) NOT NULL DEFAULT 'active' COMMENT 'active/disabled',
    created_by BIGINT UNSIGNED NOT NULL COMMENT '创建人；引用users(id)',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '修改时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_course_sections_code (course_id, section_code),
    KEY idx_course_sections_teacher (teacher_id),
    KEY idx_course_sections_status (status),
    CONSTRAINT fk_course_sections_course
        FOREIGN KEY (course_id) REFERENCES courses (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_course_sections_teacher
        FOREIGN KEY (teacher_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_course_sections_creator
        FOREIGN KEY (created_by) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_course_sections_status CHECK (status IN ('active', 'disabled'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='教学班表：一门课程下的教学班，一个班暂定一个老师';

-- ------------------------------------------------------------
-- 4. 一次课表（上课安排 + 该次签到）
-- ------------------------------------------------------------
CREATE TABLE class_sessions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '一次课ID',
    section_id BIGINT UNSIGNED NOT NULL COMMENT '所属教学班',
    class_date DATE NOT NULL COMMENT '上课日期',
    period_start TINYINT UNSIGNED NOT NULL COMMENT '开始节次',
    period_end TINYINT UNSIGNED NOT NULL COMMENT '结束节次',
    start_time TIME NULL COMMENT '上课开始时刻；用于倒计时和排序',
    end_time TIME NULL COMMENT '下课时刻',
    classroom VARCHAR(50) NULL COMMENT '教室',
    latitude DECIMAL(10,7) NULL COMMENT '本次签到点纬度，GCJ-02',
    longitude DECIMAL(10,7) NULL COMMENT '本次签到点经度，GCJ-02',
    distance_limit DECIMAL(10,2) NOT NULL DEFAULT 50.00 COMMENT '本次距离阈值，单位米',
    class_status VARCHAR(20) NOT NULL DEFAULT 'scheduled' COMMENT 'scheduled/canceled',
    checkin_status VARCHAR(20) NOT NULL DEFAULT 'draft' COMMENT 'draft/open/closed',
    created_by BIGINT UNSIGNED NOT NULL COMMENT '创建人；引用users(id)',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    opened_at DATETIME NULL COMMENT '实际开启签到时间',
    closed_at DATETIME NULL COMMENT '实际关闭签到时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '修改时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_class_sessions_slot
        (section_id, class_date, period_start, period_end),
    KEY idx_class_sessions_date (class_date, checkin_status),
    KEY idx_class_sessions_section (section_id, class_date),
    CONSTRAINT fk_class_sessions_section
        FOREIGN KEY (section_id) REFERENCES course_sections (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_class_sessions_creator
        FOREIGN KEY (created_by) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_class_sessions_periods
        CHECK (period_start > 0 AND period_end >= period_start),
    CONSTRAINT chk_class_sessions_time_pair
        CHECK ((start_time IS NULL AND end_time IS NULL)
            OR (start_time IS NOT NULL AND end_time IS NOT NULL)),
    CONSTRAINT chk_class_sessions_times
        CHECK (start_time IS NULL OR end_time > start_time),
    CONSTRAINT chk_class_sessions_geo_pair
        CHECK ((latitude IS NULL AND longitude IS NULL)
            OR (latitude IS NOT NULL AND longitude IS NOT NULL)),
    CONSTRAINT chk_class_sessions_latitude
        CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_class_sessions_longitude
        CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
    CONSTRAINT chk_class_sessions_distance CHECK (distance_limit > 0),
    CONSTRAINT chk_class_sessions_class_status
        CHECK (class_status IN ('scheduled', 'canceled')),
    CONSTRAINT chk_class_sessions_checkin_status
        CHECK (checkin_status IN ('draft', 'open', 'closed')),
    CONSTRAINT chk_class_sessions_open_geo
        CHECK (checkin_status <> 'open'
            OR (latitude IS NOT NULL AND longitude IS NOT NULL)),
    CONSTRAINT chk_class_sessions_dates
        CHECK (closed_at IS NULL OR opened_at IS NULL OR closed_at >= opened_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='一次课表：一次具体上课的时间、教室和签到规则';

-- ------------------------------------------------------------
-- 5. 学生-教学班关系表（中间表）
-- ------------------------------------------------------------
CREATE TABLE student_section_assignments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '关系记录ID',
    student_id BIGINT UNSIGNED NOT NULL COMMENT '学生用户ID；引用users(id)，role=student',
    course_id BIGINT UNSIGNED NOT NULL COMMENT '课程ID；用于保证一门课只在一个教学班',
    section_id BIGINT UNSIGNED NOT NULL COMMENT '教学班ID',
    status VARCHAR(20) NOT NULL DEFAULT 'active' COMMENT 'active/disabled',
    created_by BIGINT UNSIGNED NOT NULL COMMENT '创建人；引用users(id)',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '修改时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_assignments_student_section (student_id, section_id),
    UNIQUE KEY uk_assignments_student_course (student_id, course_id),
    KEY idx_assignments_section (section_id),
    CONSTRAINT fk_assignments_student
        FOREIGN KEY (student_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_assignments_course
        FOREIGN KEY (course_id) REFERENCES courses (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_assignments_section
        FOREIGN KEY (section_id) REFERENCES course_sections (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_assignments_creator
        FOREIGN KEY (created_by) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_assignments_status CHECK (status IN ('active', 'disabled'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='中间表：学生与教学班的关系';

-- ------------------------------------------------------------
-- 6. 签到记录表
-- ------------------------------------------------------------
CREATE TABLE checkins (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '签到记录ID',
    session_id BIGINT UNSIGNED NOT NULL COMMENT '一次课ID',
    student_id BIGINT UNSIGNED NOT NULL COMMENT '学生用户ID；引用users(id)，role=student',
    student_no_snapshot VARCHAR(10) NOT NULL COMMENT '签到时的学号快照',
    student_name_snapshot VARCHAR(50) NOT NULL COMMENT '签到时的姓名快照',
    latitude DECIMAL(10,7) NOT NULL COMMENT '学生实测纬度，GCJ-02',
    longitude DECIMAL(10,7) NOT NULL COMMENT '学生实测经度，GCJ-02',
    accuracy DECIMAL(10,2) NULL COMMENT '定位精度，单位米',
    distance DECIMAL(10,2) NOT NULL COMMENT '与本次签到点距离，单位米',
    status VARCHAR(20) NOT NULL DEFAULT 'valid' COMMENT 'valid有效/deleted已删除',
    checked_in_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '签到时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '修改时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_checkins_session_student (session_id, student_id),
    KEY idx_checkins_student (student_id),
    KEY idx_checkins_session (session_id),
    CONSTRAINT fk_checkins_session
        FOREIGN KEY (session_id) REFERENCES class_sessions (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_checkins_student
        FOREIGN KEY (student_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT chk_checkins_latitude CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_checkins_longitude CHECK (longitude BETWEEN -180 AND 180),
    CONSTRAINT chk_checkins_accuracy CHECK (accuracy IS NULL OR accuracy >= 0),
    CONSTRAINT chk_checkins_distance CHECK (distance >= 0),
    CONSTRAINT chk_checkins_status CHECK (status IN ('valid', 'deleted'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='签到记录表';

-- ============================================================
-- 业务层仍需保证的规则：
-- 1. users.role 与字段一致：student 必须有 student_no；teacher/admin 的登录凭据
--    由业务层校验（openid 或 password_hash）。
-- 2. course_sections.teacher_id 必须指向 role=teacher 的用户。
-- 3. student_section_assignments.student_id 必须指向 role=student 的用户；
--    section_id 必须属于对应的 course_id。
-- 4. 一次课（class_sessions）只有 class_status='scheduled'
--    且 checkin_status='open' 时才允许签到。
-- 5. 签到点由管理员/教师在每次课上设置；checkin_status='open' 前必须已设置
--    latitude/longitude，数据库已用 CHECK 约束。
-- 6. 签到为手动开启/关闭，不设置自动起止时间；start_time/end_time 只用于
--    页面倒计时和排序，不参与“是否允许签到”的判断。
-- 7. 同一学生、同一次课只能签到一次，由 UNIQUE(session_id, student_id) 保证。
-- 8. 签到记录使用 status='deleted' 逻辑删除，避免物理删除后唯一约束失效。
-- 9. 学生定位与签到点统一使用 GCJ-02；distance 由服务端按 class_sessions
--    的签到点重新计算，且不得大于 distance_limit。
-- 10. 当前版本不做设备唯一、不做多学期、不做备用班授权。
-- ============================================================
