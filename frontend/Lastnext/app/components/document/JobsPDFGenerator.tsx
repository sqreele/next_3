// ./app/components/document/JobsPDFGenerator.tsx
"use client";
import React, { useEffect, useState } from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@/app/lib/pdfRenderer';
import { Job, TabValue, FILTER_TITLES } from '@/app/lib/types';

// Improved font registration with fallback
const registerFonts = () => {
  try {
    const getPublicAssetUrl = (path: string): string => {
      if (typeof window !== 'undefined') {
        return `${window.location.origin}${path}`;
      }
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || process.env.NEXT_PUBLIC_ASSET_PREFIX || '';
      return `${basePath}${path}`;
    };

    Font.register({
      family: 'Sarabun',
      fonts: [
        { src: getPublicAssetUrl('/fonts/Sarabun-Regular.ttf'), fontWeight: 'normal' },
        { src: getPublicAssetUrl('/fonts/Sarabun-Bold.ttf'), fontWeight: 'bold' },
      ],
    });
    
    console.log('✅ Fonts registered successfully');
    return true;
  } catch (error) {
    console.warn('❌ Font registration failed:', error);
    return false;
  }
};

// Improved image URL processing with validation
const processImageUrl = (url?: string): string | undefined => {
  if (!url || typeof url !== 'string') return undefined;
  
  // Return data URLs as-is
  if (url.startsWith('data:')) return url;
  
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://pcms.live');
    const isSameOrigin = typeof window !== 'undefined'
      ? parsed.origin === window.location.origin
      : parsed.origin.endsWith('pcms.live');
      
    if (isSameOrigin || url.startsWith('/')) {
      return parsed.toString();
    }
    
    // Use proxy for external images to avoid CORS and corruption issues
    return `/api/proxy-image?url=${encodeURIComponent(parsed.toString())}`;
  } catch {
    if (url.startsWith('/')) return url;
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  }
};

// Validation function for job data
const validateJobData = (job: Job): boolean => {
  return !!(
    job &&
    typeof job === 'object' &&
    job.job_id &&
    job.status &&
    job.priority
  );
};

// Safe text rendering with fallbacks
const SafeText = ({ children, style, ...props }: any) => (
  <Text style={style} {...props}>
    {children || 'N/A'}
  </Text>
);

