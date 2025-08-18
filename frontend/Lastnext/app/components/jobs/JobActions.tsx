"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, FileDown, Filter, SortAsc, SortDesc, Building, Calendar, DoorOpen } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import CreateJobButton from "@/app/components/jobs/CreateJobButton";
import { useProperty } from "@/app/lib/PropertyContext";
import { saveBlobAsPdf, generatePdfWithRetry } from "@/app/lib/pdfUtils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/app/components/ui/dropdown-menu";
import { SortOrder, Job, Property, TabValue, Room } from "@/app/lib/types";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Calendar as CalendarComponent } from "@/app/components/ui/calendar";

type DateFilter = "all" | "today" | "yesterday" | "thisWeek" | "thisMonth" | "custom";

interface PropertyContextType {
  selectedProperty: string | null;
  setSelectedProperty: (propertyId: string | null) => void;
}

interface JobActionsProps {
  onSort?: (order: SortOrder) => void;
  currentSort?: SortOrder;
  onDateFilter?: (filter: DateFilter, startDate?: Date, endDate?: Date) => void;
  currentDateFilter?: DateFilter;
  onRoomFilter?: (roomId: string | null) => void;
  currentRoomFilter?: string | null;
  jobs?: Job[];
  onRefresh?: () => void;
  currentTab?: TabValue;
  properties?: Property[];
}

