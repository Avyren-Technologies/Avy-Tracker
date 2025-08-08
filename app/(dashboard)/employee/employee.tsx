import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AuthContext from '../../context/AuthContext';
import ThemeContext from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { format, differenceInSeconds } from 'date-fns';
import axios from 'axios';
import TaskList from './components/TaskList';
import BottomNav from '../../components/BottomNav';
import { employeeNavItems } from './utils/navigationItems';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

// Orange and Blue color scheme based on logo (matching splash screen and login)
const colors = {
  primary: '#FF6B35', // Vibrant orange
  secondary: '#1E3A8A', // Rich blue
  accent: '#F97316', // Lighter orange
  accentBlue: '#3B82F6', // Lighter blue
  white: '#FFFFFF',
  black: '#000000',
  textLight: '#FFFFFF',
  textDark: '#1F2937',
  textSecondary: '#6B7280',
};

// Add Task interface
interface Task {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  due_date: string;
  assigned_by_name: string;
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

const API_URL = Constants.expoConfig?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

export default function EmployeeDashboard() {
  const { theme } = ThemeContext.useTheme();
  const { user, token } = AuthContext.useAuth();
  const router = useRouter();

  // State management
  const [activeTab, setActiveTab] = useState('home');
  const [greeting, setGreeting] = useState('');
  const [lastLogin, setLastLogin] = useState('');
  const [shiftStatus, setShiftStatus] = useState('No Active Shift');
  const [attendanceStatus, setAttendanceStatus] = useState('Not Marked');
  const [activeTaskType, setActiveTaskType] = useState('All Tasks');
  const [taskPriority, setTaskPriority] = useState('Medium');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Add new state for quick actions (updated to list format)
  const [quickActions] = useState([
    {
      id: 1,
      title: "Shift Tracker",
      subtitle: "Track your work hours and attendance",
      icon: "time-outline",
      color: colors.primary,
      action: () => router.push("/(dashboard)/shared/shiftTracker"),
    },
    {
      id: 2,
      title: "Submit Expenses",
      subtitle: "Upload and manage your expense reports",
      icon: "receipt-outline",
      color: colors.accent,
      action: () => router.push("/(dashboard)/employee/employeeExpenses"),
    },
    {
      id: 3,
      title: "View Schedule",
      subtitle: "Check your work schedule and shifts",
      icon: "calendar-outline",
      color: colors.accentBlue,
      action: () => router.push("/(dashboard)/employee/employeeSchedule"),
    },
    {
      id: 4,
      title: "Request Leave",
      subtitle: "Apply for leave and view leave balance",
      icon: "airplane-outline",
      color: colors.secondary,
      action: () => router.push("/(dashboard)/employee/leave-insights"),
    },
  ]);

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

  // Set greeting based on time of day
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good Morning");
    else if (hour < 17) setGreeting("Good Afternoon");
    else setGreeting("Good Evening");

    // Simulate fetching last login
    setLastLogin(new Date().toLocaleString());
  }, []);

  // Add effect for real-time updates
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const updateDashboard = async () => {
      try {
        const shiftStatusData = await AsyncStorage.getItem(
          `${user?.role}-shiftStatus`
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
              new Date(startTime)
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
      case 'Low':
        return '#10B981';
      case 'Medium':
        return '#F59E0B';
      case 'High':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  // Add this function to filter tasks
  const getFilteredTasks = () => {
    if (activeTaskType === 'All Tasks') return tasks;
    return tasks.filter(task => task.status.toLowerCase() === activeTaskType.toLowerCase());
  };

  // Add this function to check if a task is from today
  const isToday = (dateString: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dateString.split('T')[0] === today;
  };

  // Update the fetchTasks function
  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      console.log("Current user:", user);
      console.log("Token:", token);

      const response = await axios.get(
        `${API_URL}/api/tasks/employee`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      // console.log('API Response:', response);
      setTasks(response.data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      if (axios.isAxiosError(error)) {
        console.log('Error response:', error.response?.data);
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
        const cachedStats = await AsyncStorage.getItem('taskStats');
        const cachedTimestamp = await AsyncStorage.getItem('taskStatsTimestamp');
        
        const now = new Date().getTime();
        const cacheAge = cachedTimestamp ? now - parseInt(cachedTimestamp) : Infinity;
        const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

        // Use cached data if it's less than 5 minutes old
        if (cachedStats && cacheAge < CACHE_DURATION) {
          setTaskStats(JSON.parse(cachedStats));
          setStatsLoading(false);
          return;
        }
      }

      const response = await axios.get(
        `${API_URL}/api/tasks/stats`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Update cache
      await AsyncStorage.setItem('taskStats', JSON.stringify(response.data));
      await AsyncStorage.setItem('taskStatsTimestamp', new Date().getTime().toString());
      
      setTaskStats(response.data);
    } catch (error) {
      console.error('Error fetching task stats:', error);
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
        { headers: { Authorization: `Bearer ${token}` } }
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
          }
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
      await Promise.all([fetchTasks(), fetchTaskStats()]);
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
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Modify TaskProgressBar component to use props
  const TaskProgressBar = () => {
    const { theme } = ThemeContext.useTheme();
    const isDark = theme === "dark";

    // Set up auto-refresh interval
    useEffect(() => {
      const intervalId = setInterval(() => {
        fetchTaskStats();
      }, 5 * 60 * 1000); // Refresh every 5 minutes

      return () => clearInterval(intervalId);
    }, []); // Empty dependency array since fetchTaskStats is stable

    if (statsLoading && !taskStats) {
      return (
        <View style={styles.progressCardContainer}>
          <ActivityIndicator size="small" color={colors.accentBlue} />
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
      <View style={[styles.progressCard, { backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.95)' }]}>
        <View style={styles.progressCardContent}>
          {/* Header */}
          <View style={styles.progressCardHeader}>
            <View style={styles.progressCardTitleContainer}>
              <Ionicons name="trending-up-outline" size={24} color={colors.primary} />
              <Text style={[styles.progressCardTitle, { color: theme === 'dark' ? colors.textDark : colors.textDark }]}>
                Task Progress
              </Text>
            </View>
            <View style={[styles.progressCardBadge, { backgroundColor: `${colors.primary}15` }]}>
              <Text style={[styles.progressCardBadgeText, { color: colors.primary }]}>
                {taskStats.total === 0 ? "0" : taskStats.completionRate}%
              </Text>
            </View>
          </View>

          <Text style={[styles.progressCardSubtitle, { color: theme === 'dark' ? colors.textSecondary : colors.textSecondary }]}>
            {taskStats.currentMonth} • {taskStats.total === 0 ? "No Tasks" : `${taskStats.total} Total Tasks`}
          </Text>

          {/* Progress cards container */}
          <View style={styles.progressCardsContainer}>
            {/* Completed Tasks */}
            <View style={styles.progressCardItem}>
              <View style={styles.progressCardItemHeader}>
                <View style={styles.progressCardItemIconContainer}>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#10B981" />
                </View>
                <View style={styles.progressCardItemContent}>
                  <Text style={[styles.progressCardItemLabel, { color: theme === 'dark' ? colors.textDark : colors.textDark }]}>
                    Completed
                  </Text>
                  <Text style={[styles.progressCardItemCount, { color: colors.textSecondary }]}>
                    {taskStats.completed} of {taskStats.total}
                  </Text>
                </View>
                <Text style={[styles.progressCardItemPercentage, { color: '#10B981' }]}>
                  {taskStats.total === 0 ? "0" : Math.round(calculatePercentage(taskStats.completed, taskStats.total))}%
                </Text>
              </View>
              <View style={[styles.progressCardBarBackground, { backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(0, 0, 0, 0.03)' }]}>
                <View
                  style={[styles.progressCardBarFill, { 
                    backgroundColor: '#10B981',
                    width: `${calculatePercentage(taskStats.completed, taskStats.total)}%`
                  }]}
                />
              </View>
            </View>

            {/* In Progress Tasks */}
            <View style={styles.progressCardItem}>
              <View style={styles.progressCardItemHeader}>
                <View style={styles.progressCardItemIconContainer}>
                  <Ionicons name="time-outline" size={20} color={colors.accentBlue} />
                </View>
                <View style={styles.progressCardItemContent}>
                  <Text style={[styles.progressCardItemLabel, { color: theme === 'dark' ? colors.textDark : colors.textDark }]}>
                    In Progress
                  </Text>
                  <Text style={[styles.progressCardItemCount, { color: colors.textSecondary }]}>
                    {taskStats.inProgress} of {taskStats.total}
                  </Text>
                </View>
                <Text style={[styles.progressCardItemPercentage, { color: colors.accentBlue }]}>
                  {taskStats.total === 0 ? "0" : Math.round(calculatePercentage(taskStats.inProgress, taskStats.total))}%
                </Text>
              </View>
              <View style={[styles.progressCardBarBackground, { backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(0, 0, 0, 0.03)' }]}>
                <View
                  style={[styles.progressCardBarFill, { 
                    backgroundColor: colors.accentBlue,
                    width: `${calculatePercentage(taskStats.inProgress, taskStats.total)}%`
                  }]}
                />
              </View>
            </View>

            {/* Pending Tasks */}
            <View style={styles.progressCardItem}>
              <View style={styles.progressCardItemHeader}>
                <View style={styles.progressCardItemIconContainer}>
                  <Ionicons name="hourglass-outline" size={20} color={colors.accent} />
                </View>
                <View style={styles.progressCardItemContent}>
                  <Text style={[styles.progressCardItemLabel, { color: theme === 'dark' ? colors.textDark : colors.textDark }]}>
                    Pending
                  </Text>
                  <Text style={[styles.progressCardItemCount, { color: colors.textSecondary }]}>
                    {taskStats.pending} of {taskStats.total}
                  </Text>
                </View>
                <Text style={[styles.progressCardItemPercentage, { color: colors.accent }]}>
                  {taskStats.total === 0 ? "0" : Math.round(calculatePercentage(taskStats.pending, taskStats.total))}%
                </Text>
              </View>
              <View style={[styles.progressCardBarBackground, { backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(0, 0, 0, 0.03)' }]}>
                <View
                  style={[styles.progressCardBarFill, { 
                    backgroundColor: colors.accent,
                    width: `${calculatePercentage(taskStats.pending, taskStats.total)}%`
                  }]}
                />
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar 
        backgroundColor={colors.primary}
        barStyle="light-content"
      />
      
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        style={{ flex: 1 }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Floating geometric shapes */}
        <View style={{ position: 'absolute', width: '100%', height: '100%' }}>
          {/* Orange circle */}
          <View
            style={{
              position: 'absolute',
              top: height * 0.05,
              right: width * 0.1,
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: colors.accent,
              opacity: 0.2,
              transform: [{ rotate: '45deg' }],
            }}
          />
          
          {/* Blue square */}
          <View
            style={{
              position: 'absolute',
              bottom: height * 0.3,
              left: width * 0.1,
              width: 40,
              height: 40,
              borderRadius: 8,
              backgroundColor: colors.accentBlue,
              opacity: 0.3,
              transform: [{ rotate: '-30deg' }],
            }}
          />
          
          {/* Orange triangle */}
          <View
            style={{
              position: 'absolute',
              top: height * 0.7,
              right: width * 0.2,
              width: 0,
              height: 0,
              borderLeftWidth: 20,
              borderRightWidth: 20,
              borderBottomWidth: 35,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderBottomColor: colors.accent,
              opacity: 0.15,
            }}
          />
        </View>

        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.replace('/(dashboard)/employee/employee')}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('./../../../assets/images/adaptive-icon.png')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text 
                numberOfLines={1} 
                style={styles.welcomeText}
              >
                {greeting}, {user?.name}
              </Text>
              <Text style={styles.subText}>
                Last login: {lastLogin}
              </Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(dashboard)/employee/employeeSettings')}>
              <Ionicons
                name="settings-outline"
                size={24}
                color={colors.textLight}
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
              colors={[colors.accentBlue]}
              tintColor={colors.accentBlue}
            />
          }
        >
          {/* Quick Actions List */}
          <View style={styles.quickActionsList}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={styles.quickActionItem}
                onPress={action.action}
              >
                <View style={[styles.iconCircle, { backgroundColor: `${action.color}20` }]}>
                  <Ionicons name={action.icon as any} size={24} color={action.color} />
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>
                    {action.title}
                  </Text>
                  <Text style={styles.actionSubtitle}>
                    {action.subtitle}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
              </TouchableOpacity>
            ))}
          </View>

                     {/* Today's Status Card */}
           <View style={[styles.statusCard, { backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.95)' }]}>
             <View style={styles.statusCardHeader}>
               <View style={styles.statusCardTitleContainer}>
                 <Ionicons name="today-outline" size={24} color={colors.primary} />
                 <Text style={[styles.statusCardTitle, { color: theme === 'dark' ? colors.textDark : colors.textDark }]}>
                   Today's Status
                 </Text>
               </View>
               <View style={[styles.statusCardBadge, { backgroundColor: `${colors.primary}15` }]}>
                 <Text style={[styles.statusCardBadgeText, { color: colors.primary }]}>
                   {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                 </Text>
               </View>
             </View>
             
             <View style={styles.statusCardsContainer}>
               {/* Shift Status Card */}
               <View style={[styles.statusCardItem, { 
                 backgroundColor: shiftStatus === 'Active Shift' 
                   ? `${colors.primary}10` 
                   : theme === 'dark' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                 borderColor: shiftStatus === 'Active Shift' ? `${colors.primary}30` : 'transparent'
               }]}>
                 <View style={[styles.statusCardIconContainer, { 
                   backgroundColor: shiftStatus === 'Active Shift' ? colors.primary : theme === 'dark' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0, 0, 0, 0.05)'
                 }]}>
                   <Ionicons
                     name="time-outline"
                     size={20}
                     color={shiftStatus === 'Active Shift' ? colors.white : theme === 'dark' ? colors.textDark : colors.textSecondary}
                   />
                 </View>
                 <View style={styles.statusCardContent}>
                   <Text style={[styles.statusCardLabel, { color: theme === 'dark' ? colors.textSecondary : colors.textSecondary }]}>
                     Shift Status
                   </Text>
                   <Text style={[styles.statusCardValue, { color: theme === 'dark' ? colors.textDark : colors.textDark }]}>
                     {shiftStatus}
                   </Text>
                   {currentShiftDuration && (
                     <View style={styles.durationContainer}>
                       <Ionicons name="timer-outline" size={12} color={colors.accentBlue} />
                       <Text style={[styles.durationText, { color: colors.accentBlue }]}>
                         {currentShiftDuration}
                       </Text>
                     </View>
                   )}
                 </View>
                 {shiftStatus === 'Active Shift' && (
                   <View style={styles.activeIndicator}>
                     <View style={[styles.activeDot, { backgroundColor: colors.primary }]} />
                   </View>
                 )}
               </View>

               {/* Attendance Status Card */}
               <View style={[styles.statusCardItem, { 
                 backgroundColor: attendanceStatus === 'Present' 
                   ? `${colors.accentBlue}10` 
                   : theme === 'dark' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                 borderColor: attendanceStatus === 'Present' ? `${colors.accentBlue}30` : 'transparent'
               }]}>
                 <View style={[styles.statusCardIconContainer, { 
                   backgroundColor: attendanceStatus === 'Present' ? colors.accentBlue : theme === 'dark' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0, 0, 0, 0.05)'
                 }]}>
                   <Ionicons
                     name="calendar-outline"
                     size={20}
                     color={attendanceStatus === 'Present' ? colors.white : theme === 'dark' ? colors.textDark : colors.textSecondary}
                   />
                 </View>
                 <View style={styles.statusCardContent}>
                   <View style={styles.attendanceHeader}>
                     <Text style={[styles.statusCardLabel, { color: theme === 'dark' ? colors.textSecondary : colors.textSecondary }]}>
                       Attendance
                     </Text>
                     {attendanceStatus === 'Present' && (
                       <View style={[styles.liveIndicator, { backgroundColor: colors.accentBlue }]}>
                         <Ionicons name="flash-outline" size={8} color={colors.white} />
                         <Text style={styles.liveText}>LIVE</Text>
                       </View>
                     )}
                   </View>
                   <Text style={[styles.statusCardValue, { color: theme === 'dark' ? colors.textDark : colors.textDark }]}>
                     {attendanceStatus}
                   </Text>
                 </View>
                 {attendanceStatus === 'Present' && (
                   <View style={styles.activeIndicator}>
                     <View style={[styles.activeDot, { backgroundColor: colors.accentBlue }]} />
                   </View>
                 )}
               </View>
             </View>
           </View>

                        {/* My Tasks Section */}
             <View style={[styles.tasksContainer, { backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.95)' }]}>
               <View style={styles.taskHeader}>
                 <View style={styles.taskHeaderLeft}>
                   <Ionicons name="list-outline" size={20} color={colors.primary} style={styles.taskHeaderIcon} />
                   <Text style={[styles.taskHeaderTitle, { color: theme === 'dark' ? colors.textDark : colors.textDark }]}>
                     My Tasks
                   </Text>
                 </View>
                 <View style={styles.taskCount}>
                   <View style={[styles.taskCountBadge, { backgroundColor: `${colors.accentBlue}15` }]}>
                     <Text style={[styles.taskCountText, { color: colors.accentBlue }]}>
                       {tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'}
                     </Text>
                   </View>
                 </View>
               </View>

             <TaskList
               tasks={tasks}
               isDark={theme === 'dark'}
               onUpdateStatus={handleUpdateTaskStatus}
               activeTaskType={activeTaskType}
               onChangeTaskType={setActiveTaskType}
               onRefresh={handleRefresh}
               refreshing={isRefreshing}
             />
           </View>

          {/* Task Progress Bar */}
          <TaskProgressBar />
        </ScrollView>

        {/* Bottom Navigation */}
        <BottomNav items={employeeNavItems} />
      </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  logoContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
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
    fontWeight: '600',
    color: colors.textLight,
  },
  subText: {
    fontSize: 12,
    marginTop: 4,
    color: colors.textLight,
    opacity: 0.8,
  },
  content: {
    flex: 1,
  },
  quickActionsList: {
    padding: 16,
  },
  quickActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    color: colors.textLight,
    letterSpacing: 0.5,
  },
  mainContainer: {
    margin: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  statusSection: {
    padding: 16,
  },
  enhancedStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statusLabel: {
    fontSize: 12,
    marginBottom: 4,
    color: colors.textSecondary,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textDark,
  },
  statusSubValue: {
    fontSize: 12,
    marginTop: 2,
    color: colors.accentBlue,
  },
  divider: {
    height: 1,
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  tasksSection: {
    padding: 16,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  taskCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
    backgroundColor: colors.accentBlue,
  },
  taskCountText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  attendanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveIndicator: {
    backgroundColor: colors.primary,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    marginLeft: 0,
  },
  liveText: {
    color: colors.white,
    fontSize: 7,
    fontWeight: '600',
    lineHeight: 10,
  },
  // New Status Card Styles
  statusCard: {
    margin: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  statusCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  statusCardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusCardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  statusCardBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusCardBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusCardsContainer: {
    padding: 16,
    gap: 12,
  },
  statusCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  statusCardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  statusCardContent: {
    flex: 1,
  },
  statusCardLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  statusCardValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  durationText: {
    fontSize: 12,
    fontWeight: '500',
  },
  activeIndicator: {
    marginLeft: 8,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // New Tasks Container Styles
  tasksContainer: {
    margin: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  taskHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskHeaderIcon: {
    marginTop: 2,
  },
  taskHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  taskCountBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  // New Progress Card Styles
  progressCardContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    alignItems: 'center',
  },
  progressCard: {
    margin: 16,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  progressCardContent: {
    padding: 12,
  },
  progressCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressCardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressCardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  progressCardBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  progressCardBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressCardSubtitle: {
    fontSize: 12,
    marginBottom: 12,
  },
  progressCardsContainer: {
    gap: 12,
  },
  progressCardItem: {
    marginBottom: 12,
  },
  progressCardItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressCardItemIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  progressCardItemContent: {
    flex: 1,
  },
  progressCardItemLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  progressCardItemCount: {
    fontSize: 12,
  },
  progressCardItemPercentage: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressCardBarBackground: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressCardBarFill: {
    height: '100%',
    borderRadius: 2,
  },
});