import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  ActivityIndicator,
  Modal,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import ThemeContext from "../../context/ThemeContext";
import AuthContext from "../../context/AuthContext";
import axios from "axios";
import { Calendar } from "react-native-calendars";
import { format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import RegularizationRequestForm from "../../components/RegularizationRequestForm";

interface ShiftDetail {
  id?: number;
  shift_start: string;
  shift_end: string | null;
  total_hours: number | string;
  total_distance: number | string;
  total_expenses: number | string;
  date: string;
}

interface AttendanceData {
  date: string;
  shifts: ShiftDetail[];
  total_hours: number | string;
  total_distance: number | string;
  total_expenses: number | string;
  shift_count: number | string;
}

interface CalendarDay {
  timestamp: number;
  year: number;
  month: number;
  day: number;
  dateString: string;
}

interface MarkedDates {
  [date: string]: {
    marked?: boolean;
    dotColor?: string;
    selected?: boolean;
    selectedColor?: string;
    disabled?: boolean;
  };
}

// Add this helper function at the top level
const getApiEndpoint = (role: string) => {
  switch (role) {
    case "employee":
      return "/api/employee";
    case "group-admin":
      return "/api/group-admin";
    case "management":
      return "/api/management";
    default:
      return "/api/employee";
  }
};

// Add this helper function for role-specific titles
const getRoleSpecificTitle = (role: string) => {
  switch (role) {
    case "employee":
      return "Employee Attendance";
    case "group-admin":
      return "Group Admin Attendance";
    case "management":
      return "Management Attendance";
    default:
      return "Attendance Management";
  }
};

export default function AttendanceManagement() {
  const { theme } = ThemeContext.useTheme();
  const { token, user } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === "dark";

  // Get the API endpoint based on user role
  const apiEndpoint = getApiEndpoint(user?.role || "employee");
  console.log(apiEndpoint);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [attendanceData, setAttendanceData] = useState<{
    [key: string]: AttendanceData;
  }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showRegularizationForm, setShowRegularizationForm] = useState(false);
  const [selectedShiftForRegularization, setSelectedShiftForRegularization] = useState<any>(null);
  const [showNoDataModal, setShowNoDataModal] = useState(false);
  const [noDataDate, setNoDataDate] = useState<Date | null>(null);
  const [regularizationRequestType, setRegularizationRequestType] = useState<'time_adjustment' | 'missing_shift' | 'early_departure' | 'late_arrival'>('time_adjustment');
  const [monthStats, setMonthStats] = useState({
    totalDays: 0,
    totalHours: 0,
    avgHours: 0,
    totalExpenses: 0,
  });
  const [regularizations, setRegularizations] = useState<{[key: string]: any[]}>({});

  useEffect(() => {
    fetchAttendanceData(format(selectedDate, "yyyy-MM"));
    fetchRegularizations(format(selectedDate, "yyyy-MM"));
  }, [selectedDate]);

  // Update the fetchAttendanceData function
  const fetchAttendanceData = async (month: string) => {
    try {
      setIsLoading(true);
      console.log("Fetching attendance for month:", month);

      console.warn(apiEndpoint);

      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}${apiEndpoint}/attendance/${month}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      // Log raw data from database
      console.log("Raw response data:", response.data);
      response.data.forEach((record: AttendanceData) => {
        record.shifts.forEach((shift, index) => {
          console.log(`Raw shift ${index + 1} times:`, {
            start: shift.shift_start,
            end: shift.shift_end,
            expenses: shift.total_expenses,
            distance: shift.total_distance,
          });
        });
      });

      const data = response.data.reduce((acc: any, curr: AttendanceData) => {
        const localDate = format(new Date(curr.date), "yyyy-MM-dd");

        // Make sure shift expenses are properly preserved, whether ongoing or completed
        const processedShifts = curr.shifts.map((shift) => ({
          ...shift,
          total_expenses: parseNumber(shift.total_expenses), // Ensure proper parsing
          total_distance: parseNumber(shift.total_distance), // Ensure proper parsing
          total_hours: parseNumber(shift.total_hours), // Ensure proper parsing
        }));

        acc[localDate] = {
          ...curr,
          date: localDate,
          shifts: processedShifts,
          // Ensure all summary values are properly calculated
          total_hours: curr.total_hours,
          total_distance: curr.total_distance,
          total_expenses: curr.total_expenses,
          shift_count: curr.shift_count,
        };
        return acc;
      }, {});

      // Log processed data
      console.log("Processed attendance data:", data);
      (Object.values(data) as AttendanceData[]).forEach((day) => {
        day.shifts.forEach((shift, index) => {
          console.log(`Processed shift ${index + 1} details:`, {
            start: shift.shift_start,
            end: shift.shift_end,
            displayStart: shift.shift_start.substring(11, 19),
            displayEnd: shift.shift_end
              ? shift.shift_end.substring(11, 19)
              : "Ongoing",
            expenses: shift.total_expenses,
            distance: shift.total_distance,
          });
        });
      });

      setAttendanceData(data);
      calculateMonthStats(response.data);
    } catch (error: any) {
      console.error("Error fetching attendance:", error);
      Alert.alert(
        "Error",
        "Failed to fetch attendance data. Please try again later.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRegularizations = async (month: string) => {
    try {
      // Calculate the last day of the month properly
      const year = parseInt(month.split('-')[0]);
      const monthNum = parseInt(month.split('-')[1]) - 1; // JavaScript months are 0-indexed
      const lastDay = new Date(year, monthNum + 1, 0).getDate(); // Get last day of month
      
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/attendance-regularization/requests`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            status: 'approved',
            date_from: `${month}-01`,
            date_to: `${month}-${lastDay.toString().padStart(2, '0')}`
          }
        }
      );

      if (response.data.success) {
        const regularizationsData = response.data.requests.reduce((acc: any, req: any) => {
          const dateKey = format(new Date(req.request_date), "yyyy-MM-dd");
          if (!acc[dateKey]) {
            acc[dateKey] = [];
          }
          acc[dateKey].push(req);
          return acc;
        }, {});
        setRegularizations(regularizationsData);
      }
    } catch (error) {
      console.error("Error fetching regularizations:", error);
      // Set empty regularizations on error to prevent UI issues
      setRegularizations({});
    }
  };

  const calculateMonthStats = (data: AttendanceData[]) => {
    const stats = data.reduce(
      (acc, curr) => {
        // Parse and sum total expenses and hours for each day
        // Ensure we're adding numbers, not strings
        const dayExpenses = parseNumber(curr.total_expenses);
        const dayHours = parseNumber(curr.total_hours);

        console.log(`Day expenses for ${curr.date}: ${dayExpenses}`);

        return {
          totalDays: acc.totalDays + 1,
          totalHours: acc.totalHours + dayHours,
          totalExpenses: acc.totalExpenses + dayExpenses,
        };
      },
      { totalDays: 0, totalHours: 0, totalExpenses: 0 },
    );

    setMonthStats({
      ...stats,
      avgHours: stats.totalDays ? stats.totalHours / stats.totalDays || 0 : 0,
    });
  };

  const getMarkedDates = () => {
    const marked: MarkedDates = {};
    const today = new Date();

    const currentMonth = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      1,
    );
    const lastDay = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth() + 1,
      0,
    );

    for (
      let date = currentMonth;
      date <= lastDay;
      date.setDate(date.getDate() + 1)
    ) {
      const dateString = format(date, "yyyy-MM-dd");
      const isAttendancePresent = attendanceData[dateString];
      const hasRegularizations = regularizations[dateString] && regularizations[dateString].length > 0;
      const isFutureDate = date > today;

      // Determine dot color based on attendance and regularizations
      let dotColor = isDark ? "#60A5FA" : "#3B82F6"; // Default blue for attendance
      if (hasRegularizations && isAttendancePresent) {
        dotColor = isDark ? "#10B981" : "#059669"; // Green for both attendance and regularization
      } else if (hasRegularizations && !isAttendancePresent) {
        dotColor = isDark ? "#F59E0B" : "#D97706"; // Orange for regularization only
      }

      marked[dateString] = {
        marked: !!(isAttendancePresent || hasRegularizations),
        dotColor: dotColor,
        selected: format(selectedDate, "yyyy-MM-dd") === dateString,
        selectedColor: isDark ? "#1E40AF" : "#93C5FD",
        disabled: isFutureDate,
      };
    }

    return marked;
  };

  const handleDateSelect = (day: CalendarDay) => {
    const selectedDateStr = format(new Date(day.timestamp), "yyyy-MM-dd");
    const today = new Date();
    const selectedDate = new Date(day.timestamp);

    if (selectedDate > today) {
      return;
    }

    setSelectedDate(selectedDate);

    // Check if there's no attendance data and no regularizations
    if (!attendanceData[selectedDateStr] && (!regularizations[selectedDateStr] || regularizations[selectedDateStr].length === 0)) {
      setNoDataDate(selectedDate);
      setShowNoDataModal(true);
    }
  };

  const parseNumber = (value: string | number | null): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === "string") {
      const parsedValue = parseFloat(value);
      console.log(`Parsing string value: ${value} => ${parsedValue || 0}`);
      return parsedValue || 0;
    }
    if (typeof value === "number") {
      console.log(`Already a number: ${value}`);
      return value || 0;
    }
    console.log(`Unhandled value type: ${typeof value}, value: ${value}`);
    return 0;
  };

  // Helper function to format time in IST
  const formatTime = (timeString: string | undefined): string => {
    if (!timeString) return 'N/A';

    try {
      // Check if it's already a formatted time (HH:MM format)
      if (timeString.match(/^\d{1,2}:\d{2}$/)) {
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        return `${displayHour}:${minutes} ${ampm}`;
      }

      // Handle ISO format - ensure it's treated as IST
      let date: Date;
      
      // If it's a full ISO string with timezone info
      if (timeString.includes('T') && timeString.includes('Z')) {
        date = parseISO(timeString);
      } else if (timeString.includes('T')) {
        // If it's ISO format without timezone, assume it's already in IST
        date = parseISO(timeString + '+05:30');
      } else {
        // If it's just a time string, create a date for today with that time in IST
        const today = new Date();
        const [hours, minutes] = timeString.split(':');
        date = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 
                       parseInt(hours, 10), parseInt(minutes, 10));
        // Convert to IST by adding 5:30 offset
        date.setHours(date.getHours() + 5, date.getMinutes() + 30);
      }
      
      return formatInTimeZone(date, 'Asia/Kolkata', 'hh:mm a');
    } catch (error) {
      console.error('Error formatting time:', error, 'Input:', timeString);
      return timeString; // Fallback to original string if parsing fails
    }
  };

  const handleRegularizeDate = () => {
    if (noDataDate) {
      setShowNoDataModal(false);
      setShowRegularizationForm(true);
      setRegularizationRequestType('missing_shift');
      // Pass the selected date as shift data for regularization
      // For missing shifts, don't pass a shift_id since there's no real shift to reference
      setSelectedShiftForRegularization({
        id: null, // No shift_id for missing shifts
        start_time: "09:00", // Default start time
        end_time: "17:00", // Default end time
        date: format(noDataDate, "yyyy-MM-dd")
      });
    }
  };

  return (
    <View className="flex-1">
      <LinearGradient
        colors={isDark ? ["#1F2937", "#111827"] : ["#FFFFFF", "#F3F4F6"]}
        className="pb-4"
        style={[
          styles.header,
          {
            paddingTop:
              Platform.OS === "ios"
                ? StatusBar.currentHeight || 44
                : StatusBar.currentHeight || 0,
          },
        ]}
      >
        <View className="flex-row items-center justify-between px-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-4 p-2 rounded-full"
            style={{ backgroundColor: isDark ? "#374151" : "#F3F4F6" }}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={isDark ? "#FFFFFF" : "#000000"}
            />
          </TouchableOpacity>
          <Text
            className={`text-xl font-bold ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            {getRoleSpecificTitle(user?.role || "employee")}
          </Text>
          {user?.role === 'employee' && (
            <TouchableOpacity
              onPress={() => setShowRegularizationForm(true)}
              className="p-2 rounded-full"
              style={{ backgroundColor: isDark ? "#374151" : "#F3F4F6" }}
            >
              <Ionicons
                name="add"
                size={24}
                color={isDark ? "#FFFFFF" : "#000000"}
              />
            </TouchableOpacity>
          )}
          {user?.role !== 'employee' && <View style={{ width: 40 }} />}
        </View>
      </LinearGradient>

      <ScrollView
        className={`flex-1 ${isDark ? "bg-gray-900" : "bg-gray-50"}`}
        showsVerticalScrollIndicator={false}
      >
        {/* Monthly Stats */}
        <View className="flex-row flex-wrap p-4">
          {[
            {
              title: "Days Present",
              value: monthStats.totalDays,
              icon: "calendar-outline",
              color: "bg-blue-500",
            },
            {
              title: "Total Hours",
              value: monthStats.totalHours?.toFixed(1) || "0.0",
              icon: "time-outline",
              color: "bg-green-500",
            },
            {
              title: "Avg Hours/Day",
              value: monthStats.avgHours?.toFixed(1) || "0.0",
              icon: "stats-chart-outline",
              color: "bg-purple-500",
            },
            {
              title: "Total Expenses",
              value: `₹${monthStats.totalExpenses?.toFixed(0) || "0"}`,
              icon: "cash-outline",
              color: "bg-orange-500",
            },
          ].map((stat, index) => (
            <View key={index} className="w-1/2 p-2">
              <View
                className={`p-4 rounded-xl ${
                  isDark ? "bg-gray-800" : "bg-white"
                }`}
                style={styles.statCard}
              >
                <View
                  className={`w-10 h-10 rounded-full items-center justify-center ${stat.color}`}
                >
                  <Ionicons name={stat.icon as any} size={20} color="white" />
                </View>
                <Text
                  className={`mt-2 text-2xl font-bold ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                >
                  {stat.value}
                </Text>
                <Text
                  className={`text-sm ${
                    isDark ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {stat.title}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Calendar */}
        <View
          className={`mx-4 rounded-xl ${isDark ? "bg-gray-800" : "bg-white"}`}
          style={styles.calendarCard}
        >
          <Calendar
            theme={{
              calendarBackground: "transparent",
              textSectionTitleColor: isDark ? "#9CA3AF" : "#6B7280",
              selectedDayBackgroundColor: isDark ? "#1E40AF" : "#93C5FD",
              selectedDayTextColor: "#FFFFFF",
              todayTextColor: isDark ? "#60A5FA" : "#3B82F6",
              dayTextColor: isDark ? "#FFFFFF" : "#111827",
              textDisabledColor: isDark ? "#4B5563" : "#D1D5DB",
              monthTextColor: isDark ? "#FFFFFF" : "#111827",
              arrowColor: isDark ? "#FFFFFF" : "#111827",
              disabledTextColor: isDark ? "#4B5563" : "#D1D5DB",
            }}
            markedDates={getMarkedDates()}
            onDayPress={handleDateSelect}
            maxDate={format(new Date(), "yyyy-MM-dd")}
          />
        </View>

        {/* Selected Day Details */}
        {attendanceData[format(selectedDate, "yyyy-MM-dd")] ? (
          <View
            className={`m-4 p-4 rounded-xl ${
              isDark ? "bg-gray-800" : "bg-white"
            }`}
            style={styles.detailCard}
          >
            <Text
              className={`text-lg font-bold mb-4 ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {format(selectedDate, "MMMM d, yyyy")}
            </Text>

            {/* Daily Summary */}
            <View className="mb-6 p-4 rounded-lg bg-opacity-50 bg-blue-500/10">
              <Text
                className={`text-base font-semibold mb-2 ${
                  isDark ? "text-blue-400" : "text-blue-600"
                }`}
              >
                Daily Summary
              </Text>
              <View className="flex-row flex-wrap">
                <View className="w-1/2 mb-2">
                  <Text
                    className={`text-sm ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Total Shifts
                  </Text>
                  <Text
                    className={`text-base font-semibold ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {
                      attendanceData[format(selectedDate, "yyyy-MM-dd")].shifts
                        .length
                    }
                  </Text>
                </View>
                <View className="w-1/2 mb-2">
                  <Text
                    className={`text-sm ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Total Hours
                  </Text>
                  <Text
                    className={`text-base font-semibold ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {parseNumber(
                      attendanceData[format(selectedDate, "yyyy-MM-dd")]
                        .total_hours,
                    )?.toFixed(1) || "0.0"}{" "}
                    hrs
                  </Text>
                </View>
                <View className="w-1/2">
                  <Text
                    className={`text-sm ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Total Distance
                  </Text>
                  <Text
                    className={`text-base font-semibold ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {parseNumber(
                      attendanceData[format(selectedDate, "yyyy-MM-dd")]
                        .total_distance,
                    )?.toFixed(1) || "0.0"}{" "}
                    km
                  </Text>
                </View>
                <View className="w-1/2">
                  <Text
                    className={`text-sm ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Total Expenses
                  </Text>
                  <Text
                    className={`text-base font-semibold ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    ₹
                    {(() => {
                      const expenseValue = parseNumber(
                        attendanceData[format(selectedDate, "yyyy-MM-dd")]
                          .total_expenses,
                      );
                      console.log(`Displaying total expenses: ${expenseValue}`);
                      return expenseValue.toFixed(2) || "0.00";
                    })()}
                  </Text>
                </View>
              </View>
            </View>

            {/* Individual Shifts */}
            <Text
              className={`text-base font-semibold mb-3 ${
                isDark ? "text-gray-300" : "text-gray-700"
              }`}
            >
              Shift Details
            </Text>

            {attendanceData[format(selectedDate, "yyyy-MM-dd")].shifts.map(
              (shift, index) => (
                <View
                  key={index}
                  className={`mb-4 p-4 rounded-lg ${
                    isDark ? "bg-gray-700" : "bg-gray-50"
                  } ${
                    index ===
                    attendanceData[format(selectedDate, "yyyy-MM-dd")].shifts
                      .length -
                      1
                      ? "mb-0"
                      : ""
                  }`}
                >
                  <Text
                    className={`text-sm font-medium mb-2 ${
                      isDark ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Shift {index + 1}
                  </Text>

                  <View className="space-y-3">
                    {[
                      {
                        label: "Shift Time",
                        value: (() => {
                          const startTime = formatTime(shift.shift_start);
                          const endTime = shift.shift_end ? formatTime(shift.shift_end) : "Ongoing";
                          return `${startTime} - ${endTime}`;
                        })(),
                        icon: "time-outline" as keyof typeof Ionicons.glyphMap,
                      },
                      {
                        label: "Duration",
                        value: `${
                          parseNumber(shift.total_hours)?.toFixed(1) || "0.0"
                        } hrs`,
                        icon: "hourglass-outline" as keyof typeof Ionicons.glyphMap,
                      },
                      {
                        label: "Distance",
                        value: `${
                          parseNumber(shift.total_distance)?.toFixed(1) || "0.0"
                        } km`,
                        icon: "map-outline" as keyof typeof Ionicons.glyphMap,
                      },
                      {
                        label: "Expenses",
                        value: `₹${(() => {
                          const expValue = parseNumber(shift.total_expenses);
                          console.log(`Rendering shift expenses: ${expValue}`);
                          return expValue.toFixed(2) || "0.00";
                        })()}`,
                        icon: "cash-outline" as keyof typeof Ionicons.glyphMap,
                      },
                    ].map((detail, detailIndex) => (
                      <View key={detailIndex} className="flex-row items-center">
                        <View
                          className={`w-8 h-8 rounded-full items-center justify-center ${
                            isDark ? "bg-gray-600" : "bg-gray-200"
                          }`}
                        >
                          <Ionicons
                            name={detail.icon}
                            size={16}
                            color={isDark ? "#60A5FA" : "#3B82F6"}
                          />
                        </View>
                        <View className="ml-3 flex-1">
                          <Text
                            className={`text-xs ${
                              isDark ? "text-gray-400" : "text-gray-600"
                            }`}
                          >
                            {detail.label}
                          </Text>
                          <Text
                            className={`text-sm font-semibold ${
                              isDark ? "text-white" : "text-gray-900"
                            }`}
                          >
                            {detail.value}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                  
                  {/* Regularization Button for Employees */}
                  {user?.role === 'employee' && (
                    <View className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedShiftForRegularization({
                            id: shift.id, // Use actual shift ID from employee_shifts table
                            start_time: shift.shift_start,
                            end_time: shift.shift_end,
                            date: shift.date
                          });
                          setShowRegularizationForm(true);
                        }}
                        className="flex-row items-center justify-center py-3 px-4 rounded-lg"
                        style={{ backgroundColor: isDark ? "#374151" : "#F3F4F6" }}
                      >
                        <Ionicons
                          name="time-outline"
                          size={20}
                          color={isDark ? "#60A5FA" : "#3B82F6"}
                        />
                        <Text
                          className={`ml-2 font-medium ${
                            isDark ? "text-blue-400" : "text-blue-600"
                          }`}
                        >
                          Request Regularization
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ),
            )}

            {/* Regularizations Section */}
            {regularizations[format(selectedDate, "yyyy-MM-dd")] && regularizations[format(selectedDate, "yyyy-MM-dd")].length > 0 && (
              <View className="mt-6">
                <Text
                  className={`text-base font-semibold mb-3 ${
                    isDark ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Regularized Shifts
                </Text>
                {regularizations[format(selectedDate, "yyyy-MM-dd")].map((regularization, index) => (
                  <View
                    key={index}
                    className={`mb-4 p-4 rounded-lg ${
                      isDark ? "bg-green-900/20 border border-green-800" : "bg-green-50 border border-green-200"
                    }`}
                  >
                    <View className="flex-row items-center mb-2">
                      <View
                        className={`w-6 h-6 rounded-full items-center justify-center mr-2 ${
                          isDark ? "bg-green-800" : "bg-green-200"
                        }`}
                      >
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color={isDark ? "#10B981" : "#059669"}
                        />
                      </View>
                      <Text
                        className={`text-sm font-medium ${
                          isDark ? "text-green-400" : "text-green-600"
                        }`}
                      >
                        Regularized Shift {index + 1}
                      </Text>
                    </View>

                    <View className="space-y-2">
                      {[
                        {
                          label: "Regularized Time",
                          value: (() => {
                            const startTime = formatTime(regularization.requested_start_time);
                            const endTime = formatTime(regularization.requested_end_time);
                            return `${startTime} - ${endTime}`;
                          })(),
                          icon: "time-outline" as keyof typeof Ionicons.glyphMap,
                        },
                        {
                          label: "Type",
                          value: regularization.request_type?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'N/A',
                          icon: "document-text-outline" as keyof typeof Ionicons.glyphMap,
                        },
                        {
                          label: "Reason",
                          value: regularization.reason || 'N/A',
                          icon: "chatbubble-outline" as keyof typeof Ionicons.glyphMap,
                        },
                      ].map((detail, detailIndex) => (
                        <View key={detailIndex} className="flex-row items-start">
                          <View
                            className={`w-6 h-6 rounded-full items-center justify-center mr-2 mt-0.5 ${
                              isDark ? "bg-green-800" : "bg-green-200"
                            }`}
                          >
                            <Ionicons
                              name={detail.icon}
                              size={12}
                              color={isDark ? "#10B981" : "#059669"}
                            />
                          </View>
                          <View className="flex-1">
                            <Text
                              className={`text-xs ${
                                isDark ? "text-green-300" : "text-green-500"
                              }`}
                            >
                              {detail.label}
                            </Text>
                            <Text
                              className={`text-sm font-medium ${
                                isDark ? "text-white" : "text-gray-900"
                              }`}
                            >
                              {detail.value}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : regularizations[format(selectedDate, "yyyy-MM-dd")] && regularizations[format(selectedDate, "yyyy-MM-dd")].length > 0 ? (
          <View
            className={`m-4 p-4 mb-10 rounded-xl ${
              isDark ? "bg-gray-800" : "bg-white"
            }`}
            style={styles.detailCard}
          >
            <Text
              className={`text-lg font-bold mb-4 ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {format(selectedDate, "MMMM d, yyyy")}
            </Text>

            {/* Regularizations Only Section */}
            <View className="mt-6">
              <Text
                className={`text-base font-semibold mb-3 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Regularized Shifts
              </Text>
              {regularizations[format(selectedDate, "yyyy-MM-dd")].map((regularization, index) => (
                <View
                  key={index}
                  className={`mb-4 p-4 rounded-lg ${
                    isDark ? "bg-green-900/20 border border-green-800" : "bg-green-50 border border-green-200"
                  }`}
                >
                  <View className="flex-row items-center mb-2">
                    <View
                      className={`w-6 h-6 rounded-full items-center justify-center mr-2 ${
                        isDark ? "bg-green-800" : "bg-green-200"
                      }`}
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={isDark ? "#10B981" : "#059669"}
                      />
                    </View>
                    <Text
                      className={`text-sm font-medium ${
                        isDark ? "text-green-400" : "text-green-600"
                      }`}
                    >
                      Regularized Shift {index + 1}
                    </Text>
                  </View>

                  <View className="space-y-2">
                    {[
                        {
                          label: "Regularized Time",
                          value: (() => {
                            const startTime = formatTime(regularization.requested_start_time);
                            const endTime = formatTime(regularization.requested_end_time);
                            return `${startTime} - ${endTime}`;
                          })(),
                          icon: "time-outline" as keyof typeof Ionicons.glyphMap,
                        },
                      {
                        label: "Type",
                        value: regularization.request_type?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'N/A',
                        icon: "document-text-outline" as keyof typeof Ionicons.glyphMap,
                      },
                      {
                        label: "Reason",
                        value: regularization.reason || 'N/A',
                        icon: "chatbubble-outline" as keyof typeof Ionicons.glyphMap,
                      },
                    ].map((detail, detailIndex) => (
                      <View key={detailIndex} className="flex-row items-start">
                        <View
                          className={`w-6 h-6 rounded-full items-center justify-center mr-2 mt-0.5 ${
                            isDark ? "bg-green-800" : "bg-green-200"
                          }`}
                        >
                          <Ionicons
                            name={detail.icon}
                            size={12}
                            color={isDark ? "#10B981" : "#059669"}
                          />
                        </View>
                        <View className="flex-1">
                          <Text
                            className={`text-xs ${
                              isDark ? "text-green-300" : "text-green-500"
                            }`}
                          >
                            {detail.label}
                          </Text>
                          <Text
                            className={`text-sm font-medium ${
                              isDark ? "text-white" : "text-gray-900"
                            }`}
                          >
                            {detail.value}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View
            className={`m-4 p-4 mb-10 rounded-xl ${
              isDark ? "bg-gray-800" : "bg-white"
            }`}
            style={styles.detailCard}
          >
            <View className="items-center py-6">
              <Ionicons
                name="calendar-outline"
                size={48}
                color={isDark ? "#4B5563" : "#9CA3AF"}
              />
              <Text
                className={`mt-4 text-center text-lg ${
                  isDark ? "text-gray-400" : "text-gray-500"
                }`}
              >
                No attendance record found for{" "}
                {format(selectedDate, "MMMM d, yyyy")}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Regularization Request Form Modal */}
      <RegularizationRequestForm
        visible={showRegularizationForm}
        onClose={() => {
          setShowRegularizationForm(false);
          setSelectedShiftForRegularization(null);
          setRegularizationRequestType('time_adjustment'); // Reset to default
        }}
        onSuccess={() => {
          // Refresh attendance data after successful submission
          fetchAttendanceData(format(selectedDate, "yyyy-MM"));
          setRegularizationRequestType('time_adjustment'); // Reset to default
        }}
        shiftData={selectedShiftForRegularization}
        requestType={regularizationRequestType}
      />

      {/* No Data Modal */}
      <Modal
        visible={showNoDataModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNoDataModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? "#1a1a1a" : "#ffffff" }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={[styles.iconContainer, { backgroundColor: isDark ? "#374151" : "#F3F4F6" }]}>
                <Ionicons
                  name="calendar-outline"
                  size={32}
                  color={isDark ? "#60A5FA" : "#3B82F6"}
                />
              </View>
              <Text style={[styles.modalTitle, { color: isDark ? "#ffffff" : "#000000" }]}>
                No Attendance Data
              </Text>
              <Text style={[styles.modalSubtitle, { color: isDark ? "#9CA3AF" : "#6B7280" }]}>
                {noDataDate ? format(noDataDate, "MMMM d, yyyy") : ""}
              </Text>
            </View>

            {/* Modal Body */}
            <View style={styles.modalBody}>
              <Text style={[styles.modalMessage, { color: isDark ? "#D1D5DB" : "#374151" }]}>
                No attendance record was found for the selected date. You can create a regularization request to record your attendance for this day.
              </Text>

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowNoDataModal(false)}
                >
                  <Text style={[styles.modalButtonText, { color: isDark ? "#D1D5DB" : "#374151" }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.regularizeButton]}
                  onPress={handleRegularizeDate}
                >
                  <Ionicons name="time-outline" size={20} color="#ffffff" />
                  <Text style={styles.modalButtonText}>Regularize</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  statCard: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  calendarCard: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    padding: 10,
  },
  detailCard: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    borderRadius: 16,
    padding: 0,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    maxWidth: 400,
  },
  modalHeader: {
    padding: 24,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.1)",
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 16,
    fontWeight: "400",
    textAlign: "center",
  },
  modalBody: {
    padding: 24,
  },
  modalMessage: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    marginBottom: 32,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  cancelButton: {
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  },
  regularizeButton: {
    backgroundColor: "#007AFF",
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
