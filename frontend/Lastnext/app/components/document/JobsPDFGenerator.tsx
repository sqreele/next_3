// ./app/components/document/JobsPDFGenerator.tsx
"use client";
import React, { useEffect } from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@/app/lib/pdfRenderer';
import { Job, TabValue, FILTER_TITLES } from '@/app/lib/types';

// Font helpers (align with MaintenancePDFDocument)
const getPublicAssetUrl = (path: string): string => {
  try {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      const url = `${origin}${path}`;
      return url;
    } else {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || process.env.NEXT_PUBLIC_ASSET_PREFIX || '';
      return `${basePath}${path}`;
    }
  } catch {
    return path;
  }
};

let pdfFontsRegistered = false;
const ensurePdfFontsRegistered = () => {
  if (pdfFontsRegistered) return;
  try {
    const regular = getPublicAssetUrl('/fonts/Sarabun-Regular.ttf');
    const bold = getPublicAssetUrl('/fonts/Sarabun-Bold.ttf');
    Font.register({
      family: 'Sarabun',
      fonts: [
        { src: regular, fontWeight: 'normal', fontStyle: 'normal' },
        { src: bold, fontWeight: 'bold', fontStyle: 'normal' },
      ],
    });
    pdfFontsRegistered = true;
  } catch {
    // Fallback silently
  }
};

// Safe image URL resolver (proxy external images)
const getSafeImageUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('data:')) return url;
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://pcms.live');
    const isSameOrigin = typeof window !== 'undefined'
      ? parsed.origin === window.location.origin
      : parsed.origin.endsWith('pcms.live');
    if (isSameOrigin || url.startsWith('/')) return parsed.toString();
    return `/api/proxy-image?url=${encodeURIComponent(parsed.toString())}`;
  } catch {
    if (url.startsWith('/')) return url;
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  }
};

interface JobsPDFDocumentProps {
  jobs: Job[];
  filter: TabValue;
  selectedProperty?: string | null;
  propertyName?: string;
  topics?: any[];
  onTopicChange?: (topicId: string) => void;
}

const styles = StyleSheet.create({
  page: {
    padding: 32,
    backgroundColor: '#ffffff',
    fontFamily: 'Sarabun',
  },
  header: {
    marginBottom: 16,
    borderBottomWidth: 2,
    borderColor: '#e5e7eb',
    paddingBottom: 10,
    textAlign: 'center'
  },
  headerText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#111827'
  },
  subHeaderText: {
    fontSize: 10,
    marginBottom: 4,
    color: '#6b7280'
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    padding: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  summaryItem: {
    textAlign: 'center',
    width: '25%'
  },
  summaryNumber: {
    fontSize: 12,
    fontWeight: 'bold'
  },
  summaryLabel: {
    fontSize: 8,
    color: '#6b7280'
  },
  jobRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 8,
    minHeight: 84,
    marginBottom: 6,
    backgroundColor: '#ffffff',
    break: false
  },
  imageColumn: {
    width: '22%',
    marginRight: 10
  },
  infoColumn: {
    width: '43%',
    paddingRight: 8
  },
  dateColumn: {
    width: '35%'
  },
  imageWrapper: {
    position: 'relative',
    width: '100%'
  },
  jobImage: {
    width: '100%',
    height: 64,
    objectFit: 'cover',
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  imageCountBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    backgroundColor: '#111827',
    color: '#ffffff',
    fontSize: 8,
    paddingLeft: 4,
    paddingRight: 4,
    paddingTop: 2,
    paddingBottom: 2
  },
  label: {
    fontSize: 8,
    color: '#6b7280',
    marginBottom: 1
  },
  value: {
    fontSize: 9,
    marginBottom: 3,
    lineHeight: 1.25,
    color: '#111827'
  },
  statusBadge: {
    fontSize: 8,
    color: '#1d4ed8',
    marginBottom: 3
  },
  priorityBadge: {
    fontSize: 8,
    marginBottom: 3
  },
  dateText: {
    fontSize: 8,
    marginBottom: 2,
    lineHeight: 1.15,
    color: '#111827'
  },
  truncatedText: {
    fontSize: 8,
    marginBottom: 3,
    lineHeight: 1.2,
    maxLines: 2,
    color: '#111827'
  },
  pageNumber: {
    position: 'absolute',
    fontSize: 8,
    bottom: 24,
    right: 32,
    color: '#6b7280'
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 32,
    right: 32,
    textAlign: 'center',
    fontSize: 7,
    color: '#9ca3af',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 6
  }
});

