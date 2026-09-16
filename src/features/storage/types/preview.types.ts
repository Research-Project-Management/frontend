export interface FileDetailItem {
  label: string;
  value: string;
  copyable?: boolean;
}

export interface FileDetailsInfo {
  id: string;
  name: string;
  mimeType: string;
  fileType: string;
  sizeBytes: number;
  formattedSize: string;
  location: string;
  owner: {
    name: string;
    email?: string;
    avatar?: string;
  };
  createdAt: string;
  updatedAt: string;
  description?: string;
}

