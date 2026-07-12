export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const Errors = {
  // Auth
  INVALID_JWT: () => new AppError('INVALID_JWT', 'Authentication token is invalid or expired', 401),
  INVALID_CREDENTIALS: () => new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401),

  // Student / session lookup
  STUDENT_NOT_FOUND: () => new AppError('STUDENT_NOT_FOUND', 'Student does not exist', 404),
  SESSION_NOT_FOUND: () => new AppError('SESSION_NOT_FOUND', 'Attendance session not found', 404),
  SESSION_NOT_ACTIVE: () => new AppError('SESSION_NOT_ACTIVE', 'Attendance session is not active', 409),
  SESSION_ALREADY_ACTIVE: () => new AppError('SESSION_ALREADY_ACTIVE', 'End your current active session before starting another.', 409),
  WRONG_TIMETABLE_DAY: () => new AppError('WRONG_TIMETABLE_DAY', 'This class is not allocated for today.', 403),
  OUTSIDE_PERIOD_TIME: () => new AppError('OUTSIDE_PERIOD_TIME', 'Session can only be started within 15 minutes of its allocated period.', 403),

  // QR validation
  INVALID_SIGNATURE: () =>
    new AppError('INVALID_QR_SIGNATURE', 'The QR code is invalid or has been modified.', 401),
  QR_EXPIRED: () =>
    new AppError('QR_EXPIRED', 'This QR code has expired. Scan the latest QR code.', 410),
  TOKEN_REVOKED: () =>
    new AppError('TOKEN_REVOKED', 'This QR token has been revoked.', 410),
  TOKEN_ALREADY_USED: () =>
    new AppError('TOKEN_ALREADY_USED', 'This QR code has already been used.', 409),

  // Student-session checks
  BATCH_MISMATCH: () =>
    new AppError('BATCH_MISMATCH', 'You are not enrolled in this session\'s batch.', 403),
  SUBJECT_MISMATCH: () =>
    new AppError('SUBJECT_MISMATCH', 'Subject does not match the active session.', 403),
  OUTSIDE_TIME_WINDOW: () =>
    new AppError('OUTSIDE_TIME_WINDOW', 'Scan is outside the allowed attendance time window.', 403),

  // Device binding
  DEVICE_NOT_AUTHORIZED: () =>
    new AppError('DEVICE_NOT_AUTHORIZED', 'Attendance cannot be marked from this device.', 403),

  // GPS / location
  GPS_REQUIRED: () =>
    new AppError('GPS_REQUIRED', 'GPS coordinates are required to mark attendance.', 400),
  GPS_ACCURACY_TOO_LOW: () =>
    new AppError('GPS_ACCURACY_TOO_LOW', 'GPS accuracy is too low. Move to an open area and try again.', 400),
  OUTSIDE_GEOFENCE: () =>
    new AppError('OUTSIDE_ALLOWED_LOCATION', 'You are outside the allowed attendance location.', 403),

  // Duplicate / rate limiting
  DUPLICATE_ATTENDANCE: () =>
    new AppError('ATTENDANCE_ALREADY_MARKED', 'Attendance has already been marked for this session.', 409),
  RATE_LIMITED: () =>
    new AppError('RATE_LIMITED', 'Too many scan attempts, please slow down.', 429),
};
