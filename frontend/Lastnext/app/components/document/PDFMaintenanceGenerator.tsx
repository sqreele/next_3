// PDFMaintenanceGenerator.tsx
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  FileText, 
  Download, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Filter,
  Printer,
  Building,
  Settings,
  ArrowLeft
} from 'lucide-react';
import { 
  PreventiveMaintenance, 
  MachineDetails,
  Topic,
  determinePMStatus,
  getImageUrl,
  getMachinesString,
  getLocationString,
  itemMatchesMachine
} from '@/app/lib/preventiveMaintenanceModels';
import { usePreventiveMaintenance } from '@/app/lib/PreventiveContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface InitialFilters {
  status: string;
  frequency: string;
  search: string;
  startDate: string;
  endDate: string;
  machineId: string;
  page: number;
  pageSize: number;
  topic?: string;
}

interface PDFMaintenanceGeneratorProps {
  initialFilters?: InitialFilters;
}

interface MachineOption {
  id: string;
  label: string;
}

const PDFMaintenanceGenerator: React.FC<PDFMaintenanceGeneratorProps> = ({ initialFilters }) => {
  const router = useRouter();
  const { maintenanceItems, fetchMaintenanceItems, topics } = usePreventiveMaintenance();
  const printRef = useRef<HTMLDivElement>(null);
  
  // State management
  const [filterStatus, setFilterStatus] = useState(initialFilters?.status || 'all');
  const [filterFrequency, setFilterFrequency] = useState(initialFilters?.frequency || 'all');
  const [filterMachine, setFilterMachine] = useState(initialFilters?.machineId || 'all');
  const [dateRange, setDateRange] = useState({ 
    start: initialFilters?.startDate || '', 
    end: initialFilters?.endDate || '' 
  });
  const [searchTerm, setSearchTerm] = useState(initialFilters?.search || '');
  const [includeCompleted, setIncludeCompleted] = useState(true);
  const [includeDetails, setIncludeDetails] = useState(true);
  const [includeImages, setIncludeImages] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [imageDataUrls, setImageDataUrls] = useState<{[key: string]: string}>({});
  const [filterTopic, setFilterTopic] = useState(initialFilters?.topic || 'all');

  // Memoized calculations
  const maintenanceData = useMemo(() => maintenanceItems || [], [maintenanceItems]);

  const getUniqueMachines = useCallback((): MachineOption[] => {
    const machineOptions: MachineOption[] = [];
    const seen = new Set<string>();
    
    maintenanceData.forEach(item => {
      if (item.machines && Array.isArray(item.machines)) {
        item.machines.forEach(machine => {
          if (typeof machine === 'object' && machine !== null && machine.machine_id && !seen.has(machine.machine_id)) {
            seen.add(machine.machine_id);
            machineOptions.push({
              id: machine.machine_id,
              label: `${machine.name} (${machine.machine_id})`
            });
          }
        });
      }
    });
    
    return machineOptions.sort((a, b) => a.label.localeCompare(b.label));
  }, [maintenanceData]);

  const filteredData = useMemo(() => {
    return maintenanceData.filter((item: PreventiveMaintenance) => {
      const actualStatus = determinePMStatus(item);
      const statusMatch = filterStatus === 'all' || actualStatus === filterStatus;
      const frequencyMatch = filterFrequency === 'all' || item.frequency === filterFrequency;
      const machineMatch = itemMatchesMachine(item, filterMachine);
      
      const searchMatch = !searchTerm || 
        item.pmtitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.pm_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getMachinesString(item.machines).toLowerCase().includes(searchTerm.toLowerCase());
      
      let dateMatch = true;
      if (dateRange.start && dateRange.end) {
        const itemDate = new Date(item.scheduled_date);
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        dateMatch = itemDate >= startDate && itemDate <= endDate;
      }
      
      const completedMatch = includeCompleted || actualStatus !== 'completed';
      const topicMatch = filterTopic === 'all' || (item.topics && item.topics.some((t: any) => t.id === filterTopic));
      
      return statusMatch && frequencyMatch && machineMatch && dateMatch && completedMatch && searchMatch && topicMatch;
    });
  }, [maintenanceData, filterStatus, filterFrequency, filterMachine, searchTerm, dateRange, includeCompleted, filterTopic]);

  // Image processing
  const convertImageToBase64 = useCallback(async (imageUrl: string): Promise<string> => {
    try {
      // Use fetch + FileReader to avoid canvas tainting issues
      const response = await fetch(imageUrl, { cache: 'no-store' });
      if (!response.ok) {
        console.warn('Image fetch failed:', imageUrl, response.status, response.statusText);
        return imageUrl;
      }
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) {
        console.warn('Fetched non-image content for', imageUrl, 'got', blob.type);
        return imageUrl;
      }
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(imageUrl);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error in convertImageToBase64:', error);
      return imageUrl;
    }
  }, []);

  // Effects
  useEffect(() => {
    const loadData = async () => {
      if (initialFilters) {
        await fetchMaintenanceItems({
          status: initialFilters.status,
          frequency: initialFilters.frequency,
          search: initialFilters.search,
          start_date: initialFilters.startDate,
          end_date: initialFilters.endDate,
          machine_id: initialFilters.machineId,
          page: initialFilters.page,
          page_size: initialFilters.pageSize
        });
      }
      setIsLoading(false);
    };
    
    loadData();
  }, [initialFilters, fetchMaintenanceItems]);

  useEffect(() => {
    const convertImages = async () => {
      if (!includeImages || filteredData.length === 0) {
        setImageDataUrls({});
        return;
      }
      
      const newImageDataUrls: {[key: string]: string} = {};
      
      try {
        for (const item of filteredData) {
          if (item.before_image_url) {
            const safeUrl = getImageUrl(item.before_image_url);
            if (safeUrl) {
              newImageDataUrls[`before_${item.id}`] = await convertImageToBase64(safeUrl);
            }
          }
          
          if (item.after_image_url) {
            const safeUrl = getImageUrl(item.after_image_url);
            if (safeUrl) {
              newImageDataUrls[`after_${item.id}`] = await convertImageToBase64(safeUrl);
            }
          }
        }
        
        setImageDataUrls(newImageDataUrls);
      } catch (error) {
        console.error('Error converting images:', error);
        setImageDataUrls({});
      }
    };

    convertImages();
  }, [filteredData, includeImages, convertImageToBase64]);

  // Utility functions
  const formatDate = useCallback((dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid Date';
    }
  }, []);

  const getStatusColor = useCallback((item: PreventiveMaintenance): string => {
    const status = determinePMStatus(item);
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'pending': return 'text-yellow-600';
      case 'overdue': return 'text-red-600';
      default: return 'text-gray-600';
    }
  }, []);

  const getFrequencyColor = useCallback((frequency: string): string => {
    switch (frequency) {
      case 'daily': return 'text-blue-600';
      case 'weekly': return 'text-green-600';
      case 'monthly': return 'text-yellow-600';
      case 'quarterly': return 'text-orange-600';
      case 'yearly': return 'text-red-600';
      default: return 'text-gray-600';
    }
  }, []);

  const generatePDF = useCallback(async () => {
    const element = printRef.current;
    if (!element) {
      console.error('PDF content element not found');
      return;
    }

    try {
      setIsGeneratingPDF(true);

      if (includeImages) {
        const images = element.querySelectorAll('img');
        await Promise.all(Array.from(images).map((img) => {
          return new Promise((resolve) => {
            if (img.complete && img.naturalHeight !== 0) {
              resolve(img);
            } else {
              const onLoad = () => resolve(img);
              const onError = () => resolve(img);
              
              img.addEventListener('load', onLoad);
              img.addEventListener('error', onError);
              
              setTimeout(() => resolve(img), 10000);
            }
          });
        }));
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 30000,
        removeContainer: true,
        foreignObjectRendering: false,
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 10;
      const contentWidth = pdfWidth - (margin * 2);
      const contentHeight = pdfHeight - (margin * 2);
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      const scale = contentWidth / (imgWidth * 0.264583);
      const scaledWidth = contentWidth;
      const scaledHeight = (imgHeight * 0.264583) * scale;
      
      let position = margin;
      let remainingHeight = scaledHeight;

      pdf.addImage(imgData, 'PNG', margin, position, scaledWidth, scaledHeight);
      remainingHeight -= contentHeight;

      while (remainingHeight > 0) {
        position = -(scaledHeight - remainingHeight) + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, scaledWidth, scaledHeight);
        remainingHeight -= contentHeight;
      }

      const fileName = `preventive-maintenance-report-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  }, [includeImages]);

  const downloadHTML = useCallback(() => {
    const htmlContent = printRef.current?.outerHTML;
    if (!htmlContent) return;
    
    const fullHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Preventive Maintenance List</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            line-height: 1.6; 
            background: #ffffff;
          }
          .header { 
            text-align: center; 
            margin-bottom: 30px; 
            border-bottom: 2px solid #ccc; 
            padding-bottom: 20px; 
          }
          .maintenance-item { 
            margin-bottom: 20px; 
            border: 1px solid #ddd; 
            padding: 15px; 
            border-radius: 8px; 
            page-break-inside: avoid; 
          }
          @media print {
            body { margin: 0; font-size: 12px; }
            .no-print { display: none !important; }
            .maintenance-item { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `;
    
    const blob = new Blob([fullHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `preventive-maintenance-list-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading maintenance data...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Controls Section */}
      <div className="no-print mb-8 bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Link
              href="/dashboard/preventive-maintenance"
              className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 mr-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to List
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <FileText className="h-6 w-6 mr-2 text-blue-600" />
              Generate Maintenance PDF Report
            </h1>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={generatePDF}
              disabled={isGeneratingPDF}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingPDF ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Generating PDF...
                </>
              ) : (
                <>
                  <Printer className="h-4 w-4 mr-2" />
                  Generate PDF
                </>
              )}
            </button>
            <button
              onClick={downloadHTML}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="h-4 w-4 mr-2" />
              Download HTML
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status Filter</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Frequency Filter</label>
            <select
              value={filterFrequency}
              onChange={(e) => setFilterFrequency(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Frequencies</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Machine Filter</label>
            <select
              value={filterMachine}
              onChange={(e) => setFilterMachine(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Machines</option>
              {getUniqueMachines().map(machine => (
                <option key={machine.id} value={machine.id}>
                  {machine.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tasks..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Topic Filter */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Topic</label>
          <select
            value={filterTopic}
            onChange={(e) => setFilterTopic(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Topics</option>
            {topics.map(topic => (
              <option key={topic.id} value={topic.id}>{topic.title}</option>
            ))}
          </select>
        </div>

        {/* Options */}
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={includeCompleted}
              onChange={(e) => setIncludeCompleted(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 mr-2"
            />
            Include Completed Tasks
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={includeDetails}
              onChange={(e) => setIncludeDetails(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 mr-2"
            />
            Include Detailed Descriptions
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={includeImages}
              onChange={(e) => setIncludeImages(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 mr-2"
            />
            Include Before/After Images
          </label>
        </div>

        {/* Data Status */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Data Status:</strong> Found {maintenanceData.length} total maintenance records, 
            showing {filteredData.length} after filters
            {includeImages && Object.keys(imageDataUrls).length > 0 && (
              <span className="block mt-1">
                <strong>Images:</strong> {Object.keys(imageDataUrls).length} images converted
              </span>
            )}
          </p>
        </div>
      </div>

      {/* PDF Content */}
      <div 
        ref={printRef}
        className="bg-white mx-auto"
        style={{ 
          width: '794px',
          maxWidth: '100%',
          padding: '40px',
          fontFamily: 'Arial, sans-serif',
          lineHeight: '1.6',
          color: '#000000'
        }}
      >
        {/* Header */}
        <div className="text-center mb-8 border-b-2 border-gray-300 pb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Preventive Maintenance Report</h1>
          <p className="text-gray-600">Generated on {formatDate(new Date().toISOString())}</p>
          <div className="flex justify-center items-center mt-4 text-sm text-gray-500">
            <Building className="h-4 w-4 mr-2" />
            Facility Management System
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="mb-8 bg-gray-50 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Summary Statistics
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{filteredData.length}</div>
              <div className="text-sm text-gray-600">Total Tasks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {filteredData.filter(item => determinePMStatus(item) === 'completed').length}
              </div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {filteredData.filter(item => determinePMStatus(item) === 'pending').length}
              </div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {filteredData.filter(item => determinePMStatus(item) === 'overdue').length}
              </div>
              <div className="text-sm text-gray-600">Overdue</div>
            </div>
          </div>
        </div>

        {/* Maintenance Tasks Table */}
        {filteredData.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <CheckCircle className="h-5 w-5 mr-2" />
              Maintenance Tasks
            </h2>
            
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold">Task ID</th>
                    <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold">Title</th>
                    <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold">Date</th>
                    <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold">Status</th>
                    <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold">Frequency</th>
                    <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold">Machines</th>
                    <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item) => (
                    <tr key={item.id}>
                      <td className="border border-gray-300 px-3 py-2 font-mono text-xs">{item.pm_id}</td>
                      <td className="border border-gray-300 px-3 py-2 font-medium text-xs">
                        {item.pmtitle || 'No title'}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-xs">{formatDate(item.scheduled_date)}</td>
                      <td className={`border border-gray-300 px-3 py-2 font-medium text-xs ${getStatusColor(item)}`}>
                        <span className="capitalize">{determinePMStatus(item)}</span>
                      </td>
                      <td className={`border border-gray-300 px-3 py-2 font-medium text-xs ${getFrequencyColor(item.frequency)}`}>
                        <span className="capitalize">{item.frequency}</span>
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-xs">
                        {getMachinesString(item.machines)}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-xs">
                        {getLocationString(item)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detailed View Section */}
        {includeDetails && filteredData.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-6 flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              Detailed Task Information
            </h2>
            
            {filteredData.map((item) => (
              <div key={item.id} className="mb-6 border border-gray-300 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {item.pmtitle || 'No title'} ({item.pm_id})
                    </h3>
                    <div className="space-y-1 text-sm">
                      <div><strong>Scheduled Date:</strong> {formatDate(item.scheduled_date)}</div>
                      <div><strong>Status:</strong> <span className={`font-medium ${getStatusColor(item)} capitalize`}>{determinePMStatus(item)}</span></div>
                      <div><strong>Frequency:</strong> <span className={`font-medium ${getFrequencyColor(item.frequency)} capitalize`}>{item.frequency}</span></div>
                    </div>
                  </div>
                  <div>
                    <div className="space-y-1 text-sm">
                      <div><strong>Machines:</strong> {getMachinesString(item.machines)}</div>
                      <div><strong>Location:</strong> {getLocationString(item)}</div>
                    </div>
                  </div>
                </div>
                
                {item.notes && (
                  <div className="border-t border-gray-200 pt-3">
                    <h4 className="font-medium text-gray-900 mb-2">Notes:</h4>
                    <p className="text-sm text-gray-700">{item.notes}</p>
                  </div>
                )}

                {includeImages && (item.before_image_url || item.after_image_url) && (
                  <div className="border-t border-gray-200 pt-3 mt-3">
                    <h4 className="font-medium text-gray-900 mb-3">Images:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {item.before_image_url && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">Before:</p>
                          <img 
                            src={imageDataUrls[`before_${item.id}`] || getImageUrl(item.before_image_url)} 
                            alt="Before maintenance"
                            className="w-full h-auto rounded border border-gray-300"
                            style={{ 
                              maxHeight: '250px', 
                              objectFit: 'contain',
                              display: 'block',
                              margin: '0 auto',
                              backgroundColor: '#f9f9f9'
                            }}
                            crossOrigin="anonymous"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      {item.after_image_url && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">After:</p>
                          <img 
                            src={imageDataUrls[`after_${item.id}`] || getImageUrl(item.after_image_url)} 
                            alt="After maintenance"
                            className="w-full h-auto rounded border border-gray-300"
                            style={{ 
                              maxHeight: '250px', 
                              objectFit: 'contain',
                              display: 'block',
                              margin: '0 auto',
                              backgroundColor: '#f9f9f9'
                            }}
                            crossOrigin="anonymous"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-300 pt-4 text-center text-sm text-gray-500">
          <p>This report was automatically generated by the Facility Management System</p>
          <p>© 2025 - Confidential and Proprietary Information</p>
        </div>
      </div>

      {/* No data message */}
      {filteredData.length === 0 && (
        <div className="no-print text-center py-12">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No maintenance tasks found</h3>
          <p className="text-gray-600">
            {maintenanceData.length === 0 
              ? "No maintenance data is available. Please ensure maintenance records are loaded."
              : "Try adjusting your filters to see more results."
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default PDFMaintenanceGenerator;
