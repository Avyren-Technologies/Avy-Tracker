import React, { useState, useEffect, useRef, memo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Modal,
  FlatList,
  Keyboard,
  StyleSheet,
  Animated,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import axios from "axios";
import * as DocumentPicker from "expo-document-picker";
import TaskDetailsModal from "../../components/TaskDetailsModal";
import ThemeContext from "../../context/ThemeContext";
import AuthContext from "../../context/AuthContext";
import TaskCard from "./components/TaskCard";
import { format } from "date-fns";
import BottomNav from "../../components/BottomNav";
import { groupAdminNavItems } from "./utils/navigationItems";

interface Employee {
  id: number;
  name: string;
  email: string;
  employee_number: string;
}

interface Task {
  id: number;
  title: string;
  description: string;
  assignedTo?: number;
  assigned_to?: number;
  priority: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "completed";
  createdAt: string;
  due_date: string | null;
  employee_name: string;
  employee_number: string;
  assigned_by_name: string;
  status_history: StatusHistory[];
  is_reassigned?: boolean;
}

interface StatusHistory {
  status: string;
  updatedAt: string;
  updatedBy: number;
  updatedByName?: string;
}

interface NewTask {
  title: string;
  description: string;
  assignedTo: number;
  priority: "low" | "medium" | "high";
  due_date?: string | null;
}

interface EmployeePickerModalProps {
  show: boolean;
  onClose: () => void;
  employeeSearch: string;
  setEmployeeSearch: (text: string) => void;
  filteredEmployees: Employee[];
  isDark: boolean;
  onSelectEmployee: (id: number) => void;
  selectedEmployeeId: number;
}

const EmployeePickerModal = memo(
  ({
    show,
    onClose,
    employeeSearch,
    setEmployeeSearch,
    filteredEmployees,
    isDark,
    onSelectEmployee,
    selectedEmployeeId,
  }: EmployeePickerModalProps) => {
    const employeeInputRef = useRef<TextInput>(null);

    useEffect(() => {
      if (show && Platform.OS === "android") {
        setTimeout(() => {
          employeeInputRef.current?.focus();
        }, 300);
      }
    }, [show]);

    return (
      <Modal
        visible={show}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
          activeOpacity={1}
          onPress={() => {
            Keyboard.dismiss();
            onClose();
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={{
              maxHeight: "80%",
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              padding: 20,
              backgroundColor: isDark ? "#1F2937" : "#fff",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "bold",
                  color: isDark ? "#fff" : "#000",
                }}
              >
                Select Employee
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons
                  name="close"
                  size={24}
                  color={isDark ? "#fff" : "#000"}
                />
              </TouchableOpacity>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 10,
                marginBottom: 20,
                borderRadius: 8,
                backgroundColor: isDark ? "#374151" : "#f3f4f6",
              }}
            >
              <Ionicons
                name="search"
                size={20}
                color={isDark ? "#9CA3AF" : "#6B7280"}
                style={{ marginRight: 8 }}
              />
              <TextInput
                ref={employeeInputRef}
                value={employeeSearch}
                onChangeText={setEmployeeSearch}
                placeholder="Search by name or employee number..."
                placeholderTextColor={isDark ? "#9CA3AF" : "#6B7280"}
                style={{ flex: 1, color: isDark ? "#fff" : "#000" }}
                autoFocus={false}
              />
              {employeeSearch.length > 0 && (
                <TouchableOpacity onPress={() => setEmployeeSearch("")}>
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={isDark ? "#9CA3AF" : "#6B7280"}
                  />
                </TouchableOpacity>
              )}
            </View>
            {filteredEmployees.length === 0 ? (
              <View style={{ paddingVertical: 40, alignItems: "center" }}>
                <Ionicons
                  name="people"
                  size={48}
                  color={isDark ? "#4B5563" : "#9CA3AF"}
                />
                <Text
                  style={{
                    marginTop: 16,
                    textAlign: "center",
                    color: isDark ? "#9CA3AF" : "#6B7280",
                  }}
                >
                  No employees found
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredEmployees}
                keyboardShouldPersistTaps="always"
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={{
                      padding: 16,
                      marginBottom: 10,
                      borderRadius: 8,
                      backgroundColor:
                        selectedEmployeeId === item.id
                          ? isDark
                            ? "#2563eb"
                            : "#bfdbfe"
                          : isDark
                            ? "#374151"
                            : "#f3f4f6",
                    }}
                    onPress={() => {
                      Keyboard.dismiss();
                      onSelectEmployee(item.id);
                      onClose();
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: "500",
                        color: isDark ? "#fff" : "#000",
                      }}
                    >
                      {item.id === 0 ? "👥 All Employees" : item.name}
                    </Text>
                    {item.id !== 0 && (
                      <Text style={{ color: isDark ? "#9CA3AF" : "#6B7280" }}>
                        {item.employee_number}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{ paddingBottom: 20 }}
              />
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  },
);

export default function TaskManagement() {
  const { theme } = ThemeContext.useTheme();
  const { token } = AuthContext.useAuth();
  const router = useRouter();
  const isDark = theme === "dark";
  const successScale = useRef(new Animated.Value(0)).current;
  const [showSuccess, setShowSuccess] = useState(false);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newTask, setNewTask] = useState<Omit<Task, "id">>({
    title: "",
    description: "",
    assignedTo: 0,
    priority: "medium",
    status: "pending",
    employee_name: "",
    employee_number: "",
    createdAt: format(new Date(), "yyyy-MM-dd"),
    assigned_by_name: "",
    status_history: [],
    due_date: null,
    is_reassigned: false,
  });

  // New state for enhanced task creation
  const [customerDetails, setCustomerDetails] = useState({
    name: "",
    contact: "",
    notes: "",
    sendUpdates: false,
  });
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [reassignedFilter, setReassignedFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [showEmployeePicker, setShowEmployeePicker] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showFilterEmployeePicker, setShowFilterEmployeePicker] =
    useState(false);
  const [filterEmployeeSearch, setFilterEmployeeSearch] = useState("");
  
  // Task details modal state
  const [showTaskDetails, setShowTaskDetails] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  const fetchEmployees = async () => {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin/employees`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      console.log("Employees response:", response.data);
      setEmployees(response.data);
    } catch (error) {
      console.error("Error fetching employees:", error);
      if (axios.isAxiosError(error)) {
        console.error("Response data:", error.response?.data);
        console.error("Status code:", error.response?.status);
      }
      Alert.alert("Error", "Failed to fetch employees");
    }
  };

  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL}/api/tasks/admin`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      console.log("Tasks response:", response.data);

      // Add debugging to check task structure
      if (response.data && response.data.length > 0) {
        console.log("Sample task structure:", {
          id: response.data[0].id,
          title: response.data[0].title,
          assignedTo:
            response.data[0].assigned_to || response.data[0].assignedTo,
          employee_name: response.data[0].employee_name,
          employee_number: response.data[0].employee_number,
        });
      }

      // Normalize task data to ensure consistent property names
      const normalizedTasks = response.data.map((task: any) => ({
        ...task,
        // Ensure both property names exist for compatibility
        assignedTo: task.assignedTo || task.assigned_to,
        assigned_to: task.assigned_to || task.assignedTo,
      }));

      setTasks(normalizedTasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      if (axios.isAxiosError(error)) {
        console.error("Response data:", error.response?.data);
        console.error("Status code:", error.response?.status);
      }
      Alert.alert("Error", "Failed to fetch tasks");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchTasks();
  }, []);

  // Debug employee filter changes
  useEffect(() => {
    console.log("Employee filter changed:", {
      employeeFilter,
      selectedEmployee: employees.find(
        (e) => e.id.toString() === employeeFilter,
      ),
    });
  }, [employeeFilter, employees]);

  // Auto-disable customer updates when phone number is entered
  useEffect(() => {
    if (customerDetails.contact.length > 0 && !customerDetails.contact.includes('@') && customerDetails.sendUpdates) {
      setCustomerDetails((prev) => ({ ...prev, sendUpdates: false }));
    }
  }, [customerDetails.contact]);

  const showSuccessAnimation = () => {
    setShowSuccess(true);
    Animated.sequence([
      Animated.spring(successScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 15,
        stiffness: 200,
      }),
    ]).start();

    // Auto hide after 2 seconds
    setTimeout(() => {
      setShowSuccess(false);
      successScale.setValue(0);
    }, 2000);
  };

  const createTask = async () => {
    try {
      setIsLoading(true);
      const taskData = {
        title: newTask.title,
        description: newTask.description,
        assignedTo: newTask.assignedTo,
        priority: newTask.priority,
        dueDate: newTask.due_date,
        customerName: customerDetails.name,
        customerContact: customerDetails.contact,
        customerNotes: customerDetails.notes,
        sendCustomerUpdates: customerDetails.sendUpdates,
        attachments: attachments,
      };

      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/tasks`,
        taskData,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL}/api/group-admin-notifications/notify-task-assignment`,
        {
          employeeId: taskData.assignedTo,
          taskDetails: {
            title: taskData.title,
            description: taskData.description,
            priority: taskData.priority,
            dueDate: taskData.dueDate,
            taskId: response.data.id,
          },
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      showSuccessAnimation();
      fetchTasks();
      
      // Reset form
      setNewTask({
        title: "",
        description: "",
        assignedTo: 0,
        priority: "medium",
        status: "pending",
        employee_name: "",
        employee_number: "",
        createdAt: format(new Date(), "yyyy-MM-dd"),
        assigned_by_name: "",
        status_history: [],
        due_date: null,
        is_reassigned: false,
      });
      
      setCustomerDetails({
        name: "",
        contact: "",
        notes: "",
        sendUpdates: false,
      });
      setAttachments([]);
    } catch (error) {
      console.error("Error creating task:", error);
      
      // Extract specific error message from backend
      let errorMessage = "Failed to create task";
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      Alert.alert("Error", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const updateTask = async (taskId: number, updates: any) => {
    try {
      const currentTask = tasks.find((task) => task.id === taskId);
      const isReassignment =
        currentTask && currentTask.assignedTo !== updates.assignedTo;

      const response = await axios.patch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/tasks/${taskId}`,
        { ...updates, isReassignment },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === taskId
            ? { ...response.data, is_reassigned: response.data.is_reassigned }
            : task,
        ),
      );

      Alert.alert("Success", "Task updated successfully");
      return response.data;
    } catch (error) {
      console.error("Error updating task:", error);
      Alert.alert("Error", "Failed to update task");
      throw error;
    }
  };

  const handleTaskClick = (taskId: number) => {
    setSelectedTaskId(taskId);
    setShowTaskDetails(true);
  };

  const handleCloseTaskDetails = () => {
    setShowTaskDetails(false);
    setSelectedTaskId(null);
  };

  const handleTaskUpdate = () => {
    fetchTasks(); // Refresh tasks when details are updated
  };

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority =
      priorityFilter === "all" || task.priority === priorityFilter;
    const matchesStatus =
      statusFilter === "all" || task.status === statusFilter;

    // Get the assigned employee ID from either assignedTo or assigned_to property
    const taskAssignedTo =
      task.assignedTo !== undefined ? task.assignedTo : task.assigned_to;

    // Fix employee filtering - ensure we're comparing numbers with numbers
    const matchesEmployee =
      employeeFilter === "all" ||
      (taskAssignedTo !== undefined &&
        taskAssignedTo === parseInt(employeeFilter));

    // Debug employee filtering
    if (employeeFilter !== "all") {
      if (matchesEmployee) {
        console.log("Task matching employee filter:", {
          taskId: task.id,
          taskAssignedTo,
          employeeFilter,
          parsedEmployeeFilter: parseInt(employeeFilter),
        });
      } else {
        console.log("Task not matching employee filter:", {
          taskId: task.id,
          taskAssignedTo,
          employeeFilter,
          parsedEmployeeFilter: parseInt(employeeFilter),
        });
      }
    }

    const matchesReassigned =
      reassignedFilter === "all" ||
      (reassignedFilter === "reassigned" && task.is_reassigned) ||
      (reassignedFilter === "not_reassigned" && !task.is_reassigned);

    let matchesDate = true;
    if (dateFilter) {
      try {
        const selectedDate = format(dateFilter, "yyyy-MM-dd");
        const taskDate = format(new Date(task.createdAt), "yyyy-MM-dd");
        matchesDate = selectedDate === taskDate;
      } catch (error) {
        console.error("Date comparison error:", error);
        matchesDate = false;
      }
    }
    return (
      matchesSearch &&
      matchesPriority &&
      matchesStatus &&
      matchesEmployee &&
      matchesReassigned &&
      matchesDate
    );
  });

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === "ios");
    if (selectedDate) {
      try {
        const newDate = new Date(selectedDate);
        if (!isNaN(newDate.getTime())) {
          setDateFilter(newDate);
        }
      } catch (error) {
        console.error("Invalid date selection:", error);
      }
    }
  };

  const handleDueDateChange = (event: any, selectedDate?: Date) => {
    setShowDueDatePicker(Platform.OS === "ios");
    if (selectedDate) {
      setNewTask((prev) => ({
        ...prev,
        due_date: selectedDate.toISOString(),
      }));
    }
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchTasks(), fetchEmployees()]);
    } catch (error) {
      console.error("Error refreshing:", error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // File picker function
  const pickDocument = async () => {
    try {
      setIsUploading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        
        // Convert file to base64
        const response = await fetch(file.uri);
        const blob = await response.blob();
        const reader = new FileReader();
        
        reader.onload = () => {
          const base64 = reader.result as string;
          const base64Data = base64.split(',')[1]; // Remove data:type;base64, prefix
          
          const newAttachment = {
            fileName: file.name,
            fileType: file.mimeType || 'application/octet-stream',
            fileSize: file.size || 0,
            fileData: base64Data,
          };
          
          setAttachments(prev => [...prev, newAttachment]);
        };
        
        reader.readAsDataURL(blob);
      }
    } catch (error) {
      console.error("Error picking document:", error);
      Alert.alert("Error", "Failed to pick document");
    } finally {
      setIsUploading(false);
    }
  };

  // Remove attachment
  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const filteredEmployees = employees.filter(
    (employee) =>
      employee.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      employee.employee_number
        .toLowerCase()
        .includes(employeeSearch.toLowerCase()),
  );

  const filteredFilterEmployees = [
    { id: 0, name: "All Employees", email: "", employee_number: "" },
    ...employees.filter(
      (employee) =>
        employee.name
          .toLowerCase()
          .includes(filterEmployeeSearch.toLowerCase()) ||
        employee.employee_number
          .toLowerCase()
          .includes(filterEmployeeSearch.toLowerCase()),
    ),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? "#111827" : "#F3F4F6" }}>
      <StatusBar
        backgroundColor={isDark ? "#111827" : "#F3F4F6"}
        barStyle={isDark ? "light-content" : "dark-content"}
      />

      <View style={[styles.header]}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 16,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            className={`p-2 ml-2 mt-2 rounded-full ${isDark ? "bg-gray-700" : "bg-gray-200"}`}
            style={{
              width: 40,
              height: 40,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={isDark ? "#FFFFFF" : "#111827"}
            />
          </TouchableOpacity>
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: 20,
                fontWeight: "bold",
                color: isDark ? "#fff" : "#000",
              }}
            >
              Task Management
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
        <View
          style={[
            styles.searchBar,
            {
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              borderRadius: 8,
              backgroundColor: isDark ? "#374151" : "#fff",
            },
          ]}
        >
          <Ionicons
            name="search"
            size={20}
            color={isDark ? "#9CA3AF" : "#6B7280"}
          />
          <TextInput
            placeholder="Search tasks..."
            placeholderTextColor={isDark ? "#9CA3AF" : "#6B7280"}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{
              flex: 1,
              marginLeft: 8,
              paddingVertical: 12,
              color: isDark ? "#fff" : "#000",
            }}
          />
          <TouchableOpacity
            onPress={() => setShowFilters(!showFilters)}
            style={{
              padding: 8,
              borderRadius: 8,
              backgroundColor: isDark ? "#374151" : "#f3f4f6",
            }}
          >
            <Ionicons
              name={showFilters ? "options" : "options-outline"}
              size={20}
              color={isDark ? "#60A5FA" : "#3B82F6"}
            />
          </TouchableOpacity>
        </View>

        {showFilters && (
          <View
            style={[
              styles.filterCard,
              {
                padding: 16,
                borderRadius: 12,
                backgroundColor: isDark ? "#1F2937" : "#fff",
              },
            ]}
          >
            <View style={{ marginBottom: 16 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "500",
                  marginBottom: 8,
                  color: isDark ? "#9CA3AF" : "#374151",
                }}
              >
                Created Date
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <TouchableOpacity
                  onPress={() => setDateFilter(null)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 8,
                    marginRight: 8,
                    backgroundColor: !dateFilter
                      ? isDark
                        ? "#2563eb"
                        : "#2563eb"
                      : isDark
                        ? "#374151"
                        : "#f3f4f6",
                  }}
                >
                  <Text
                    style={{
                      color: !dateFilter
                        ? "#fff"
                        : isDark
                          ? "#9CA3AF"
                          : "#374151",
                    }}
                  >
                    All Dates
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: isDark ? "#374151" : "#f3f4f6",
                  }}
                >
                  <Text style={{ color: isDark ? "#9CA3AF" : "#374151" }}>
                    {dateFilter && !isNaN(dateFilter.getTime())
                      ? format(dateFilter, "MMM dd, yyyy")
                      : "Select Date"}
                  </Text>
                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color={isDark ? "#9CA3AF" : "#6B7280"}
                  />
                </TouchableOpacity>
              </View>
              {showDatePicker && (
                <DateTimePicker
                  value={dateFilter || new Date()}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={handleDateChange}
                  textColor={isDark ? "#fff" : "#000"}
                  style={{ backgroundColor: isDark ? "#374151" : "#fff" }}
                />
              )}
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "500",
                  marginBottom: 8,
                  color: isDark ? "#9CA3AF" : "#374151",
                }}
              >
                Employee
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowFilterEmployeePicker(true);
                  setFilterEmployeeSearch("");
                  Keyboard.dismiss();
                }}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  backgroundColor: isDark ? "#374151" : "#f3f4f6",
                  borderWidth: 1,
                  borderColor: isDark ? "#374151" : "#E5E7EB",
                }}
              >
                <Text style={{ color: isDark ? "#fff" : "#000" }}>
                  {employeeFilter === "all"
                    ? "👥 All Employees"
                    : `👤 ${employees.find((e) => e.id.toString() === employeeFilter)?.name || ""} (${employees.find((e) => e.id.toString() === employeeFilter)?.employee_number || ""})`}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={20}
                  color={isDark ? "#9CA3AF" : "#6B7280"}
                />
              </TouchableOpacity>
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "500",
                  marginBottom: 8,
                  color: isDark ? "#9CA3AF" : "#374151",
                }}
              >
                Priority
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[
                  { value: "all", icon: "filter-outline", label: "All" },
                  {
                    value: "high",
                    icon: "alert-circle-outline",
                    label: "High",
                  },
                  {
                    value: "medium",
                    icon: "remove-circle-outline",
                    label: "Medium",
                  },
                  {
                    value: "low",
                    icon: "checkmark-circle-outline",
                    label: "Low",
                  },
                ].map(({ value, icon, label }) => (
                  <TouchableOpacity
                    key={value}
                    onPress={() => setPriorityFilter(value)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 8,
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor:
                        priorityFilter === value
                          ? isDark
                            ? "#2563eb"
                            : "#2563eb"
                          : isDark
                            ? "#374151"
                            : "#f3f4f6",
                    }}
                  >
                    <Ionicons
                      name={icon as any}
                      size={16}
                      color={
                        priorityFilter === value
                          ? "#fff"
                          : isDark
                            ? "#9CA3AF"
                            : "#6B7280"
                      }
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={{
                        color:
                          priorityFilter === value
                            ? "#fff"
                            : isDark
                              ? "#9CA3AF"
                              : "#374151",
                      }}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "500",
                  marginBottom: 8,
                  color: isDark ? "#9CA3AF" : "#374151",
                }}
              >
                Status
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[
                  { value: "all", icon: "list-outline", label: "All" },
                  { value: "pending", icon: "time-outline", label: "Pending" },
                  {
                    value: "in_progress",
                    icon: "play-outline",
                    label: "In Progress",
                  },
                  {
                    value: "completed",
                    icon: "checkmark-outline",
                    label: "Completed",
                  },
                ].map(({ value, icon, label }) => (
                  <TouchableOpacity
                    key={value}
                    onPress={() => setStatusFilter(value)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 8,
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor:
                        statusFilter === value
                          ? isDark
                            ? "#2563eb"
                            : "#2563eb"
                          : isDark
                            ? "#374151"
                            : "#f3f4f6",
                    }}
                  >
                    <Ionicons
                      name={icon as any}
                      size={16}
                      color={
                        statusFilter === value
                          ? "#fff"
                          : isDark
                            ? "#9CA3AF"
                            : "#6B7280"
                      }
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={{
                        color:
                          statusFilter === value
                            ? "#fff"
                            : isDark
                              ? "#9CA3AF"
                              : "#374151",
                      }}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "500",
                  marginBottom: 8,
                  color: isDark ? "#9CA3AF" : "#374151",
                }}
              >
                Reassignment Status
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[
                  { value: "all", label: "All Tasks" },
                  { value: "reassigned", label: "Reassigned" },
                  { value: "not_reassigned", label: "Not Reassigned" },
                ].map(({ value, label }) => (
                  <TouchableOpacity
                    key={value}
                    onPress={() => setReassignedFilter(value)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 8,
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor:
                        reassignedFilter === value
                          ? value === "reassigned"
                            ? isDark
                              ? "#8b5cf6"
                              : "#8b5cf6"
                            : isDark
                              ? "#6b7280"
                              : "#6b7280"
                          : isDark
                            ? "#374151"
                            : "#f3f4f6",
                    }}
                  >
                    <Text
                      style={{
                        color:
                          reassignedFilter === value
                            ? "#fff"
                            : isDark
                              ? "#9CA3AF"
                              : "#374151",
                      }}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}
      </View>

      <ScrollView
        style={[styles.content, { paddingBottom: 80 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[isDark ? "#60A5FA" : "#3B82F6"]}
            tintColor={isDark ? "#60A5FA" : "#3B82F6"}
            progressBackgroundColor={isDark ? "#1F2937" : "#F3F4F6"}
          />
        }
      >
        <View
          style={[
            styles.formSection,
            { backgroundColor: isDark ? "#1F2937" : "#FFFFFF" },
          ]}
        >
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: isDark ? "#374151" : "#F3F4F6",
                color: isDark ? "#FFFFFF" : "#111827",
                borderWidth: 1,
                borderColor: isDark ? "#374151" : "#E5E7EB",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
                elevation: 2,
              },
            ]}
            placeholder="Task Title"
            placeholderTextColor={isDark ? "#9CA3AF" : "#6B7280"}
            value={newTask.title}
            onChangeText={(text) =>
              setNewTask((prev) => ({ ...prev, title: text }))
            }
          />
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: isDark ? "#374151" : "#F3F4F6",
                color: isDark ? "#FFFFFF" : "#111827",
                height: 100,
                textAlignVertical: "top",
                borderWidth: 1,
                borderColor: isDark ? "#374151" : "#E5E7EB",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
                elevation: 2,
              },
            ]}
            placeholder="Task Description"
            placeholderTextColor={isDark ? "#9CA3AF" : "#6B7280"}
            value={newTask.description}
            onChangeText={(text) =>
              setNewTask((prev) => ({ ...prev, description: text }))
            }
            multiline
            numberOfLines={4}
          />

          <Text
            style={{
              fontSize: 14,
              fontWeight: "500",
              marginBottom: 8,
              color: isDark ? "#9CA3AF" : "#374151",
            }}
          >
            Assign To
          </Text>
          <TouchableOpacity
            onPress={() => {
              setShowEmployeePicker(true);
              setEmployeeSearch("");
              Keyboard.dismiss();
            }}
            style={{
              padding: 16,
              borderRadius: 8,
              marginBottom: 16,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: isDark ? "#374151" : "#f3f4f6",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
              elevation: 2,
              borderWidth: 1,
              borderColor: isDark ? "#374151" : "#E5E7EB",
            }}
          >
            <Text style={{ color: isDark ? "#fff" : "#000" }}>
              {newTask.assignedTo === 0
                ? "Select Employee"
                : `${employees.find((e) => e.id === newTask.assignedTo)?.name || ""} - ${employees.find((e) => e.id === newTask.assignedTo)?.employee_number || ""}`}
            </Text>
            <Ionicons
              name="chevron-down"
              size={20}
              color={isDark ? "#9CA3AF" : "#6B7280"}
            />
          </TouchableOpacity>

          {/* Priority Selection */}
          <View style={{ marginBottom: 16 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "500",
                marginBottom: 8,
                color: isDark ? "#9CA3AF" : "#374151",
              }}
            >
              Priority
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[
                { value: "low", label: "Low", color: "#10B981", icon: "checkmark-circle-outline" },
                { value: "medium", label: "Medium", color: "#F59E0B", icon: "remove-circle-outline" },
                { value: "high", label: "High", color: "#F97316", icon: "alert-circle-outline" },
                { value: "critical", label: "Critical", color: "#EF4444", icon: "warning-outline" },
              ].map((priority) => (
                <TouchableOpacity
                  key={priority.value}
                  onPress={() => setNewTask((prev) => ({ ...prev, priority: priority.value as any }))}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                    borderRadius: 8,
                    borderWidth: 2,
                    borderColor: newTask.priority === priority.value ? priority.color : isDark ? "#374151" : "#E5E7EB",
                    backgroundColor: newTask.priority === priority.value 
                      ? `${priority.color}20` 
                      : isDark ? "#374151" : "#F3F4F6",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name={priority.icon as any}
                    size={16}
                    color={newTask.priority === priority.value ? priority.color : isDark ? "#9CA3AF" : "#6B7280"}
                    style={{ marginBottom: 4 }}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: newTask.priority === priority.value ? priority.color : isDark ? "#9CA3AF" : "#6B7280",
                    }}
                  >
                    {priority.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "500",
                marginBottom: 8,
                color: isDark ? "#9CA3AF" : "#374151",
              }}
            >
              Due Date
            </Text>
            <TouchableOpacity
              onPress={() => setShowDueDatePicker(true)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 16,
                borderRadius: 8,
                backgroundColor: isDark ? "#374151" : "#f3f4f6",
              }}
            >
              <Text style={{ color: isDark ? "#9CA3AF" : "#374151" }}>
                {newTask.due_date
                  ? format(new Date(newTask.due_date), "MMM dd, yyyy")
                  : "Select Due Date"}
              </Text>
              <Ionicons
                name="calendar-outline"
                size={20}
                color={isDark ? "#9CA3AF" : "#6B7280"}
              />
            </TouchableOpacity>
            {showDueDatePicker && (
              <DateTimePicker
                value={
                  newTask.due_date ? new Date(newTask.due_date) : new Date()
                }
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={handleDueDateChange}
                minimumDate={new Date()}
                textColor={isDark ? "#FFFFFF" : "#000000"}
              />
            )}
          </View>

          {/* Attachments Section */}
          <View style={{ marginBottom: 16 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "500",
                marginBottom: 8,
                color: isDark ? "#9CA3AF" : "#374151",
              }}
            >
              Attachments
            </Text>
            <TouchableOpacity
              onPress={pickDocument}
              disabled={isUploading}
              style={{
                borderWidth: 2,
                borderStyle: "dashed",
                borderColor: isDark ? "#374151" : "#E5E7EB",
                borderRadius: 12,
                padding: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isDark ? "#374151" : "#F9FAFB",
                marginBottom: 12,
              }}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color={isDark ? "#60A5FA" : "#3B82F6"} />
              ) : (
                <>
                  <Ionicons
                    name="cloud-upload-outline"
                    size={32}
                    color={isDark ? "#9CA3AF" : "#6B7280"}
                    style={{ marginBottom: 8 }}
                  />
                  <Text style={{ color: isDark ? "#9CA3AF" : "#6B7280", fontSize: 14 }}>
                    Tap to upload files
                  </Text>
                  <Text style={{ color: isDark ? "#6B7280" : "#9CA3AF", fontSize: 12, marginTop: 4 }}>
                    Max file size: 10MB
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Display uploaded attachments */}
            {attachments.length > 0 && (
              <View style={{ gap: 8 }}>
                {attachments.map((attachment, index) => (
                  <View
                    key={index}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      padding: 12,
                      backgroundColor: isDark ? "#374151" : "#F3F4F6",
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: isDark ? "#374151" : "#E5E7EB",
                    }}
                  >
                    <Ionicons
                      name="document-outline"
                      size={20}
                      color={isDark ? "#60A5FA" : "#3B82F6"}
                      style={{ marginRight: 12 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: isDark ? "#fff" : "#000", fontSize: 14, fontWeight: "500" }}>
                        {attachment.fileName}
                      </Text>
                      <Text style={{ color: isDark ? "#9CA3AF" : "#6B7280", fontSize: 12 }}>
                        {(attachment.fileSize / 1024 / 1024).toFixed(2)} MB
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => removeAttachment(index)}
                      style={{
                        padding: 8,
                        borderRadius: 6,
                        backgroundColor: isDark ? "#EF444420" : "#FEE2E2",
                      }}
                    >
                      <Ionicons name="close" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Customer Details Section */}
          <View
            style={{
              backgroundColor: isDark ? "#374151" : "#F3F4F6",
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                marginBottom: 16,
                color: isDark ? "#fff" : "#000",
              }}
            >
              Customer Details
            </Text>

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? "#1F2937" : "#fff",
                  color: isDark ? "#FFFFFF" : "#111827",
                  borderWidth: 1,
                  borderColor: isDark ? "#374151" : "#E5E7EB",
                  marginBottom: 12,
                },
              ]}
              placeholder="Customer Name"
              placeholderTextColor={isDark ? "#9CA3AF" : "#6B7280"}
              value={customerDetails.name}
              onChangeText={(text) =>
                setCustomerDetails((prev) => ({ ...prev, name: text }))
              }
            />

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? "#1F2937" : "#fff",
                  color: isDark ? "#FFFFFF" : "#111827",
                  borderWidth: 1,
                  borderColor: isDark ? "#374151" : "#E5E7EB",
                  marginBottom: 12,
                },
              ]}
              placeholder="Email or Phone Number"
              placeholderTextColor={isDark ? "#9CA3AF" : "#6B7280"}
              value={customerDetails.contact}
              onChangeText={(text) =>
                setCustomerDetails((prev) => ({ ...prev, contact: text }))
              }
              keyboardType="email-address"
            />

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? "#1F2937" : "#fff",
                  color: isDark ? "#FFFFFF" : "#111827",
                  height: 80,
                  textAlignVertical: "top",
                  borderWidth: 1,
                  borderColor: isDark ? "#374151" : "#E5E7EB",
                  marginBottom: 12,
                },
              ]}
              placeholder="Customer Notes (Optional)"
              placeholderTextColor={isDark ? "#9CA3AF" : "#6B7280"}
              value={customerDetails.notes}
              onChangeText={(text) =>
                setCustomerDetails((prev) => ({ ...prev, notes: text }))
              }
              multiline
              numberOfLines={3}
            />

            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <TouchableOpacity
                onPress={() => {
                  // Only allow toggling if contact is email or empty
                  const isEmail = customerDetails.contact.length === 0 || customerDetails.contact.includes('@');
                  if (isEmail) {
                    setCustomerDetails((prev) => ({ ...prev, sendUpdates: !prev.sendUpdates }));
                  }
                }}
                disabled={customerDetails.contact.length > 0 && !customerDetails.contact.includes('@')}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  borderWidth: 2,
                  borderColor: customerDetails.sendUpdates ? "#3B82F6" : isDark ? "#6B7280" : "#9CA3AF",
                  backgroundColor: customerDetails.sendUpdates ? "#3B82F6" : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                  opacity: (customerDetails.contact.length > 0 && !customerDetails.contact.includes('@')) ? 0.5 : 1,
                }}
              >
                {customerDetails.sendUpdates && (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                )}
              </TouchableOpacity>
              <Text style={{ 
                color: (customerDetails.contact.length > 0 && !customerDetails.contact.includes('@')) 
                  ? isDark ? "#6B7280" : "#9CA3AF" 
                  : isDark ? "#9CA3AF" : "#374151", 
                fontSize: 14 
              }}>
                Send customer updates
              </Text>
              {customerDetails.contact.length > 0 && customerDetails.contact.includes('@') === false && (
                <Text style={{ color: "#EF4444", fontSize: 12, marginLeft: 8 }}>
                  (SMS not yet supported)
                </Text>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.createButton, { opacity: isLoading ? 0.7 : 1 }]}
            onPress={createTask}
            disabled={isLoading || !newTask.title || !newTask.assignedTo}
          >
            <Text style={styles.createButtonText}>
              {isLoading ? "Creating..." : "Create Task"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.taskList, { marginBottom: 20 }]}>
          {isLoading ? (
            <View
              style={[
                styles.emptyState,
                { backgroundColor: isDark ? "#1F2937" : "#FFFFFF" },
              ]}
            >
              <ActivityIndicator
                size="large"
                color={isDark ? "#60A5FA" : "#3B82F6"}
              />
              <Text
                style={[
                  styles.emptyStateText,
                  { color: isDark ? "#9CA3AF" : "#6B7280", marginTop: 16 },
                ]}
              >
                Loading tasks...
              </Text>
            </View>
          ) : filteredTasks.length === 0 ? (
            <View
              style={[
                styles.emptyState,
                { backgroundColor: isDark ? "#1F2937" : "#FFFFFF" },
              ]}
            >
              <Ionicons
                name={tasks.length === 0 ? "list-outline" : "search-outline"}
                size={48}
                color={isDark ? "#4B5563" : "#9CA3AF"}
              />
              <Text
                style={[
                  styles.emptyStateText,
                  { color: isDark ? "#9CA3AF" : "#6B7280" },
                ]}
              >
                {tasks.length === 0
                  ? "No tasks created yet"
                  : "No matching tasks found"}
              </Text>
              <Text
                style={[
                  styles.emptyStateSubText,
                  { color: isDark ? "#6B7280" : "#9CA3AF" },
                ]}
              >
                {tasks.length === 0
                  ? "Create your first task using the form above"
                  : "Try adjusting your filters or search query"}
              </Text>
            </View>
          ) : (
            filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isDark={theme === "dark"}
                employees={employees}
                onUpdateTask={updateTask}
                onTaskClick={handleTaskClick}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Success Modal */}
      {showSuccess && (
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: isDark
                ? "rgba(17, 24, 39, 0.95)"
                : "rgba(255, 255, 255, 0.95)",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 50,
            },
            {
              transform: [{ scale: successScale }],
            },
          ]}
        >
          <View style={{ alignItems: "center", padding: 24 }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: isDark
                  ? "rgba(74, 222, 128, 0.2)"
                  : "rgba(74, 222, 128, 0.1)",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <MaterialCommunityIcons
                name="check-circle"
                size={40}
                color={isDark ? "#4ADE80" : "#22C55E"}
              />
            </View>
            <Text
              style={{
                fontSize: 24,
                fontWeight: "600",
                marginBottom: 8,
                color: isDark ? "#FFFFFF" : "#111827",
              }}
            >
              Success!
            </Text>
            <Text
              style={{
                fontSize: 16,
                textAlign: "center",
                color: isDark ? "#9CA3AF" : "#4B5563",
              }}
            >
              Task has been created successfully
            </Text>
          </View>
        </Animated.View>
      )}

      <BottomNav items={groupAdminNavItems} />
      <EmployeePickerModal
        show={showEmployeePicker}
        onClose={() => setShowEmployeePicker(false)}
        employeeSearch={employeeSearch}
        setEmployeeSearch={setEmployeeSearch}
        filteredEmployees={filteredEmployees}
        isDark={isDark}
        onSelectEmployee={(id: number) =>
          setNewTask((prev) => ({ ...prev, assignedTo: id }))
        }
        selectedEmployeeId={newTask.assignedTo || 0}
      />
      <EmployeePickerModal
        show={showFilterEmployeePicker}
        onClose={() => setShowFilterEmployeePicker(false)}
        employeeSearch={filterEmployeeSearch}
        setEmployeeSearch={setFilterEmployeeSearch}
        filteredEmployees={filteredFilterEmployees}
        isDark={isDark}
        onSelectEmployee={(id: number) => {
          const newValue = id === 0 ? "all" : id.toString();
          console.log("Setting employee filter to:", {
            id,
            newValue,
            employee:
              id === 0 ? "All Employees" : employees.find((e) => e.id === id),
          });
          setEmployeeFilter(newValue);
          setShowFilterEmployeePicker(false);
        }}
        selectedEmployeeId={
          employeeFilter === "all" ? 0 : parseInt(employeeFilter)
        }
      />
      
      {/* Task Details Modal */}
      <TaskDetailsModal
        visible={showTaskDetails}
        onClose={handleCloseTaskDetails}
        taskId={selectedTaskId}
        isDark={isDark}
        onTaskUpdate={handleTaskUpdate}
      />
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
  content: {
    flex: 1,
    padding: 16,
    marginTop: 8,
  },
  formSection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  input: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  taskList: {
    gap: 12,
    marginBottom: 20,
  },
  taskCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  pickerContainer: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
  },
  createButton: {
    backgroundColor: "#3B82F6",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  createButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  emptyState: {
    padding: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  emptyStateSubText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  searchBar: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    height: 50,
    marginTop: 8,
  },
  filterCard: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
});