const JobsPDFDocument: React.FC<JobsPDFDocumentProps> = ({ jobs, filter, selectedProperty, propertyName }) => {
  // Ensure fonts registered in both SSR/CSR
  useEffect(() => {
    ensurePdfFontsRegistered();
  }, []);
  const filteredJobs = (Array.isArray(jobs) ? jobs : []).filter((job) => {
    if (!selectedProperty) return true;

    return job.property_id === selectedProperty ||
      (job.profile_image?.properties?.some(
        (prop: any) => String((prop as any)?.property_id ?? (prop as any)?.id) === selectedProperty
      )) || false;
  });

  // Summary counts by status for header
  const statusCounts = {
    completed: filteredJobs.filter(j => j.status === 'completed').length,
    pending: filteredJobs.filter(j => j.status === 'pending').length,
    in_progress: filteredJobs.filter(j => j.status === 'in_progress').length,
    waiting_sparepart: filteredJobs.filter(j => j.status === 'waiting_sparepart').length,
    cancelled: filteredJobs.filter(j => j.status === 'cancelled').length,
  } as const;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';

    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#F44336';
      case 'medium': return '#FF9800';
      case 'low': return '#4CAF50';
      default: return '#000000';
    }
  };

  const getUserDisplayName = (user: any): string => {
    if (!user) return 'Unassigned';
    if (typeof user === 'string') return user;
    if (typeof user === 'object') {
      return user.name || user.username || user.displayName || user.email || String(user.id) || 'User';
    }
    return 'User';
  };

  // ฟังก์ชันตัดข้อความที่ยาวเกินไป
  const truncateText = (text: string, maxLength: number = 100): string => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  // แบ่ง jobs เป็นกลุมๆ เพื่อป้องกันการตกหน้า
  const jobsPerPage = 8; // จำนวน jobs ต่อหน้า
  const pageGroups: Job[][] = [];
  for (let i = 0; i < filteredJobs.length; i += jobsPerPage) {
    pageGroups.push(filteredJobs.slice(i, i + jobsPerPage));
  }

  return (
    <Document>
      {pageGroups.map((jobGroup, pageIndex) => (
        <Page key={pageIndex} size="A4" style={styles.page}>
          {/* แสดง header เฉพาะหน้าแรก */}
          {pageIndex === 0 && (
            <View style={styles.header}>
              <Text style={styles.headerText}>{propertyName || 'Unnamed Property'}</Text>
              <Text style={styles.subHeaderText}>{(FILTER_TITLES as any)[filter] || 'Job Report'}</Text>
              <Text style={styles.label}>Total Jobs: {filteredJobs.length}</Text>
              <View style={styles.summaryBar}>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryNumber, { color: '#16a34a' }]}>{statusCounts.completed}</Text>
                  <Text style={styles.summaryLabel}>Completed</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryNumber, { color: '#ca8a04' }]}>{statusCounts.pending}</Text>
                  <Text style={styles.summaryLabel}>Pending</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryNumber, { color: '#1d4ed8' }]}>{statusCounts.in_progress}</Text>
                  <Text style={styles.summaryLabel}>In Progress</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryNumber, { color: '#0891b2' }]}>{statusCounts.waiting_sparepart}</Text>
                  <Text style={styles.summaryLabel}>Waiting Parts</Text>
                </View>
              </View>
            </View>
          )}

          {/* แสดง page number สำหรับหน้าที่ 2 เป็นต้นไป */}
          {pageIndex > 0 && (
            <View style={{ marginBottom: 15, alignItems: 'center' }}>
              <Text style={styles.subHeaderText}>Page {pageIndex + 1}</Text>
            </View>
          )}

          {jobGroup.map((job) => (
            <View key={job.job_id} style={styles.jobRow} wrap={false}>
              <View style={styles.imageColumn}>
                {job.images && job.images.length > 0 ? (
                  <View style={styles.imageWrapper}>
                    <Image
                      src={getSafeImageUrl(job.images[0].image_url) || job.images[0].image_url}
                      style={styles.jobImage}
                    />
                    {job.images.length > 1 && (
                      <Text style={styles.imageCountBadge}>+{job.images.length - 1}</Text>
                    )}
                  </View>
                ) : (
                  <View style={styles.imageWrapper}>
                    <View style={[styles.jobImage, { backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' }]}>
                      <Text style={{ fontSize: 8, color: '#9ca3af' }}>No Image</Text>
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.infoColumn}>
                <Text style={styles.label}>
                  Location: {String(job.rooms?.[0]?.room_id ?? '') || 'N/A'}
                </Text>
                <Text style={styles.label}>
                  Room: {job.rooms?.[0]?.name || job.rooms?.[0]?.room_type || 'N/A'}
                </Text>
                <Text style={styles.label}>
                  Topics: {job.topics?.length ? job.topics.map(t => (t as any).title || 'N/A').join(', ') : 'None'}
                </Text>
                <Text style={styles.statusBadge}>Status: {job.status.replace('_', ' ')}</Text>
                <Text style={{
                  ...styles.priorityBadge,
                  color: getPriorityColor(job.priority)
                }}>
                  Priority: {job.priority}
                </Text>
                <Text style={styles.label}>
                  Staff: {getUserDisplayName(job.user)}
                </Text>
              </View>

              <View style={styles.dateColumn}>
                {job.description && (
                  <>
                    <Text style={styles.label}>Description:</Text>
                    <Text style={styles.truncatedText}>
                      {truncateText(job.description, 140)}
                    </Text>
                  </>
                )}
                {job.remarks && (
                  <>
                    <Text style={styles.label}>Remarks:</Text>
                    <Text style={styles.truncatedText}>
                      {truncateText(job.remarks, 140)}
                    </Text>
                  </>
                )}
                <Text style={styles.dateText}>Created: {formatDate(job.created_at)}</Text>
                <Text style={styles.dateText}>Updated: {formatDate(job.updated_at)}</Text>
                {job.completed_at && (
                  <Text style={styles.dateText}>Completed: {formatDate(job.completed_at)}</Text>
                )}
              </View>
            </View>
          ))}

          {/* Footer and page number */}
          <Text 
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
            fixed
          />
          <View style={styles.footer} fixed>
            <Text>Generated by Facility Management System</Text>
          </View>
        </Page>
      ))}
    </Document>
  );
};

export default JobsPDFDocument;
export { JobsPDFDocument };