import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Platform,
  KeyboardAvoidingView,
  StatusBar,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AuthContext from "../../context/AuthContext";
import ThemeContext from "../../context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import { format, differenceInSeconds } from "date-fns";
import axios from "axios";
import TaskList from "./components/TaskList";
import BottomNav from "../../components/BottomNav";
import { employeeNavItems } from "./utils/navigationItems";
import Constants from "expo-constants";
import { promptFaceConfiguration } from "../../utils/deepLinkUtils";
// import PushNotificationService from '../../utils/pushNotificationService';

const { width, height } = Dimensions.get("window");

// Add Task interface
interface Task {
  id: number;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed";
  priority: "low" | "medium" | "high" | "critical";
  due_date: string;
  assigned_by_name: string;
  customer_name?: string;
  customer_contact?: string;
  customer_notes?: string;
  attachments?: any[];
}

// Add this interface near your other interfaces
interface TaskStats {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  completionRate: number;
  currentMonth: string;
}

const API_URL =
  Constants.expoConfig?.extra?.apiUrl ||
  process.env.EXPO_PUBLIC_API_URL ||
  "http://localhost:3000";

export default function EmployeeDashboard() {
  const { theme } = ThemeContext.useTheme();
  const { user, token } = AuthContext.useAuth();
  const router = useRouter();

  // State management
  const [activeTab, setActiveTab] = useState("home");
  const [greeting, setGreeting] = useState("");
  const [lastLogin, setLastLogin] = useState("");
  const [shiftStatus, setShiftStatus] = useState("No Active Shift");
  const [attendanceStatus, setAttendanceStatus] = useState("Not Marked");
  const [activeTaskType, setActiveTaskType] = useState("All Tasks");
  const [taskPriority, setTaskPriority] = useState("Medium");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [faceRegistrationStatus, setFaceRegistrationStatus] = useState<{
    registered: boolean;
    enabled: boolean;
    loading: boolean;
  }>({ registered: false, enabled: true, loading: true });

  // Fetch face registration status
  const fetchFaceRegistrationStatus = async () => {
    try {
      setFaceRegistrationStatus((prev) => ({ ...prev, loading: true }));
      const response = await axios.get(
        `${API_URL}/api/face-verification/status`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      setFaceRegistrationStatus({
        registered: response.data.face_registered || false,
        enabled: response.data.face_enabled !== false,
        loading: false,
      });
    } catch (error) {
      console.error("Error fetching face registration status:", error);
      setFaceRegistrationStatus((prev) => ({ ...prev, loading: false }));
    }
  };

  // Dynamic quick actions based on face registration status
  const getQuickActions = () => {
    const baseActions = [
      // {
      //   id: 1,
      //   title: "Shift Tracker",
      //   icon: "time-outline",
      //   color: "#10B981",
      //   action: () => router.push("/(dashboard)/shared/shiftTracker"),
      // },
      {
        id: 2,
        title: "Submit Expenses",
        icon: "receipt-outline",
        color: "#F59E0B",
        action: () => router.push("/(dashboard)/employee/employeeExpenses"),
      },
      {
        id: 3,
        title: "View Schedule",
        icon: "calendar-outline",
        color: "#3B82F6",
        action: () => router.push("/(dashboard)/employee/employeeSchedule"),
      },
      {
        id: 4,
        title: "Request Leave",
        icon: "airplane-outline",
        color: "#8B5CF6",
        action: () => router.push("/(dashboard)/employee/leave-insights"),
      },
    ];

    // Add face setup action if not registered or if there are issues
    if (!faceRegistrationStatus.loading && !faceRegistrationStatus.registered) {
      baseActions.splice(1, 0, {
        id: 5,
        title: "Set Up Face Verification",
        icon: "shield-outline",
        color: "#EF4444",
        action: () => promptFaceConfiguration("dashboard-quick-action"),
      });
    }

    return baseActions;
  };

  // Get shift management action based on current shift status
  const getShiftManagementAction = () => {
    const isActiveShift = shiftStatus === "Active Shift";

    return {
      id: "shift-management",
      title: isActiveShift ? "End Shift" : "Start Shift",
      icon: isActiveShift ? "stop-circle-outline" : "play-circle-outline",
      color: isActiveShift ? "#EF4444" : "#10B981",
      action: () => router.push("/(dashboard)/shared/shiftTracker"),
      subtitle: isActiveShift
        ? currentShiftDuration
          ? `Duration: ${currentShiftDuration}`
          : "Click to end your shift"
        : "Click to start your shift",
    };
  };

  // Add isFocused hook
  const isFocused = useIsFocused();

  // Add new state for shift duration
  const [currentShiftDuration, setCurrentShiftDuration] = useState<
    string | null
  >(null);
  const [shiftStartTime, setShiftStartTime] = useState<Date | null>(null);

  // Add these new states for TaskProgressBar
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Animation refs
  const floatingShapesAnim = useRef(new Animated.Value(0)).current;

  // Theme-based colors
  const colors = {
    // Light theme colors
    light: {
      primary: "#3B82F6", // Blue-500
      secondary: "#0EA5E9", // Sky-500
      accent: "#6366F1", // Indigo-500
      background: "#F8FAFC", // Slate-50
      surface: "#FFFFFF", // White
      card: "#FFFFFF", // White
      text: "#0F172A", // Slate-900
      textSecondary: "#475569", // Slate-600
      textTertiary: "#64748B", // Slate-500
      border: "#E2E8F0", // Slate-200
      success: "#10B981", // Emerald-500
      warning: "#F59E0B", // Amber-500
      error: "#EF4444", // Red-500
      info: "#3B82F6", // Blue-500
    },
    // Dark theme colors
    dark: {
      primary: "#60A5FA", // Blue-400
      secondary: "#38BDF8", // Sky-400
      accent: "#818CF8", // Indigo-400
      background: "#0F172A", // Slate-900
      surface: "#1E293B", // Slate-800
      card: "#1E293B", // Slate-800
      text: "#F8FAFC", // Slate-50
      textSecondary: "#CBD5E1", // Slate-300
      textTertiary: "#94A3B8", // Slate-400
      border: "#334155", // Slate-700
      success: "#34D399", // Emerald-400
      warning: "#FBBF24", // Amber-400
      error: "#F87171", // Red-400
      info: "#60A5FA", // Blue-400
    },
  };

  const currentColors = colors[theme];

  // Set greeting based on time of day
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good Morning");
    else if (hour < 17) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");

    // Simulate fetching last login
    setLastLogin(new Date().toLocaleString());

    // Floating shapes animation
    Animated.loop(
      Animated.timing(floatingShapesAnim, {
        toValue: 1,
        duration: 12000,
        useNativeDriver: true,
      }),
    ).start();
  }, []);

  // Add effect for real-time updates
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const updateDashboard = async () => {
      try {
        const shiftStatusData = await AsyncStorage.getItem(
          `${user?.role}-shiftStatus`,
        );

        if (shiftStatusData) {
          const { isActive, startTime } = JSON.parse(shiftStatusData);

          if (isActive && startTime) {
            setShiftStatus("Active Shift");
            setAttendanceStatus("Present");
            setShiftStartTime(new Date(startTime));

            // Calculate duration in real-time
            const elapsedSeconds = differenceInSeconds(
              new Date(),
              new Date(startTime),
            );
            const hours = Math.floor(elapsedSeconds / 3600);
            const minutes = Math.floor((elapsedSeconds % 3600) / 60);
            const seconds = elapsedSeconds % 60;
            const duration = `${hours.toString().padStart(2, "0")}:${minutes
              .toString()
              .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

            setCurrentShiftDuration(duration);
          } else {
            setShiftStatus("No Active Shift");
            setAttendanceStatus("Not Marked");
            setCurrentShiftDuration(null);
            setShiftStartTime(null);
          }
        } else {
          setShiftStatus("No Active Shift");
          setAttendanceStatus("Not Marked");
          setCurrentShiftDuration(null);
          setShiftStartTime(null);
        }
      } catch (error) {
        console.error("Error updating dashboard:", error);
      }
    };

    if (isFocused) {
      // Initial update
      updateDashboard();

      // Set up interval for real-time updates
      intervalId = setInterval(updateDashboard, 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isFocused]);

  // Add this helper function
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "Low":
        return "#10B981";
      case "Medium":
        return "#F59E0B";
      case "High":
        return "#EF4444";
      default:
        return "#6B7280";
    }
  };

  // Add this function to filter tasks
  const getFilteredTasks = () => {
    if (activeTaskType === "All Tasks") return tasks;
    return tasks.filter(
      (task) => task.status.toLowerCase() === activeTaskType.toLowerCase(),
    );
  };

  // Add this function to check if a task is from today
  const isToday = (dateString: string) => {
    const today = new Date().toISOString().split("T")[0];
    return dateString.split("T")[0] === today;
  };

  // Update the fetchTasks function
  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      console.log("Current user:", user);
      console.log("Token:", token);

      const response = await axios.get(`${API_URL}/api/tasks/employee`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // console.log('API Response:', response);
      setTasks(response.data);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      if (axios.isAxiosError(error)) {
        console.log("Error response:", error.response?.data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Add an effect to refresh tasks at midnight
  useEffect(() => {
    fetchTasks();

    // Calculate time until next midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const timeUntilMidnight = tomorrow.getTime() - now.getTime();

    // Set up timer to refresh tasks at midnight
    const timer = setTimeout(() => {
      fetchTasks();
    }, timeUntilMidnight);

    return () => clearTimeout(timer);
  }, []);

  // Move fetchTaskStats to parent component
  const fetchTaskStats = async (forceRefresh = false) => {
    try {
      setStatsLoading(true);

      // Check cache first, unless forceRefresh is true
      if (!forceRefresh) {
        const cachedStats = await AsyncStorage.getItem("taskStats");
        const cachedTimestamp =
          await AsyncStorage.getItem("taskStatsTimestamp");

        const now = new Date().getTime();
        const cacheAge = cachedTimestamp
          ? now - parseInt(cachedTimestamp)
          : Infinity;
        const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

        // Use cached data if it's less than 5 minutes old
        if (cachedStats && cacheAge < CACHE_DURATION) {
          setTaskStats(JSON.parse(cachedStats));
          setStatsLoading(false);
          return;
        }
      }

      const response = await axios.get(`${API_URL}/api/tasks/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Update cache
      await AsyncStorage.setItem("taskStats", JSON.stringify(response.data));
      await AsyncStorage.setItem(
        "taskStatsTimestamp",
        new Date().getTime().toString(),
      );

      setTaskStats(response.data);
    } catch (error) {
      console.error("Error fetching task stats:", error);
    } finally {
      setStatsLoading(false);
    }
  };

  // Modify handleUpdateTaskStatus to refresh stats after status update
  const handleUpdateTaskStatus = async (taskId: number, newStatus: string) => {
    try {
      await axios.patch(
        `${API_URL}/api/tasks/${taskId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      // Get the task that was updated
      const updatedTask = tasks.find((task) => task.id === taskId);
      if (updatedTask) {
        // Send notification to group admin
        await axios.post(
          `${API_URL}/api/employee-notifications/notify-admin`,
          {
            title: `📋 Task Status Updated by ${user?.name}`,
            message:
              `━━━━━━━━ Task Details ━━━━━━━━\n` +
              `📌 Task: ${updatedTask.title}\n` +
              `📝 Description: ${updatedTask.description}\n\n` +
              `🔄 Status Change\n` +
              `• From: ${updatedTask.status
                .replace("_", " ")
                .toUpperCase()}\n` +
              `• To: ${newStatus.replace("_", " ").toUpperCase()}\n\n` +
              `⚡ Priority: ${updatedTask.priority.toUpperCase()}\n` +
              `📅 Due Date: ${
                updatedTask.due_date
                  ? format(new Date(updatedTask.due_date), "dd MMM yyyy")
                  : "Not set"
              }\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            type: "task-update",
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
      }

      // Fetch both tasks and stats after status update
      await Promise.all([
        fetchTasks(),
        fetchTaskStats(true), // Force refresh stats
      ]);
    } catch (error) {
      console.error("Error updating task status:", error);
      Alert.alert("Error", "Failed to update task status");
    }
  };

  // Initial fetch for both tasks and stats
  useEffect(() => {
    const initialFetch = async () => {
      await Promise.all([
        fetchTasks(),
        fetchTaskStats(),
        fetchFaceRegistrationStatus(),
      ]);
    };
    initialFetch();
  }, []);

  // Modify handleRefresh to update both tasks and stats
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchTasks(),
        fetchTaskStats(true), // Force refresh stats
        fetchFaceRegistrationStatus(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Modify TaskProgressBar component to use props
  const TaskProgressBar = () => {
    // Set up auto-refresh interval
    useEffect(() => {
      const intervalId = setInterval(
        () => {
          fetchTaskStats();
        },
        5 * 60 * 1000,
      ); // Refresh every 5 minutes

      return () => clearInterval(intervalId);
    }, []); // Empty dependency array since fetchTaskStats is stable

    if (statsLoading && !taskStats) {
      return (
        <View style={{ margin: 16, marginTop: 16 }}>
          <ActivityIndicator size="small" color={currentColors.primary} />
        </View>
      );
    }

    if (!taskStats) return null;

    // Calculate percentages safely
    const calculatePercentage = (value: number, total: number) => {
      if (total === 0) return 0; // Return 0% if total is 0
      return (value / total) * 100;
    };

    return (
      <View
        style={[
          styles.mainContainer,
          {
            backgroundColor: currentColors.surface,
            borderWidth: 1,
            borderColor: currentColors.border,
            shadowColor: currentColors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 5,
            margin: 16,
            marginTop: 16,
          },
        ]}
      >
        <View style={{ padding: 16, borderRadius: 16 }}>
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "600",
                  color: currentColors.text,
                }}
              >
                Task Progress
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: currentColors.textSecondary,
                }}
              >
                {taskStats.currentMonth} •{" "}
                {taskStats.total === 0
                  ? "No Tasks"
                  : `${taskStats.total} Total Tasks`}
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 20,
                backgroundColor:
                  theme === "dark"
                    ? "rgba(59, 130, 246, 0.2)"
                    : "rgba(59, 130, 246, 0.1)",
                borderWidth: 1,
                borderColor: currentColors.primary,
              }}
            >
              <Text style={{ color: currentColors.primary, fontWeight: "500" }}>
                {taskStats.total === 0 ? "0" : taskStats.completionRate}%
              </Text>
            </View>
          </View>

          {/* Progress bars container */}
          <View style={{ gap: 12 }}>
            {/* Completed Tasks */}
            <View>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    color: currentColors.textSecondary,
                  }}
                >
                  Completed
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: currentColors.textSecondary,
                  }}
                >
                  {taskStats.completed}/{taskStats.total}
                </Text>
              </View>
              <View
                style={{
                  height: 8,
                  backgroundColor: currentColors.border,
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: "100%",
                    backgroundColor: currentColors.success,
                    borderRadius: 4,
                    width: `${calculatePercentage(
                      taskStats.completed,
                      taskStats.total,
                    )}%`,
                  }}
                />
              </View>
            </View>

            {/* In Progress Tasks */}
            <View>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    color: currentColors.textSecondary,
                  }}
                >
                  In Progress
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: currentColors.textSecondary,
                  }}
                >
                  {taskStats.inProgress}/{taskStats.total}
                </Text>
              </View>
              <View
                style={{
                  height: 8,
                  backgroundColor: currentColors.border,
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: "100%",
                    backgroundColor: currentColors.primary,
                    borderRadius: 4,
                    width: `${calculatePercentage(
                      taskStats.inProgress,
                      taskStats.total,
                    )}%`,
                  }}
                />
              </View>
            </View>

            {/* Pending Tasks */}
            <View>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    color: currentColors.textSecondary,
                  }}
                >
                  Pending
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: currentColors.textSecondary,
                  }}
                >
                  {taskStats.pending}/{taskStats.total}
                </Text>
              </View>
              <View
                style={{
                  height: 8,
                  backgroundColor: currentColors.border,
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: "100%",
                    backgroundColor: currentColors.warning,
                    borderRadius: 4,
                    width: `${calculatePercentage(
                      taskStats.pending,
                      taskStats.total,
                    )}%`,
                  }}
                />
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const floatingOffset = floatingShapesAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 20],
  });

  return (
    <>
      <StatusBar
        barStyle={theme === "dark" ? "light-content" : "dark-content"}
        backgroundColor={currentColors.background}
        translucent={false}
        animated={true}
      />

      <SafeAreaView
        style={{ flex: 1, backgroundColor: currentColors.background }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={[
            styles.container,
            { backgroundColor: currentColors.background },
          ]}
        >
          {/* Main background */}
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          >
            {/* Subtle gradient overlay */}
            <LinearGradient
              colors={[
                currentColors.background,
                theme === "dark"
                  ? "rgba(59, 130, 246, 0.05)"
                  : "rgba(59, 130, 246, 0.02)",
                currentColors.background,
              ]}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />

            {/* Floating geometric shapes */}
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            >
              {/* Blue circle */}
              <Animated.View
                style={{
                  position: "absolute",
                  top: height * 0.1,
                  right: width * 0.1,
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  backgroundColor: currentColors.primary,
                  opacity: 0.15,
                  transform: [{ translateY: floatingOffset }],
                }}
              />

              {/* Sky square */}
              <Animated.View
                style={{
                  position: "absolute",
                  bottom: height * 0.3,
                  left: width * 0.1,
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  backgroundColor: currentColors.secondary,
                  opacity: 0.2,
                  transform: [
                    {
                      translateY: floatingOffset.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -15],
                      }),
                    },
                  ],
                }}
              />

              {/* Indigo triangle */}
              <Animated.View
                style={{
                  position: "absolute",
                  top: height * 0.7,
                  right: width * 0.2,
                  width: 0,
                  height: 0,
                  borderLeftWidth: 20,
                  borderRightWidth: 20,
                  borderBottomWidth: 35,
                  borderLeftColor: "transparent",
                  borderRightColor: "transparent",
                  borderBottomColor: currentColors.accent,
                  opacity: 0.1,
                  transform: [
                    {
                      translateY: floatingOffset.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 10],
                      }),
                    },
                  ],
                }}
              />
            </View>
          </View>

          {/* Header */}
          <View
            style={[
              styles.header,
              {
                backgroundColor: currentColors.surface,
                borderBottomColor: currentColors.border,
                shadowColor: currentColors.primary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => router.replace("/(dashboard)/employee/employee")}
            >
              <View
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  backgroundColor:
                    theme === "dark"
                      ? "rgba(59, 130, 246, 0.2)"
                      : "rgba(59, 130, 246, 0.1)",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 2,
                  borderColor: currentColors.primary,
                }}
              >
                <Image
                  source={require("./../../../assets/images/adaptive-icon.png")}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text
                numberOfLines={1}
                style={[
                  styles.welcomeText,
                  {
                    color: currentColors.text,
                    textShadowColor:
                      theme === "dark"
                        ? "rgba(0, 0, 0, 0.5)"
                        : "rgba(255, 255, 255, 0.8)",
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 2,
                  },
                ]}
              >
                {greeting}, {user?.name}
              </Text>
              <Text
                style={[styles.subText, { color: currentColors.textSecondary }]}
              >
                Last login: {lastLogin}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() =>
                router.push("/(dashboard)/employee/employeeSettings")
              }
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor:
                  theme === "dark"
                    ? "rgba(59, 130, 246, 0.2)"
                    : "rgba(59, 130, 246, 0.1)",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: currentColors.border,
              }}
            >
              <Ionicons
                name="settings-outline"
                size={20}
                color={currentColors.primary}
              />
            </TouchableOpacity>
          </View>

          {/* Main Content */}
          <ScrollView
            style={styles.content}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                colors={[theme === "dark" ? "#60A5FA" : "#3B82F6"]} // Blue color for refresh spinner
                tintColor={theme === "dark" ? "#60A5FA" : "#3B82F6"}
              />
            }
          >
            {/* Shift Management Section */}
            <View style={styles.shiftManagementSection}>
              <Text
                style={[
                  styles.shiftManagementTitle,
                  { color: theme === "dark" ? "#FFFFFF" : "#111827" },
                ]}
              >
                Shift Management
              </Text>
              <TouchableOpacity
                style={[
                  styles.shiftManagementCard,
                  { backgroundColor: theme === "dark" ? "#1F2937" : "#FFFFFF" },
                ]}
                onPress={getShiftManagementAction().action}
              >
                <View
                  style={[
                    styles.shiftIconCircle,
                    {
                      backgroundColor: `${getShiftManagementAction().color}20`,
                    },
                  ]}
                >
                  <Ionicons
                    name={getShiftManagementAction().icon as any}
                    size={32}
                    color={getShiftManagementAction().color}
                  />
                </View>
                <View style={styles.shiftManagementContent}>
                  <Text
                    style={[
                      styles.shiftManagementText,
                      { color: theme === "dark" ? "#FFFFFF" : "#111827" },
                    ]}
                  >
                    {getShiftManagementAction().title}
                  </Text>
                  <Text
                    style={[
                      styles.shiftManagementSubtext,
                      { color: theme === "dark" ? "#9CA3AF" : "#6B7280" },
                    ]}
                  >
                    {getShiftManagementAction().subtitle}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme === "dark" ? "#9CA3AF" : "#6B7280"}
                />
              </TouchableOpacity>
            </View>

            {/* Quick Actions Section */}
            <View style={styles.quickActionsSection}>
              <Text
                style={[
                  styles.quickActionsTitle,
                  { color: theme === "dark" ? "#FFFFFF" : "#111827" },
                ]}
              >
                Quick Actions
              </Text>
              <View style={styles.quickActionsGrid}>
                {getQuickActions().map((action) => (
                  <TouchableOpacity
                    key={action.id}
                    style={[
                      styles.quickActionCard,
                      {
                        backgroundColor:
                          theme === "dark" ? "#1F2937" : "#FFFFFF",
                      },
                    ]}
                    onPress={action.action}
                  >
                    <View
                      style={[
                        styles.iconCircle,
                        { backgroundColor: `${action.color}20` },
                      ]}
                    >
                      <Ionicons
                        name={action.icon as any}
                        size={24}
                        color={action.color}
                      />
                    </View>
                    <Text
                      style={[
                        styles.quickActionText,
                        { color: theme === "dark" ? "#FFFFFF" : "#111827" },
                      ]}
                    >
                      {action.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Status and Tasks Container */}
            <View
              style={[
                styles.mainContainer,
                {
                  backgroundColor: currentColors.surface,
                  borderWidth: 1,
                  borderColor: currentColors.border,
                  shadowColor: currentColors.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 5,
                },
              ]}
            >
              {/* Today's Status */}
              <View style={styles.statusSection}>
                <Text
                  style={[styles.sectionTitle, { color: currentColors.text }]}
                >
                  Today's Status
                </Text>
                <View style={styles.enhancedStatusRow}>
                  <View style={styles.statusItem}>
                    <View
                      style={[
                        styles.statusIconCircle,
                        {
                          backgroundColor:
                            shiftStatus === "Active Shift"
                              ? "#10B98120"
                              : "#9CA3AF20",
                        },
                      ]}
                    >
                      <Ionicons
                        name="time-outline"
                        size={20}
                        color={
                          shiftStatus === "Active Shift" ? "#10B981" : "#9CA3AF"
                        }
                      />
                    </View>
                    <View>
                      <Text
                        style={[
                          styles.statusLabel,
                          { color: currentColors.textSecondary },
                        ]}
                      >
                        Shift Status
                      </Text>
                      <Text
                        style={[
                          styles.statusValue,
                          { color: currentColors.text },
                        ]}
                      >
                        {shiftStatus}
                      </Text>
                      {currentShiftDuration && (
                        <Text
                          style={[
                            styles.statusSubValue,
                            { color: currentColors.primary },
                          ]}
                        >
                          Duration: {currentShiftDuration}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.statusItem}>
                    <View
                      style={[
                        styles.statusIconCircle,
                        {
                          backgroundColor:
                            attendanceStatus === "Present"
                              ? "#10B98120"
                              : "#9CA3AF20",
                        },
                      ]}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={20}
                        color={
                          attendanceStatus === "Present" ? "#10B981" : "#9CA3AF"
                        }
                      />
                    </View>
                    <View>
                      <View style={styles.attendanceHeader}>
                        <Text
                          style={[
                            styles.statusLabel,
                            { color: currentColors.textSecondary },
                          ]}
                        >
                          Attendance
                        </Text>
                        {attendanceStatus === "Present" && (
                          <View style={styles.liveIndicator}>
                            <Text style={styles.liveText}>
                              LIVE{" "}
                              <Ionicons
                                name="flash-outline"
                                size={8}
                                color={theme === "dark" ? "#10B981" : "#FFFFFF"}
                              />
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.statusValue,
                          { color: currentColors.text },
                        ]}
                      >
                        {attendanceStatus}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Divider */}
              <View
                style={[
                  styles.divider,
                  { backgroundColor: currentColors.border },
                ]}
              />

              {/* My Tasks Section */}
              <View style={styles.tasksSection}>
                <View style={styles.taskHeader}>
                  <Text
                    style={[styles.sectionTitle, { color: currentColors.text }]}
                  >
                    My Tasks
                  </Text>
                  <View style={styles.taskCount}>
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: currentColors.primary },
                      ]}
                    />
                    <Text
                      style={[
                        styles.taskCountText,
                        { color: currentColors.textSecondary },
                      ]}
                    >
                      {tasks.length} {tasks.length === 1 ? "Task" : "Tasks"} for
                      Today
                    </Text>
                  </View>
                </View>

                <TaskList
                  tasks={tasks}
                  isDark={theme === "dark"}
                  onUpdateStatus={handleUpdateTaskStatus}
                  activeTaskType={activeTaskType}
                  onChangeTaskType={setActiveTaskType}
                  onRefresh={handleRefresh}
                  refreshing={isRefreshing}
                />
              </View>
            </View>

            {/* Task Progress Bar */}
            <TaskProgressBar />
            {/* <TouchableOpacity onPress={() => router.push('/(testing)/notification-test')} className="flex justify-center items-center bg-blue-500 p-3 w-1/2 mb-5 rounded-md text-center mx-auto">
            <Text className="text-white">Send Test Notification</Text>
          </TouchableOpacity> */}
          </ScrollView>

          {/* Bottom Navigation */}
          <BottomNav items={employeeNavItems} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTextContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: "600",
  },
  subText: {
    fontSize: 12,
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  input: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    minHeight: 100,
  },
  charCount: {
    fontSize: 12,
    textAlign: "right",
    marginBottom: 16,
  },
  pickerContainer: {
    borderRadius: 8,
    marginBottom: 16,
    overflow: "hidden",
  },
  submitButton: {
    backgroundColor: "#3B82F6",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusText: {
    marginLeft: 8,
    fontSize: 14,
  },
  progressContainer: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
    marginVertical: 8,
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#3B82F6",
  },
  progressText: {
    textAlign: "center",
    marginTop: 8,
    fontSize: 14,
  },
  notification: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
  },
  notificationContent: {
    flex: 1,
    marginLeft: 12,
  },
  notificationText: {
    fontSize: 14,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
  },
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  navItem: {
    alignItems: "center",
    padding: 8,
  },
  navLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  shiftManagementSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  shiftManagementTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    marginLeft: 6,
  },
  shiftManagementCard: {
    width: "100%",
    padding: 20,
    borderRadius: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  shiftIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  shiftManagementContent: {
    flex: 1,
  },
  shiftManagementText: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  shiftManagementSubtext: {
    fontSize: 14,
    fontWeight: "400",
  },
  quickActionsSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  quickActionsTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    marginLeft: 6,
  },
  quickActionsGrid: {
    flexDirection: "column",
    gap: 12,
  },
  quickActionCard: {
    width: "100%",
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    flexDirection: "row",
    alignItems: "center",
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  enhancedStatusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  statusIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  statusLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  refreshButton: {
    padding: 8,
  },
  taskTypeSelector: {
    flexDirection: "row",
    marginBottom: 16,
    overflow: "scroll",
  },
  taskTypeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    marginRight: 6,
  },
  activeTaskType: {
    backgroundColor: "#3B82F6",
  },
  taskTypeText: {
    color: "#6B7280",
    fontSize: 13,
  },
  activeTaskTypeText: {
    color: "#FFFFFF",
  },
  taskMetaInputs: {
    marginTop: 16,
  },
  taskMetaRow: {
    marginBottom: 16,
  },
  metaLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  prioritySelector: {
    marginBottom: 16,
  },
  priorityButtons: {
    flexDirection: "row",
    gap: 8,
  },
  priorityButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    opacity: 0.6,
  },
  activePriority: {
    opacity: 1,
  },
  priorityText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  statusSubValue: {
    fontSize: 12,
    marginTop: 2,
  },
  activeShiftIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  activeShiftText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  mainContainer: {
    margin: 16,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  statusSection: {
    padding: 16,
  },
  divider: {
    height: 1,
    width: "100%",
  },
  tasksSection: {
    padding: 16,
  },
  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  taskCount: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  taskCountText: {
    fontSize: 14,
  },
  attendanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  liveIndicator: {
    backgroundColor: "#10B981",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    marginLeft: 0,
  },
  liveText: {
    color: "#FFFFFF",
    fontSize: 7,
    fontWeight: "600",
    lineHeight: 10,
  },
});
