import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from 'sonner';
import type { Sticky } from '../types/home.types';
import { STICKY_COLOR_CYCLE } from '../types/home.types';
import { getStickies, createSticky } from '../services/home.service';

export function useStickies(workspaceId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['stickies', workspaceId],
    queryFn: () => getStickies(workspaceId),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: createSticky,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stickies', workspaceId] });
      toast.success("Sticky added", { id: "sticky-action" });
    },
    onError: () => toast.error("Failed to add sticky", { id: "sticky-action" }),
  });

  const notes = (query.data || []) as Sticky[];
  
  const handleAdd = () => {
    if (!workspaceId) return;
    const lastColor = notes[0]?.color;
    const idx = STICKY_COLOR_CYCLE.indexOf(lastColor || '');
    const color = STICKY_COLOR_CYCLE[idx === -1 ? 0 : (idx + 1) % STICKY_COLOR_CYCLE.length];
    
    create.mutate({
      workspaceId,
      content: '<p></p>',
      color,
      title: '',
      position: { x: 0, y: 0 },
    });
  };

  return {
    notes,
    isLoading: query.isLoading,
    isCreating: create.isPending,
    handleAdd,
  };
}