// Safe image component with error handling
const SafeImage = ({ src, style, alt = "Job Image" }: { src?: string; style?: any; alt?: string }) => {
  if (!src) {
    return (
      <View style={[style, { backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: 8, color: '#9ca3af' }}>No Image</Text>
      </View>
    );
  }

  return (
    <Image
      src={src}
      style={style}
      cache={false} // Disable caching to prevent corruption
    />
  );
};

const styles = StyleSheet.create({
  page: {
    padding: 32,
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica', // Fallback to built-in font
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
    backgroundColor: '#ffffff'
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

interface JobsPDFDocumentProps {
  jobs: Job[];
  filter: TabValue;
  selectedProperty?: string | null;
  propertyName?: string;
}

const JobsPDFDocument: React.FC<JobsPDFDocumentProps> = ({ 
  jobs, 
  filter, 
  selectedProperty, 
  propertyName 
}) => {
  const [fontsReady, setFontsReady] = useState(false);
  
  useEffect(() => {
    const initFonts = async () => {
      const success = registerFonts();
      setFontsReady(true); // Proceed even if fonts fail to load
    };
    initFonts();
  }, []);

  // Validate and filter jobs
  const validJobs = (Array.isArray(jobs) ? jobs : [])
    .filter(validateJobData)
    .filter((job) => {
      if (!selectedProperty) return true;
      return job.property_id === selectedProperty ||
        (job.profile_image?.properties?.some(
          (prop: any) => String((prop as any)?.property_id ?? (prop as any)?.id) === selectedProperty
        )) || false;
    });

  // Summary counts
  const statusCounts = {
    completed: validJobs.filter(j => j.status === 'completed').length,
    pending: validJobs.filter(j => j.status === 'pending').length,
    in_progress: validJobs.filter(j => j.status === 'in_progress').length,
    waiting_sparepart: validJobs.filter(j => j.status === 'waiting_sparepart').length,
    cancelled: validJobs.filter(j => j.status === 'cancelled').length,
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid Date';
    }
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

  const truncateText = (text: string, maxLength: number = 100): string => {
    if (!text || typeof text !== 'string') return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  // Group jobs into pages
  const jobsPerPage = 8;
  const pageGroups: Job[][] = [];
  for (let i = 0; i < validJobs.length; i += jobsPerPage) {
    pageGroups.push(validJobs.slice(i, i + jobsPerPage));
  }

  // Show loading if fonts aren't ready
  if (!fontsReady) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={{ textAlign: 'center', marginTop: 100 }}>
            <Text>Loading PDF...</Text>
          </View>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      {pageGroups.map((jobGroup, pageIndex) => (
        <Page key={pageIndex} size="A4" style={styles.page}>
          {/* Header on first page only */}
          {pageIndex === 0 && (
            <View style={styles.header}>
              <SafeText style={styles.headerText}>
                {propertyName || 'Unnamed Property'}
              </SafeText>
              <SafeText style={styles.subHeaderText}>
                {(FILTER_TITLES as any)[filter] || 'Job Report'}
              </SafeText>
              <SafeText style={styles.label}>
                Total Jobs: {validJobs.length}
              </SafeText>
              <View style={styles.summaryBar}>
                <View style={styles.summaryItem}>
                  <SafeText style={[styles.summaryNumber, { color: '#16a34a' }]}>
                    {statusCounts.completed}
                  </SafeText>
                  <SafeText style={styles.summaryLabel}>Completed</SafeText>
                </View>
                <View style={styles.summaryItem}>
                  <SafeText style={[styles.summaryNumber, { color: '#ca8a04' }]}>
                    {statusCounts.pending}
                  </SafeText>
                  <SafeText style={styles.summaryLabel}>Pending</SafeText>
                </View>
                <View style={styles.summaryItem}>
                  <SafeText style={[styles.summaryNumber, { color: '#1d4ed8' }]}>
                    {statusCounts.in_progress}
                  </SafeText>
                  <SafeText style={styles.summaryLabel}>In Progress</SafeText>
                </View>
                <View style={styles.summaryItem}>
                  <SafeText style={[styles.summaryNumber, { color: '#0891b2' }]}>
                    {statusCounts.waiting_sparepart}
                  </SafeText>
                  <SafeText style={styles.summaryLabel}>Waiting Parts</SafeText>
                </View>
              </View>
            </View>
          )}

          {/* Page number for subsequent pages */}
          {pageIndex > 0 && (
            <View style={{ marginBottom: 15, alignItems: 'center' }}>
              <SafeText style={styles.subHeaderText}>Page {pageIndex + 1}</SafeText>
            </View>
          )}

          {jobGroup.map((job) => (
            <View key={job.job_id} style={styles.jobRow} wrap={false}>
              <View style={styles.imageColumn}>
                {job.images && job.images.length > 0 ? (
                  <View style={styles.imageWrapper}>
                    <SafeImage
                      src={processImageUrl(job.images[0].image_url)}
                      style={styles.jobImage}
                    />
                    {job.images.length > 1 && (
                      <SafeText style={styles.imageCountBadge}>
                        +{job.images.length - 1}
                      </SafeText>
                    )}
                  </View>
                ) : (
                  <View style={styles.imageWrapper}>
                    <View style={[styles.jobImage, { backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' }]}>
                      <SafeText style={{ fontSize: 8, color: '#9ca3af' }}>No Image</SafeText>
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.infoColumn}>
                <SafeText style={styles.label}>
                  Location: {String(job.rooms?.[0]?.room_id ?? '') || 'N/A'}
                </SafeText>
                <SafeText style={styles.label}>
                  Room: {job.rooms?.[0]?.name || job.rooms?.[0]?.room_type || 'N/A'}
                </SafeText>
                <SafeText style={styles.label}>
                  Topics: {job.topics?.length ? job.topics.map(t => (t as any).title || 'N/A').join(', ') : 'None'}
                </SafeText>
                <SafeText style={styles.statusBadge}>
                  Status: {job.status.replace('_', ' ')}
                </SafeText>
                <SafeText style={{
                  ...styles.priorityBadge,
                  color: getPriorityColor(job.priority)
                }}>
                  Priority: {job.priority}
                </SafeText>
                <SafeText style={styles.label}>
                  Staff: {getUserDisplayName(job.user)}
                </SafeText>
              </View>

              <View style={styles.dateColumn}>
                {job.description && (
                  <>
                    <SafeText style={styles.label}>Description:</SafeText>
                    <SafeText style={styles.truncatedText}>
                      {truncateText(job.description, 140)}
                    </SafeText>
                  </>
                )}
                {job.remarks && (
                  <>
                    <SafeText style={styles.label}>Remarks:</SafeText>
                    <SafeText style={styles.truncatedText}>
                      {truncateText(job.remarks, 140)}
                    </SafeText>
                  </>
                )}
                <SafeText style={styles.dateText}>
                  Created: {formatDate(job.created_at)}
                </SafeText>
                <SafeText style={styles.dateText}>
                  Updated: {formatDate(job.updated_at)}
                </SafeText>
                {job.completed_at && (
                  <SafeText style={styles.dateText}>
                    Completed: {formatDate(job.completed_at)}
                  </SafeText>
                )}
              </View>
            </View>
          ))}

          {/* Footer and page number */}
          <Text 
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Page ${pageNumber} of ${totalPages}`}
            fixed
          />
          <View style={styles.footer} fixed>
            <SafeText>Generated by Facility Management System</SafeText>
          </View>
        </Page>
      ))}
    </Document>
  );
};

export default JobsPDFDocument;
export { JobsPDFDocument };
