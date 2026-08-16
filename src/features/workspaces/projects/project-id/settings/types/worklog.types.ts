export interface WorklogUser {
  id?: string;
  name: string;
  avatar?: string;
  email?: string;
}

export interface WorklogEntry {
  id: string;
  userId?: string;
  user: WorklogUser;
  taskTitle: string;
  hours: number;
  date: string;
  description?: string;
}

export interface WorklogFilterState {
  userIds: string[];
  startDate: string | null;
  endDate: string | null;
}
