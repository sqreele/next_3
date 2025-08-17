"use client";
// ./app/components/document/JobsPDFGenerator.tsx
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@/app/lib/pdfRenderer';
import { Job, TabValue, FILTER_TITLES } from '@/app/lib/types';

interface JobsPDFDocumentProps {
  jobs: Job[];
  filter: TabValue;
  selectedProperty?: string | null;
  propertyName?: string;
}

const styles = StyleSheet.create({
  page: {
    padding: 30,
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
    fontSize: 10,
  },
  header: {
    marginBottom: 20,
    borderBottom: '2px solid #000000',
    paddingBottom: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 6,
    color: '#333333',
  },
  info: {
    fontSize: 10,
    color: '#666666',
    marginBottom: 4,
  },
  jobContainer: {
    marginBottom: 20,
    padding: 15,
    border: '1px solid #cccccc',
    backgroundColor: '#fafafa',
  },
  jobHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
    borderBottom: '1px solid #eeeeee',
    paddingBottom: 4,
  },
  jobRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#444444',
    width: '30%',
  },
  value: {
    fontSize: 10,
    color: '#666666',
    width: '70%',
  },
  statusHigh: {
    color: '#dc2626',
    fontWeight: 'bold',
  },
  statusMedium: {
    color: '#ea580c',
    fontWeight: 'bold',
  },
  statusLow: {
    color: '#16a34a',
    fontWeight: 'bold',
  },
  description: {
    fontSize: 9,
    color: '#555555',
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f9f9f9',
    border: '1px solid #eeeeee',
  },
  pageNumber: {
    position: 'absolute',
    bottom: 20,
    right: 30,
    fontSize: 10,
    color: '#888888',
  },
});

const JobsPDFDocument: React.FC<JobsPDFDocumentProps> = ({ 
  jobs, 
  filter, 
  selectedProperty, 
  propertyName 
}) => {
  console.log('🔄 Rendering PDF component...');
  
  // Safe data validation
  const safeJobs = Array.isArray(jobs) ? jobs.filter(job => job && job.job_id) : [];
  
  // Filter jobs safely
  const filteredJobs = safeJobs.filter((job) => {
    if (!selectedProperty) return true;
    try {
      return job.property_id === selectedProperty;
    } catch (error) {
      console.warn('Error filtering job:', error);
      return false;
    }
  });

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high': return styles.statusHigh;
      case 'medium': return styles.statusMedium;
      case 'low': return styles.statusLow;
      default: return styles.value;
    }
  };

  const getUserName = (user: any): string => {
    if (!user) return 'Unassigned';
    if (typeof user === 'string') return user;
    if (typeof user === 'object') {
      return user.name || user.username || user.displayName || 'User';
    }
    return 'User';
  };

  const truncateText = (text: string, maxLength: number = 150): string => {
    if (!text || typeof text !== 'string') return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  // Split jobs into pages (conservative number to avoid memory issues)
  const jobsPerPage = 3;
  const pageGroups = [];
  for (let i = 0; i < filteredJobs.length; i += jobsPerPage) {
    pageGroups.push(filteredJobs.slice(i, i + jobsPerPage));
  }

  // Handle empty case
  if (filteredJobs.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>No Jobs Found</Text>
            <Text style={styles.subtitle}>
              {propertyName || 'Property Report'}
            </Text>
            <Text style={styles.info}>
              No jobs match the selected criteria.
            </Text>
          </View>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      {pageGroups.map((jobGroup, pageIndex) => (
        <Page key={pageIndex} size="A4" style={styles.page}>
          {/* Header only on first page */}
          {pageIndex === 0 && (
            <View style={styles.header}>
              <Text style={styles.title}>
                {propertyName || 'Jobs Report'}
              </Text>
              <Text style={styles.subtitle}>
                {FILTER_TITLES[filter] || 'All Jobs'}
              </Text>
              <Text style={styles.info}>
                Total Jobs: {filteredJobs.length}
              </Text>
              <Text style={styles.info}>
                Generated: {formatDate(new Date().toISOString())}
              </Text>
            </View>
          )}

          {/* Jobs for this page */}
          {jobGroup.map((job, index) => {
            if (!job || !job.job_id) return null;

            return (
              <View key={job.job_id} style={styles.jobContainer} wrap={false}>
                <Text style={styles.jobHeader}>
                  Job #{job.job_id} - {(job.status || 'Unknown').replace('_', ' ')}
                </Text>
                
                <View style={styles.jobRow}>
                  <Text style={styles.label}>Location:</Text>
                  <Text style={styles.value}>
                    {job.rooms?.[0]?.name || 'N/A'}
                  </Text>
                </View>

                {job.rooms?.[0]?.room_type && (
                  <View style={styles.jobRow}>
                    <Text style={styles.label}>Room Type:</Text>
                    <Text style={styles.value}>
                      {job.rooms[0].room_type}
                    </Text>
                  </View>
                )}

                <View style={styles.jobRow}>
                  <Text style={styles.label}>Priority:</Text>
                  <Text style={[styles.value, getPriorityStyle(job.priority || 'medium')]}>
                    {(job.priority || 'Medium').toUpperCase()}
                  </Text>
                </View>

                <View style={styles.jobRow}>
                  <Text style={styles.label}>Assigned to:</Text>
                  <Text style={styles.value}>
                    {getUserName(job.user)}
                  </Text>
                </View>

                <View style={styles.jobRow}>
                  <Text style={styles.label}>Topics:</Text>
                  <Text style={styles.value}>
                    {job.topics?.length 
                      ? job.topics.map(t => t.title || 'N/A').join(', ') 
                      : 'None'
                    }
                  </Text>
                </View>

                <View style={styles.jobRow}>
                  <Text style={styles.label}>Created:</Text>
                  <Text style={styles.value}>
                    {formatDate(job.created_at)}
                  </Text>
                </View>

                <View style={styles.jobRow}>
                  <Text style={styles.label}>Updated:</Text>
                  <Text style={styles.value}>
                    {formatDate(job.updated_at)}
                  </Text>
                </View>

                {job.completed_at && (
                  <View style={styles.jobRow}>
                    <Text style={styles.label}>Completed:</Text>
                    <Text style={styles.value}>
                      {formatDate(job.completed_at)}
                    </Text>
                  </View>
                )}

                {job.description && (
                  <View style={styles.description}>
                    <Text style={styles.label}>Description:</Text>
                    <Text style={[styles.value, { marginTop: 4 }]}>
                      {truncateText(job.description)}
                    </Text>
                  </View>
                )}

                {job.remarks && (
                  <View style={styles.description}>
                    <Text style={styles.label}>Remarks:</Text>
                    <Text style={[styles.value, { marginTop: 4 }]}>
                      {truncateText(job.remarks)}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}

          {/* Page number */}
          <Text style={styles.pageNumber}>
            Page {pageIndex + 1} of {pageGroups.length}
          </Text>
        </Page>
      ))}
    </Document>
  );
};

export default JobsPDFDocument;
export { JobsPDFDocument };
