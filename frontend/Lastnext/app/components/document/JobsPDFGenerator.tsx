// ./app/components/document/JobsPDFGenerator.tsx
"use client";
// Note: @react-pdf/renderer only supports JPG, JPEG, PNG, and GIF image formats
// WebP, AVIF, and other modern formats will be handled cautiously for PDF compatibility
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@/app/lib/pdfRenderer';
import { Job, TabValue, FILTER_TITLES } from '@/app/lib/types';

// Font registration helpers to resolve absolute public URLs in both dev and prod
const getPublicAssetUrl = (path: string): string => {
  try {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      return `${origin}${path}`;
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
    const italic = getPublicAssetUrl('/fonts/Sarabun-Italic.ttf');
    const boldItalic = getPublicAssetUrl('/fonts/Sarabun-BoldItalic.ttf');
    Font.register({
      family: 'Sarabun',
      fonts: [
        { src: regular, fontWeight: 'normal', fontStyle: 'normal' },
        { src: bold, fontWeight: 'bold', fontStyle: 'normal' },
        { src: italic, fontWeight: 'normal', fontStyle: 'italic' },
        { src: boldItalic, fontWeight: 'bold', fontStyle: 'italic' },
      ],
    });
    pdfFontsRegistered = true;
  } catch (error) {
    // Fallback will rely on default fonts
  }
};

interface JobsPDFDocumentProps {
  jobs: Job[];
  filter: TabValue;
  selectedProperty?: string | null;
  propertyName?: string;
  topics?: any[];
  onTopicChange?: (topicId: string) => void;
  includeDetails?: boolean;
  includeImages?: boolean;
  includeStatistics?: boolean;
  reportTitle?: string;
}

const styles = StyleSheet.create({
  page: {
    padding: 20,
    backgroundColor: '#ffffff',
    fontFamily: 'Sarabun',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderColor: '#1e40af',
    paddingBottom: 15,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1e40af',
    textAlign: 'center',
  },
  subHeaderText: {
    fontSize: 14,
    marginBottom: 5,
    color: '#374151',
    textAlign: 'center',
  },
  metadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#f9fafb',
    borderRadius: 5,
  },
  metadataItem: {
    fontSize: 10,
    color: '#6b7280',
  },
  statistics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'center',
  },
  jobRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 12,
    paddingHorizontal: 8,
    minHeight: 100,
    maxHeight: 150,
    marginBottom: 8,
    backgroundColor: '#ffffff',
  },
  jobRowAlternate: {
    backgroundColor: '#f9fafb',
  },
  imageColumn: {
    width: '20%',
    marginRight: 12,
  },
  infoColumn: {
    width: '45%',
    paddingRight: 10,
  },
  statusColumn: {
    width: '35%',
  },
  jobImage: {
    width: '100%',
    height: 80,
    objectFit: 'cover',
    borderRadius: 4,
  },
  label: {
    fontSize: 9,
    color: '#6b7280',
    marginBottom: 2,
    fontWeight: 'bold',
  },
  value: {
    fontSize: 9,
    marginBottom: 4,
    lineHeight: 1.3,
    color: '#111827',
  },
  statusBadge: {
    fontSize: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginBottom: 4,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  priorityBadge: {
    fontSize: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginBottom: 4,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  dateText: {
    fontSize: 8,
    marginBottom: 3,
    lineHeight: 1.2,
    color: '#6b7280',
  },
  truncatedText: {
    fontSize: 9,
    marginBottom: 4,
    lineHeight: 1.3,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1e40af',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    paddingBottom: 5,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    textAlign: 'center',
    fontSize: 8,
    color: '#9ca3af',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    fontSize: 8,
    color: '#9ca3af',
  },
  noDataMessage: {
    textAlign: 'center',
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 50,
    fontStyle: 'italic',
  },
});

