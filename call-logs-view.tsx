"use client"

import React, { useState, useRef, useEffect, useMemo } from "react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { PowerMomentWidget } from "@/components/custom/power-moment-widget"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Play, Pause, Pencil, BarChart2, Check, X, ArrowLeft, ChevronLeft, ChevronRight, Zap } from 'lucide-react'
import { formatDateShort } from '@/utils/formatters'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import Image from 'next/image'
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { ChevronDown } from 'lucide-react'
import { Calendar } from "./calendar"
import { Slider } from "@/components/ui/slider"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils";

function parseTranscript(transcript: string) {
  if (!transcript) return [];
  
  // Split by 'role:' but keep 'role:' at the start of each part
  const parts = transcript.split(/(?=role:)/).filter(Boolean);
  
  return parts.map(part => {
    // Extract role and message using regex
    const roleMatch = part.match(/role:\s*(\w+)/);
    const messageMatch = part.match(/message:\s*(.*?)(?=(?:\s*role:|$))/);
    
    if (roleMatch && messageMatch) {
      return {
        role: roleMatch[1].trim(),
        message: messageMatch[1].trim(),
        isAgent: roleMatch[1].trim() === 'user' // For backwards compatibility with UI
      };
    }
    return null;
  }).filter(Boolean);
}

// Main data interface from API
interface TeamLog {
  // Required fields
  member_id: string;
  team_id: string;
  date: string;
  user_name: string;
  agent_name: string;
  session_id: string; 
  
  // Basic Information
  user_picture?: string;
  user_avatar?: string;
  agent_picture?: string;
  avatar_category?: string;
  avatar_difficulty?: string;
  call_recording_url?: string;

  // Performance Metrics
  overall_score: number;
  overall_score_text?: string;
  engagement_score: number;
  engagement_text?: string;
  objection_handling_score: number;
  objection_handling_text?: string;
  information_gathering_score: number;
  information_gathering_text?: string;
  program_explanation_score: number;
  program_explanation_text?: string;
  closing_skills_score: number;
  closing_skills_text?: string;
  overall_effectiveness_score: number;
  overall_effectiveness_text?: string;

  // Additional Content
  transcript?: string;
  power_moment?: string;
  call_notes?: string;
  level_up_plan_1?: string;
  level_up_plan_2?: string;
  level_up_plan_3?: string;
  manager_feedback?: string;
}

// Props interface for the component
interface CallLogsViewProps {
  teamId: string;
  memberId: string;
}

// Keep this for transcript display
interface Message {
  speaker: string;
  avatar: string;
  content: string;
  isAgent: boolean;
}

// Keep this for improvement areas
interface ImprovementArea {
  area: string;
  description: string;
}

// Add these below the interfaces
const fetchTeamLogs = async (teamId: string, memberId: string) => {
  try {
    const response = await fetch(`/api/team-logs?teamId=${teamId}&memberId=${memberId}`);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch team logs');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching team logs:', error);
    throw error;
  }
};

// Add these utility functions
const getDifficultyColor = (difficulty: string) => {
  const colors = {
    'Easy': '#23c55f',
    'Intermediate': '#fca147',
    'Expert': '#dc2626'
  };
  return colors[difficulty as keyof typeof colors] || '#fca147';
};

const getDifficultyBgColor = (difficulty: string) => {
  const colors = {
    'Easy': 'bg-green-100',
    'Intermediate': 'bg-orange-100',
    'Expert': 'bg-red-100'
  };
  return colors[difficulty as keyof typeof colors] || 'bg-orange-100';
};

const getDifficultyTextColor = (difficulty: string) => {
  const colors = {
    'Easy': 'text-green-700',
    'Intermediate': 'text-orange-700',
    'Expert': 'text-red-700'
  };
  return colors[difficulty as keyof typeof colors] || 'text-orange-700';
};

function PowerMomentSection({ powerMoment }: { powerMoment: string }) {
  return (
    <div className="bg-white rounded-xl shadow-md p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-5 w-5 text-[#f8b922]" />
        <h2 className="text-lg font-semibold">Power Moment!</h2>
      </div>
      <p className="text-sm text-gray-600">
        {powerMoment}
      </p>
    </div>
  )
}

