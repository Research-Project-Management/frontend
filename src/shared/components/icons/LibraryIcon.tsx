import * as React from 'react';
import { cn } from '@/shared/lib/utils';

export interface LibraryIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

/**
 * LibraryIcon - 3D Kinetic Research Monograph (Chuyên Khảo Nghiên Cứu Lập Thể 3D)
 * 
 * Hội tụ 6 giá trị cốt lõi theo định hướng thiết kế của nền tảng Flux:
 * 1. Học thuật (Academic): Biểu tượng cuốn chuyên khảo nghiên cứu mở 3 tầng trang giấy tri thức.
 * 2. Chuyên nghiệp (Professional): Chuẩn tỷ lệ Lucide 24x24, nét 2px dứt khoát, khoảng thở cân bằng ~75%.
 * 3. Sáng tạo (Creative): Trang giấy thứ 3 lật góc 45° lơ lửng trong không gian 3 chiều, thể hiện sự đột phá tri thức.
 * 4. Phụng sự (Service): Dáng mở rộng thênh thang của cuốn sách tượng trưng cho tinh thần cống hiến tri thức mở (Open Science).
 * 5. Hiện đại (Modern): Ngôn ngữ hình học tối giản (Minimalist Geometry) đồng bộ hoàn mỹ với BrainCircuit (AI) & Database (Storage).
 * 6. Kỷ luật (Disciplined): Hệ trục tọa độ số nguyên 100% (x ∈ {2, 12, 17, 22}, y ∈ {4, 6, 9, 16, 18, 21}), phân chia đối xứng vàng 5px/5px.
 */
export function LibraryIcon({
  className,
  size = 24,
  ...props
}: LibraryIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-4 shrink-0 text-current', className)}
      {...props}
    >
      {/* Tầng 1: Cuốn sách nghiên cứu mở trên cùng (Layer 1 - Top Open Research Spread) */}
      <path d="M2 4l10 3 10-3v5l-10 3-10-3V4z" />

      {/* Sống gáy sách trung tâm xuyên suốt các tầng (Central Scholarly Spine) */}
      <line x1="12" y1="7" x2="12" y2="21" />

      {/* Tầng 2: Lớp trang sách thứ 2 xếp tầng trong không gian (Layer 2 - Middle Stepped Page) */}
      <path d="M2 13.5l10 3 10-3" />

      {/* Tầng 3: Lớp trang sách thứ 3 nền tảng (Layer 3 - Bottom Base Page) */}
      <path d="M2 18l10 3 10-3" />
    </svg>
  );
}

export const LibrarySpaceIcon = LibraryIcon;
export const CosmicLibraryIcon = LibraryIcon;
export default LibraryIcon;