const JobsPDFDocument: React.FC<JobsPDFDocumentProps> = ({ 
  jobs, 
  filter, 
  selectedProperty, 
  propertyName, 
  topics, 
  onTopicChange,
  includeDetails = true,
  includeImages = true,
  includeStatistics = true,
  reportTitle = 'Jobs Report'
}) => {
  ensurePdfFontsRegistered();

  const filteredJobs = (Array.isArray(jobs) ? jobs : []).filter((job) => {
    if (!selectedProperty) return true;
    return job.property_id === selectedProperty ||
      (job.profile_image?.properties?.some(
        (prop) => String((prop as any)?.property_id ?? (prop as any)?.id) === selectedProperty
      )) || false;
  });

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
    switch (priority?.toLowerCase()) {
      case 'high': return '#dc2626';
      case 'medium': return '#ea580c';
      case 'low': return '#16a34a';
      default: return '#6b7280';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': return '#16a34a';
      case 'in_progress': return '#2563eb';
      case 'pending': return '#ea580c';
      case 'cancelled': return '#dc2626';
      case 'waiting_sparepart': return '#7c3aed';
      default: return '#6b7280';
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

  const truncateText = (text: string, maxLength: number = 120): string => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  // Calculate statistics
  const totalJobs = filteredJobs.length;
  const completedJobs = filteredJobs.filter(job => job.status === 'completed').length;
  const inProgressJobs = filteredJobs.filter(job => job.status === 'in_progress').length;
  const pendingJobs = filteredJobs.filter(job => job.status === 'pending').length;
  const cancelledJobs = filteredJobs.filter(job => job.status === 'cancelled').length;
  const highPriorityJobs = filteredJobs.filter(job => job.priority === 'high').length;

  // Group jobs by status (reserved for future layout changes)
  const jobsByStatus = {
    completed: filteredJobs.filter(job => job.status === 'completed'),
    in_progress: filteredJobs.filter(job => job.status === 'in_progress'),
    pending: filteredJobs.filter(job => job.status === 'pending'),
    cancelled: filteredJobs.filter(job => job.status === 'cancelled'),
    waiting_sparepart: filteredJobs.filter(job => job.status === 'waiting_sparepart'),
  };

  // Jobs per page for pagination
  const jobsPerPage = 6;
  const pageGroups: Job[][] = [];
  for (let i = 0; i < filteredJobs.length; i += jobsPerPage) {
    pageGroups.push(filteredJobs.slice(i, i + jobsPerPage));
  }

  if (filteredJobs.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.headerText}>{reportTitle}</Text>
            <Text style={styles.subHeaderText}>
              {propertyName ? `Property: ${propertyName}` : 'All Properties'}
            </Text>
          </View>
          <Text style={styles.noDataMessage}>No jobs found for the selected criteria.</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      {pageGroups.map((jobGroup, pageIndex) => (
        <Page key={pageIndex} size="A4" style={styles.page}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerText}>{reportTitle}</Text>
            <Text style={styles.subHeaderText}>
              {propertyName ? `Property: ${propertyName}` : 'All Properties'}
            </Text>
            <Text style={styles.subHeaderText}>
              {`Filter: ${(FILTER_TITLES as any)[filter] || filter} | Generated: ${new Date().toLocaleDateString()}`}
            </Text>
          </View>

          {/* Statistics Section - Only on first page */}
          {pageIndex === 0 && includeStatistics && (
            <>
              <View style={styles.metadata}>
                <Text style={styles.metadataItem}>Total Jobs: {totalJobs}</Text>
                <Text style={styles.metadataItem}>Filter: {(FILTER_TITLES as any)[filter] || filter}</Text>
                <Text style={styles.metadataItem}>Date: {new Date().toLocaleDateString()}</Text>
              </View>
              
              <View style={styles.statistics}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{completedJobs}</Text>
                  <Text style={styles.statLabel}>Completed</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{inProgressJobs}</Text>
                  <Text style={styles.statLabel}>In Progress</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{pendingJobs}</Text>
                  <Text style={styles.statLabel}>Pending</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{highPriorityJobs}</Text>
                  <Text style={styles.statLabel}>High Priority</Text>
                </View>
              </View>
            </>
          )}

          {/* Jobs List */}
          {jobGroup.map((job, jobIndex) => {
            return (
            <View 
              key={job.job_id} 
              style={[
                styles.jobRow, 
                jobIndex % 2 === 0 ? {} : styles.jobRowAlternate
              ]} 
              wrap={false}
            >
              {/* Image Column */}
              <View style={styles.imageColumn}>
                {includeImages && ((job.images && job.images.length > 0) || (job.image_urls && job.image_urls.length > 0)) ? (
                  (() => {
                    let imageUrl: string | undefined;
                    let imageSource = 'none';
                    
                    if (job.images && job.images.length > 0) {
                      imageUrl = job.images[0].image_url;
                      imageSource = 'job.images[0].image_url';
                    } else if (job.image_urls && job.image_urls.length > 0) {
                      imageUrl = job.image_urls[0];
                      imageSource = 'job.image_urls[0]';
                    } else {
                      return (
                        <View style={[styles.jobImage, { backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' }]}>
                          <Text style={{ fontSize: 8, color: '#9ca3af' }}>No Image</Text>
                        </View>
                      );
                    }
                    
                    if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('data:')) {
                      const baseUrl = process.env.NEXT_PUBLIC_MEDIA_URL || (typeof window !== 'undefined' ? window.location.origin : '');
                      imageUrl = `${baseUrl}${imageUrl}`;
                    }
                    
                    const jpegPath = (job as any).images?.[0]?.jpeg_path as string | undefined;
                    if (jpegPath) {
                      const baseUrl = process.env.NEXT_PUBLIC_MEDIA_URL || (typeof window !== 'undefined' ? window.location.origin : '');
                      imageUrl = `${baseUrl}${jpegPath}`;
                    } else if (imageUrl) {
                      const cleanUrl = imageUrl.split('?')[0];
                      const imageExtension = cleanUrl.split('.').pop()?.toLowerCase();
                      const supportedFormats = ['jpg', 'jpeg', 'png', 'gif'];
                      if (imageExtension && !supportedFormats.includes(imageExtension)) {
                        return (
                          <View style={[styles.jobImage, { backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' }]}>
                            <Text style={{ fontSize: 8, color: '#ef4444', textAlign: 'center' }}>
                              {`Unsupported format: ${imageExtension.toUpperCase()}`}
                            </Text>
                            <Text style={{ fontSize: 6, color: '#9ca3af', textAlign: 'center' }}>
                              Convert to JPEG/PNG
                            </Text>
                          </View>
                        );
                      }
                    }
                    
                    return (
                      <Image
                        src={imageUrl as string}
                        style={styles.jobImage}
                        cache={false}
                      />
                    );
                  })()
                ) : (
                  <View style={[styles.jobImage, { backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ fontSize: 8, color: '#9ca3af' }}>No Image</Text>
                  </View>
                )}
              </View>

              {/* Information Column */}
              <View style={styles.infoColumn}>
                <Text style={styles.label}>Job ID:</Text>
                <Text style={styles.value}>{job.job_id}</Text>
                
                <Text style={styles.label}>Title:</Text>
                <Text style={styles.value}>{truncateText((job as any).title || 'No Title')}</Text>
                
                <Text style={styles.label}>Description:</Text>
                <Text style={styles.value}>{truncateText(job.description || 'No description')}</Text>
                
                {includeDetails && job.remarks && (
                  <>
                    <Text style={styles.label}>Remarks:</Text>
                    <Text style={styles.value}>{truncateText(job.remarks, 80)}</Text>
                  </>
                )}
                
                <Text style={styles.label}>Assigned To:</Text>
                <Text style={styles.value}>{getUserDisplayName(job.user)}</Text>
              </View>

              {/* Status Column */}
              <View style={styles.statusColumn}>
                <Text style={styles.label}>Status:</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(job.status) + '20', color: getStatusColor(job.status) }]}>
                  <Text style={[styles.statusBadge, { backgroundColor: 'transparent', color: getStatusColor(job.status) }]}>
                    {(job.status || 'unknown').replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
                
                <Text style={styles.label}>Priority:</Text>
                <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(job.priority) + '20', color: getPriorityColor(job.priority) }]}>
                  <Text style={[styles.priorityBadge, { backgroundColor: 'transparent', color: getPriorityColor(job.priority) }]}>
                    {(job.priority || 'normal').toUpperCase()}
                  </Text>
                </View>
                
                <Text style={styles.label}>Created:</Text>
                <Text style={styles.dateText}>{formatDate(job.created_at)}</Text>
                
                {job.completed_at && (
                  <>
                    <Text style={styles.label}>Completed:</Text>
                    <Text style={styles.dateText}>{formatDate(job.completed_at)}</Text>
                  </>
                )}
                
                {includeDetails && job.rooms && job.rooms.length > 0 && (
                  <>
                    <Text style={styles.label}>Location:</Text>
                    <Text style={styles.value}>
                      {job.rooms.map(room => room.name).join(', ')}
                    </Text>
                  </>
                )}
              </View>
            </View>
          );
        })}

          {/* Footer */}
          <View style={styles.footer} fixed>
            <Text>Generated by Facility Management System | {new Date().toLocaleDateString()}</Text>
          </View>

          {/* Page Number */}
          <Text 
            style={styles.pageNumber} 
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} 
            fixed 
          />
        </Page>
      ))}
    </Document>
  );
};

export default JobsPDFDocument;
export { JobsPDFDocument };