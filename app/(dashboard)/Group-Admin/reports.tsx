import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ThemeContext from "../../context/ThemeContext";
import AuthContext from "../../context/AuthContext";
import axios from "axios";
import BottomNav from "../../components/BottomNav";
import { groupAdminNavItems } from "./utils/navigationItems";
import ExpenseReports from "./reports/components/ExpenseReports";
import AttendanceReports from "./reports/components/AttendanceReports";
import TaskReports from "./reports/components/TaskReports";
import TravelReports from "./reports/components/TravelReports";
import PerformanceReports from "./reports/components/PerformanceReports";
import LeaveReports from "./reports/components/LeaveReports";
import { LinearGradient } from "expo-linear-gradient";
import { getCurrentColors } from "../../utils/themeColors";

const { width, height } = Dimensions.get("window");

type ReportType =
  | "expense"
  | "attendance"
  | "task"
  | "travel"
  | "performance"
  | "leave";
type IconName = keyof typeof Ionicons.glyphMap;

interface Report {
  id: number;
  type: ReportType;
  title: string;
  date: string;
  amount: number | null;
  status: string | null;
}

interface ReportAnalytics {
  total: number;
  trend: string;
  average: number;
  lastUpdated: string;
}

interface ReportSection {
  type: ReportType;
  title: string;
  icon: IconName;
  analytics: ReportAnalytics;
  color: string;
}