export default function JobActions({
  onSort,
  currentSort = "Newest first",
  onDateFilter,
  currentDateFilter = "all",
  onRoomFilter,
  currentRoomFilter = null,
  jobs = [],
  onRefresh,
  currentTab = "all",
  properties = [],
}: JobActionsProps) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomSearch, setRoomSearch] = useState<string>("");
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const { selectedProperty, setSelectedProperty } = useProperty() as PropertyContextType;
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});

  const getDateFilterLabel = (filter: DateFilter) => {
    switch (filter) {
      case "today": return "Today";
      case "yesterday": return "Yesterday";
      case "thisWeek": return "This Week";
      case "thisMonth": return "This Month";
      case "custom": return "Custom Range";
      default: return "All Time";
    }
  };

  const handleRefresh = () => {
    onRefresh ? onRefresh() : router.refresh();
  };

  const getPropertyName = (propertyId: string | null) => {
    if (!propertyId) return "All Properties";
    const property = properties.find((p) => p.property_id === propertyId);
    return property?.name || "Unknown Property";
  };

  const getRoomName = (roomId: string | null) => {
    if (!roomId) return "All Rooms";
    const room = rooms.find((r) => String(r.room_id) === roomId);
    console.log('🏠 Room lookup:', { roomId, foundRoom: room, totalRooms: rooms.length });
    return room?.name || "Unknown Room";
  };

  // Fetch rooms when property changes
  useEffect(() => {
    const fetchRooms = async () => {
      if (!selectedProperty) {
        setRooms([]);
        setRoomSearch("");
        return;
      }

      setIsLoadingRooms(true);
      try {
        console.log('🔄 Fetching rooms for property:', selectedProperty);
        const response = await fetch(`/api/rooms/?property=${selectedProperty}`);
        if (response.ok) {
          const roomsData = await response.json();
          console.log('📋 Rooms fetched:', roomsData);
          setRooms(roomsData);
          setRoomSearch("");
        } else {
          console.error('❌ Failed to fetch rooms:', response.status);
          setRooms([]);
        }
      } catch (error) {
        console.error('❌ Error fetching rooms:', error);
        setRooms([]);
      } finally {
        setIsLoadingRooms(false);
      }
    };

    fetchRooms();
  }, [selectedProperty]);

  const handleDateFilterChange = (filter: DateFilter) => {
    if (onDateFilter) {
      if (filter === "custom") {
        setIsCustomDateOpen(true);
        return;
      } else {
        onDateFilter(filter);
      }
    }
  };

  const handleApplyCustomRange = () => {
    if (!onDateFilter) return;
    if (customRange.from && customRange.to) {
      onDateFilter("custom", customRange.from, customRange.to);
      setIsCustomDateOpen(false);
    }
  };

  const handleClearCustomRange = () => {
    setCustomRange({});
    onDateFilter?.("all");
    setIsCustomDateOpen(false);
  };

  const handleCloseCustomRange = () => {
    setIsCustomDateOpen(false);
  };

  const handleGeneratePDF = async () => {
    if (!jobs.length) {
      alert("No jobs available to generate a PDF.");
      return;
    }

    try {
      setIsGenerating(true);
      console.log('🔄 Starting PDF generation...');
      console.log('📊 Jobs available:', jobs.length);
      console.log('🏢 Selected property:', selectedProperty);
      
      const propertyName = getPropertyName(selectedProperty);
      console.log('🏷️ Property name:', propertyName);

      // Use the jobs already filtered by the UI
      const filteredJobs = jobs;

      console.log('📋 Exporting jobs count (from UI):', filteredJobs.length);

      if (filteredJobs.length === 0) {
        alert("No jobs found for the selected criteria.");
        return;
      }

      // Dynamic imports to avoid SSR issues
      console.log('📦 Loading PDF modules...');
      const { generatePdfBlob } = await import('@/app/lib/pdfRenderer');
      const { default: JobsPDFDocument } = await import('@/app/components/document/JobsPDFGenerator');

      console.log('📄 Creating PDF document component...');
      const pdfDocument = React.createElement(JobsPDFDocument, {
        jobs: filteredJobs,
        filter: currentTab,
        selectedProperty: selectedProperty,
        propertyName: propertyName,
      });

      console.log('⚙️ Generating PDF blob...');
      const blob = await generatePdfWithRetry(() => generatePdfBlob(pdfDocument), 3);

      if (!blob || blob.size === 0) {
        throw new Error('Generated PDF is empty');
      }

      console.log('✅ PDF generated successfully, size:', blob.size, 'bytes');

      // Save the PDF
      const date = format(new Date(), "yyyy-MM-dd");
      const cleanPropertyName = propertyName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-');
      const filename = `jobs-report-${cleanPropertyName}-${date}.pdf`;
      
      console.log('💾 Saving PDF as:', filename);
      await saveBlobAsPdf(blob, filename);
      console.log('🎉 PDF saved successfully!');

    } catch (error) {
      console.error("❌ PDF generation failed:", error);
      console.error("📚 Error stack:", error instanceof Error ? error.stack : 'No stack trace available');
      console.error("🔍 Error details:", {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown',
        cause: error instanceof Error ? error.cause : undefined
      });
      
      let errorMessage = 'Failed to generate PDF. ';
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : 'Unknown';
      
      // More specific error detection
      if (errorMsg.includes('pdf') || errorName.includes('PDF')) {
        errorMessage += 'PDF library error - check browser compatibility. ';
      } else if (errorMsg.includes('toBlob') || errorMsg.includes('blob')) {
        errorMessage += 'PDF conversion error - try refreshing the page. ';
      } else if (errorMsg.includes('empty') || errorMsg.includes('size')) {
        errorMessage += 'No content generated - check job data. ';
      } else if (errorMsg.includes('import') || errorMsg.includes('module')) {
        errorMessage += 'Module loading error - refresh and try again. ';
      } else if (errorMsg.includes('function') || errorName === 'TypeError') {
        errorMessage += 'Library function error - check PDF renderer setup. ';
      } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
        errorMessage += 'Network error loading resources. ';
      } else {
        errorMessage += `Technical error: ${errorMsg}. `;
      }
      
      errorMessage += '\n\nTroubleshooting:\n';
      errorMessage += '• Refresh the page and try again\n';
      errorMessage += '• Check your internet connection\n';
      errorMessage += '• Try with fewer jobs selected\n';
      errorMessage += '• Use a different browser if issue persists\n';
      errorMessage += '• Contact support for assistance';
      
      alert(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  // Test PDF generation function (for debugging)
  const testPDFGeneration = async () => {
    try {
      console.log('🧪 Running comprehensive PDF test...');
      
      // Run the test
      const { testPdfGeneration } = await import('@/app/lib/testPdf');
      const result = await testPdfGeneration();
      
      if (result.success) {
        alert(`✅ PDF test passed! Generated ${result.blobSize} bytes`);
      } else {
        console.error('❌ PDF test failed:', result);
        alert(`❌ PDF test failed: ${result.error}\n\nCheck console for details.`);
      }
    } catch (error) {
      console.error('❌ Test execution failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`❌ Test execution failed: ${errorMessage}`);
    }
  };

  const exportCount = jobs.length;

  const menuItemClass = "flex items-center gap-2 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-800 hover:text-white cursor-pointer";
  const menuLabelClass = "text-xs font-semibold text-zinc-400 px-3 py-1.5";
  const dropdownContentClass = "w-[200px] bg-zinc-950 border-zinc-800 rounded-lg shadow-lg";
  const buttonClass = "flex items-center gap-2 text-sm h-9";

  return (
    <div className="flex items-center gap-2">
      {/* Desktop Actions */}
      <div className="hidden md:flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className={buttonClass}>
              <Building className="h-4 w-4" />
              <span className="truncate max-w-[120px]">{getPropertyName(selectedProperty)}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={dropdownContentClass}>
            <DropdownMenuLabel className={menuLabelClass}>Properties</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setSelectedProperty(null)} className={menuItemClass}>
              <Building className="h-4 w-4" />
              All Properties
            </DropdownMenuItem>
            {properties.map((property) => (
              <DropdownMenuItem
                key={property.property_id}
                onClick={() => setSelectedProperty(property.property_id)}
                className={menuItemClass}
              >
                <Building className="h-4 w-4" />
                <span className="truncate">{property.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className={buttonClass}>
              <Calendar className="h-4 w-4" />
              <span>{getDateFilterLabel(currentDateFilter)}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={dropdownContentClass}>
            <DropdownMenuLabel className={menuLabelClass}>Date Range</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleDateFilterChange("all")} className={menuItemClass}>
              <Calendar className="h-4 w-4 opacity-70" /> All Time
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDateFilterChange("today")} className={menuItemClass}>
              <Calendar className="h-4 w-4 opacity-70" /> Today
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDateFilterChange("yesterday")} className={menuItemClass}>
              <Calendar className="h-4 w-4 opacity-70" /> Yesterday
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDateFilterChange("thisWeek")} className={menuItemClass}>
              <Calendar className="h-4 w-4 opacity-70" /> This Week
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDateFilterChange("thisMonth")} className={menuItemClass}>
              <Calendar className="h-4 w-4 opacity-70" /> This Month
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDateFilterChange("custom")} className={menuItemClass}>
              <Calendar className="h-4 w-4 opacity-70" /> Custom Range
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              className={buttonClass}
              disabled={!selectedProperty || isLoadingRooms}
            >
              <DoorOpen className="h-4 w-4" />
              <span className="truncate max-w-[120px]">
                {isLoadingRooms ? "Loading..." : getRoomName(currentRoomFilter)}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={dropdownContentClass}>
            <DropdownMenuLabel className={menuLabelClass}>Rooms</DropdownMenuLabel>
            <div className="px-2 pb-1">
              <input
                type="text"
                value={roomSearch}
                onChange={(e) => setRoomSearch(e.target.value)}
                placeholder="Search room number, name, or type..."
                className="w-full h-8 px-2 text-xs rounded bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none"
                disabled={!selectedProperty}
              />
            </div>
            <DropdownMenuItem 
              onClick={() => onRoomFilter?.(null)} 
              className={menuItemClass}
              disabled={!selectedProperty}
            >
              <DoorOpen className="h-4 w-4" />
              All Rooms
            </DropdownMenuItem>
            {rooms
              .filter((room) => {
                if (!roomSearch) return true;
                const q = roomSearch.toLowerCase();
                const byId = String(room.room_id ?? '').toLowerCase().includes(q);
                const byName = (room.name ?? '').toLowerCase().includes(q);
                const byType = (room.room_type ?? '').toLowerCase().includes(q);
                return byId || byName || byType;
              })
              .map((room) => (
              <DropdownMenuItem
                key={room.room_id}
                onClick={() => onRoomFilter?.(String(room.room_id))}
                className={menuItemClass}
              >
                <DoorOpen className="h-4 w-4" />
                <span className="truncate">{room.name}</span>
              </DropdownMenuItem>
            ))}
            {rooms.length === 0 && selectedProperty && !isLoadingRooms && (
              <DropdownMenuItem disabled className={menuItemClass}>
                <span className="text-zinc-500">No rooms available</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className={buttonClass}>
              <Filter className="h-4 w-4" />
              <span>{currentSort}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={dropdownContentClass}>
            <DropdownMenuLabel className={menuLabelClass}>Sort Order</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onSort?.("Newest first")} className={menuItemClass}>
              <SortDesc className="h-4 w-4" /> Newest first
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSort?.("Oldest first")} className={menuItemClass}>
              <SortAsc className="h-4 w-4" /> Oldest first
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="sm"
          onClick={handleGeneratePDF}
          disabled={isGenerating || exportCount === 0}
          className={buttonClass}
        >
          <FileDown className="h-4 w-4" />
          {isGenerating ? "Generating..." : `Export (${exportCount})`}
        </Button>

        {/* Debug button - remove in production */}
        {process.env.NODE_ENV === 'development' && (
          <Button
            variant="outline"
            size="sm"
            onClick={testPDFGeneration}
            className={buttonClass}
          >
            Test PDF
          </Button>
        )}

        <CreateJobButton onJobCreated={handleRefresh} propertyId={selectedProperty ?? ""} />

      </div>

      {/* Mobile Actions */}
      <div className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="w-9 h-9 p-0 flex items-center justify-center">
              <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={`${dropdownContentClass} max-h-[75vh] overflow-y-auto`} sideOffset={5}>
            <DropdownMenuLabel className={menuLabelClass}>Properties</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setSelectedProperty(null)} className={menuItemClass}>
              <Building className="h-4 w-4" /> All Properties
            </DropdownMenuItem>
            {properties.map((property) => (
              <DropdownMenuItem
                key={property.property_id}
                onClick={() => setSelectedProperty(property.property_id)}
                className={menuItemClass}
              >
                <Building className="h-4 w-4" />
                <span className="truncate">{property.name}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="bg-zinc-800 my-1" />

            <DropdownMenuLabel className={menuLabelClass}>Rooms</DropdownMenuLabel>
            <div className="px-2 pb-1">
              <input
                type="text"
                value={roomSearch}
                onChange={(e) => setRoomSearch(e.target.value)}
                placeholder="Search room number, name, or type..."
                className="w-full h-8 px-2 text-xs rounded bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none"
                disabled={!selectedProperty}
              />
            </div>
            <DropdownMenuItem 
              onClick={() => onRoomFilter?.(null)} 
              className={menuItemClass}
              disabled={!selectedProperty}
            >
              <DoorOpen className="h-4 w-4" /> All Rooms
            </DropdownMenuItem>
            {rooms
              .filter((room) => {
                if (!roomSearch) return true;
                const q = roomSearch.toLowerCase();
                const byId = String(room.room_id ?? '').toLowerCase().includes(q);
                const byName = (room.name ?? '').toLowerCase().includes(q);
                const byType = (room.room_type ?? '').toLowerCase().includes(q);
                return byId || byName || byType;
              })
              .map((room) => (
              <DropdownMenuItem
                key={room.room_id}
                onClick={() => onRoomFilter?.(String(room.room_id))}
                className={menuItemClass}
              >
                <DoorOpen className="h-4 w-4" />
                <span className="truncate">{room.name}</span>
              </DropdownMenuItem>
            ))}
            {rooms.length === 0 && selectedProperty && !isLoadingRooms && (
              <DropdownMenuItem disabled className={menuItemClass}>
                <span className="text-zinc-500">No rooms available</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-zinc-800 my-1" />

            <DropdownMenuLabel className={menuLabelClass}>Date Range</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleDateFilterChange("all")} className={menuItemClass}>
              <Calendar className="h-4 w-4" /> All Time
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDateFilterChange("today")} className={menuItemClass}>
              <Calendar className="h-4 w-4" /> Today
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDateFilterChange("yesterday")} className={menuItemClass}>
              <Calendar className="h-4 w-4" /> Yesterday
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDateFilterChange("thisWeek")} className={menuItemClass}>
              <Calendar className="h-4 w-4" /> This Week
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDateFilterChange("thisMonth")} className={menuItemClass}>
              <Calendar className="h-4 w-4" /> This Month
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDateFilterChange("custom")} className={menuItemClass}>
              <Calendar className="h-4 w-4" /> Custom Range
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-zinc-800 my-1" />

            <DropdownMenuLabel className={menuLabelClass}>Sort By</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onSort?.("Newest first")} className={menuItemClass}>
              <SortDesc className="h-4 w-4" /> Newest first
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSort?.("Oldest first")} className={menuItemClass}>
              <SortAsc className="h-4 w-4" /> Oldest first
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-zinc-800 my-1" />

            <DropdownMenuItem onClick={handleGeneratePDF} disabled={isGenerating || exportCount === 0} className={menuItemClass}>
              <FileDown className="h-4 w-4" />
              {isGenerating ? "Generating..." : `Export PDF (${exportCount})`}
            </DropdownMenuItem>

            {/* Debug button for mobile - remove in production */}
            {process.env.NODE_ENV === 'development' && (
              <>
                <DropdownMenuSeparator className="bg-zinc-800 my-1" />
                <DropdownMenuItem onClick={testPDFGeneration} className={menuItemClass}>
                  <FileDown className="h-4 w-4" /> Test PDF
                </DropdownMenuItem>
              </>
            )}

            <DropdownMenuSeparator className="bg-zinc-800 my-1" />

            <DropdownMenuItem onClick={handleRefresh} className={menuItemClass}>
              <Plus className="h-4 w-4" /> Create Job
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Custom Date Range Dialog */}
      <Dialog open={isCustomDateOpen} onOpenChange={setIsCustomDateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select custom date range</DialogTitle>
          </DialogHeader>
          <div className="p-1">
            <CalendarComponent
              initialFocus
              mode="range"
              numberOfMonths={1}
              selected={customRange}
              onSelect={(range) => setCustomRange(range || {})}
            />
          </div>
          <DialogFooter>
            <div className="flex items-center justify-end gap-2 w-full">
              <Button variant="ghost" onClick={handleClearCustomRange}>Clear</Button>
              <Button variant="outline" onClick={handleCloseCustomRange}>Cancel</Button>
              <Button onClick={handleApplyCustomRange} disabled={!customRange.from || !customRange.to}>Apply</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
