// ./app/components/document/JobsPDFGenerator.tsx
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { Job, TabValue, FILTER_TITLES } from '@/app/lib/types';

// ✅ Register Thai font (Sarabun)
Font.register({
  family: 'Sarabun',
  fonts: [
    { src: '/fonts/Sarabun-Regular.ttf', fontWeight: 'normal' },
    { src: '/fonts/Sarabun-Bold.ttf', fontWeight: 'bold' },
  ],
});

interface JobsPDFDocumentProps {
  jobs: Job[];
  filter: TabValue;
  selectedProperty?: string | null;
  propertyName?: string;
}

const styles = StyleSheet.create({
  page: {
    padding: 20,
    backgroundColor: '#ffffff',
    fontFamily: 'Sarabun',
  },
  header: {
    marginBottom: 15,
    borderBottomWidth: 1,
    borderColor: '#eee',
    paddingBottom: 10,
  },
  headerText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5
  },
  subHeaderText: {
    fontSize: 12,
    marginBottom: 5
  },
  jobRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#eee',
    paddingVertical: 8,
    paddingHorizontal: 5,
    minHeight: 80,
    maxHeight: 120,
    marginBottom: 5,
    break: false,
  },
  imageColumn: {
    width: '25%',
    marginRight: 10
  },
  infoColumn: {
    width: '40%',
    paddingRight: 8
  },
  dateColumn: {
    width: '35%'
  },
  jobImage: {
    width: '100%',
    height: 60,
    objectFit: 'cover'
  },
  label: {
    fontSize: 8,
    color: '#666',
    marginBottom: 1
  },
  value: {
    fontSize: 8,
    marginBottom: 3,
    lineHeight: 1.2
  },
  statusBadge: {
    fontSize: 8,
    color: '#1a56db',
    marginBottom: 3
  },
  priorityBadge: {
    fontSize: 8,
    marginBottom: 3
  },
  dateText: {
    fontSize: 8,
    marginBottom: 2,
    lineHeight: 1.1
  },
  truncatedText: {
    fontSize: 8,
    marginBottom: 3,
    lineHeight: 1.2,
    maxLines: 2,
  }
});

const JobsPDFDocument: React.FC<JobsPDFDocumentProps> = ({ 
  jobs, 
  filter, 
  selectedProperty, 
  propertyName 
}) => {
  const filteredJobs = jobs.filter((job) => {
    if (!selectedProperty) return true;

    return job.property_id === selectedProperty ||
      (job.profile_image?.properties.some(
        (prop) => String(prop.property_id) === selectedProperty
      )) || false;
  });

  const formatDate = (dateString: string | null): string => {
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

  const getPriorityColor = (priority: string): string => {
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
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const getImageUrl = (imageUrl: string): string => {
    if (imageUrl.startsWith('http')) {
      return imageUrl;
    }
    return `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${imageUrl}`;
  };

  // Split jobs into pages
  const jobsPerPage = 8;
  const pageGroups = [];
  for (let i = 0; i < filteredJobs.length; i += jobsPerPage) {
    pageGroups.push(filteredJobs.slice(i, i + jobsPerPage));
  }

  return (
    <Document>
      {pageGroups.map((jobGroup, pageIndex) => (
        <Page key={pageIndex} size="A4" style={styles.page}>
          {/* Header on first page only */}
          {pageIndex === 0 && (
            <View style={styles.header}>
              <Text style={styles.headerText}>{propertyName || 'Unnamed Property'}</Text>
              <Text style={styles.subHeaderText}>{FILTER_TITLES[filter] || 'Job Report'}</Text>
              <Text style={styles.label}>Total Jobs: {filteredJobs.length}</Text>
            </View>
          )}

          {/* Page number for subsequent pages */}
          {pageIndex > 0 && (
            <View style={{ marginBottom: 15, alignItems: 'center' }}>
              <Text style={styles.subHeaderText}>Page {pageIndex + 1}</Text>
            </View>
          )}

          {jobGroup.map((job) => (
            <View key={job.job_id} style={styles.jobRow} wrap={false}>
              <View style={styles.imageColumn}>
                {job.images && job.images.length > 0 ? (
                  <Image
                    src={getImageUrl(job.images[0].image_url)}
                    style={styles.jobImage}
                    cache={false}
                  />
                ) : (
                  <View style={[styles.jobImage, { backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ fontSize: 6, color: '#9ca3af' }}>No Image</Text>
                  </View>
                )}
              </View>

              <View style={styles.infoColumn}>
                <Text style={styles.label}>
                  Location: {job.rooms?.[0]?.name || 'N/A'}
                </Text>
                {job.rooms?.[0]?.room_type && (
                  <Text style={styles.label}>Room: {job.rooms[0].room_type}</Text>
                )}
                <Text style={styles.label}>
                  Topics: {job.topics?.length ? job.topics.map(t => t.title || 'N/A').join(', ') : 'None'}
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
                      {truncateText(job.description, 80)}
                    </Text>
                  </>
                )}
                {job.remarks && (
                  <>
                    <Text style={styles.label}>Remarks:</Text>
                    <Text style={styles.truncatedText}>
                      {truncateText(job.remarks, 80)}
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
        </Page>
      ))}
    </Document>
  );
};

export default JobsPDFDocument;
export { JobsPDFDocument };
