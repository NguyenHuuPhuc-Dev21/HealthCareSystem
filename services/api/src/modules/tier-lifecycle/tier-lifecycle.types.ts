export interface GphnSweepInput {
  /** Ngày nghiệp vụ theo giờ VN, dạng YYYY-MM-DD */
  today: string;
  /** Thời điểm chạy — inject được để test bằng fake clock */
  now: Date;
}

export interface ReleasedBooking {
  id: string;
  booking_code: string;
  previous_nurse_id: string;
}

export interface GphnSweepResult {
  demotedNurseIds: string[];
  releasedBookings: ReleasedBooking[];
}