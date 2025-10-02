import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Animated,
  Image,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ThemeContext from "../../context/ThemeContext";
import BottomNav from "../../components/BottomNav";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { NavItem } from "../../types/nav";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import AuthContext from "../../context/AuthContext";
import { groupAdminNavItems } from "./utils/navigationItems";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { getCurrentColors } from "../../utils/themeColors";
import {
  differenceInSeconds,
  differenceInHours,
  differenceInMinutes,
  format,
} from "date-fns";

const { width, height } = Dimensions.get("window");

// Add new interface for activities
interface RecentActivity {
  type: string;
  name: string;
  time: string;
}

export default function GroupAdminDashboard() {
  // Add state for activities
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [isShiftActive, setIsShiftActive] = useState(false);
  const [shiftStartTime, setShiftStartTime] = useState<string | null>(null);
  const [currentShiftDuration, setCurrentShiftDuration] = useState<
    string | null
  >(null);
  const [greeting, setGreeting] = useState("");
  const [lastLogin, setLastLogin] = useState("");

  const { theme } = ThemeContext.useTheme();
  const { token, user } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === "dark";

  // Get current theme colors
  const currentColors = getCurrentColors(theme);

  // Animation refs
  const floatingShapesAnim = useRef(new Animated.Value(0)).current;

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

  // Add useEffect to fetch activities
  useEffect(() => {
    fetchRecentActivities();
  }, []);

  // Add shift status check
  useEffect(() => {
    checkShiftStatus();
    const interval = setInterval(checkShiftStatus, 1000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchRecentActivities = async () => {
    try {
      setLoadingActivities(true);
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin/recent-activities`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setActivities(response.data);
    } catch (error) {
      console.error("Error fetching recent activities:", error);
    } finally {
      setLoadingActivities(false);
    }
  };

  const checkShiftStatus = async () => {
    try {
      const status = await AsyncStorage.getItem(`${user?.role}-shiftStatus`);
      if (status) {
        const { isActive, startTime } = JSON.parse(status);
        setIsShiftActive(isActive);
        setShiftStartTime(startTime);
      }
    } catch (error) {
      console.error("Error checking shift status:", error);
    }
  };

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;

    const updateShiftStatus = async () => {
      try {
        const shiftStatusData = await AsyncStorage.getItem(
          `${user?.role}-shiftStatus`,
        );

        if (shiftStatusData) {
          const { isActive, startTime } = JSON.parse(shiftStatusData);
          setIsShiftActive(isActive);
          setShiftStartTime(startTime);

          if (isActive && startTime) {
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
            setCurrentShiftDuration(null);
          }
        } else {
          setIsShiftActive(false);
          setShiftStartTime(null);
          setCurrentShiftDuration(null);
        }
      } catch (error) {
        console.error("Error updating shift status:", error);
      }
    };

    // Initial update
    updateShiftStatus();

    // Set up interval for real-time updates
    intervalId = setInterval(updateShiftStatus, 1000) as ReturnType<typeof setInterval>;

    return () => {
      clearInterval(intervalId);
    };
  }, [user?.role]);

  // Quick action cards data
  const quickActions = [
    {
      title: "Employee Management",
      icon: "people-outline",
      color: "#3B82F6",
      route: "/(dashboard)/Group-Admin/employee-management",
      description: "Manage your employees",
    },
    {
      title: "Expense Management",
      icon: "receipt-outline",
      color: "#10B981",
      route: "/(dashboard)/Group-Admin/expense-management",
      description: "Manage employee expenses",
    },
    {
      title: "Task Management",
      icon: "list-outline",
      color: "#8B5CF6",
      route: "/(dashboard)/Group-Admin/task-management",
      description: "Manage employee tasks",
    },
    {
      title: "Attendance Management",
      icon: "calendar-outline",
      color: "#F59E0B", // Amber color
      route: "/(dashboard)/Group-Admin/attendance-management",
      description: "Track employee attendance",
    },
    {
      title: "Live Tracking",
      icon: "location-outline",
      color: "#EF4444", // Red color
      route: "/(dashboard)/Group-Admin/tracking",
      description: "Real-time employee location",
    },
    {
      title: "View Reports",
      icon: "bar-chart-outline",
      color: "#6366F1", // Changed to Indigo color
      route: "/(dashboard)/Group-Admin/reports",
      description: "Access employee reports",
    },
  ];

  // Add new section for Leave Management
  const leaveManagementActions = [
    {
      title: "Leave Management",
      icon: "calendar-outline",
      color: "#EC4899", // Pink color for distinction
      route: "/(dashboard)/Group-Admin/leave-management",
      description: "Manage employee leave requests",
    },
    {
      title: "Leave Insights",
      icon: "time-outline",
      color: "#6366F1", // Indigo color
      route: "/(dashboard)/Group-Admin/leave-insights",
      description: "View leave balance and request for leaves",
    },
  ];

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
            onPress={() =>
              router.replace("/(dashboard)/Group-Admin/group-admin")
            }
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
            onPress={() => router.push("/(dashboard)/Group-Admin/settings")}
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
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Shift Status Button */}
          <View style={styles.shiftStatusContainer}>
            <TouchableOpacity
              onPress={() => router.push("/(dashboard)/shared/shiftTracker")}
              style={[
                styles.shiftStatusButton,
                {
                  backgroundColor: isShiftActive
                    ? currentColors.error
                    : currentColors.success,
                  shadowColor: currentColors.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                  elevation: 5,
                },
              ]}
            >
              <View style={styles.shiftButtonContent}>
                <View style={styles.shiftButtonLeft}>
                  <View
                    style={[
                      styles.iconContainer,
                      {
                        backgroundColor: isShiftActive
                          ? "rgba(255, 255, 255, 0.2)"
                          : "rgba(255, 255, 255, 0.2)",
                      },
                    ]}
                  >
                    <Ionicons
                      name={isShiftActive ? "timer" : "timer-outline"}
                      size={20}
                      color="white"
                    />
                  </View>
                  <View style={styles.textContainer}>
                    <Text style={styles.statusText}>
                      {isShiftActive ? "Active Shift" : "Start Shift"}
                    </Text>
                    {isShiftActive && currentShiftDuration && (
                      <Text style={styles.timeText}>
                        Duration: {currentShiftDuration}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.chevronContainer}>
                  <Ionicons name="chevron-forward" size={20} color="white" />
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Quick Actions Grid */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: currentColors.text }]}>
              Quick Actions
            </Text>
            <View style={styles.quickActionsGrid}>
              {quickActions.map((action, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.quickActionCard,
                    {
                      backgroundColor: currentColors.surface,
                      borderWidth: 1,
                      borderColor: currentColors.border,
                      shadowColor: currentColors.primary,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 4,
                      elevation: 3,
                    },
                  ]}
                  onPress={() => router.push(action.route as any)}
                >
                  <View
                    style={[
                      styles.iconCircle,
                      {
                        backgroundColor:
                          theme === "dark"
                            ? `${action.color}30`
                            : `${action.color}20`,
                        borderWidth: 1,
                        borderColor:
                          theme === "dark"
                            ? `${action.color}50`
                            : `${action.color}30`,
                      },
                    ]}
                  >
                    <Ionicons
                      name={action.icon as keyof typeof Ionicons.glyphMap}
                      size={24}
                      color={action.color}
                    />
                  </View>
                  <Text
                    style={[styles.cardTitle, { color: currentColors.text }]}
                  >
                    {action.title}
                  </Text>
                  <Text
                    style={[
                      styles.cardDescription,
                      { color: currentColors.textSecondary },
                    ]}
                  >
                    {action.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Leave Management Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: currentColors.text }]}>
              Leave Management
            </Text>
            <View style={styles.quickActionsGrid}>
              {leaveManagementActions.map((action, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.quickActionCard,
                    {
                      backgroundColor: currentColors.surface,
                      borderWidth: 1,
                      borderColor: currentColors.border,
                      shadowColor: currentColors.primary,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 4,
                      elevation: 3,
                    },
                  ]}
                  onPress={() => router.push(action.route as any)}
                >
                  <View
                    style={[
                      styles.iconCircle,
                      {
                        backgroundColor:
                          theme === "dark"
                            ? `${action.color}30`
                            : `${action.color}20`,
                        borderWidth: 1,
                        borderColor:
                          theme === "dark"
                            ? `${action.color}50`
                            : `${action.color}30`,
                      },
                    ]}
                  >
                    <Ionicons
                      name={action.icon as keyof typeof Ionicons.glyphMap}
                      size={24}
                      color={action.color}
                    />
                  </View>
                  <Text
                    style={[styles.cardTitle, { color: currentColors.text }]}
                  >
                    {action.title}
                  </Text>
                  <Text
                    style={[
                      styles.cardDescription,
                      { color: currentColors.textSecondary },
                    ]}
                  >
                    {action.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Recent Activity Section */}
          <View
            style={[
              styles.activityCard,
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
            {/* Header */}
            <View style={styles.activityHeader}>
              <View style={styles.activityHeaderLeft}>
                <View
                  style={[
                    styles.activityIconContainer,
                    {
                      backgroundColor:
                        theme === "dark"
                          ? "rgba(59, 130, 246, 0.2)"
                          : "rgba(59, 130, 246, 0.1)",
                    },
                  ]}
                >
                  <Ionicons
                    name="time-outline"
                    size={20}
                    color={currentColors.primary}
                  />
                </View>
                <Text
                  style={[styles.activityTitle, { color: currentColors.text }]}
                >
                  Recent Activity
                </Text>
              </View>
            </View>

            {loadingActivities ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={currentColors.primary} />
              </View>
            ) : activities.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="notifications-outline"
                  size={40}
                  color={currentColors.textTertiary}
                />
                <Text
                  style={[
                    styles.emptyText,
                    { color: currentColors.textSecondary },
                  ]}
                >
                  No recent activities
                </Text>
              </View>
            ) : (
              activities.map((activity, index) => {
                // Determine icon based on activity type
                let icon: keyof typeof Ionicons.glyphMap = "ellipse-outline";
                let iconColor = currentColors.primary;

                if (activity.type.includes("Employee")) {
                  icon = "person-add-outline";
                  iconColor = currentColors.success;
                } else if (activity.type.includes("Task")) {
                  icon = "list-outline";
                  iconColor = "#8B5CF6";
                } else if (activity.type.includes("Expense")) {
                  icon = "receipt-outline";
                  iconColor = activity.type.includes("Approved")
                    ? currentColors.success
                    : currentColors.error;
                }

                return (
                  <View
                    key={index}
                    style={[
                      styles.activityItem,
                      {
                        borderBottomWidth:
                          index !== activities.length - 1 ? 1 : 0,
                        borderBottomColor: currentColors.border,
                      },
                    ]}
                  >
                    <View style={styles.activityItemContent}>
                      <View
                        style={[
                          styles.activityItemIcon,
                          {
                            backgroundColor:
                              theme === "dark"
                                ? "rgba(59, 130, 246, 0.2)"
                                : "rgba(59, 130, 246, 0.1)",
                          },
                        ]}
                      >
                        <Ionicons name={icon} size={16} color={iconColor} />
                      </View>
                      <View style={styles.activityItemText}>
                        <View style={styles.activityItemHeader}>
                          <View style={styles.activityItemLeft}>
                            <Text
                              style={[
                                styles.activityType,
                                { color: currentColors.textSecondary },
                              ]}
                            >
                              {activity.type}
                            </Text>
                            <Text
                              style={[
                                styles.activityName,
                                { color: currentColors.text },
                              ]}
                            >
                              {activity.name}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.activityTime,
                              { color: currentColors.textTertiary },
                            ]}
                          >
                            {activity.time}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>

        <BottomNav items={groupAdminNavItems} />
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
    borderBottomColor: "transparent",
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
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    marginLeft: 6,
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  quickActionCard: {
    width: "48%",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  activityCard: {
    margin: 16,
    borderRadius: 16,
    padding: 16,
    marginBottom: 32,
  },
  activityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  activityHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  activityIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  activityTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyText: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 14,
  },
  activityItem: {
    paddingVertical: 12,
  },
  activityItemContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  activityItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  activityItemText: {
    flex: 1,
  },
  activityItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  activityItemLeft: {
    flex: 1,
  },
  activityType: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 2,
  },
  activityName: {
    fontSize: 14,
    fontWeight: "600",
  },
  activityTime: {
    fontSize: 11,
  },
  shiftStatusContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  shiftStatusButton: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  shiftButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  shiftButtonLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  statusText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  timeText: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 12,
    fontWeight: "500",
  },
  chevronContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    padding: 4,
    marginLeft: 12,
  },
});
