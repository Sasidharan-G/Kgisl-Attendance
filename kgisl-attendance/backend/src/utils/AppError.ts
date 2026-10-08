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
  PASSWORD_CHANGE_REQUIRED: () => new AppError('PASSWORD_CHANGE_REQUIRED', 'You must set a new password before continuing.', 403),
  ACCOUNT_INACTIVE: () => new AppError('ACCOUNT_INACTIVE', 'This account has been deactivated. Contact the administrator.', 403),

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
  BEACON_TOKEN_INVALID: () =>
    new AppError('BEACON_TOKEN_INVALID_OR_EXPIRED', 'The beacon token is invalid or has expired.', 410),
  BEACON_TOKEN_ISSUE_FAILED: () =>
    new AppError('BEACON_TOKEN_ISSUE_FAILED', 'Could not issue a beacon token. Try again.', 503),
  BEACON_NOT_FOUND: () =>
    new AppError('BEACON_NOT_FOUND', 'The classroom beacon is not registered or is disabled.', 404),
  BEACON_ROOM_MISMATCH: () =>
    new AppError('BEACON_ROOM_MISMATCH', 'The beacon is not assigned to this session room.', 403),
  BEACON_PACKET_INVALID: () =>
    new AppError('BEACON_PACKET_INVALID_OR_EXPIRED', 'The BLE beacon packet is invalid or expired.', 410),
  BEACON_SIGNAL_TOO_WEAK: () =>
    new AppError('BEACON_SIGNAL_TOO_WEAK', 'The classroom beacon signal is too weak. Move inside the classroom and retry.', 403),
  SESSION_ACCESS_DENIED: () =>
    new AppError('SESSION_ACCESS_DENIED', 'You are not allowed to manage this attendance session.', 403),

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

  // Passkey (Face ID / Touch ID) device binding
  PASSKEY_REQUIRED: () =>
    new AppError('PASSKEY_REQUIRED', 'This account is secured with a passkey. Confirm with Face ID / Touch ID to mark attendance.', 403),
  PASSKEY_NOT_ENROLLED: () =>
    new AppError('PASSKEY_NOT_ENROLLED', 'No passkey is set up for this account.', 404),
  PASSKEY_INVALID: () =>
    new AppError('PASSKEY_INVALID', 'Passkey verification failed. Try again.', 403),
  PASSKEY_CHALLENGE_EXPIRED: () =>
    new AppError('PASSKEY_CHALLENGE_EXPIRED', 'The passkey request expired. Try again.', 410),
  DEVICE_ALREADY_BOUND: () =>
    new AppError('DEVICE_ALREADY_BOUND', 'This account is already bound to a device. Ask your faculty to reset it before setting up a passkey.', 409),

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
