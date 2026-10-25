from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field


class StudentLoginRequest(BaseModel):
    student_no: str = Field(..., max_length=10)
    name: str = Field(..., max_length=50)


class StaffLoginRequest(BaseModel):
    phone: str = Field(..., max_length=20)
    password: str = Field(..., max_length=100)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    student_no: str | None = None
    name: str
    class_name: str | None = None
    phone: str | None = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class CurrentSessionOut(BaseModel):
    session_id: int
    course_name: str
    section_name: str
    classroom: str | None = None
    class_date: date
    start_time: str | None = None
    end_time: str | None = None
    checkin_status: str
    distance_limit: float
    latitude: float | None = None
    longitude: float | None = None
    already_checked_in: bool = False
    checked_in_at: datetime | None = None


class CheckinRequest(BaseModel):
    session_id: int
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    accuracy: float | None = Field(None, ge=0)


class CheckinResponse(BaseModel):
    success: bool
    code: str | None = None
    message: str
    distance: float | None = None
    checked_in_at: datetime | None = None


class AdminClassSessionOut(BaseModel):
    id: int
    course_name: str
    section_name: str
    section_code: str
    class_date: date
    start_time: str | None = None
    end_time: str | None = None
    classroom: str | None = None
    checkin_status: str
    class_status: str
    latitude: float | None = None
    longitude: float | None = None
    distance_limit: float
    checkin_count: int
    total_students: int


class PointUpdateRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    distance_limit: float = Field(..., gt=0, le=100000)


class AdminCheckinOut(BaseModel):
    id: int
    student_no: str
    student_name: str
    checked_in_at: datetime
    distance: float
    accuracy: float | None = None
    status: str


class ClassSessionCreate(BaseModel):
    section_id: int
    class_date: date
    period_start: int = Field(..., ge=1)
    period_end: int = Field(..., ge=1)
    start_time: time | None = None
    end_time: time | None = None
    classroom: str | None = Field(None, max_length=50)
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    distance_limit: float = Field(50, gt=0, le=100000)


class CourseCreate(BaseModel):
    course_code: str = Field(..., max_length=30)
    course_name: str = Field(..., max_length=100)


class CourseUpdate(BaseModel):
    course_code: str | None = Field(None, max_length=30)
    course_name: str | None = Field(None, max_length=100)
    status: str | None = None


class CourseOut(BaseModel):
    id: int
    course_code: str
    course_name: str
    status: str
    section_count: int = 0


class SectionCreate(BaseModel):
    course_id: int
    section_code: str = Field(..., max_length=30)
    section_name: str = Field(..., max_length=100)
    teacher_id: int | None = None


class SectionUpdate(BaseModel):
    section_code: str | None = Field(None, max_length=30)
    section_name: str | None = Field(None, max_length=100)
    teacher_id: int | None = None
    status: str | None = None


class SectionOut(BaseModel):
    id: int
    course_id: int
    course_code: str
    course_name: str
    section_code: str
    section_name: str
    teacher_id: int | None = None
    teacher_name: str | None = None
    status: str
    student_count: int = 0


class TeacherOut(BaseModel):
    id: int
    name: str
    phone: str | None = None


class StudentSectionOut(BaseModel):
    course_id: int
    course_name: str
    section_id: int
    section_name: str


class StudentOut(BaseModel):
    id: int
    student_no: str
    name: str
    class_name: str | None = None
    status: str
    sections: list[StudentSectionOut] = []


class StudentCreate(BaseModel):
    student_no: str = Field(..., min_length=10, max_length=10)
    name: str = Field(..., max_length=50)
    class_name: str | None = Field(None, max_length=100)


class StudentUpdate(BaseModel):
    name: str | None = Field(None, max_length=50)
    class_name: str | None = Field(None, max_length=100)
    status: str | None = None


class AssignmentCreate(BaseModel):
    course_id: int
    section_id: int


class CheckinUpdate(BaseModel):
    student_no_snapshot: str | None = Field(None, max_length=10)
    student_name_snapshot: str | None = Field(None, max_length=50)
    status: str | None = None


class ImportResult(BaseModel):
    created: int = 0
    updated: int = 0
    assigned: int = 0
    skipped: int = 0
    errors: list[str] = []