export function CallLogsView({ teamId, memberId }: CallLogsViewProps) {
  // Data state
  const [logs, setLogs] = useState<TeamLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Existing UI states
  const [feedbackLoadingStates, setFeedbackLoadingStates] = useState<{ [key: string]: boolean }>({});
  const [feedbackErrors, setFeedbackErrors] = useState<{ [key: string]: string }>({});
  const [lastUpdatedFeedback, setLastUpdatedFeedback] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [feedbacks, setFeedbacks] = useState<{ [key: string]: string }>({});
  const [error, setError] = useState<Error | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState("All time");
  const [sortOption, setSortOption] = useState("standard");
  const [performanceRange, setPerformanceRange] = useState<[number, number]>([0, 100]);
  const [searchQuery, setSearchQuery] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [selectedTimeFrame, setSelectedTimeFrame] = useState("All time");
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null
  });

  // Fetch data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const data = await fetchTeamLogs(teamId, memberId);
        
        // Initialize feedback states for all logs
        const initialFeedbacks: { [key: string]: string } = {};
        data.forEach((log: TeamLog) => {
          if (log.manager_feedback) {
            initialFeedbacks[log.member_id] = log.manager_feedback;
          }
        });
        
        setLogs(data);
        setFeedbacks(initialFeedbacks);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };
  
    loadData();
  }, [teamId, memberId]);

  useEffect(() => {
    if (lastUpdatedFeedback) {
      // Reset last updated feedback after 2 seconds
      const timer = setTimeout(() => {
        setLastUpdatedFeedback(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [lastUpdatedFeedback]);

  // Updated handlers
  const handleSaveFeedback = async (logId: string, feedback: string, sessionId: string) => {
    try {
      // Add session_id to the query parameters
      const response = await fetch(`/api/team-logs?member_id=${logId}&session_id=${sessionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ manager_feedback: feedback }),
      });
  
      if (!response.ok) {
        throw new Error('Failed to save feedback');
      }
  
      // Update local state
      setLogs(currentLogs => 
        currentLogs.map(log => 
          // Only update the specific log with matching member_id AND session_id
          (log.member_id === logId && log.session_id === sessionId)
            ? { ...log, manager_feedback: feedback }
            : log
        )
      );
  
      setFeedbacks(prev => ({ ...prev, [sessionId]: feedback }));
  
    } catch (err) {
      console.error('Error saving feedback:', err);
      throw err;
    }
  };

  const handleSelectDateRange = (start: Date | null, end: Date | null) => {
    setDateRange({ start, end });
    setIsCalendarOpen(false);
  };

  const handlePerformanceRangeChange = (value: number[]) => {
    if (value.length === 2) {
      setPerformanceRange([value[0], value[1]] as [number, number]);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Single filterData function
  const filterData = (logs: TeamLog[], query: string): TeamLog[] => {
    const lowercasedQuery = query.toLowerCase();
    return logs.filter(log => 
      log.user_name.toLowerCase().includes(lowercasedQuery) ||
      log.agent_name.toLowerCase().includes(lowercasedQuery)
    );
  };

  const isDateInRange = (dateStr: string) => {
    if (!dateRange.start || !dateRange.end) return true;
    
    // Parse the date string into a Date object
    const date = new Date(dateStr);
    
    // Create dates for comparison
    const start = new Date(dateRange.start);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(dateRange.end);
    end.setHours(23, 59, 59, 999);
    
    // Debug logs
    console.log('Date comparison:', {
      date: date.toISOString(),
      start: start.toISOString(),
      end: end.toISOString(),
      isInRange: date >= start && date <= end
    });
    
    return date >= start && date <= end;
};

  // filteredAndSortedData with all filtering and sorting logic
  const filteredAndSortedData = useMemo(() => {
    if (!logs) return [];
    
    let filteredLogs = filterData(logs, searchQuery);
    filteredLogs = filteredLogs.filter(log => 
      log && 
      isDateInRange(log.date) && 
      typeof log.overall_score === 'number' &&
      log.overall_score >= performanceRange[0] && 
      log.overall_score <= performanceRange[1]
    );

    return [...filteredLogs].sort((a, b) => {
      switch (sortOption) {
        case "a-z":
          return (a.user_name || '').localeCompare(b.user_name || '');
        case "z-a":
          return (b.user_name || '').localeCompare(a.user_name || '');
        case "date-new":
          // Parse dates and compare
          const dateB = new Date(b.date).getTime();
          const dateA = new Date(a.date).getTime();
          return dateB - dateA;
        case "date-old":
          // Parse dates and compare in reverse
          const oldDateA = new Date(a.date).getTime();
          const oldDateB = new Date(b.date).getTime();
          return oldDateA - oldDateB;
        default:
          // Default to newest first
          return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
    });
  }, [logs, searchQuery, performanceRange, sortOption, dateRange]);

  if (isLoading) {
    return <div>Loading...</div>; // You can replace this with a proper loading component
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (!logs || logs.length === 0) {
    return (
      <Card className="w-full bg-white overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6 bg-white shadow-md">
          <CardTitle className="text-2xl font-bold flex items-center gap-2 text-black">
            <Image
              src="https://res.cloudinary.com/drkudvyog/image/upload/v1734436445/Team_Call_Logs_icon_duha_yvb0r1.png"
              alt="Team Call Logs"
              width={24}
              height={24}
              className="h-6 w-6"
            />
            Team Call Logs
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center text-gray-500">
          No call logs available.
        </CardContent>
      </Card>
    )
  }

  try {
    return (
      <Card className="w-full bg-white overflow-hidden">
        <CardHeader className="p-4 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-2xl font-bold flex items-center gap-2 text-black flex-1">
            <Image
              src="https://res.cloudinary.com/drkudvyog/image/upload/v1734436445/Team_Call_Logs_icon_duha_yvb0r1.png"
              alt="Team Call Logs"
              width={24}
              height={24}
              className="h-6 w-6"
            />
            Team Call Logs
          </CardTitle>
          <div className="flex items-center gap-4">
  <Button 
    variant="outline" 
    size="sm"
    className="rounded-full text-black hover:bg-gray-200 shadow-md shadow-black/10"
    onClick={() => setIsCalendarOpen(true)}
  >
    <Image
      src="https://res.cloudinary.com/drkudvyog/image/upload/v1734437402/calendar_icon_2_efgdme.png"
      alt="Calendar"
      width={16}
      height={16}
      className="mr-2"
    />
    {dateRange.start && dateRange.end ? (
      `${formatDateShort(dateRange.start.toISOString())} - ${formatDateShort(dateRange.end.toISOString())}`
    ) : "All time"}
  </Button>
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button 
        variant="outline" 
        size="sm"
        className="rounded-full text-black hover:bg-gray-200 shadow-md shadow-black/10"
      >
        <Image
          src="https://res.cloudinary.com/drkudvyog/image/upload/v1734400792/Sort_icon_duha_tpvska.png"
          alt="Sort"
          width={16}
          height={16}
          className="mr-2"
        />
        Sort
      </Button>
    </DropdownMenuTrigger>
<DropdownMenuContent className="w-[300px]">
  <DropdownMenuRadioGroup value={sortOption} onValueChange={setSortOption}>
    <DropdownMenuRadioItem value="standard">Standard sorting</DropdownMenuRadioItem>
    <DropdownMenuRadioItem value="a-z">Users (A-Z)</DropdownMenuRadioItem>
    <DropdownMenuRadioItem value="z-a">Users (Z-A)</DropdownMenuRadioItem>
    <DropdownMenuRadioItem value="date-new">Date (newest first)</DropdownMenuRadioItem>
    <DropdownMenuRadioItem value="date-old">Date (oldest first)</DropdownMenuRadioItem>
  </DropdownMenuRadioGroup>
  <DropdownMenuSeparator />
  <div className="px-2 py-4">
    <div className="flex justify-between items-center mb-2">
      <span className="text-sm font-medium">Overall Performance Range:</span>
      <span className="text-sm font-medium text-[#5b06be]">{performanceRange[0]} - {performanceRange[1]}</span>
    </div>
    <Slider
      min={0}
      max={100}
      step={1}
      value={[performanceRange[0], performanceRange[1]]}
      onValueChange={(newValue) => {
        if (Array.isArray(newValue) && newValue.length === 2) {
          setPerformanceRange([newValue[0], newValue[1]]);
        }
      }}
      className="w-full [&_[role=slider]]:bg-white [&_[role=slider]]:border-2 [&_[role=slider]]:border-[#5b06be] [&_[role=slider]]:w-4 [&_[role=slider]]:h-4 [&_[role=slider]]:rounded-full [&_[role=slider]]:z-10 [&_[role=track]]:bg-[#f8b922] [&_[role=track]]:opacity-100 [&_[role=range]]:bg-[#5b06be] [&_[role=track.background]]:bg-[#f8b922]"
      minStepsBetweenThumbs={1}
    />
  </div>
</DropdownMenuContent>
              </DropdownMenu>
              <div className="relative max-w-sm">
                <Image
                  src="https://res.cloudinary.com/drkudvyog/image/upload/v1734400793/Search_icon_duha_kuilhh.png"
                  alt="Search"
                  width={16}
                  height={16}
                  className="absolute left-3 top-1/2 transform -translate-y-1/2"
                />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="pl-10 rounded-full text-black border-none shadow-md shadow-black/10"
                />
              </div>
            </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full">
            <table className="w-full table-fixed">
              <thead className="sticky top-0 z-10">
              <tr className="bg-[#f8b922]">
  <th className="w-[8%] px-1 py-2">
    <div className="flex items-center text-sm font-medium text-white">
      Date
    </div>
  </th>
  <th className="w-[15%] px-1 py-2">
    <div className="flex items-center text-sm font-medium text-white">
      User
    </div>
  </th>
  <th className="w-[15%] px-1 py-2">
    <div className="flex items-center text-sm font-medium text-white">
      Avatar
    </div>
  </th>
  <th className="w-[10%] px-1 py-2">
    <div className="flex items-center text-sm font-medium text-white">
      Call Performance
    </div>
  </th>
  <th className="w-[20%] px-1 py-2">
    <div className="flex items-center justify-center text-sm font-medium text-white">
      Call Recording
    </div>
  </th>
</tr>
              </thead>
            </table>
          
            <div className="h-[340px] overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-[#F8F0FF] [&::-webkit-scrollbar-thumb]:bg-[#5b06be] [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#7016e0]">
              <table className="w-full">
                <tbody>
                  {filteredAndSortedData && filteredAndSortedData.length > 0 ? (
                    filteredAndSortedData.map((log, index) => (
                    <tr 
                      key={index} 
                      className="border-b border-[#f3f4f6] hover:bg-gray-50 transition-colors duration-150"
                    >
<td className="px-1 py-2">
  <div className="flex justify-start items-center pl-2">
    <span className="text-black text-xs whitespace-nowrap">
      {formatDateShort(log.date)}
    </span>
  </div>
</td>

<td className="px-1 py-2">
  <div className="flex items-center gap-1">
    <Avatar className="h-8 w-8 border-2 border-[#5b06be] flex-shrink-0">
      <AvatarImage 
        src={log.user_picture || "https://res.cloudinary.com/drkudvyog/image/upload/v1734565916/Profile_photo_duha_s_bilym_pozadim_cl4ukr.png"}
        alt={`${log.user_name}'s profile`} 
      />
    </Avatar>
    <span className="font-medium text-black text-sm whitespace-nowrap">{log.user_name}</span>
  </div>
</td>
                      
<td className="px-2 py-2">
  <div className="flex items-center gap-1 justify-start">
    <div className="flex items-center gap-2">
      <Avatar className="h-8 w-8 border-2 border-[#5b06be]">
        <AvatarImage 
          src={log.agent_picture || "/placeholder.svg"}
          alt={`${log.agent_name}'s profile`}
        />
      </Avatar>
      <span className="font-medium text-black text-sm">{log.agent_name}</span>
    </div>
    <div className="flex items-center gap-2">
      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs whitespace-nowrap">
        {log.avatar_category || 'Creative Finance'}
      </span>
      <span className={cn(
        "px-2 py-1 rounded-full text-xs whitespace-nowrap",
        getDifficultyBgColor(log.avatar_difficulty || 'Intermediate'),
        getDifficultyTextColor(log.avatar_difficulty || 'Intermediate')
      )}>
        {log.avatar_difficulty || 'Intermediate'}
      </span>
    </div>
  </div>
</td>
            
{/* Performance Column */}
<td className="py-2">
  <Dialog onOpenChange={(open) => {
    if (open) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }}>
    <DialogTrigger asChild>
      <Button 
        variant="ghost" 
        size="sm"
        className="rounded-full bg-[#5b06be] text-white hover:bg-[#7016e0] hover:text-white transition-all px-2 py-1 text-xs h-7 -ml-16"
      >
        <span className="font-medium">{log.overall_score}/100</span>
        <span className="ml-1 font-medium">View Info</span>
        <Image
          src="https://res.cloudinary.com/drkudvyog/image/upload/v1735521910/info_icon_white_btbu18.png"
          alt="Click to view"
          width={12}
          height={12}
          className="ml-0.5 inline-block"
        />
      </Button>
    </DialogTrigger>
    <DialogContent className="max-w-[900px] !w-[900px] !h-[550px] p-6 overflow-hidden fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
                          <DialogHeader className="pb-4">
                            <div className="flex items-center justify-between w-full py-2 border-b">
                              <div className="flex items-center gap-4">
                              <span className="text-sm text-gray-500">{formatDateShort(log.date)}</span>
<div className="flex items-center gap-2">
  <Avatar className="h-8 w-8 border-2 border-[#5b06be]">
    <AvatarImage 
      src={log.user_picture || "https://res.cloudinary.com/drkudvyog/image/upload/v1734565916/Profile_photo_duha_s_bilym_pozadim_cl4ukr.png"}
      alt={`${log.user_name}'s profile`} 
    />
  </Avatar>
  <span className="font-medium">{log.user_name}</span>
  <Image
    src="https://res.cloudinary.com/drkudvyog/image/upload/v1735534232/clash_icon_duha_wvhzo9.png"
    alt="Clash Icon"
    width={16}
    height={16}
  />
</div>
<div className="flex items-center gap-2">
  <Avatar className="h-8 w-8 border-2 border-[#5b06be]">
    <AvatarImage 
      src={log.agent_picture || "/placeholder.svg"}
      alt={`${log.agent_name}'s profile`} 
    />
  </Avatar>
  <span className="font-medium">{log.agent_name}</span>
</div>
                                <div className="flex items-center gap-2">
                                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
  {log.avatar_category || 'Creative Finance'}
</span>
<span className={cn(
  "px-3 py-1 rounded-full text-sm",
  getDifficultyBgColor(log.avatar_difficulty || 'Intermediate'),
  getDifficultyTextColor(log.avatar_difficulty || 'Intermediate')
)}>
  {log.avatar_difficulty || 'Intermediate'}
</span>
                                </div>
                              </div>
                              <FeedbackDialog
  name={log.user_name}
  initialFeedback={log.manager_feedback || ""}
  sessionId={log.session_id}
  onSaveFeedback={async (feedback) => {
    await handleSaveFeedback(log.member_id, feedback, log.session_id);
  }}
/>
                            </div>
                          </DialogHeader>
                                                  
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100%-80px)]">
  <div className="h-full">
    <PerformanceMetricsWidget log={log} />
  </div>
  
  <div className="flex flex-col space-y-3 h-full">
    <div style={{ height: '110px' }}>
      <PowerMomentSection powerMoment={log.power_moment || ""} />
    </div>
    <div style={{ height: '110px' }}>
      <CallNotesWidget log={log} />
    </div>
    <div className="flex-1">
      <LevelUpPlanWidget log={log}>
        <AreasOfImprovement currentIndex={0} log={log} />
      </LevelUpPlanWidget>
    </div>
  </div>
</div>
                        </DialogContent>
                        </Dialog>
                      </td>
            
                      {/* Recording Column */}
                      <td className="px-4 py-3 text-center">
                        <AudioPlayer audioUrl={log.call_recording_url} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-center text-gray-500">
                    No call logs available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </CardContent>
        <Dialog open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
  <DialogContent className="sm:max-w-[900px] p-0 bg-white">
    <DialogTitle className="sr-only">Date Range Picker</DialogTitle>
    <DialogDescription className="sr-only">
      Select a date range or use quick select options
    </DialogDescription>
    <Calendar 
      onSelectRange={handleSelectDateRange}
    />
  </DialogContent>
</Dialog>
      </Card>
    )
  } catch (err) {
    setError(err as Error);
    return null;
  }
}

function FeedbackDialog({ 
  name, 
  initialFeedback, 
  sessionId,
  onSaveFeedback 
}: { 
  name: string, 
  initialFeedback: string, 
  sessionId: string,
  onSaveFeedback: (feedback: string) => Promise<void> 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState(initialFeedback);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFeedback(initialFeedback);
  }, [initialFeedback]);

  const handleAddFeedback = async () => {
    try {
      setIsSaving(true);
      setError(null);
      await onSaveFeedback(feedback);
      setSaveSuccess(true);
      
      // Reset success state after 2 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save feedback');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="default" 
          size="sm"
          className="rounded-full bg-[#5b06be] text-white hover:bg-[#7016e0] px-4 py-2"
        >
          {initialFeedback ? `Edit Feedback for ${name}` : `Add Feedback for ${name}`}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {initialFeedback ? `Edit Feedback for ${name}` : `Add Feedback for ${name}`}
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <Textarea 
            value={feedback}
            onChange={(e) => {
              setFeedback(e.target.value)
              setSaveSuccess(false) // Reset success state when editing
            }}
            placeholder="Enter your feedback here..."
            className="min-h-[100px] border-gray-300 focus:ring-[#5b06be]"
          />
          {error && (
            <div className="text-red-500 text-sm">
              {error}
            </div>
          )}
          <div className="flex justify-center mt-4">
            <Button
              variant="default"
              className={`w-full max-w-md transition-all rounded-full py-6 text-lg font-medium ${
                saveSuccess 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-[#5b06be] hover:bg-[#7016e0]'
              } text-white`}
              onClick={handleAddFeedback}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Feedback'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AudioPlayer({ audioUrl }: { audioUrl: string }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const progressBarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (audio) {
      audio.addEventListener('error', handleAudioError)
      audio.addEventListener('loadedmetadata', () => {
        setError(null)
        setDuration(audio.duration)
      })
      audio.addEventListener('timeupdate', () => {
        setCurrentTime(audio.currentTime)
      })
      return () => {
        audio.removeEventListener('error', handleAudioError)
        audio.removeEventListener('loadedmetadata', () => {})
        audio.removeEventListener('timeupdate', () => {})
      }
    }
  }, [])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed
    }
  }, [playbackSpeed])

  const handleAudioError = (e: Event) => {
    const audio = e.target as HTMLAudioElement
    let errorMessage = 'Error loading audio'
    if (audio.error) {
      switch (audio.error.code) {
        case 1:
          errorMessage = 'Audio playback aborted'
          break
        case 2:
          errorMessage = 'Network error while loading audio'
          break
        case 3:
          errorMessage = 'Audio decoding error'
          break
        case 4:
          errorMessage = 'Audio format not supported'
          break
      }
    }
    console.error('Audio error:', errorMessage)
    setError(errorMessage)
    setIsPlaying(false)
  }

  const togglePlayPause = async () => {
    const audio = audioRef.current
    if (audio) {
      try {
        if (isPlaying) {
          await audio.pause()
        } else {
          await audio.play()
        }
        setIsPlaying(!isPlaying)
      } catch (err) {
        console.error('Playback error:', err)
        setError('Error during playback')
        setIsPlaying(false)
      }
    }
  }

  const seekAudio = (seconds: number) => {
    const audio = audioRef.current
    if (audio) {
      audio.currentTime += seconds
    }
  }

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const progressBar = progressBarRef.current
    const audio = audioRef.current
    if (progressBar && audio) {
      const rect = progressBar.getBoundingClientRect()
      const x = e.clientX - rect.left
      const percentage = x / rect.width
      audio.currentTime = percentage * duration
    }
  }

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  if (error) {
    return (
      <div className="text-red-500 text-xs">
        {error}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => seekAudio(-10)}
        className="text-xs text-black hover:text-[#5b06be]"
      >
        -10s
      </Button>
      <Button
  variant="ghost"
  size="icon"
  onClick={togglePlayPause}
  className="rounded-full bg-[#5b06be] text-white hover:bg-[#7016e0] hover:text-white transition-all shadow-md shadow-black/10 w-8 h-8 p-0 flex items-center justify-center aspect-square"
>
  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
</Button>
      <div
  ref={progressBarRef}
  className="relative w-full max-w-[150px] h-1.5 bg-gray-200 roundedfull cursor-pointer"
  onClick={handleProgressBarClick}
>
        <div
          className="absolute h-full bg-[#5b06be] rounded-full"
          style={{ width: `${(currentTime / duration) * 100}%` }}
        />
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => seekAudio(10)}
        className="text-xs text-black hover:text-[#5b06be]"
      >
        +10s
      </Button>
      <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] px-2 py-0.5 bg-[#5b06be] text-white rounded-full min-w-[4.5rem] h-5 flex items-center justify-center transition-all hover:bg-[#7016e0]">
  {formatTime(currentTime)} / {formatTime(duration)}</span>
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button
      variant="outline"
      size="sm"
      className="text-[10px] px-2 py-0.5 bg-[#5b06be] text-white rounded-full min-w-[4.5rem] h-5 hover:bg-[#7016e0] hover:text-white flex items-center justify-center"
    >
      {playbackSpeed}x
    </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {[1, 1.25, 1.5, 1.75, 2].map((speed) => (
              <DropdownMenuItem 
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className="cursor-pointer"
                inset={false}
              >
                {speed}x
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <audio ref={audioRef}>
        <source src={audioUrl} type="audio/mpeg"/>
        <source src={audioUrl.replace('.mp3','.ogg')} type="audio/ogg" />
        Your browser does not support the audio element.
      </audio>
    </div>
  )
}

function AreasOfImprovement({ currentIndex, log }: { currentIndex: number, log: TeamLog }) {
  const [areas, setAreas] = useState([
    { area: "Level Up Plan 1", description: log.level_up_plan_1 || "No plan available" },
    { area: "Level Up Plan 2", description: log.level_up_plan_2 || "No plan available" },
    { area: "Level Up Plan 3", description: log.level_up_plan_3 || "No plan available" }
  ]);
  const [isEditing, setIsEditing] = useState(false);
  const currentArea = areas[currentIndex];

  const handleSave = (newArea: string, newDescription: string) => {
    const updatedAreas = [...areas];
    updatedAreas[currentIndex] = { 
      area: newArea || currentArea.area, 
      description: newDescription || currentArea.description 
    };
    setAreas(updatedAreas);
    setIsEditing(false);
  };

  return (
<div className="bg-white rounded-md p-4 pt-2 shadow-md shadow-black/20 h-full flex flex-col">
      <div className="flex justify-between items-start mb-2">
        {isEditing ? (
          <input
            type="text"
            defaultValue={currentArea.area}
            className="text-lg font-semibold text-purple-800 bg-transparent border-b border-purple-300 focus:outline-none focus:border-purple-800"
            onBlur={(e) => handleSave(e.target.value, currentArea.description)}
          />
        ) : (
          <h4 className="text-lg font-semibold text-purple-800">
            {currentArea.area}
          </h4>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="text-purple-800 hover:bg-purple-100"
          onClick={() => setIsEditing(!isEditing)}
        >
          <Pencil className="h-4 w-4 mr-2" />
          {isEditing ? 'Save' : 'Edit'}
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isEditing ? (
          <textarea
            defaultValue={currentArea.description}
            className="w-full h-full min-h-[80px] text-sm text-gray-600 bg-transparent border rounded-md p-2 focus:outline-none focus:border-purple-800 resize-none"
            onBlur={(e) => handleSave(currentArea.area, e.target.value)}
          />
        ) : (
          <p className="text-sm text-gray-600 pr-2">{currentArea.description}</p>
        )}
      </div>
    </div>
  );
}

function PerformanceMetricsWidget({ log }: { log: TeamLog }) {
  const [selectedMetric, setSelectedMetric] = useState<string>("Overall Score");
  const [activeTab, setActiveTab] = useState<"metrics" | "transcript">("metrics");

  const metrics = [
    { 
      label: "Overall Score", 
      value: log.overall_score,
      description: log.overall_score_text || "Combined score reflecting the agent's overall performance across all metrics."
    },
    { 
      label: "Engagement", 
      value: log.engagement_score,
      description: log.engagement_text || "Measures how well the agent connects with customers and maintains their interest."
    },
    { 
      label: "Objection Handling", 
      value: log.objection_handling_score,
      description: log.objection_handling_text || "Evaluates the agent's ability to address and overcome customer concerns effectively."
    },
    { 
      label: "Information Gathering", 
      value: log.information_gathering_score,
      description: log.information_gathering_text || "Assesses how well the agent collects relevant information from customers."
    },
    { 
      label: "Program Explanation", 
      value: log.program_explanation_score,
      description: log.program_explanation_text || "Rates the clarity and effectiveness of program/product explanations."
    },
    { 
      label: "Closing Skills", 
      value: log.closing_skills_score,
      description: log.closing_skills_text || "Evaluates the agent's ability to guide conversations toward successful conclusions."
    },
    { 
      label: "Overall Effectiveness", 
      value: log.overall_effectiveness_score,
      description: log.overall_effectiveness_text || "Measures the overall impact and success of the agent's interactions."
    }
];

  const selectedMetricData = metrics.find(m => m.label === selectedMetric);

  const onSelectMetric = (label: string) => {
    setSelectedMetric(label);
  };

  return (
    <div className="bg-white shadow-md rounded-xl w-full overflow-hidden flex flex-col" style={{ height: '408px' }}>
      <div className="p-4 h-full overflow-y-auto">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "metrics" | "transcript")} className="w-full h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="transcript">Transcript</TabsTrigger>
          </TabsList>
          <TabsContent value="metrics" className="h-full overflow-y-auto">
            <div className="mb-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {selectedMetric}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-full">
                  {metrics.map((metric) => (
                    <DropdownMenuItem
                      key={metric.label}
                      onSelect={() => setSelectedMetric(metric.label)}
                      className="flex justify-between items-center"
                      inset={false}
                    >
                      <span>{metric.label}</span>
                      <span className="ml-2 text-[#22c55e] font-semibold">{metric.value}/100</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {selectedMetricData && (
              <div className="bg-[#f0fdf4] border border-[#22c55e] rounded-xl p-4 mt-4">
                <h2 className="text-lg font-bold mb-2 flex justify-between items-center">
                  <span>{selectedMetricData.label}</span>
                  <span className="text-[#22c55e]">{selectedMetricData.value}/100</span>
                </h2>
                <p className="text-sm text-gray-600 mt-2">{selectedMetricData.description}</p>
              </div>
            )}
          </TabsContent>
          <TabsContent value="transcript" className="h-[325px] overflow-hidden">
          <TranscriptView 
  className="h-full" 
  messages={log.transcript || ""} 
  agentName={log.user_name}     // This was previously log.agent_name
  userName={log.agent_name}      // This was previously log.user_name
  agentPicture={log.user_picture}  // This was previously log.agent_picture
  userPicture={log.agent_picture}  // This was previously log.user_picture
/>
</TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function CallNotesWidget({ log }: { log: TeamLog }) {
  return (
    <div className="bg-white rounded-xl shadow-md p-4 h-full flex flex-col">
      <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <Image
          src="https://res.cloudinary.com/drkudvyog/image/upload/v1734523886/User_s_notes_icon_duha_rlm6wm.png"
          alt="Call Notes Icon"
          width={20}
          height={20}
        />
        Call Notes
      </h2>
      <div className="flex-grow max-h-[72px] overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-[#F8F0FF] [&::-webkit-scrollbar-thumb]:bg-[#5b06be] [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#7016e0]">
        <p className="text-sm text-gray-600 leading-6">
        {log.call_notes}
        </p>
      </div>
    </div>
  );
}

function LevelUpPlanWidget({ children, log }: { children: React.ReactNode, log: TeamLog }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const totalAreas = 3;

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % totalAreas);
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + totalAreas) % totalAreas);
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Image
            src="https://res.cloudinary.com/drkudvyog/image/upload/v1734524541/Level_up_plan_icon_duha_wtftip.png"
            alt="Level Up Plan Icon"
            width={20}
            height={20}
          />
          Level Up Plan
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handlePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">{currentIndex + 1}/{totalAreas}</span>
          <Button variant="ghost" size="sm" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1">
        <AreasOfImprovement currentIndex={currentIndex} log={log} />
      </div>
    </div>
  );
}

interface TranscriptViewProps {
  messages: string | any[];
  className?: string;
  agentName?: string;
  userName?: string;
  agentPicture?: string;
  userPicture?: string;
}

export function TranscriptView({ 
  messages, 
  className, 
  agentName, 
  userName,
  agentPicture,
  userPicture 
}: TranscriptViewProps) {
  const parsedMessages = React.useMemo(() => {
    if (!messages) return [];
    if (typeof messages === 'string') {
      const parts = messages.split(/(?=role:)/).filter(Boolean);
      return parts.map(part => {
        const roleMatch = part.match(/role:\s*(\w+)/);
        const messageMatch = part.match(/message:\s*(.*?)(?=(?:\s*role:|$))/);
        
        if (roleMatch && messageMatch) {
          return {
            role: roleMatch[1].trim(),
            message: messageMatch[1].trim(),
            isAgent: roleMatch[1].trim() === 'user'
          };
        }
        return null;
      }).filter(Boolean);
    }
    return messages;
  }, [messages]);

  if (!parsedMessages || parsedMessages.length === 0) {
    return <p className="text-center text-gray-500">No transcript available.</p>;
  }

  return (
    <div className={cn("h-full flex flex-col min-h-0", className)}>
      <h2 className="text-xl font-semibold mb-4">Call Transcript</h2>
      <div className="flex-grow overflow-y-auto pr-4 space-y-4 min-h-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-[#F8F0FF] [&::-webkit-scrollbar-thumb]:bg-[#5b06be] [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#7016e0]">
        {parsedMessages.map((message, index) => (
          <div
            key={index}
            className={`flex flex-col gap-1.5 ${
              message.role === 'user' || message.isAgent
                ? 'bg-[#F8F0FF] border border-purple-100' 
                : 'bg-[#FDF7F3] border border-orange-100'
            } rounded-2xl p-3 min-w-0`}
          >
            <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 border-2 border-[#5b06be] flex-shrink-0">
            <AvatarImage 
  src={message.role === 'user' || message.isAgent
    ? agentPicture || "/placeholder.svg?height=32&width=32"
    : userPicture || "https://res.cloudinary.com/drkudvyog/image/upload/v1734565916/Profile_photo_duha_s_bilym_pozadim_cl4ukr.png"
  } 
  alt={`${(message.role === 'user' || message.isAgent) ? 'Agent' : 'User'} avatar`}
/>
  <AvatarFallback className="bg-gray-100">
    {(message.role === 'user' || message.isAgent) ? 'U' : 'A'}
  </AvatarFallback>
</Avatar>
<span className="font-semibold text-sm">
  {message.role === 'user' || message.isAgent ? agentName : userName}
</span>

            </div>
            <p className="text-sm leading-relaxed text-gray-700 pl-11 break-words">
              {message.message || message.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

<style jsx>{`
  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.7);
    }
    70% {
      box-shadow: 0 0 0 10px rgba(124, 58, 237, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(124, 58, 237, 0);
    }
  }
  .pulse-button {
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(91, 6, 190, 0.7);
    }
    70% {
      box-shadow: 0 0 0 10px rgba(91, 6, 190, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(91, 6, 190, 0);
    }
  }

  /* Scrollbar styly */
  .scrollbar-thin::-webkit-scrollbar {
    width: 6px;
  }

  .scrollbar-thin::-webkit-scrollbar-track {
    background: transparent;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: #5b06be;
    border-radius: 3px;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: #7016e0;
  }
.custom-purple-scrollbar::-webkit-scrollbar {
    width: 6px;
    background: transparent;
  }

  .custom-purple-scrollbar::-webkit-scrollbar-track {
    background: #F8F0FF;
    border-radius: 3px;
  }

  .custom-purple-scrollbar::-webkit-scrollbar-thumb {
    background: #5b06be;
    border-radius: 3px;
    transition: background 0.2s ease;
  }

  .custom-purple-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #7016e0;
  }
`}</style>
