export { default as Task } from './components/Task/Task';
export { PHASE_CONFIG, PHASE_CONFIG as STATIC_PHASE_CONFIG, resolveTaskColumnColor, DEFAULT_TASK_COLUMN_COLORS } from './types/task.types';
export { useBulkUpdateTasks, useProjectTasks, useWorkspaceTasks, useUpdateTask, useDeleteTask, useDuplicateTask } from './services/task.services';
