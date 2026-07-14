import { useState } from 'react';
import { Button, Empty, message, Space, Tag, Typography, Upload } from 'antd';
import { FileOutlined, UploadOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { merchantApi } from '../../../services/merchantApi';
import type { MerchantFile } from '../../../types';

const { Text, Title } = Typography;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv']);
const ACCEPTED_FILE_TYPES = [...ALLOWED_EXTENSIONS].map((extension) => `.${extension}`).join(',');

interface Props {
  merchantId: string;
  files: MerchantFile[];
  onRefresh: () => void | Promise<void>;
}

export default function MerchantFiles({ merchantId, files, onRefresh }: Props) {
  const [uploading, setUploading] = useState(false);

  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      message.error('Unsupported file type. Please upload PNG, JPG, GIF, PDF, DOC, DOCX, XLS, XLSX, or CSV.');
      return Upload.LIST_IGNORE;
    }
    if (file.size <= 0) {
      message.error('The selected file is empty.');
      return Upload.LIST_IGNORE;
    }
    if (file.size > MAX_FILE_SIZE) {
      message.error('File size must not exceed 5 MB.');
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const customRequest: UploadProps['customRequest'] = async ({ file, onError, onSuccess }) => {
    if (uploading) {
      onError?.(new Error('An upload is already in progress'));
      return;
    }

    setUploading(true);
    try {
      const response = await merchantApi.uploadFile(merchantId, file as File);
      onSuccess?.(response.data);
      message.success(`${response.data.fileName} uploaded successfully`);
      await onRefresh();
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { error?: string } }; message?: string };
      const uploadError = new Error(apiError.response?.data?.error || apiError.message || 'File upload failed');
      onError?.(uploadError);
      message.error(uploadError.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <section>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <Title level={5} style={{ margin: 0 }}>Compliance Documents</Title>
          <Text type="secondary">Upload one file at a time. Maximum size: 5 MB.</Text>
        </div>
        <Upload
          accept={ACCEPTED_FILE_TYPES}
          beforeUpload={beforeUpload}
          customRequest={customRequest}
          disabled={uploading}
          maxCount={1}
          showUploadList={false}
        >
          <Button type="primary" icon={<UploadOutlined />} loading={uploading}>
            Upload File
          </Button>
        </Upload>
      </Space>

      {files.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No files uploaded yet" />
      ) : (
        <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
          {files.map((file, index) => (
            <div
              key={file.id}
              style={{
                display: 'flex',
                gap: 12,
                padding: 16,
                borderBottom: index < files.length - 1 ? '1px solid #f0f0f0' : undefined,
              }}
            >
              <FileOutlined style={{ fontSize: 20, marginTop: 2 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <Space>
                  <Text strong>{file.fileName}</Text>
                  <Tag>{formatFileSize(file.fileSize)}</Tag>
                </Space>
                <div><Text type="secondary">Uploaded {new Date(file.createdAt).toLocaleString()}</Text></div>
                <div>
                  <Text copyable={{ text: file.fileKey }} ellipsis={{ tooltip: file.fileKey }}>
                    File key: {file.fileKey}
                  </Text>
                </div>
                <div>
                  <Text copyable={{ text: file.fileSha256 }} ellipsis={{ tooltip: file.fileSha256 }}>
                    SHA-256: {file.fileSha256}
                  </Text>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
