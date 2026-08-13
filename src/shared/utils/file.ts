import { resolveFileUrl } from '@/shared/utils/url';
import { THUMBNAIL_MAX_SIZE_PX, THUMBNAIL_QUALITY } from '@/config/file.config';


export const generateThumbnail = async (file: File | Blob): Promise<Blob | null> => {
    if (!file.type.startsWith("image/")) return null;

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > THUMBNAIL_MAX_SIZE_PX) { 
                        height *= THUMBNAIL_MAX_SIZE_PX / width; 
                        width = THUMBNAIL_MAX_SIZE_PX; 
                    }
                } else {
                    if (height > THUMBNAIL_MAX_SIZE_PX) { 
                        width *= THUMBNAIL_MAX_SIZE_PX / height; 
                        height = THUMBNAIL_MAX_SIZE_PX; 
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (!ctx) { resolve(null); return; }
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => resolve(blob), "image/jpeg", THUMBNAIL_QUALITY);
            };
            img.onerror = () => resolve(null);
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    });
};

export function downloadFileUrl(url: string, filename: string) {
    const fullUrl = resolveFileUrl(url);
    if (!fullUrl) return;
    const a = document.createElement('a');
    a.href = fullUrl;
    a.download = filename;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
}