export default function GroupAdminReports() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const router = useRouter();

  // Get current theme colors
  const currentColors = getCurrentColors(theme);

  // Animation refs
  const floatingShapesAnim = useRef(new Animated.Value(0)).current;
  const isDark = theme === "dark";

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | string | null>(null);
  const [selectedType, setSelectedType] = useState<ReportType>("expense");
  const [isExporting, setIsExporting] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);

  const calculateTrend = (
    currentValue: number,
    previousValue: number
  ): string => {
    if (previousValue === 0) return "0%";

    const percentageChange =
      ((currentValue - previousValue) / previousValue) * 100;
    const sign = percentageChange > 0 ? "+" : "";
    return `${sign}${Math.round(percentageChange)}%`;
  };

  const reportSections: ReportSection[] = [
    {
      type: "expense",
      title: "Expense Reports",
      icon: "wallet-outline",
      color: "#3B82F6",
      analytics: analytics
        ? {
            total: analytics.expense.total || 0,
            trend: calculateTrend(
              analytics.expense.currentMonthTotal || 0, // Current month total
              analytics.expense.previousMonthTotal || 0 // Previous month total
            ),
            average: analytics.expense.average || 0,
            lastUpdated: analytics.expense.lastUpdated,
          }
        : {
            total: 0,
            trend: "0%",
            average: 0,
            lastUpdated: new Date().toISOString(),
          },
    },
    {
      type: "attendance",
      title: "Attendance Reports",
      icon: "calendar-outline",
      color: "#8B5CF6",
      analytics: analytics
        ? {
            total: analytics.attendance.total || 0,
            trend: calculateTrend(
              analytics.attendance.currentMonthTotal || 0, // Current month total
              analytics.attendance.previousMonthTotal || 0 // Previous month total
            ),
            average: analytics.attendance.average || 0,
            lastUpdated: analytics.attendance.lastUpdated,
          }
        : {
            total: 0,
            trend: "0%",
            average: 0,
            lastUpdated: new Date().toISOString(),
          },
    },
    {
      type: "task",
      title: "Task Reports",
      icon: "checkmark-circle-outline",
      color: "#10B981",
      analytics: analytics
        ? {
            total: analytics.task?.total_tasks || 0,
            trend: calculateTrend(
              analytics.task?.currentMonthTotal || 0,
              analytics.task?.previousMonthTotal || 0
            ),
            average: Number(analytics.task?.avg_completion_time || 0),
            lastUpdated:
              analytics.task?.lastUpdated || new Date().toISOString(),
          }
        : {
            total: 0,
            trend: "0%",
            average: 0,
            lastUpdated: new Date().toISOString(),
          },
    },
    {
      type: "travel",
      title: "Travel Reports",
      icon: "car-outline",
      color: "#F59E0B",
      analytics: analytics
        ? {
            total: analytics.travel?.total || 0,
            trend: calculateTrend(
              analytics.travel?.currentMonthTotal || 0,
              analytics.travel?.previousMonthTotal || 0
            ),
            average: Number(analytics.travel?.average || 0),
            lastUpdated:
              analytics.travel?.lastUpdated || new Date().toISOString(),
          }
        : {
            total: 0,
            trend: "0%",
            average: 0,
            lastUpdated: new Date().toISOString(),
          },
    },
    {
      type: "performance",
      title: "Performance Reports",
      icon: "trending-up-outline",
      color: "#EC4899",
      analytics: analytics
        ? {
            total: Number(analytics.performance?.total || 0),
            trend: analytics.performance?.trend || "0%",
            average: Number(analytics.performance?.average || 0),
            lastUpdated:
              analytics.performance?.lastUpdated || new Date().toISOString(),
          }
        : {
            total: 0,
            trend: "0%",
            average: 0,
            lastUpdated: new Date().toISOString(),
          },
    },
    {
      type: "leave",
      title: "Leave Reports",
      icon: "time-outline",
      color: "#6366F1",
      analytics: analytics
        ? {
            total: Number(analytics.leave?.total || 0),
            trend: analytics.leave?.trend || "0%",
            average: Number(analytics.leave?.average || 0),
            lastUpdated:
              analytics.leave?.lastUpdated || new Date().toISOString(),
          }
        : {
            total: 0,
            trend: "0%",
            average: 0,
            lastUpdated: new Date().toISOString(),
          },
    },
  ];

  useEffect(() => {
    fetchReports();
    fetchAnalytics();

    // Floating shapes animation
    Animated.loop(
      Animated.timing(floatingShapesAnim, {
        toValue: 1,
        duration: 12000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null); // Clear any previous errors
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/reports`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setReports(response.data);
    } catch (error: any) {
      console.error("Error fetching reports:", error);
      setError(error.response?.data?.message || "Failed to fetch reports");
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/reports/analytics`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setAnalytics(response.data);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    }
  };

  const getIconName = (type: ReportType): IconName => {
    switch (type) {
      case "expense":
        return "receipt-outline";
      case "attendance":
        return "calendar-outline";
      case "task":
        return "bar-chart-outline";
      case "travel":
        return "car-outline";
      case "performance":
        return "trending-up-outline";
      case "leave":
        return "time-outline";
      default:
        return "document-text-outline";
    }
  };

  // Safe amount formatting function
  const formatAmount = (amount: number | null | undefined): string => {
    // If amount is null or undefined, return default
    if (amount == null) return "0.00";

    // Convert string to number if needed
    const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;

    // Check if it's a valid number
    if (isNaN(numAmount)) {
      console.warn("Invalid amount received:", amount);
      return "0.00";
    }

    try {
      return numAmount.toFixed(2);
    } catch (error) {
      console.error("Error formatting amount:", error, "Amount:", amount);
      return "0.00";
    }
  };

  const handleExportPDF = async (type: ReportType) => {
    try {
      setIsExporting(true);
      // Implementation for PDF export
      await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulated delay
      Alert.alert("Success", `${type} report exported successfully`);
    } catch (error) {
      Alert.alert("Error", "Failed to export report");
    } finally {
      setIsExporting(false);
    }
  };

  const renderReportSection = (section: ReportSection) => {
    switch (section.type) {
      case "expense":
        return <ExpenseReports section={section} isDark={isDark} />;
      case "attendance":
        return <AttendanceReports section={section} isDark={isDark} />;
      case "task":
        return <TaskReports section={section} isDark={isDark} />;
      case "travel":
        return <TravelReports section={section} isDark={isDark} />;
      case "performance":
        return <PerformanceReports section={section} isDark={isDark} />;
      case "leave":
        return <LeaveReports section={section} isDark={isDark} />;
      default:
        return null;
    }
  };

  if (error) {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <Text style={{ color: "red" }}>
          Error: {error instanceof Error ? error.message : error}
        </Text>
      </View>
    );
  }

  const floatingOffset = floatingShapesAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 20],
  });

  try {
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
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 5,
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => router.back()}
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
                name="arrow-back"
                size={20}
                color={currentColors.primary}
              />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text
                style={[
                  styles.headerTitle,
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
                Reports
              </Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={styles.content}>
            {/* Report Type Selector */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScrollView}
              contentContainerStyle={styles.chipContainer}
            >
              {reportSections.map((section) => (
                <TouchableOpacity
                  key={section.type}
                  onPress={() => setSelectedType(section.type)}
                  style={[
                    styles.chipButton,
                    {
                      backgroundColor:
                        selectedType === section.type
                          ? currentColors.primary
                          : currentColors.surface,
                      borderWidth: 1,
                      borderColor:
                        selectedType === section.type
                          ? currentColors.primary
                          : currentColors.border,
                      shadowColor: currentColors.primary,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 4,
                      elevation: 3,
                    },
                  ]}
                >
                  <Ionicons
                    name={section.icon}
                    size={18}
                    color={
                      selectedType === section.type ? "#FFFFFF" : section.color
                    }
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={{
                      color:
                        selectedType === section.type
                          ? "#FFFFFF"
                          : currentColors.text,
                      fontSize: 14,
                      fontWeight: "500",
                    }}
                  >
                    {section.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Report Sections */}
            <View style={styles.reportContent}>
              {reportSections.map((section) =>
                selectedType === section.type ? (
                  <View key={section.type}>{renderReportSection(section)}</View>
                ) : null
              )}
            </View>
          </ScrollView>

          <BottomNav items={groupAdminNavItems} />
        </SafeAreaView>
      </>
    );
  } catch (err) {
    console.error("Error in Reports render:", err);
    setError(err instanceof Error ? err : new Error("Unknown error"));
    return null;
  }
}

const styles = StyleSheet.create({
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
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  chipScrollView: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chipContainer: {
    paddingRight: 16,
  },
  chipButton: {
    marginRight: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  reportContent: {
    padding: 16,
  },
  reportCard: {
    marginBottom: 12,
  },
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});
